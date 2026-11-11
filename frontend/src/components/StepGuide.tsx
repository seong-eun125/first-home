/** 자취 4단계 일러스트 가이드 (소개 페이지·가이드 페이지 공용) */
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { StepCheck, StepContract, StepFind, StepHome } from '@/components/illustrations'
import { cn } from '@/lib/utils'

export const STEPS = [
  {
    no: '01',
    title: '집 찾기',
    desc: '내 조건을 정하고, 마음에 드는 매물은 링크나 캡처로 AI 판정부터 받아 보세요.',
    to: '/precheck',
    art: StepFind,
    bg: 'bg-[#DCE8E6]',
  },
  {
    no: '02',
    title: '집 확인하기',
    desc: '현장 체크리스트로 수압·곰팡이·방음까지 놓치지 않고, 내 기준 점수로 비교해요.',
    to: '/listings',
    art: StepCheck,
    bg: 'bg-[#F4EFE6]',
  },
  {
    no: '03',
    title: '계약과 이사',
    desc: '안심계약 3·3·3법칙과 계약서 금액 대조로 보증금을 지키며 계약해요.',
    to: '/guide',
    art: StepContract,
    bg: 'bg-[#F1E3D6]',
  },
  {
    no: '04',
    title: '나만의 집 만들기',
    desc: '옵션과 체크 기록에 맞춘 필수템으로 첫날부터 편하게 정착해요.',
    to: '/guide?tab=essentials',
    art: StepHome,
    bg: 'bg-[#E6EFEA]',
  },
] as const

export function StepGuide({ className, revealClass, linkPrefix }: { className?: string; revealClass?: string; linkPrefix?: (to: string) => string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {STEPS.map((s, i) => (
        <article
          key={s.no}
          className={cn('group flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-soft transition-shadow hover:shadow-lift', revealClass)}
          style={{ transitionDelay: `${i * 90}ms` }}
        >
          <div className={cn('relative flex h-36 items-center justify-center', s.bg)}>
            <span className="tabular absolute left-4 top-3 text-[13px] font-bold text-primary/70">{s.no}</span>
            <s.art className="h-28 w-auto transition-transform duration-300 group-hover:-translate-y-0.5" />
          </div>
          <div className="flex flex-1 flex-col p-5">
            <h3 className="text-[17px] font-bold">{s.title}</h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>
            <Link to={linkPrefix ? linkPrefix(s.to) : s.to} className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
              자세히 보기 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </article>
      ))}
    </div>
  )
}
