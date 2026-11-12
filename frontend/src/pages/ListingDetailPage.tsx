import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  ClipboardCheck,
  Footprints,
  Home,
  Info,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CategoryBars, CoverageMeter, FitRing, ValueBadge } from '@/components/shared'
import { ListingReport } from '@/components/ListingReport'
import { MarketCard } from '@/components/MarketCard'
import { CATEGORY_META, CATEGORY_ORDER, FLOOR_TYPE_LABEL, STATUS_LABEL } from '@/lib/constants'
import type { CategoryKey } from '@/lib/types'
import { cn, formatDateTime, wonFull, priceLabel } from '@/lib/utils'

export default function ListingDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const listing = useQuery({ queryKey: ['listing', id], queryFn: () => api.listing(id) })
  const score = useQuery({ queryKey: ['listing-score', id], queryFn: () => api.listingScore(id) })
  const items = useQuery({ queryKey: ['checklist-items'], queryFn: api.checklistItems, staleTime: Infinity })
  const [highlight, setHighlight] = useState<string | null>(null)
  const [decideOpen, setDecideOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [moveIn, setMoveIn] = useState('')
  const [photoView, setPhotoView] = useState<number | null>(null)

  const refresh = () => qc.invalidateQueries()

  const setStatus = useMutation({
    mutationFn: (status: string) => api.updateListing(id, { status }),
    onSuccess: () => {
      refresh()
      toast.success('상태를 바꿨어요.')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteListing(id),
    onSuccess: async () => {
      await qc.invalidateQueries()
      toast.success('매물을 삭제했어요.')
      navigate('/listings')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const decide = useMutation({
    mutationFn: () => api.decide(id, { move_in_date: moveIn || null }),
    onSuccess: async () => {
      await qc.invalidateQueries()
      toast.success('이 집으로 결정했어요. 입주 준비 목록을 만들었어요.')
      navigate('/home')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const delPhoto = useMutation({
    mutationFn: (pid: number) => api.deletePhoto(pid),
    onSuccess: () => {
      setPhotoView(null)
      refresh()
    },
  })

  if (listing.isLoading || score.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }
  if (!listing.data || !score.data) return <p className="text-muted-foreground">매물을 찾을 수 없습니다.</p>
  const l = listing.data
  const s = score.data
  const itemMap = Object.fromEntries((items.data ?? []).map((i) => [i.id, i]))
  const visitMap = Object.fromEntries(l.visits.map((v) => [v.id, v]))

  const jump = (evId: string) => {
    const target = evId === 'cost' || evId === 'walk_minutes' || evId === 'dealbreaker' ? 'info' : evId
    setHighlight(target)
    document.getElementById(`rec-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlight(null), 2200)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Link to="/listings" className="text-[13px] text-muted-foreground hover:text-foreground">
              매물
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <Badge variant={l.status === 'selected' ? 'solid' : 'outline'}>{STATUS_LABEL[l.status]}</Badge>
            {s.dealbreaker_violations.map((v) => (
              <Badge key={v.code} variant="bad">
                <Ban /> {v.label}
              </Badge>
            ))}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{l.nickname}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {l.building_name && `${l.building_name} · `}
            {l.address}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={`/listings/${id}/check`}>
              <ClipboardCheck /> 현장 체크
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="수정">
            <Link to={`/listings/${id}/edit`}>
              <Pencil />
            </Link>
          </Button>
          <Button variant="outline" size="icon" aria-label="삭제" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
          </Button>
          {l.status !== 'selected' && (
            <Button
              onClick={() => {
                setMoveIn(l.move_in_available ?? '')
                setDecideOpen(true)
              }}
            >
              <Home /> 이 집으로 결정
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* 점수 요약 */}
          <Card>
            <CardContent className="flex flex-col gap-6 p-5 sm:flex-row">
              <div className="flex items-center gap-5 sm:w-60 sm:flex-col sm:items-start sm:border-r sm:border-border sm:pr-6">
                <FitRing fit={s.fit} size={104} />
                <div className="flex w-full flex-col gap-3">
                  <CoverageMeter coverage={s.coverage} />
                  {s.low_coverage && (
                    <p className="flex gap-1.5 text-xs text-normal">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      확인한 항목이 적어 점수가 실제와 다를 수 있어요.
                    </p>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-3 text-[13px] font-semibold text-muted-foreground">카테고리별 점수 (내 가중치 높은 순)</h3>
                <CategoryBars score={s} />
              </div>
            </CardContent>
          </Card>

          {/* 규칙 기반 안내 (AI 없이도 항상 표시) */}
          {(s.hints.length > 0 || s.unverified.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" /> 추가 확인 안내
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {s.hints.map((h) => (
                  <div key={h.type} className="flex gap-2.5 rounded-lg bg-normal-soft/70 p-3 text-[13px]">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-normal" />
                    {h.text}
                  </div>
                ))}
                {s.unverified.length > 0 && (
                  <div className="mt-1">
                    <div className="mb-2 text-[13px] font-medium">확인하지 못한 필수 항목 {s.unverified.length}개</div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.unverified.map((u) => (
                        <Link key={u.item_id} to={u.item_id === 'walk_minutes' ? `/listings/${id}/edit` : `/listings/${id}/check`}>
                          <Badge variant="unknown" className="py-1 hover:border-primary/50">
                            {u.label}
                            {u.weight >= 4 && <span className="text-primary">· 중요</span>}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <MarketCard listing={l} />

          <ListingReport listingId={id} score={s} onEvidence={jump} />

          {/* 체크 기록 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>현장 체크 기록</CardTitle>
              <Link to={`/listings/${id}/check`} className="text-[13px] font-medium text-primary">
                수정하기
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {l.checks.length === 0 && <p className="text-sm text-muted-foreground">아직 체크한 항목이 없어요.</p>}
              {CATEGORY_ORDER.filter((c) => c !== 'cost').map((cat) => {
                const rows = l.checks.filter((c) => itemMap[c.item_id]?.category === cat)
                if (!rows.length) return null
                const M = CATEGORY_META[cat as CategoryKey]
                return (
                  <div key={cat}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <M.icon className="h-3.5 w-3.5" /> {M.label}
                    </div>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {rows.map((c) => {
                        const item = itemMap[c.item_id]
                        const opt = item?.options?.find((o) => o.value === c.value)
                        const visit = c.visit_id ? visitMap[c.visit_id] : null
                        return (
                          <div
                            key={c.item_id}
                            id={`rec-${c.item_id}`}
                            className={cn('flex flex-col gap-1 px-3 py-2.5 transition-colors sm:flex-row sm:items-center sm:gap-3', highlight === c.item_id && 'bg-brand-soft ring-2 ring-primary/30')}
                          >
                            <span className="flex-1 text-[13px]">{item?.label ?? c.item_id}</span>
                            <div className="flex items-center gap-2">
                              {c.note && <span className="max-w-56 truncate text-xs text-muted-foreground" title={c.note}>“{c.note}”</span>}
                              {visit && <span className="text-[11px] text-muted-foreground">{formatDateTime(visit.visited_at)}</span>}
                              {opt ? <Badge variant="muted">{opt.label}</Badge> : item?.input_type === 'number' && c.value !== 'unknown' ? <Badge variant="muted">{c.value}개</Badge> : <ValueBadge value={c.value} />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 매물 정보 */}
        <div className="flex flex-col gap-5">
          <Card id="rec-info" className={cn('transition-shadow', highlight === 'info' && 'ring-2 ring-primary/30')}>
            <CardHeader>
              <CardTitle>매물 정보</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-[13px]">
              <div className="rounded-lg bg-surface p-3.5">
                <div className="text-xs text-muted-foreground">보증금 / 월세</div>
                <div className="tabular mt-0.5 text-xl font-bold">
                  {priceLabel(l.deposit, l.monthly_rent)}
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">관리비 {wonFull(l.maintenance_fee)}</span>
                  <span className="font-semibold">월 고정비 {wonFull(s.monthly_total)}</span>
                </div>
                {l.fee_includes.length > 0 && <div className="mt-1.5 text-xs text-muted-foreground">관리비 포함: {l.fee_includes.join(', ')}</div>}
              </div>
              <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2.5">
                <dt className="text-muted-foreground">층</dt>
                <dd>
                  {FLOOR_TYPE_LABEL[l.floor_type]}
                  {l.floor ? ` · ${l.floor}층` : ''}
                  {l.total_floors ? ` / ${l.total_floors}층` : ''}
                </dd>
                <dt className="text-muted-foreground">실제 도보</dt>
                <dd className="flex items-center gap-1">
                  <Footprints className="h-3.5 w-3.5 text-muted-foreground" />
                  {l.walk_minutes !== null ? `${l.walk_minutes}분` : <span className="text-unknown">미입력</span>}
                </dd>
                {l.area_m2 && (
                  <>
                    <dt className="text-muted-foreground">전용면적</dt>
                    <dd>{l.area_m2}㎡</dd>
                  </>
                )}
                {l.move_in_available && (
                  <>
                    <dt className="text-muted-foreground">입주 가능</dt>
                    <dd>{l.move_in_available}</dd>
                  </>
                )}
                {l.options.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">옵션</dt>
                    <dd className="flex flex-wrap gap-1">
                      {l.options.map((o) => (
                        <Badge key={o} variant="muted">
                          {o}
                        </Badge>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
              {(l.first_impression || l.agency_memo || l.review_memo) && (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  {l.first_impression && <p><span className="text-muted-foreground">첫인상 · </span>{l.first_impression}</p>}
                  {l.agency_memo && <p><span className="text-muted-foreground">중개사무소 · </span>{l.agency_memo}</p>}
                  {l.review_memo && (
                    <p>
                      <span className="text-muted-foreground">거주 후기 · </span>
                      {l.review_memo} <Badge variant="unknown">검증 안 됨</Badge>
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-border pt-3">
                <span className="text-muted-foreground">상태</span>
                <select
                  value={l.status === 'selected' ? 'selected' : l.status}
                  disabled={l.status === 'selected'}
                  onChange={(e) => setStatus.mutate(e.target.value)}
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-[13px]"
                >
                  {Object.entries(STATUS_LABEL)
                    .filter(([k]) => k !== 'selected' || l.status === 'selected')
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>방문 기록</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {l.visits.length === 0 && <p className="text-[13px] text-muted-foreground">방문 기록이 없어요. 현장 체크에서 추가할 수 있어요.</p>}
              {l.visits.map((v) => {
                const h = new Date(v.visited_at).getHours()
                const evening = h < 7 || h >= 18
                return (
                  <div key={v.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5 text-[13px]">
                    <span className={cn('h-2 w-2 rounded-full', evening ? 'bg-foreground' : 'bg-normal')} title={evening ? '저녁·밤' : '낮'} />
                    <span className="tabular font-medium">{formatDateTime(v.visited_at)}</span>
                    <span className="text-muted-foreground">{evening ? '저녁' : '낮'} · {v.occupancy === 'occupied' ? '거주 중' : '빈집'}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>사진 {l.photos.length > 0 && <span className="text-muted-foreground">{l.photos.length}</span>}</CardTitle>
            </CardHeader>
            <CardContent>
              {l.photos.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">현장 체크에서 항목별로 사진을 남길 수 있어요.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {l.photos.map((p) => (
                    <button key={p.id} onClick={() => setPhotoView(p.id)} className="group relative aspect-square overflow-hidden rounded-md bg-surface cursor-pointer">
                      <img src={api.photoUrl(p.id)} alt={p.item_id ? itemMap[p.item_id]?.label : '매물 사진'} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                      {p.item_id && (
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{itemMap[p.item_id]?.label}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 결정 다이얼로그 */}
      <Dialog open={decideOpen} onOpenChange={setDecideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 집으로 결정할까요?</DialogTitle>
            <DialogDescription>
              이 집의 보증금·월세·관리비·옵션 정보로 입주 준비 목록과 초기 비용이 자동으로 만들어져요. 나중에 취소할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          {s.unverified.length > 0 && (
            <div className="mb-4 flex gap-2 rounded-lg bg-normal-soft p-3 text-[13px] text-normal">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              아직 확인하지 못한 필수 항목이 {s.unverified.length}개 있어요: {s.unverified.slice(0, 3).map((u) => u.label).join(', ')}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>입주 예정일</Label>
            <Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
            <p className="text-xs text-muted-foreground">입주일을 기준으로 할 일의 날짜를 계산해요. 비워 두면 날짜 없이 만들어져요.</p>
          </div>
          <Link to="/guide" target="_blank" className="mt-4 flex items-center gap-2 rounded-lg bg-surface p-3 text-[13px] text-muted-foreground hover:text-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            계약하기 전에 보증금 지키기 체크리스트(3·3·3법칙)를 꼭 확인하세요.
          </Link>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecideOpen(false)}>
              취소
            </Button>
            <Button onClick={() => decide.mutate()} disabled={decide.isPending}>
              <Home /> 결정하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>매물을 삭제할까요?</DialogTitle>
            <DialogDescription>체크 기록, 방문 기록, 사진, AI 리포트가 모두 함께 삭제되고 되돌릴 수 없어요. 고민 중이라면 상태를 '탈락'으로 바꾸는 방법도 있어요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <Trash2 /> 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {photoView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPhotoView(null)}>
          <img src={api.photoUrl(photoView)} alt="" className="max-h-[85vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          <div className="absolute right-4 top-4 flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                delPhoto.mutate(photoView)
              }}
            >
              <Trash2 /> 사진 삭제
            </Button>
            <Button variant="secondary" size="icon" onClick={() => setPhotoView(null)} aria-label="닫기">
              <X />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
