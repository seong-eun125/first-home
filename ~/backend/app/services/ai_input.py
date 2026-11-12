"""AI에 보낼 입력을 만드는 곳.

원칙
- 점수는 백엔드가 계산한 값을 그대로 전달합니다. AI는 점수를 바꾸지 않습니다.
- 실제 기록(체크 결과, 방문 시각, 매물 정보)만 보냅니다. 사진은 보내지 않습니다.
- 메모는 항목당 최대 N자로 잘라 입력 토큰을 줄입니다.
- 개인 식별 정보(이름, 이메일, 상세 주소)는 보내지 않습니다.
"""
from __future__ import annotations

from ..config import get_settings
from .scoring import CATEGORIES, DEALBREAKERS, FLOOR_TYPES, ItemInfo

settings = get_settings()

VALUE_LABELS = {
    "good": "양호",
    "normal": "보통",
    "bad": "불량",
    "unknown": "확인 못함",
    "yes": "있음",
    "no": "없음",
}

ANSWER_LABELS = {
    "noise_sensitivity": {"low": "소리에 둔감", "mid": "보통", "high": "잠귀가 예민함"},
    "bug_sensitivity": {"low": "벌레에 둔감", "mid": "보통", "high": "벌레에 매우 민감"},
    "return_time": {"early": "일찍 귀가", "normal": "보통", "late": "늦은 귀가가 잦음"},
    "cooking": {"rarely": "요리 거의 안 함", "sometimes": "가끔 요리", "often": "자주 요리"},
    "cost_sensitivity": {"low": "비용보다 조건 우선", "mid": "보통", "high": "비용이 가장 중요"},
}


def _cut(text: str | None) -> str | None:
    if not text:
        return None
    t = " ".join(text.split())
    n = settings.ai_note_max_chars
    return t if len(t) <= n else t[:n] + "…"


def value_label(item: ItemInfo | None, value: str, options: list | None = None) -> str:
    if options:
        for o in options:
            if o.get("value") == value:
                return o.get("label", value)
    return VALUE_LABELS.get(value, value)


def user_context(profile, weights: dict[str, int]) -> dict:
    answers = (profile.answers if profile else {}) or {}
    lifestyle = []
    for key, labels in ANSWER_LABELS.items():
        if answers.get(key) in labels:
            lifestyle.append(labels[answers[key]])
    if answers.get("work_from_home"):
        lifestyle.append("재택 근무·공부가 잦음")
    return {
        "top_priorities": [CATEGORIES.get(c, c) for c in ((profile.top_priorities if profile else []) or [])],
        "lifestyle": lifestyle,
        "monthly_budget_won": profile.monthly_budget if profile else None,
        "deposit_budget_won": profile.deposit_budget if profile else None,
        "max_walk_minutes": profile.max_walk_minutes if profile else None,
        "dealbreakers": [DEALBREAKERS.get(d, d) for d in ((profile.dealbreakers if profile else []) or [])],
        "weights": {CATEGORIES[c]: w for c, w in weights.items() if c in CATEGORIES},
    }


def listing_context(listing, items: dict[str, ItemInfo], options_map: dict[str, list | None], score: dict) -> dict:
    visits = {v.id: v for v in listing.visits}
    checks = []
    for c in sorted(listing.checks, key=lambda c: c.item_id):
        item = items.get(c.item_id)
        if not item:
            continue
        visit = visits.get(c.visit_id) if c.visit_id else None
        checks.append(
            {
                "item_id": c.item_id,
                "label": item.label,
                "category": CATEGORIES.get(item.category, item.category),
                "value": value_label(item, c.value, options_map.get(c.item_id)),
                "note": _cut(c.note),
                "observed_at": visit.visited_at.strftime("%m-%d %H:%M") if visit else None,
            }
        )
    return {
        "listing_id": listing.id,
        "nickname": listing.nickname,
        "deposit_won": listing.deposit,
        "monthly_rent_won": listing.monthly_rent,
        "maintenance_fee_won": listing.maintenance_fee,
        "monthly_total_won": score["monthly_total"],
        "floor": listing.floor,
        "total_floors": listing.total_floors,
        "floor_type": FLOOR_TYPES.get(listing.floor_type, listing.floor_type),
        "area_m2": listing.area_m2,
        "walk_minutes": listing.walk_minutes,
        "options": listing.options or [],
        "fee_includes": listing.fee_includes or [],
        "visits": [
            {"at": v.visited_at.strftime("%m-%d %H:%M"), "occupancy": "거주 중" if v.occupancy == "occupied" else "빈집"}
            for v in listing.visits
        ],
        "checks": checks,
        "unverified_review_memo": _cut(listing.review_memo),
        "computed_by_backend": {
            "fit_score": score["fit"],
            "coverage": score["coverage"],
            "category_scores": {v["label"]: v["score"] for v in score["category_scores"].values()},
            "dealbreaker_violations": [v["label"] for v in score["dealbreaker_violations"]],
            "unverified_items": [{"item_id": u["item_id"], "label": u["label"]} for u in score["unverified"]],
            "hints": [h["text"] for h in score["hints"]],
        },
        "valid_evidence_ids": sorted(score["evidence"].keys()),
    }
