"""DB 연결 점검 도구 (비밀번호는 출력하지 않음).

사용법 (backend 폴더, 가상환경 켠 상태)
  python -m app.db_check
  DATABASE_URL='mysql://사용자:비밀번호@호스트:4000/test' DB_SSL=true python -m app.db_check   # 클라우드 DB 점검
"""
import sys

from sqlalchemy import text
from sqlalchemy.engine import make_url

from .config import get_settings


def main() -> None:
    s = get_settings()
    url = make_url(s.database_url)
    print(f"• 접속 대상: {url.username}@{url.host}:{url.port or 3306}/{url.database}  (SSL: {'켜짐' if s.db_ssl else '꺼짐'})")
    from .database import engine

    try:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT VERSION()")).scalar()
            tables = conn.execute(text("SHOW TABLES")).fetchall()
    except Exception as e:  # noqa: BLE001
        msg = str(e).splitlines()[0]
        print(f"✗ 연결 실패: {msg}")
        if "SSL" in msg or "secure transport" in msg.lower() or "insecure" in msg.lower():
            print("  → 클라우드 DB는 DB_SSL=true가 필요해요.")
        elif "Access denied" in msg:
            print("  → 사용자 이름(예: xxxx.root)이나 비밀번호를 다시 확인해 주세요.")
        sys.exit(1)
    print(f"✓ 연결 성공 · 서버 버전: {version}")
    print(f"• 테이블 {len(tables)}개" + (" (아직 비어 있음 → alembic upgrade head 를 실행하세요)" if not tables else ""))


if __name__ == "__main__":
    main()
