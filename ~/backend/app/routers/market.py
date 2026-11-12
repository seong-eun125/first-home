"""실거래가 시세 비교 API (국토교통부 전월세 실거래가)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import User
from ..security import get_current_user
from ..services import molit
from ..services.context import get_owned_listing

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/status")
def status(user: User = Depends(get_current_user)):
    s = get_settings()
    return {
        "mode": s.effective_molit_mode,
        "is_sample": s.effective_molit_mode == "mock",
        "months": s.molit_months,
        "house_types": [{"code": k, "label": v["label"]} for k, v in molit.HOUSE_TYPES.items()],
    }


@router.get("/regions")
def regions(user: User = Depends(get_current_user)):
    return molit.regions()


@router.get("/rent")
def rent(
    lawd_cd: str = Query(pattern=r"^\d{5}$"),
    house_type: str = Query(pattern=r"^(offi|rh|sh)$"),
    dong: str | None = Query(default=None, max_length=20),
    listing_id: int | None = None,
    save: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """지역·주택유형의 최근 전월세 실거래가와, (listing_id가 있으면) 내 매물과의 비교."""
    listing = get_owned_listing(db, user, listing_id) if listing_id else None
    if listing and save:  # 다음에 다시 열 때 같은 조건으로 보이도록 매물에 저장
        listing.lawd_cd, listing.house_type = lawd_cd, house_type
        db.commit()
    try:
        report = molit.market_report(
            db,
            lawd_cd=lawd_cd,
            house_type=house_type,
            dong=(dong or "").strip() or None,
            area_m2=listing.area_m2 if listing else None,
            my_deposit_won=listing.deposit if listing else None,
            my_rent_won=listing.monthly_rent if listing else None,
        )
    except molit.MolitError as e:
        raise HTTPException(502, str(e)) from e
    report["suggested_dong"] = molit.guess_dong(listing.address) if listing else None
    return report
