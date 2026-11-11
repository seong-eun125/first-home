"""AI 매물 판정 테스트: SSRF 차단, 규칙 추출, 규칙 안전장치, AI 출력 검증(근거 없는 숫자 버림), 이미지 처리."""
import io

from test_flow import client_for, fresh_db  # noqa: F401  (테스트 DB fixture 재사용)

import pytest  # noqa: E402
from PIL import Image  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.services import ai_service  # noqa: E402
from app.services import precheck as pc  # noqa: E402

AD = """[월세] 구로구 고척동 분리형 원룸 보증금 500만원 / 월세 45만원 관리비 7만원(수도·인터넷 포함)
전용 23㎡, 3층/5층, 남향 채광 좋아요. 공동현관 비밀번호, 역 도보 6분. 냉장고 세탁기 에어컨 풀옵션. 즉시 입주"""

AD_RISKY = """빌라 반지하 보증금 300 월세 35 관리비 별도 융자 조금 있음 급매 근생 건물입니다"""


def _profile(c, **kw):
    body = {
        "answers": {},
        "top_priorities": ["light", "security"],
        "monthly_budget": 600_000,
        "deposit_budget": 10_000_000,
        "dealbreakers": ["semi_basement"],
    }
    body.update(kw)
    assert c.put("/api/profile", json=body).status_code == 200


# ---------------------------------------------------------------- 단위
@pytest.mark.parametrize(
    "url",
    ["http://127.0.0.1/x", "http://localhost:8000/", "http://169.254.169.254/latest", "http://10.0.0.5/", "ftp://a.com/x", "http://a.com:8080/"],
)
def test_ssrf_blocked(url, monkeypatch):
    real = pc.socket.getaddrinfo

    def fake(host, *a, **k):
        if host == "a.com":
            return [(2, 1, 6, "", ("93.184.216.34", 0))]
        return real(host, *a, **k)

    monkeypatch.setattr(pc.socket, "getaddrinfo", fake)
    with pytest.raises(pc.PrecheckError):
        pc.validate_url(url)


def test_html_to_text_strips_scripts():
    html = "<html><head><title>매물 A</title><meta property='og:description' content='보증금 1000 월세 50'>" \
           "<script>alert('x')</script><style>.a{}</style></head><body><p>남향 원룸</p></body></html>"
    t = pc.html_to_text(html)
    assert "매물 A" in t and "보증금 1000 월세 50" in t and "남향 원룸" in t and "alert" not in t
    assert pc.text_has_listing_info(t) and not pc.text_has_listing_info("로딩 중입니다")


def test_rule_extract():
    ex = pc.rule_extract(AD)["extracted"]
    assert (ex["deposit_manwon"], ex["monthly_rent_manwon"], ex["maintenance_fee_manwon"]) == (500, 45, 7)
    assert ex["area_m2"] == 23 and ex["floor"] == 3 and ex["total_floors"] == 5 and ex["floor_type"] == "normal"
    assert ex["entrance_lock"] is True and "냉장고" in ex["options"] and ex["address_text"].endswith("고척동")
    assert pc.rule_extract("전세 1.5억 오피스텔")["extracted"]["deposit_manwon"] == 15000
    assert pc.rule_extract("10평 원룸")["extracted"]["area_m2"] == 33.1
    risky = pc.rule_extract(AD_RISKY)["extracted"]
    assert risky["floor_type"] == "semi_basement" and (risky["deposit_manwon"], risky["monthly_rent_manwon"]) == (300, 35)
    quotes = {f["quote"] for f in pc.rule_flags(AD_RISKY)}
    assert {"융자", "근생", "급매", "관리비 별도"} <= quotes


def test_clean_drops_ungrounded_numbers():
    raw = {
        "extracted": {"deposit_manwon": 500, "monthly_rent_manwon": 99, "area_m2": 23},
        "quotes": {"deposit_manwon": "보증금 500만원", "monthly_rent_manwon": "월세 99만원"},
        "priority_review": [
            {"category": "light", "assessment": "good", "reason": "남향", "quote": "남향 채광"},
            {"category": "noise", "assessment": "good", "reason": "조용", "quote": "아주 조용한 동네"},
        ],
        "red_flags": [{"text": "가짜", "quote": "침수 이력"}],
        "verdict": "great",
    }
    out = pc.clean_ai_output(raw, AD, has_images=False)
    assert out["extracted"]["deposit_manwon"] == 500
    assert out["extracted"]["monthly_rent_manwon"] is None and "monthly_rent_manwon" in out["dropped_fields"]
    rv = {r["category"]: r for r in out["priority_review"]}
    assert rv["light"]["assessment"] == "good" and rv["noise"]["assessment"] == "unknown"
    assert out["red_flags"] == [] and out["ai_verdict"] == "check"


def test_prepare_image_strips_metadata():
    img = Image.new("RGB", (3000, 1500), "white")
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (37.0, 30.0, 0.0)}  # GPS
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif.tobytes())
    durl, h = pc.prepare_image(buf.getvalue())
    import base64

    data = base64.b64decode(durl.split(",", 1)[1])
    out = Image.open(io.BytesIO(data))
    assert max(out.size) == 1600 and not out.getexif() and len(h) == 64
    with pytest.raises(pc.PrecheckError):
        pc.prepare_image(b"not an image")


# ---------------------------------------------------------------- API (규칙 기반 모드)
def test_precheck_text_mock_mode():
    c = client_for("pre1@test.com")
    _profile(c)
    r = c.post("/api/precheck", data={"text": AD})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["mode"] == "mock" and b["source"]["kind"] == "text"
    assert b["extracted"]["monthly_rent_manwon"] == 45
    cost = next(x for x in b["priority_review"] if x["category"] == "cost")
    assert cost["assessment"] == "good" and "52만원" in cost["reason"]
    assert b["final_verdict"] in ("good", "check") and b["listing_draft"]["monthly_rent"] == 450_000
    gates = {g["label"]: g["status"] for g in b["gates"]}
    assert gates["월 고정비 예산"] == "pass" and gates["반지하 제외"] == "pass"
    # 같은 입력은 캐시
    assert c.post("/api/precheck", data={"text": AD}).json()["cached"] is True


def test_precheck_rules_lower_verdict():
    c = client_for("pre2@test.com")
    _profile(c)
    b = c.post("/api/precheck", data={"text": AD_RISKY}).json()
    assert b["final_verdict"] == "bad"
    assert any("반지하" in x for x in b["rule_reasons"])
    assert len(b["red_flags"]) >= 3


def test_precheck_input_errors(monkeypatch):
    c = client_for("pre3@test.com")
    assert c.post("/api/precheck", data={}).status_code == 400
    # 화면을 스크립트로 그리는 사이트 → 캡처 안내
    monkeypatch.setattr(pc, "fetch_url_text", lambda url: "로딩 중")
    r = c.post("/api/precheck", data={"url": "https://example.com/room/1"})
    assert r.status_code == 422 and "캡처" in r.json()["detail"]
    # 이미지 + 키 없음 → AI 필요 안내
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), "white").save(buf, "PNG")
    r = c.post("/api/precheck", files=[("images", ("a.png", buf.getvalue(), "image/png"))])
    assert r.status_code == 503 and "OpenAI 키" in r.json()["detail"]


# ---------------------------------------------------------------- API (OpenAI 모드, 호출은 가짜)
def test_precheck_openai_mode_rules_override(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "ai_mode", "openai")
    monkeypatch.setattr(s, "openai_api_key", "test")
    monkeypatch.setattr(s, "openai_model", "test-model")
    seen = {}

    def fake_call(payload, fmt, images=None, system_prompt=None, model=None):
        seen["images"] = images
        seen["has_user"] = "user" in payload
        return {
            "title": "고척동 분리형",
            "extracted": {"deposit_manwon": 500, "monthly_rent_manwon": 45, "maintenance_fee_manwon": 7, "floor_type": "normal", "house_type": "sh", "address_text": "구로구 고척동"},
            "quotes": {"deposit_manwon": "보증금 500만원", "monthly_rent_manwon": "월세 45만원", "maintenance_fee_manwon": "관리비 7만원"},
            "priority_review": [{"category": "light", "assessment": "good", "reason": "남향", "quote": "남향 채광"}],
            "red_flags": [],
            "verdict": "good",
            "verdict_reason": "조건에 맞아요",
            "summary": "요약",
            "questions_to_ask": ["관리비 포함 항목?"],
            "visit_checklist": ["수압"],
        }, {"prompt_tokens": 10, "completion_tokens": 10}

    monkeypatch.setattr(ai_service, "call_openai", fake_call)
    c = client_for("pre4@test.com")
    _profile(c, monthly_budget=400_000)  # 예산 40만 < 52만
    buf = io.BytesIO()
    Image.new("RGB", (200, 200), "white").save(buf, "PNG")
    r = c.post("/api/precheck", data={"text": AD}, files=[("images", ("a.png", buf.getvalue(), "image/png"))])
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["mode"] == "openai" and seen["has_user"] and seen["images"][0].startswith("data:image/jpeg;base64,")
    assert b["ai_verdict"] == "good" and b["final_verdict"] == "check" and b["lowered_by_rules"] is True
    assert b["market"] is not None and b["market"]["region"]["code"] == "11530" and b["market"]["is_sample"] is True


# ---------------------------------------------------------------- 모델 자동 선택
def test_rank_models_and_auto_selection(monkeypatch):
    ids = ["dall-e-3", "gpt-4o-mini-tts", "gpt-4o", "gpt-4o-mini", "gpt-4o-mini-2024-07-18", "whisper-1", "gpt-4.1-nano"]
    assert ai_service.rank_models(ids) == ["gpt-4o-mini", "gpt-4o", "gpt-4o-mini-2024-07-18"]
    assert ai_service.rank_models(["gpt-9-mini", "gpt-9-mini-2030-01-01"]) == ["gpt-9-mini", "gpt-9-mini-2030-01-01"]
    assert ai_service.is_reasoning_model("gpt-5-mini") and not ai_service.is_reasoning_model("gpt-4.1-mini")

    s = get_settings()
    monkeypatch.setattr(s, "ai_mode", "auto")
    monkeypatch.setattr(s, "openai_api_key", "test")
    monkeypatch.setattr(s, "openai_model", "")
    assert s.openai_ready and s.effective_ai_mode == "openai"  # 키만 있어도 AI 모드

    class FakeModels:
        def list(self):
            return [type("M", (), {"id": i})() for i in ["gpt-4.1-mini", "gpt-4o-mini"]]

    monkeypatch.setattr(ai_service, "_client", lambda: type("C", (), {"models": FakeModels()})())
    ai_service.reset_auto_model()
    assert ai_service.current_model() == "gpt-4.1-mini"
    monkeypatch.setattr(s, "openai_model", "my-model")
    assert ai_service.current_model() == "my-model"  # .env에 적으면 그대로 사용
    ai_service.reset_auto_model()
