"""여러 라우터에서 함께 쓰는 조회 도우미 (소유자 확인 포함)."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import ChecklistItem, Listing, PriorityWeight, User, UserProfile
from .scoring import CATEGORIES, ItemInfo


def load_items(db: Session) -> dict[str, ItemInfo]:
    rows = db.scalars(
        select(ChecklistItem).where(ChecklistItem.is_active.is_(True)).order_by(ChecklistItem.sort_order)
    ).all()
    return {
        r.id: ItemInfo(
            id=r.id,
            category=r.category,
            label=r.label,
            input_type=r.input_type,
            is_required=r.is_required,
            score_map=r.score_map,
            guide_text=r.guide_text,
            caution_text=r.caution_text,
            time_sensitive=r.time_sensitive,
        )
        for r in rows
    }


def get_weights(db: Session, user: User) -> dict[str, int]:
    rows = db.scalars(select(PriorityWeight).where(PriorityWeight.user_id == user.id)).all()
    w = {c: 3 for c in CATEGORIES}
    for r in rows:
        if r.category in w:
            w[r.category] = r.weight
    return w


def save_weights(db: Session, user: User, weights: dict[str, int]) -> dict[str, int]:
    existing = {
        r.category: r
        for r in db.scalars(select(PriorityWeight).where(PriorityWeight.user_id == user.id)).all()
    }
    for cat in CATEGORIES:
        if cat not in weights:
            continue
        val = max(1, min(5, int(weights[cat])))
        if cat in existing:
            existing[cat].weight = val
        else:
            db.add(PriorityWeight(user_id=user.id, category=cat, weight=val))
    db.flush()
    return get_weights(db, user)


def merge_weights(base: dict[str, int], override: dict[str, int] | None) -> dict[str, int]:
    if not override:
        return base
    merged = dict(base)
    for k, v in override.items():
        if k in merged:
            merged[k] = max(1, min(5, int(v)))
    return merged


def get_profile(db: Session, user: User) -> UserProfile | None:
    return db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))


def get_owned_listing(db: Session, user: User, listing_id: int) -> Listing:
    """다른 사용자의 매물 id를 넣어도 접근할 수 없도록 항상 소유자를 함께 확인합니다."""
    listing = db.scalar(
        select(Listing)
        .where(Listing.id == listing_id, Listing.user_id == user.id)
        .options(
            selectinload(Listing.checks),
            selectinload(Listing.visits),
            selectinload(Listing.photos),
        )
        .execution_options(populate_existing=True)
    )
    if not listing:
        raise HTTPException(404, "매물을 찾을 수 없습니다.")
    return listing


def list_owned_listings(db: Session, user: User, ids: list[int] | None = None) -> list[Listing]:
    q = (
        select(Listing)
        .where(Listing.user_id == user.id)
        .options(selectinload(Listing.checks), selectinload(Listing.visits), selectinload(Listing.photos))
        .order_by(Listing.created_at.desc(), Listing.id.desc())
        .execution_options(populate_existing=True)
    )
    if ids is not None:
        q = q.where(Listing.id.in_(ids))
    rows = list(db.scalars(q).all())
    if ids is not None and len(rows) != len(set(ids)):
        raise HTTPException(404, "선택한 매물 중 찾을 수 없는 매물이 있습니다.")
    return rows
