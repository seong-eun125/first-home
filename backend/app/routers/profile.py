from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserProfile
from ..schemas import ProfileIn, WeightsIn
from ..security import get_current_user
from ..services.context import get_profile, get_weights, save_weights
from ..services.scoring import CATEGORIES, DEALBREAKERS, weights_from_answers

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _profile_dict(p: UserProfile | None) -> dict | None:
    if not p:
        return None
    return {
        "answers": p.answers or {},
        "top_priorities": p.top_priorities or [],
        "monthly_budget": p.monthly_budget,
        "deposit_budget": p.deposit_budget,
        "destination_label": p.destination_label,
        "max_walk_minutes": p.max_walk_minutes,
        "dealbreakers": p.dealbreakers or [],
        "onboarding_done": p.onboarding_done,
    }


@router.get("")
def read_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        "profile": _profile_dict(get_profile(db, user)),
        "weights": get_weights(db, user),
        "categories": CATEGORIES,
        "dealbreaker_options": DEALBREAKERS,
    }


@router.put("")
def upsert_profile(body: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_profile(db, user)
    if not p:
        p = UserProfile(user_id=user.id)
        db.add(p)
    p.answers = body.answers
    p.top_priorities = [c for c in body.top_priorities if c in CATEGORIES][:2]
    p.monthly_budget = body.monthly_budget
    p.deposit_budget = body.deposit_budget
    p.destination_label = body.destination_label
    p.max_walk_minutes = body.max_walk_minutes
    p.dealbreakers = [d for d in body.dealbreakers if d in DEALBREAKERS]
    p.onboarding_done = True
    weights = body.weights or weights_from_answers(body.answers, p.top_priorities)
    saved = save_weights(db, user, weights)
    db.commit()
    return {"profile": _profile_dict(p), "weights": saved}


@router.post("/suggest-weights")
def suggest_weights(body: ProfileIn, user: User = Depends(get_current_user)):
    """온보딩 답변으로 추천 가중치를 미리 계산(저장하지 않음)."""
    return {"weights": weights_from_answers(body.answers, body.top_priorities)}


@router.put("/weights")
def update_weights(body: WeightsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    saved = save_weights(db, user, body.weights)
    db.commit()
    return {"weights": saved}
