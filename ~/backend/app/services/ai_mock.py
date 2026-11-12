"""목업(규칙 기반) 리포트.

API 키 확인 전이거나 호출이 실패했을 때 쓰는 대체 응답입니다.
같은 입력 데이터로 규칙에 따라 문장을 만들기 때문에, 비용 없이도
실제 매물 기록을 근거로 한 리포트를 보여 줄 수 있습니다.
화면에는 반드시 '규칙 기반 응답'으로 표시됩니다.
"""
from __future__ import annotations

from .scoring import CATEGORIES


def _has_final(word: str) -> bool:
    """마지막 글자에 받침이 있는지 (한글이 아니면 받침 없음으로 처리)."""
    w = word.strip().strip("'\"·) ")
    ch = w[-1:] if w else ""
    if not ch or not ("가" <= ch <= "힣"):
        return False
    return (ord(ch) - ord("가")) % 28 != 0


def euro(word: str) -> str:  # (으)로
    ch = word.strip().strip("'\"·) ")[-1:]
    if ch and "가" <= ch <= "힣" and (ord(ch) - ord("가")) % 28 not in (0, 8):
        return f"{word}으로"
    return f"{word}로"


def eunneun(word: str) -> str:  # 은/는
    return f"{word}은" if _has_final(word) else f"{word}는"


def iga(word: str) -> str:  # 이/가
    return f"{word}이" if _has_final(word) else f"{word}가"

QUESTION_TEMPLATES = {
    "wall_soundproof": "이전 세입자가 소음 문제로 불편을 이야기한 적이 있나요?",
    "road_noise": "밤 시간대에 주변(도로·상가) 소음이 어느 정도인가요?",
    "boiler": "겨울철 난방비는 보통 얼마 정도 나오나요?",
    "pest_signs": "건물 방역은 얼마나 자주 하나요?",
    "option_condition": "옵션 가구가 고장 나면 수리는 누가 부담하나요?",
    "entrance_security": "공동현관 CCTV는 실제로 녹화·보관되나요?",
    "leak_mold": "누수나 곰팡이 문제로 수리한 적이 있나요?",
    "water_pressure": "온수가 나오는 데 시간이 오래 걸린 적은 없나요?",
    "drainage": "배수 문제로 수리한 적이 있나요?",
    "smoke_signs": "건물 안이나 주변에서 흡연하는 공간이 따로 있나요?",
    "screens_bars": "방충망이나 방범창 교체·수리를 요청할 수 있나요?",
    "front_view": "블라인드나 커튼을 설치해도 되나요?",
    "sunlight": "오후에도 해가 드는 편인가요?",
}


def _sorted_evidence(ctx: dict, weights_by_label: dict[str, int]):
    rows = []
    for c in ctx["checks"]:
        rows.append(c)
    return sorted(rows, key=lambda c: -weights_by_label.get(c["category"], 3))


def mock_listing_report(user_ctx: dict, ctx: dict, score: dict) -> dict:
    w_by_label = user_ctx["weights"]
    evidence = score["evidence"]
    pros, cons = [], []

    ranked = sorted(
        (e for e in evidence.items() if e[1]["score"] is not None),
        key=lambda kv: -w_by_label.get(CATEGORIES.get(kv[1]["category"], ""), 3),
    )
    for item_id, ev in ranked:
        cat_label = CATEGORIES.get(ev["category"], ev["category"])
        val = ev["value"]
        if item_id == "cost":
            if ev["score"] >= 0.7:
                pros.append({"text": f"월 고정비 {val:,}원으로 설정한 예산 안에 있습니다.", "evidence": ["cost"]})
            else:
                cons.append({"text": f"월 고정비 {val:,}원으로 예산을 넘거나 예산에 가깝습니다.", "evidence": ["cost"]})
            continue
        if item_id == "walk_minutes":
            if ev["score"] >= 1:
                pros.append({"text": f"직접 걸어 본 시간이 {val}분으로 희망 시간 안에 있습니다.", "evidence": ["walk_minutes"]})
            else:
                cons.append({"text": f"직접 걸어 본 시간이 {val}분으로 희망 시간보다 깁니다.", "evidence": ["walk_minutes"]})
            continue
        label = next((c["label"] for c in ctx["checks"] if c["item_id"] == item_id), ev["label"])
        shown = next((c["value"] for c in ctx["checks"] if c["item_id"] == item_id), val)
        if ev["score"] >= 1 and len(pros) < 4:
            pros.append({"text": f"{label} 항목이 {euro(chr(39) + shown + chr(39))} 기록되었습니다.", "evidence": [item_id]})
        elif ev["score"] <= 0.5 and len(cons) < 4:
            level = "감수해야 할 점" if ev["score"] == 0 else "아쉬운 점"
            cons.append({"text": f"{label} 항목이 {euro(chr(39) + shown + chr(39))} 기록되어 {cat_label} 면에서 {level}이 있습니다.", "evidence": [item_id]})

    for v in score["dealbreaker_violations"]:
        cons.insert(0, {"text": f"설정한 절대 조건 '{v['label']}'에 맞지 않습니다.", "evidence": ["dealbreaker"]})

    unverified = []
    for u in score["unverified"][:5]:
        why = (
            f"'{u['category_label']}' 가중치를 {u['weight']}로 높게 설정했습니다."
            if u["weight"] >= 4
            else "현장에서 꼭 확인할 필수 항목입니다."
        )
        unverified.append({"item_id": u["item_id"], "why_it_matters": why, "how_to_check": u["how_to_check"]})

    q_ids = [u["item_id"] for u in score["unverified"]] + [c[0] for c in sorted(
        ((k, v) for k, v in evidence.items() if v["score"] is not None and v["score"] <= 0.5), key=lambda kv: kv[1]["score"]
    )]
    questions = []
    for i in q_ids:
        q = QUESTION_TEMPLATES.get(i)
        if q and q not in questions:
            questions.append(q)
        if len(questions) >= 3:
            break
    if not questions:
        questions.append("관리비에 포함된 항목은 무엇인가요?")

    cats = [v for v in score["category_scores"].values() if v["score"] is not None]
    best = max(cats, key=lambda v: (v["score"], v["weight"]), default=None)
    worst = min(cats, key=lambda v: (v["score"], -v["weight"]), default=None)
    tops = ", ".join(user_ctx["top_priorities"]) or "설정한 우선순위"
    parts = [f"{tops} 기준으로 계산된 적합도는 {score['fit'] if score['fit'] is not None else '-'}점, 확인도는 {round(score['coverage'] * 100)}%입니다."]
    if best and worst and best is not worst:
        parts.append(f"{eunneun(chr(39) + best['label'] + chr(39))} 좋게 기록되었고 {eunneun(chr(39) + worst['label'] + chr(39))} 상대적으로 아쉽습니다.")
    if score["unverified"]:
        parts.append(f"아직 확인하지 못한 필수 항목이 {len(score['unverified'])}개 있어 결정 전에 확인이 필요합니다.")
    return {
        "summary": " ".join(parts),
        "pros": pros[:4],
        "cons": cons[:4],
        "unverified": unverified,
        "questions_to_ask": questions,
        "decision_note": "이 리포트는 현장 기록을 바탕으로 한 참고 의견이며, 주거 안전이나 법적 문제가 없음을 보장하지 않습니다.",
    }


def mock_compare_report(user_ctx: dict, contexts: list[dict], scores: list[dict]) -> dict:
    by_id = {s["listing_id"]: s for s in scores}
    per_listing = []
    for ctx in contexts:
        s = by_id[ctx["listing_id"]]
        single = mock_listing_report(user_ctx, ctx, s)
        cats = [v for v in s["category_scores"].values() if v["score"] is not None]
        best = max(cats, key=lambda v: (v["score"], v["weight"]), default=None)
        one = f"적합도 {s['fit'] if s['fit'] is not None else '-'}점 · 확인도 {round(s['coverage'] * 100)}%"
        if best:
            one += f" · 강점: {best['label']}"
        per_listing.append(
            {
                "listing_id": ctx["listing_id"],
                "one_liner": one,
                "strengths": single["pros"][:3],
                "watch_outs": single["cons"][:3],
                "check_before_decide": [u["label"] for u in s["unverified"][:3]],
            }
        )

    picks = []
    cat_keys = [k for k in CATEGORIES if any(s["category_scores"][k]["score"] is not None for s in scores)]
    weights = {k: scores[0]["category_scores"][k]["weight"] for k in cat_keys}
    for cat in sorted(cat_keys, key=lambda k: -weights[k])[:3]:
        cand = [s for s in scores if s["category_scores"][cat]["score"] is not None]
        if len(cand) < 2:
            continue
        top = max(cand, key=lambda s: s["category_scores"][cat]["score"])
        if all(s["category_scores"][cat]["score"] == top["category_scores"][cat]["score"] for s in cand):
            continue
        picks.append(
            {
                "condition": f"{CATEGORIES[cat]}{'을' if _has_final(CATEGORIES[cat]) else '를'} 가장 중요하게 본다면",
                "listing_id": top["listing_id"],
                "reason": f"{CATEGORIES[cat]} 점수가 {top['category_scores'][cat]['score']}점으로 비교 매물 중 가장 높습니다.",
            }
        )
    leader = scores[0]
    summary = f"현재 가중치 기준으로 '{leader['nickname']}'의 적합도가 가장 높습니다"
    if leader["low_coverage"]:
        summary += ". 다만 확인도가 낮아 확인하지 못한 항목을 먼저 채우는 것이 좋습니다"
    summary += ". 최종 결정은 아래 조건별 설명과 확인할 항목을 보고 직접 내려 주세요."
    return {
        "summary": summary,
        "per_listing": per_listing,
        "conditional_picks": picks,
        "closing": "점수는 백엔드 규칙으로 계산되었고, 이 설명은 그 점수와 현장 기록을 근거로 만든 참고 의견입니다.",
    }
