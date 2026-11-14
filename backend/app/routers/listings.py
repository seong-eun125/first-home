import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import ChecklistItem, Listing, ListingCheck, ListingVisit, Photo, User
from ..schemas import (
    ChecklistItemOut,
    ChecksBulkIn,
    ListingCreate,
    ListingDetailOut,
    ListingOut,
    ListingUpdate,
    PhotoOut,
    VisitIn,
    VisitOut,
)
from ..security import get_current_user
from ..services.context import (
    get_owned_listing,
    get_profile,
    get_weights,
    list_owned_listings,
    load_items,
)
from ..services.scoring import compute_listing_score

router = APIRouter(prefix="/api", tags=["listings"])
settings = get_settings()


def _normalize(s: str | None) -> str:
    return "".join((s or "").split()).lower()


# ---------------------------------------------------------------- 체크 항목 마스터
@router.get("/checklist-items", response_model=list[ChecklistItemOut])
def checklist_items(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(
        select(ChecklistItem).where(ChecklistItem.is_active.is_(True)).order_by(ChecklistItem.sort_order)
    ).all()


# ---------------------------------------------------------------- 매물 CRUD
@router.get("/listings")
def list_listings(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    listings = list_owned_listings(db, user)
    items = load_items(db)
    weights = get_weights(db, user)
    profile = get_profile(db, user)
    out = []
    for l in listings:
        s = compute_listing_score(l, items, weights, profile)
        cover = next((p for p in l.photos), None)
        out.append(
            {
                **ListingOut.model_validate(l).model_dump(mode="json"),
                "fit": s["fit"],
                "fit_provisional": s["fit_provisional"],
                "coverage": s["coverage"],
                "dealbreaker_violations": s["dealbreaker_violations"],
                "unverified_count": len(s["unverified"]),
                "visit_count": len(l.visits),
                "cover_photo_id": cover.id if cover else None,
            }
        )
    return out


@router.post("/listings/duplicate-check")
def duplicate_check(body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """같은 주소 또는 같은 건물명으로 이미 등록한 매물이 있는지 확인(블로그 반영: 같은 집 다시 보지 않기)."""
    addr = _normalize(body.get("address"))
    bname = _normalize(body.get("building_name"))
    exclude = body.get("exclude_id")
    matches = []
    for l in db.scalars(select(Listing).where(Listing.user_id == user.id)).all():
        if exclude and l.id == exclude:
            continue
        if (addr and _normalize(l.address) == addr) or (bname and _normalize(l.building_name) == bname):
            matches.append({"id": l.id, "nickname": l.nickname, "address": l.address, "building_name": l.building_name})
    return {"duplicates": matches}


@router.post("/listings", response_model=ListingOut, status_code=201)
def create_listing(body: ListingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    listing = Listing(user_id=user.id, **body.model_dump())
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


@router.get("/listings/{listing_id}", response_model=ListingDetailOut)
def get_listing(listing_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_listing(db, user, listing_id)


@router.patch("/listings/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int, body: ListingUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    listing = get_owned_listing(db, user, listing_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("status") == "selected":
        raise HTTPException(400, "최종 선택은 '이 집으로 결정' 기능을 사용해 주세요.")
    for k, v in data.items():
        setattr(listing, k, v)
    db.commit()
    db.refresh(listing)
    return listing


@router.delete("/listings/{listing_id}", status_code=204)
def delete_listing(listing_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    listing = get_owned_listing(db, user, listing_id)
    files = [p.file_name for p in listing.photos]
    db.delete(listing)
    db.commit()
    for f in files:  # DB 삭제 후 실제 사진 파일도 삭제
        (Path(settings.upload_dir) / f).unlink(missing_ok=True)


# ---------------------------------------------------------------- 점수(단건)
@router.get("/listings/{listing_id}/score")
def listing_score(listing_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    listing = get_owned_listing(db, user, listing_id)
    return compute_listing_score(listing, load_items(db), get_weights(db, user), get_profile(db, user))


# ---------------------------------------------------------------- 방문 기록
@router.post("/listings/{listing_id}/visits", response_model=VisitOut, status_code=201)
def add_visit(listing_id: int, body: VisitIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    listing = get_owned_listing(db, user, listing_id)
    visit = ListingVisit(listing_id=listing.id, **body.model_dump())
    visit.visited_at = visit.visited_at.replace(tzinfo=None)
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


@router.delete("/listings/{listing_id}/visits/{visit_id}", status_code=204)
def delete_visit(listing_id: int, visit_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    listing = get_owned_listing(db, user, listing_id)
    visit = next((v for v in listing.visits if v.id == visit_id), None)
    if not visit:
        raise HTTPException(404, "방문 기록을 찾을 수 없습니다.")
    db.delete(visit)
    db.commit()


# ---------------------------------------------------------------- 체크 저장
@router.put("/listings/{listing_id}/checks")
def save_checks(
    listing_id: int, body: ChecksBulkIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    listing = get_owned_listing(db, user, listing_id)
    items = {i.id: i for i in db.scalars(select(ChecklistItem)).all()}
    visit_ids = {v.id for v in listing.visits}
    existing = {c.item_id: c for c in listing.checks}

    for c in body.checks:
        item = items.get(c.item_id)
        if not item:
            raise HTTPException(400, f"알 수 없는 체크 항목입니다: {c.item_id}")
        _validate_value(item, c.value)
        if c.visit_id is not None and c.visit_id not in visit_ids:
            raise HTTPException(400, "이 매물의 방문 기록이 아닙니다.")
        row = existing.get(c.item_id)
        if c.value == "" and row:  # 빈 값 = 기록 삭제
            db.delete(row)
            continue
        if c.value == "":
            continue
        if row:
            row.value, row.note, row.visit_id = c.value, c.note, c.visit_id
        else:
            db.add(ListingCheck(listing_id=listing.id, item_id=c.item_id, value=c.value, note=c.note, visit_id=c.visit_id))
    db.commit()
    db.refresh(listing)
    listing = get_owned_listing(db, user, listing_id)
    return {
        "checks": [
            {"item_id": c.item_id, "value": c.value, "note": c.note, "visit_id": c.visit_id} for c in listing.checks
        ],
        "score": compute_listing_score(listing, load_items(db), get_weights(db, user), get_profile(db, user)),
    }


def _validate_value(item: ChecklistItem, value: str) -> None:
    if value in ("", "unknown"):
        return
    ok = True
    if item.input_type == "status":
        ok = value in ("good", "normal", "bad")
    elif item.input_type == "yesno":
        ok = value in ("yes", "no")
    elif item.input_type == "number":
        ok = value.isdigit() and int(value) <= 999
    elif item.input_type == "choice":
        ok = value in {o["value"] for o in (item.options or [])}
    if not ok:
        raise HTTPException(400, f"'{item.label}' 항목에 올바르지 않은 값입니다: {value}")


# ---------------------------------------------------------------- 사진
ALLOWED_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}


@router.post("/listings/{listing_id}/photos", response_model=PhotoOut, status_code=201)
async def upload_photo(
    listing_id: int,
    file: UploadFile = File(...),
    item_id: str | None = Form(default=None),
    caption: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = get_owned_listing(db, user, listing_id)
    if item_id and not db.get(ChecklistItem, item_id):
        raise HTTPException(400, "알 수 없는 체크 항목입니다.")
    raw = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(raw) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"사진은 {settings.max_upload_mb}MB 이하만 올릴 수 있습니다.")
    try:
        img = Image.open(io.BytesIO(raw))
        fmt = img.format
        img = ImageOps.exif_transpose(img)  # 회전 정보 반영
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "이미지 파일만 올릴 수 있습니다 (JPG, PNG, WEBP).")
    if fmt not in ALLOWED_FORMATS:
        raise HTTPException(400, "JPG, PNG, WEBP 형식만 지원합니다.")

    # 위치정보(EXIF GPS 등) 메타데이터를 남기지 않도록 픽셀만 다시 저장
    img.thumbnail((1600, 1600))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    clean = Image.frombytes(img.mode, img.size, img.tobytes())  # 픽셀만 복사 → 메타데이터 없음
    if clean.mode == "RGBA":  # 투명 배경은 흰색으로 채워 JPEG로 (용량 절약)
        bg = Image.new("RGB", clean.size, (255, 255, 255))
        bg.paste(clean, mask=clean.split()[3])
        clean = bg
    buf = io.BytesIO()
    clean.save(buf, "JPEG", quality=82, optimize=True)
    name = f"{uuid.uuid4().hex}.jpg"
    photo = Photo(
        listing_id=listing.id,
        item_id=item_id or None,
        file_name=name,
        data=buf.getvalue(),
        original_name=(file.filename or "")[:255],
        caption=(caption or None),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.get("/photos/{photo_id}/file")
def photo_file(photo_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(404, "사진을 찾을 수 없습니다.")
    get_owned_listing(db, user, photo.listing_id)  # 소유자 확인
    headers = {"Cache-Control": "private, max-age=86400"}
    if photo.data:
        return Response(content=photo.data, media_type="image/jpeg", headers=headers)
    path = Path(settings.upload_dir) / photo.file_name  # 예전 방식(디스크)으로 저장된 사진
    if not path.exists():
        raise HTTPException(404, "사진 파일이 없습니다.")
    return FileResponse(path, headers=headers)


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(404, "사진을 찾을 수 없습니다.")
    get_owned_listing(db, user, photo.listing_id)
    name = photo.file_name
    db.delete(photo)
    db.commit()
    (Path(settings.upload_dir) / name).unlink(missing_ok=True)
