# FIRST HOME 배포용 이미지: 프론트엔드를 빌드해서 FastAPI가 한 주소로 함께 제공합니다.
# 비밀값(API 키, DB 주소, JWT_SECRET)은 이미지에 넣지 않고 호스팅 서비스의 환경변수로 넣습니다.

# 1) 프론트엔드 빌드
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) 백엔드 + 빌드 결과
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    APP_ENV=production COOKIE_SECURE=true FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web /web/dist /app/frontend/dist
RUN useradd --create-home appuser && mkdir -p uploads && chown -R appuser /app
USER appuser
EXPOSE 8000
# 시작할 때: DB 테이블 최신화 → (SEED_DEMO=true면) 데모 계정 준비 → 서버 실행
CMD ["sh", "-c", "alembic upgrade head && if [ \"$SEED_DEMO\" = \"true\" ]; then python -m app.seed --demo; fi && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
