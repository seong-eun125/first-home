/** 운영 현황 (관리자 전용, 읽기 전용) — 테스트 기간 사용량·AI 호출량·설문 진행 상황 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CircleAlert, CircleCheck, RefreshCw, Table2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { AdminDaily, AdminOverview } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { IconTile } from '@/components/illustrations'
import { cn, formatDate, formatDateTime } from '@/lib/utils'

export default function AdminPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: api.adminOverview,
    refetchInterval: 60_000,
  })

  if (error) {
    const forbidden = error instanceof ApiError && error.status === 403
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground">
        {forbidden ? '운영 현황은 관리자 계정에서만 볼 수 있어요.' : (error as Error).message}
        <div className="mt-4">
          <Button variant="outline" onClick={() => location.reload()}>
            다시 시도
          </Button>
        </div>
      </div>
    )
  }
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />

  const t = data.totals
  const goal = data.survey_goal
  const goalPct = Math.min(100, Math.round((t.survey_responses / goal) * 100))
  const tiles = [
    { kind: 'house' as const, label: '가입 사용자', value: `${t.users}명`, sub: `내 기준 설정 ${t.onboarded}명` },
    { kind: 'box' as const, label: '등록된 매물', value: `${t.listings}개`, sub: `매물 등록 사용자 ${t.users_with_listing}명` },
    { kind: 'clipboard' as const, label: '현장 체크 기록', value: `${t.checks}건`, sub: `방문 ${t.visits}회 · 사진 ${t.photos}장` },
    { kind: 'scan' as const, label: 'AI 매물 판정', value: `${t.precheck_runs}회`, sub: `AI 리포트 ${t.ai_reports}회` },
    { kind: 'compare' as const, label: '설문 응답', value: `${t.survey_responses}명`, sub: `목표 ${goal}명 · ${goalPct}%` },
    { kind: 'key' as const, label: '집 결정', value: `${t.decided_homes}명`, sub: '입주 준비 단계로 이동' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn(isFetching && 'animate-spin')} /> 새로고침
        </Button>
      </div>

      <section className="rounded-3xl bg-primary p-6 text-white sm:p-8">
        <div className="text-[13px] font-medium text-white/70">관리자 전용 · 읽기 전용</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">FIRST HOME 운영 현황</h1>
        <p className="mt-2 text-sm text-white/80">{formatDateTime(data.generated_at)} 기준 · 1분마다 자동으로 새로 고쳐요</p>
        <div className="mt-4 flex items-baseline justify-between gap-2 text-[13px]">
          <span className="text-white/80">설문 목표 달성</span>
          <b className="tabular">
            {t.survey_responses} / {goal}명
          </b>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-white/70">{data.excluded_note}</p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((x) => (
          <div key={x.label} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 shadow-soft">
            <IconTile kind={x.kind} />
            <div className="min-w-0">
              <div className="text-[12px] text-muted-foreground">{x.label}</div>
              <div className="text-lg font-bold tabular">{x.value}</div>
              <div className="truncate text-[11px] text-muted-foreground">{x.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Funnel data={data} className="lg:col-span-3" />
        <AIPanel ai={data.ai} className="lg:col-span-2" />
      </div>

      <Trend daily={data.daily} />

      <SystemPanel data={data} />
    </div>
  )
}

// ---------------------------------------------------------------- 사용 단계 (퍼널)
function Funnel({ data, className }: { data: AdminOverview; className?: string }) {
  const base = Math.max(data.funnel[0]?.count ?? 0, 1)
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px]">사용 단계별 사용자</CardTitle>
        <p className="text-[12px] text-muted-foreground">가입한 사람 중 각 단계까지 써 본 사람 수 (가입 대비 비율)</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.funnel.map((f) => {
          const pct = Math.round((f.count / base) * 100)
          return (
            <div key={f.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span>{f.label}</span>
                <span className="shrink-0">
                  <b className="tabular">{f.count}명</b>
                  <span className="ml-1.5 text-[11px] text-muted-foreground tabular">{pct}%</span>
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-[4px] bg-muted" role="img" aria-label={`${f.label} ${f.count}명, 가입 대비 ${pct}%`}>
                {f.count > 0 && <div className="h-full rounded-[4px] bg-primary" style={{ width: `${Math.max(pct, 2)}%` }} />}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------- AI 운영
const MODE_LABEL: Record<string, string> = { openai: '실제 AI (OpenAI)', mock: '규칙 기반 모의 응답', fallback: '규칙 기반 대체' }

function AIPanel({ ai, className }: { ai: AdminOverview['ai']; className?: string }) {
  const pct = ai.limit_total ? Math.min(100, Math.round((ai.today_calls / ai.limit_total) * 100)) : 0
  const state = pct >= 100 ? 'bad' : pct >= 80 ? 'normal' : 'good'
  const stateText = { good: '여유 있음', normal: '한도에 가까움', bad: '오늘 한도 도달 — 규칙 기반으로 대체 중' }[state]
  const rows = [
    { label: '실제 AI 호출', value: ai.by_mode.openai ?? 0 },
    { label: '  └ 실패 후 규칙 기반 대체', value: ai.failures },
    { label: '규칙 기반 모의 응답', value: ai.by_mode.mock ?? 0 },
    { label: '저장된 결과 재사용 (비용 없음)', value: ai.by_mode.cached ?? 0 },
  ]
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px]">AI 사용량</CardTitle>
        <p className="text-[12px] text-muted-foreground">
          {MODE_LABEL[ai.mode] ?? ai.mode}
          {ai.model && ` · ${ai.model}`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-[13px]">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span>오늘 실제 AI 호출</span>
            <b className="tabular">
              {ai.today_calls} / {ai.limit_total}회
            </b>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-[4px] bg-muted">
            <div
              className={cn('h-full rounded-[4px]', state === 'bad' ? 'bg-bad' : state === 'normal' ? 'bg-normal' : 'bg-primary')}
              style={{ width: `${Math.max(pct, ai.today_calls ? 2 : 0)}%` }}
            />
          </div>
          <div className={cn('mt-1.5 flex items-center gap-1 text-[12px]', state === 'good' ? 'text-muted-foreground' : state === 'bad' ? 'text-bad' : 'text-normal')}>
            {state === 'good' ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
            {stateText} · 1인당 하루 {ai.limit_per_user}회
          </div>
        </div>
        <dl className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-2">
              <dt className={cn('whitespace-pre text-muted-foreground', r.label.startsWith('  ') && 'text-[12px]')}>{r.label}</dt>
              <dd className="tabular font-medium">{r.value}회</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center">
          <Mini label="매물 판정" value={ai.by_kind.precheck} />
          <Mini label="매물 리포트" value={ai.by_kind.listing} />
          <Mini label="비교 리포트" value={ai.by_kind.compare} />
        </div>
        <p className="text-[12px] text-muted-foreground">
          누적 토큰 입력 {ai.prompt_tokens.toLocaleString()} · 출력 {ai.completion_tokens.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-bold tabular">{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------- 최근 14일 추이 (작은 막대 차트 4개)
const SERIES: { key: keyof Omit<AdminDaily, 'date'>; label: string; unit: string }[] = [
  { key: 'signups', label: '가입', unit: '명' },
  { key: 'listings', label: '매물 등록', unit: '개' },
  { key: 'ai_calls', label: 'AI 사용', unit: '회' },
  { key: 'surveys', label: '설문 응답', unit: '명' },
]

function Trend({ daily }: { daily: AdminDaily[] }) {
  const [table, setTable] = useState(false)
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-[15px]">최근 14일 활동</CardTitle>
          <p className="text-[12px] text-muted-foreground">한국 시간 기준 · 막대에 마우스를 올리거나 눌러 보면 그날 숫자가 보여요</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setTable((v) => !v)}>
          {table ? <BarChart3 /> : <Table2 />} {table ? '차트로 보기' : '표로 보기'}
        </Button>
      </CardHeader>
      <CardContent>
        {table ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[13px] tabular">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                  <th className="py-1.5 font-medium">날짜</th>
                  {SERIES.map((s) => (
                    <th key={s.key} className="py-1.5 text-right font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...daily].reverse().map((d) => (
                  <tr key={d.date} className="border-b border-border/60">
                    <td className="py-1.5">{formatDate(d.date)}</td>
                    {SERIES.map((s) => (
                      <td key={s.key} className="py-1.5 text-right">
                        {d[s.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {SERIES.map((s) => (
              <MiniBars key={s.key} daily={daily} field={s.key} label={s.label} unit={s.unit} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MiniBars({ daily, field, label, unit }: { daily: AdminDaily[]; field: keyof Omit<AdminDaily, 'date'>; label: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const values = daily.map((d) => d[field])
  const max = Math.max(...values, 1)
  const total = values.reduce((a, b) => a + b, 0)
  const shown = hover !== null ? daily[hover] : null
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="text-[12px] text-muted-foreground tabular" aria-live="polite">
          {shown ? (
            <>
              {formatDate(shown.date)} · <b className="text-foreground">{shown[field]}{unit}</b>
            </>
          ) : (
            <>
              14일 합계 <b className="text-foreground">{total}{unit}</b>
            </>
          )}
        </span>
      </div>
      <div className="mt-2 flex h-20 items-end gap-[2px] border-b border-border" onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => {
          const v = d[field]
          return (
            <button
              key={d.date}
              type="button"
              className="flex h-full flex-1 cursor-default items-end"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(i)}
              aria-label={`${formatDate(d.date)} ${label} ${v}${unit}`}
            >
              <span
                className={cn('w-full rounded-t-[4px] bg-primary transition-opacity', hover !== null && hover !== i && 'opacity-40')}
                style={{ height: v ? `${Math.max((v / max) * 100, 4)}%` : 0 }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{formatDate(daily[0]?.date)}</span>
        <span>최고 {max === 1 && total === 0 ? 0 : max}{unit}</span>
        <span>오늘</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 서비스 상태
function SystemPanel({ data }: { data: AdminOverview }) {
  const items = [
    { label: '실행 환경', value: data.system.app_env === 'production' ? '배포 서버' : '로컬 개발' },
    { label: 'DB 연결', value: data.system.db === 'ok' ? '정상' : data.system.db },
    { label: 'AI 응답 방식', value: MODE_LABEL[data.ai.mode] ?? data.ai.mode },
    { label: '실거래가 데이터', value: data.system.molit_mode === 'live' ? '국토교통부 실데이터' : '샘플 데이터 (키 미설정)' },
    { label: '배포 버전', value: data.system.commit ?? '—' },
  ]
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px]">서비스 상태</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {items.map((x) => (
            <div key={x.label} className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
              <dt className="text-muted-foreground">{x.label}</dt>
              <dd className="font-medium tabular">{x.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
