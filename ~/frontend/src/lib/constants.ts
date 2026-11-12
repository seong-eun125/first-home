import {
  Volume2,
  ShieldCheck,
  Bug,
  Sun,
  Wrench,
  Ruler,
  MapPin,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryKey } from './types'

export const CATEGORY_META: Record<CategoryKey, { label: string; icon: LucideIcon; desc: string }> = {
  noise: { label: '소음', icon: Volume2, desc: '도로·이웃 소리, 방음' },
  security: { label: '보안·사생활', icon: ShieldCheck, desc: '공동현관, 방범창, 시선' },
  hygiene: { label: '위생·해충', icon: Bug, desc: '해충, 곰팡이, 흡연 흔적' },
  light: { label: '채광·환기', icon: Sun, desc: '햇빛, 창문, 환기' },
  facility: { label: '설비', icon: Wrench, desc: '수압·온수, 배수, 보일러' },
  space: { label: '구조·공간', icon: Ruler, desc: '옵션, 주방, 가구 배치' },
  convenience: { label: '생활 편의', icon: MapPin, desc: '도보 시간, 편의시설' },
  cost: { label: '비용', icon: Wallet, desc: '월세+관리비 vs 예산' },
}

export const CATEGORY_ORDER: CategoryKey[] = ['noise', 'security', 'hygiene', 'light', 'facility', 'space', 'convenience', 'cost']

export const FLOOR_TYPE_LABEL: Record<string, string> = {
  normal: '일반층',
  first: '1층',
  semi_basement: '반지하',
  rooftop: '옥탑',
}

export const STATUS_LABEL: Record<string, string> = {
  candidate: '후보',
  hold: '보류',
  rejected: '탈락',
  missed: '놓침',
  selected: '최종 선택',
}

export const VALUE_LABEL: Record<string, string> = {
  good: '양호',
  normal: '보통',
  bad: '불량',
  unknown: '확인 못함',
  yes: '있음',
  no: '없음',
}

export const ZONE_LABEL: Record<string, string> = {
  outside: '건물 밖',
  common: '공용 공간',
  room: '방',
  bath: '화장실',
  kitchen: '주방',
}
export const ZONE_ORDER = ['outside', 'common', 'room', 'bath', 'kitchen']

export const OPTION_PRESETS = ['냉장고', '세탁기', '에어컨', '전자레인지', '침대', '책상', '옷장', '인덕션', '신발장']
export const FEE_PRESETS = ['수도', '인터넷', 'TV', '청소비', '전기', '가스']

export const PHASE_LABEL: Record<string, string> = {
  contract: '계약 전·계약 당일',
  moving: '이사 준비',
  movein: '입주',
  settle: '생활 정착',
}

export function scoreTone(score: number | null | undefined): 'good' | 'normal' | 'bad' | 'unknown' {
  if (score === null || score === undefined) return 'unknown'
  if (score >= 75) return 'good'
  if (score >= 50) return 'normal'
  return 'bad'
}
