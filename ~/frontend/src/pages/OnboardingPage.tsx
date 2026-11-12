import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/misc'
import { Logo } from '@/components/AppShell'
import { CATEGORY_META, CATEGORY_ORDER } from '@/lib/constants'
import type { Answers, CategoryKey, ProfileInput } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEPS = ['가장 중요한 조건', '생활 패턴', '예산·거리', '절대 조건', '나의 우선순위']

type Opt<T extends string> = { value: T; label: string; hint?: string }
const QUESTIONS: { key: keyof Answers; title: string; options: Opt<string>[] }[] = [
  {
    key: 'noise_sensitivity',
    title: '잠귀나 소리에 얼마나 예민한가요?',
    options: [
      { value: 'low', label: '둔한 편', hint: '어디서든 잘 자요' },
      { value: 'mid', label: '보통' },
      { value: 'high', label: '예민한 편', hint: '작은 소리에도 깨요' },
    ],
  },
  {
    key: 'return_time',
    title: '주로 언제 귀가하나요?',
    options: [
      { value: 'early', label: '이른 저녁' },
      { value: 'normal', label: '보통' },
      { value: 'late', label: '밤 늦게 자주', hint: '귀갓길·보안이 중요' },
    ],
  },
  {
    key: 'bug_sensitivity',
    title: '벌레에 얼마나 민감한가요?',
    options: [
      { value: 'low', label: '괜찮아요' },
      { value: 'mid', label: '보통' },
      { value: 'high', label: '매우 민감해요' },
    ],
  },
  {
    key: 'cooking',
    title: '집에서 요리를 얼마나 하나요?',
    options: [
      { value: 'rarely', label: '거의 안 해요' },
      { value: 'sometimes', label: '가끔' },
      { value: 'often', label: '자주 해요', hint: '주방·설비가 중요' },
    ],
  },
  {
    key: 'cost_sensitivity',
    title: '비용은 어느 정도로 중요한가요?',
    options: [
      { value: 'low', label: '조건이 우선' },
      { value: 'mid', label: '보통' },
      { value: 'high', label: '비용이 가장 중요' },
    ],
  },
]

function Choice({ selected, onClick, label, hint }: { selected: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-start rounded-lg border px-3.5 py-3 text-left transition-colors cursor-pointer',
        selected ? 'border-primary bg-brand-soft' : 'border-border bg-background hover:border-primary/40',
      )}
    >
      <span className={cn('text-sm font-semibold', selected && 'text-primary')}>{label}</span>
      {hint && <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span>}
    </button>
  )
}

export default function OnboardingPage({ firstTime, embedded = false }: { firstTime: boolean; embedded?: boolean }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data } = useQuery({ queryKey: ['profile'], queryFn: api.profile })
  const [step, setStep] = useState(0)
  const [top, setTop] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answers>({
    noise_sensitivity: 'mid',
    return_time: 'normal',
    bug_sensitivity: 'mid',
    cooking: 'sometimes',
    cost_sensitivity: 'mid',
    work_from_home: false,
  })
  const [budget, setBudget] = useState('')
  const [deposit, setDeposit] = useState('')
  const [dest, setDest] = useState('')
  const [walk, setWalk] = useState('10')
  const [deals, setDeals] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, number> | null>(null)
  const [touchedWeights, setTouchedWeights] = useState(false)

  useEffect(() => {
    const p = data?.profile
    if (!p) return
    setTop(p.top_priorities ?? [])
    setAnswers((a) => ({ ...a, ...p.answers }))
    setBudget(p.monthly_budget ? String(p.monthly_budget / 10_000) : '')
    setDeposit(p.deposit_budget ? String(p.deposit_budget / 10_000) : '')
    setDest(p.destination_label ?? '')
    setWalk(p.max_walk_minutes ? String(p.max_walk_minutes) : '')
    setDeals(p.dealbreakers ?? [])
    if (p.onboarding_done) {
      setWeights(data.weights)
      setTouchedWeights(true)
    }
  }, [data])

  const body: ProfileInput = useMemo(
    () => ({
      answers,
      top_priorities: top,
      monthly_budget: budget ? Math.round(Number(budget) * 10_000) : null,
      deposit_budget: deposit ? Math.round(Number(deposit) * 10_000) : null,
      destination_label: dest || null,
      max_walk_minutes: walk ? Number(walk) : null,
      dealbreakers: deals,
    }),
    [answers, top, budget, deposit, dest, walk, deals],
  )

  // 마지막 단계에 들어가면 답변 기반 추천 가중치를 서버에서 계산
  useEffect(() => {
    if (step !== 4 || touchedWeights) return
    api.suggestWeights(body).then((r) => setWeights(r.weights)).catch((e) => toast.error(e.message))
  }, [step, body, touchedWeights])

  const save = useMutation({
    mutationFn: () => api.saveProfile({ ...body, weights: weights ?? undefined }),
    onSuccess: async () => {
      await qc.invalidateQueries()
      toast.success('내 기준을 저장했어요. 점수가 이 기준으로 다시 계산됩니다.')
      navigate(firstTime ? '/' : '/settings')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleTop = (c: string) =>
    setTop((t) => (t.includes(c) ? t.filter((x) => x !== c) : t.length >= 2 ? [t[1], c] : [...t, c]))

  const content = (
    <div className={cn('mx-auto w-full', embedded ? 'max-w-3xl' : 'max-w-2xl')}>
      {!embedded && <Logo className="mb-10" />}
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="font-medium text-primary">
          {step + 1} / {STEPS.length} · {STEPS[step]}
        </span>
        {embedded && <span className="text-muted-foreground">저장하면 모든 매물 점수가 새 기준으로 계산돼요</span>}
      </div>
      <div className="mb-8 grid grid-cols-5 gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            aria-label={s}
            className={cn('h-1 rounded-full cursor-pointer', i <= step ? 'bg-primary' : 'bg-muted')}
          />
        ))}
      </div>

      {step === 0 && (
        <section>
          <h1 className="text-2xl font-bold tracking-tight">집을 고를 때 가장 중요한 건 무엇인가요?</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">1~2개를 고르세요. 자취하는 이유와 연결된 조건일수록 좋아요.</p>
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CATEGORY_ORDER.map((c) => {
              const M = CATEGORY_META[c]
              const on = top.includes(c)
              return (
                <button
                  key={c}
                  onClick={() => toggleTop(c)}
                  className={cn(
                    'relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer',
                    on ? 'border-primary bg-brand-soft' : 'border-border bg-background hover:border-primary/40',
                  )}
                >
                  <M.icon className={cn('h-5 w-5', on ? 'text-primary' : 'text-muted-foreground')} />
                  <div>
                    <div className="text-sm font-semibold">{M.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{M.desc}</div>
                  </div>
                  {on && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                      {top.indexOf(c) + 1}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-7">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">생활 패턴을 알려 주세요</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">답변은 카테고리 가중치로 바뀌어 매물 평가에 반영돼요.</p>
          </div>
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <Label className="text-sm">{q.title}</Label>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                {q.options.map((o) => (
                  <Choice
                    key={o.value}
                    label={o.label}
                    hint={o.hint}
                    selected={answers[q.key] === o.value}
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [q.key]: o.value }))
                      setTouchedWeights(false)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <label className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3.5">
            <div>
              <div className="text-sm font-semibold">집에서 공부하거나 재택근무를 자주 해요</div>
              <div className="text-xs text-muted-foreground">채광·소음 가중치가 올라가요</div>
            </div>
            <Switch
              checked={!!answers.work_from_home}
              onCheckedChange={(v) => {
                setAnswers((a) => ({ ...a, work_from_home: v }))
                setTouchedWeights(false)
              }}
            />
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">예산과 거리 기준</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">비용 점수와 도보 시간 점수에 쓰여요. 모르면 비워 두어도 돼요.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget">월 고정비 상한 (월세+관리비)</Label>
              <div className="relative">
                <Input id="budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ''))} placeholder="60" className="pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">만원</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deposit">보증금 상한</Label>
              <div className="relative">
                <Input id="deposit" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/[^\d.]/g, ''))} placeholder="1000" className="pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">만원</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dest">자주 가는 곳 (학교·회사·역)</Label>
              <Input id="dest" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="예: 학교 정문" maxLength={100} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="walk">걸어서 최대 몇 분까지 괜찮나요?</Label>
              <div className="relative">
                <Input id="walk" inputMode="numeric" value={walk} onChange={(e) => setWalk(e.target.value.replace(/\D/g, ''))} placeholder="10" className="pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">분</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1 className="text-2xl font-bold tracking-tight">절대 안 되는 조건이 있나요?</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">해당하는 매물은 점수와 별개로 '조건 불일치'로 표시되고 순위 맨 뒤로 가요.</p>
          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {Object.entries(data?.dealbreaker_options ?? {}).map(([code, label]) => {
              const on = deals.includes(code)
              return (
                <button
                  key={code}
                  onClick={() => setDeals((d) => (on ? d.filter((x) => x !== code) : [...d, code]))}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left text-sm font-medium transition-colors cursor-pointer',
                    on ? 'border-primary bg-brand-soft text-primary' : 'border-border bg-background hover:border-primary/40',
                  )}
                >
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded border', on ? 'border-primary bg-primary text-white' : 'border-input')}>
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {label}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          <h1 className="text-2xl font-bold tracking-tight">이렇게 우선순위를 정했어요</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">답변으로 계산한 가중치예요. 직접 조절할 수도 있어요 (1 = 덜 중요, 5 = 매우 중요).</p>
          <div className="mt-6 flex flex-col gap-1 rounded-xl border border-border bg-background p-2">
            {!weights && <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {weights &&
              CATEGORY_ORDER.map((c: CategoryKey) => {
                const M = CATEGORY_META[c]
                return (
                  <div key={c} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-4 rounded-lg px-3 py-2.5 hover:bg-surface">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <M.icon className="h-4 w-4 text-muted-foreground" />
                      {M.label}
                    </div>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[weights[c] ?? 3]}
                      onValueChange={([v]) => {
                        setWeights((w) => ({ ...(w ?? {}), [c]: v }))
                        setTouchedWeights(true)
                      }}
                    />
                    <span className="tabular text-right text-sm font-bold text-primary">{weights[c]}</span>
                  </div>
                )
              })}
          </div>
          {touchedWeights && (
            <button className="mt-3 text-[13px] text-muted-foreground underline-offset-2 hover:underline cursor-pointer" onClick={() => setTouchedWeights(false)}>
              답변 기준 추천값으로 되돌리기
            </button>
          )}
        </section>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft /> 이전
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && top.length === 0}>
            다음 <ArrowRight />
          </Button>
        ) : (
          <Button onClick={() => save.mutate()} disabled={!weights || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {firstTime ? '저장하고 시작하기' : '내 기준 저장'}
          </Button>
        )}
      </div>
    </div>
  )

  if (embedded) return content
  return <div className="min-h-dvh bg-surface/60 px-5 py-10 sm:py-16">{content}</div>
}
