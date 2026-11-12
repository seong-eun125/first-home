import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight, CalendarDays, Check, FileText, KeyRound, Lightbulb, PackageCheck, Plus, Scale, ShieldCheck, Trash2, Undo2, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared'
import { PHASE_LABEL } from '@/lib/constants'
import type { HomeCost, HomeData, HomeItem } from '@/lib/types'
import { cn, daysUntil, formatDate, won, wonFull } from '@/lib/utils'

export default function HomePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: home, isLoading } = useQuery({ queryKey: ['home'], queryFn: api.home })
  const [undoOpen, setUndoOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'tasks'

  const apply = (h: HomeData) => qc.setQueryData(['home'], h)
  const onErr = (e: Error) => toast.error(e.message)

  const updateHome = useMutation({ mutationFn: api.updateHome, onSuccess: apply, onError: onErr })
  const undo = useMutation({
    mutationFn: api.undoDecision,
    onSuccess: async () => {
      await qc.invalidateQueries()
      toast.success('결정을 취소했어요. 매물은 다시 후보로 돌아갔어요.')
      navigate('/compare')
    },
    onError: onErr,
  })

  if (isLoading) return <Skeleton className="h-96" />
  if (!home) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-[28px]">입주 준비</h1>
        <EmptyState
          icon={KeyRound}
          title="아직 최종 선택한 집이 없어요"
          description="매물 상세 화면에서 '이 집으로 결정'을 누르면, 그 집의 정보로 계약·이사·입주 준비 목록과 초기 비용이 자동으로 만들어져요."
          action={
            <Button asChild>
              <Link to="/compare">매물 비교하러 가기</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const d = daysUntil(home.move_in_date)
  const pct = Math.round((home.progress.done / Math.max(home.progress.total, 1)) * 100)

  return (
    <div className="flex flex-col gap-5">
      <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-white sm:p-7">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[13px] font-medium text-white/70">최종 선택한 집</div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{home.listing?.nickname}</h1>
            <p className="mt-1 text-sm text-white/75">
              {home.listing?.address} · {home.listing?.monthly_rent === 0 ? `전세금 ${won(home.listing?.deposit)}` : `보증금 ${won(home.listing?.deposit)} / 월세 ${won(home.listing?.monthly_rent)}`}
            </p>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <div className="text-[13px] text-white/70">입주 예정일</div>
              <input
                type="date"
                value={home.move_in_date ?? ''}
                onChange={(e) => updateHome.mutate({ move_in_date: e.target.value || null })}
                className="mt-1 rounded-md border border-white/25 bg-white/10 px-2 py-1 text-sm text-white [color-scheme:dark]"
                aria-label="입주 예정일"
              />
            </div>
            {d !== null && (
              <div className="text-right">
                <div className="tabular text-4xl font-bold leading-none">{d > 0 ? `D-${d}` : d === 0 ? 'D-DAY' : `+${-d}`}</div>
              </div>
            )}
          </div>
        </div>
        <div className="relative z-10 mt-6 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular text-sm">준비 {pct}%</span>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/5" />
      </div>

      <div className="flex gap-2.5 rounded-lg border border-border bg-background p-3.5 text-[13px] text-muted-foreground">
        <Scale className="mt-0.5 h-4 w-4 shrink-0" />
        계약·행정 관련 항목은 확인을 돕는 일반 안내이며 법률 자문이 아니에요. 구체적인 절차와 기한은 정부24·인터넷등기소 등 공식 안내를 확인하고, 판단이 어려우면 전문가에게 문의하세요.
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams(v === 'tasks' ? {} : { tab: v })}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="tasks">
            <CalendarDays className="h-4 w-4" /> 할 일
          </TabsTrigger>
          <TabsTrigger value="items">
            <PackageCheck className="h-4 w-4" /> 필수템
          </TabsTrigger>
          <TabsTrigger value="costs">
            <Wallet className="h-4 w-4" /> 비용
          </TabsTrigger>
          <TabsTrigger value="contract">
            <FileText className="h-4 w-4" /> 계약 내용 대조
            {home.contract.mismatches.length > 0 && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-bad" />}
          </TabsTrigger>
          <TabsTrigger value="settle">
            <Lightbulb className="h-4 w-4" /> 생활 정착
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4">
          <Tasks home={home} apply={apply} />
        </TabsContent>
        <TabsContent value="items" className="mt-4">
          <Items home={home} apply={apply} />
        </TabsContent>
        <TabsContent value="costs" className="mt-4">
          <Costs home={home} apply={apply} />
        </TabsContent>
        <TabsContent value="contract" className="mt-4">
          <Contract home={home} onSave={(b) => updateHome.mutate(b, { onSuccess: () => toast.success('계약 내용을 저장했어요.') })} />
        </TabsContent>
        <TabsContent value="settle" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {home.settle_tips.map((t, i) => (
              <Card key={i}>
                <CardContent className="flex gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
                    <Lightbulb className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">
                      {t.title}
                      {t.item_id && <Badge variant="muted" className="ml-2">내 체크 기록 기반</Badge>}
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t.text}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setUndoOpen(true)} className="text-muted-foreground">
          <Undo2 /> 결정 취소하기
        </Button>
      </div>

      <Dialog open={undoOpen} onOpenChange={setUndoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>결정을 취소할까요?</DialogTitle>
            <DialogDescription>입주 준비 할 일·비용·계약 대조 기록이 삭제되고, 매물은 다시 후보 상태로 돌아가요. 매물의 체크 기록은 그대로 남아요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUndoOpen(false)}>
              닫기
            </Button>
            <Button variant="destructive" onClick={() => undo.mutate()} disabled={undo.isPending}>
              결정 취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Tasks({ home, apply }: { home: HomeData; apply: (h: HomeData) => void }) {
  const [title, setTitle] = useState('')
  const [phase, setPhase] = useState('moving')
  const toggle = useMutation({ mutationFn: ({ id, done }: { id: number; done: boolean }) => api.updateTask(id, { done }), onSuccess: apply, onError: (e: Error) => toast.error(e.message) })
  const del = useMutation({ mutationFn: api.deleteTask, onSuccess: apply })
  const add = useMutation({
    mutationFn: () => api.addTask({ title, phase }),
    onSuccess: (h) => {
      apply(h)
      setTitle('')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Object.keys(PHASE_LABEL).map((p) => {
        const tasks = home.tasks.filter((t) => t.phase === p)
        const done = tasks.filter((t) => t.done).length
        return (
          <Card key={p}>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle>{PHASE_LABEL[p]}</CardTitle>
              <span className="tabular text-xs text-muted-foreground">
                {done}/{tasks.length}
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {tasks.map((t) => {
                const dd = daysUntil(t.due_date)
                const overdue = !t.done && dd !== null && dd < 0
                return (
                  <div key={t.id} className="group flex gap-3 rounded-lg px-2 py-2.5 hover:bg-surface">
                    <button
                      onClick={() => toggle.mutate({ id: t.id, done: !t.done })}
                      className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border cursor-pointer', t.done ? 'border-primary bg-primary text-white' : 'border-input bg-background')}
                      aria-label={t.done ? '완료 취소' : '완료'}
                    >
                      {t.done && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm font-medium', t.done && 'text-muted-foreground line-through')}>{t.title}</div>
                      {t.detail && !t.done && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.detail}</p>}
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      {t.due_date && <span className={cn('tabular text-xs', overdue ? 'font-semibold text-bad' : 'text-muted-foreground')}>{formatDate(t.due_date)}</span>}
                      {t.source === 'user' && (
                        <button onClick={() => del.mutate(t.id)} className="text-muted-foreground opacity-0 hover:text-bad group-hover:opacity-100 cursor-pointer" aria-label="삭제">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
      <Card className="lg:col-span-2">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
          <select value={phase} onChange={(e) => setPhase(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-2 text-sm">
            {Object.entries(PHASE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="할 일 직접 추가 (예: 커튼 사이즈 재기)" maxLength={200} onKeyDown={(e) => e.key === 'Enter' && title.trim() && add.mutate()} />
          <Button onClick={() => add.mutate()} disabled={!title.trim() || add.isPending}>
            <Plus /> 추가
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function CostRow({ c, apply }: { c: HomeCost; apply: (h: HomeData) => void }) {
  const [val, setVal] = useState(String(c.amount / 10_000))
  useEffect(() => setVal(String(c.amount / 10_000)), [c.amount])
  const upd = useMutation({ mutationFn: (amount: number) => api.updateCost(c.id, { amount }), onSuccess: apply, onError: (e: Error) => toast.error(e.message) })
  const del = useMutation({ mutationFn: () => api.deleteCost(c.id), onSuccess: apply })
  return (
    <div className="group flex items-center gap-3 py-2">
      <span className="flex-1 text-sm">
        {c.label}
        {c.source === 'listing' && <Badge variant="muted" className="ml-2">매물 기록</Badge>}
        {c.refundable && <Badge variant="good" className="ml-1">돌려받는 돈</Badge>}
      </span>
      <div className="relative w-32">
        <Input
          inputMode="decimal"
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, ''))}
          onBlur={() => {
            const amount = Math.round(Number(val || 0) * 10_000)
            if (amount !== c.amount) upd.mutate(amount)
          }}
          className="h-9 pr-10 text-right tabular"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">만원</span>
      </div>
      <button onClick={() => del.mutate()} className="text-muted-foreground opacity-0 hover:text-bad group-hover:opacity-100 cursor-pointer" aria-label="삭제">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function Costs({ home, apply }: { home: HomeData; apply: (h: HomeData) => void }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<'initial' | 'monthly'>('initial')
  const add = useMutation({
    mutationFn: () => api.addCost({ kind, label, amount: Math.round(Number(amount || 0) * 10_000) }),
    onSuccess: (h) => {
      apply(h)
      setLabel('')
      setAmount('')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const cs = home.cost_summary
  const over = cs.monthly_budget !== null && cs.monthly_total > cs.monthly_budget
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_18rem]">
      {(['initial', 'monthly'] as const).map((k) => (
        <Card key={k}>
          <CardHeader className="pb-1">
            <CardTitle>{k === 'initial' ? '초기 비용' : '월 고정비'}</CardTitle>
            <CardDescription>{k === 'initial' ? '입주할 때 한 번 드는 돈' : '매달 나가는 돈'}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {home.costs
              .filter((c) => c.kind === k)
              .map((c) => (
                <CostRow key={c.id} c={c} apply={apply} />
              ))}
          </CardContent>
        </Card>
      ))}
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div>
              <div className="text-xs text-muted-foreground">초기 비용 합계</div>
              <div className="tabular text-2xl font-bold">{wonFull(cs.initial_total)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">보증금 제외 실제 지출 {wonFull(cs.initial_non_refundable)}</div>
            </div>
            <div className="border-t border-border pt-4">
              <div className="text-xs text-muted-foreground">월 고정비 합계</div>
              <div className={cn('tabular text-2xl font-bold', over && 'text-bad')}>{wonFull(cs.monthly_total)}</div>
              {cs.monthly_budget !== null && (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', over ? 'bg-bad' : 'bg-primary')} style={{ width: `${Math.min(100, (cs.monthly_total / cs.monthly_budget) * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    예산 {wonFull(cs.monthly_budget)} {over ? `· ${wonFull(cs.monthly_total - cs.monthly_budget)} 초과` : `· ${wonFull(cs.monthly_budget - cs.monthly_total)} 남음`}
                  </div>
                </>
              )}
            </div>
            <p className="flex gap-1.5 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> 중개보수는 법정 상한 안에서 중개사와 정하므로 실제 금액을 입력하세요.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <Label>항목 추가</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
              {(['initial', 'monthly'] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={cn('rounded-md py-1.5 text-xs font-medium cursor-pointer', kind === k ? 'bg-background shadow-soft' : 'text-muted-foreground')}>
                  {k === 'initial' ? '초기 비용' : '월 고정비'}
                </button>
              ))}
            </div>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="항목 이름 (예: 커튼)" maxLength={100} />
            <div className="relative">
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="금액" className="pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">만원</span>
            </div>
            <Button onClick={() => add.mutate()} disabled={!label.trim() || add.isPending}>
              <Plus /> 추가
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Contract({ home, onSave }: { home: HomeData; onSave: (b: Record<string, unknown>) => void }) {
  const c = home.contract
  const [f, setF] = useState({
    deposit: c.deposit !== null ? String(c.deposit / 10_000) : '',
    rent: c.rent !== null ? String(c.rent / 10_000) : '',
    maintenance: c.maintenance !== null ? String(c.maintenance / 10_000) : '',
    start: c.start ?? '',
    end: c.end ?? '',
  })
  const toWon = (v: string) => (v === '' ? null : Math.round(Number(v) * 10_000))
  const rows = [
    { key: 'deposit', label: home.listing?.monthly_rent === 0 ? '전세금' : '보증금', rec: home.listing?.deposit },
    { key: 'rent', label: '월세', rec: home.listing?.monthly_rent },
    { key: 'maintenance', label: '관리비', rec: home.listing?.maintenance_fee },
  ] as const
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>계약서에 적힌 금액 입력</CardTitle>
          <CardDescription>계약서 금액을 입력하면 현장에서 기록한 매물 정보와 다른 부분을 표시해요. 계약서 원문은 저장하지 않아요.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.map((r) => {
            const mm = c.mismatches.find((m) => m.label === r.label)
            return (
              <div key={r.key} className={cn('grid items-center gap-3 rounded-lg border p-3 sm:grid-cols-[5rem_1fr_1fr]', mm ? 'border-bad/40 bg-bad-soft/40' : 'border-border')}>
                <span className="text-sm font-medium">{r.label}</span>
                <div className="text-[13px] text-muted-foreground">
                  매물 기록 <b className="tabular text-foreground">{wonFull(r.rec)}</b>
                </div>
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={f[r.key]}
                    onChange={(e) => setF((p) => ({ ...p, [r.key]: e.target.value.replace(/[^\d.]/g, '') }))}
                    placeholder="계약서 금액"
                    className="pr-12 tabular"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">만원</span>
                </div>
                {mm && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-bad sm:col-span-3">
                    <AlertTriangle className="h-3.5 w-3.5" /> 매물 기록({wonFull(mm.listing_value)})과 계약서({wonFull(mm.contract_value)})가 달라요. 계약 전에 꼭 확인하세요.
                  </p>
                )}
              </div>
            )
          })}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>계약 시작일</Label>
              <Input type="date" value={f.start} onChange={(e) => setF((p) => ({ ...p, start: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>계약 종료일</Label>
              <Input type="date" value={f.end} onChange={(e) => setF((p) => ({ ...p, end: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() =>
                onSave({
                  contract_deposit: toWon(f.deposit),
                  contract_rent: toWon(f.rent),
                  contract_maintenance: toWon(f.maintenance),
                  contract_start: f.start || null,
                  contract_end: f.end || null,
                })
              }
            >
              대조하기
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>계약 전 함께 확인할 것</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-[13px]">
          {home.tasks
            .filter((t) => t.phase === 'contract')
            .map((t) => (
              <div key={t.id} className="flex gap-2">
                <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', t.done ? 'bg-primary' : 'bg-border')} />
                <span className={cn(t.done && 'text-muted-foreground line-through')}>{t.title}</span>
              </div>
            ))}
          <Link
            to="/guide"
            className="mt-2 flex items-center gap-2.5 rounded-lg border border-primary/25 bg-brand-soft/60 p-3 text-[13px] font-medium text-primary hover:bg-brand-soft"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="flex-1">보증금 지키기 가이드 (전세사기 예방 3·3·3법칙)</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-2 rounded-lg bg-surface p-3 text-xs leading-relaxed text-muted-foreground">
            AI 계약서 분석(PDF 요약·확인 필요 조항)은 확장 기능으로 설계되어 있으며, 현재 버전에는 포함되어 있지 않아요.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}


const ITEM_STATUS: { value: HomeItem['status']; label: string }[] = [
  { value: 'todo', label: '살 것' },
  { value: 'bought', label: '샀음' },
  { value: 'have', label: '이미 있음' },
  { value: 'skip', label: '안 삼' },
]

function Items({ home, apply }: { home: HomeData; apply: (h: HomeData) => void }) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState('week1')
  const upd = useMutation({ mutationFn: ({ id, status }: { id: number; status: string }) => api.updateItem(id, status), onSuccess: apply, onError: (e: Error) => toast.error(e.message) })
  const del = useMutation({ mutationFn: api.deleteItem, onSuccess: apply })
  const add = useMutation({
    mutationFn: () => api.addItem({ name, group }),
    onSuccess: (h) => {
      apply(h)
      setName('')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const items = home.items ?? []
  const groups = home.item_groups ?? {}
  const done = items.filter((i) => i.status !== 'todo').length
  const todoHigh = items.filter((i) => i.status === 'todo' && i.priority === 'high')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="text-sm font-semibold">'{home.listing?.nickname}' 맞춤 필수템</div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            옵션에 있는 물건은 '이미 있음'으로, 현장 체크 기록과 생활 패턴에 맞는 물건은 '우선'으로 표시했어요. 특정 상품은 추천하지 않아요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / Math.max(items.length, 1)) * 100}%` }} />
          </div>
          <span className="tabular text-sm font-medium">
            {done}/{items.length} 정리
          </span>
        </div>
      </div>
      {todoHigh.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="font-medium text-primary">우리 집에 특히 필요해요</span>
          {todoHigh.map((i) => (
            <Badge key={i.id} variant="default">
              {i.name}
            </Badge>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(groups).map(([g, label]) => {
          const list = items.filter((i) => i.group === g)
          if (!list.length) return null
          return (
            <Card key={g}>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle>{label}</CardTitle>
                <span className="tabular text-xs text-muted-foreground">
                  {list.filter((i) => i.status !== 'todo').length}/{list.length}
                </span>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border">
                {list.map((i) => (
                  <div key={i.id} className="group flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className={cn('flex flex-wrap items-center gap-1.5 text-sm font-medium', ['bought', 'have', 'skip'].includes(i.status) && 'text-muted-foreground')}>
                        <span className={cn(i.status === 'skip' && 'line-through')}>{i.name}</span>
                        {i.priority === 'high' && i.status === 'todo' && <Badge variant="default">우선</Badge>}
                        {i.source === 'user' && <Badge variant="muted">직접 추가</Badge>}
                      </div>
                      {i.reason && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.reason}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="flex rounded-lg bg-surface p-0.5">
                        {ITEM_STATUS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => i.status !== s.value && upd.mutate({ id: i.id, status: s.value })}
                            className={cn(
                              'rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer',
                              i.status === s.value ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                              i.status === s.value && s.value === 'bought' && 'text-good',
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      {i.source === 'user' && (
                        <button onClick={() => del.mutate(i.id)} className="p-1 text-muted-foreground opacity-0 hover:text-bad group-hover:opacity-100 cursor-pointer" aria-label="삭제">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-10 rounded-lg border border-input bg-background px-2 text-sm">
            {Object.entries(groups).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="필요한 물건 직접 추가 (예: 전신 거울)" maxLength={100} onKeyDown={(e) => e.key === 'Enter' && name.trim() && add.mutate()} />
          <Button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending}>
            <Plus /> 추가
          </Button>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        구매 비용은 '비용' 탭의 '가구·생활용품 구매' 항목에 합계로 적어 두면 초기 비용에 반영돼요.{' '}
        <Link to="/guide?tab=essentials" className="font-medium text-primary">
          필수템 가이드 전체 보기
        </Link>
      </p>
    </div>
  )
}
