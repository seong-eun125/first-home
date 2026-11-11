import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, CircleCheck, CircleMinus, HelpCircle, Loader2, MessageCircleQuestion, RefreshCw, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { AIModeBadge, EvidenceChips } from '@/components/shared'
import type { ScoreResult } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

export function ListingReport({ listingId, score, onEvidence }: { listingId: number; score: ScoreResult; onEvidence: (id: string) => void }) {
  const qc = useQueryClient()
  const report = useQuery({ queryKey: ['ai-report', listingId], queryFn: () => api.listingReport(listingId) })
  const gen = useMutation({
    mutationFn: () => api.createListingReport(listingId),
    onSuccess: (r) => {
      qc.setQueryData(['ai-report', listingId], { ...r, stale: false })
      if (r.cached) toast.info('기록이 바뀌지 않아 저장된 분석 결과를 보여 드려요. (AI 재호출 없음)')
      else if (r.mode === 'fallback') toast.warning('AI 호출에 실패해 규칙 기반 응답으로 대체했어요.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const r = report.data
  const out = r?.output
  const usedScore = r?.score ?? score

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border bg-gradient-to-b from-brand-soft/60 to-transparent pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI 분석 리포트
          </CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">백엔드가 계산한 점수와 실제 현장 기록만 근거로 분석해요. 점수는 AI가 정하지 않아요.</p>
        </div>
        <Button size="sm" onClick={() => gen.mutate()} disabled={gen.isPending || (!!r && !r.stale)} variant={r && !r.stale ? 'outline' : 'default'}>
          {gen.isPending ? <Loader2 className="animate-spin" /> : r ? <RefreshCw /> : <Sparkles />}
          {gen.isPending ? '분석 중…' : r ? (r.stale ? '다시 분석' : '최신 상태') : '분석하기'}
        </Button>
      </CardHeader>
      <CardContent className="pt-5">
        {report.isLoading && <Skeleton className="h-40" />}
        {gen.isPending && !r && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-muted-foreground">체크 결과와 우선순위를 정리하는 중…</p>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24" />
          </div>
        )}
        {!report.isLoading && !r && !gen.isPending && (
          <div className="rounded-lg bg-surface p-5 text-sm text-muted-foreground">
            '분석하기'를 누르면 내 우선순위 관점의 장단점, 확인하지 못한 항목, 중개사에게 물어볼 질문을 정리해 드려요. 버튼을 누를 때만 AI를 호출하고, 기록이 바뀌지 않으면 저장된 결과를 다시 써요.
          </div>
        )}
        {r && out && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <AIModeBadge report={r} />
              <span>{formatDateTime(r.created_at)} 생성</span>
              {r.stale && (
                <span className="flex items-center gap-1 font-medium text-normal">
                  <AlertTriangle className="h-3.5 w-3.5" /> 이후 기록이 바뀌었어요. 다시 분석해 보세요.
                </span>
              )}
            </div>
            {r.mode === 'fallback' && r.error && <p className="rounded-md bg-normal-soft px-3 py-2 text-xs text-normal">원인: {r.error}</p>}

            <p className="text-[15px] leading-relaxed">{out.summary}</p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-good">
                  <CircleCheck className="h-4 w-4" /> 장점
                </h4>
                <ul className="flex flex-col gap-2">
                  {out.pros.length === 0 && <li className="text-[13px] text-muted-foreground">근거가 있는 장점이 아직 없어요.</li>}
                  {out.pros.map((p, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-[13px] leading-relaxed">
                      {p.text}
                      <div className="mt-1.5">
                        <EvidenceChips ids={p.evidence} score={usedScore} onSelect={onEvidence} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-bad">
                  <CircleMinus className="h-4 w-4" /> 단점·감수할 점
                </h4>
                <ul className="flex flex-col gap-2">
                  {out.cons.length === 0 && <li className="text-[13px] text-muted-foreground">근거가 있는 단점이 아직 없어요.</li>}
                  {out.cons.map((p, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-[13px] leading-relaxed">
                      {p.text}
                      <div className="mt-1.5">
                        <EvidenceChips ids={p.evidence} score={usedScore} onSelect={onEvidence} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {out.unverified.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-unknown">
                  <HelpCircle className="h-4 w-4" /> 확인되지 않은 중요 항목
                </h4>
                <ul className="flex flex-col gap-2">
                  {out.unverified.map((u) => {
                    const label = usedScore.unverified.find((x) => x.item_id === u.item_id)?.label ?? u.item_id
                    return (
                      <li key={u.item_id} className="rounded-lg border border-dashed border-unknown/40 bg-unknown-soft/50 p-3 text-[13px]">
                        <div className="font-semibold">{label}</div>
                        <div className="mt-1 text-muted-foreground">왜 중요한가요 · {u.why_it_matters}</div>
                        <div className="mt-0.5 text-muted-foreground">어떻게 확인하나요 · {u.how_to_check}</div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {out.questions_to_ask.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
                  <MessageCircleQuestion className="h-4 w-4 text-primary" /> 중개사·임대인에게 물어볼 것
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {out.questions_to_ask.map((q, i) => (
                    <li key={i} className="rounded-lg bg-surface px-3 py-2 text-[13px]">
                      “{q}”
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
              {out.decision_note}
              {out.dropped_claims > 0 && ` · 근거를 확인할 수 없는 문장 ${out.dropped_claims}개는 표시하지 않았어요.`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
