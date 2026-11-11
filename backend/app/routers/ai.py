from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import AIReport, ChecklistItem, Comparison, User
from ..security import get_current_user
from ..services import ai_service
from ..services.ai_input import listing_context, user_context
from ..services.ai_mock import mock_compare_report, mock_listing_report
from ..services.context import get_owned_listing, get_profile, get_weights, list_owned_listings, load_items
from ..services.scoring import compute_listing_score, rank_results

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _options_map(db: Session) -> dict:
    return {i.id: i.options for i in db.scalars(select(ChecklistItem)).all()}


def _listing_payload(db: Session, user: User, listing_id: int):
    listing = get_owned_listing(db, user, listing_id)
    items = load_items(db)
    weights = get_weights(db, user)
    profile = get_profile(db, user)
    score = compute_listing_score(listing, items, weights, profile)
    uctx = user_context(profile, weights)
    lctx = listing_context(listing, items, _options_map(db), score)
    return {"user": uctx, "listing": lctx}, score


def _current_hash(kind: str, payload: dict) -> str:
    s = get_settings()
    mode = s.effective_ai_mode
    return ai_service.input_hash(kind, payload, mode, ai_service.current_model() if mode == "openai" else None)


@router.get("/status")
def ai_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = get_settings()
    return {
        "configured_mode": s.ai_mode,
        "effective_mode": s.effective_ai_mode,
        "openai_ready": s.openai_ready,
        "model": ai_service.current_model() if s.effective_ai_mode == "openai" else None,
        "model_auto": not s.openai_model.strip(),
        "usage_today_user": ai_service.usage_today(db, user.id),
        "limit_per_user": s.ai_daily_limit_per_user,
    }


@router.post("/listings/{listing_id}/report")
def create_listing_report(listing_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payload, score = _listing_payload(db, user, listing_id)
    report, cached = ai_service.generate(
        db,
        user,
        "listing",
        payload,
        ai_service.LISTING_FORMAT,
        mock_fn=lambda: mock_listing_report(payload["user"], payload["listing"], score),
        validate_fn=lambda raw: ai_service.validate_listing_report(raw, score),
        listing_id=listing_id,
    )
    return {**ai_service.report_out(report, cached), "score": score}


@router.get("/listings/{listing_id}/report")
def latest_listing_report(listing_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payload, score = _listing_payload(db, user, listing_id)
    report = db.scalar(
        select(AIReport)
        .where(AIReport.user_id == user.id, AIReport.kind == "listing", AIReport.listing_id == listing_id)
        .order_by(AIReport.id.desc())
        .limit(1)
    )
    if not report:
        return None
    return {**ai_service.report_out(report, True, _current_hash("listing", payload)), "score": score}


def _compare_payload(db: Session, user: User, comp: Comparison):
    listings = list_owned_listings(db, user, comp.listing_ids)
    items = load_items(db)
    profile = get_profile(db, user)
    weights = comp.weights_snapshot
    scores = rank_results([compute_listing_score(l, items, weights, profile) for l in listings])
    by_id = {l.id: l for l in listings}
    opts = _options_map(db)
    contexts = [listing_context(by_id[s["listing_id"]], items, opts, s) for s in scores]
    return {"user": user_context(profile, weights), "listings": contexts}, scores, contexts


def _get_comp(db: Session, user: User, comparison_id: int) -> Comparison:
    comp = db.get(Comparison, comparison_id)
    if not comp or comp.user_id != user.id:
        raise HTTPException(404, "비교 기록을 찾을 수 없습니다.")
    return comp


@router.post("/comparisons/{comparison_id}/report")
def create_compare_report(comparison_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comp = _get_comp(db, user, comparison_id)
    payload, scores, contexts = _compare_payload(db, user, comp)
    report, cached = ai_service.generate(
        db,
        user,
        "compare",
        payload,
        ai_service.COMPARE_FORMAT,
        mock_fn=lambda: mock_compare_report(payload["user"], contexts, scores),
        validate_fn=lambda raw: ai_service.validate_compare_report(raw, scores),
        comparison_id=comparison_id,
    )
    return {**ai_service.report_out(report, cached), "scores": scores}


@router.get("/comparisons/{comparison_id}/report")
def latest_compare_report(comparison_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comp = _get_comp(db, user, comparison_id)
    report = db.scalar(
        select(AIReport)
        .where(AIReport.user_id == user.id, AIReport.kind == "compare", AIReport.comparison_id == comparison_id)
        .order_by(AIReport.id.desc())
        .limit(1)
    )
    if not report:
        return None
    payload, scores, _ = _compare_payload(db, user, comp)
    return {**ai_service.report_out(report, True, _current_hash("compare", payload)), "scores": scores}
