"""애플리케이션 설정.

모든 값은 환경변수(.env 파일)에서 읽습니다. API 키 같은 비밀값은
절대 코드에 직접 쓰지 말고 backend/.env 파일에만 넣으세요.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- 실행 환경 ---
    app_env: str = "development"  # 배포 서버에서는 production

    # --- DB ---
    database_url: str = (
        "mysql+pymysql://firsthome:firsthome_pw@127.0.0.1:3306/firsthome?charset=utf8mb4"
    )
    db_ssl: bool = False  # 클라우드 MySQL처럼 암호화 연결이 필요하면 true

    @field_validator("database_url")
    @classmethod
    def _pymysql_driver(cls, v: str) -> str:
        # 호스팅 서비스가 주는 mysql://... 주소를 그대로 붙여 넣어도 동작하도록
        if v.startswith("mysql://"):
            v = "mysql+pymysql://" + v[len("mysql://"):]
        # 클라우드 콘솔이 주는 주소에 붙은 ssl 관련 옵션은 지움 (암호화는 DB_SSL=true로 처리)
        if "?" in v:
            base, _, query = v.partition("?")
            kept = [p for p in query.split("&") if p and not p.lower().startswith("ssl")]
            v = base + ("?" + "&".join(kept) if kept else "")
        return v

    # --- 인증 ---
    jwt_secret: str = "change-me-in-.env"
    jwt_expire_hours: int = 72
    cookie_secure: bool = False  # HTTPS 배포 시 true

    # --- CORS / 프론트 주소 ---
    frontend_origin: str = "http://localhost:5173"
    # 배포 시 FastAPI가 프론트엔드 빌드(dist)를 함께 서빙 (폴더가 없으면 API만 동작)
    frontend_dist: str = str(BASE_DIR.parent / "frontend" / "dist")

    # --- 관리자 (만족도 설문 결과 화면) ---
    admin_emails: str = ""  # 쉼표로 구분. 예) me@example.com

    # --- 파일 업로드 ---
    upload_dir: str = str(BASE_DIR / "uploads")
    max_upload_mb: int = 8

    # --- AI ---
    # auto  : 키와 모델이 있으면 OpenAI 호출, 없으면 목업(규칙 기반) 응답
    # mock  : 항상 목업 응답 (API 비용 0)
    # openai: 항상 OpenAI 호출 (키·모델 필수, 실패 시 목업으로 대체하고 표시)
    ai_mode: str = "auto"
    openai_api_key: str = ""
    openai_model: str = ""  # 비워 두면 이 키로 쓸 수 있는 경량 모델을 서버가 자동으로 고릅니다
    openai_base_url: str = ""  # 비워 두면 OpenAI 기본 주소
    ai_max_output_tokens: int = 1500
    ai_reasoning_effort: str = ""  # 추론 모델일 때만: 예) low. 비워 두면 보내지 않음
    ai_temperature: str = ""  # 비워 두면 전송하지 않음(일부 모델은 미지원)
    ai_daily_limit_per_user: int = 30
    ai_daily_limit_total: int = 300
    ai_note_max_chars: int = 200
    ai_timeout_seconds: int = 90  # 캡처 3장 판정은 시간이 더 걸릴 수 있음

    # --- 국토교통부 실거래가 (공공데이터포털) ---
    # auto : 키가 있으면 실제 API 호출, 없으면 '예시 데이터'(화면에 예시라고 표시)
    # mock : 항상 예시 데이터 / live : 항상 실제 API (키 필수)
    molit_mode: str = "auto"
    molit_api_key: str = ""  # 공공데이터포털 '일반 인증키(Decoding)' 값
    molit_months: int = 6  # 최근 몇 개월 거래를 볼지 (호출 수 = 개월 수 × 1)
    molit_timeout_seconds: int = 15

    @property
    def effective_molit_mode(self) -> str:
        mode = self.molit_mode.strip().lower()
        if mode in ("mock", "live"):
            return mode
        return "live" if self.molit_api_key.strip() else "mock"

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def openai_ready(self) -> bool:
        # 키만 있으면 됩니다. 모델 이름이 없으면 ai_service.current_model()이 자동으로 고릅니다.
        return bool(self.openai_api_key.strip())

    @property
    def effective_ai_mode(self) -> str:
        mode = self.ai_mode.strip().lower()
        if mode == "mock":
            return "mock"
        if mode == "openai":
            return "openai"
        return "openai" if self.openai_ready else "mock"


@lru_cache
def get_settings() -> Settings:
    return Settings()
