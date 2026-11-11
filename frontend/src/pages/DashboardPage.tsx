import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, Building2, CalendarDays, Check, ChevronRight, ClipboardList, Plus, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/misc'
import { CoverageMeter, FitRing } from '@/components/shared'
import { CATEGORY_META, CATEGORY_ORDER } from '@/lib/constants'
import type { CategoryKey, HomeData, ScoreResult, User } from '@/lib/types'
import { cn, daysUntil, formatDate, won } from '@/lib/utils'
import { IconTile, PrecheckIllo, RoomScene } from '@/components/illustrations'

const JOURNEY = ['기준 설정', '현장 기록', '비교·분석', '최종 결정', '입주 준비']

function Journey({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto text-[12px] sm:text-[13px]">
      {JOURNEY.map((s, i) => (
        <li key={s} className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
              i < current && 'text-primary',
              i === current && 'bg-primary text-white',
              i > current && 'text-muted-foreground',
            )}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : <span className="tabular">{i + 1}</span>}
            {s}
          </span>
          {i < JOURNEY.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-border" />}
        </li>
      ))}
    </ol>
  )
}

export default function DashboardPage({ user }: { user: User }) {
  const scores = useQuery({ queryKey: ['scores', 'preview', null], queryFn: () => api.previewScores() })
  const home = useQuery({ queryKey: ['home'], queryFn: api.home })
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile })

  if (scores.isLoading || home.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
        </div>
      </div>
    )
  }

  const results = scores.data?.results ?? []
  const h = home.data
  const stage = h ? 4 : results.length === 0 ? 1 : results.some((r) => r.coverage >= 0.6) && results.length >= 2 ? 2 : 1

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-3xl border border-border bg-background shadow-soft">
        <div className="relative h-24 sm:h-32">
          <RoomScene />
          <span className="absolute -bottom-6 left-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lift sm:left-7">
            <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
              <path d="M6 15.5 16 7l10 8.5V25a1.5 1.5 0 0 1-1.5 1.5h-5.5v-7h-6v7H7.5A1.5 1.5 0 0 1 6 25z" />
            </svg>
          </span>
        </div>
        <div className="flex flex-col gap-3 px-5 pb-5 pt-9 sm:px-7">
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
            {user.name}님, {h ? '이제 입주를 준비할 차례예요' : results.length ? '내 기준으로 집을 고르고 있어요' : '첫 집을 기록해 볼까요?'}
          </h1>
          <Journey current={stage} />
        </div>
      </section>

      <QuickTiles results={results} decided={!!h} />

      {h ? (
        <DecidedHero home={h} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <NextAction results={results} />
          </div>
          <PrecheckPromo />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>후보 매물 순위</CardTitle>
              <p className="mt-1 text-[13px] text-muted-foreground">내 우선순위로 계산한 적합도 순</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/compare">
                비교하기 <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {results.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-lg bg-surface py-10 text-center text-sm text-muted-foreground">
                아직 기록한 매물이 없어요.
                <Button asChild size="sm">
                  <Link to="/listings/new">
                    <Plus /> 매물 기록하기
                  </Link>
                </Button>
              </div>
            )}
            {results.slice(0, 4).map((r) => (
              <Link
                key={r.listing_id}
                to={`/listings/${r.listing_id}`}
                className="group flex items-center gap-4 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-surface/70"
              >
                <span className={cn('tabular w-5 text-center text-lg font-bold', r.rank === 1 ? 'text-primary' : 'text-muted-foreground')}>{r.rank}</span>
                <FitRing fit={r.fit} size={52} label="" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{r.nickname}</span>
                    {r.dealbreaker_violations.length > 0 && <Badge variant="bad">조건 불일치</Badge>}
                    {r.low_coverage && <Badge variant="normal">확인 부족</Badge>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted-foreground">
                    보증금 {won(r.deposit)} · 월 {won(r.monthly_total)} · 미확인 {r.unverified.length}개
                  </div>
                </div>
                <div className="hidden w-32 sm:block">
                  <CoverageMeter coverage={r.coverage} compact />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>나의 우선순위</CardTitle>
            <Link to="/settings" className="text-[13px] font-medium text-primary">
              수정
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {CATEGORY_ORDER.map((c) => ({ c, w: profile.data?.weights[c] ?? 3 }))
              .sort((a, b) => b.w - a.w)
              .map(({ c, w }) => {
                const M = CATEGORY_META[c as CategoryKey]
                return (
                  <div key={c} className="flex items-center gap-3 text-[13px]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft">
                      <M.icon className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <span className="w-20">{M.label}</span>
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= w ? 'bg-primary' : 'bg-muted')} />
                      ))}
                    </div>
                  </div>
                )
              })}
            {profile.data?.profile && (
              <div className="mt-2 rounded-lg bg-surface p-3 text-[12px] leading-relaxed text-muted-foreground">
                예산 월 {won(profile.data.profile.monthly_budget)} · 도보 {profile.data.profile.max_walk_minutes ?? '-'}분 이내
                {profile.data.profile.dealbreakers.length > 0 &&
                  ` · 제외: ${profile.data.profile.dealbreakers.map((d) => profile.data?.dealbreaker_options[d]).join(', ')}`}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!h && <UnverifiedRollup results={results} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/guide" className="group flex items-center gap-4 rounded-2xl bg-[#F1E3D6]/60 p-5 transition-colors hover:bg-[#F1E3D6]">
          <IconTile kind="shield" size="lg" className="bg-white" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">계약 전, 보증금 지키기</div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">전세사기 예방 3·3·3법칙과 알아차려야 할 위험 신호</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          to={h ? '/home?tab=items' : '/guide?tab=essentials'}
          className="group flex items-center gap-4 rounded-2xl bg-[#E6EFEA] p-5 transition-colors hover:bg-[#DCE8E2]"
        >
          <IconTile kind="box" size="lg" className="bg-white" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">자취 필수템</div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {h ? '우리 집 옵션과 체크 기록에 맞춘 구매 목록' : '입주 첫날부터 필요한 물건, 집을 결정하면 맞춤 목록으로'}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}

function NextAction({ results }: { results: ScoreResult[] }) {
  let title = '부동산에서 본 첫 집을 기록해 보세요'
  let desc = '별칭·주소·보증금·월세만 입력하면 바로 현장 체크를 시작할 수 있어요.'
  let to = '/listings/new'
  let cta = '매물 기록하기'
  const needCheck = [...results].sort((a, b) => b.unverified.length - a.unverified.length)[0]
  if (results.length === 1) {
    title = '한 곳 더 보고 비교해 보세요'
    desc = '두 곳 이상을 기록하면 내 기준으로 나란히 비교하고 AI 비교 리포트를 받을 수 있어요.'
    cta = '다른 매물 기록하기'
  } else if (needCheck && needCheck.unverified.length > 0) {
    title = `'${needCheck.nickname}'에서 확인하지 못한 항목이 ${needCheck.unverified.length}개 있어요`
    desc = `결정 전에 ${needCheck.unverified
      .slice(0, 2)
      .map((u) => u.label)
      .join(', ')} 등을 확인해 보세요.`
    to = `/listings/${needCheck.listing_id}/check`
    cta = '이어서 체크하기'
  } else if (results.length >= 2) {
    title = '기록이 충분해요. 비교하고 결정해 보세요'
    desc = '우선순위를 조절하며 순위가 어떻게 바뀌는지 보고, AI 비교 리포트로 장단점을 정리하세요.'
    to = '/compare'
    cta = '비교하기'
  }
  return (
    <div className="relative h-full overflow-hidden rounded-2xl bg-primary p-6 text-white sm:p-7">
      <div className="relative z-10 flex h-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[13px] font-medium text-white/70">지금 할 일</div>
          <div className="mt-1 text-lg font-semibold sm:text-xl">{title}</div>
          <p className="mt-1 text-sm text-white/75">{desc}</p>
        </div>
        <Button asChild variant="secondary" className="shrink-0 bg-white text-primary hover:bg-white/90">
          <Link to={to}>
            {cta} <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" />
    </div>
  )
}

function DecidedHero({ home }: { home: HomeData }) {
  const d = daysUntil(home.move_in_date)
  const next = home.tasks.filter((t) => !t.done).slice(0, 3)
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-white lg:col-span-2">
        <div className="text-[13px] font-medium text-white/70">최종 선택</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-bold">{home.listing?.nickname ?? '선택한 집'}</span>
          {d !== null && <span className="tabular text-lg font-semibold text-white/85">입주 {d > 0 ? `D-${d}` : d === 0 ? 'D-DAY' : `${-d}일 지남`}</span>}
        </div>
        <p className="mt-1 text-sm text-white/75">
          {home.listing?.address} · 입주일 {formatDate(home.move_in_date)}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${(home.progress.done / Math.max(home.progress.total, 1)) * 100}%` }} />
          </div>
          <span className="tabular text-sm">
            {home.progress.done}/{home.progress.total} 완료
          </span>
        </div>
        <Button asChild variant="secondary" className="mt-5 bg-white text-primary hover:bg-white/90">
          <Link to="/home">
            입주 준비 보기 <ArrowRight />
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> 다음 할 일
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {next.length === 0 && <p className="text-sm text-muted-foreground">모든 할 일을 마쳤어요.</p>}
          {next.map((t) => (
            <div key={t.id} className="rounded-lg bg-surface p-3">
              <div className="text-sm font-medium">{t.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t.due_date ? `${formatDate(t.due_date)}까지` : '날짜 미정'}</div>
            </div>
          ))}
          <div className="mt-1 text-[13px] text-muted-foreground">
            월 고정비 <b className="tabular text-foreground">{won(home.cost_summary.monthly_total)}</b>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UnverifiedRollup({ results }: { results: ScoreResult[] }) {
  const rows = results.flatMap((r) => r.unverified.slice(0, 3).map((u) => ({ ...u, nickname: r.nickname, listing_id: r.listing_id })))
  const hints = results.flatMap((r) => r.hints.filter((h) => h.type === 'evening_revisit').map((h) => ({ ...h, nickname: r.nickname, listing_id: r.listing_id })))
  if (!rows.length && !hints.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" /> 다시 확인할 것
        </CardTitle>
        <p className="text-[13px] text-muted-foreground">확인하지 못한 필수 항목은 점수에서 좋게 처리되지 않아요. 중요도 높은 순.</p>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2">
        {hints.map((h) => (
          <Link key={`h-${h.listing_id}`} to={`/listings/${h.listing_id}`} className="flex gap-3 rounded-lg border border-normal/30 bg-normal-soft/60 p-3 text-sm hover:border-normal/60">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-normal" />
            <div>
              <div className="font-medium">{h.nickname} · 저녁 재방문</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{h.text}</div>
            </div>
          </Link>
        ))}
        {rows
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 6)
          .map((u) => (
            <Link key={`${u.listing_id}-${u.item_id}`} to={`/listings/${u.listing_id}/check`} className="flex gap-3 rounded-lg border border-border p-3 text-sm hover:bg-surface">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium">
                  {u.nickname} · {u.label}
                  {u.reason === 'unknown' && <Badge variant="unknown" className="ml-1.5">확인 못함</Badge>}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{u.how_to_check}</div>
              </div>
            </Link>
          ))}
      </CardContent>
    </Card>
  )
}

/** 레퍼런스의 큰 아이콘 타일처럼, 지금 상태를 그림 타일로 요약 */
function QuickTiles({ results, decided }: { results: ScoreResult[]; decided: boolean }) {
  const avg = results.length ? Math.round((results.reduce((a, r) => a + r.coverage, 0) / results.length) * 100) : 0
  const tiles = [
    { kind: 'house' as const, label: '후보 매물', value: `${results.length}곳`, to: '/listings' },
    { kind: 'clipboard' as const, label: '평균 확인도', value: results.length ? `${avg}%` : '–', to: '/listings' },
    { kind: 'scan' as const, label: 'AI 매물 판정', value: '링크·캡처', to: '/precheck' },
    decided
      ? { kind: 'key' as const, label: '입주 준비', value: '진행 중', to: '/home' }
      : { kind: 'compare' as const, label: '비교하기', value: results.length >= 2 ? '가능' : '2곳부터', to: '/compare' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <Link
          key={t.label}
          to={t.to}
          className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift sm:p-4"
        >
          <IconTile kind={t.kind} />
          <div className="min-w-0">
            <div className="truncate text-[12px] text-muted-foreground">{t.label}</div>
            <div className="truncate text-[15px] font-bold">{t.value}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function PrecheckPromo() {
  return (
    <Link
      to="/precheck"
      className="group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl bg-[#E3ECF0] p-6 transition-colors hover:bg-[#DAE6EB]"
    >
      <div className="relative z-10 max-w-[11.5rem]">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> AI 매물 판정
        </div>
        <div className="mt-1.5 text-[17px] font-bold leading-snug">이 매물, 나한테 괜찮을까?</div>
        <p className="mt-1 text-[13px] text-foreground/70">링크나 캡처를 올리면 내 기준으로 판단해요.</p>
      </div>
      <span className="relative z-10 mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
        판정받기 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
      <PrecheckIllo className="pointer-events-none absolute -bottom-2 -right-3 h-24 w-auto sm:h-28" />
    </Link>
  )
}
