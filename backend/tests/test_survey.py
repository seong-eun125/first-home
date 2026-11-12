"""만족도 설문·관리자 집계·배포용 정적 서빙 테스트."""
from test_flow import client_for, fresh_db  # noqa: F401

import pytest  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.main import DIST  # noqa: E402

ALL4 = {f"q{i}": 4 for i in range(1, 11)}


def test_survey_submit_and_update():
    c = client_for("s1@test.com")
    s = c.get("/api/survey").json()
    assert len(s["questions"]) == 10 and s["mine"] is None and s["is_admin"] is False
    assert c.put("/api/survey", json={"scores": {**ALL4, "q10": 6}}).status_code == 422
    partial = {k: v for k, v in ALL4.items() if k != "q3"}
    assert c.put("/api/survey", json={"scores": partial}).status_code == 422
    r = c.put("/api/survey", json={"segment": "preparing", "scores": ALL4, "good_text": " 좋아요 "})
    assert r.status_code == 200 and r.json()["mine"]["good_text"] == "좋아요"
    c.put("/api/survey", json={"segment": "living", "scores": {**ALL4, "q1": 5}})  # 다시 제출 = 수정
    assert c.get("/api/survey").json()["mine"]["scores"]["q1"] == 5


def test_results_admin_only_and_excludes_admin(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "admin_emails", "boss@test.com")
    a = client_for("t1@test.com")
    a.put("/api/survey", json={"segment": "preparing", "scores": {**ALL4, "q10": 5}, "improve_text": "지도 연동"})
    b = client_for("t2@test.com")
    b.put("/api/survey", json={"segment": "living", "scores": {**ALL4, "q10": 2}})
    admin = client_for("boss@test.com")
    admin.put("/api/survey", json={"scores": {f"q{i}": 1 for i in range(1, 11)}})  # 관리자 응답은 제외돼야 함

    assert a.get("/api/survey/results").status_code == 403
    assert admin.get("/api/survey").json()["is_admin"] is True
    r = admin.get("/api/survey/results").json()
    # 앞 테스트의 s1 응답 + t1 + t2 = 3명 (관리자 제외)
    assert r["respondents"] == 3
    q10 = r["questions"][-1]
    assert q10["dist"] == [0, 1, 0, 1, 1] and q10["top2_pct"] == 67
    assert r["improve"] == ["지도 연동"] and r["usage"]["users"] >= 3

    csv_text = admin.get("/api/survey/results.csv").text
    assert csv_text.startswith("﻿순번") and "t1@test.com" not in csv_text and "지도 연동" in csv_text
    assert a.get("/api/survey/results.csv").status_code == 403


@pytest.mark.skipif(not (DIST / "index.html").is_file(), reason="frontend/dist 빌드가 없으면 건너뜀")
def test_serves_frontend_build():
    from fastapi.testclient import TestClient

    from app.main import app

    c = TestClient(app)
    r = c.get("/listings/123")  # 화면 주소는 index.html로
    assert r.status_code == 200 and "<div id=\"root\">" in r.text
    assert c.get("/api/does-not-exist").status_code == 404  # API 경로는 화면으로 넘기지 않음
    assert c.get("/../backend/.env").status_code in (200, 404) and "JWT_SECRET" not in c.get("/../backend/.env").text
    assert c.get("/api/health").json()["status"] in ("ok", "error")
