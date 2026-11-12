"""국토교통부 전월세 실거래가 (공공데이터포털 오픈API) 연동.

- 키는 backend/.env 의 MOLIT_API_KEY 에만 둡니다. 프론트엔드로 절대 보내지 않습니다.
- 같은 (주택유형, 지역, 월) 응답은 DB(market_cache)에 저장해 다시 호출하지 않습니다.
- 키가 없으면 '예시 데이터'를 만들고, 응답에 is_sample=True 를 넣어 화면에 표시합니다.
- 시세 판정은 규칙(백분위)으로만 계산합니다. AI가 판단하지 않습니다.
"""
from __future__ import annotations

import json
import logging
import random
import re
import statistics
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import MarketCache

log = logging.getLogger("firsthome.molit")

BASE_URL = "https://apis.data.go.kr/1613000"
HOUSE_TYPES: dict[str, dict[str, str]] = {
    "offi": {"service": "RTMSDataSvcOffiRent", "op": "getRTMSDataSvcOffiRent", "label": "오피스텔"},
    "rh": {"service": "RTMSDataSvcRHRent", "op": "getRTMSDataSvcRHRent", "label": "연립·다세대(빌라)"},
    "sh": {"service": "RTMSDataSvcSHRent", "op": "getRTMSDataSvcSHRent", "label": "단독·다가구(원룸 건물)"},
}
SOURCE = "국토교통부 실거래가 공개 자료 (공공데이터포털)"
MAX_XML_BYTES = 5_000_000

# 응답 항목 이름이 바뀌어도 동작하도록 후보 이름을 여러 개 둡니다 (영문 신규 / 한글 구버전).
FIELDS = {
    "deposit": ("deposit", "보증금액", "보증금"),
    "rent": ("monthlyRent", "월세금액", "월세"),
    "area": ("excluUseAr", "전용면적", "totalFloorAr", "계약면적"),
    "dong": ("umdNm", "법정동"),
    "name": ("offiNm", "mhouseNm", "단지", "연립다세대"),
    "year": ("dealYear", "년"),
    "month": ("dealMonth", "월"),
    "day": ("dealDay", "일"),
    "floor": ("floor", "층"),
    "build_year": ("buildYear", "건축년도"),
    "contract_type": ("contractType", "계약구분"),
}


class MolitError(Exception):
    """사용자에게 그대로 보여줘도 되는 오류 메시지."""


_REGIONS_CACHE: list[dict] | None = None


def regions() -> list[dict]:
    global _REGIONS_CACHE
    if _REGIONS_CACHE is None:
        path = Path(__file__).resolve().parent.parent / "data" / "regions.json"
        _REGIONS_CACHE = json.loads(path.read_text(encoding="utf-8"))["regions"]
    return _REGIONS_CACHE


def region_name(code: str) -> str:
    for r in regions():
        if r["code"] == code:
            return r["name"]
    return f"지역코드 {code}"


def guess_dong(address: str | None) -> str | None:
    """주소에서 'OO동'을 찾아 기본값으로 씁니다 (예: '구로구 고척동 12-3' → 고척동)."""
    for tok in (address or "").replace(",", " ").split():
        if re.fullmatch(r"[가-힣]+\d*동", tok) and len(tok) >= 2:
            return tok
    return None


def recent_months(n: int, today: date | None = None) -> list[str]:
    d = (today or date.today()).replace(day=1)
    out = []
    for _ in range(max(1, min(n, 12))):
        out.append(d.strftime("%Y%m"))
        d = (d - timedelta(days=1)).replace(day=1)
    return out


# ---------------------------------------------------------------- 파싱
def _num(text: str | None) -> float | None:
    if text is None:
        return None
    t = text.replace(",", "").strip()
    if not t:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def _pick(el: ET.Element, key: str) -> str | None:
    for name in FIELDS[key]:
        child = el.find(name)
        if child is not None and child.text is not None and child.text.strip():
            return child.text.strip()
    return None


def parse_xml(xml_text: str) -> list[dict]:
    """API 응답 XML → 정규화된 거래 목록. 금액 단위는 만원."""
    if len(xml_text.encode("utf-8")) > MAX_XML_BYTES:
        raise MolitError("응답이 너무 큽니다.")
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        raise MolitError("실거래가 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.") from e

    # 게이트웨이 오류 형식: <OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>...
    auth_msg = root.findtext(".//returnAuthMsg")
    if auth_msg:
        raise MolitError(_explain_error(auth_msg))
    code = (root.findtext(".//header/resultCode") or "").strip()
    if code and code not in ("00", "000"):
        msg = (root.findtext(".//header/resultMsg") or "").strip()
        raise MolitError(_explain_error(f"{code} {msg}"))

    deals = []
    for it in root.iter("item"):
        deposit = _num(_pick(it, "deposit"))
        if deposit is None:
            continue
        rent = _num(_pick(it, "rent")) or 0
        y, m, d = _pick(it, "year"), _pick(it, "month"), _pick(it, "day")
        try:
            deal_date = date(int(y), int(m), int(d)).isoformat() if y and m and d else None
        except ValueError:
            deal_date = None
        area = _num(_pick(it, "area"))
        floor = _num(_pick(it, "floor"))
        build = _num(_pick(it, "build_year"))
        deals.append(
            {
                "date": deal_date,
                "dong": _pick(it, "dong") or "",
                "name": _pick(it, "name") or "",
                "area": round(area, 1) if area is not None else None,
                "floor": int(floor) if floor is not None else None,
                "deposit": int(deposit),
                "rent": int(rent),
                "contract_type": _pick(it, "contract_type") or "",
                "build_year": int(build) if build else None,
            }
        )
    return deals


def _explain_error(raw: str) -> str:
    r = raw.upper()
    if "SERVICE_KEY_IS_NOT_REGISTERED" in r or "SERVICE KEY IS NOT REGISTERED" in r or "30" == r.strip()[:2]:
        return (
            "인증키가 아직 등록되지 않았습니다. 활용신청 직후에는 실제로 동작하기까지 시간이 걸릴 수 있어요. "
            "키를 '일반 인증키(Decoding)'로 넣었는지도 확인해 주세요."
        )
    if "LIMITED" in r or "22" == r.strip()[:2]:
        return "오늘 호출 한도를 넘었습니다. 내일 다시 시도하거나 저장된 데이터를 이용해 주세요."
    if "NO_OPENAPI_SERVICE" in r or "PERMISSION" in r or "20" == r.strip()[:2]:
        return "이 API에 대한 활용신청이 필요합니다. 공공데이터포털에서 해당 주택 유형 API를 활용신청해 주세요."
    return f"실거래가 API 오류: {raw.strip()[:120]}"


# ---------------------------------------------------------------- 호출 + 캐시
def _ttl_for(ym: str) -> timedelta:
    # 최근 2개월은 신고가 계속 들어오므로 12시간, 그 이전 달은 30일 동안 재사용
    return timedelta(hours=12) if ym in recent_months(2) else timedelta(days=30)


def _fetch_live(house_type: str, lawd_cd: str, ym: str) -> list[dict]:
    s = get_settings()
    key = s.molit_api_key.strip()
    if "%" in key:  # 'Encoding' 키를 넣은 경우 원래 값으로 되돌려 이중 인코딩을 막습니다
        key = unquote(key)
    spec = HOUSE_TYPES[house_type]
    url = f"{BASE_URL}/{spec['service']}/{spec['op']}"
    params = {"serviceKey": key, "LAWD_CD": lawd_cd, "DEAL_YMD": ym, "pageNo": 1, "numOfRows": 1000}
    try:
        res = httpx.get(url, params=params, timeout=s.molit_timeout_seconds)
    except httpx.HTTPError as e:
        raise MolitError("공공데이터포털에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.") from e
    if res.status_code != 200:
        # 게이트웨이는 오류도 XML로 주는 경우가 많아 먼저 해석해 봅니다
        try:
            parse_xml(res.text)
        except MolitError:
            raise
        raise MolitError(f"실거래가 API가 오류를 반환했습니다 (HTTP {res.status_code}).")
    return parse_xml(res.text)


def get_month(db: Session, house_type: str, lawd_cd: str, ym: str) -> tuple[list[dict], bool]:
    """(거래 목록, 캐시 사용 여부)"""
    key = f"{house_type}:{lawd_cd}:{ym}"
    row = db.scalar(select(MarketCache).where(MarketCache.cache_key == key))
    if row and datetime.now() - row.fetched_at < _ttl_for(ym):
        return row.payload, True
    deals = _fetch_live(house_type, lawd_cd, ym)
    if row:
        row.payload = deals
        row.fetched_at = datetime.now()
    else:
        db.add(MarketCache(cache_key=key, payload=deals, fetched_at=datetime.now()))
    try:
        db.commit()
    except IntegrityError:  # 동시에 같은 키를 저장한 경우
        db.rollback()
    return deals, False


def sample_month(house_type: str, lawd_cd: str, ym: str) -> list[dict]:
    """키가 없을 때 쓰는 예시 데이터 (실제 거래 아님, 화면에 '예시'로 표시)."""
    rng = random.Random(f"{house_type}{lawd_cd}{ym}")
    y, m = int(ym[:4]), int(ym[4:])
    base_rent = {"offi": 70, "rh": 55, "sh": 50}[house_type]
    dongs = ["가동", "나동", "다동"]
    today = date.today()
    last_day = today.day if (y, m) == (today.year, today.month) else 28
    deals = []
    for _ in range(rng.randint(18, 30)):
        area = round(rng.uniform(14, 45), 1)
        if rng.random() < 0.15:  # 전세
            deposit, rent = rng.choice([12000, 15000, 18000, 21000, 25000]), 0
        else:
            deposit = rng.choice([300, 500, 500, 1000, 1000, 2000, 3000])
            rent = max(25, int(base_rent + (area - 25) * 1.2 - (deposit / 1000) * 3 + rng.gauss(0, 7)))
        deals.append(
            {
                "date": date(y, m, rng.randint(1, max(1, last_day))).isoformat(),
                "dong": f"예시{rng.choice(dongs)}",
                "name": "예시 건물" if house_type != "sh" else "",
                "area": area,
                "floor": rng.randint(1, 12),
                "deposit": deposit,
                "rent": rent,
                "contract_type": rng.choice(["신규", "신규", "갱신"]),
                "build_year": rng.randint(1995, 2022),
            }
        )
    return deals


# ---------------------------------------------------------------- 통계·비교 (규칙 기반)
def _pct(values: list[int], q: float) -> int:
    v = sorted(values)
    if not v:
        return 0
    idx = min(len(v) - 1, max(0, round(q * (len(v) - 1))))
    return v[idx]


def analyze(
    deals: list[dict],
    *,
    dong: str | None,
    area_m2: float | None,
    my_deposit: int | None,  # 만원
    my_rent: int | None,  # 만원
) -> dict:
    notes: list[str] = []
    pool = deals

    # 1) 동 필터: 같은 동 거래가 5건 이상일 때만 좁힙니다
    scope = "구 전체"
    if dong:
        same = [d for d in pool if d["dong"] == dong]
        if len(same) >= 5:
            pool, scope = same, dong
        else:
            notes.append(f"{dong} 거래가 {len(same)}건뿐이라 구 전체 거래로 비교했어요.")

    # 2) 면적 필터: 내 면적 ±30%, 없으면 원룸 기준 40㎡ 이하
    if area_m2:
        lo, hi = area_m2 * 0.7, area_m2 * 1.3
        area_label = f"전용 {lo:.0f}~{hi:.0f}㎡"
    else:
        lo, hi = 0, 40
        area_label = "전용 40㎡ 이하 (원룸 기준)"
    by_area = [d for d in pool if d["area"] is None or lo <= d["area"] <= hi]
    if len(by_area) >= 5:
        pool = by_area
    else:
        area_label = "면적 무관"
        notes.append("비슷한 면적 거래가 적어 면적 조건 없이 비교했어요.")

    wolse = [d for d in pool if d["rent"] > 0]
    jeonse = [d for d in pool if d["rent"] == 0]

    result: dict = {
        "scope": scope,
        "area_label": area_label,
        "total": len(pool),
        "wolse": None,
        "jeonse": None,
        "compare": None,
        "notes": notes,
    }
    if wolse:
        rents = [d["rent"] for d in wolse]
        deps = [d["deposit"] for d in wolse]
        result["wolse"] = {
            "count": len(wolse),
            "median_rent": int(statistics.median(rents)),
            "p25_rent": _pct(rents, 0.25),
            "p75_rent": _pct(rents, 0.75),
            "median_deposit": int(statistics.median(deps)),
        }
    if jeonse:
        result["jeonse"] = {"count": len(jeonse), "median_deposit": int(statistics.median([d["deposit"] for d in jeonse]))}

    # 3) 내 조건 비교: 월세 매물이면, 보증금이 비슷한(0.5~2배) 거래끼리 월세 백분위
    if my_rent and my_rent > 0 and wolse:
        group, basis = wolse, "월세 거래 전체"
        if my_deposit is not None:
            lo_d, hi_d = max(0, my_deposit * 0.5), max(my_deposit * 2, 100)
            similar = [d for d in wolse if lo_d <= d["deposit"] <= hi_d]
            if len(similar) >= 5:
                group, basis = similar, f"보증금 {int(lo_d):,}~{int(hi_d):,}만원 거래"
        rents = [d["rent"] for d in group]
        below = sum(1 for r in rents if r < my_rent)
        equal = sum(1 for r in rents if r == my_rent)
        pct = round((below + equal / 2) / len(rents) * 100)
        med = int(statistics.median(rents))
        if pct <= 35:
            level, label = "low", "낮은 편"
        elif pct >= 65:
            level, label = "high", "높은 편"
        else:
            level, label = "mid", "비슷한 편"
        result["compare"] = {
            "basis": basis,
            "count": len(rents),
            "my_rent": my_rent,
            "median_rent": med,
            "diff": my_rent - med,
            "percentile": pct,
            "level": level,
            "label": label,
            "few": len(rents) < 10,
        }
        if len(rents) < 10:
            notes.append("비교 거래가 10건 미만이라 참고만 해 주세요.")
    elif my_rent == 0 and my_deposit and jeonse:
        med = result["jeonse"]["median_deposit"]
        result["compare"] = {
            "basis": "전세 거래",
            "count": len(jeonse),
            "my_deposit": my_deposit,
            "median_deposit": med,
            "diff": my_deposit - med,
            "percentile": None,
            "level": "high" if my_deposit > med * 1.15 else "low" if my_deposit < med * 0.85 else "mid",
            "label": "높은 편" if my_deposit > med * 1.15 else "낮은 편" if my_deposit < med * 0.85 else "비슷한 편",
            "few": len(jeonse) < 10,
        }

    recent = sorted(pool, key=lambda d: d["date"] or "", reverse=True)[:20]
    result["recent"] = recent
    return result


def market_report(
    db: Session,
    *,
    lawd_cd: str,
    house_type: str,
    dong: str | None = None,
    area_m2: float | None = None,
    my_deposit_won: int | None = None,
    my_rent_won: int | None = None,
) -> dict:
    s = get_settings()
    if house_type not in HOUSE_TYPES:
        raise MolitError("주택 유형이 올바르지 않습니다.")
    if not re.fullmatch(r"\d{5}", lawd_cd or ""):
        raise MolitError("지역 코드는 숫자 5자리여야 합니다.")
    mode = s.effective_molit_mode
    if mode == "live" and not s.molit_api_key.strip():
        raise MolitError("MOLIT_MODE=live 이지만 MOLIT_API_KEY가 비어 있습니다.")

    months = recent_months(s.molit_months)
    deals: list[dict] = []
    failed: list[str] = []
    cached = 0
    last_error = ""
    for ym in months:
        if mode == "mock":
            deals += sample_month(house_type, lawd_cd, ym)
            continue
        try:
            month_deals, hit = get_month(db, house_type, lawd_cd, ym)
            deals += month_deals
            cached += int(hit)
        except MolitError as e:
            failed.append(ym)
            last_error = str(e)
            log.warning("실거래가 조회 실패 %s %s %s: %s", house_type, lawd_cd, ym, e)
    if mode == "live" and len(failed) == len(months):
        raise MolitError(last_error or "실거래가를 불러오지 못했습니다.")

    to_manwon = lambda won: None if won is None else round(won / 10000)  # noqa: E731
    report = analyze(
        deals,
        dong=dong or None,
        area_m2=area_m2,
        my_deposit=to_manwon(my_deposit_won),
        my_rent=to_manwon(my_rent_won),
    )
    if failed:
        report["notes"].append(f"{len(failed)}개월은 불러오지 못해 제외했어요: {', '.join(failed)}")
    report.update(
        {
            "is_sample": mode == "mock",
            "source": "예시 데이터 (MOLIT_API_KEY 미설정 · 실제 거래 아님)" if mode == "mock" else SOURCE,
            "region": {"code": lawd_cd, "name": region_name(lawd_cd)},
            "house_type": {"code": house_type, "label": HOUSE_TYPES[house_type]["label"]},
            "dong": dong or None,
            "months": [f"{m[:4]}.{m[4:]}" for m in reversed(months)],
            "cached_months": cached,
            "unit": "만원",
            "disclaimer": "신고된 거래만 포함되며 최근 거래는 신고 지연으로 빠져 있을 수 있어요. 개별 집의 상태·옵션·관리비는 반영되지 않습니다.",
        }
    )
    return report
