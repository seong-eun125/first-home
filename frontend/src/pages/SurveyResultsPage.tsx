/** 만족도 설문 결과 (관리자 전용) — 발표용 정량 평가 화면 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { IconTile } from '@/components/illustrations'
import { cn, formatDate } from '@/lib/utils'

// 1점(빨강) → 5점(초록)
const DIST_COLORS = ['#C0392B', '#E59866', '#D9CFBE', '#7C9885', '#2F5D50']

export default function SurveyResultsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['survey-results'], queryFn: api.surveyResults })

  if (error) {
    const forbidden = error instanceof ApiError && error.status === 403
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-surface p-8 text-center text-sm text-muted-foreground">
        {forbidden ? '설문 결과는 관리자 계정에서만 볼 수 있어요.' : (error as Error).message}
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/">처음으로</Link>
          </Button>
        </div>
      </div>
    )
  }
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />

  const goal = 10
  const tiles = [
    { kind: 'clipboard' as const, label: '설문 응답자', value: `${data.respondents}명`, sub: `목표 ${goal}명 이상` },
    { kind: 'compare' as const, label: '전체 평균', value: data.overall_mean !== null ? `${data.overall_mean.toFixed(2)} / 5` : '–', sub: '10문항 평균' },
    { kind: 'key' as const, label: '추천 의향', value: data.recommend_top2_pct !== null ? `${data.recommend_top2_pct}%` : '–', sub: '4~5점 응답 비율' },
    { kind: 'house' as const, label: '가입 사용자', value: `${data.usage.users}명`, sub: `기준 설정 완료 ${data.usage.onboarded}명` },
    { kind: 'scan' as const, label: 'AI 매물 판정', value: `${data.usage.precheck_runs}회`, sub: `AI 리포트 ${data.usage.ai_reports}회` },
    { kind: 'box' as const, label: '등록된 매물', value: `${data.usage.listings}개`, sub: `매물 등록 사용자 ${data.usage.users_with_listing}명` },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-center justify-end gap-2">
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/survey/results.csv">
              <Download /> 응답 원자료 CSV
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> 인쇄·PDF
          </Button>
        </div>
      </div>

      <section className="rounded-3xl bg-primary p-6 text-white sm:p-8">
        <div className="text-[13px] font-medium text-white/70">사용자 만족도 정량 평가</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">FIRST HOME 만족도 설문 결과</h1>
        <p className="mt-2 text-sm text-white/80">
          응답 {data.respondents}명 · 5점 척도 {data.questions.length}문항 + 주관식 2문항
          {data.first_at && ` · ${formatDate(data.first_at)} ~ ${formatDate(data.last_at)}`}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (data.respondents / goal) * 100)}%` }} />
        </div>
        <p className="mt-1.5 text-[12px] text-white/70">
          목표(응답 {goal}명) 달성률 {Math.min(100, Math.round((data.respondents / goal) * 100))}% · {data.excluded_note}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 shadow-soft">
            <IconTile kind={t.kind} />
            <div className="min-w-0">
              <div className="text-[12px] text-muted-foreground">{t.label}</div>
              <div className="text-lg font-bold tabular">{t.value}</div>
              <div className="truncate text-[11px] text-muted-foreground">{t.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>문항별 평균과 응답 분포</CardTitle>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {data.scale.map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DIST_COLORS[i] }} />
                {i + 1} {s}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.questions.map((q, i) => {
            const n = q.dist.reduce((a, b) => a + b, 0)
            return (
              <div key={q.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 text-[13px]">
                    <b className="mr-1.5 text-primary">Q{i + 1}. {q.area}</b>
                    <span className="text-muted-foreground">{q.text}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="tabular text-[15px] font-bold">{q.mean !== null ? q.mean.toFixed(2) : '–'}</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">긍정 {q.top2_pct ?? 0}%</span>
                  </div>
                </div>
                <div className="flex h-3.5 overflow-hidden rounded-full bg-muted" aria-label={`응답 분포 ${q.dist.join(', ')}`}>
                  {q.dist.map((c, k) =>
                    c > 0 ? <div key={k} style={{ width: `${(c / Math.max(n, 1)) * 100}%`, background: DIST_COLORS[k] }} title={`${k + 1}점 ${c}명`} /> : null,
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">응답자 상황</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-[13px]">
            {Object.entries(data.segments).length === 0 && <p className="text-muted-foreground">아직 응답이 없어요.</p>}
            {Object.entries(data.segments).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span>{k}</span>
                <b className="tabular">{v}명</b>
              </div>
            ))}
          </CardContent>
        </Card>
        <OpenList title="좋았던 점" items={data.good} tone="good" />
        <OpenList title="개선할 점" items={data.improve} tone="normal" />
      </div>
    </div>
  )
}

function OpenList({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'normal' }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px]">
          {title} <span className="text-[12px] font-normal text-muted-foreground">{items.length}건</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">아직 없어요.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-2 overflow-auto">
            {items.map((t, i) => (
              <li key={i} className={cn('rounded-xl p-3 text-[13px] leading-relaxed', tone === 'good' ? 'bg-good-soft' : 'bg-normal-soft')}>
                {t}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
