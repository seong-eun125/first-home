"""DB 테이블 정의 (SQLAlchemy 2.0).

관계 요약
  users 1─1 user_profiles          생활 패턴·예산·절대 조건
  users 1─N priority_weights       카테고리별 가중치(1~5)
  users 1─N listings               매물
    listings 1─N listing_visits    방문 기록(시각, 빈집/거주 중)
    listings 1─N listing_checks    체크 결과 (checklist_items 참조, 방문 기록 참조 가능)
    listings 1─N photos            사진(체크 항목에 연결 가능)
  users 1─N comparisons            비교 실행 기록(가중치 스냅샷 + 결과)
  users 1─N ai_reports             AI 리포트(입력 해시로 캐시)
  users 1─N ai_usage_logs          AI 호출 기록(비용·한도 관리)
  users 1─1 homes                  최종 선택한 집(결정 이후 단계의 중심)
    homes 1─N home_tasks           계약·이사·입주 준비 할 일
    homes 1─N home_costs           초기 비용·월 고정비
    homes 1─N home_items           자취 필수템 (내 집 맞춤 추천 + 구매 체크)
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(50))

    profile: Mapped[UserProfile | None] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    weights: Mapped[list[PriorityWeight]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    listings: Mapped[list[Listing]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserProfile(TimestampMixin, Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    # 온보딩 원본 답변 (질문이 늘어나도 컬럼 추가 없이 저장)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    top_priorities: Mapped[list] = mapped_column(JSON, default=list)  # 가장 중요한 조건 1~2개
    monthly_budget: Mapped[int | None] = mapped_column(Integer)  # 월 고정비 상한(원)
    deposit_budget: Mapped[int | None] = mapped_column(Integer)  # 보증금 상한(원)
    destination_label: Mapped[str | None] = mapped_column(String(100))  # 학교·회사
    max_walk_minutes: Mapped[int | None] = mapped_column(Integer)
    dealbreakers: Mapped[list] = mapped_column(JSON, default=list)
    onboarding_done: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="profile")


class PriorityWeight(Base):
    __tablename__ = "priority_weights"
    __table_args__ = (UniqueConstraint("user_id", "category", name="uq_weight_user_cat"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(30))
    weight: Mapped[int] = mapped_column(Integer, default=3)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="weights")


class ChecklistItem(Base):
    """체크 항목 마스터. 코드가 아닌 데이터로 관리해 항목 추가가 쉽습니다."""

    __tablename__ = "checklist_items"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # 예: road_noise
    category: Mapped[str] = mapped_column(String(30), index=True)
    label: Mapped[str] = mapped_column(String(100))
    item_type: Mapped[str] = mapped_column(String(20))  # fact | observe | measure
    input_type: Mapped[str] = mapped_column(String(20))  # status | yesno | number | choice
    options: Mapped[list | None] = mapped_column(JSON)  # choice 선택지
    score_map: Mapped[dict | None] = mapped_column(JSON)  # 값 → 점수(0~1), 없으면 점수 미반영
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    zone: Mapped[str] = mapped_column(String(30))  # 동선: outside | common | room | bath | kitchen
    guide_text: Mapped[str] = mapped_column(Text)  # 어떻게 확인하나요?
    caution_text: Mapped[str | None] = mapped_column(Text)  # 단정하면 안 되는 점
    time_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)  # 방문 시간대 영향
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Listing(TimestampMixin, Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    nickname: Mapped[str] = mapped_column(String(50))
    building_name: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(255))
    deposit: Mapped[int] = mapped_column(Integer, default=0)  # 원
    monthly_rent: Mapped[int] = mapped_column(Integer, default=0)
    maintenance_fee: Mapped[int] = mapped_column(Integer, default=0)
    fee_includes: Mapped[list] = mapped_column(JSON, default=list)
    floor: Mapped[int | None] = mapped_column(Integer)
    total_floors: Mapped[int | None] = mapped_column(Integer)
    floor_type: Mapped[str] = mapped_column(String(20), default="normal")
    area_m2: Mapped[float | None] = mapped_column(Float)
    walk_minutes: Mapped[int | None] = mapped_column(Integer)  # 실제 걸어 본 시간
    move_in_available: Mapped[date | None] = mapped_column(Date)
    contract_months: Mapped[int | None] = mapped_column(Integer)
    options: Mapped[list] = mapped_column(JSON, default=list)  # 옵션 가구
    source_link: Mapped[str | None] = mapped_column(String(500))
    agency_memo: Mapped[str | None] = mapped_column(Text)  # 중개사무소 개인 메모
    review_memo: Mapped[str | None] = mapped_column(Text)  # 검증되지 않은 거주 후기 메모
    first_impression: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="candidate")
    # candidate | hold | rejected | missed | selected
    # 실거래가 비교용: 시군구 코드(법정동코드 앞 5자리)와 주택 유형
    lawd_cd: Mapped[str | None] = mapped_column(String(5))
    house_type: Mapped[str | None] = mapped_column(String(10))  # offi | rh | sh

    user: Mapped[User] = relationship(back_populates="listings")
    visits: Mapped[list[ListingVisit]] = relationship(
        back_populates="listing", cascade="all, delete-orphan", order_by="ListingVisit.visited_at"
    )
    checks: Mapped[list[ListingCheck]] = relationship(
        back_populates="listing", cascade="all, delete-orphan"
    )
    photos: Mapped[list[Photo]] = relationship(
        back_populates="listing", cascade="all, delete-orphan"
    )


class ListingVisit(Base):
    __tablename__ = "listing_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    visited_at: Mapped[datetime] = mapped_column(DateTime)
    occupancy: Mapped[str] = mapped_column(String(20), default="empty")  # empty | occupied
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    listing: Mapped[Listing] = relationship(back_populates="visits")


class ListingCheck(Base):
    __tablename__ = "listing_checks"
    __table_args__ = (UniqueConstraint("listing_id", "item_id", name="uq_check_listing_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[str] = mapped_column(ForeignKey("checklist_items.id"))
    visit_id: Mapped[int | None] = mapped_column(
        ForeignKey("listing_visits.id", ondelete="SET NULL")
    )
    # status: good|normal|bad|unknown, yesno: yes|no|unknown, number: "3", choice: 옵션값
    value: Mapped[str] = mapped_column(String(50))
    note: Mapped[str | None] = mapped_column(Text)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    listing: Mapped[Listing] = relationship(back_populates="checks")
    item: Mapped[ChecklistItem] = relationship()
    visit: Mapped[ListingVisit | None] = relationship()


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    item_id: Mapped[str | None] = mapped_column(ForeignKey("checklist_items.id"))
    file_name: Mapped[str] = mapped_column(String(255))  # 서버 저장 파일명(무작위)
    original_name: Mapped[str | None] = mapped_column(String(255))
    caption: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    listing: Mapped[Listing] = relationship(back_populates="photos")


class Comparison(Base):
    __tablename__ = "comparisons"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    listing_ids: Mapped[list] = mapped_column(JSON)
    weights_snapshot: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)  # 점수·순위 계산 결과
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AIReport(Base):
    __tablename__ = "ai_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))  # listing | compare
    listing_id: Mapped[int | None] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    comparison_id: Mapped[int | None] = mapped_column(
        ForeignKey("comparisons.id", ondelete="CASCADE")
    )
    input_hash: Mapped[str] = mapped_column(String(64), index=True)
    mode: Mapped[str] = mapped_column(String(20))  # openai | mock | fallback
    model: Mapped[str | None] = mapped_column(String(100))
    output: Mapped[dict] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))
    mode: Mapped[str] = mapped_column(String(20))
    model: Mapped[str | None] = mapped_column(String(100))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    cached: Mapped[bool] = mapped_column(Boolean, default=False)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


class Home(TimestampMixin, Base):
    """최종 선택한 집. 결정 이후 단계(계약·입주 준비·정착)의 중심 데이터."""

    __tablename__ = "homes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    listing_id: Mapped[int | None] = mapped_column(
        ForeignKey("listings.id", ondelete="SET NULL")
    )
    move_in_date: Mapped[date | None] = mapped_column(Date)
    decision_note: Mapped[str | None] = mapped_column(Text)
    # 계약서에 적힌 값(사용자 입력) — 매물 기록과 대조
    contract_deposit: Mapped[int | None] = mapped_column(Integer)
    contract_rent: Mapped[int | None] = mapped_column(Integer)
    contract_maintenance: Mapped[int | None] = mapped_column(Integer)
    contract_start: Mapped[date | None] = mapped_column(Date)
    contract_end: Mapped[date | None] = mapped_column(Date)
    decided_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    listing: Mapped[Listing | None] = relationship()
    tasks: Mapped[list[HomeTask]] = relationship(
        back_populates="home", cascade="all, delete-orphan", order_by="HomeTask.sort_order"
    )
    costs: Mapped[list[HomeCost]] = relationship(
        back_populates="home", cascade="all, delete-orphan", order_by="HomeCost.id"
    )
    items: Mapped[list[HomeItem]] = relationship(
        back_populates="home", cascade="all, delete-orphan", order_by="HomeItem.sort_order"
    )


class HomeTask(Base):
    __tablename__ = "home_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id", ondelete="CASCADE"), index=True)
    phase: Mapped[str] = mapped_column(String(20))  # contract | moving | movein | settle
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(20), default="template")  # template | user
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    home: Mapped[Home] = relationship(back_populates="tasks")


class HomeCost(Base):
    __tablename__ = "home_costs"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # initial | monthly
    label: Mapped[str] = mapped_column(String(100))
    amount: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(20), default="user")  # listing | user
    refundable: Mapped[bool] = mapped_column(Boolean, default=False)  # 보증금처럼 돌려받는 돈

    home: Mapped[Home] = relationship(back_populates="costs")


class HomeItem(Base):
    """자취 필수템. 결정한 집의 옵션·체크 기록·생활 패턴으로 규칙 기반 추천."""

    __tablename__ = "home_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id", ondelete="CASCADE"), index=True)
    code: Mapped[str | None] = mapped_column(String(50))  # 추천 카탈로그 코드 (직접 추가는 None)
    group: Mapped[str] = mapped_column(String(20))  # day1 | week1 | safety | nice
    name: Mapped[str] = mapped_column(String(100))
    reason: Mapped[str | None] = mapped_column(Text)  # 왜 추천했는지 (내 기록 근거)
    priority: Mapped[str] = mapped_column(String(10), default="normal")  # high | normal
    status: Mapped[str] = mapped_column(String(20), default="todo")  # todo | have | bought | skip
    source: Mapped[str] = mapped_column(String(20), default="rule")  # rule | user
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    home: Mapped[Home] = relationship(back_populates="items")


class MarketCache(Base):
    """국토교통부 실거래가 API 응답 캐시 (같은 지역·월은 다시 호출하지 않음)."""

    __tablename__ = "market_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    cache_key: Mapped[str] = mapped_column(String(40), unique=True)  # 예) offi:11530:202610
    payload: Mapped[list] = mapped_column(JSON)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SurveyResponse(Base):
    """서비스 만족도 설문 (1인 1응답, 다시 제출하면 수정)."""

    __tablename__ = "survey_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    segment: Mapped[str | None] = mapped_column(String(20))  # preparing | living | interested | other
    scores: Mapped[dict] = mapped_column(JSON)  # {"q1": 1~5, ..., "q10": 1~5}
    good_text: Mapped[str | None] = mapped_column(Text)
    improve_text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
