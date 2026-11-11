import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, ExternalLink, PackageCheck, Scale, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc'
import { PageHeader } from '@/components/shared'
import { StepGuide } from '@/components/StepGuide'
import { StepContract } from '@/components/illustrations'
import { OFFICIAL_LINKS, RED_FLAGS, RULE_333, SAFETY_SOURCES } from '@/lib/safety'
import { cn } from '@/lib/utils'

export default function GuidePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'essentials' ? 'essentials' : 'safety'
  return (
    <div>
      <PageHeader title="자취 가이드" description="집 찾기부터 정착까지 4단계로, 계약 전 보증금 지키기와 입주 필수템을 정리했어요." />
      <StepGuide className="mb-8" />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'safety' ? {} : { tab: v })}>
        <TabsList>
          <TabsTrigger value="safety">
            <ShieldCheck className="h-4 w-4" /> 보증금 지키기
          </TabsTrigger>
          <TabsTrigger value="essentials">
            <PackageCheck className="h-4 w-4" /> 자취 필수템
          </TabsTrigger>
        </TabsList>
        <TabsContent value="safety" className="mt-5">
          <SafetyGuide />
        </TabsContent>
        <TabsContent value="essentials" className="mt-5">
          <EssentialsGuide />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function SafetyGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      {!compact && (
        <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-white sm:p-8">
          <div className="text-[13px] font-medium text-white/70">국토교통부 안심계약 3·3·3법칙</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-[26px]">계약 전·계약 시·계약 후, 단계마다 3가지</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80 md:pr-48">
            전세뿐 아니라 보증금이 있는 월세 계약에도 같은 원칙이 적용돼요. 보증금은 대부분 사회초년생의 가장 큰 돈이니, 서두르지 말고 하나씩 확인하세요.
          </p>
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute bottom-3 right-6 hidden h-28 w-40 items-center justify-center rounded-2xl bg-white/90 md:flex">
            <StepContract className="h-24 w-auto" />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {RULE_333.map((step, si) => (
          <Card key={step.key} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="tabular flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{si + 1}</span>
                <div>
                  <div className="text-xs font-semibold text-primary">{step.stage}</div>
                  <div className="text-[15px] font-semibold">{step.title}</div>
                </div>
              </div>
              <ol className="flex flex-col gap-3">
                {step.items.map((it, i) => (
                  <li key={it.title} className="rounded-lg bg-surface p-3.5">
                    <div className="flex gap-2 text-sm font-semibold">
                      <span className="tabular text-muted-foreground">{i + 1}</span>
                      {it.title}
                    </div>
                    <p className="mt-1 pl-4 text-[13px] leading-relaxed text-muted-foreground">{it.detail}</p>
                    {(it.where || it.extra) && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-4">
                        {it.where?.map((w) => (
                          <a
                            key={w}
                            href={OFFICIAL_LINKS[w].url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-primary hover:border-primary/40"
                          >
                            {OFFICIAL_LINKS[w].label} <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                        {it.extra && <span className="text-[11px] text-muted-foreground">{it.extra}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <AlertTriangle className="h-4 w-4 text-bad" /> 이런 신호가 보이면 멈추고 다시 확인하세요
          </h3>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {RED_FLAGS.map((f) => (
              <div key={f.title} className="rounded-lg border border-bad/20 bg-bad-soft/40 p-3.5">
                <div className="text-sm font-semibold">{f.title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{f.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2.5 rounded-lg border border-border bg-background p-4 text-[13px] leading-relaxed text-muted-foreground">
        <Scale className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          이 안내는 공식 자료를 바탕으로 정리한 일반 정보이며 법률 자문이 아니에요. 제도와 서비스는 바뀔 수 있으니 계약 전 공식 안내를 다시 확인하고, 판단이 어렵거나 피해가 의심되면 지자체 전세피해지원센터 등 공식 상담 창구에 문의하세요.
          <div className="mt-2 flex flex-col gap-1">
            <span className="font-medium text-foreground">출처</span>
            {SAFETY_SOURCES.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                {s.label} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const GROUP_ORDER = ['day1', 'week1', 'safety', 'nice']

function EssentialsGuide() {
  const guide = useQuery({ queryKey: ['essentials-guide'], queryFn: api.essentialsGuide })
  const home = useQuery({ queryKey: ['home'], queryFn: api.home })
  if (guide.isLoading) return <Skeleton className="h-80" />
  const items = guide.data?.items ?? []
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-brand-soft/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">{home.data ? '우리 집 맞춤 목록이 준비되어 있어요' : '집을 결정하면 우리 집 맞춤 목록으로 바뀌어요'}</div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {home.data
              ? `'${home.data.listing?.nickname}'의 옵션과 현장 기록을 반영해 이미 있는 것은 빼고, 꼭 필요한 것부터 정리했어요.`
              : '옵션에 이미 있는 가전은 빼고, 현장 체크 기록(화장실 창문, 콘센트 개수 등)에 맞춰 우선순위를 다시 정해 드려요.'}
          </p>
        </div>
        {home.data && (
          <Button asChild className="shrink-0">
            <Link to="/home?tab=items">
              맞춤 목록 보기 <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {GROUP_ORDER.map((g) => (
          <Card key={g}>
            <CardContent className="p-5">
              <h3 className="text-[15px] font-semibold">{guide.data?.groups[g]}</h3>
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {items
                  .filter((i) => i.group === g)
                  .map((i) => (
                    <li key={i.code ?? i.name} className="flex items-start justify-between gap-3 py-2.5">
                      <div>
                        <div className="text-sm font-medium">{i.name}</div>
                        {i.reason && <div className={cn('mt-0.5 text-xs text-muted-foreground')}>{i.reason}</div>}
                      </div>
                      {i.priority === 'high' && <Badge variant="default">우선</Badge>}
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">특정 브랜드나 상품을 추천하지 않아요. 가격과 제품은 직접 비교해 고르세요.</p>
    </div>
  )
}
