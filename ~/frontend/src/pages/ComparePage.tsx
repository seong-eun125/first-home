import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Ban,
  Check,
  Crown,
  Footprints,
  GitCompareArrows,
  Lightbulb,
  Loader2,
  Printer,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Skeleton, Switch } from '@/components/ui/misc'
import { AIModeBadge, CoverageMeter, EmptyState, EvidenceChips, FitRing, PageHeader, ValueBadge } from '@/components/shared'
import { useFlip } from '@/hooks/useFlip'
import { CATEGORY_META, CATEGORY_ORDER, scoreTone } from '@/lib/constants'
import type { AIReport, CategoryKey, ScoreResult } from '@/lib/types'
import { cn, formatDateTime, won, wonFull } from '@/lib/utils'

export default function ComparePage() {
  const qc = useQueryClient()
  const listings = useQuery({ queryKey: ['listings'], queryFn: api.listings })
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile })
  const items = useQuery({ queryKey: ['checklist-items'], queryFn: api.checklistItems, staleTime: Infinity })
  const active = useMemo(() => (listings.data ?? []).filter((l) => ['candidate', 'hold', 'selected'].includes(l.status)), [listings.data])

  const [selected, setSelected] = useState<number[]>([])
  const [weights, setWeights] = useState<Record<string, number> | null>(null)
  const [results, setResults] = useState<ScoreResult[]>([])
  const [loading, setLoading] = useState(false)
  const [diffOnly, setDiffOnly] = useState(true)
  const [report, setReport] = useState<AIReport | null>(null)
  const [reportWeightsKey, setReportWeightsKey] = useState<string>('')
  const [movedIds, setMovedIds] = useState<number[]>([])
  const prevOrder = useRef<number[]>([])

  // 초기값: 저장된 가중치 + 적합도 상위 3개
  useEffect(() => {
    if (profile.data && !weights) setWeights(profile.data.weights)
  }, [profile.data, weights])
  useEffect(() => {
    if (!active.length || selected.length) return
    const sorted = [...active].sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1))
    setSelected(sorted.slice(0, Math.min(3, sorted.length)).map((l) => l.id))
  }, [active, selected.length])

  // 가중치·선택이 바뀌면 서버에서 다시 계산 (저장하지 않음)
  useEffect(() => {
    if (!weights || selected.length === 0) {
      setResults([])
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      api
        .previewScores(weights, selected)
        .then((r) => {
          const order = r.results.map((x) => x.listing_id)
          const moved = order.filter((lid, i) => prevOrder.current.length && prevOrder.current[i] !== lid)
          prevOrder.current = order
          setMovedIds(moved)
          if (moved.length) setTimeout(() => setMovedIds([]), 1200)
          setResults(r.results)
        })
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false))
    }, 180)
    return () => clearTimeout(t)
  }, [weights, selected])

  const flipRef = useFlip<HTMLDivElement>([results.map((r) => r.listing_id).join(',')])

  const saveWeights = useMutation({
    mutationFn: () => api.saveWeights(weights!),
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success('이 우선순위를 내 기준으로 저장했어요.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const weightsKey = JSON.stringify({ weights, selected: [...selected].sort() })
  const genReport = useMutation({
    mutationFn: async () => {
      const comp = await api.createComparison(selected, weights ?? undefined)
      return api.createCompareReport(comp.id)
    },
    onSuccess: (r) => {
      setReport(r)
      setReportWeightsKey(weightsKey)
      if (r.cached) toast.info('같은 조건의 분석 결과가 있어 저장된 결과를 보여 드려요.')
      if (r.mode === 'fallback') toast.warning('AI 호출에 실패해 규칙 기반 응답으로 대체했어요.')
      setTimeout(() => document.getElementById('compare-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (listings.isLoading || profile.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (active.length < 2) {
    return (
      <div>
        <PageHeader title="매물 비교" />
        <EmptyState
          icon={GitCompareArrows}
          title="비교하려면 매물이 2개 이상 필요해요"
          description="진행 중인 매물을 하나 더 기록하면 내 기준으로 나란히 비교할 수 있어요."
          action={
            <Button asChild>
              <Link to="/listings/new">매물 기록하기</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const saved = profile.data?.weights ?? {}
  const changed = weights && CATEGORY_ORDER.some((c) => weights[c] !== saved[c])
  const byId = Object.fromEntries((listings.data ?? []).map((l) => [l.id, l]))
  const itemList = items.data ?? []

  // 체크 항목 비교 행
  const checkRows = itemList
    .map((it) => {
      const vals = results.map((r) => r.check_values?.[it.id] ?? null)
      const differ = new Set(vals.map((v) => v ?? '-')).size > 1
      return { item: it, vals, differ, any: vals.some((v) => v !== null) }
    })
    .filter((r) => r.any && (!diffOnly || r.differ))

  return (
    <div>
      <PageHeader
        title="매물 비교"
        description="우선순위를 조절하면 백엔드에서 점수와 순위를 바로 다시 계산해요."
        actions={
          <div className="no-print flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> 인쇄·PDF 저장
            </Button>
            <Button onClick={() => genReport.mutate()} disabled={genReport.isPending || selected.length < 2}>
              {genReport.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} AI 비교 리포트
            </Button>
          </div>
        }
      />

      {/* 매물 선택 */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] text-muted-foreground">비교할 매물 (최대 4개)</span>
        {active.map((l) => {
          const on = selected.includes(l.id)
          return (
            <button
              key={l.id}
              onClick={() =>
                setSelected((s) => (on ? s.filter((x) => x !== l.id) : s.length >= 4 ? (toast.info('최대 4개까지 비교할 수 있어요.'), s) : [...s, l.id]))
              }
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium cursor-pointer',
                on ? 'border-primary bg-brand-soft text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {on && <Check className="h-3.5 w-3.5" />}
              {l.nickname}
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[17.5rem_1fr]">
        {/* 우선순위 슬라이더 */}
        <aside className="no-print lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                우선순위
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              <p className="text-xs text-muted-foreground">1 = 덜 중요 · 5 = 매우 중요</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-5 gap-y-3.5 lg:grid-cols-1">
              {weights &&
                CATEGORY_ORDER.map((c) => {
                  const M = CATEGORY_META[c]
                  return (
                    <div key={c}>
                      <div className="mb-1 flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-1.5">
                          <M.icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {M.label}
                        </span>
                        <span className={cn('tabular font-bold', weights[c] !== saved[c] ? 'text-normal' : 'text-primary')}>{weights[c]}</span>
                      </div>
                      <Slider min={1} max={5} step={1} value={[weights[c] ?? 3]} onValueChange={([v]) => setWeights((w) => ({ ...(w ?? {}), [c]: v }))} aria-label={`${M.label} 가중치`} />
                    </div>
                  )
                })}
              <div className="col-span-2 mt-1 flex gap-2 lg:col-span-1">
                <Button size="sm" variant="outline" className="flex-1" disabled={!changed} onClick={() => setWeights(saved)}>
                  <RotateCcw /> 원래대로
                </Button>
                <Button size="sm" className="flex-1" disabled={!changed || saveWeights.isPending} onClick={() => saveWeights.mutate()}>
                  <Save /> 저장
                </Button>
              </div>
              {changed && <p className="col-span-2 text-[11px] text-normal lg:col-span-1">저장 전에는 이 화면에서만 적용돼요.</p>}
            </CardContent>
          </Card>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          {/* 순위 카드 */}
          <div ref={flipRef} className={cn('grid gap-3', results.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2', results.length === 4 && 'xl:grid-cols-4 md:grid-cols-2')}>
            {results.map((r) => {
              const l = byId[r.listing_id]
              const moved = movedIds.includes(r.listing_id)
              return (
                <div
                  key={r.listing_id}
                  data-flip-key={r.listing_id}
                  className={cn(
                    'relative flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-soft transition-colors',
                    r.rank === 1 && !r.dealbreaker_violations.length ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border',
                    moved && 'bg-brand-soft/60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        {r.rank === 1 && !r.dealbreaker_violations.length ? <Crown className="h-3.5 w-3.5 text-primary" /> : null}
                        <span className={cn(r.rank === 1 && 'text-primary')}>{r.rank}위</span>
                      </div>
                      <Link to={`/listings/${r.listing_id}`} className="mt-0.5 block truncate font-semibold hover:underline">
                        {r.nickname}
                      </Link>
                    </div>
                    <FitRing fit={r.fit} size={64} label="" />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.dealbreaker_violations.map((v) => (
                      <Badge key={v.code} variant="bad">
                        <Ban /> {v.label}
                      </Badge>
                    ))}
                    {r.low_coverage && (
                      <Badge variant="normal">
                        <AlertTriangle /> 확인 부족
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[13px]">
                    <div className="rounded-lg bg-surface px-2.5 py-2">
                      <div className="text-[11px] text-muted-foreground">보증금</div>
                      <div className="tabular font-semibold">{won(r.deposit)}</div>
                    </div>
                    <div className="rounded-lg bg-surface px-2.5 py-2">
                      <div className="text-[11px] text-muted-foreground">월 고정비</div>
                      <div className="tabular font-semibold">{won(r.monthly_total)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Footprints className="h-3.5 w-3.5" />
                      {l?.walk_minutes != null ? `${l.walk_minutes}분` : '미입력'}
                    </span>
                    <span>미확인 {r.unverified.length}개</span>
                  </div>
                  <CoverageMeter coverage={r.coverage} compact />
                </div>
              )
            })}
          </div>

          {/* 카테고리 점수 비교 */}
          <Card>
            <CardHeader>
              <CardTitle>카테고리별 점수</CardTitle>
              <p className="text-[13px] text-muted-foreground">가중치가 높은 카테고리부터. 칸이 비어 있으면 아직 확인한 항목이 없다는 뜻이에요.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="w-40 pb-2 font-medium">카테고리</th>
                    {results.map((r) => (
                      <th key={r.listing_id} className="pb-2 font-medium">
                        {r.nickname}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...CATEGORY_ORDER]
                    .sort((a, b) => (weights?.[b] ?? 3) - (weights?.[a] ?? 3))
                    .map((c) => {
                      const M = CATEGORY_META[c as CategoryKey]
                      const scores = results.map((r) => r.category_scores[c as CategoryKey].score)
                      const best = Math.max(...scores.map((s) => s ?? -1))
                      return (
                        <tr key={c} className="border-t border-border">
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-1.5">
                              <M.icon className="h-3.5 w-3.5 text-muted-foreground" />
                              {M.label}
                              <span className="tabular text-[11px] text-muted-foreground">×{weights?.[c]}</span>
                            </div>
                          </td>
                          {scores.map((s, i) => {
                            const tone = scoreTone(s)
                            return (
                              <td key={i} className="py-2.5 pr-4">
                                {s === null ? (
                                  <span className="text-xs text-unknown">미확인</span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={cn('h-full rounded-full', { 'bg-primary': tone === 'good', 'bg-normal': tone === 'normal', 'bg-bad': tone === 'bad' })}
                                        style={{ width: `${Math.max(s, 3)}%` }}
                                      />
                                    </div>
                                    <span className={cn('tabular w-7 font-semibold', s === best && results.length > 1 && 'text-primary')}>{s}</span>
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* 체크 기록 비교 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>현장 기록 비교</CardTitle>
                <p className="mt-1 text-[13px] text-muted-foreground">{diffOnly ? '매물끼리 기록이 다른 항목만 보여요.' : '기록한 모든 항목'}</p>
              </div>
              <label className="no-print flex items-center gap-2 text-[13px]">
                차이 나는 항목만
                <Switch checked={diffOnly} onCheckedChange={setDiffOnly} />
              </label>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="w-48 pb-2 font-medium">항목</th>
                    {results.map((r) => (
                      <th key={r.listing_id} className="pb-2 font-medium">
                        {r.nickname}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="py-2.5 pr-3">월 고정비</td>
                    {results.map((r) => (
                      <td key={r.listing_id} className="tabular py-2.5">{wonFull(r.monthly_total)}</td>
                    ))}
                  </tr>
                  {checkRows.map(({ item, vals }) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="py-2.5 pr-3">
                        {item.label}
                        {item.is_required && <span className="ml-1 text-[10px] text-muted-foreground">필수</span>}
                      </td>
                      {vals.map((v, i) => {
                        const opt = item.options?.find((o) => o.value === v)
                        return (
                          <td key={i} className="py-2.5 pr-3">
                            {v === null ? (
                              <span className="text-xs text-muted-foreground">기록 없음</span>
                            ) : opt ? (
                              <Badge variant="muted">{opt.label}</Badge>
                            ) : item.input_type === 'number' ? (
                              <span className="tabular">{v}</span>
                            ) : (
                              <ValueBadge value={v} />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {checkRows.length === 0 && (
                    <tr>
                      <td colSpan={results.length + 1} className="py-6 text-center text-muted-foreground">
                        기록이 다른 항목이 없어요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {report && <CompareReport report={report} results={results} stale={reportWeightsKey !== weightsKey} onRegenerate={() => genReport.mutate()} regenerating={genReport.isPending} />}
          {!report && (
            <div className="no-print flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-background p-8 text-center">
              <Sparkles className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold">AI 비교 리포트</div>
                <p className="mt-1 text-[13px] text-muted-foreground">지금 우선순위와 비교 결과를 저장하고, 그 기록을 근거로 조건별 추천과 결정 전 확인할 것을 정리해 드려요.</p>
              </div>
              <Button onClick={() => genReport.mutate()} disabled={genReport.isPending}>
                {genReport.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} 리포트 만들기
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CompareReport({
  report,
  results,
  stale,
  onRegenerate,
  regenerating,
}: {
  report: AIReport
  results: ScoreResult[]
  stale: boolean
  onRegenerate: () => void
  regenerating: boolean
}) {
  const out = report.output
  const scores = report.scores ?? results
  const byId = Object.fromEntries(scores.map((s) => [s.listing_id, s]))
  return (
    <Card id="compare-report" className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border bg-gradient-to-b from-brand-soft/60 to-transparent pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI 비교 리포트
          </CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <AIModeBadge report={report} />
            <span>{formatDateTime(report.created_at)}</span>
          </div>
        </div>
        {stale && (
          <Button size="sm" variant="outline" onClick={onRegenerate} disabled={regenerating} className="no-print">
            {regenerating ? <Loader2 className="animate-spin" /> : <RotateCcw />} 현재 조건으로 다시
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">
        {stale && (
          <p className="flex items-center gap-1.5 rounded-md bg-normal-soft px-3 py-2 text-xs text-normal">
            <AlertTriangle className="h-3.5 w-3.5" /> 리포트를 만든 뒤 우선순위나 비교 매물이 바뀌었어요.
          </p>
        )}
        {report.mode === 'fallback' && report.error && <p className="rounded-md bg-normal-soft px-3 py-2 text-xs text-normal">원인: {report.error}</p>}
        <p className="text-[15px] leading-relaxed">{out.summary}</p>

        {out.conditional_picks.length > 0 && (
          <div className="grid gap-2 md:grid-cols-3">
            {out.conditional_picks.map((p, i) => (
              <div key={i} className="rounded-lg border border-primary/25 bg-brand-soft/50 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Lightbulb className="h-3.5 w-3.5" /> {p.condition}
                </div>
                <div className="mt-1 font-semibold">{byId[p.listing_id]?.nickname}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">{p.reason}</div>
              </div>
            ))}
          </div>
        )}

        <div className={cn('grid gap-3', out.per_listing.length >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2')}>
          {out.per_listing.map((p) => {
            const s = byId[p.listing_id]
            return (
              <div key={p.listing_id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <div>
                  <div className="font-semibold">{s?.nickname}</div>
                  <div className="text-[13px] text-muted-foreground">{p.one_liner}</div>
                </div>
                {p.strengths.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {p.strengths.map((x, i) => (
                      <li key={i} className="text-[13px] leading-relaxed">
                        <span className="mr-1 font-semibold text-good">+</span>
                        {x.text} <EvidenceChips ids={x.evidence} score={s} />
                      </li>
                    ))}
                  </ul>
                )}
                {p.watch_outs.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {p.watch_outs.map((x, i) => (
                      <li key={i} className="text-[13px] leading-relaxed">
                        <span className="mr-1 font-semibold text-bad">−</span>
                        {x.text} <EvidenceChips ids={x.evidence} score={s} />
                      </li>
                    ))}
                  </ul>
                )}
                {p.check_before_decide.length > 0 && (
                  <div className="mt-auto rounded-md bg-unknown-soft p-2.5 text-xs">
                    <div className="mb-1 font-semibold text-unknown">결정 전 확인</div>
                    {p.check_before_decide.join(' · ')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
          {out.closing} 최종 결정은 직접 내려 주세요. 이 리포트는 주거 안전이나 법적 문제가 없음을 보장하지 않습니다.
          {out.dropped_claims > 0 && ` · 근거를 확인할 수 없는 문장 ${out.dropped_claims}개는 표시하지 않았어요.`}
        </p>
      </CardContent>
    </Card>
  )
}
