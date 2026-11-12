"""AI 매물 판정 API: 링크·캡처·광고 글 → 내 조건 기준 판정."""
import copy

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..security import get_current_user
from ..services import ai_service
from ..services import precheck as pc
from ..services.ai_input import user_context
from ..services.context import get_profile, get_weights

router = APIRouter(prefix="/api/precheck", tags=["precheck"])


@router.post("")
async def run_precheck(
    url: str | None = Form(default=None, max_length=1000),
    text: str | None = Form(default=None, max_length=8000),
    images: list[UploadFile] = File(default=[]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = (url or "").strip() or None
    text = (text or "").strip() or None
    images = [f for f in images if f and f.filename]
    if not (url or text or images):
        raise HTTPException(400, "매물 링크, 캡처 이미지, 광고 글 중 하나는 넣어 주세요.")
    if len(images) > pc.MAX_IMAGES:
        raise HTTPException(400, f"이미지는 최대 {pc.MAX_IMAGES}장까지 올릴 수 있어요.")

    # 1) 자료 모으기
    parts: list[str] = []
    notes: list[str] = []
    if url:
        try:
            page = pc.fetch_url_text(url)
            if pc.text_has_listing_info(page):
                parts.append("[링크 페이지 내용]\n" + page)
            else:
                notes.append("이 사이트는 화면을 브라우저에서 그리는 방식이라 서버가 매물 정보를 읽지 못했어요.")
        except pc.PrecheckError as e:
            notes.append(str(e))
        if not parts and not (text or images):
            raise HTTPException(
                422,
                " ".join(notes) + " 매물 화면을 캡처해서 올리거나, 매물 설명 글을 복사해 붙여 넣어 주세요.",
            )
    if text:
        parts.append("[사용자가 붙여 넣은 광고 글]\n" + text)
    data_urls, hashes = [], []
    for f in images:
        try:
            durl, h = pc.prepare_image(await f.read())
        except pc.PrecheckError as e:
            raise HTTPException(400, str(e)) from e
        data_urls.append(durl)
        hashes.append(h)
    source_text = "\n\n".join(parts)[: pc.MAX_SOURCE_CHARS]
    kind = "image" if data_urls else ("url" if url and parts else "text")

    # 2) 내 조건
    profile = get_profile(db, user)
    weights = get_weights(db, user)
    uctx = user_context(profile, weights)
    payload = pc.build_payload(uctx, kind, source_text, hashes)

    # 3) AI 판정 (캐시·한도·대체 응답은 공통 게이트웨이가 처리)
    try:
        report, cached = ai_service.generate(
            db,
            user,
            "precheck",
            payload,
            pc.FORMAT,
            mock_fn=lambda: pc.mock_output(source_text, uctx, weights),
            validate_fn=lambda raw: pc.clean_ai_output(raw, source_text, bool(data_urls)),
            images=data_urls or None,
            system_prompt=pc.SYSTEM_PROMPT,
            mock_available=bool(source_text.strip()),
        )
    except ai_service.AIError as e:
        raise HTTPException(503, str(e)) from e

    # 4) 규칙 안전장치 (매번 계산: 프로필·시세가 바뀔 수 있음)
    result = copy.deepcopy(report.output)
    reviews = [r for r in result["priority_review"] if r["category"] != "cost"]
    cost = pc.cost_review(result["extracted"], uctx)
    order = sorted(pc.CATEGORIES, key=lambda c: -weights.get(c, 3))
    reviews.append(cost)
    reviews.sort(key=lambda r: order.index(r["category"]))
    result["priority_review"] = reviews
    market = pc.market_for(db, result)
    rules = pc.apply_rules(result, profile, source_text, market)

    meta = ai_service.report_out(report, cached)
    return {
        "report_id": report.id,
        "mode": meta["mode"],
        "model": meta["model"],
        "cached": cached,
        "error": meta["error"],
        "source": {"kind": kind, "url": url, "chars": len(source_text), "image_count": len(data_urls), "notes": notes},
        **result,
        "market": market,
        **rules,
        "verdict_labels": pc.VERDICT_LABEL,
        "listing_draft": pc.to_listing_draft(result, url),
        "profile_ready": bool(profile and profile.onboarding_done),
    }
