from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Comparison, User
from ..schemas import ComparisonIn, ScorePreviewIn
from ..security import get_current_user
from ..services.context import get_profile, get_weights, list_owned_listings, load_items, merge_weights
from ..services.scoring import CATEGORIES, compute_listing_score, rank_results

router = APIRouter(prefix="/api", tags=["scores"])

ACTIVE_STATUSES = {"candidate", "hold", "selected"}


def _score_many(db: Session, user: User, listings, weights: dict[str, int]) -> list[dict]:
    items = load_items(db)
    profile = get_profile(db, user)
    return rank_results([compute_listing_score(l, items, weights, profile) for l in listings])


@router.post("/scores/preview")
def preview_scores(body: ScorePreviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """슬라이더를 움직일 때 호출. 가중치를 저장하지 않고 점수·순위만 다시 계산합니다."""
    weights = merge_weights(get_weights(db, user), body.weights)
    if body.listing_ids:
        listings = list_owned_listings(db, user, body.listing_ids)
    else:
        listings = [l for l in list_owned_listings(db, user) if l.status in ACTIVE_STATUSES]
    return {"weights": weights, "categories": CATEGORIES, "results": _score_many(db, user, listings, weights)}


@router.post("/comparisons", status_code=201)
def create_comparison(body: ComparisonIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """비교 실행 결과를 DB에 저장합니다(가중치 스냅샷 포함). AI 비교 리포트는 이 기록을 근거로 만듭니다."""
    ids = list(dict.fromkeys(body.listing_ids))
    if len(ids) < 2:
        raise HTTPException(400, "서로 다른 매물을 2개 이상 선택해 주세요.")
    weights = merge_weights(get_weights(db, user), body.weights)
    listings = list_owned_listings(db, user, ids)
    results = _score_many(db, user, listings, weights)
    comp = Comparison(
        user_id=user.id,
        listing_ids=ids,
        weights_snapshot=weights,
        result={"results": results},
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return _comparison_out(comp)


@router.get("/comparisons/latest")
def latest_comparison(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comp = db.scalar(
        select(Comparison).where(Comparison.user_id == user.id).order_by(Comparison.id.desc()).limit(1)
    )
    return _comparison_out(comp) if comp else None


@router.get("/comparisons/{comparison_id}")
def get_comparison(comparison_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comp = db.get(Comparison, comparison_id)
    if not comp or comp.user_id != user.id:
        raise HTTPException(404, "비교 기록을 찾을 수 없습니다.")
    return _comparison_out(comp)


def _comparison_out(comp: Comparison) -> dict:
    return {
        "id": comp.id,
        "listing_ids": comp.listing_ids,
        "weights": comp.weights_snapshot,
        "results": comp.result.get("results", []),
        "categories": CATEGORIES,
        "created_at": comp.created_at.isoformat() if comp.created_at else None,
    }
