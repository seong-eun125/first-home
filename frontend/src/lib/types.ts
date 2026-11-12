export type CategoryKey = 'noise' | 'security' | 'hygiene' | 'light' | 'facility' | 'space' | 'convenience' | 'cost'

export interface User {
  id: number
  email: string
  name: string
}

export interface Answers {
  noise_sensitivity?: 'low' | 'mid' | 'high'
  bug_sensitivity?: 'low' | 'mid' | 'high'
  return_time?: 'early' | 'normal' | 'late'
  cooking?: 'rarely' | 'sometimes' | 'often'
  cost_sensitivity?: 'low' | 'mid' | 'high'
  work_from_home?: boolean
}

export interface Profile {
  answers: Answers
  top_priorities: string[]
  monthly_budget: number | null
  deposit_budget: number | null
  destination_label: string | null
  max_walk_minutes: number | null
  dealbreakers: string[]
  onboarding_done: boolean
}

export interface ProfileInput extends Omit<Profile, 'onboarding_done'> {
  weights?: Record<string, number>
}

export interface ProfileResponse {
  profile: Profile | null
  weights: Record<string, number>
  categories: Record<string, string>
  dealbreaker_options: Record<string, string>
}

export interface ChecklistItem {
  id: string
  category: CategoryKey
  label: string
  item_type: 'fact' | 'observe' | 'measure'
  input_type: 'status' | 'yesno' | 'number' | 'choice'
  options: { value: string; label: string }[] | null
  is_required: boolean
  zone: string
  guide_text: string
  caution_text: string | null
  time_sensitive: boolean
  sort_order: number
}

export interface ListingInput {
  nickname: string
  building_name: string | null
  address: string
  deposit: number
  monthly_rent: number
  maintenance_fee: number
  fee_includes: string[]
  floor: number | null
  total_floors: number | null
  floor_type: 'normal' | 'first' | 'semi_basement' | 'rooftop'
  area_m2: number | null
  walk_minutes: number | null
  move_in_available: string | null
  contract_months: number | null
  options: string[]
  source_link: string | null
  agency_memo: string | null
  review_memo: string | null
  first_impression: string | null
}

export interface ListingBase extends ListingInput {
  id: number
  status: 'candidate' | 'hold' | 'rejected' | 'missed' | 'selected'
  lawd_cd?: string | null
  house_type?: HouseType | null
  created_at: string
  updated_at: string
}

export interface ListingSummary extends ListingBase {
  fit: number | null
  coverage: number
  dealbreaker_violations: { code: string; label: string }[]
  unverified_count: number
  visit_count: number
  cover_photo_id: number | null
}

export interface Visit {
  id: number
  visited_at: string
  occupancy: 'empty' | 'occupied'
  note: string | null
}

export interface Check {
  item_id: string
  value: string
  note: string | null
  visit_id: number | null
  checked_at: string
}

export interface Photo {
  id: number
  item_id: string | null
  file_name: string
  original_name: string | null
  caption: string | null
  created_at: string
}

export interface ListingDetail extends ListingBase {
  visits: Visit[]
  checks: Check[]
  photos: Photo[]
}

export interface CategoryScore {
  label: string
  score: number | null
  weight: number
  checked: number
  total: number
}

export interface Unverified {
  item_id: string
  label: string
  category: string
  category_label: string
  weight: number
  reason: 'unknown' | 'unanswered'
  how_to_check: string
  caution: string | null
}

export interface ScoreResult {
  listing_id: number
  nickname: string
  fit: number | null
  coverage: number
  low_coverage: boolean
  category_scores: Record<CategoryKey, CategoryScore>
  dealbreaker_violations: { code: string; label: string }[]
  unverified: Unverified[]
  hints: { type: string; text: string }[]
  evidence: Record<string, { label: string; category: string; value: string | number; score: number | null; visit_time: string | null }>
  check_values: Record<string, string>
  monthly_total: number
  deposit: number
  rank?: number
}

export interface Comparison {
  id: number
  listing_ids: number[]
  weights: Record<string, number>
  results: ScoreResult[]
  categories: Record<string, string>
  created_at: string
}

export interface EvidencePoint {
  text: string
  evidence: string[]
}

export interface ListingReportOutput {
  summary: string
  pros: EvidencePoint[]
  cons: EvidencePoint[]
  unverified: { item_id: string; why_it_matters: string; how_to_check: string }[]
  questions_to_ask: string[]
  decision_note: string
  dropped_claims: number
}

export interface CompareReportOutput {
  summary: string
  per_listing: {
    listing_id: number
    one_liner: string
    strengths: EvidencePoint[]
    watch_outs: EvidencePoint[]
    check_before_decide: string[]
  }[]
  conditional_picks: { condition: string; listing_id: number; reason: string }[]
  closing: string
  dropped_claims: number
}

export interface AIReport {
  id: number
  kind: 'listing' | 'compare'
  mode: 'openai' | 'mock' | 'fallback'
  model: string | null
  cached: boolean
  error: string | null
  stale: boolean
  created_at: string
  output: ListingReportOutput & CompareReportOutput
  score?: ScoreResult
  scores?: ScoreResult[]
}

export interface AIStatus {
  configured_mode: string
  effective_mode: 'openai' | 'mock'
  openai_ready: boolean
  model: string | null
  usage_today_user: number
  limit_per_user: number
}

export interface HomeTask {
  id: number
  phase: 'contract' | 'moving' | 'movein' | 'settle'
  title: string
  detail: string | null
  due_date: string | null
  done: boolean
  source: string
}

export interface HomeCost {
  id: number
  kind: 'initial' | 'monthly'
  label: string
  amount: number
  source: string
  refundable: boolean
}

export interface HomeData {
  id: number
  listing: {
    id: number
    nickname: string
    address: string
    deposit: number
    monthly_rent: number
    maintenance_fee: number
    options: string[]
  } | null
  move_in_date: string | null
  decision_note: string | null
  decided_at: string | null
  contract: {
    deposit: number | null
    rent: number | null
    maintenance: number | null
    start: string | null
    end: string | null
    mismatches: { field: string; label: string; listing_value: number; contract_value: number }[]
  }
  phases: Record<string, string>
  tasks: HomeTask[]
  progress: { done: number; total: number }
  costs: HomeCost[]
  cost_summary: {
    initial_total: number
    initial_non_refundable: number
    monthly_total: number
    monthly_budget: number | null
  }
  settle_tips: { item_id: string | null; title: string; text: string }[]
  item_groups: Record<string, string>
  items: HomeItem[]
}

export interface HomeItem {
  id: number
  code: string | null
  group: 'day1' | 'week1' | 'safety' | 'nice'
  name: string
  reason: string | null
  priority: 'high' | 'normal'
  status: 'todo' | 'have' | 'bought' | 'skip'
  source: string
}

// ---------------------------------------------------------------- 실거래가
export type HouseType = 'offi' | 'rh' | 'sh'

export interface MarketDeal {
  date: string | null
  dong: string
  name: string
  area: number | null
  floor: number | null
  deposit: number // 만원
  rent: number // 만원 (0이면 전세)
  contract_type: string
  build_year: number | null
}

export interface MarketReport {
  is_sample: boolean
  source: string
  region: { code: string; name: string }
  house_type: { code: HouseType; label: string }
  dong: string | null
  suggested_dong: string | null
  months: string[]
  cached_months: number
  scope: string
  area_label: string
  total: number
  wolse: { count: number; median_rent: number; p25_rent: number; p75_rent: number; median_deposit: number } | null
  jeonse: { count: number; median_deposit: number } | null
  compare: {
    basis: string
    count: number
    my_rent?: number
    my_deposit?: number
    median_rent?: number
    median_deposit?: number
    diff: number
    percentile: number | null
    level: 'low' | 'mid' | 'high'
    label: string
    few: boolean
  } | null
  recent: MarketDeal[]
  notes: string[]
  disclaimer: string
}

export interface MarketStatus {
  mode: 'live' | 'mock'
  is_sample: boolean
  months: number
  house_types: { code: HouseType; label: string }[]
}

// ---------------------------------------------------------------- AI 매물 판정
export type Verdict = 'good' | 'check' | 'bad'

export interface PrecheckResult {
  report_id: number
  mode: 'openai' | 'mock' | 'fallback'
  model: string | null
  cached: boolean
  error: string | null
  source: { kind: 'url' | 'text' | 'image'; url: string | null; chars: number; image_count: number; notes: string[] }
  title: string | null
  extracted: {
    deposit_manwon: number | null
    monthly_rent_manwon: number | null
    maintenance_fee_manwon: number | null
    maintenance_includes: string[]
    area_m2: number | null
    floor: number | null
    total_floors: number | null
    floor_type: 'normal' | 'first' | 'semi_basement' | 'rooftop' | 'unknown'
    house_type: 'offi' | 'rh' | 'sh' | 'apt' | 'unknown'
    address_text: string | null
    options: string[]
    available_from: string | null
    built_year: number | null
    entrance_lock: boolean | null
    station_walk_text: string | null
  }
  quotes: Record<string, string>
  dropped_fields?: string[]
  priority_review: { category: CategoryKey; label: string; assessment: 'good' | 'concern' | 'unknown'; reason: string; quote: string | null }[]
  red_flags: { text: string; quote: string; source: 'ai' | 'rule' }[]
  ai_verdict: Verdict
  verdict_reason: string
  summary: string
  questions_to_ask: string[]
  visit_checklist: string[]
  market: {
    region: { code: string; name: string }
    house_type: { code: HouseType; label: string }
    dong: string | null
    is_sample: boolean
    source: string
    compare: MarketReport['compare']
    wolse: MarketReport['wolse']
  } | null
  gates: { label: string; status: 'pass' | 'fail' | 'unknown'; detail: string }[]
  rule_cap: Verdict
  rule_reasons: string[]
  final_verdict: Verdict
  final_label: string
  lowered_by_rules: boolean
  verdict_labels: Record<Verdict, string>
  listing_draft: Partial<ListingInput> & { nickname: string; address: string }
  profile_ready: boolean
}

// ---------------------------------------------------------------- 만족도 설문
export interface SurveyQuestion {
  id: string
  area: string
  text: string
}
export interface SurveyMine {
  segment: string | null
  scores: Record<string, number>
  good_text: string | null
  improve_text: string | null
  updated_at: string | null
}
export interface SurveyInfo {
  version: number
  scale: string[]
  segments: { value: string; label: string }[]
  questions: SurveyQuestion[]
  open: { id: 'good_text' | 'improve_text'; text: string }[]
  mine: SurveyMine | null
  is_admin: boolean
}
export interface SurveyResults {
  respondents: number
  overall_mean: number | null
  recommend_top2_pct: number | null
  questions: (SurveyQuestion & { mean: number | null; sd: number | null; dist: number[]; top2_pct: number | null })[]
  segments: Record<string, number>
  good: string[]
  improve: string[]
  first_at: string | null
  last_at: string | null
  usage: { users: number; onboarded: number; users_with_listing: number; listings: number; precheck_runs: number; ai_reports: number; decided_homes: number }
  scale: string[]
  excluded_note: string
}
