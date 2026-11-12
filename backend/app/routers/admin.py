"""관리자 운영 현황 API (읽기 전용).

- ADMIN_EMAILS에 등록된 계정만 볼 수 있음
- 이름·이메일 같은 개인정보는 내보내지 않고 숫자만 집계
- 사용 현황(가입·매물·AI 사용·설문)은 관리자·데모 계정을 제외한 '실제 테스터' 기준
- AI 운영 지표(오늘 호출량·한도·토큰)는 서버 비용과 직결되므로 모든 계정 기준
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import distinct, func, select, text
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import (
    AIUsageLog,
    Home,
    Listing,
    ListingCheck,
    ListingVisit,
    Photo,
    SurveyResponse,
    User,
    UserProfile,
)
from ..security import get_current_user
from ..services import ai_service
from .survey import _excluded_ids, is_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])
KST = timezone(timedelta(hours=9))
SURVEY_GOAL = 10
TREND_DAYS = 14


def _require_admin(user: User) -> None:
    if not is_admin(user):
        raise HTTPException(403, "운영 현황은 관리자만 볼 수 있어요.")


def _db_offset(db: Session) -> timedelta:
    """DB가 시간을 저장하는 시간대와 UTC의 차이 (TiDB·Render는 보통 UTC, 로컬 MySQL은 KST일 수 있음)."""
    try:
        minutes = db.execute(text("SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW())")).scalar() or 0
        return timedelta(minutes=round(minutes / 15) * 15)
    except Exception:  # noqa: BLE001 - 시간대 확인 실패 시 UTC로 가정
        return timedelta(0)


@router.get("/overview")
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(user)
    s = get_settings()
    ex = _excluded_ids(db)

    def tester(col):
        return col.not_in(ex) if ex else col.is_not(None)

    def count(q) -> int:
        return int(db.scalar(q) or 0)

    # ------------------------------------------------------------ 사용 현황 (테스터 기준)
    users = count(select(func.count(User.id)).where(tester(User.id)))
    onboarded = count(
        select(func.count(UserProfile.id)).where(UserProfile.onboarding_done.is_(True), tester(UserProfile.user_id))
    )
    users_with_listing = count(select(func.count(distinct(Listing.user_id))).where(tester(Listing.user_id)))
    users_with_check = count(
        select(func.count(distinct(Listing.user_id)))
        .join(ListingCheck, ListingCheck.listing_id == Listing.id)
        .where(tester(Listing.user_id))
    )
    users_with_ai = count(select(func.count(distinct(AIUsageLog.user_id))).where(tester(AIUsageLog.user_id)))
    survey_n = count(select(func.count(SurveyResponse.id)).where(tester(SurveyResponse.user_id)))

    totals = {
        "users": users,
        "onboarded": onboarded,
        "listings": count(select(func.count(Listing.id)).where(tester(Listing.user_id))),
        "users_with_listing": users_with_listing,
        "visits": count(
            select(func.count(ListingVisit.id))
            .join(Listing, Listing.id == ListingVisit.listing_id)
            .where(tester(Listing.user_id))
        ),
        "checks": count(
            select(func.count(ListingCheck.id))
            .join(Listing, Listing.id == ListingCheck.listing_id)
            .where(tester(Listing.user_id))
        ),
        "photos": count(
            select(func.count(Photo.id)).join(Listing, Listing.id == Photo.listing_id).where(tester(Listing.user_id))
        ),
        "precheck_runs": count(
            select(func.count(AIUsageLog.id)).where(AIUsageLog.kind == "precheck", tester(AIUsageLog.user_id))
        ),
        "ai_reports": count(
            select(func.count(AIUsageLog.id)).where(
                AIUsageLog.kind.in_(("listing", "compare")), tester(AIUsageLog.user_id)
            )
        ),
        "decided_homes": count(select(func.count(Home.id)).where(tester(Home.user_id))),
        "survey_responses": survey_n,
    }

    funnel = [
        {"key": "signup", "label": "가입", "count": users},
        {"key": "onboarded", "label": "내 기준 설정", "count": onboarded},
        {"key": "listing", "label": "매물 등록", "count": users_with_listing},
        {"key": "check", "label": "현장 체크 기록", "count": users_with_check},
        {"key": "ai", "label": "AI 기능 사용", "count": users_with_ai},
        {"key": "survey", "label": "설문 응답", "count": survey_n},
    ]

    # ------------------------------------------------------------ 최근 14일 추이 (한국 시간 기준, 테스터)
    offset = _db_offset(db)
    today_kst = datetime.now(KST).date()
    days = [today_kst - timedelta(days=i) for i in range(TREND_DAYS - 1, -1, -1)]
    since_db = datetime.combine(days[0], datetime.min.time()) - timedelta(hours=9) + offset  # KST 0시 → DB 시간

    def bucket(q) -> dict:
        out = {d: 0 for d in days}
        for (ts,) in db.execute(q):
            if ts is None:
                continue
            d = (ts - offset + timedelta(hours=9)).date()  # DB 시간 → UTC → KST
            if d in out:
                out[d] += 1
        return out

    signups = bucket(select(User.created_at).where(User.created_at >= since_db, tester(User.id)))
    listings_d = bucket(select(Listing.created_at).where(Listing.created_at >= since_db, tester(Listing.user_id)))
    ai_d = bucket(
        select(AIUsageLog.created_at).where(
            AIUsageLog.created_at >= since_db, AIUsageLog.cached.is_(False), tester(AIUsageLog.user_id)
        )
    )
    survey_d = bucket(
        select(SurveyResponse.created_at).where(SurveyResponse.created_at >= since_db, tester(SurveyResponse.user_id))
    )
    daily = [
        {
            "date": d.isoformat(),
            "signups": signups[d],
            "listings": listings_d[d],
            "ai_calls": ai_d[d],
            "surveys": survey_d[d],
        }
        for d in days
    ]

    # ------------------------------------------------------------ AI 운영 (전체 계정)
    rows = db.execute(
        select(AIUsageLog.mode, AIUsageLog.cached, AIUsageLog.success, func.count(AIUsageLog.id)).group_by(
            AIUsageLog.mode, AIUsageLog.cached, AIUsageLog.success
        )
    ).all()
    by_mode = {"openai": 0, "mock": 0, "cached": 0}
    failures = 0
    for mode, cached, success, n in rows:
        if cached:
            by_mode["cached"] += n
        else:
            by_mode[mode] = by_mode.get(mode, 0) + n
            if mode == "openai" and not success:
                failures += n
    kinds = dict(
        db.execute(
            select(AIUsageLog.kind, func.count(AIUsageLog.id))
            .where(AIUsageLog.cached.is_(False))
            .group_by(AIUsageLog.kind)
        ).all()
    )
    tokens = db.execute(
        select(func.sum(AIUsageLog.prompt_tokens), func.sum(AIUsageLog.completion_tokens))
    ).one()
    mode = s.effective_ai_mode
    ai = {
        "mode": mode,
        "model": ai_service.current_model() if mode == "openai" else None,
        "today_calls": ai_service.usage_today(db),
        "limit_total": s.ai_daily_limit_total,
        "limit_per_user": s.ai_daily_limit_per_user,
        "by_mode": by_mode,
        "failures": failures,
        "by_kind": {k: int(kinds.get(k, 0)) for k in ("precheck", "listing", "compare")},
        "prompt_tokens": int(tokens[0] or 0),
        "completion_tokens": int(tokens[1] or 0),
    }

    commit = (os.getenv("RENDER_GIT_COMMIT") or "")[:7] or None
    return {
        "generated_at": datetime.now(KST).isoformat(timespec="minutes"),
        "excluded_note": "사용 현황·추이는 관리자·데모 계정을 제외한 실제 테스터 기준입니다. AI 운영 지표는 모든 계정 기준입니다.",
        "survey_goal": SURVEY_GOAL,
        "totals": totals,
        "funnel": funnel,
        "daily": daily,
        "ai": ai,
        "system": {
            "app_env": s.app_env,
            "molit_mode": s.effective_molit_mode,
            "commit": commit,
            "db": "ok",
        },
    }
