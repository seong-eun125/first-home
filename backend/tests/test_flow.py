"""전체 흐름 통합 테스트 (실제 MySQL 테스트 DB 사용).

실행 전 준비 (한 번만):
  1) MySQL에 테스트 DB 만들기: CREATE DATABASE firsthome_test CHARACTER SET utf8mb4;
     (firsthome 사용자에게 권한 부여: GRANT ALL ON firsthome_test.* TO 'firsthome'@'localhost';)
  2) 실행:  TEST_DATABASE_URL=... pytest -q   (기본값은 아래 DEFAULT_URL)
테스트는 매번 테이블을 새로 만들고 지웁니다. 운영 DB(firsthome)는 건드리지 않습니다.
"""
import io
import os

DEFAULT_URL = "mysql+pymysql://firsthome:firsthome_pw@127.0.0.1:3306/firsthome_test?charset=utf8mb4"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", DEFAULT_URL)
os.environ["AI_MODE"] = "mock"
os.environ["UPLOAD_DIR"] = "/tmp/firsthome_test_uploads"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import sync_checklist  # noqa: E402

assert "firsthome_test" in os.environ["DATABASE_URL"], "테스트는 반드시 테스트 DB에서만 실행합니다."


@pytest.fixture(scope="module", autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        sync_checklist(db)
    yield
    Base.metadata.drop_all(engine)


def client_for(email: str) -> TestClient:
    c = TestClient(app)
    r = c.post("/api/auth/signup", json={"email": email, "password": "password123!", "name": "테스터"})
    assert r.status_code == 201, r.text
    return c


LISTING = dict(
    nickname="A집", address="테스트로 1", deposit=5_000_000, monthly_rent=450_000,
    maintenance_fee=50_000, floor=3, total_floors=5, floor_type="normal", walk_minutes=7,
    options=["냉장고", "세탁기"],
)


def test_full_flow():
    c = client_for("a@test.com")
    assert c.get("/api/auth/me").json()["email"] == "a@test.com"

    # 1~2. 생활 패턴 저장 → 가중치 자동 계산·저장
    r = c.put("/api/profile", json={
        "answers": {"noise_sensitivity": "high", "return_time": "late"},
        "top_priorities": ["noise"], "monthly_budget": 600_000, "max_walk_minutes": 10,
        "dealbreakers": ["semi_basement"],
    })
    assert r.status_code == 200, r.text
    assert r.json()["weights"]["noise"] == 5
    assert c.get("/api/profile").json()["profile"]["onboarding_done"] is True

    # 3. 매물 CRUD + 중복 확인
    a = c.post("/api/listings", json=LISTING).json()
    b = c.post("/api/listings", json={**LISTING, "nickname": "B집", "address": "테스트로 2", "monthly_rent": 400_000}).json()
    s = c.post("/api/listings", json={**LISTING, "nickname": "반지하집", "address": "테스트로 3", "floor_type": "semi_basement"}).json()
    dup = c.post("/api/listings/duplicate-check", json={"address": "테스트로  1"}).json()
    assert [d["id"] for d in dup["duplicates"]] == [a["id"]]
    r = c.patch(f"/api/listings/{a['id']}", json={"walk_minutes": 5, "status": "hold"})
    assert r.json()["walk_minutes"] == 5 and r.json()["status"] == "hold"
    assert c.patch(f"/api/listings/{a['id']}", json={"status": "selected"}).status_code == 400

    # 4. 방문 기록 + 체크 저장 (잘못된 값은 거부)
    v = c.post(f"/api/listings/{a['id']}/visits", json={"visited_at": "2026-11-09T14:00:00", "occupancy": "occupied"}).json()
    bad = c.put(f"/api/listings/{a['id']}/checks", json={"checks": [{"item_id": "road_noise", "value": "great"}]})
    assert bad.status_code == 400
    r = c.put(f"/api/listings/{a['id']}/checks", json={"checks": [
        {"item_id": "road_noise", "value": "bad", "visit_id": v["id"], "note": "버스 소리"},
        {"item_id": "wall_soundproof", "value": "unknown", "visit_id": v["id"]},
        {"item_id": "entrance_security", "value": "both"},
        {"item_id": "sunlight", "value": "good"},
    ]})
    assert r.status_code == 200, r.text
    score_a = r.json()["score"]
    assert score_a["category_scores"]["noise"]["score"] == 0
    assert any(u["item_id"] == "wall_soundproof" and u["reason"] == "unknown" for u in score_a["unverified"])
    assert {h["type"] for h in score_a["hints"]} >= {"evening_revisit", "occupied"}
    c.put(f"/api/listings/{b['id']}/checks", json={"checks": [
        {"item_id": "road_noise", "value": "good"}, {"item_id": "wall_soundproof", "value": "good"},
        {"item_id": "sunlight", "value": "bad"},
    ]})

    # 5~6. 점수 계산 + 가중치 변경 시 순위 재계산(저장 안 함), 절대 조건 위반은 맨 뒤
    base = c.post("/api/scores/preview", json={}).json()["results"]
    assert base[-1]["nickname"] == "반지하집" and base[-1]["dealbreaker_violations"]
    assert base[0]["nickname"] == "B집"
    alt = c.post("/api/scores/preview", json={"weights": {"noise": 1, "light": 5}}).json()["results"]
    assert alt[0]["nickname"] == "A집"
    assert c.get("/api/profile").json()["weights"]["noise"] == 5  # 미리보기는 저장하지 않음
    c.put("/api/profile/weights", json={"weights": {"light": 4}})
    assert c.get("/api/profile").json()["weights"]["light"] == 4
    assert c.put("/api/profile/weights", json={"weights": {"light": 9}}).status_code == 422

    # 7~8. 비교 저장 + AI 비교 리포트(목업) + 캐시
    comp = c.post("/api/comparisons", json={"listing_ids": [a["id"], b["id"]]}).json()
    assert len(comp["results"]) == 2
    rep = c.post(f"/api/ai/comparisons/{comp['id']}/report").json()
    assert rep["mode"] == "mock" and rep["cached"] is False
    assert rep["output"]["per_listing"]
    assert c.post(f"/api/ai/comparisons/{comp['id']}/report").json()["cached"] is True
    lr = c.post(f"/api/ai/listings/{a['id']}/report").json()
    assert lr["output"]["unverified"] and lr["output"]["summary"]
    for p in lr["output"]["pros"] + lr["output"]["cons"]:
        assert set(p["evidence"]) <= set(lr["score"]["evidence"].keys()) | {"dealbreaker"}
    # 기록이 바뀌면 이전 리포트는 '오래됨'으로 표시
    c.put(f"/api/listings/{a['id']}/checks", json={"checks": [{"item_id": "wall_soundproof", "value": "good"}]})
    assert c.get(f"/api/ai/listings/{a['id']}/report").json()["stale"] is True

    # 10. 최종 선택 → 결정 이후 안내
    home = c.post(f"/api/listings/{b['id']}/decide", json={"move_in_date": "2026-12-20"}).json()
    assert home["listing"]["id"] == b["id"] and home["tasks"] and home["costs"]
    assert any(t["due_date"] == "2026-12-06" for t in home["tasks"])  # 입주 14일 전
    assert c.get(f"/api/listings/{b['id']}").json()["status"] == "selected"
    # 필수템: 옵션에 있는 냉장고·세탁기는 '이미 있음', 없는 것은 우선 추천
    items = {i["code"]: i for i in home["items"]}
    assert items["fridge"]["status"] == "have" and items["washer"]["status"] == "have"
    assert items["microwave"]["status"] == "todo" and items["microwave"]["priority"] == "high"
    assert items["door_lock"]["priority"] == "high"  # 늦은 귀가
    home = c.patch(f"/api/home/items/{items['kettle']['id']}", json={"status": "bought"}).json()
    assert next(i for i in home["items"] if i["code"] == "kettle")["status"] == "bought"
    home = c.post("/api/home/items", json={"name": "공유기", "group": "week1"}).json()
    assert any(i["name"] == "공유기" and i["source"] == "user" for i in home["items"])
    assert c.patch(f"/api/home/items/{items['kettle']['id']}", json={"status": "lost"}).status_code == 422
    assert c.get("/api/guide/essentials").json()["items"]
    assert any(t["title"].startswith("[계약 전]") for t in home["tasks"])
    home = c.patch("/api/home", json={"contract_rent": 420_000, "contract_deposit": 5_000_000}).json()
    assert [m["label"] for m in home["contract"]["mismatches"]] == ["월세"]
    task_id = home["tasks"][0]["id"]
    home = c.patch(f"/api/home/tasks/{task_id}", json={"done": True}).json()
    assert home["progress"]["done"] == 1
    home = c.post("/api/home/costs", json={"kind": "initial", "label": "커튼", "amount": 30_000}).json()
    assert home["cost_summary"]["initial_total"] == 5_000_000 + 30_000
    home = c.patch("/api/home", json={"move_in_date": "2026-12-30"}).json()
    assert any(t["due_date"] == "2026-12-16" for t in home["tasks"])
    # 다른 매물로 다시 결정하면 이전 선택은 후보로 돌아감
    c.post(f"/api/listings/{a['id']}/decide", json={})
    assert c.get(f"/api/listings/{b['id']}").json()["status"] == "candidate"
    assert c.delete("/api/home").status_code == 204
    assert c.get("/api/home").json() is None

    # 삭제
    assert c.delete(f"/api/listings/{s['id']}").status_code == 204
    assert c.get(f"/api/listings/{s['id']}").status_code == 404


def test_other_user_cannot_access():
    owner = client_for("owner@test.com")
    lid = owner.post("/api/listings", json=LISTING).json()["id"]
    other = client_for("other@test.com")
    assert other.get(f"/api/listings/{lid}").status_code == 404
    assert other.patch(f"/api/listings/{lid}", json={"nickname": "x"}).status_code == 404
    assert other.delete(f"/api/listings/{lid}").status_code == 404
    assert other.post("/api/comparisons", json={"listing_ids": [lid, lid + 999]}).status_code in (400, 404)
    assert TestClient(app).get("/api/listings").status_code == 401


def test_photo_upload_strips_exif():
    c = client_for("photo@test.com")
    lid = c.post("/api/listings", json=LISTING).json()["id"]
    img = Image.new("RGB", (40, 30), "green")
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (37.0, 33.0, 0.0)}  # GPSInfo(위치정보)
    exif[0x010F] = "TestCamera"
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    buf.seek(0)
    r = c.post(f"/api/listings/{lid}/photos", files={"file": ("a.jpg", buf, "image/jpeg")}, data={"item_id": "leak_mold"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    f = c.get(f"/api/photos/{pid}/file")
    assert f.status_code == 200
    saved = Image.open(io.BytesIO(f.content))
    assert len(saved.getexif()) == 0
    assert f.headers["content-type"] == "image/jpeg"
    # 무료 호스팅 디스크가 지워져도 남도록 DB에 저장 (업로드 폴더에 파일이 생기지 않음)
    from pathlib import Path

    from app.config import get_settings

    assert not (Path(get_settings().upload_dir) / r.json()["file_name"]).exists()
    # 투명 PNG도 JPEG로 저장
    png = io.BytesIO()
    Image.new("RGBA", (20, 20), (0, 0, 0, 0)).save(png, "PNG")
    png.seek(0)
    r2 = c.post(f"/api/listings/{lid}/photos", files={"file": ("b.png", png, "image/png")})
    assert r2.status_code == 201 and c.get(f"/api/photos/{r2.json()['id']}/file").headers["content-type"] == "image/jpeg"
    bad = c.post(f"/api/listings/{lid}/photos", files={"file": ("a.txt", io.BytesIO(b"hello"), "text/plain")})
    assert bad.status_code == 400
    assert c.delete(f"/api/photos/{pid}").status_code == 204


def test_openai_failure_falls_back(monkeypatch):
    """키가 잘못되었거나 네트워크가 막혀도 서비스가 멈추지 않고 '대체 응답'으로 표시되는지."""
    c = client_for("ai@test.com")
    lid = c.post("/api/listings", json=LISTING).json()["id"]
    s = get_settings()
    monkeypatch.setattr(s, "ai_mode", "openai")
    monkeypatch.setattr(s, "openai_api_key", "sk-invalid")
    monkeypatch.setattr(s, "openai_model", "test-model")
    monkeypatch.setattr(s, "openai_base_url", "http://127.0.0.1:9/v1")
    monkeypatch.setattr(s, "ai_timeout_seconds", 3)
    r = c.post(f"/api/ai/listings/{lid}/report").json()
    assert r["mode"] == "fallback" and r["error"]
    assert r["output"]["summary"]


def test_validator_drops_unsupported_claims():
    from app.services.ai_service import validate_listing_report

    score = {"evidence": {"road_noise": {}}, "dealbreaker_violations": [], "unverified": [{"item_id": "boiler"}]}
    out = validate_listing_report(
        {
            "summary": "요약",
            "pros": [{"text": "조용함", "evidence": ["road_noise"]}, {"text": "치안 좋음", "evidence": ["crime_rate"]}],
            "cons": [{"text": "근거 없음", "evidence": []}],
            "unverified": [{"item_id": "boiler", "why_it_matters": "x", "how_to_check": "y"}, {"item_id": "fake"}],
        },
        score,
    )
    assert [p["text"] for p in out["pros"]] == ["조용함"]
    assert out["cons"] == [] and out["dropped_claims"] == 2
    assert [u["item_id"] for u in out["unverified"]] == ["boiler"]


def test_unchecked_listing_score_is_provisional():
    """현장 체크 전 매물은 적합도가 '예상'으로 표시되고, 체크한 매물보다 순위가 뒤에 온다."""
    c = client_for("prov@test.com")
    a = c.post("/api/listings", json={**LISTING, "nickname": "체크 안 함"}).json()["id"]
    b = c.post("/api/listings", json={**LISTING, "nickname": "체크 함"}).json()["id"]

    s = c.get(f"/api/listings/{a}/score").json()
    assert s["fit_provisional"] is True
    summary = {x["id"]: x for x in c.get("/api/listings").json()}
    assert summary[a]["fit_provisional"] is True

    items = c.get("/api/checklist-items").json()
    status_item = next(i for i in items if i["input_type"] == "status")
    r = c.put(f"/api/listings/{b}/checks", json={"checks": [{"item_id": status_item["id"], "value": "bad"}]})
    assert r.status_code == 200, r.text
    sb = c.get(f"/api/listings/{b}/score").json()
    assert sb["fit_provisional"] is False

    ranked = c.post("/api/scores/preview", json={"listing_ids": [a, b]}).json()
    order = [x["listing_id"] for x in ranked["results"]]
    assert order.index(b) < order.index(a)
