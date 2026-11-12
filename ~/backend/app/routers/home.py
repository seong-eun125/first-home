"""최종 선택(이 집으로 결정)과 결정 이후 안내(P1)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Home, HomeCost, HomeItem, HomeTask, Listing, User
from ..schemas import CostIn, CostUpdate, DecideIn, HomeUpdate, ItemIn, ItemUpdate, TaskIn, TaskUpdate
from ..security import get_current_user
from ..services.context import get_owned_listing, get_profile
from ..services.home_templates import ITEM_GROUPS, PHASES, build_items, build_tasks, default_costs, settle_tips

router = APIRouter(prefix="/api", tags=["home"])


def _get_home(db: Session, user: User) -> Home | None:
    return db.scalar(
        select(Home)
        .where(Home.user_id == user.id)
        .options(
            selectinload(Home.tasks),
            selectinload(Home.costs),
            selectinload(Home.items),
            selectinload(Home.listing).selectinload(Listing.checks),
        )
        .execution_options(populate_existing=True)  # 방금 바뀐 할 일·비용을 항상 새로 읽음
    )


def _home_out(db: Session, user: User, home: Home) -> dict:
    listing = home.listing
    checks = {c.item_id: c.value for c in (listing.checks if listing else [])}
    profile = get_profile(db, user)
    initial = [c for c in home.costs if c.kind == "initial"]
    monthly = [c for c in home.costs if c.kind == "monthly"]
    monthly_total = sum(c.amount for c in monthly)

    mismatches = []
    if listing:
        for field, label, rec in (
            ("contract_deposit", "보증금", listing.deposit),
            ("contract_rent", "월세", listing.monthly_rent),
            ("contract_maintenance", "관리비", listing.maintenance_fee),
        ):
            val = getattr(home, field)
            if val is not None and val != rec:
                mismatches.append({"field": field, "label": label, "listing_value": rec, "contract_value": val})

    done = sum(1 for t in home.tasks if t.done)
    return {
        "id": home.id,
        "listing": (
            {
                "id": listing.id,
                "nickname": listing.nickname,
                "address": listing.address,
                "deposit": listing.deposit,
                "monthly_rent": listing.monthly_rent,
                "maintenance_fee": listing.maintenance_fee,
                "options": listing.options or [],
            }
            if listing
            else None
        ),
        "move_in_date": home.move_in_date.isoformat() if home.move_in_date else None,
        "decision_note": home.decision_note,
        "decided_at": home.decided_at.isoformat() if home.decided_at else None,
        "contract": {
            "deposit": home.contract_deposit,
            "rent": home.contract_rent,
            "maintenance": home.contract_maintenance,
            "start": home.contract_start.isoformat() if home.contract_start else None,
            "end": home.contract_end.isoformat() if home.contract_end else None,
            "mismatches": mismatches,
        },
        "phases": PHASES,
        "tasks": [
            {
                "id": t.id,
                "phase": t.phase,
                "title": t.title,
                "detail": t.detail,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "done": t.done,
                "source": t.source,
            }
            for t in home.tasks
        ],
        "progress": {"done": done, "total": len(home.tasks)},
        "costs": [
            {"id": c.id, "kind": c.kind, "label": c.label, "amount": c.amount, "source": c.source, "refundable": c.refundable}
            for c in home.costs
        ],
        "cost_summary": {
            "initial_total": sum(c.amount for c in initial),
            "initial_non_refundable": sum(c.amount for c in initial if not c.refundable),
            "monthly_total": monthly_total,
            "monthly_budget": profile.monthly_budget if profile else None,
        },
        "settle_tips": settle_tips(checks),
        "item_groups": ITEM_GROUPS,
        "items": [
            {
                "id": i.id,
                "code": i.code,
                "group": i.group,
                "name": i.name,
                "reason": i.reason,
                "priority": i.priority,
                "status": i.status,
                "source": i.source,
            }
            for i in home.items
        ],
    }


def _add_items(db: Session, user: User, home: Home) -> None:
    profile = get_profile(db, user)
    listing = home.listing
    checks = {c.item_id: c.value for c in (listing.checks if listing else [])}
    for it in build_items(listing.options or [] if listing else [], checks, (profile.answers if profile else {}) or {}):
        db.add(HomeItem(home_id=home.id, source="rule", **it))


@router.post("/listings/{listing_id}/decide", status_code=201)
def decide(listing_id: int, body: DecideIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    listing = get_owned_listing(db, user, listing_id)
    old = _get_home(db, user)
    if old:
        if old.listing and old.listing.status == "selected":
            old.listing.status = "candidate"
        db.delete(old)
        db.flush()
    listing.status = "selected"
    home = Home(
        user_id=user.id,
        listing_id=listing.id,
        move_in_date=body.move_in_date or listing.move_in_available,
        decision_note=body.decision_note,
    )
    db.add(home)
    db.flush()
    for t in build_tasks(home.move_in_date, listing.options or []):
        db.add(HomeTask(home_id=home.id, source="template", **t))
    for c in default_costs(listing):
        db.add(HomeCost(home_id=home.id, **c))
    db.flush()
    _add_items(db, user, _get_home(db, user))
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.get("/home")
def get_home(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    home = _get_home(db, user)
    if home and not home.items:  # 필수템 기능 추가 전에 결정한 집도 추천을 받도록
        _add_items(db, user, home)
        db.commit()
        home = _get_home(db, user)
    return _home_out(db, user, home) if home else None


@router.get("/guide/essentials")
def essentials_guide(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """아직 집을 결정하지 않은 사용자를 위한 일반 필수템 목록(생활 패턴만 반영)."""
    profile = get_profile(db, user)
    return {"groups": ITEM_GROUPS, "items": build_items([], {}, (profile.answers if profile else {}) or {})}


def _own_item(db: Session, user: User, item_id: int) -> HomeItem:
    item = db.get(HomeItem, item_id)
    home = _get_home(db, user)
    if not item or not home or item.home_id != home.id:
        raise HTTPException(404, "필수템 항목을 찾을 수 없습니다.")
    return item


@router.post("/home/items", status_code=201)
def add_item(body: ItemIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    home = _get_home(db, user)
    if not home:
        raise HTTPException(404, "아직 최종 선택한 집이 없습니다.")
    db.add(HomeItem(home_id=home.id, source="user", sort_order=1000 + len(home.items), **body.model_dump()))
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.patch("/home/items/{item_id}")
def update_item(item_id: int, body: ItemUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = _own_item(db, user, item_id)
    item.status = body.status
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.delete("/home/items/{item_id}")
def delete_item(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = _own_item(db, user, item_id)
    db.delete(item)
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.patch("/home")
def update_home(body: HomeUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    home = _get_home(db, user)
    if not home:
        raise HTTPException(404, "아직 최종 선택한 집이 없습니다.")
    data = body.model_dump(exclude_unset=True)
    old_move_in = home.move_in_date
    for k, v in data.items():
        setattr(home, k, v)
    # 입주일이 바뀌면 템플릿 할 일의 날짜를 다시 계산
    if "move_in_date" in data and data["move_in_date"] != old_move_in and home.listing:
        tmpl = {t["title"]: t["due_date"] for t in build_tasks(home.move_in_date, home.listing.options or [])}
        for t in home.tasks:
            if t.source == "template" and t.title in tmpl:
                t.due_date = tmpl[t.title]
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.delete("/home", status_code=204)
def undo_decision(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    home = _get_home(db, user)
    if not home:
        return
    if home.listing and home.listing.status == "selected":
        home.listing.status = "candidate"
    db.delete(home)
    db.commit()


def _own_task(db: Session, user: User, task_id: int) -> HomeTask:
    task = db.get(HomeTask, task_id)
    home = _get_home(db, user)
    if not task or not home or task.home_id != home.id:
        raise HTTPException(404, "할 일을 찾을 수 없습니다.")
    return task


@router.post("/home/tasks", status_code=201)
def add_task(body: TaskIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    home = _get_home(db, user)
    if not home:
        raise HTTPException(404, "아직 최종 선택한 집이 없습니다.")
    db.add(HomeTask(home_id=home.id, source="user", sort_order=1000 + len(home.tasks), **body.model_dump()))
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.patch("/home/tasks/{task_id}")
def update_task(task_id: int, body: TaskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _own_task(db, user, task_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(task, k, v)
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.delete("/home/tasks/{task_id}")
def delete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _own_task(db, user, task_id)
    db.delete(task)
    db.commit()
    return _home_out(db, user, _get_home(db, user))


def _own_cost(db: Session, user: User, cost_id: int) -> HomeCost:
    cost = db.get(HomeCost, cost_id)
    home = _get_home(db, user)
    if not cost or not home or cost.home_id != home.id:
        raise HTTPException(404, "비용 항목을 찾을 수 없습니다.")
    return cost


@router.post("/home/costs", status_code=201)
def add_cost(body: CostIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    home = _get_home(db, user)
    if not home:
        raise HTTPException(404, "아직 최종 선택한 집이 없습니다.")
    db.add(HomeCost(home_id=home.id, source="user", **body.model_dump()))
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.patch("/home/costs/{cost_id}")
def update_cost(cost_id: int, body: CostUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cost = _own_cost(db, user, cost_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cost, k, v)
    db.commit()
    return _home_out(db, user, _get_home(db, user))


@router.delete("/home/costs/{cost_id}")
def delete_cost(cost_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cost = _own_cost(db, user, cost_id)
    db.delete(cost)
    db.commit()
    return _home_out(db, user, _get_home(db, user))
