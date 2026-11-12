"""실거래가 연동 테스트: XML 파싱, 오류 해석, 시세 비교 규칙, API(예시/실제·캐시)."""
from test_flow import LISTING, client_for  # noqa: F401  (테스트 DB 준비 fixture 재사용)
from test_flow import fresh_db  # noqa: F401

import httpx  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.services import molit  # noqa: E402

XML_OK = """<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>
<body><items>
<item><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>3</dealDay><umdNm>고척동</umdNm>
<offiNm>테스트오피스텔</offiNm><excluUseAr>23.5</excluUseAr><floor>5</floor><deposit>1,000</deposit>
<monthlyRent>65</monthlyRent><contractType>신규</contractType><buildYear>2018</buildYear></item>
<item><dealYear>2026</dealYear><dealMonth>10</dealMonth><dealDay>9</dealDay><umdNm>개봉동</umdNm>
<offiNm>B</offiNm><excluUseAr>30.1</excluUseAr><floor>3</floor><deposit>20,000</deposit>
<monthlyRent>0</monthlyRent></item>
</items><totalCount>2</totalCount></body></response>"""

XML_KOREAN = """<response><header><resultCode>00</resultCode></header><body><items>
<item><년>2025</년><월>3</월><일>1</일><법정동> 구로동</법정동><전용면적>19.8</전용면적>
<보증금액> 500</보증금액><월세금액> 55</월세금액></item></items></body></response>"""

XML_AUTH = """<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>
<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode>
</cmmMsgHeader></OpenAPI_ServiceResponse>"""


def test_parse_english_and_korean_fields():
    deals = molit.parse_xml(XML_OK)
    assert deals[0] == {
        "date": "2026-10-03", "dong": "고척동", "name": "테스트오피스텔", "area": 23.5, "floor": 5,
        "deposit": 1000, "rent": 65, "contract_type": "신규", "build_year": 2018,
    }
    assert deals[1]["rent"] == 0 and deals[1]["deposit"] == 20000
    k = molit.parse_xml(XML_KOREAN)[0]
    assert (k["dong"], k["deposit"], k["rent"], k["area"]) == ("구로동", 500, 55, 19.8)


def test_auth_error_is_explained():
    try:
        molit.parse_xml(XML_AUTH)
        raise AssertionError("should fail")
    except molit.MolitError as e:
        assert "인증키" in str(e)


def test_analyze_percentile_rules():
    deals = [{"date": f"2026-10-{i+1:02d}", "dong": "가동", "name": "", "area": 22.0, "floor": 1,
              "deposit": 1000, "rent": 40 + i * 5, "contract_type": "", "build_year": None} for i in range(10)]
    # 월세 40,45,...,85 → 중앙값 62(62.5), 내 월세 85 → 높은 편
    r = molit.analyze(deals, dong="가동", area_m2=22, my_deposit=1000, my_rent=85)
    assert r["scope"] == "가동" and r["compare"]["level"] == "high"
    assert r["wolse"]["count"] == 10 and r["compare"]["median_rent"] == 62
    low = molit.analyze(deals, dong=None, area_m2=None, my_deposit=1000, my_rent=40)
    assert low["compare"]["label"] == "낮은 편"
    # 동 거래가 부족하면 구 전체로 넓히고 안내
    wide = molit.analyze(deals, dong="없는동", area_m2=None, my_deposit=None, my_rent=60)
    assert wide["scope"] == "구 전체" and any("없는동" in n for n in wide["notes"])


def test_guess_dong():
    assert molit.guess_dong("서울 구로구 고척동 62-160") == "고척동"
    assert molit.guess_dong("테스트로 1") is None


def test_market_api_sample_mode():
    c = client_for("market1@test.com")
    lid = c.post("/api/listings", json={**LISTING, "address": "서울 구로구 고척동 1", "area_m2": 22}).json()["id"]
    st = c.get("/api/market/status").json()
    assert st["mode"] == "mock" and st["is_sample"] is True
    assert any(r["code"] == "11530" for r in c.get("/api/market/regions").json())
    r = c.get("/api/market/rent", params={"lawd_cd": "11530", "house_type": "offi", "listing_id": lid, "save": True})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_sample"] is True and "예시" in body["source"]
    assert body["suggested_dong"] == "고척동" and body["compare"]["my_rent"] == 45
    assert len(body["months"]) == get_settings().molit_months
    saved = c.get(f"/api/listings/{lid}").json()
    assert saved["lawd_cd"] == "11530" and saved["house_type"] == "offi"
    # 다른 사람 매물은 조회 불가
    other = client_for("market2@test.com")
    assert other.get("/api/market/rent", params={"lawd_cd": "11530", "house_type": "offi", "listing_id": lid}).status_code == 404
    assert c.get("/api/market/rent", params={"lawd_cd": "abc", "house_type": "offi"}).status_code == 422


def test_market_api_live_uses_cache(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "molit_mode", "live")
    monkeypatch.setattr(s, "molit_api_key", "abc%2Bdef")  # Encoding 키를 넣어도 복원되는지
    monkeypatch.setattr(s, "molit_months", 2)
    calls = []

    def fake_get(url, params=None, timeout=None):
        calls.append((url, dict(params)))
        return httpx.Response(200, text=XML_OK)

    monkeypatch.setattr(molit.httpx, "get", fake_get)
    c = client_for("market3@test.com")
    q = {"lawd_cd": "11530", "house_type": "offi"}
    b1 = c.get("/api/market/rent", params=q).json()
    assert b1["is_sample"] is False and b1["cached_months"] == 0 and len(calls) == 2
    assert calls[0][1]["serviceKey"] == "abc+def" and calls[0][0].endswith("getRTMSDataSvcOffiRent")
    b2 = c.get("/api/market/rent", params=q).json()
    assert b2["cached_months"] == 2 and len(calls) == 2  # 두 번째는 API를 다시 부르지 않음

    monkeypatch.setattr(molit.httpx, "get", lambda *a, **k: httpx.Response(200, text=XML_AUTH))
    r = c.get("/api/market/rent", params={"lawd_cd": "11440", "house_type": "rh"})
    assert r.status_code == 502 and "인증키" in r.json()["detail"]
