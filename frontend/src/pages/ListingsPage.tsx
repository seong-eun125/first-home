import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarClock, Footprints, Plus, ScanSearch } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/misc'
import { CoverageMeter, EmptyState, PageHeader } from '@/components/shared'
import { Building, BUILDING_BG } from '@/components/illustrations'
import { FLOOR_TYPE_LABEL, STATUS_LABEL, scoreTone } from '@/lib/constants'
import type { ListingSummary } from '@/lib/types'
import { cn, won, priceLabel } from '@/lib/utils'

const FILTERS = [
  { key: 'active', label: '진행 중', match: (l: ListingSummary) => ['candidate', 'hold', 'selected'].includes(l.status) },
  { key: 'all', label: '전체', match: () => true },
  { key: 'closed', label: '탈락·놓침', match: (l: ListingSummary) => ['rejected', 'missed'].includes(l.status) },
]

export default function ListingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['listings'], queryFn: api.listings })
  const [filter, setFilter] = useState('active')
  const list = (data ?? []).filter(FILTERS.find((f) => f.key === filter)!.match)

  return (
    <div>
      <PageHeader
        title="매물"
        description="부동산에서 본 집을 기록하고 현장 체크를 이어 가세요."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/precheck">
                <ScanSearch /> 링크·캡처로 AI 판정
              </Link>
            </Button>
            <Button asChild>
              <Link to="/listings/new">
                <Plus /> 매물 기록
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-5 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium cursor-pointer',
              filter === f.key ? 'border-foreground bg-foreground text-background' : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
            <span className="tabular ml-1.5 opacity-60">{(data ?? []).filter(f.match).length}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      )}
      {!isLoading && list.length === 0 && (
        <EmptyState
          icon={Building2}
          title={filter === 'active' ? '진행 중인 매물이 없어요' : '해당하는 매물이 없어요'}
          description="집을 보러 가면 별칭·주소·보증금·월세만 먼저 입력하고 현장 체크를 시작하세요."
          action={
            <Button asChild>
              <Link to="/listings/new">
                <Plus /> 첫 매물 기록하기
              </Link>
            </Button>
          }
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((l) => (
          <ListingCard key={l.id} l={l} />
        ))}
      </div>
    </div>
  )
}

function ListingCard({ l }: { l: ListingSummary }) {
  const tone = l.fit_provisional ? 'unknown' : scoreTone(l.fit)
  return (
    <Link
      to={`/listings/${l.id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift',
        ['rejected', 'missed'].includes(l.status) && 'opacity-60',
      )}
    >
      <div className="relative aspect-[16/9] bg-surface">
        {l.cover_photo_id ? (
          <img src={api.photoUrl(l.cover_photo_id)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className={cn('flex h-full items-end justify-center pt-4', BUILDING_BG[l.id % 3])}>
            <Building variant={l.id} className="h-[82%] w-auto" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Badge variant={l.status === 'selected' ? 'solid' : 'outline'} className={l.status !== 'selected' ? 'bg-background/90' : ''}>
            {STATUS_LABEL[l.status]}
          </Badge>
          {l.dealbreaker_violations.length > 0 && <Badge variant="bad">조건 불일치</Badge>}
        </div>
        <div className="absolute bottom-3 right-3 rounded-lg bg-background/95 px-2.5 py-1.5 text-right shadow-soft">
          <div className="text-[10px] text-muted-foreground">적합도</div>
          <div
            className={cn('tabular text-xl font-bold leading-none', {
              'text-primary': tone === 'good',
              'text-normal': tone === 'normal',
              'text-bad': tone === 'bad',
              'text-muted-foreground': tone === 'unknown',
            })}
          >
            {l.fit_provisional ? <span className="text-sm">체크 전</span> : (l.fit ?? '–')}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{l.nickname}</h3>
            {l.building_name && <span className="truncate text-xs text-muted-foreground">{l.building_name}</span>}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{l.address}</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="tabular text-lg font-bold">
            {priceLabel(l.deposit, l.monthly_rent)}
          </span>
          <span className="text-xs text-muted-foreground">관리비 {won(l.maintenance_fee)}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{FLOOR_TYPE_LABEL[l.floor_type]}{l.floor ? ` · ${l.floor}층` : ''}</span>
          <span className="flex items-center gap-1">
            <Footprints className="h-3.5 w-3.5" />
            {l.walk_minutes !== null ? `${l.walk_minutes}분` : '도보 미입력'}
          </span>
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            방문 {l.visit_count}회
          </span>
        </div>
        <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-3">
          <CoverageMeter coverage={l.coverage} compact />
          {l.unverified_count > 0 ? <Badge variant="unknown">미확인 {l.unverified_count}</Badge> : <Badge variant="good">필수 확인 완료</Badge>}
        </div>
      </div>
    </Link>
  )
}
