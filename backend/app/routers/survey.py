"""서비스 만족도 설문 API.

- 로그인한 사용자 누구나 1회 응답 (다시 제출하면 수정)
- 결과 집계·CSV는 관리자(.env의 ADMIN_EMAILS)만 볼 수 있음
- 집계에서는 관리자 계정과 데모 계정을 제외해 실제 테스터 응답만 셉니다
"""
from __future__ import annotations

import csv
import io
import json
import statistics
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import AIUsageLog, Home, Listing, SurveyResponse, User, UserProfile
from ..security import get_current_user

router = APIRouter(prefix="/api/survey", tags=["survey"])
QUESTIONS = json.loads((Path(__file__).resolve().parent.parent / "data" / "survey_questions.json").read_text(encoding="utf-8"))
QIDS = [q["id"] for q in QUESTIONS["questions"]]
DEMO_EMAIL = "demo@firsthome.app"


class SurveyIn(BaseModel):
    segment: Literal["preparing", "living", "interested", "other"] | None = None
    scores: dict[str, int]
    good_text: str | None = Field(default=None, max_length=1000)
    improve_text: str | None = Field(default=None, max_length=1000)

    @field_validator("scores")
    @classmethod
    def _all_answered(cls, v: dict[str, int]) -> dict[str, int]:
        if set(v) != set(QIDS):
            raise ValueError("10개 문항에 모두 답해 주세요.")
        if any(not isinstance(x, int) or not 1 <= x <= 5 for x in v.values()):
            raise ValueError("점수는 1~5 사이여야 합니다.")
        return {k: v[k] for k in QIDS}


def is_admin(user: User) -> bool:
    return user.email.lower() in get_settings().admin_email_set


def _out(r: SurveyResponse | None) -> dict | None:
    if not r:
        return None
    return {
        "segment": r.segment,
        "scores": r.scores,
        "good_text": r.good_text,
        "improve_text": r.improve_text,
        "updated_at": (r.updated_at or r.created_at).isoformat() if (r.updated_at or r.created_at) else None,
    }


@router.get("")
def get_survey(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mine = db.scalar(select(SurveyResponse).where(SurveyResponse.user_id == user.id))
    return {**QUESTIONS, "mine": _out(mine), "is_admin": is_admin(user)}


@router.put("")
def submit_survey(body: SurveyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(SurveyResponse).where(SurveyResponse.user_id == user.id))
    if not row:
        row = SurveyResponse(user_id=user.id)
        db.add(row)
    row.segment = body.segment
    row.scores = body.scores
    row.good_text = (body.good_text or "").strip() or None
    row.improve_text = (body.improve_text or "").strip() or None
    db.commit()
    db.refresh(row)
    return {"ok": True, "mine": _out(row)}


# ---------------------------------------------------------------- 관리자: 집계
def _require_admin(user: User) -> None:
    if not is_admin(user):
        raise HTTPException(403, "설문 결과는 관리자만 볼 수 있어요.")


def _excluded_ids(db: Session) -> list[int]:
    emails = get_settings().admin_email_set | {DEMO_EMAIL}
    return list(db.scalars(select(User.id).where(func.lower(User.email).in_(emails))))


def _tester_rows(db: Session) -> list[SurveyResponse]:
    ex = _excluded_ids(db)
    q = select(SurveyResponse).order_by(SurveyResponse.created_at)
    if ex:
        q = q.where(SurveyResponse.user_id.not_in(ex))
    return list(db.scalars(q))


@router.get("/results")
def results(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    rows = _tester_rows(db)
    ex = _excluded_ids(db)
    n = len(rows)

    per_q = []
    for q in QUESTIONS["questions"]:
        vals = [r.scores.get(q["id"]) for r in rows if r.scores.get(q["id"])]
        dist = [sum(1 for v in vals if v == k) for k in range(1, 6)]
        per_q.append(
            {
                **q,
                "mean": round(statistics.mean(vals), 2) if vals else None,
                "sd": round(statistics.pstdev(vals), 2) if len(vals) > 1 else None,
                "dist": dist,
                "top2_pct": round((dist[3] + dist[4]) / len(vals) * 100) if vals else None,
            }
        )
    all_vals = [v for r in rows for v in r.scores.values()]
    seg_labels = {s["value"]: s["label"] for s in QUESTIONS["segments"]}
    segments = {}
    for r in rows:
        key = seg_labels.get(r.segment or "", "응답 안 함")
        segments[key] = segments.get(key, 0) + 1

    def count(q):
        return db.scalar(q) or 0

    not_ex = (lambda col: col.not_in(ex)) if ex else (lambda col: col.is_not(None))
    usage = {
        "users": count(select(func.count(User.id)).where(not_ex(User.id))),
        "onboarded": count(select(func.count(UserProfile.id)).where(UserProfile.onboarding_done.is_(True), not_ex(UserProfile.user_id))),
        "users_with_listing": count(select(func.count(distinct(Listing.user_id))).where(not_ex(Listing.user_id))),
        "listings": count(select(func.count(Listing.id)).where(not_ex(Listing.user_id))),
        "precheck_runs": count(select(func.count(AIUsageLog.id)).where(AIUsageLog.kind == "precheck", not_ex(AIUsageLog.user_id))),
        "ai_reports": count(
            select(func.count(AIUsageLog.id)).where(AIUsageLog.kind.in_(("listing", "compare")), not_ex(AIUsageLog.user_id))
        ),
        "decided_homes": count(select(func.count(Home.id)).where(not_ex(Home.user_id))),
    }
    return {
        "respondents": n,
        "overall_mean": round(statistics.mean(all_vals), 2) if all_vals else None,
        "recommend_top2_pct": per_q[-1]["top2_pct"],
        "questions": per_q,
        "segments": segments,
        "good": [r.good_text for r in reversed(rows) if r.good_text],
        "improve": [r.improve_text for r in reversed(rows) if r.improve_text],
        "first_at": rows[0].created_at.isoformat() if rows else None,
        "last_at": rows[-1].created_at.isoformat() if rows else None,
        "usage": usage,
        "scale": QUESTIONS["scale"],
        "excluded_note": "관리자·데모 계정의 응답과 사용 기록은 집계에서 제외했습니다.",
    }


@router.get("/results.csv")
def results_csv(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """응답 원자료 (이름·이메일 없이 순번만). 보고서·통계 분석용."""
    _require_admin(user)
    rows = _tester_rows(db)
    seg_labels = {s["value"]: s["label"] for s in QUESTIONS["segments"]}
    buf = io.StringIO()
    buf.write("﻿")  # 엑셀에서 한글이 깨지지 않도록
    w = csv.writer(buf)
    w.writerow(["순번", "응답일", "상황", *[f"{q['id']} {q['area']}" for q in QUESTIONS["questions"]], "좋았던 점", "개선할 점"])
    for i, r in enumerate(rows, 1):
        w.writerow(
            [
                i,
                r.created_at.strftime("%Y-%m-%d") if r.created_at else "",
                seg_labels.get(r.segment or "", ""),
                *[r.scores.get(q) for q in QIDS],
                r.good_text or "",
                r.improve_text or "",
            ]
        )
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=firsthome_survey.csv"},
    )
