import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clock,
  Cloud,
  CloudOff,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { CATEGORY_META, ZONE_LABEL, ZONE_ORDER } from '@/lib/constants'
import type { Check as CheckRow, ChecklistItem } from '@/lib/types'
import { cn, formatDateTime, toLocalInputValue } from '@/lib/utils'

type Local = Record<string, { value: string; note: string | null; visit_id: number | null }>

const STATUS_OPTS = [
  { value: 'good', label: '양호', cls: 'data-[on=true]:border-good data-[on=true]:bg-good-soft data-[on=true]:text-good' },
  { value: 'normal', label: '보통', cls: 'data-[on=true]:border-normal data-[on=true]:bg-normal-soft data-[on=true]:text-normal' },
  { value: 'bad', label: '불량', cls: 'data-[on=true]:border-bad data-[on=true]:bg-bad-soft data-[on=true]:text-bad' },
]
const YESNO_OPTS = [
  { value: 'yes', label: '있음', cls: 'data-[on=true]:border-primary data-[on=true]:bg-brand-soft data-[on=true]:text-primary' },
  { value: 'no', label: '없음', cls: 'data-[on=true]:border-foreground/50 data-[on=true]:bg-muted data-[on=true]:text-foreground' },
]
const UNKNOWN_OPT = { value: 'unknown', label: '확인 못함', cls: 'data-[on=true]:border-unknown data-[on=true]:border-dashed data-[on=true]:bg-unknown-soft data-[on=true]:text-unknown' }

export default function CheckPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const listing = useQuery({ queryKey: ['listing', id], queryFn: () => api.listing(id) })
  const items = useQuery({ queryKey: ['checklist-items'], queryFn: api.checklistItems, staleTime: Infinity })
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile })

  const [local, setLocal] = useState<Local>({})
  const [visitId, setVisitId] = useState<number | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [openOptional, setOpenOptional] = useState<Record<string, boolean>>({})
  const [visitDialog, setVisitDialog] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (!listing.data || initialized.current) return
    initialized.current = true
    const map: Local = {}
    listing.data.checks.forEach((c: CheckRow) => (map[c.item_id] = { value: c.value, note: c.note, visit_id: c.visit_id }))
    setLocal(map)
    const last = listing.data.visits[listing.data.visits.length - 1]
    setVisitId(last?.id ?? null)
    if (!listing.data.visits.length) setVisitDialog(true)
  }, [listing.data])

  const weights = profile.data?.weights ?? {}
  const all = items.data ?? []
  const required = all.filter((i) => i.is_required)
  const answeredReq = required.filter((i) => local[i.id] && local[i.id].value !== 'unknown').length
  const unknownReq = required.filter((i) => local[i.id]?.value === 'unknown').length

  const zones = useMemo(() => {
    return ZONE_ORDER.map((z) => {
      const zi = all.filter((i) => i.zone === z)
      const req = zi.filter((i) => i.is_required)
      const opt = zi.filter((i) => !i.is_required)
      const recommended = opt.filter((i) => (weights[i.category] ?? 3) >= 4)
      const rest = opt.filter((i) => (weights[i.category] ?? 3) < 4)
      return { zone: z, req, recommended, rest }
    }).filter((z) => z.req.length + z.recommended.length + z.rest.length > 0)
  }, [all, weights])

  const persist = async (itemId: string, next: { value: string; note: string | null; visit_id: number | null }) => {
    setSaving('saving')
    try {
      await api.saveChecks(id, [{ item_id: itemId, value: next.value, note: next.note, visit_id: next.visit_id }])
      setSaving('saved')
      qc.invalidateQueries({ queryKey: ['scores'] })
      qc.invalidateQueries({ queryKey: ['listings'] })
      qc.invalidateQueries({ queryKey: ['listing-score', id] })
    } catch (e) {
      setSaving('error')
      toast.error((e as Error).message)
    }
  }

  const setValue = (item: ChecklistItem, value: string) => {
    const prev = local[item.id]
    const toggledOff = prev?.value === value
    const next = { value: toggledOff ? '' : value, note: prev?.note ?? null, visit_id: visitId }
    setLocal((l) => {
      const copy = { ...l }
      if (toggledOff) delete copy[item.id]
      else copy[item.id] = next
      return copy
    })
    persist(item.id, next)
  }

  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const setNote = (item: ChecklistItem, note: string) => {
    const prev = local[item.id]
    if (!prev?.value) {
      toast.info('먼저 상태를 선택한 뒤 메모를 남겨 주세요.')
      return
    }
    const next = { ...prev, note }
    setLocal((l) => ({ ...l, [item.id]: next }))
    clearTimeout(noteTimers.current[item.id])
    noteTimers.current[item.id] = setTimeout(() => persist(item.id, next), 600)
  }

  const uploadPhoto = async (item: ChecklistItem, file: File) => {
    const t = toast.loading('사진을 올리는 중…')
    try {
      await api.uploadPhoto(id, file, item.id)
      toast.success('사진을 저장했어요. (위치 정보는 자동으로 지웠어요)', { id: t })
      qc.invalidateQueries({ queryKey: ['listing', id] })
      qc.invalidateQueries({ queryKey: ['listings'] })
    } catch (e) {
      toast.error((e as Error).message, { id: t })
    }
  }

  if (listing.isLoading || items.isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (!listing.data) return <p className="text-muted-foreground">매물을 찾을 수 없습니다.</p>
  const l = listing.data
  const pct = required.length ? Math.round((answeredReq / required.length) * 100) : 0
  const photosByItem = l.photos.reduce<Record<string, number>>((acc, p) => {
    if (p.item_id) acc[p.item_id] = (acc[p.item_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-2xl">
      {/* 상단 고정: 진행률 */}
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to={`/listings/${id}`} className="rounded-md p-1 text-muted-foreground hover:bg-surface" aria-label="뒤로">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-semibold">{l.nickname}</h1>
              <span className="text-xs text-muted-foreground">현장 체크</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <span className="tabular shrink-0 text-xs font-medium">
                필수 {answeredReq}/{required.length}
                {unknownReq > 0 && <span className="text-unknown"> · 확인 못함 {unknownReq}</span>}
              </span>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground" aria-live="polite">
            {saving === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving === 'saved' && <Cloud className="h-3.5 w-3.5 text-good" />}
            {saving === 'error' && <CloudOff className="h-3.5 w-3.5 text-bad" />}
            <span className="hidden sm:inline">{saving === 'saving' ? '저장 중' : saving === 'saved' ? '자동 저장됨' : saving === 'error' ? '저장 실패' : ''}</span>
          </span>
        </div>
      </div>

      {/* 방문 기록 */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3.5">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-[13px] text-muted-foreground">지금 기록하는 방문</span>
        {l.visits.length ? (
          <select
            value={visitId ?? ''}
            onChange={(e) => setVisitId(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-[13px] font-medium"
          >
            {l.visits.map((v) => (
              <option key={v.id} value={v.id}>
                {formatDateTime(v.visited_at)} · {v.occupancy === 'occupied' ? '거주 중' : '빈집'}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[13px] font-medium">방문 기록 없음</span>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setVisitDialog(true)}>
          <Plus /> 새 방문
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {zones.map((z) => (
          <section key={z.zone}>
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              {ZONE_LABEL[z.zone]}
              <span className="h-px flex-1 bg-border" />
            </h2>
            <div className="flex flex-col gap-2.5">
              {[...z.req, ...z.recommended].map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  state={local[item.id]}
                  weight={weights[item.category] ?? 3}
                  recommended={!item.is_required}
                  photos={photosByItem[item.id] ?? 0}
                  onValue={(v) => setValue(item, v)}
                  onNote={(n) => setNote(item, n)}
                  onPhoto={(f) => uploadPhoto(item, f)}
                />
              ))}
              {z.rest.length > 0 && (
                <>
                  <button
                    onClick={() => setOpenOptional((o) => ({ ...o, [z.zone]: !o[z.zone] }))}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    선택 항목 {z.rest.length}개 {openOptional[z.zone] ? '접기' : '더 보기'}
                    <ChevronDown className={cn('h-4 w-4 transition-transform', openOptional[z.zone] && 'rotate-180')} />
                  </button>
                  {openOptional[z.zone] &&
                    z.rest.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        state={local[item.id]}
                        weight={weights[item.category] ?? 3}
                        photos={photosByItem[item.id] ?? 0}
                        onValue={(v) => setValue(item, v)}
                        onNote={(n) => setNote(item, n)}
                        onPhoto={(f) => uploadPhoto(item, f)}
                      />
                    ))}
                </>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-20 z-10 mt-8 flex items-center gap-3 rounded-xl border border-border bg-background/95 p-3 shadow-lift backdrop-blur md:bottom-4">
        <div className="min-w-0 flex-1 text-[13px]">
          {required.length - answeredReq > 0 ? (
            <span className="text-muted-foreground">
              확인하지 못한 필수 항목 <b className="text-foreground">{required.length - answeredReq}개</b>는 리포트에서 따로 안내해요.
            </span>
          ) : (
            <span className="font-medium text-good">필수 항목을 모두 확인했어요.</span>
          )}
        </div>
        <Button onClick={() => navigate(`/listings/${id}`)}>
          <Sparkles /> 결과 보기
        </Button>
      </div>

      <NewVisitDialog
        open={visitDialog}
        onOpenChange={setVisitDialog}
        onCreate={async (at, occ, note) => {
          try {
            const v = await api.addVisit(id, { visited_at: at, occupancy: occ, note })
            await qc.invalidateQueries({ queryKey: ['listing', id] })
            setVisitId(v.id)
            setVisitDialog(false)
            toast.success('방문을 기록했어요. 이제 체크하는 항목은 이 방문 시각으로 저장돼요.')
          } catch (e) {
            toast.error((e as Error).message)
          }
        }}
      />
    </div>
  )
}

function ItemCard({
  item,
  state,
  weight,
  recommended,
  photos,
  onValue,
  onNote,
  onPhoto,
}: {
  item: ChecklistItem
  state?: { value: string; note: string | null }
  weight: number
  recommended?: boolean
  photos: number
  onValue: (v: string) => void
  onNote: (n: string) => void
  onPhoto: (f: File) => void
}) {
  const [help, setHelp] = useState(false)
  const [noteOpen, setNoteOpen] = useState(!!state?.note)
  const fileRef = useRef<HTMLInputElement>(null)
  const value = state?.value
  const done = !!value && value !== 'unknown'
  const Meta = CATEGORY_META[item.category]

  const opts =
    item.input_type === 'status'
      ? [...STATUS_OPTS, UNKNOWN_OPT]
      : item.input_type === 'yesno'
        ? [...YESNO_OPTS, UNKNOWN_OPT]
        : item.input_type === 'choice'
          ? [...(item.options ?? []).map((o) => ({ ...o, cls: 'data-[on=true]:border-primary data-[on=true]:bg-brand-soft data-[on=true]:text-primary' })), UNKNOWN_OPT]
          : []

  return (
    <div className={cn('rounded-xl border bg-background p-4 transition-colors', done ? 'border-border' : 'border-border', value === 'unknown' && 'border-dashed')}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
            done ? 'border-primary bg-primary text-white' : value === 'unknown' ? 'border-dashed border-unknown' : 'border-input',
          )}
        >
          {done && <Check className="h-3 w-3" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold">{item.label}</span>
            {item.is_required && <Badge variant="outline">필수</Badge>}
            {recommended && <Badge variant="default">내 기준 추천</Badge>}
            {weight >= 4 && item.is_required && <Badge variant="default">중요</Badge>}
            {item.time_sensitive && <Badge variant="muted">시간대 영향</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Meta.icon className="h-3 w-3" /> {Meta.label}
          </div>
        </div>
        <button onClick={() => setHelp((h) => !h)} className="rounded-md p-1 text-muted-foreground hover:bg-surface hover:text-foreground cursor-pointer" aria-label="확인 방법 보기">
          <CircleHelp className="h-4.5 w-4.5" />
        </button>
      </div>

      {help && (
        <div className="mt-3 rounded-lg bg-surface p-3 text-[13px] leading-relaxed">
          <div>
            <b>확인 방법</b> · {item.guide_text}
          </div>
          {item.caution_text && <div className="mt-1.5 text-muted-foreground">⚠ {item.caution_text}</div>}
        </div>
      )}

      <div className="mt-3.5 pl-8">
        {item.input_type === 'number' ? (
          <NumberInput value={value} onChange={onValue} />
        ) : (
          <div className={cn('grid gap-1.5', opts.length <= 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-5', item.input_type === 'yesno' && 'grid-cols-3')}>
            {opts.map((o) => (
              <button
                key={o.value}
                data-on={value === o.value}
                onClick={() => onValue(o.value)}
                className={cn(
                  'min-h-11 rounded-lg border border-border bg-background px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 cursor-pointer',
                  o.cls,
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-3 text-xs">
          <button onClick={() => setNoteOpen((v) => !v)} className={cn('flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer', state?.note && 'text-primary')}>
            <MessageSquare className="h-3.5 w-3.5" /> 메모{state?.note ? ' 있음' : ''}
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer">
            <Camera className="h-3.5 w-3.5" /> 사진{photos > 0 ? ` ${photos}` : ''}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPhoto(f)
              e.target.value = ''
            }}
          />
        </div>
        {noteOpen && (
          <Input
            className="mt-2 h-9 text-[13px]"
            defaultValue={state?.note ?? ''}
            onChange={(e) => onNote(e.target.value)}
            maxLength={1000}
            placeholder="예: 창문 열면 버스 소리가 계속 들림"
          />
        )}
      </div>
    </div>
  )
}

function NumberInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const n = value && value !== 'unknown' ? Number(value) : null
  return (
    <div className="flex items-center gap-2">
      <Button size="icon" variant="outline" onClick={() => onChange(String(Math.max(0, (n ?? 1) - 1)))} aria-label="줄이기">
        <Minus />
      </Button>
      <span className="tabular w-12 text-center text-lg font-semibold">{n ?? '–'}</span>
      <Button size="icon" variant="outline" onClick={() => onChange(String((n ?? 0) + 1))} aria-label="늘리기">
        <Plus />
      </Button>
      <button
        data-on={value === 'unknown'}
        onClick={() => onChange('unknown')}
        className={cn('ml-2 h-9 rounded-lg border border-border px-3 text-[13px] text-muted-foreground cursor-pointer', UNKNOWN_OPT.cls)}
      >
        확인 못함
      </button>
    </div>
  )
}

function NewVisitDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (at: string, occupancy: string, note?: string) => void
}) {
  const [at, setAt] = useState(toLocalInputValue(new Date()))
  const [occ, setOcc] = useState<'empty' | 'occupied'>('empty')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) setAt(toLocalInputValue(new Date()))
  }, [open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>방문 기록하기</DialogTitle>
          <DialogDescription>
            소음·채광은 시간대에 따라 달라요. 방문 시각을 남기면 낮에만 본 집에 저녁 재방문을 안내해 드려요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>방문 일시</Label>
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>집 상태</Label>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-surface p-1">
              {(['empty', 'occupied'] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOcc(o)}
                  className={cn('rounded-md py-2 text-[13px] font-medium cursor-pointer', occ === o ? 'bg-background shadow-soft' : 'text-muted-foreground')}
                >
                  {o === 'empty' ? '빈집' : '세입자 거주 중'}
                </button>
              ))}
            </div>
            {occ === 'occupied' && <p className="text-xs text-muted-foreground">가구 때문에 실제보다 좁아 보일 수 있다는 안내가 리포트에 함께 표시돼요.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>메모 (선택)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="예: 저녁 재방문" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            나중에
          </Button>
          <Button onClick={() => onCreate(at, occ, note || undefined)}>방문 기록</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
