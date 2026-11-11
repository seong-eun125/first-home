import { Link } from 'react-router-dom'
import { ArrowRight, Camera, Check, CircleHelp, Sparkles, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/AppShell'
import { FitRing } from '@/components/shared'
import { useReveal } from '@/hooks/useReveal'
import { StepGuide } from '@/components/StepGuide'
import { FloorPlanBackdrop, IconTile, PrecheckIllo } from '@/components/illustrations'

const WORRIES = [
  '세 번째 집을 보고 나니, 첫 번째 집이 어땠는지 기억이 안 나요.',
  '낮에 볼 땐 조용했는데, 밤이 되니 창밖이 시끄러워요.',
  '보증금이 전 재산인데, 무엇을 확인해야 안전한지 모르겠어요.',
]


const PROMISES = [
  { tile: 'compare' as const, title: '점수는 내 기준으로', desc: '같은 집도 사람마다 평가가 달라요. 우선순위를 바꾸면 순위도 바로 바뀝니다.' },
  { tile: 'clipboard' as const, title: '모르는 건 모른다고', desc: '확인하지 못한 항목은 좋게 계산하지 않고, 언제 어떻게 확인할지 알려 드려요.' },
  { tile: 'shield' as const, title: 'AI는 근거로만 말하기', desc: 'AI는 점수를 정하지 않아요. 기록에 없는 말을 한 문장은 화면에 보여 주지 않습니다.' },
]

const CHECK_ROWS = [
  { label: '벽·방음', sub: '옆집 소리, 벽 두드려 보기', state: 'unknown' as const },
  { label: '채광', sub: '창 방향, 낮 햇빛', state: 'good' as const },
  { label: '수압·온수', sub: '세면대·샤워기 동시에', state: 'good' as const },
  { label: '곰팡이·누수', sub: '창틀, 욕실 천장, 가구 뒤', state: 'bad' as const },
]

export default function IntroPage({ authed }: { authed: boolean }) {
  const ref = useReveal<HTMLDivElement>()
  const startTo = authed ? '/' : '/login'
  return (
    <div ref={ref} className="min-h-dvh overflow-x-hidden bg-background">
      {/* 상단 바 */}
      <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            {!authed && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">로그인</Link>
              </Button>
            )}
            <Button asChild size="sm">
              <Link to={startTo}>{authed ? '내 홈으로' : '시작하기'}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="relative">
        <div className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand-soft blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-24 h-80 w-80 rounded-full bg-[#eef3ef] blur-2xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 md:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
          <div>
            <p className="animate-fade-up text-sm font-semibold tracking-wide text-primary">처음 혼자 집을 구하는 사람을 위한 서비스</p>
            <h1 className="animate-fade-up mt-4 text-[40px] font-bold leading-[1.12] tracking-tight [animation-delay:80ms] sm:text-[56px]">
              첫 자취방,
              <br />
              감으로 고르지 마세요.
            </h1>
            <p className="animate-fade-up mt-6 max-w-md text-[17px] leading-relaxed text-muted-foreground [animation-delay:160ms]">
              집을 보는 순간부터 계약, 이사, 정착까지. FIRST HOME은 내가 직접 본 것을 기록하고, 내 기준으로 판단하고, 고른 집의 정보 그대로 다음 단계로 이어 줍니다.
            </p>
            <div className="animate-fade-up mt-9 flex flex-wrap gap-3 [animation-delay:240ms]">
              <Button asChild size="lg">
                <Link to={startTo}>
                  {authed ? '내 홈으로 가기' : '내 기준 만들기'} <ArrowRight />
                </Link>
              </Button>
              {!authed && (
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">데모로 둘러보기</Link>
                </Button>
              )}
            </div>
          </div>

          {/* 화면 조각으로 만든 히어로 비주얼 (뒤에 은은한 평면도) */}
          <div className="relative mx-auto h-[25rem] w-full max-w-md" aria-hidden>
            <FloorPlanBackdrop className="pointer-events-none absolute -inset-x-10 -inset-y-6 h-[calc(100%+3rem)] w-[calc(100%+5rem)]" />
            <div className="animate-fade-up absolute left-0 top-6 w-72 rounded-2xl border border-border bg-background p-5 shadow-lift [animation-delay:200ms]">
              <div className="text-xs font-medium text-muted-foreground">1위 · 내 기준 적합도</div>
              <div className="mt-3 flex items-center gap-4">
                <FitRing fit={89} size={76} label="" />
                <div>
                  <div className="font-semibold">역 근처 분리형</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">보증금 1,000만 · 월 53만</div>
                  <div className="mt-2 flex gap-1">
                    <span className="rounded-md bg-good-soft px-1.5 py-0.5 text-[11px] font-medium text-good">소음 100</span>
                    <span className="rounded-md bg-normal-soft px-1.5 py-0.5 text-[11px] font-medium text-normal">채광 50</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="animate-float absolute right-0 top-44 w-64 rounded-2xl border border-border bg-background p-4 shadow-lift">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Volume2 className="h-4 w-4 text-primary" /> 벽·방음
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1 text-[11px] font-medium">
                <span className="rounded-md border border-border py-1.5 text-center text-muted-foreground">양호</span>
                <span className="rounded-md border border-border py-1.5 text-center text-muted-foreground">보통</span>
                <span className="rounded-md border border-border py-1.5 text-center text-muted-foreground">불량</span>
                <span className="rounded-md border border-dashed border-unknown bg-unknown-soft py-1.5 text-center text-unknown">확인 못함</span>
              </div>
            </div>
            <div className="animate-fade-up absolute bottom-0 left-8 w-80 rounded-2xl bg-primary p-5 text-white shadow-lift [animation-delay:420ms]">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white/70">
                <Sparkles className="h-3.5 w-3.5" /> AI 분석 · 근거 2개
              </div>
              <p className="mt-2 text-sm leading-relaxed">
                낮 시간 도로 소음은 양호했지만, 방음은 아직 확인되지 않았어요. 저녁에 다시 방문해 보세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 왜 만들었나 */}
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
          <p className="reveal text-sm font-semibold text-white/60">왜 만들었나요</p>
          <h2 className="reveal mt-3 max-w-2xl text-3xl font-bold leading-snug tracking-tight sm:text-4xl">
            처음이라 서툰 게 아니라,
            <br />
            처음이라 기준이 없었을 뿐이에요.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {WORRIES.map((w, i) => (
              <figure key={w} className="reveal rounded-2xl border border-white/15 bg-white/[0.06] p-6" style={{ transitionDelay: `${i * 120}ms` }}>
                <div className="text-3xl font-bold leading-none text-white/30">“</div>
                <blockquote className="mt-2 text-[17px] leading-relaxed">{w}</blockquote>
              </figure>
            ))}
          </div>
          <p className="reveal mt-10 max-w-2xl text-[15px] leading-relaxed text-white/75">
            처음 혼자 집을 구하는 사람들이 자주 겪는 일이에요. 정보는 넘치는데, 내가 본 집을 내 기준으로 정리해 주는 곳은 없었어요. 그래서 기록하고, 비교하고, 결정한 다음까지 이어 주는 서비스를 만들었습니다.
          </p>
        </div>
      </section>

      {/* 자취 4단계 */}
      <section className="bg-[#EEF3EF]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
          <p className="reveal text-sm font-semibold text-primary">첫 자취, 이 순서로 준비해요</p>
          <h2 className="reveal mt-3 text-3xl font-bold tracking-tight sm:text-4xl">한 번 입력한 정보가 끝까지 이어져요</h2>
          <StepGuide className="mt-12" revealClass="reveal" />
        </div>
      </section>

      {/* 현장 체크 소개 + 모바일 목업 */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="reveal text-sm font-semibold text-primary">현장 체크</p>
          <h2 className="reveal mt-3 text-3xl font-bold leading-snug tracking-tight sm:text-4xl">
            집 보는 15분,
            <br />
            휴대폰 하나로 빠짐없이
          </h2>
          <p className="reveal mt-5 max-w-md leading-relaxed text-muted-foreground">
            현관부터 욕실까지 동선 순서대로 눌러 기록해요. 확인하지 못한 항목은 '미확인'으로 남겨 두고, 저녁 재방문 때 다시 확인하도록 알려 드려요.
          </p>
          <ul className="reveal mt-6 flex flex-col gap-2.5 text-[15px]">
            {['필수 14개 + 선택 17개 항목', '사진·메모를 항목에 바로 첨부', '자동 저장, 한 손으로 입력'].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-primary">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="reveal relative mx-auto w-full max-w-md" aria-hidden>
          <div className="absolute inset-x-6 bottom-0 top-10 rounded-[2.5rem] bg-[#F4EFE6]" />
          <div className="relative mx-auto w-[280px] rounded-[2.2rem] border-[7px] border-[#1F2A26] bg-background p-4 shadow-lift">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[#1F2A26]/80" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted-foreground">역 근처 분리형 · 현장 체크</div>
                <div className="text-[15px] font-bold">필수 항목 10 / 14</div>
              </div>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-primary">자동 저장</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[71%] rounded-full bg-primary" />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {CHECK_ROWS.map((r) => (
                <div
                  key={r.label}
                  className={
                    r.state === 'unknown'
                      ? 'rounded-xl border border-dashed border-unknown/60 bg-unknown-soft p-3'
                      : 'rounded-xl border border-border bg-background p-3'
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold">{r.label}</div>
                      <div className="text-[10px] text-muted-foreground">{r.sub}</div>
                    </div>
                    {r.state === 'unknown' ? (
                      <span className="flex items-center gap-1 rounded-full border border-dashed border-unknown px-2 py-0.5 text-[10px] font-semibold text-unknown">
                        <CircleHelp className="h-3 w-3" /> 미확인
                      </span>
                    ) : r.state === 'good' ? (
                      <span className="flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-semibold text-good">
                        <Check className="h-3 w-3" /> 체크 완료 · 양호
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-bad-soft px-2 py-0.5 text-[10px] font-semibold text-bad">
                        <Check className="h-3 w-3" /> 체크 완료 · 불량
                      </span>
                    )}
                  </div>
                  {r.state === 'bad' && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-surface px-2 py-1.5 text-[10px] text-muted-foreground">
                      <Camera className="h-3 w-3" /> 사진 1 · 욕실 천장 모서리
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI 매물 판정 */}
      <section className="bg-[#F7F2EA]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 md:py-24 lg:grid-cols-[1.05fr_1fr]">
          <div className="reveal order-2 lg:order-1">
            <PrecheckIllo className="mx-auto h-auto w-full max-w-md" />
          </div>
          <div className="order-1 lg:order-2">
            <p className="reveal text-sm font-semibold text-primary">AI 매물 판정</p>
            <h2 className="reveal mt-3 text-3xl font-bold leading-snug tracking-tight sm:text-4xl">
              링크나 캡처만 올리면,
              <br />
              내 기준으로 판단해요
            </h2>
            <p className="reveal mt-5 leading-relaxed text-muted-foreground">
              부동산 앱 화면을 캡처하면 생성형 AI가 가격·관리비·층·옵션을 읽고, 내 예산과 우선순위로 괜찮은 매물인지 알려 줘요. 예산 초과나 반지하 같은 절대 조건은 규칙으로 한 번 더 검사해요.
            </p>
            <div className="reveal mt-6 flex flex-wrap gap-2">
              {['괜찮은 매물', '확인 후 판단', '추천하지 않음'].map((t, i) => (
                <span
                  key={t}
                  className={
                    ['rounded-full px-3 py-1 text-[13px] font-semibold', i === 0 ? 'bg-good-soft text-good' : i === 1 ? 'bg-normal-soft text-normal' : 'bg-bad-soft text-bad'].join(' ')
                  }
                >
                  {t}
                </span>
              ))}
            </div>
            <Button asChild className="reveal mt-7">
              <Link to="/precheck">
                <Sparkles /> 매물 판정받기
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 약속 */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
          <p className="reveal text-sm font-semibold text-primary">세 가지 약속</p>
          <h2 className="reveal mt-3 text-3xl font-bold tracking-tight sm:text-4xl">믿을 수 있어야 도움이 되니까</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {PROMISES.map((p, i) => (
              <div key={p.title} className="reveal" style={{ transitionDelay: `${i * 120}ms` }}>
                <IconTile kind={p.tile} size="lg" />
                <h3 className="mt-4 text-xl font-semibold">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 가이드 */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="reveal rounded-2xl bg-[#F1E3D6]/60 p-7">
            <IconTile kind="shield" size="lg" className="bg-white" />
            <h3 className="mt-4 text-xl font-semibold">보증금 지키기 가이드</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              국토교통부 '안심계약 3·3·3법칙'을 바탕으로 계약 전·계약 시·계약 후에 확인할 것과 위험 신호를 정리했어요. 결정한 집의 할 일에도 자동으로 들어가요.
            </p>
          </div>
          <div className="reveal rounded-2xl bg-[#E6EFEA] p-7" style={{ transitionDelay: '120ms' }}>
            <IconTile kind="box" size="lg" className="bg-white" />
            <h3 className="mt-4 text-xl font-semibold">우리 집 맞춤 필수템</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              옵션에 이미 있는 건 빼고, 내 현장 기록(화장실 창문 없음, 콘센트 부족 등)과 생활 패턴에 맞춰 꼭 필요한 것부터 알려 드려요.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-8 py-14 text-center text-white sm:py-20">
          <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-white/5" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">내 기준으로 고르는 첫 집</h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/75">5단계 질문으로 나의 우선순위를 만들고, 오늘 본 집부터 기록해 보세요.</p>
          <Button asChild size="lg" variant="secondary" className="relative mt-8 bg-white text-primary hover:bg-white/90">
            <Link to={startTo}>
              {authed ? '내 홈으로 가기' : '지금 시작하기'} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-8">
          <span>FIRST HOME · 개인 과목 프로젝트</span>
          <span>AI 분석과 가이드는 참고용이며, 주거 안전이나 법적 문제가 없음을 보장하지 않습니다.</span>
        </div>
      </footer>
    </div>
  )
}
