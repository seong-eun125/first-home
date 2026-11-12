"""FIRST HOME API 서버 진입점.

실행: uvicorn app.main:app --reload --port 8000
API 문서: http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError

from .config import get_settings
from .database import SessionLocal
from .routers import ai, auth, home, listings, market, precheck, profile, scores, survey

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("firsthome")
settings = get_settings()

if settings.is_production and (settings.jwt_secret == "change-me-in-.env" or len(settings.jwt_secret) < 32):
    # 기본 비밀키로 배포하면 누구나 로그인 토큰을 위조할 수 있어 서버를 시작하지 않습니다.
    raise RuntimeError("배포 환경(APP_ENV=production)에서는 32자 이상의 JWT_SECRET을 반드시 설정하세요.")


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

for r in (
    auth.router,
    profile.router,
    listings.router,
    scores.router,
    ai.router,
    home.router,
    market.router,
    precheck.router,
    survey.router,
):
    app.include_router(r)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    return response


@app.get("/api/health", tags=["system"])
def health():
    """서버와 DB가 정상인지 확인합니다."""
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            count = db.execute(text("SELECT COUNT(*) FROM checklist_items")).scalar()
        return {"status": "ok", "db": "ok", "checklist_items": count, "ai_mode": settings.effective_ai_mode}
    except Exception as e:  # noqa: BLE001
        log.error("DB 연결 확인 실패: %s", str(e).splitlines()[0])
        if settings.is_production:  # 배포 환경에서는 DB 주소 등 내부 정보를 응답에 넣지 않음
            return {"status": "error", "db": "error"}
        return {"status": "error", "db": "error", "detail": str(e).splitlines()[0]}


# ---------------------------------------------------------------- 배포: 프론트엔드 함께 서빙
# frontend/dist 폴더(npm run build 결과)가 있으면 같은 주소에서 화면과 API를 함께 제공합니다.
# 같은 주소라서 로그인 쿠키·CORS 설정이 단순해집니다. 개발 중(Vite 5173)에는 영향이 없습니다.
DIST = Path(settings.frontend_dist)
if (DIST / "index.html").is_file():
    if (DIST / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
    _dist_root = DIST.resolve()
    _no_cache = {"Cache-Control": "no-cache"}

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(404, "API 경로를 찾을 수 없습니다.")
        target = (DIST / full_path).resolve()
        if full_path and target.is_file() and _dist_root in target.parents:
            # 서비스워커·manifest는 항상 최신본을 받도록
            headers = _no_cache if target.name in ("sw.js", "manifest.webmanifest") else None
            return FileResponse(target, headers=headers)
        return FileResponse(DIST / "index.html", headers=_no_cache)

    log.info("프론트엔드 빌드를 함께 서빙합니다: %s", DIST)
