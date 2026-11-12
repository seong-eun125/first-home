/**
 * AI 매물 판정: 부동산 매물 링크·화면 캡처·광고 글 → 내 조건과 우선순위 기준으로 괜찮은 매물인지 판정.
 * - 판정 의견은 생성형 AI가 쓰고, 예산·절대 조건·위험 표현·시세는 백엔드 규칙이 다시 검사해 상한을 정합니다.
 * - 결과에서 '후보 매물로 저장'을 누르면 등록 폼에 값이 미리 채워지고, 사용자가 확인한 뒤 저장합니다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  FileText,
  ImagePlus,
  Link2,
  Loader2,
  MessageCircleQuestion,
  Quote,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { PrecheckResult, Verdict } from '@/lib/types'
import { CATEGORY_META, FLOOR_TYPE_LABEL } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { AIModeBadge } from '@/components/shared'
import { IconTile, PrecheckIllo } from '@/components/illustrations'
import { man } from '@/components/MarketCard'
import { cn } from '@/lib/utils'

type Mode = 'image' | 'url' | 'text'
const MAX_IMAGES = 3

const VERDICT_STYLE: Record<Verdict, { bg: string; ring: string; text: string; icon: typeof CheckCircle2; line: string }> = {
  good: { bg: 'bg-good-soft', ring: 'ring-good/25', text: 'text-good', icon: CheckCircle2, line: '내 조건에 대체로 맞아요. 방문해서 확인해 볼 만해요.' },
  check: { bg: 'bg-normal-soft', ring: 'ring-normal/25', text: 'text-normal', icon: CircleHelp, line: '괜찮을 수 있지만, 먼저 확인할 점이 있어요.' },
  bad: { bg: 'bg-bad-soft', ring: 'ring-bad/25', text: 'text-bad', icon: XCircle, line: '내 조건과 맞지 않는 부분이 있어요.' },
}

const ASSESS = {
  good: { label: '좋음', variant: 'good' as const },
  concern: { label: '주의', variant: 'bad' as const },
  unknown: { label: '확인 필요', variant: 'unknown' as const },
}

const HOUSE_LABEL: Record<string, string> = { offi: '오피스텔', rh: '빌라·다세대', sh: '원룸 건물·다가구', apt: '아파트', unknown: '미확인' }

export default function PrecheckPage() {
  const [mode, setMode] = useState<Mode>('image')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: api.profile })
  const { data: ai } = useQuery({ queryKey: ['ai-status'], queryFn: api.aiStatus })
  const aiReady = ai?.effective_mode === 'openai'

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const run = useMutation({
    mutationFn: () =>
      api.precheck(mode === 'image' ? { images: files } : mode === 'url' ? { url: url.trim() } : { text: text.trim() }),
    onSuccess: () => setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50),
  })

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const imgs = Array.from(list).filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type))
    setFiles((prev) => [...prev, ...imgs].slice(0, MAX_IMAGES))
  }

  const canSubmit =
    !run.isPending && ((mode === 'image' && files.length > 0) || (mode === 'url' && /^https?:\/\/.+/.test(url.trim())) || (mode === 'text' && text.trim().length >= 10))

  const p = profile?.profile
  const topWeights = Object.entries(profile?.weights ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => CATEGORY_META[k as keyof typeof CATEGORY_META]?.label ?? k)

  return (
    <div className="flex flex-col gap-6">
      {/* 소개 배너 */}
      <section className="relative overflow-hidden rounded-3xl bg-[#E3ECF0] px-6 py-7 sm:px-9 sm:py-9">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> 생성형 AI · 내 기준 맞춤 판정
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-[30px]">이 매물, 나한테 괜찮을까?</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/75">
            부동산 앱의 매물 화면을 캡처하거나 링크를 넣으면, AI가 가격·관리비·층·옵션을 읽고
            <b className="font-semibold text-foreground"> 내 예산과 우선순위</b>로 괜찮은 매물인지 판단해 드려요.
          </p>
        </div>
        <PrecheckIllo className="pointer-events-none absolute -bottom-2 right-2 hidden h-40 w-auto sm:block lg:right-10 lg:h-48" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 입력 */}
        <Card>
          <CardContent className="flex flex-col gap-5 pt-6">
            <div role="tablist" aria-label="입력 방식" className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface p-1.5">
              {(
                [
                  { k: 'image', label: '화면 캡처', icon: Camera },
                  { k: 'url', label: '매물 링크', icon: Link2 },
                  { k: 'text', label: '광고 글', icon: FileText },
                ] as const
              ).map((t) => (
                <button
                  key={t.k}
                  role="tab"
                  aria-selected={mode === t.k}
                  onClick={() => setMode(t.k)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors cursor-pointer',
                    mode === t.k ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {mode === 'image' && (
              <div className="flex flex-col gap-3">
                <label
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    addFiles(e.dataTransfer.files)
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors',
                    dragOver ? 'border-primary bg-brand-soft' : 'border-border bg-surface/60 hover:border-primary/50',
                    files.length >= MAX_IMAGES && 'pointer-events-none opacity-50',
                  )}
                >
                  <ImagePlus className="h-7 w-7 text-primary" />
                  <span className="text-sm font-semibold">매물 화면 캡처 올리기</span>
                  <span className="text-xs text-muted-foreground">최대 {MAX_IMAGES}장 · JPG·PNG·WEBP · 가격, 관리비, 층, 옵션이 보이게 캡처해 주세요</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
                </label>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {files.map((_, i) => (
                      <div key={i} className="relative h-24 w-20 overflow-hidden rounded-lg border border-border bg-surface">
                        <img src={previews[i]} alt={`캡처 ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute right-1 top-1 rounded-full bg-black/55 p-0.5 text-white cursor-pointer"
                          aria-label={`캡처 ${i + 1} 삭제`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  사진은 위치정보를 지우고 AI 분석에만 쓰며, 서버에 저장하지 않아요.
                  {!aiReady && (
                    <span className="mt-1 block font-medium text-normal">
                      지금은 OpenAI 키가 연결되지 않아 캡처 분석을 할 수 없어요. 키 연결 전에는 '광고 글' 탭을 이용해 주세요.
                    </span>
                  )}
                </p>
              </div>
            )}

            {mode === 'url' && (
              <div className="flex flex-col gap-2">
                <Input type="url" inputMode="url" placeholder="https://… 매물 상세 페이지 주소" value={url} onChange={(e) => setUrl(e.target.value)} />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  서버가 페이지를 한 번 읽어 와요. 직방·다방·네이버 부동산처럼 화면을 앱에서 그리는 사이트는 내용을 읽지 못할 수 있어요. 그럴 땐 화면 캡처를 이용해 주세요.
                </p>
              </div>
            )}

            {mode === 'text' && (
              <div className="flex flex-col gap-2">
                <Textarea
                  rows={7}
                  maxLength={8000}
                  placeholder={'매물 설명이나 중개사 문자를 그대로 붙여 넣어 주세요.\n예) 구로구 고척동 분리형 원룸 보증금 500 / 월세 45, 관리비 7만(수도·인터넷 포함), 3층/5층, 남향, 공동현관 비밀번호'}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <p className="text-right text-xs text-muted-foreground">{text.length.toLocaleString()} / 8,000자</p>
              </div>
            )}

            {run.isError && (
              <div role="alert" className="flex gap-2 rounded-xl bg-bad-soft p-3.5 text-[13px] text-bad">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  {(run.error as Error).message}
                  {mode === 'url' && (
                    <button type="button" onClick={() => setMode('image')} className="ml-1 font-semibold underline cursor-pointer">
                      캡처로 하기
                    </button>
                  )}
                </div>
              </div>
            )}

            <Button size="lg" disabled={!canSubmit} onClick={() => run.mutate()}>
              {run.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {run.isPending ? '매물 정보를 읽고 판단하는 중…' : 'AI로 판정하기'}
            </Button>
          </CardContent>
        </Card>

        {/* 내 기준 요약 */}
        <Card className="h-fit">
          <CardHeader className="flex-row items-center gap-3 pb-3">
            <IconTile kind="clipboard" />
            <div>
              <CardTitle className="text-[15px]">이 기준으로 판단해요</CardTitle>
              <Link to="/settings" className="text-xs font-medium text-primary">
                내 기준 수정 →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 text-[13px]">
            <Row label="월 예산" value={p?.monthly_budget ? `${man(p.monthly_budget / 10000)}원` : '미설정'} />
            <Row label="보증금 예산" value={p?.deposit_budget ? `${man(p.deposit_budget / 10000)}원` : '미설정'} />
            <Row label="중요한 순서" value={topWeights.join(' › ') || '미설정'} />
            <div>
              <div className="text-muted-foreground">절대 조건</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(p?.dealbreakers ?? []).length ? (
                  p!.dealbreakers.map((d) => (
                    <Badge key={d} variant="bad">
                      {profile?.dealbreaker_options[d] ?? d}
                    </Badge>
                  ))
                ) : (
                  <span className="text-foreground/70">없음</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div ref={resultRef} className="scroll-mt-20">
        {run.data && <Result r={run.data} onReset={() => run.reset()} />}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function Result({ r, onReset }: { r: PrecheckResult; onReset: () => void }) {
  const navigate = useNavigate()
  const v = VERDICT_STYLE[r.final_verdict]
  const ex = r.extracted
  const money = (n: number | null) => (n === null ? '미확인' : `${man(n)}원`)
  const facts: { label: string; value: string; quote?: string }[] = [
    { label: '보증금', value: money(ex.deposit_manwon), quote: r.quotes.deposit_manwon },
    { label: '월세', value: ex.monthly_rent_manwon === 0 ? '전세' : money(ex.monthly_rent_manwon), quote: r.quotes.monthly_rent_manwon },
    {
      label: '관리비',
      value: ex.maintenance_fee_manwon === null ? '미확인' : `${ex.maintenance_fee_manwon}만원${ex.maintenance_includes.length ? ` (${ex.maintenance_includes.join('·')} 포함)` : ''}`,
      quote: r.quotes.maintenance_fee_manwon,
    },
    { label: '면적', value: ex.area_m2 ? `${ex.area_m2}㎡ (약 ${(ex.area_m2 / 3.3058).toFixed(1)}평)` : '미확인', quote: r.quotes.area_m2 },
    {
      label: '층',
      value: [ex.floor ? `${ex.floor}층` : null, ex.total_floors ? `/ ${ex.total_floors}층` : null, ex.floor_type !== 'unknown' ? `(${FLOOR_TYPE_LABEL[ex.floor_type]})` : null].filter(Boolean).join(' ') || '미확인',
      quote: r.quotes.floor ?? r.quotes.floor_type,
    },
    { label: '유형', value: HOUSE_LABEL[ex.house_type] },
    { label: '위치', value: ex.address_text ?? '미확인', quote: r.quotes.address_text },
    { label: '옵션', value: ex.options.length ? ex.options.join(', ') : '미확인' },
    { label: '입주', value: ex.available_from ?? '미확인' },
  ]

  return (
    <div className="animate-fade-up flex flex-col gap-5">
      {/* 판정 */}
      <section className={cn('rounded-3xl p-6 ring-1 sm:p-8', v.bg, v.ring)}>
        <div className="flex flex-wrap items-center gap-2">
          <AIModeBadge report={r} />
          {r.source.kind === 'image' && <Badge variant="muted">캡처 {r.source.image_count}장 분석</Badge>}
        </div>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/80', v.text)}>
            <v.icon className="h-9 w-9" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[13px] font-semibold', v.text)}>최종 판정</div>
            <h2 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-[28px]">{r.final_label}</h2>
            <p className="mt-1 text-sm text-foreground/80">{v.line}</p>
            {r.title && <p className="mt-3 text-[15px] font-semibold">{r.title}</p>}
            {r.summary && <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{r.summary}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/75 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {r.mode === 'openai' ? 'AI 판단' : '1차 판단 (규칙 기반)'} · {r.verdict_labels[r.ai_verdict]}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed">{r.verdict_reason || '—'}</p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ShieldAlert className="h-3.5 w-3.5" /> 규칙 검사 · {r.rule_cap === 'good' ? '통과' : r.lowered_by_rules ? '판정을 낮춤' : '확인할 점 있음'}
            </div>
            {r.rule_reasons.length ? (
              <ul className="mt-1.5 flex flex-col gap-0.5 text-[13px] leading-relaxed">
                {r.rule_reasons.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-[13px]">예산·절대 조건·위험 표현에서 걸리는 것이 없어요.</p>
            )}
          </div>
        </div>
        {r.error && <p className="mt-3 text-xs text-normal">AI 호출 문제: {r.error}</p>}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 읽은 정보 */}
        <Card>
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <IconTile kind="scan" size="sm" />
            <CardTitle className="text-[15px]">광고에서 읽은 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-[13px]">
              {facts.map((f) => (
                <div key={f.label} className="flex gap-3 py-2">
                  <dt className="w-14 shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className="min-w-0 flex-1">
                    <span className={cn(f.value === '미확인' && 'text-muted-foreground')}>{f.value}</span>
                    {f.quote && <QuoteChip q={f.quote} />}
                  </dd>
                </div>
              ))}
            </dl>
            {!!r.dropped_fields?.length && (
              <p className="mt-2 text-xs text-muted-foreground">원문에서 근거를 찾지 못한 값 {r.dropped_fields.length}개는 버렸어요.</p>
            )}
          </CardContent>
        </Card>

        {/* 조건 검사 */}
        <Card>
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <IconTile kind="shield" size="sm" />
            <CardTitle className="text-[15px]">내 조건 검사 (규칙)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {r.gates.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                예산이나 절대 조건이 설정돼 있지 않아요.{' '}
                <Link to="/settings" className="font-medium text-primary">
                  내 기준 설정하기
                </Link>
              </p>
            )}
            {r.gates.map((g) => (
              <div key={g.label} className="flex min-w-0 gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-[13px]">
                {g.status === 'pass' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                ) : g.status === 'fail' ? (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
                ) : (
                  <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold">{g.label}</div>
                  <div className="text-muted-foreground">{g.detail}</div>
                </div>
              </div>
            ))}
            {r.market && r.market.compare && r.market.compare.median_rent !== undefined && (
              <div className="mt-1 rounded-xl border border-border px-3 py-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">동네 실거래 시세</span>
                  {r.market.is_sample ? <Badge variant="normal">예시 데이터</Badge> : <Badge variant="good">국토교통부</Badge>}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {r.market.region.name} {r.market.house_type.label} 비슷한 거래 중앙값 {r.market.compare.median_rent}만원 →{' '}
                  <b className="text-foreground">{r.market.compare.label}</b>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 우선순위 평가 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px]">내 우선순위로 본 평가</CardTitle>
          <p className="text-xs text-muted-foreground">중요하게 설정한 항목부터 보여 드려요. 광고 문구는 광고하는 쪽의 주장이니 현장에서 확인해 주세요.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {r.priority_review.map((pr) => {
            const meta = CATEGORY_META[pr.category]
            const a = ASSESS[pr.assessment]
            return (
              <div key={pr.category} className="flex min-w-0 gap-3 rounded-2xl border border-border p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
                  <meta.icon className="h-4.5 w-4.5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">{pr.label}</span>
                    <Badge variant={a.variant}>{a.label}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">{pr.reason}</p>
                  {pr.quote && <QuoteChip q={pr.quote} />}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {r.red_flags.length > 0 && (
        <section className="rounded-2xl border border-bad/20 bg-bad-soft/60 p-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-bad">
            <AlertTriangle className="h-4.5 w-4.5" /> 계약 전에 꼭 확인할 표현
          </div>
          <ul className="mt-3 flex flex-col gap-2.5">
            {r.red_flags.map((f, i) => (
              <li key={i} className="text-[13px] leading-relaxed">
                {f.text}
                <QuoteChip q={f.quote} />
              </li>
            ))}
          </ul>
          <Link to="/guide" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-bad">
            보증금 지키기 가이드 보기 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <MessageCircleQuestion className="h-4.5 w-4.5 text-primary" />
            <CardTitle className="text-[15px]">중개사·집주인에게 물어볼 것</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-relaxed">
              {r.questions_to_ask.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
            <CardTitle className="text-[15px]">방문하면 꼭 볼 것</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed">
              {r.visit_checklist.map((q) => (
                <li key={q} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
                  {q}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={() => navigate('/listings/new', { state: { draft: r.listing_draft } })}>
          후보 매물로 저장하고 현장 체크 준비 <ArrowRight />
        </Button>
        <Button size="lg" variant="outline" onClick={onReset}>
          <RotateCcw /> 다른 매물 판정하기
        </Button>
      </div>
      <Link
        to="/survey"
        className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F2EA] p-4 text-[13px] transition-colors hover:bg-[#F1E9DC]"
      >
        <span>
          <b className="font-semibold">AI 판정이 도움이 됐나요?</b> 2분 후기 설문으로 알려 주세요.
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </Link>
      <p className="text-xs leading-relaxed text-muted-foreground">
        이 판정은 광고 내용과 내 기준을 바탕으로 한 참고 의견이에요. 실제 집 상태, 권리관계(등기부등본), 계약 조건은 반드시 직접 확인해 주세요.
      </p>
    </div>
  )
}

function QuoteChip({ q }: { q: string }) {
  return (
    <span className="mt-1 flex w-fit max-w-full items-start gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[11px] leading-relaxed text-muted-foreground">
      <Quote className="mt-[3px] h-3 w-3 shrink-0" />
      <span className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">{q}</span>
    </span>
  )
}
