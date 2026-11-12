import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared'
import { FEE_PRESETS, FLOOR_TYPE_LABEL, OPTION_PRESETS } from '@/lib/constants'
import type { ListingInput } from '@/lib/types'
import { cn } from '@/lib/utils'

type Form = {
  nickname: string
  building_name: string
  address: string
  deposit: string
  monthly_rent: string
  maintenance_fee: string
  fee_includes: string[]
  floor: string
  total_floors: string
  floor_type: ListingInput['floor_type']
  area_m2: string
  walk_minutes: string
  move_in_available: string
  contract_months: string
  options: string[]
  source_link: string
  agency_memo: string
  review_memo: string
  first_impression: string
}

const EMPTY: Form = {
  nickname: '', building_name: '', address: '', deposit: '', monthly_rent: '', maintenance_fee: '',
  fee_includes: [], floor: '', total_floors: '', floor_type: 'normal', area_m2: '', walk_minutes: '',
  move_in_available: '', contract_months: '', options: [], source_link: '', agency_memo: '', review_memo: '', first_impression: '',
}

const man = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v / 10_000))
const toWon = (v: string) => Math.round(Number(v || 0) * 10_000)
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))
const strOrNull = (v: string) => (v.trim() === '' ? null : v.trim())

function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-bad">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Unit({ unit, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  return (
    <div className="relative">
      <Input {...props} className="pr-12" />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
    </div>
  )
}

function Chips({ values, presets, onChange }: { values: string[]; presets: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState('')
  const all = [...presets, ...values.filter((v) => !presets.includes(v))]
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((p) => {
        const on = values.includes(p)
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(on ? values.filter((v) => v !== p) : [...values, p])}
            className={cn(
              'rounded-full border px-3 py-1 text-[13px] cursor-pointer',
              on ? 'border-primary bg-brand-soft font-medium text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40',
            )}
          >
            {p}
          </button>
        )
      })}
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && custom.trim()) {
            e.preventDefault()
            if (!values.includes(custom.trim())) onChange([...values, custom.trim()])
            setCustom('')
          }
        }}
        placeholder="+ 직접 입력 후 Enter"
        className="w-36 rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-[13px] outline-none focus:border-primary"
      />
    </div>
  )
}

export default function ListingFormPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : null
  const navigate = useNavigate()
  const qc = useQueryClient()
  const location = useLocation()
  const draft = (location.state as { draft?: Partial<ListingInput> } | null)?.draft
  // AI 매물 판정에서 넘어온 값이 있으면 미리 채웁니다 (사용자가 확인 후 저장)
  const [f, setF] = useState<Form>(() =>
    draft && !editId
      ? {
          ...EMPTY,
          nickname: draft.nickname ?? '',
          address: draft.address ?? '',
          deposit: man(draft.deposit),
          monthly_rent: man(draft.monthly_rent),
          maintenance_fee: man(draft.maintenance_fee),
          fee_includes: draft.fee_includes ?? [],
          floor: draft.floor?.toString() ?? '',
          total_floors: draft.total_floors?.toString() ?? '',
          floor_type: draft.floor_type ?? 'normal',
          area_m2: draft.area_m2?.toString() ?? '',
          options: draft.options ?? [],
          source_link: draft.source_link ?? '',
          agency_memo: draft.agency_memo ?? '',
        }
      : EMPTY,
  )
  const fromPrecheck = !!draft && !editId
  const [showMore, setShowMore] = useState(!!editId || fromPrecheck)
  const [dups, setDups] = useState<{ id: number; nickname: string }[]>([])

  const existing = useQuery({ queryKey: ['listing', editId], queryFn: () => api.listing(editId!), enabled: !!editId })

  useEffect(() => {
    const l = existing.data
    if (!l) return
    setF({
      nickname: l.nickname, building_name: l.building_name ?? '', address: l.address,
      deposit: man(l.deposit), monthly_rent: man(l.monthly_rent), maintenance_fee: man(l.maintenance_fee),
      fee_includes: l.fee_includes ?? [], floor: l.floor?.toString() ?? '', total_floors: l.total_floors?.toString() ?? '',
      floor_type: l.floor_type, area_m2: l.area_m2?.toString() ?? '', walk_minutes: l.walk_minutes?.toString() ?? '',
      move_in_available: l.move_in_available ?? '', contract_months: l.contract_months?.toString() ?? '',
      options: l.options ?? [], source_link: l.source_link ?? '', agency_memo: l.agency_memo ?? '',
      review_memo: l.review_memo ?? '', first_impression: l.first_impression ?? '',
    })
  }, [existing.data])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))

  const checkDup = async () => {
    if (!f.address.trim() && !f.building_name.trim()) return
    try {
      const r = await api.duplicateCheck({ address: f.address, building_name: f.building_name, exclude_id: editId ?? undefined })
      setDups(r.duplicates)
    } catch {
      /* 중복 확인 실패는 저장을 막지 않음 */
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body: ListingInput = {
        nickname: f.nickname.trim(),
        building_name: strOrNull(f.building_name),
        address: f.address.trim(),
        deposit: toWon(f.deposit),
        monthly_rent: toWon(f.monthly_rent),
        maintenance_fee: toWon(f.maintenance_fee),
        fee_includes: f.fee_includes,
        floor: numOrNull(f.floor),
        total_floors: numOrNull(f.total_floors),
        floor_type: f.floor_type,
        area_m2: numOrNull(f.area_m2),
        walk_minutes: numOrNull(f.walk_minutes),
        move_in_available: strOrNull(f.move_in_available),
        contract_months: numOrNull(f.contract_months),
        options: f.options,
        source_link: strOrNull(f.source_link),
        agency_memo: strOrNull(f.agency_memo),
        review_memo: strOrNull(f.review_memo),
        first_impression: strOrNull(f.first_impression),
      }
      return editId ? api.updateListing(editId, body) : api.createListing(body)
    },
    onSuccess: async (l) => {
      await qc.invalidateQueries()
      toast.success(editId ? '매물 정보를 저장했어요.' : '매물을 기록했어요. 이제 현장 체크를 시작하세요.')
      navigate(editId ? `/listings/${l.id}` : `/listings/${l.id}/check`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const valid = f.nickname.trim() && f.address.trim() && f.deposit !== '' && f.monthly_rent !== ''

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={editId ? existing.data?.nickname : '현장에서 빠르게'}
        title={editId ? '매물 정보 수정' : '매물 기록하기'}
        description={editId ? undefined : '필수 항목 4개만 입력하면 바로 현장 체크로 넘어가요. 나머지는 나중에 채워도 돼요.'}
      />
      {fromPrecheck && (
        <div className="mb-4 flex gap-2 rounded-xl bg-brand-soft p-3.5 text-[13px] text-primary">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            AI 매물 판정에서 읽은 값을 미리 채웠어요. <b>광고와 다른 부분이 없는지 확인</b>하고, 비어 있는 주소·금액은 직접 입력한 뒤 저장해 주세요.
          </span>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) save.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="별칭" required hint="여러 집을 구분할 이름 (예: 정문 앞 신축)">
              <Input value={f.nickname} onChange={(e) => set('nickname', e.target.value)} maxLength={50} required placeholder="정문 앞 신축" />
            </Field>
            <Field label="건물 이름" hint="같은 건물을 다른 부동산에서 또 보지 않도록 알려 드려요">
              <Input value={f.building_name} onChange={(e) => set('building_name', e.target.value)} onBlur={checkDup} maxLength={100} placeholder="하늘채원룸" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="주소" required>
                <Input value={f.address} onChange={(e) => set('address', e.target.value)} onBlur={checkDup} maxLength={255} required placeholder="도로명 주소 또는 위치 설명" />
              </Field>
            </div>
            {dups.length > 0 && (
              <div className="flex gap-2.5 rounded-lg border border-normal/40 bg-normal-soft p-3 text-sm sm:col-span-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-normal" />
                <div>
                  <b>이미 본 집일 수 있어요.</b> 같은 주소나 건물 이름으로 기록한 매물:{' '}
                  {dups.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && ', '}
                      <Link to={`/listings/${d.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                        {d.nickname}
                      </Link>
                    </span>
                  ))}
                  <div className="mt-0.5 text-xs text-muted-foreground">다른 방이라면 그대로 저장해도 됩니다.</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>비용</CardTitle>
            <CardDescription>만원 단위로 입력하세요. 월세+관리비가 월 고정비로 계산돼요.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="보증금" required>
              <Unit unit="만원" inputMode="decimal" value={f.deposit} onChange={(e) => set('deposit', e.target.value.replace(/[^\d.]/g, ''))} required placeholder="500" />
            </Field>
            <Field label="월세" required>
              <Unit unit="만원" inputMode="decimal" value={f.monthly_rent} onChange={(e) => set('monthly_rent', e.target.value.replace(/[^\d.]/g, ''))} required placeholder="45" />
            </Field>
            <Field label="관리비">
              <Unit unit="만원" inputMode="decimal" value={f.maintenance_fee} onChange={(e) => set('maintenance_fee', e.target.value.replace(/[^\d.]/g, ''))} placeholder="7" />
            </Field>
            <div className="sm:col-span-3">
              <Field label="관리비 포함 항목">
                <Chips values={f.fee_includes} presets={FEE_PRESETS} onChange={(v) => set('fee_includes', v)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>층·거리</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="층 유형">
              <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-surface p-1">
                {Object.entries(FLOOR_TYPE_LABEL).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set('floor_type', k as Form['floor_type'])}
                    className={cn('rounded-md py-2 text-[13px] font-medium cursor-pointer', f.floor_type === k ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="해당 층">
                <Unit unit="층" inputMode="numeric" value={f.floor} onChange={(e) => set('floor', e.target.value.replace(/[^\d-]/g, ''))} />
              </Field>
              <Field label="전체 층">
                <Unit unit="층" inputMode="numeric" value={f.total_floors} onChange={(e) => set('total_floors', e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label="실제 걸어 본 시간" hint="역·학교까지 직접 걸어 본 시간">
                <Unit unit="분" inputMode="numeric" value={f.walk_minutes} onChange={(e) => set('walk_minutes', e.target.value.replace(/\D/g, ''))} placeholder="8" />
              </Field>
            </div>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer"
        >
          상세 정보 {showMore ? '접기' : '더 입력하기 (나중에 해도 돼요)'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', showMore && 'rotate-180')} />
        </button>

        {showMore && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>계약 조건·옵션</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <Field label="전용면적">
                  <Unit unit="㎡" inputMode="decimal" value={f.area_m2} onChange={(e) => set('area_m2', e.target.value.replace(/[^\d.]/g, ''))} />
                </Field>
                <Field label="입주 가능일">
                  <Input type="date" value={f.move_in_available} onChange={(e) => set('move_in_available', e.target.value)} />
                </Field>
                <Field label="계약 기간">
                  <Unit unit="개월" inputMode="numeric" value={f.contract_months} onChange={(e) => set('contract_months', e.target.value.replace(/\D/g, ''))} />
                </Field>
                <div className="sm:col-span-3">
                  <Field label="옵션 가구·가전" hint="결정 후 입주 준비 목록에서 이미 있는 물건은 빼고 안내해요">
                    <Chips values={f.options} presets={OPTION_PRESETS} onChange={(v) => set('options', v)} />
                  </Field>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>메모</CardTitle>
                <CardDescription>나만 보는 기록이에요. AI 분석에는 메모가 앞부분만 짧게 전달됩니다.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="첫인상">
                  <Textarea value={f.first_impression} onChange={(e) => set('first_impression', e.target.value)} maxLength={1000} placeholder="밝고 깔끔하지만 큰길 소리가 들림" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="중개사무소 메모">
                    <Textarea value={f.agency_memo} onChange={(e) => set('agency_memo', e.target.value)} maxLength={2000} placeholder="○○부동산, 조건 설명이 자세했음" />
                  </Field>
                  <Field label="거주 후기 메모" hint="카페·앱에서 본 후기를 직접 요약 (검증되지 않은 정보로 표시돼요)">
                    <Textarea value={f.review_memo} onChange={(e) => set('review_memo', e.target.value)} maxLength={2000} />
                  </Field>
                </div>
                <Field label="매물 링크">
                  <Input value={f.source_link} onChange={(e) => set('source_link', e.target.value)} maxLength={500} placeholder="https://" />
                </Field>
              </CardContent>
            </Card>
          </>
        )}

        <div className="sticky bottom-20 z-10 flex justify-end gap-2 rounded-xl border border-border bg-background/95 p-3 shadow-lift backdrop-blur md:bottom-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            취소
          </Button>
          <Button type="submit" disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {editId ? '저장' : '저장하고 현장 체크 시작'}
          </Button>
        </div>
      </form>
    </div>
  )
}
