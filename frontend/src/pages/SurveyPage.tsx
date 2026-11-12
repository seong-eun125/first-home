/** 서비스 만족도 설문 (5점 척도 10문항 + 주관식 2개, 1인 1응답·수정 가능) */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CheckCircle2, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { IconTile } from '@/components/illustrations'
import { cn } from '@/lib/utils'

export default function SurveyPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['survey'], queryFn: api.survey })
  const [segment, setSegment] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [good, setGood] = useState('')
  const [improve, setImprove] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (data?.mine) {
      setSegment(data.mine.segment)
      setScores(data.mine.scores)
      setGood(data.mine.good_text ?? '')
      setImprove(data.mine.improve_text ?? '')
    }
  }, [data?.mine])

  const save = useMutation({
    mutationFn: () => api.submitSurvey({ segment, scores, good_text: good, improve_text: improve }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['survey'] })
      setDone(true)
      toast.success('소중한 의견 감사합니다!')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />
  const answered = data.questions.filter((q) => scores[q.id]).length
  const total = data.questions.length

  if (done) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-3xl bg-good-soft px-6 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-good" />
        <h1 className="text-2xl font-bold">설문에 참여해 주셔서 감사해요</h1>
        <p className="text-sm leading-relaxed text-foreground/75">남겨 주신 의견은 FIRST HOME을 개선하는 데 사용할게요. 응답은 언제든 다시 수정할 수 있어요.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/">홈으로</Link>
          </Button>
          <Button variant="outline" onClick={() => setDone(false)}>
            응답 수정하기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-3xl bg-[#F7F2EA] p-6 sm:flex-row sm:items-center sm:p-8">
        <IconTile kind="clipboard" size="lg" className="bg-white" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">FIRST HOME 사용 후기 설문</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
            약 2분 · 10문항과 의견 2개예요. 결과는 익명으로 묶어서만 보여 주고, 이름과 이메일은 공개되지 않아요.
          </p>
        </div>
        {data.is_admin && (
          <Button asChild variant="outline" className="shrink-0 bg-white">
            <Link to="/survey/results">
              <BarChart3 /> 결과 보기
            </Link>
          </Button>
        )}
      </section>

      {data.mine && (
        <div className="rounded-xl bg-brand-soft p-3.5 text-[13px] text-primary">이미 참여하셨어요. 답을 바꾸고 다시 제출하면 수정돼요.</div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="text-[15px] font-semibold">지금 어떤 상황이세요? (선택)</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.segments.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSegment(segment === s.value ? null : s.value)}
                aria-pressed={segment === s.value}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-[13px] cursor-pointer',
                  segment === s.value ? 'border-primary bg-brand-soft font-semibold text-primary' : 'border-border bg-background text-muted-foreground',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky top-14 z-20 -mx-1 rounded-xl bg-background/90 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-semibold">
            {answered} / {total} 문항 응답
          </span>
          <span className="text-muted-foreground">1 = 전혀 아니다 · 5 = 매우 그렇다</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {data.questions.map((q, i) => (
          <li key={q.id}>
            <Card className={cn(scores[q.id] && 'border-primary/30')}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-2.5">
                  <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">{i + 1}</span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-primary">{q.area}</span>
                    <p id={`${q.id}-label`} className="text-[15px] font-medium leading-snug">
                      {q.text}
                    </p>
                  </div>
                </div>
                <div role="radiogroup" aria-labelledby={`${q.id}-label`} className="mt-4 grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={scores[q.id] === v}
                      aria-label={`${v}점 ${data.scale[v - 1]}`}
                      onClick={() => setScores((p) => ({ ...p, [q.id]: v }))}
                      className={cn(
                        'flex h-11 items-center justify-center rounded-xl border text-[15px] font-semibold transition-colors cursor-pointer',
                        scores[q.id] === v ? 'border-primary bg-primary text-white' : 'border-border bg-background hover:border-primary/40',
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                  <span>{data.scale[0]}</span>
                  <span>{data.scale[4]}</span>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {data.open.map((o) => (
            <label key={o.id} className="flex flex-col gap-1.5">
              <span className="text-[15px] font-semibold">
                {o.text} <span className="text-[12px] font-normal text-muted-foreground">(선택)</span>
              </span>
              <Textarea
                rows={3}
                maxLength={1000}
                value={o.id === 'good_text' ? good : improve}
                onChange={(e) => (o.id === 'good_text' ? setGood(e.target.value) : setImprove(e.target.value))}
                placeholder={o.id === 'good_text' ? '예) AI 판정이 예산까지 같이 봐 줘서 좋았어요' : '예) 지도에서 위치를 같이 보고 싶어요'}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Button size="lg" disabled={answered < total || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        {answered < total ? `${total - answered}문항 남았어요` : data.mine ? '수정해서 제출하기' : '설문 제출하기'}
      </Button>
    </div>
  )
}
