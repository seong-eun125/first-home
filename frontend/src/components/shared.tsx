import type { ReactNode } from 'react'
import { AlertTriangle, Bot, CircleHelp, Link2, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CATEGORY_META, CATEGORY_ORDER, VALUE_LABEL, scoreTone } from '@/lib/constants'
import type { AIReport, CategoryKey, ScoreResult } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] font-medium text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function ValueBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <Badge variant="muted">미입력</Badge>
  const v = value as keyof typeof VALUE_LABEL
  const variant = v === 'good' || v === 'yes' ? 'good' : v === 'normal' ? 'normal' : v === 'bad' ? 'bad' : v === 'unknown' ? 'unknown' : 'muted'
  return <Badge variant={variant}>{VALUE_LABEL[v] ?? value}</Badge>
}

/** 적합도 원형 게이지 */
export function FitRing({
  fit,
  size = 88,
  label = '적합도',
  provisional = false,
}: {
  fit: number | null
  size?: number
  label?: string
  provisional?: boolean // 현장 체크 전이면 점수 대신 '체크 전'
}) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const tone = provisional ? 'unknown' : scoreTone(fit)
  const color = { good: 'var(--color-primary)', normal: 'var(--color-normal)', bad: 'var(--color-bad)', unknown: 'var(--color-unknown)' }[tone]
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={provisional && fit != null ? `현장 체크 전 · 예산·도보 시간만 반영한 예상 ${fit}점` : undefined}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={6}
          strokeDasharray={provisional ? '4 5' : undefined}
        />
        {!provisional && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - (fit ?? 0) / 100)}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {provisional ? (
          <span className="font-semibold leading-tight text-muted-foreground" style={{ fontSize: Math.max(11, size * 0.16) }}>
            체크 전
          </span>
        ) : (
          <span className="tabular text-[26px] font-bold leading-none tracking-tight" style={{ fontSize: size * 0.3 }}>
            {fit ?? '–'}
          </span>
        )}
        {label && <span className="mt-0.5 text-[11px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  )
}

export function CoverageMeter({ coverage, compact = false }: { coverage: number; compact?: boolean }) {
  const pct = Math.round(coverage * 100)
  const low = coverage < 0.6
  return (
    <div className={cn('flex flex-col gap-1', compact ? 'min-w-24' : 'min-w-32')}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">확인도</span>
        <span className={cn('tabular font-semibold', low ? 'text-normal' : 'text-foreground')}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500', low ? 'bg-normal' : 'bg-sage')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function CategoryBars({ score, highlightWeight = 4 }: { score: ScoreResult; highlightWeight?: number }) {
  const cats = [...CATEGORY_ORDER].sort((a, b) => score.category_scores[b].weight - score.category_scores[a].weight)
  return (
    <div className="flex flex-col gap-3">
      {cats.map((key) => {
        const c = score.category_scores[key]
        const Meta = CATEGORY_META[key]
        const tone = scoreTone(c.score)
        return (
          <div key={key} className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.75rem] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2 text-[13px]">
              <Meta.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{Meta.label}</span>
              {c.weight >= highlightWeight && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="중요하게 설정한 카테고리" />}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              {c.score !== null && (
                <div
                  className={cn('h-full rounded-full transition-all duration-500', {
                    'bg-primary': tone === 'good',
                    'bg-normal': tone === 'normal',
                    'bg-bad': tone === 'bad',
                  })}
                  style={{ width: `${Math.max(c.score, 3)}%` }}
                />
              )}
            </div>
            <span className={cn('tabular text-right text-[13px] font-semibold', c.score === null && 'font-normal text-muted-foreground')}>
              {c.score ?? '미확인'}
            </span>
          </div>
        )
      })}
      <p className="text-[11px] text-muted-foreground">
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" /> 중요하게 설정한 카테고리 · 점수는 기록된 항목만으로 계산
      </p>
    </div>
  )
}

export function AIModeBadge({ report }: { report: Pick<AIReport, 'mode' | 'model' | 'cached'> }) {
  if (report.mode === 'openai')
    return (
      <Badge variant="default">
        <Sparkles /> AI 분석 · {report.model}
        {report.cached && ' · 저장된 결과'}
      </Badge>
    )
  if (report.mode === 'fallback')
    return (
      <Badge variant="normal">
        <AlertTriangle /> AI 호출 실패 → 규칙 기반 대체 응답
      </Badge>
    )
  return (
    <Badge variant="muted">
      <Bot /> 규칙 기반 응답 (API 키 확인 전 목업)
      {report.cached && ' · 저장된 결과'}
    </Badge>
  )
}

export function EvidenceChips({
  ids,
  score,
  onSelect,
  prefix,
}: {
  ids: string[]
  score?: ScoreResult
  onSelect?: (id: string) => void
  prefix?: string
}) {
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {ids.map((id) => {
        const ev = score?.evidence[id]
        const label = id === 'dealbreaker' ? '절대 조건' : ev?.label ?? id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect?.(id)}
            className="inline-flex max-w-56 items-center gap-1 truncate rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            title="근거가 된 기록 보기"
          >
            <Link2 className="h-3 w-3 shrink-0" />
            {prefix && <span className="font-medium">{prefix}</span>}
            <span className="truncate">{label}</span>
          </button>
        )
      })}
    </span>
  )
}

export function EmptyState({ icon: Icon = CircleHelp, title, description, action }: { icon?: typeof CircleHelp; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function categoryLabel(key: string) {
  return CATEGORY_META[key as CategoryKey]?.label ?? key
}
