"""실거래가 API 키 점검 도구.

사용법 (backend 폴더에서):
  python -m app.molit_check            # 서울 구로구 오피스텔, 지난달 1회 호출
  python -m app.molit_check 11440 rh   # 지역코드·주택유형(offi|rh|sh) 지정
키 값은 화면에 출력하지 않습니다.
"""
import sys

import httpx

from .config import get_settings
from .services import molit


def main() -> None:
    s = get_settings()
    lawd = sys.argv[1] if len(sys.argv) > 1 else "11530"
    htype = sys.argv[2] if len(sys.argv) > 2 else "offi"
    print(f"MOLIT 모드: {s.effective_molit_mode} / 키 입력됨: {'예' if s.molit_api_key.strip() else '아니오'}")
    if not s.molit_api_key.strip():
        print("backend/.env 에 MOLIT_API_KEY=발급받은키 를 넣고 다시 실행하세요.")
        return
    ym = molit.recent_months(2)[1]
    spec = molit.HOUSE_TYPES[htype]
    key = s.molit_api_key.strip()
    if "%" in key:
        from urllib.parse import unquote
        key = unquote(key)
    url = f"{molit.BASE_URL}/{spec['service']}/{spec['op']}"
    print(f"호출: {spec['label']} / 지역 {lawd} / {ym}")
    try:
        res = httpx.get(url, params={"serviceKey": key, "LAWD_CD": lawd, "DEAL_YMD": ym, "pageNo": 1, "numOfRows": 10}, timeout=20)
    except httpx.HTTPError as e:
        print("연결 실패:", e)
        return
    print("HTTP 상태:", res.status_code)
    try:
        deals = molit.parse_xml(res.text)
    except molit.MolitError as e:
        print("오류:", e)
        print("응답 앞부분:", res.text[:300].replace(key, "***"))
        return
    print(f"성공! 받은 거래 {len(deals)}건 (최대 10건만 요청)")
    for d in deals[:3]:
        print(" ", d)
    if deals and all(d["area"] is None for d in deals):
        print("주의: 면적 항목을 찾지 못했습니다. 아래 원본 항목 이름을 알려 주세요.")
        print(res.text[:800].replace(key, "***"))


if __name__ == "__main__":
    main()
