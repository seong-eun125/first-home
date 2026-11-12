"""적합도·확인도 계산 (규칙 기반).

AI는 점수를 정하지 않습니다. 점수는 항상 이 파일의 규칙으로 계산되며,
같은 입력이면 항상 같은 결과가 나옵니다.

- 항목 점수: 상태형 양호 1.0 / 보통 0.5 / 불량 0, 사실형은 항목별 score_map,
  '확인 못함'과 미입력은 계산에서 제외
- 카테고리 점수: 확인된 항목 점수의 평균
- 적합도(fit): 카테고리 점수를 가중치로 평균한 값 × 100
- 확인도(coverage): 필수 항목 중 확인한 항목의 가중치 비율
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

CATEGORIES: dict[str, str] = {
    "noise": "소음",
    "security": "보안·사생활",
    "hygiene": "위생·해충",
    "light": "채광·환기",
    "facility": "설비",
    "space": "구조·공간",
    "convenience": "생활 편의",
    "cost": "비용",
}

STATUS_SCORE = {"good": 1.0, "normal": 0.5, "bad": 0.0}
UNKNOWN_VALUES = {"unknown", ""}

DEALBREAKERS: dict[str, str] = {
    "semi_basement": "반지하 제외",
    "rooftop": "옥탑 제외",
    "need_entrance_lock": "공동현관 도어락 필수",
    "over_budget": "월 고정비 예산 초과 제외",
    "over_deposit": "보증금 예산 초과 제외",
    "over_walk": "최대 도보 시간 초과 제외",
}

FLOOR_TYPES = {"normal": "일반층", "first": "1층", "semi_basement": "반지하", "rooftop": "옥탑"}


# ---------------------------------------------------------------- 가중치 생성
def weights_from_answers(answers: dict, top_priorities: list[str]) -> dict[str, int]:
    """온보딩 답변 → 카테고리 가중치(1~5). 같은 답이면 항상 같은 가중치."""
    w = {c: 3 for c in CATEGORIES}
    level = {"low": 2, "mid": 3, "high": 5}
    w["noise"] = level.get(answers.get("noise_sensitivity", "mid"), 3)
    w["hygiene"] = level.get(answers.get("bug_sensitivity", "mid"), 3)
    if answers.get("return_time") == "late":
        w["security"] += 1
        w["convenience"] += 1
    if answers.get("work_from_home"):
        w["light"] += 1
        w["noise"] += 1
    if answers.get("cooking") == "often":
        w["space"] += 1
        w["facility"] += 1
    if answers.get("cost_sensitivity") == "high":
        w["cost"] += 1
    for cat in top_priorities[:2]:
        if cat in w:
            w[cat] += 2
    return {c: max(1, min(5, v)) for c, v in w.items()}


# ---------------------------------------------------------------- 점수 계산
@dataclass
class ItemInfo:
    id: str
    category: str
    label: str
    input_type: str
    is_required: bool
    score_map: dict | None
    guide_text: str
    caution_text: str | None
    time_sensitive: bool


def item_score(item: ItemInfo, value: str | None) -> float | None:
    """항목 점수(0~1). 점수에 반영하지 않는 항목이거나 미확인이면 None."""
    if value is None or value in UNKNOWN_VALUES:
        return None
    if item.input_type == "status":
        return STATUS_SCORE.get(value)
    if item.score_map:
        v = item.score_map.get(value)
        return float(v) if v is not None else None
    return None


def is_scored_item(item: ItemInfo) -> bool:
    return item.input_type == "status" or bool(item.score_map)


def cost_score(monthly_total: int, budget: int | None) -> float | None:
    if not budget:
        return None
    if monthly_total <= budget * 0.8:
        return 1.0
    if monthly_total <= budget:
        return 0.7
    if monthly_total <= budget * 1.1:
        return 0.3
    return 0.0


def walk_score(walk: int | None, max_walk: int | None) -> float | None:
    if walk is None or not max_walk:
        return None
    if walk <= max_walk:
        return 1.0
    if walk <= max_walk * 1.5:
        return 0.5
    return 0.0


def _is_daytime(dt: datetime | None) -> bool:
    return dt is not None and 7 <= dt.hour < 18


def compute_listing_score(
    listing,  # models.Listing (checks, visits 로드됨)
    items: dict[str, ItemInfo],
    weights: dict[str, int],
    profile,  # models.UserProfile | None
) -> dict:
    checks = {c.item_id: c for c in listing.checks}
    visits = {v.id: v for v in listing.visits}
    budget = profile.monthly_budget if profile else None
    deposit_budget = profile.deposit_budget if profile else None
    max_walk = profile.max_walk_minutes if profile else None
    dealbreakers = list(profile.dealbreakers or []) if profile else []

    cat_values: dict[str, list[float]] = {c: [] for c in CATEGORIES}
    cat_counts: dict[str, dict[str, int]] = {c: {"checked": 0, "total": 0} for c in CATEGORIES}
    unverified: list[dict] = []
    evidence: dict[str, dict] = {}

    req_weight_total = 0.0
    req_weight_checked = 0.0

    for item in items.values():
        chk = checks.get(item.id)
        value = chk.value if chk else None
        scored = is_scored_item(item)
        s = item_score(item, value) if scored else None
        answered = value is not None and value not in UNKNOWN_VALUES

        if scored and item.is_required:
            cat_counts[item.category]["total"] += 1
            req_weight_total += weights.get(item.category, 3)
            if answered:
                req_weight_checked += weights.get(item.category, 3)
        if s is not None:
            cat_values[item.category].append(s)
            if item.is_required:
                cat_counts[item.category]["checked"] += 1
        if answered:
            visit = visits.get(chk.visit_id) if chk and chk.visit_id else None
            evidence[item.id] = {
                "label": item.label,
                "category": item.category,
                "value": value,
                "score": s,
                "visit_time": visit.visited_at.isoformat() if visit else None,
            }
        if item.is_required and not answered:
            unverified.append(
                {
                    "item_id": item.id,
                    "label": item.label,
                    "category": item.category,
                    "category_label": CATEGORIES[item.category],
                    "weight": weights.get(item.category, 3),
                    "reason": "unknown" if value in UNKNOWN_VALUES and value is not None else "unanswered",
                    "how_to_check": item.guide_text,
                    "caution": item.caution_text,
                }
            )

    # 비용
    monthly_total = (listing.monthly_rent or 0) + (listing.maintenance_fee or 0)
    cs = cost_score(monthly_total, budget)
    if cs is not None:
        cat_values["cost"].append(cs)
        evidence["cost"] = {
            "label": "월 고정비(월세+관리비)",
            "category": "cost",
            "value": monthly_total,
            "score": cs,
            "visit_time": None,
        }

    # 실제 도보 시간 (필수 정보)
    ws = walk_score(listing.walk_minutes, max_walk)
    req_weight_total += weights.get("convenience", 3)
    cat_counts["convenience"]["total"] += 1
    if listing.walk_minutes is not None:
        req_weight_checked += weights.get("convenience", 3)
        cat_counts["convenience"]["checked"] += 1
        evidence["walk_minutes"] = {
            "label": "실제 걸어 본 시간",
            "category": "convenience",
            "value": listing.walk_minutes,
            "score": ws,
            "visit_time": None,
        }
        if ws is not None:
            cat_values["convenience"].append(ws)
    else:
        unverified.append(
            {
                "item_id": "walk_minutes",
                "label": "실제 걸어 본 시간",
                "category": "convenience",
                "category_label": CATEGORIES["convenience"],
                "weight": weights.get("convenience", 3),
                "reason": "unanswered",
                "how_to_check": "역이나 학교·회사까지 직접 걸어 보고 걸린 시간을 매물 정보에 입력하세요.",
                "caution": None,
            }
        )

    category_scores = {}
    num = den = 0.0
    for cat, label in CATEGORIES.items():
        vals = cat_values[cat]
        score = sum(vals) / len(vals) if vals else None
        w = weights.get(cat, 3)
        category_scores[cat] = {
            "label": label,
            "score": round(score * 100) if score is not None else None,
            "weight": w,
            "checked": cat_counts[cat]["checked"],
            "total": cat_counts[cat]["total"],
        }
        if score is not None:
            num += w * score
            den += w

    fit = round(num / den * 100) if den else None
    coverage = round(req_weight_checked / req_weight_total, 2) if req_weight_total else 0.0

    # 절대 조건
    violations = []
    entrance = checks.get("entrance_security")
    for code in dealbreakers:
        hit = False
        if code == "semi_basement" and listing.floor_type == "semi_basement":
            hit = True
        elif code == "rooftop" and listing.floor_type == "rooftop":
            hit = True
        elif code == "need_entrance_lock" and entrance and entrance.value in ("none", "cctv_only"):
            hit = True
        elif code == "over_budget" and budget and monthly_total > budget:
            hit = True
        elif code == "over_deposit" and deposit_budget and listing.deposit > deposit_budget:
            hit = True
        elif code == "over_walk" and max_walk and listing.walk_minutes and listing.walk_minutes > max_walk:
            hit = True
        if hit:
            violations.append({"code": code, "label": DEALBREAKERS.get(code, code)})

    # 방문 시간대·상태 안내 (규칙 기반)
    hints: list[dict] = []
    noise_checks = [checks[i] for i in ("road_noise", "wall_soundproof") if i in checks]
    noise_answered = [c for c in noise_checks if c.value not in UNKNOWN_VALUES]
    if listing.visits:
        evening_visits = [v for v in listing.visits if not _is_daytime(v.visited_at)]
        if not evening_visits and weights.get("noise", 3) >= 3:
            hints.append(
                {
                    "type": "evening_revisit",
                    "text": "기록된 방문이 모두 낮 시간입니다. 소음은 저녁(19~22시)에 달라질 수 있으니 저녁에 한 번 더 방문해 확인해 보세요.",
                }
            )
        if any(v.occupancy == "occupied" for v in listing.visits):
            hints.append(
                {
                    "type": "occupied",
                    "text": "세입자가 거주 중일 때 본 집입니다. 가구 때문에 실제보다 좁아 보이거나 상태를 다 확인하지 못했을 수 있어요.",
                }
            )
    else:
        hints.append({"type": "no_visit", "text": "방문 기록이 없습니다. 방문 일시를 남기면 시간대에 따른 확인 안내를 받을 수 있어요."})
    if noise_answered and all(
        (visits.get(c.visit_id) is None or _is_daytime(visits[c.visit_id].visited_at))
        for c in noise_answered
    ) and listing.visits and any(not _is_daytime(v.visited_at) for v in listing.visits):
        hints.append(
            {
                "type": "noise_day_only",
                "text": "소음 항목은 낮 방문 때 기록되었습니다. 저녁 방문에서 소음 항목을 다시 체크해 보세요.",
            }
        )

    unverified.sort(key=lambda u: (-u["weight"], u["label"]))

    return {
        "listing_id": listing.id,
        "nickname": listing.nickname,
        "fit": fit,
        "coverage": coverage,
        "low_coverage": coverage < 0.6,
        "category_scores": category_scores,
        "dealbreaker_violations": violations,
        "unverified": unverified,
        "hints": hints,
        "evidence": evidence,
        "check_values": {c.item_id: c.value for c in listing.checks},
        "monthly_total": monthly_total,
        "deposit": listing.deposit,
    }


def rank_results(results: list[dict]) -> list[dict]:
    """절대 조건 위반 매물은 뒤로, 나머지는 적합도 높은 순."""

    def key(r):
        return (
            1 if r["dealbreaker_violations"] else 0,
            -(r["fit"] if r["fit"] is not None else -1),
            -r["coverage"],
        )

    ranked = sorted(results, key=key)
    for i, r in enumerate(ranked, start=1):
        r["rank"] = i
    return ranked
