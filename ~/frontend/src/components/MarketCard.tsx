/**
 * 동네 실거래 시세 카드 (국토교통부 전월세 실거래가).
 * - 키는 백엔드에만 있고, 이 컴포넌트는 /api/market/* 만 호출합니다.
 * - 판정(낮은 편/비슷한 편/높은 편)은 백엔드 규칙(백분위)으로 계산된 값을 그대로 보여줍니다.
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Database, Info, Loader2, MapPin, Search } from 'lucide-react'
import { api } from '@/lib/api'
import type { HouseType, ListingDetail, MarketReport } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const HOUSE_TYPES: { code: HouseType; label: string; hint: string }[] = [
  { code: 'sh', label: '원룸 건물', hint: '단독·다가구' },
  { code: 'rh', label: '빌라', hint: '연립·다세대' },
  { code: 'offi', label: '오피스텔', hint: '오피스텔' },
]

const TONE = {
  good: { soft: 'bg-good-soft', text: 'text-good', dot: 'bg-good' },
  normal: { soft: 'bg-normal-soft', text: 'text-normal', dot: 'bg-normal' },
  bad: { soft: 'bg-bad-soft', text: 'text-bad', dot: 'bg-bad' },
} as const
type Tone = keyof typeof TONE

export function man(n: number) {
  if (n >= 10000) {
    const eok = n / 10000
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억`
  }
  return `${n.toLocaleString()}만`
}

export function MarketCard({ listing }: { listing: ListingDetail }) {
  const qc = useQueryClient()
  const { data: regions } = useQuery({ queryKey: ['market-regions'], queryFn: api.marketRegions, staleTime: Infinity })
  const { data: status } = useQuery({ queryKey: ['market-status'], queryFn: api.marketStatus, staleTime: 60_000 })

  const savedCode = listing.lawd_cd ?? ''
  const [regionSel, setRegionSel] = useState<string>(savedCode || '11530')
  const [customCode, setCustomCode] = useState('')
  const [houseType, setHouseType] = useState<HouseType>(listing.house_type ?? 'sh')
  const [dong, setDong] = useState('')
  const [report, setReport] = useState<MarketReport | null>(null)

  // 저장된 코드가 서울 목록에 없으면 '직접 입력'으로 표시
  useEffect(() => {
    if (savedCode && regions && !regions.some((r) => r.code === savedCode)) {
      setRegionSel('custom')
      setCustomCode(savedCode)
    }
  }, [savedCode, regions])

  const lawdCd = regionSel === 'custom' ? customCode.trim() : regionSel
  const codeValid = /^\d{5}$/.test(lawdCd)

  const load = useMutation({
    mutationFn: (opts: { dong?: string; save: boolean }) =>
      api.marketRent({ lawd_cd: lawdCd, house_type: houseType, dong: opts.dong, listing_id: listing.id, save: opts.save }),
    onSuccess: (r, opts) => {
      setReport(r)
      if (!opts.dong && r.suggested_dong && !dong) setDong(r.suggested_dong)
      if (opts.save) qc.invalidateQueries({ queryKey: ['listing', listing.id] })
    },
  })

  // 이전에 조회한 조건이 저장돼 있으면 열 때 한 번 자동으로 불러옵니다 (서버 캐시 사용)
  useEffect(() => {
    if (listing.lawd_cd && listing.house_type && !report && !load.isPending) {
      load.mutate({ save: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id])

  const submit = () => codeValid && load.mutate({ dong: dong.trim() || undefined, save: true })

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft">
            <Database className="h-4 w-4 text-primary" />
          </span>
          동네 실거래 시세
        </CardTitle>
        {status?.is_sample ? (
          <Badge variant="normal">예시 데이터 · 키 미설정</Badge>
        ) : (
          <Badge variant="good">국토교통부 실거래가</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 조회 조건 */}
        <div className="flex flex-col gap-3 rounded-xl bg-surface p-3.5">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              지역 (시군구)
              <select
                value={regionSel}
                onChange={(e) => setRegionSel(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-[13px] text-foreground"
              >
                {(regions ?? []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
                <option value="custom">다른 지역 (코드 직접 입력)</option>
              </select>
            </label>
            {regionSel === 'custom' ? (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                시군구 코드 5자리
                <Input
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="예) 41135"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.replace(/\D/g, ''))}
                  aria-invalid={customCode !== '' && !codeValid}
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                동 (선택)
                <Input placeholder="예) 고척동 — 비우면 구 전체" value={dong} onChange={(e) => setDong(e.target.value)} maxLength={20} />
              </label>
            )}
          </div>
          {regionSel === 'custom' && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              동 (선택)
              <Input placeholder="비우면 시군구 전체" value={dong} onChange={(e) => setDong(e.target.value)} maxLength={20} />
            </label>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div role="radiogroup" aria-label="주택 유형" className="flex flex-1 gap-1.5">
              {HOUSE_TYPES.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  role="radio"
                  aria-checked={houseType === t.code}
                  onClick={() => setHouseType(t.code)}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center rounded-lg border px-1.5 py-1.5 text-[13px] whitespace-nowrap transition-colors',
                    houseType === t.code ? 'border-primary bg-brand-soft font-semibold text-primary' : 'border-border bg-background hover:border-primary/40',
                  )}
                >
                  {t.label}
                  <span className="text-[10px] font-normal text-muted-foreground">{t.hint}</span>
                </button>
              ))}
            </div>
            <Button onClick={submit} disabled={!codeValid || load.isPending} className="w-full sm:w-auto">
              {load.isPending ? <Loader2 className="animate-spin" /> : <Search />}
              시세 불러오기
            </Button>
          </div>
        </div>

        {load.isError && (
          <div role="alert" className="rounded-lg bg-bad-soft p-3 text-[13px] text-bad">
            {(load.error as Error).message}
          </div>
        )}

        {load.isPending && !report && (
          <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 최근 {status?.months ?? 6}개월 거래를 불러오는 중…
          </div>
        )}

        {!report && !load.isPending && !load.isError && (
          <p className="flex gap-2 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            지역과 주택 유형을 고르면 최근 {status?.months ?? 6}개월 신고된 전월세 거래와 이 집의 월세를 비교해 드려요.
          </p>
        )}

        {report && <MarketResult r={report} myDeposit={Math.round(listing.deposit / 10000)} />}
      </CardContent>
    </Card>
  )
}

function MarketResult({ r, myDeposit }: { r: MarketReport; myDeposit: number }) {
  const c = r.compare
  const tone: Tone = c?.level === 'high' ? 'bad' : c?.level === 'low' ? 'good' : 'normal'
  const t = TONE[tone]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        {r.region.name} {r.scope !== '구 전체' && `· ${r.scope}`} · {r.house_type.label} · {r.area_label} · {r.months[0]}~
        {r.months[r.months.length - 1]}
      </div>

      {r.is_sample && (
        <div className="rounded-lg border border-dashed border-normal/50 bg-normal-soft/60 p-2.5 text-xs text-normal">
          지금 보이는 숫자는 화면 확인용 <b>예시 데이터</b>예요. backend/.env에 MOLIT_API_KEY를 넣으면 실제 거래로 바뀝니다.
        </div>
      )}

      {/* 판정 */}
      {c && c.my_rent !== undefined && c.median_rent !== undefined ? (
        <div className={cn('rounded-xl p-4', t.soft)}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[13px] text-foreground">
              이 집 월세 <b>{c.my_rent}만원</b>은 {c.basis} {c.count}건의 중앙값 <b>{c.median_rent}만원</b>보다{' '}
              {c.diff === 0 ? '같아요' : `${Math.abs(c.diff)}만원 ${c.diff > 0 ? '높아요' : '낮아요'}`}.
            </div>
            <span className={cn('text-lg font-extrabold', t.text)}>{c.label}</span>
          </div>
          {r.wolse && <RentRange p25={r.wolse.p25_rent} p75={r.wolse.p75_rent} median={c.median_rent} mine={c.my_rent} tone={tone} />}
          <p className="mt-2 text-xs text-muted-foreground">
            비교 거래 중 약 {c.percentile}%가 이 집보다 월세가 낮아요. (보증금 {man(myDeposit)}원 기준)
            {c.few && ' 거래 수가 적어 참고만 해 주세요.'}
          </p>
        </div>
      ) : c && c.my_deposit !== undefined ? (
        <div className={cn('rounded-xl p-4 text-[13px]', t.soft)}>
          전세 보증금 <b>{man(c.my_deposit)}원</b>은 전세 거래 {c.count}건의 중앙값 <b>{man(c.median_deposit ?? 0)}원</b>과 비교해{' '}
          <b className={t.text}>{c.label}</b>이에요.
        </div>
      ) : (
        <div className="rounded-xl bg-surface p-4 text-[13px] text-muted-foreground">비교할 수 있는 거래가 부족해요. 동을 비우거나 다른 주택 유형을 골라 보세요.</div>
      )}

      {/* 요약 숫자 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="월세 거래" value={r.wolse ? `${r.wolse.count}건` : '0건'} />
        <Stat label="월세 중앙값" value={r.wolse ? `${man(r.wolse.median_deposit)} / ${r.wolse.median_rent}만` : '-'} />
        <Stat label="전세 중앙값" value={r.jeonse ? `${man(r.jeonse.median_deposit)} (${r.jeonse.count}건)` : '-'} />
      </div>

      {/* 최근 거래 */}
      {r.recent.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
            <Building2 className="h-4 w-4 text-primary" /> 최근 거래 {Math.min(r.recent.length, 20)}건
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="sticky top-0 bg-surface text-muted-foreground">
                <tr>
                  <th className="px-2.5 py-2 font-medium">계약일</th>
                  <th className="px-2.5 py-2 font-medium">동</th>
                  <th className="px-2.5 py-2 text-right font-medium">전용</th>
                  <th className="px-2.5 py-2 text-right font-medium">층</th>
                  <th className="px-2.5 py-2 text-right font-medium">보증금 / 월세</th>
                </tr>
              </thead>
              <tbody>
                {r.recent.map((d, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2.5 py-1.5 tabular-nums">{d.date?.slice(2).replaceAll('-', '.') ?? '-'}</td>
                    <td className="px-2.5 py-1.5">
                      {d.dong}
                      {d.contract_type === '갱신' && <span className="ml-1 text-muted-foreground">(갱신)</span>}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{d.area ? `${d.area}㎡` : '-'}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{d.floor ?? '-'}</td>
                    <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">
                      {d.rent === 0 ? `전세 ${man(d.deposit)}` : `${man(d.deposit)} / ${d.rent}만`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {r.notes.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {r.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}
      <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        출처: {r.source}
        {r.cached_months > 0 && ` · ${r.cached_months}개월은 저장된 데이터 사용`}
        <br />
        {r.disclaimer}
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-2 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold tabular-nums">{value}</div>
    </div>
  )
}

/** 월세 25~75% 구간 막대 위에 중앙값과 이 집 위치를 표시 */
function RentRange({ p25, p75, median, mine, tone }: { p25: number; p75: number; median: number; mine: number; tone: Tone }) {
  const lo = Math.min(p25, mine, median) - 5
  const hi = Math.max(p75, mine, median) + 5
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="mt-4" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-white/70">
        <div className="absolute h-2 rounded-full bg-sage/50" style={{ left: pos(p25), width: `calc(${pos(p75)} - ${pos(p25)})` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-foreground/50" style={{ left: pos(median) }} />
        <div className={cn('absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white shadow', TONE[tone].dot)} style={{ left: pos(mine) }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>흔한 범위 {p25}~{p75}만</span>
        <span>
          세로선 중앙값 · <span className={TONE[tone].text}>●</span> 이 집
        </span>
      </div>
    </div>
  )
}
