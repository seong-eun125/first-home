from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()


def db_connect_args() -> dict:
    """클라우드 MySQL(SSL 필수)일 때 인증서 검증을 켠 암호화 연결."""
    if not settings.db_ssl:
        return {}
    import certifi

    return {"ssl": {"ca": certifi.where()}}


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # 끊어진 연결 자동 감지
    pool_recycle=280,  # 클라우드 DB의 유휴 연결 끊김 대비
    connect_args=db_connect_args(),
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
