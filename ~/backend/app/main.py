"""FIRST HOME API 서버 진입점.

실행: uvicorn app.main:app --reload --port 8000
API 문서: http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

from .config import get_settings
from .database import SessionLocal
from .routers import ai, auth, home, listings, market, precheck, profile, scores

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("firsthome")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버가 켜질 때 체크 항목 마스터를 최신 상태로 맞춥니다(여러 번 실행해도 안전).
    from .seed import sync_checklist

    try:
        with SessionLocal() as db:
            sync_checklist(db)
        log.info(
            "DB 연결 확인, 체크 항목 동기화 완료 (AI 모드: %s, 실거래가 모드: %s)",
            settings.effective_ai_mode,
            settings.effective_molit_mode,
        )
    except (OperationalError, ProgrammingError) as e:
        log.error(
            "DB 준비가 안 되었습니다. MySQL 실행 여부, .env의 DATABASE_URL, "
            "'alembic upgrade head' 실행 여부를 확인하세요. 원인: %s",
            str(e).splitlines()[0],
        )
    yield


app = FastAPI(title="FIRST HOME API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, profile.router, listings.router, scores.router, ai.router, home.router, market.router, precheck.router):
    app.include_router(r)


@app.get("/api/health", tags=["system"])
def health():
    """서버와 DB가 정상인지 확인합니다."""
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            count = db.execute(text("SELECT COUNT(*) FROM checklist_items")).scalar()
        return {"status": "ok", "db": "ok", "checklist_items": count, "ai_mode": settings.effective_ai_mode}
    except Exception as e:  # noqa: BLE001
        return {"status": "error", "db": "error", "detail": str(e).splitlines()[0]}
