"""관리자 운영 현황 API 테스트."""
from test_flow import LISTING, client_for, fresh_db  # noqa: F401

from app.config import get_settings  # noqa: E402

ALL4 = {f"q{i}": 4 for i in range(1, 11)}


def test_overview_admin_only_and_counts(monkeypatch):
    monkeypatch.setattr(get_settings(), "admin_emails", "boss@test.com")
    t = client_for("tester@test.com")
    assert t.get("/api/auth/me").json()["is_admin"] is False
    assert t.post("/api/listings", json=LISTING).status_code in (200, 201)
    t.put("/api/survey", json={"segment": "preparing", "scores": ALL4})

    admin = client_for("boss@test.com")
    assert admin.get("/api/auth/me").json()["is_admin"] is True
    admin.post("/api/listings", json=LISTING)  # 관리자 매물은 사용 현황에서 제외

    assert t.get("/api/admin/overview").status_code == 403
    r = admin.get("/api/admin/overview")
    assert r.status_code == 200, r.text
    d = r.json()

    assert d["totals"]["listings"] >= 1
    assert d["totals"]["survey_responses"] >= 1
    funnel = {f["key"]: f["count"] for f in d["funnel"]}
    assert funnel["signup"] >= funnel["listing"] >= 1

    assert len(d["daily"]) == 14
    today = d["daily"][-1]
    assert today["signups"] >= 1 and today["listings"] >= 1 and today["surveys"] >= 1

    assert d["ai"]["limit_total"] == get_settings().ai_daily_limit_total
    assert set(d["ai"]["by_mode"]) >= {"openai", "mock", "cached"}
    # 개인정보(이메일)는 응답에 없어야 함
    assert "tester@test.com" not in r.text and "boss@test.com" not in r.text
