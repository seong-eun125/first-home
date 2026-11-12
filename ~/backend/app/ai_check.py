"""OpenAI 키 점검 도구.

사용법 (backend 폴더, 가상환경 켠 상태)
  python -m app.ai_check            # 키 확인 + 사용할 모델 자동 선택 + 짧은 테스트 호출 (비용 아주 적음)
  python -m app.ai_check --models   # 이 키로 쓸 수 있는 모델 이름 목록 보기

OPENAI_MODEL은 비워 둬도 됩니다. 비어 있으면 서버가 이 키로 쓸 수 있는 가벼운 모델을 자동으로 고릅니다.
키 값은 화면에 출력하지 않습니다.
"""
from __future__ import annotations

import argparse
import sys

from .config import get_settings


def main() -> None:
    parser = argparse.ArgumentParser(description="OpenAI 키 점검")
    parser.add_argument("--models", action="store_true", help="사용 가능한 모델 목록")
    args = parser.parse_args()
    s = get_settings()

    if not s.openai_api_key.strip():
        sys.exit("✗ .env에 OPENAI_API_KEY가 없습니다.")
    print(f"• 키: 설정됨 (앞 4자리 {s.openai_api_key.strip()[:4]}…)")

    from .services import ai_service

    try:
        ids = sorted(m.id for m in ai_service._client().models.list())
    except Exception as e:  # noqa: BLE001
        sys.exit(f"✗ 이 키로 OpenAI에 접속하지 못했습니다 (키가 틀렸거나 만료됐을 수 있어요): {type(e).__name__}: {str(e)[:200]}")
    ranked = ai_service.rank_models(ids)

    if args.models:
        print(f"\n이 키로 조회되는 모델 {len(ids)}개 중 FIRST HOME에 맞는 후보 (추천 순):")
        for i in ranked:
            print("  -", i)
        return

    if s.openai_model.strip():
        candidates = [s.openai_model.strip()]
        print(f"• 모델: {candidates[0]} (.env의 OPENAI_MODEL)")
    else:
        candidates = ranked[:3]
        if not candidates:
            sys.exit("✗ 자동으로 고를 수 있는 모델이 없습니다. 'python -m app.ai_check --models' 결과를 확인해 주세요.")
        print(f"• 모델: OPENAI_MODEL이 비어 있어 자동 선택합니다 → 후보 {', '.join(candidates)}")

    for m in candidates:
        try:
            data, usage = ai_service.call_openai(
                {"test": "연결 확인", "instruction_for_test_only": "summary 필드에 '연결 성공'이라고만 쓰세요."},
                '다음 JSON 형식으로만 답하세요: {"summary": "..."}',
                model=m,
            )
        except ai_service.AIError as e:
            print(f"  ✗ {m}: {e}")
            continue
        print(f"✓ 호출 성공 ({m}): {data}")
        print(f"  사용 토큰: 입력 {usage.get('prompt_tokens')} / 출력 {usage.get('completion_tokens')}")
        if not s.openai_model.strip() and m != candidates[0]:
            print(f"  → 첫 후보가 막혀 있어요. .env에 OPENAI_MODEL={m} 을 넣어 두면 더 확실합니다.")
        print("이제 uvicorn을 다시 시작하면 AI 리포트와 AI 매물 판정이 실제 AI로 동작합니다.")
        return
    sys.exit("✗ 후보 모델 호출이 모두 실패했습니다. 위 오류 메시지를 확인해 주세요.")


if __name__ == "__main__":
    main()
