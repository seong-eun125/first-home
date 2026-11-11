"""초기 데이터 넣기.

사용법 (backend 폴더에서, 가상환경 활성화 후)
  python -m app.seed               # 체크 항목 마스터만 동기화
  python -m app.seed --demo        # + 시연용 데모 계정/매물 생성(이미 있으면 건너뜀)
  python -m app.seed --reset-demo  # 데모 계정을 지우고 처음 상태로 다시 생성

데모 계정: demo@firsthome.app / demo1234  (모든 데모 데이터는 가상입니다)
"""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import ChecklistItem, Listing, ListingCheck, ListingVisit, User, UserProfile
from .security import hash_password
from .services.context import save_weights
from .services.scoring import weights_from_answers

DATA = Path(__file__).parent / "data"
DEMO_EMAIL = "demo@firsthome.app"
DEMO_PASSWORD = "demo1234"


def sync_checklist(db: Session) -> int:
    rows = json.loads((DATA / "checklist_items.json").read_text(encoding="utf-8"))
    existing = {i.id: i for i in db.scalars(select(ChecklistItem)).all()}
    seen = set()
    for order, r in enumerate(rows):
        seen.add(r["id"])
        item = existing.get(r["id"]) or ChecklistItem(id=r["id"])
        item.category = r["category"]
        item.label = r["label"]
        item.item_type = r["item_type"]
        item.input_type = r["input_type"]
        item.options = r.get("options")
        item.score_map = r.get("score_map")
        item.is_required = r.get("is_required", False)
        item.zone = r.get("zone", "room")
        item.guide_text = r["guide_text"]
        item.caution_text = r.get("caution_text")
        item.time_sensitive = r.get("time_sensitive", False)
        item.sort_order = order
        item.is_active = True
        if r["id"] not in existing:
            db.add(item)
    for item_id, item in existing.items():  # 목록에서 빠진 항목은 비활성화(기록 보존)
        if item_id not in seen:
            item.is_active = False
    db.commit()
    return len(rows)


def _at(days_ago: int, hour: int, minute: int = 0) -> datetime:
    d = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
    return d - timedelta(days=days_ago)


DEMO_LISTINGS = [
    {
        "listing": dict(
            nickname="정문 앞 신축", building_name="하늘채원룸", address="서울 구로구 경인로 100 (가상 주소)",
            deposit=5_000_000, monthly_rent=480_000, maintenance_fee=70_000, fee_includes=["수도", "인터넷"],
            floor=3, total_floors=5, floor_type="normal", area_m2=18.2, walk_minutes=6,
            options=["냉장고", "세탁기", "에어컨", "책상"], first_impression="깔끔하고 밝지만 큰길 소리가 들림",
            agency_memo="A부동산, 설명이 자세했음",
        ),
        "visits": [(_at(3, 14, 10), "empty", "낮 방문")],
        "checks": {
            "road_noise": "bad", "wall_soundproof": "normal", "window_type": "no", "entrance_security": "both",
            "screens_bars": "good", "front_view": "good", "pest_signs": "good", "smoke_signs": "good",
            "leak_mold": "good", "sunlight": "good", "water_pressure": "good", "drainage": "good",
            "boiler": "good", "option_condition": "good", "elevator": "yes", "bath_window": "yes",
            "nearby_shops": "yes", "amenities": "good",
        },
        "notes": {"road_noise": "창문을 열면 버스 소리가 계속 들림", "sunlight": "남향, 오후 2시에 매우 밝음"},
    },
    {
        "listing": dict(
            nickname="역 근처 분리형", building_name="그린빌", address="서울 구로구 고척로 20 (가상 주소)",
            deposit=10_000_000, monthly_rent=450_000, maintenance_fee=80_000, fee_includes=["수도"],
            floor=5, total_floors=7, floor_type="normal", area_m2=21.5, walk_minutes=9,
            options=["냉장고", "세탁기", "에어컨", "옷장"], first_impression="조용하고 베란다가 있음. 세입자 짐이 많았음",
            review_memo="카페 후기에서 '밤에 조용한 편'이라는 글을 봄 (검증 안 됨)",
        ),
        "visits": [(_at(2, 15, 0), "occupied", "세입자 거주 중")],
        "checks": {
            "road_noise": "good", "wall_soundproof": "unknown", "window_type": "yes", "entrance_security": "both",
            "screens_bars": "good", "front_view": "normal", "pest_signs": "good", "smoke_signs": "good",
            "leak_mold": "unknown", "sunlight": "normal", "water_pressure": "good", "drainage": "good",
            "balcony": "yes", "elevator": "yes", "kitchen_separated": "yes", "parcel": "locker",
        },
        "notes": {"wall_soundproof": "세입자가 있어 오래 확인하지 못함", "front_view": "앞 건물과 3m 정도"},
    },
    {
        "listing": dict(
            nickname="골목 안 넓은 방", building_name="행복하우스", address="서울 구로구 오리로 7 (가상 주소)",
            deposit=3_000_000, monthly_rent=380_000, maintenance_fee=50_000, fee_includes=[],
            floor=1, total_floors=4, floor_type="first", area_m2=24.0, walk_minutes=13,
            options=["냉장고", "에어컨"], first_impression="넓고 저렴하지만 1층이라 시선이 신경 쓰임",
        ),
        "visits": [(_at(4, 13, 0), "empty", "낮 방문"), (_at(1, 20, 30), "empty", "저녁 재방문")],
        "checks": {
            "road_noise": "good", "wall_soundproof": "normal", "window_type": "no", "entrance_security": "lock_only",
            "screens_bars": "normal", "front_view": "bad", "pest_signs": "normal", "smoke_signs": "bad",
            "leak_mold": "normal", "sunlight": "bad", "water_pressure": "normal", "drainage": "good",
            "boiler": "good", "option_condition": "normal", "bath_window": "no", "parcel": "none",
        },
        "notes": {"smoke_signs": "건물 입구에 담배꽁초가 많음", "road_noise": "저녁에도 조용했음"},
        "evening_items": ["road_noise", "wall_soundproof"],
    },
]


def create_demo(db: Session, reset: bool = False) -> None:
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user and reset:
        db.delete(user)
        db.commit()
        user = None
    if user:
        print("데모 계정이 이미 있습니다 (--reset-demo로 초기화할 수 있어요).")
        return
    user = User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD), name="김지민")
    db.add(user)
    db.flush()
    answers = {
        "noise_sensitivity": "high", "bug_sensitivity": "mid", "return_time": "late",
        "cooking": "sometimes", "work_from_home": False, "cost_sensitivity": "mid",
    }
    top = ["noise", "convenience"]
    db.add(
        UserProfile(
            user_id=user.id, answers=answers, top_priorities=top, monthly_budget=600_000,
            deposit_budget=10_000_000, destination_label="학교 정문", max_walk_minutes=10,
            dealbreakers=["semi_basement"], onboarding_done=True,
        )
    )
    save_weights(db, user, weights_from_answers(answers, top))

    for spec in DEMO_LISTINGS:
        l = Listing(user_id=user.id, move_in_available=date.today() + timedelta(days=30), contract_months=12, **spec["listing"])
        db.add(l)
        db.flush()
        visits = []
        for at, occ, note in spec["visits"]:
            v = ListingVisit(listing_id=l.id, visited_at=at, occupancy=occ, note=note)
            db.add(v)
            visits.append(v)
        db.flush()
        for item_id, value in spec["checks"].items():
            visit = visits[-1] if item_id in spec.get("evening_items", []) else visits[0]
            db.add(
                ListingCheck(
                    listing_id=l.id, item_id=item_id, value=value,
                    note=spec.get("notes", {}).get(item_id), visit_id=visit.id,
                )
            )
    db.commit()
    print(f"데모 계정 생성 완료: {DEMO_EMAIL} / {DEMO_PASSWORD}")


def main() -> None:
    parser = argparse.ArgumentParser(description="FIRST HOME 초기 데이터")
    parser.add_argument("--demo", action="store_true", help="데모 계정 생성")
    parser.add_argument("--reset-demo", action="store_true", help="데모 계정 초기화 후 다시 생성")
    args = parser.parse_args()
    with SessionLocal() as db:
        n = sync_checklist(db)
        print(f"체크 항목 {n}개 동기화 완료")
        if args.demo or args.reset_demo:
            create_demo(db, reset=args.reset_demo)


if __name__ == "__main__":
    main()
