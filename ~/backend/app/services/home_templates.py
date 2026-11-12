"""결정 이후 단계(계약·이사·입주·정착) 템플릿. AI 없이 규칙으로 만듭니다.

법률·행정 관련 항목은 '확인 권장' 수준의 안내이며, 구체적인 절차와 기한은
공식 안내(정부24, 인터넷등기소 등)에서 확인하도록 안내합니다.
"""
from __future__ import annotations

from datetime import date, timedelta

from .ai_mock import iga

PHASES = {
    "contract": "계약 전·계약 당일",
    "moving": "이사 준비",
    "movein": "입주",
    "settle": "생활 정착",
}

TASK_TEMPLATE = [
    # (phase, 제목, 상세, 입주일 기준 일수)
    # 계약 단계는 국토교통부 '안심계약 3·3·3법칙'(계약 전·계약 시·계약 후 각 3가지)을 따릅니다.
    ("contract", "[계약 전] 주변 시세 충분히 비교", "국토교통부 실거래가 공개시스템, 안심전세 앱 등에서 비슷한 집의 시세와 비교하세요. 시세보다 지나치게 싸거나 보증금이 매매가에 가까우면 주의하세요.", -21),
    ("contract", "[계약 전] 등기부등본으로 권리관계 확인", "인터넷등기소에서 발급해 소유자(갑구)와 근저당 등 빚(을구), 압류·신탁 여부를 확인하세요. 판단이 어렵다면 전문가에게 문의하세요.", -21),
    ("contract", "[계약 전] 보증보험 가입 가능 여부 문의", "전세보증금 반환보증에 가입할 수 있는 집인지 보증기관(HUG 등)에 미리 문의하세요.", -21),
    ("contract", "[계약 시] 중개사무소 정상 영업 여부 확인", "브이월드 등에서 등록된 중개사무소인지 확인하세요.", -14),
    ("contract", "[계약 시] 계약 상대방 = 등기부상 소유자 확인", "신분증과 등기부를 대조하세요. 대리인이면 위임장·인감증명서를 확인하고, 보증금은 소유자 명의 계좌로 보내세요.", -14),
    ("contract", "[계약 시] 표준계약서 사용·특약 확인", "주택임대차표준계약서 등 상세한 계약서를 쓰고, 옵션 고장 시 수리 책임 같은 특약을 확인하세요. 아래 '계약 내용 대조'로 금액도 확인하세요.", -14),
    ("contract", "계약 내용을 믿을 만한 사람과 함께 확인", "부모님이나 계약 경험이 있는 지인과 함께 확인하면 실수를 줄일 수 있어요.", -14),
    ("contract", "[계약 후] 임대차계약 신고 또는 확정일자", "계약 후 바로 진행하세요. 절차는 정부24·주민센터 등 공식 안내를 확인하세요.", -13),
    ("contract", "[계약 후] 잔금 전 등기부 다시 확인", "잔금을 보내기 직전에 등기부를 다시 떼서 계약 이후 권리관계가 바뀌지 않았는지 확인하세요.", -1),
    ("moving", "이사 날짜 확정 및 이사 방법 예약", "용달·이삿짐센터 등 이사 방법을 정하고 예약하세요.", -10),
    ("moving", "인터넷 설치 신청", "관리비에 포함되지 않았다면 입주일에 맞춰 설치를 신청하세요.", -7),
    ("moving", "필요한 가구·생활용품 목록 정리", None, -7),
    ("moving", "도시가스 사용 시 개통 신청", "가스를 쓰는 집이라면 입주일에 맞춰 개통을 신청하세요.", -3),
    ("moving", "짐 싸기", None, -2),
    ("movein", "[계약 후] 이사한 날 바로 전입신고", "이사 당일에 전입신고를 하세요. 절차는 정부24·주민센터 등 공식 안내를 확인하세요.", 0),
    ("movein", "입주 직후 집 상태 사진 남기기", "벽·바닥·옵션 가구 상태를 사진으로 남겨 두면 퇴실할 때 분쟁을 줄일 수 있어요.", 0),
    ("movein", "공과금(전기·가스·수도) 납부 방법 확인", None, 3),
    ("settle", "분리수거 요일·장소 확인", None, 3),
    ("settle", "가까운 병원·약국·세탁방 위치 확인", None, 7),
    ("settle", "첫 달 지출 기록 시작", "예산 탭에서 월 고정비와 실제 지출을 비교해 보세요.", 30),
]

BASIC_ITEMS = ["냉장고", "세탁기", "에어컨", "침대", "책상", "옷장", "전자레인지"]


def build_tasks(move_in: date | None, options: list[str]) -> list[dict]:
    missing = [i for i in BASIC_ITEMS if not any(i in (o or "") for o in options)]
    out = []
    for order, (phase, title, detail, offset) in enumerate(TASK_TEMPLATE):
        if title.startswith("필요한 가구"):
            have = ", ".join(options) if options else "기록 없음"
            detail = f"옵션에 있는 것: {have}. 옵션에 없는 기본 가전·가구: {', '.join(missing) or '없음'}."
        out.append(
            {
                "phase": phase,
                "title": title,
                "detail": detail,
                "due_date": (move_in + timedelta(days=offset)) if move_in else None,
                "sort_order": order,
            }
        )
    return out


def default_costs(listing) -> list[dict]:
    return [
        {"kind": "initial", "label": "보증금", "amount": listing.deposit, "source": "listing", "refundable": True},
        {"kind": "initial", "label": "중개보수", "amount": 0, "source": "user", "refundable": False},
        {"kind": "initial", "label": "이사 비용", "amount": 0, "source": "user", "refundable": False},
        {"kind": "initial", "label": "가구·생활용품 구매", "amount": 0, "source": "user", "refundable": False},
        {"kind": "monthly", "label": "월세", "amount": listing.monthly_rent, "source": "listing", "refundable": False},
        {"kind": "monthly", "label": "관리비", "amount": listing.maintenance_fee, "source": "listing", "refundable": False},
        {"kind": "monthly", "label": "공과금(예상)", "amount": 0, "source": "user", "refundable": False},
        {"kind": "monthly", "label": "통신비", "amount": 0, "source": "user", "refundable": False},
        {"kind": "monthly", "label": "식비", "amount": 0, "source": "user", "refundable": False},
    ]


def settle_tips(checks: dict[str, str]) -> list[dict]:
    """현장 체크 기록을 바탕으로 한 생활 정착 안내(규칙 기반)."""
    tips = []

    def bad(i):
        return checks.get(i) in ("bad", "normal")

    if checks.get("bath_window") == "no":
        tips.append({"item_id": "bath_window", "title": "화장실 환기", "text": "화장실 창문이 없다고 기록했어요. 샤워 후 환풍기를 충분히 켜 두면 습기와 곰팡이를 줄이는 데 도움이 됩니다."})
    if bad("leak_mold"):
        tips.append({"item_id": "leak_mold", "title": "곰팡이 관리", "text": "곰팡이·누수 흔적이 기록되었어요. 자주 환기하고 제습제를 두는 것을 고려해 보세요. 누수가 보이면 임대인에게 수리를 요청하세요."})
    if bad("pest_signs"):
        tips.append({"item_id": "pest_signs", "title": "해충 대비", "text": "해충 흔적이 기록되었어요. 입주 전 방역이나 배수구·틈새 막기를 고려해 보세요."})
    if bad("road_noise") or bad("wall_soundproof"):
        tips.append({"item_id": "road_noise", "title": "소음 줄이기", "text": "소음이 기록되었어요. 두꺼운 커튼, 문풍지, 러그 등이 체감 소음을 줄이는 데 도움이 될 수 있어요."})
    if bad("front_view"):
        tips.append({"item_id": "front_view", "title": "사생활 보호", "text": "앞 건물 시선이 신경 쓰인다고 기록했어요. 블라인드나 시트지를 미리 준비해 두세요."})
    if checks.get("sunlight") == "bad":
        tips.append({"item_id": "sunlight", "title": "습기 관리", "text": "채광이 부족하다고 기록했어요. 빨래 건조와 제습에 신경 쓰면 좋아요."})
    if checks.get("parcel") == "none":
        tips.append({"item_id": "parcel", "title": "택배 받기", "text": "택배 보관 장소가 없다고 기록했어요. 무인 택배함이나 편의점 픽업 서비스를 알아 두세요."})
    if bad("boiler"):
        tips.append({"item_id": "boiler", "title": "보일러 점검", "text": "보일러 상태가 아쉽다고 기록했어요. 겨울 전에 작동을 확인하고 문제가 있으면 임대인에게 알리세요."})
    tips.append({"item_id": None, "title": "비상 연락처 정리", "text": "임대인·관리인 연락처와 수리 요청 방법을 휴대폰에 저장해 두세요."})
    tips.append({"item_id": None, "title": "분리수거 규칙", "text": "건물의 분리수거 요일과 장소를 확인하고, 지역 배출 규칙도 함께 확인하세요."})
    return tips


# ---------------------------------------------------------------- 자취 필수템
ITEM_GROUPS = {
    "day1": "입주 첫날",
    "week1": "첫 주 생활",
    "safety": "안전",
    "nice": "있으면 좋아요",
}

# (code, group, 이름, 기본 설명, 이 아이템을 대체하는 옵션 키워드, 조건이 있을 때만 추천)
ESSENTIALS = [
    ("towel_bath", "day1", "수건·샤워용품", "입주 첫날 바로 필요해요.", None, False),
    ("tissue", "day1", "휴지·물티슈", "가장 먼저 떨어지는 소모품이에요.", None, False),
    ("bedding", "day1", "이불·베개", "첫날 밤부터 필요해요.", None, False),
    ("mattress", "day1", "매트리스", "침대 옵션이 없다면 첫날 잘 곳부터 준비하세요.", "침대", False),
    ("trash_bags", "day1", "종량제·분리수거 봉투", "종량제 봉투는 지역마다 달라 주소지 기준으로 사야 해요.", None, False),
    ("cleaning", "day1", "청소 도구 (밀대·청소포·걸레)", "입주 청소용이에요.", None, False),
    ("kitchen_basic", "day1", "고무장갑·주방세제·수세미", "첫 설거지부터 필요해요.", None, False),
    ("multitap", "day1", "멀티탭", "콘센트 위치가 가구 배치와 맞지 않는 경우가 많아요.", None, False),
    ("slippers", "day1", "실내·욕실 슬리퍼", "", None, False),
    ("fridge", "week1", "냉장고", "", "냉장고", False),
    ("washer", "week1", "세탁기 (또는 코인세탁방 이용)", "", "세탁기", False),
    ("microwave", "week1", "전자레인지", "간편식을 데우기 좋아요.", "전자레인지", False),
    ("kettle", "week1", "전기포트", "", None, False),
    ("cookware", "week1", "프라이팬·냄비", "", None, False),
    ("dishes", "week1", "식기·수저·컵", "", None, False),
    ("laundry_rack", "week1", "빨래건조대", "", None, False),
    ("detergent", "week1", "세탁 세제·섬유유연제", "", None, False),
    ("storage", "week1", "수납함·행거", "", "옷장", False),
    ("desk_chair", "week1", "책상·의자", "", "책상", False),
    ("toolkit", "week1", "드라이버·줄자 공구 세트", "가구 조립·간단한 수리에 쓰여요.", None, False),
    ("first_aid", "week1", "상비약·구급함", "혼자 아플 때를 대비해요.", None, False),
    ("extinguisher", "safety", "소화기", "화재 초기 대응용이에요. 건물에 비치된 소화기 위치도 확인해 두세요.", None, False),
    ("door_lock", "safety", "현관 보조 잠금장치", "혼자 사는 집의 기본 안전장치예요.", None, False),
    ("flashlight", "safety", "손전등", "정전에 대비해요.", None, False),
    ("blackout", "nice", "암막·두꺼운 커튼", "", None, False),
    ("dehumidifier", "nice", "제습제·곰팡이 제거제", "", None, True),
    ("pest_control", "nice", "해충 퇴치제·배수구 트랩", "", None, True),
    ("screen_tape", "nice", "방충망 보수 테이프", "", None, True),
    ("earplugs", "nice", "귀마개·화이트노이즈", "", None, True),
    ("sensor_light", "nice", "현관 센서등", "", None, True),
    ("circulator", "nice", "서큘레이터", "환기와 냉난방 효율에 도움이 돼요.", None, False),
    ("mirror", "nice", "전신 거울", "", None, False),
]


def _bad(checks: dict[str, str], item: str) -> bool:
    return checks.get(item) in ("bad", "normal")


def build_items(options: list[str], checks: dict[str, str], answers: dict) -> list[dict]:
    """옵션에 있는 것은 '이미 있음', 내 체크 기록·생활 패턴과 관련된 것은 '우선'으로 추천."""
    opts = " ".join(o or "" for o in options)
    triggers: dict[str, str] = {}

    outlets = checks.get("outlets")
    if outlets and outlets.isdigit() and int(outlets) <= 2:
        triggers["multitap"] = f"콘센트를 {outlets}개로 기록했어요. 넉넉한 멀티탭을 준비하세요."
    if answers.get("cooking") == "often":
        triggers["cookware"] = "요리를 자주 한다고 답했어요."
    if answers.get("work_from_home"):
        triggers["desk_chair"] = "집에서 공부·재택을 자주 한다고 답했어요."
    if checks.get("balcony") == "no":
        triggers["laundry_rack"] = "베란다가 없다고 기록했어요. 실내용 건조대를 고르세요."
    if checks.get("entrance_security") in ("none", "cctv_only"):
        triggers["door_lock"] = "공동현관 도어락이 없다고 기록했어요."
    elif answers.get("return_time") == "late":
        triggers["door_lock"] = "밤늦게 귀가하는 일이 잦다고 답했어요."
    if answers.get("return_time") == "late":
        triggers["sensor_light"] = "밤늦게 귀가하는 일이 잦다고 답했어요."
    if _bad(checks, "front_view"):
        triggers["blackout"] = "앞 건물 시선이 신경 쓰인다고 기록했어요."
    elif _bad(checks, "road_noise") or _bad(checks, "wall_soundproof"):
        triggers["blackout"] = "소음이 기록되었어요. 두꺼운 커튼이 체감 소음을 줄이는 데 도움이 될 수 있어요."
    damp = []
    if checks.get("bath_window") == "no":
        damp.append("화장실 창문 없음")
    if checks.get("sunlight") == "bad":
        damp.append("채광 부족")
    if _bad(checks, "leak_mold"):
        damp.append("곰팡이 흔적")
    if damp:
        triggers["dehumidifier"] = f"습기가 생기기 쉬운 조건이 기록됐어요: {', '.join(damp)}."
    if _bad(checks, "pest_signs"):
        triggers["pest_control"] = "해충 흔적이 기록되었어요."
    if _bad(checks, "screens_bars"):
        triggers["screen_tape"] = "방충망 상태가 아쉽다고 기록했어요."
    if answers.get("noise_sensitivity") == "high" and (_bad(checks, "road_noise") or _bad(checks, "wall_soundproof")):
        triggers["earplugs"] = "잠귀가 예민하고 소음이 기록되었어요."

    out = []
    for order, (code, group, name, desc, option_kw, only_if) in enumerate(ESSENTIALS):
        if only_if and code not in triggers:
            continue
        status, priority, reason = "todo", "normal", desc or None
        if option_kw and option_kw in opts:
            status = "have"
            reason = f"옵션에 {iga(option_kw)} 있어요." if option_kw != "침대" else "옵션에 침대가 있어요. 매트리스 위생 상태는 확인하세요."
        elif option_kw:
            priority = "high"
            reason = f"옵션에 {iga(option_kw)} 없어요." + (" 주변 세탁방을 이용할지도 정해 보세요." if code == "washer" else "")
        if code in triggers and status != "have":
            priority = "high"
            reason = triggers[code]
        out.append({"code": code, "group": group, "name": name, "reason": reason, "priority": priority, "status": status, "sort_order": order})
    return out
