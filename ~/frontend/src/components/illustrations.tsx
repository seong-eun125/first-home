/**
 * FIRST HOME 일러스트 세트 (인라인 SVG, 외부 이미지 없음).
 * 같은 선 굵기(1.6)와 팔레트(딥그린·세이지·크림·웜그레이)로 통일했습니다.
 * 모두 장식용이라 aria-hidden 처리합니다.
 */
import { cn } from '@/lib/utils'

const G = '#2F5D50' // deep green
const G2 = '#4E7366'
const SAGE = '#7C9885'
const SAGE_L = '#B9C8BD'
const MINT = '#E6EFEA'
const CREAM = '#F4EFE6'
const SAND = '#E7DFD2'
const WOOD = '#C9A98A'
const BOX = '#D9B98F'
const FRAME = '#D9CFBE'

type P = { className?: string }

/** 넓은 배너: 창문 세 개, 책장, 식물, 은은한 평면도 라인 */
export function RoomScene({ className, tone = 'cream' }: P & { tone?: 'cream' | 'mint' }) {
  const wall = tone === 'cream' ? CREAM : '#EEF3EF'
  return (
    <svg viewBox="0 0 1240 220" preserveAspectRatio="xMidYMid slice" className={cn('h-full w-full', className)} aria-hidden="true">
      <rect width="1240" height="220" fill={wall} />
      <rect y="168" width="1240" height="52" fill={SAND} />
      <g stroke="#E0D7C8" strokeWidth="1">
        <line x1="0" y1="190" x2="1240" y2="190" />
        <line x1="0" y1="206" x2="1240" y2="206" />
      </g>
      {[560, 780, 1000].map((x) => (
        <g key={x}>
          <rect x={x} y="22" width="190" height="140" rx="6" fill="#fff" stroke={FRAME} strokeWidth="4" />
          <rect x={x + 6} y="28" width="178" height="128" fill={MINT} />
          <line x1={x + 95} y1="28" x2={x + 95} y2="156" stroke={FRAME} strokeWidth="4" />
          <line x1={x + 6} y1="92" x2={x + 184} y2="92" stroke={FRAME} strokeWidth="4" />
          <polygon points={`${x + 6},156 ${x + 184},156 ${x + 140},220 ${x - 40},220`} fill="#fff" opacity="0.45" />
        </g>
      ))}
      <g>
        <rect x="60" y="30" width="220" height="140" rx="4" fill="#D8CCB8" />
        <rect x="70" y="40" width="200" height="38" fill="#EDE5D7" />
        <rect x="70" y="86" width="200" height="38" fill="#EDE5D7" />
        <rect x="70" y="132" width="200" height="30" fill="#EDE5D7" />
        <rect x="80" y="48" width="10" height="30" fill={SAGE} />
        <rect x="92" y="52" width="8" height="26" fill={WOOD} />
        <rect x="102" y="46" width="12" height="32" fill={G} />
        <rect x="116" y="54" width="9" height="24" fill={SAGE_L} />
        <rect x="200" y="58" width="44" height="20" rx="3" fill={SAGE_L} />
        <rect x="80" y="94" width="40" height="30" rx="4" fill={WOOD} />
        <rect x="150" y="96" width="10" height="28" fill={G} />
        <rect x="162" y="100" width="10" height="24" fill={SAGE} />
        <rect x="174" y="94" width="8" height="30" fill={BOX} />
        <circle cx="232" cy="110" r="12" fill={SAGE} />
        <rect x="226" y="114" width="12" height="10" fill={WOOD} />
      </g>
      <g>
        <path d="M440 168 h40 l-6 -34 h-28 z" fill={WOOD} />
        <path d="M460 134 C440 110 432 86 446 64 C452 92 458 108 460 134 Z" fill={SAGE} />
        <path d="M460 134 C478 104 498 90 512 92 C496 108 480 120 460 134 Z" fill={G2} />
        <path d="M460 134 C456 100 470 70 488 58 C480 88 470 112 460 134 Z" fill={G} />
      </g>
      <g stroke={G} strokeWidth="1.2" fill="none" opacity="0.1">
        <rect x="300" y="40" width="200" height="110" />
        <line x1="380" y1="40" x2="380" y2="150" />
        <line x1="300" y1="100" x2="380" y2="100" />
        <path d="M380 120 A26 26 0 0 1 406 146" />
      </g>
    </svg>
  )
}

/** 히어로 배경용: 아주 옅은 평면도 + 창문 */
export function FloorPlanBackdrop({ className }: P) {
  return (
    <svg viewBox="0 0 600 420" className={className} aria-hidden="true" fill="none">
      <g stroke={G} strokeWidth="1.4" opacity="0.13">
        <rect x="20" y="20" width="560" height="380" rx="4" />
        <line x1="300" y1="20" x2="300" y2="250" />
        <line x1="20" y1="250" x2="420" y2="250" />
        <line x1="420" y1="250" x2="420" y2="400" />
        <path d="M300 200 A50 50 0 0 1 350 250" />
        <path d="M420 330 A40 40 0 0 0 380 370" />
        <rect x="60" y="60" width="120" height="70" rx="6" />
        <rect x="340" y="60" width="200" height="110" rx="6" />
        <line x1="440" y1="60" x2="440" y2="170" />
        <circle cx="500" cy="330" r="30" />
        <rect x="60" y="290" width="160" height="60" rx="8" />
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- 가이드 4단계 */
export function StepFind({ className }: P) {
  return (
    <svg viewBox="0 0 130 90" className={className} aria-hidden="true">
      <rect x="22" y="14" width="78" height="50" rx="4" fill="#fff" stroke={G} strokeWidth="1.6" />
      <path d="M14 68h94l-6 8H20z" fill={SAND} stroke={G} strokeWidth="1.6" />
      <rect x="30" y="22" width="30" height="20" rx="2" fill={MINT} />
      <path d="M30 48h40M30 54h28" stroke={SAGE_L} strokeWidth="2" />
      <path d="M78 26c0-6 10-6 10 0 0 5-5 10-5 10s-5-5-5-10z" fill={G} />
      <circle cx="104" cy="44" r="10" fill="none" stroke={G2} strokeWidth="2" />
      <path d="M111 51l8 8" stroke={G2} strokeWidth="2.4" />
    </svg>
  )
}

export function StepCheck({ className }: P) {
  return (
    <svg viewBox="0 0 130 90" className={className} aria-hidden="true">
      <rect x="70" y="10" width="44" height="58" rx="3" fill={MINT} stroke={FRAME} strokeWidth="3" />
      <path d="M92 10v58M70 39h44" stroke={FRAME} strokeWidth="3" />
      <rect x="24" y="16" width="36" height="52" rx="3" fill="#fff" stroke={G} strokeWidth="1.6" />
      <rect x="34" y="12" width="16" height="7" rx="2" fill={SAGE} />
      <path d="M30 30l3 3 5-6M30 44l3 3 5-6" fill="none" stroke={G} strokeWidth="1.6" />
      <path d="M42 31h12M42 45h12M30 58h24" stroke={SAGE_L} strokeWidth="2" />
      <path d="M10 78h110" stroke={G} strokeWidth="1.6" />
    </svg>
  )
}

export function StepContract({ className }: P) {
  return (
    <svg viewBox="0 0 130 90" className={className} aria-hidden="true">
      <rect x="16" y="12" width="40" height="52" rx="3" fill="#fff" stroke={G} strokeWidth="1.6" />
      <path d="M24 24h24M24 32h24M24 40h16" stroke={SAGE_L} strokeWidth="2" />
      <path d="M24 54c4-4 6 2 10-2s6 2 10-1" fill="none" stroke={G} strokeWidth="1.6" />
      <rect x="66" y="44" width="30" height="26" fill={BOX} stroke={G} strokeWidth="1.6" />
      <rect x="84" y="24" width="28" height="22" fill={SAND} stroke={G} strokeWidth="1.6" />
      <rect x="96" y="46" width="22" height="24" fill={BOX} stroke={G} strokeWidth="1.6" />
      <circle cx="62" cy="22" r="6" fill="none" stroke={G} strokeWidth="1.8" />
      <path d="M67 26l10 10M73 32l3-3" stroke={G} strokeWidth="1.8" />
      <path d="M8 72h114" stroke={G} strokeWidth="1.6" />
    </svg>
  )
}

export function StepHome({ className }: P) {
  return (
    <svg viewBox="0 0 130 90" className={className} aria-hidden="true">
      <rect x="52" y="12" width="26" height="20" rx="2" fill="#fff" stroke={G} strokeWidth="1.6" />
      <path d="M56 28l7-8 5 5 6-7" fill="none" stroke={SAGE} strokeWidth="1.6" />
      <path d="M28 56h70v14H28z" fill={SAGE} stroke={G} strokeWidth="1.6" />
      <path d="M34 44h58a6 6 0 0 1 6 6v6H28v-6a6 6 0 0 1 6-6z" fill={SAGE_L} stroke={G} strokeWidth="1.6" />
      <path d="M32 70v6M94 70v6" stroke={G} strokeWidth="1.6" />
      <path d="M112 76h-10l2-14h6z" fill={WOOD} />
      <path d="M107 62c-8-8-8-18-2-26 2 10 3 18 2 26z" fill={G2} />
      <path d="M107 62c4-10 10-14 14-14-3 7-8 11-14 14z" fill={G} />
      <path d="M14 30v46M8 30h12l-3-8h-6z" stroke={G} strokeWidth="1.6" fill="#F7EEDC" />
      <path d="M6 78h118" stroke={G} strokeWidth="1.6" />
    </svg>
  )
}

/* ---------------------------------------------------------------- 매물 카드용 건물 */
export function Building({ variant = 0, className }: P & { variant?: number }) {
  const v = Math.abs(variant) % 3
  if (v === 0)
    return (
      <svg viewBox="0 0 120 96" className={className} aria-hidden="true">
        <rect x="30" y="20" width="60" height="70" rx="3" fill="#fff" stroke={G} strokeWidth="1.6" />
        <g fill={SAGE_L}>
          <rect x="38" y="30" width="12" height="10" />
          <rect x="54" y="30" width="12" height="10" />
          <rect x="70" y="30" width="12" height="10" />
          <rect x="38" y="46" width="12" height="10" />
          <rect x="70" y="46" width="12" height="10" />
        </g>
        <rect x="54" y="46" width="12" height="10" fill={SAGE} />
        <rect x="52" y="66" width="16" height="24" fill={G} />
        <path d="M14 90h92" stroke={G} strokeWidth="1.6" />
        <circle cx="98" cy="74" r="8" fill={SAGE} />
        <rect x="97" y="80" width="2" height="10" fill={G2} />
      </svg>
    )
  if (v === 1)
    return (
      <svg viewBox="0 0 120 96" className={className} aria-hidden="true">
        <rect x="22" y="12" width="76" height="78" rx="3" fill="#fff" stroke={G} strokeWidth="1.6" />
        <g fill={FRAME}>
          <rect x="30" y="20" width="14" height="10" />
          <rect x="53" y="20" width="14" height="10" />
          <rect x="76" y="20" width="14" height="10" />
          <rect x="30" y="38" width="14" height="10" />
          <rect x="76" y="38" width="14" height="10" />
          <rect x="30" y="56" width="14" height="10" />
          <rect x="53" y="56" width="14" height="10" />
          <rect x="76" y="56" width="14" height="10" />
        </g>
        <rect x="53" y="38" width="14" height="10" fill={WOOD} />
        <path d="M50 49h20" stroke={G} strokeWidth="1.6" />
        <rect x="52" y="72" width="16" height="18" fill={G} />
        <path d="M10 90h100" stroke={G} strokeWidth="1.6" />
      </svg>
    )
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden="true">
      <path d="M26 44 60 22l34 22v46H26z" fill="#fff" stroke={G} strokeWidth="1.6" />
      <rect x="36" y="54" width="16" height="14" fill={FRAME} />
      <rect x="68" y="54" width="16" height="14" fill={FRAME} />
      <rect x="52" y="70" width="16" height="20" fill={G} />
      <path d="M8 90h104" stroke={G} strokeWidth="1.6" />
      <path d="M14 90V66" stroke={G2} strokeWidth="1.6" />
      <circle cx="14" cy="62" r="7" fill={SAGE} />
    </svg>
  )
}

export const BUILDING_BG = ['bg-[#E6EFEA]', 'bg-[#F4EFE6]', 'bg-[#F1E3D6]']

/* ---------------------------------------------------------------- 그림 아이콘 타일 */
type TileKind = 'house' | 'clipboard' | 'shield' | 'box' | 'scan' | 'compare' | 'key' | 'coin'
const TILE_BG: Record<TileKind, string> = {
  house: 'bg-[#F4EFE6]',
  clipboard: 'bg-[#E6EFEA]',
  shield: 'bg-[#F1E3D6]',
  box: 'bg-[#EDEAE4]',
  scan: 'bg-[#E3ECF0]',
  compare: 'bg-[#E6EFEA]',
  key: 'bg-[#F7EEDC]',
  coin: 'bg-[#F4EFE6]',
}

function TileArt({ kind }: { kind: TileKind }) {
  switch (kind) {
    case 'house':
      return (
        <>
          <rect x="7" y="13" width="18" height="14" rx="2" fill={SAND} stroke={G} strokeWidth="1.5" />
          <rect x="11" y="16" width="4" height="4" fill={SAGE_L} />
          <rect x="17" y="16" width="4" height="4" fill={SAGE_L} />
          <rect x="14" y="21" width="4" height="6" fill={SAGE} />
          <path d="M5 14 16 5l11 9" fill="none" stroke={G} strokeWidth="1.5" />
        </>
      )
    case 'clipboard':
      return (
        <>
          <rect x="8" y="5" width="16" height="22" rx="2" fill="#fff" stroke={G} strokeWidth="1.5" />
          <rect x="12" y="3" width="8" height="4" rx="1" fill={SAGE} />
          <path d="M11 13l2 2 4-4" fill="none" stroke={G} strokeWidth="1.6" />
          <path d="M11 20h10" stroke={SAGE_L} strokeWidth="1.6" />
        </>
      )
    case 'shield':
      return (
        <>
          <path d="M16 4 26 8v8c0 6-4 10-10 12C10 26 6 22 6 16V8z" fill="#fff" stroke={G} strokeWidth="1.5" />
          <path d="M12 16l3 3 5-6" fill="none" stroke={G} strokeWidth="1.6" />
        </>
      )
    case 'box':
      return (
        <>
          <rect x="5" y="14" width="22" height="13" rx="2" fill={BOX} stroke={G} strokeWidth="1.5" />
          <path d="M5 14l4-6h14l4 6" fill={SAND} stroke={G} strokeWidth="1.5" />
          <path d="M16 14v13" stroke={G} strokeWidth="1.5" />
        </>
      )
    case 'scan':
      return (
        <>
          <rect x="7" y="4" width="14" height="24" rx="3" fill="#fff" stroke={G} strokeWidth="1.5" />
          <path d="M10 10h8M10 14h6" stroke={SAGE_L} strokeWidth="1.6" />
          <circle cx="21" cy="19" r="5" fill={MINT} stroke={G} strokeWidth="1.5" />
          <path d="M24.5 22.5l3.5 3.5" stroke={G} strokeWidth="1.8" />
          <path d="M19 18.5l1.5 1.5 2.5-3" fill="none" stroke={G} strokeWidth="1.3" />
        </>
      )
    case 'compare':
      return (
        <>
          <rect x="4" y="10" width="10" height="17" rx="1.5" fill="#fff" stroke={G} strokeWidth="1.5" />
          <rect x="18" y="6" width="10" height="21" rx="1.5" fill={SAGE_L} stroke={G} strokeWidth="1.5" />
          <path d="M7 15h4M7 19h4M21 11h4M21 15h4" stroke={G} strokeWidth="1.2" />
        </>
      )
    case 'key':
      return (
        <>
          <circle cx="11" cy="17" r="5" fill="#fff" stroke={G} strokeWidth="1.6" />
          <path d="M15 14l10-9M21 9l3 3" stroke={G} strokeWidth="1.6" />
        </>
      )
    case 'coin':
      return (
        <>
          <ellipse cx="16" cy="22" rx="10" ry="4" fill={BOX} stroke={G} strokeWidth="1.5" />
          <ellipse cx="16" cy="16" rx="10" ry="4" fill={SAND} stroke={G} strokeWidth="1.5" />
          <ellipse cx="16" cy="10" rx="10" ry="4" fill="#fff" stroke={G} strokeWidth="1.5" />
        </>
      )
  }
}

export function IconTile({ kind, size = 'md', className }: P & { kind: TileKind; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'h-9 w-9 rounded-xl' : size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-11 w-11 rounded-xl'
  const art = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-8 w-8' : 'h-6 w-6'
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', box, TILE_BG[kind], className)} aria-hidden="true">
      <svg viewBox="0 0 32 32" className={art}>
        <TileArt kind={kind} />
      </svg>
    </span>
  )
}

/** AI 매물 판정 소개용: 휴대폰 캡처 → 판정 카드 */
export function PrecheckIllo({ className }: P) {
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden="true">
      <rect x="20" y="14" width="70" height="124" rx="12" fill="#fff" stroke={G} strokeWidth="1.8" />
      <rect x="30" y="30" width="50" height="34" rx="4" fill={MINT} />
      <path d="M38 56l10-12 8 8 6-6 10 10" fill="none" stroke={SAGE} strokeWidth="1.6" />
      <path d="M30 74h44M30 82h34M30 90h40" stroke={SAGE_L} strokeWidth="3" strokeLinecap="round" />
      <rect x="30" y="102" width="50" height="22" rx="5" fill={CREAM} />
      <path d="M36 113h20" stroke={WOOD} strokeWidth="3" strokeLinecap="round" />
      <path d="M98 76h26" stroke={G2} strokeWidth="1.8" strokeDasharray="3 4" />
      <path d="M120 70l7 6-7 6" fill="none" stroke={G2} strokeWidth="1.8" />
      <rect x="134" y="34" width="72" height="84" rx="10" fill="#fff" stroke={G} strokeWidth="1.8" />
      <circle cx="170" cy="62" r="15" fill={MINT} stroke={G} strokeWidth="1.8" />
      <path d="M163 62l5 5 9-10" fill="none" stroke={G} strokeWidth="2.2" />
      <path d="M146 88h48M146 98h36M146 108h42" stroke={SAGE_L} strokeWidth="3" strokeLinecap="round" />
      <path d="M190 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={WOOD} />
    </svg>
  )
}
