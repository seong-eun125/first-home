"""API 입력·출력 형식(Pydantic). 잘못된 입력은 FastAPI가 자동으로 422 오류로 돌려보냅니다."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

FloorType = Literal["normal", "first", "semi_basement", "rooftop"]
ListingStatus = Literal["candidate", "hold", "rejected", "missed", "selected"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- 인증
class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=50)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    email: str
    name: str
    is_admin: bool = False  # 관리자 메뉴(운영 현황·설문 결과) 노출 여부


# ---------------------------------------------------------------- 프로필·가중치
class ProfileIn(BaseModel):
    answers: dict = Field(default_factory=dict)
    top_priorities: list[str] = Field(default_factory=list, max_length=2)
    monthly_budget: int | None = Field(default=None, ge=0, le=100_000_000)
    deposit_budget: int | None = Field(default=None, ge=0, le=10_000_000_000)
    destination_label: str | None = Field(default=None, max_length=100)
    max_walk_minutes: int | None = Field(default=None, ge=1, le=180)
    dealbreakers: list[str] = Field(default_factory=list)
    weights: dict[str, int] | None = None  # 직접 조정한 가중치(없으면 답변으로 자동 계산)


class ProfileOut(ORM):
    answers: dict
    top_priorities: list
    monthly_budget: int | None
    deposit_budget: int | None
    destination_label: str | None
    max_walk_minutes: int | None
    dealbreakers: list
    onboarding_done: bool


class WeightsIn(BaseModel):
    weights: dict[str, int]

    @field_validator("weights")
    @classmethod
    def check_range(cls, v: dict[str, int]) -> dict[str, int]:
        for k, w in v.items():
            if not 1 <= w <= 5:
                raise ValueError(f"{k} 가중치는 1~5 사이여야 합니다.")
        return v


# ---------------------------------------------------------------- 체크 항목
class ChecklistItemOut(ORM):
    id: str
    category: str
    label: str
    item_type: str
    input_type: str
    options: list | None
    is_required: bool
    zone: str
    guide_text: str
    caution_text: str | None
    time_sensitive: bool
    sort_order: int


# ---------------------------------------------------------------- 매물
class ListingBase(BaseModel):
    nickname: str = Field(min_length=1, max_length=50)
    building_name: str | None = Field(default=None, max_length=100)
    address: str = Field(min_length=1, max_length=255)
    deposit: int = Field(ge=0, le=10_000_000_000)
    monthly_rent: int = Field(ge=0, le=100_000_000)
    maintenance_fee: int = Field(default=0, ge=0, le=10_000_000)
    fee_includes: list[str] = Field(default_factory=list)
    floor: int | None = Field(default=None, ge=-5, le=200)
    total_floors: int | None = Field(default=None, ge=1, le=200)
    floor_type: FloorType = "normal"
    area_m2: float | None = Field(default=None, ge=0, le=1000)
    walk_minutes: int | None = Field(default=None, ge=0, le=300)
    move_in_available: date | None = None
    contract_months: int | None = Field(default=None, ge=1, le=120)
    options: list[str] = Field(default_factory=list)
    source_link: str | None = Field(default=None, max_length=500)
    agency_memo: str | None = Field(default=None, max_length=2000)
    review_memo: str | None = Field(default=None, max_length=2000)
    first_impression: str | None = Field(default=None, max_length=1000)
    lawd_cd: str | None = Field(default=None, pattern=r"^\d{5}$")
    house_type: Literal["offi", "rh", "sh"] | None = None


class ListingCreate(ListingBase):
    pass


class ListingUpdate(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=50)
    building_name: str | None = None
    address: str | None = Field(default=None, min_length=1, max_length=255)
    deposit: int | None = Field(default=None, ge=0)
    monthly_rent: int | None = Field(default=None, ge=0)
    maintenance_fee: int | None = Field(default=None, ge=0)
    fee_includes: list[str] | None = None
    floor: int | None = None
    total_floors: int | None = None
    floor_type: FloorType | None = None
    area_m2: float | None = None
    walk_minutes: int | None = Field(default=None, ge=0, le=300)
    move_in_available: date | None = None
    contract_months: int | None = None
    options: list[str] | None = None
    source_link: str | None = None
    agency_memo: str | None = None
    review_memo: str | None = None
    first_impression: str | None = None
    status: ListingStatus | None = None
    lawd_cd: str | None = Field(default=None, pattern=r"^\d{5}$")
    house_type: Literal["offi", "rh", "sh"] | None = None


class VisitIn(BaseModel):
    visited_at: datetime
    occupancy: Literal["empty", "occupied"] = "empty"
    note: str | None = Field(default=None, max_length=1000)


class VisitOut(ORM):
    id: int
    visited_at: datetime
    occupancy: str
    note: str | None


class CheckIn(BaseModel):
    item_id: str
    value: str = Field(max_length=50)
    note: str | None = Field(default=None, max_length=1000)
    visit_id: int | None = None


class ChecksBulkIn(BaseModel):
    checks: list[CheckIn]


class CheckOut(ORM):
    item_id: str
    value: str
    note: str | None
    visit_id: int | None
    checked_at: datetime


class PhotoOut(ORM):
    id: int
    item_id: str | None
    file_name: str
    original_name: str | None
    caption: str | None
    created_at: datetime


class ListingOut(ORM):
    id: int
    nickname: str
    building_name: str | None
    address: str
    deposit: int
    monthly_rent: int
    maintenance_fee: int
    fee_includes: list
    floor: int | None
    total_floors: int | None
    floor_type: str
    area_m2: float | None
    walk_minutes: int | None
    move_in_available: date | None
    contract_months: int | None
    options: list
    source_link: str | None
    agency_memo: str | None
    review_memo: str | None
    first_impression: str | None
    status: str
    lawd_cd: str | None = None
    house_type: str | None = None
    created_at: datetime
    updated_at: datetime


class ListingDetailOut(ListingOut):
    visits: list[VisitOut]
    checks: list[CheckOut]
    photos: list[PhotoOut]


# ---------------------------------------------------------------- 점수·비교
class ScorePreviewIn(BaseModel):
    weights: dict[str, int] | None = None
    listing_ids: list[int] | None = None


class ComparisonIn(BaseModel):
    listing_ids: list[int] = Field(min_length=2, max_length=4)
    weights: dict[str, int] | None = None


# ---------------------------------------------------------------- 결정 이후
class DecideIn(BaseModel):
    move_in_date: date | None = None
    decision_note: str | None = Field(default=None, max_length=1000)


class HomeUpdate(BaseModel):
    move_in_date: date | None = None
    contract_deposit: int | None = Field(default=None, ge=0)
    contract_rent: int | None = Field(default=None, ge=0)
    contract_maintenance: int | None = Field(default=None, ge=0)
    contract_start: date | None = None
    contract_end: date | None = None


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    phase: Literal["contract", "moving", "movein", "settle"] = "moving"
    due_date: date | None = None
    detail: str | None = Field(default=None, max_length=1000)


class TaskUpdate(BaseModel):
    done: bool | None = None
    title: str | None = Field(default=None, max_length=200)
    due_date: date | None = None


class CostIn(BaseModel):
    kind: Literal["initial", "monthly"]
    label: str = Field(min_length=1, max_length=100)
    amount: int = Field(ge=0, le=10_000_000_000)


class CostUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=100)
    amount: int | None = Field(default=None, ge=0)


class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    group: Literal["day1", "week1", "safety", "nice"] = "week1"


class ItemUpdate(BaseModel):
    status: Literal["todo", "have", "bought", "skip"]
