/**
 * 백엔드(FastAPI) 호출 모음.
 * 모든 요청은 /api 로 보내고, Vite 개발 서버가 8000번 포트로 넘겨 줍니다.
 * 로그인 정보는 httpOnly 쿠키로 오가므로 프론트 코드에 토큰·API 키가 없습니다.
 */
import type {
  AdminOverview,
  AIReport,
  AIStatus,
  ChecklistItem,
  Comparison,
  HomeData,
  HomeItem,
  ListingDetail,
  ListingInput,
  ListingSummary,
  MarketReport,
  MarketStatus,
  PrecheckResult,
  SurveyInfo,
  SurveyResults,
  ProfileInput,
  ProfileResponse,
  ScoreResult,
  User,
  Visit,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      ...init,
      headers: init.body instanceof FormData ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다. 백엔드(uvicorn)가 실행 중인지 확인해 주세요.')
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    let msg = '요청을 처리하지 못했습니다.'
    if (data?.detail) {
      if (typeof data.detail === 'string') msg = data.detail
      else if (Array.isArray(data.detail)) msg = data.detail.map((d: { msg: string }) => d.msg.replace(/^Value error, /, '')).join(', ')
    } else if (res.status === 502 || res.status === 504) {
      msg = '백엔드 서버가 응답하지 않습니다. uvicorn이 실행 중인지 확인해 주세요.'
    }
    throw new ApiError(res.status, msg)
  }
  return data as T
}

const json = (body: unknown) => JSON.stringify(body)

export const api = {
  // 인증
  me: () => request<User>('/auth/me'),
  login: (email: string, password: string) => request<User>('/auth/login', { method: 'POST', body: json({ email, password }) }),
  checkEmail: (email: string) =>
    request<{ available: boolean; reason: 'invalid' | 'taken' | null }>(`/auth/check-email?email=${encodeURIComponent(email)}`),
  signup: (email: string, password: string, name: string) =>
    request<User>('/auth/signup', { method: 'POST', body: json({ email, password, name }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  // 프로필·가중치
  profile: () => request<ProfileResponse>('/profile'),
  saveProfile: (body: ProfileInput) =>
    request<{ weights: Record<string, number> }>('/profile', { method: 'PUT', body: json(body) }),
  suggestWeights: (body: ProfileInput) =>
    request<{ weights: Record<string, number> }>('/profile/suggest-weights', { method: 'POST', body: json(body) }),
  saveWeights: (weights: Record<string, number>) =>
    request<{ weights: Record<string, number> }>('/profile/weights', { method: 'PUT', body: json({ weights }) }),

  // 체크 항목
  checklistItems: () => request<ChecklistItem[]>('/checklist-items'),

  // 매물
  listings: () => request<ListingSummary[]>('/listings'),
  listing: (id: number) => request<ListingDetail>(`/listings/${id}`),
  createListing: (body: ListingInput) => request<ListingDetail>('/listings', { method: 'POST', body: json(body) }),
  updateListing: (id: number, body: Partial<ListingInput> & { status?: string }) =>
    request<ListingDetail>(`/listings/${id}`, { method: 'PATCH', body: json(body) }),
  deleteListing: (id: number) => request<void>(`/listings/${id}`, { method: 'DELETE' }),
  duplicateCheck: (body: { address?: string; building_name?: string; exclude_id?: number }) =>
    request<{ duplicates: { id: number; nickname: string; address: string; building_name: string | null }[] }>(
      '/listings/duplicate-check',
      { method: 'POST', body: json(body) },
    ),
  listingScore: (id: number) => request<ScoreResult>(`/listings/${id}/score`),
  addVisit: (id: number, body: { visited_at: string; occupancy: string; note?: string }) =>
    request<Visit>(`/listings/${id}/visits`, { method: 'POST', body: json(body) }),
  deleteVisit: (id: number, visitId: number) => request<void>(`/listings/${id}/visits/${visitId}`, { method: 'DELETE' }),
  saveChecks: (id: number, checks: { item_id: string; value: string; note?: string | null; visit_id?: number | null }[]) =>
    request<{ checks: unknown[]; score: ScoreResult }>(`/listings/${id}/checks`, { method: 'PUT', body: json({ checks }) }),
  uploadPhoto: (id: number, file: File, itemId?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (itemId) fd.append('item_id', itemId)
    return request<{ id: number }>(`/listings/${id}/photos`, { method: 'POST', body: fd })
  },
  deletePhoto: (photoId: number) => request<void>(`/photos/${photoId}`, { method: 'DELETE' }),
  photoUrl: (photoId: number) => `/api/photos/${photoId}/file`,

  // 점수·비교
  previewScores: (weights?: Record<string, number>, listing_ids?: number[]) =>
    request<{ weights: Record<string, number>; categories: Record<string, string>; results: ScoreResult[] }>(
      '/scores/preview',
      { method: 'POST', body: json({ weights, listing_ids }) },
    ),
  createComparison: (listing_ids: number[], weights?: Record<string, number>) =>
    request<Comparison>('/comparisons', { method: 'POST', body: json({ listing_ids, weights }) }),
  latestComparison: () => request<Comparison | null>('/comparisons/latest'),

  // AI
  precheck: (input: { url?: string; text?: string; images?: File[] }) => {
    const fd = new FormData()
    if (input.url) fd.append('url', input.url)
    if (input.text) fd.append('text', input.text)
    for (const f of input.images ?? []) fd.append('images', f)
    return request<PrecheckResult>('/precheck', { method: 'POST', body: fd })
  },
  survey: () => request<SurveyInfo>('/survey'),
  submitSurvey: (body: { segment: string | null; scores: Record<string, number>; good_text: string; improve_text: string }) =>
    request<{ ok: boolean }>('/survey', { method: 'PUT', body: JSON.stringify(body) }),
  surveyResults: () => request<SurveyResults>('/survey/results'),
  adminOverview: () => request<AdminOverview>('/admin/overview'),
  marketStatus: () => request<MarketStatus>('/market/status'),
  marketRegions: () => request<{ code: string; name: string }[]>('/market/regions'),
  marketRent: (q: { lawd_cd: string; house_type: string; dong?: string; listing_id?: number; save?: boolean }) => {
    const p = new URLSearchParams()
    Object.entries(q).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)))
    return request<MarketReport>(`/market/rent?${p.toString()}`)
  },
  aiStatus: () => request<AIStatus>('/ai/status'),
  listingReport: (id: number) => request<AIReport | null>(`/ai/listings/${id}/report`),
  createListingReport: (id: number) => request<AIReport>(`/ai/listings/${id}/report`, { method: 'POST' }),
  compareReport: (cid: number) => request<AIReport | null>(`/ai/comparisons/${cid}/report`),
  createCompareReport: (cid: number) => request<AIReport>(`/ai/comparisons/${cid}/report`, { method: 'POST' }),

  // 결정 이후
  decide: (id: number, body: { move_in_date?: string | null; decision_note?: string }) =>
    request<HomeData>(`/listings/${id}/decide`, { method: 'POST', body: json(body) }),
  home: () => request<HomeData | null>('/home'),
  updateHome: (body: Record<string, unknown>) => request<HomeData>('/home', { method: 'PATCH', body: json(body) }),
  undoDecision: () => request<void>('/home', { method: 'DELETE' }),
  addTask: (body: { title: string; phase: string; due_date?: string | null }) =>
    request<HomeData>('/home/tasks', { method: 'POST', body: json(body) }),
  updateTask: (id: number, body: { done?: boolean }) =>
    request<HomeData>(`/home/tasks/${id}`, { method: 'PATCH', body: json(body) }),
  deleteTask: (id: number) => request<HomeData>(`/home/tasks/${id}`, { method: 'DELETE' }),
  addCost: (body: { kind: string; label: string; amount: number }) =>
    request<HomeData>('/home/costs', { method: 'POST', body: json(body) }),
  updateCost: (id: number, body: { amount?: number; label?: string }) =>
    request<HomeData>(`/home/costs/${id}`, { method: 'PATCH', body: json(body) }),
  deleteCost: (id: number) => request<HomeData>(`/home/costs/${id}`, { method: 'DELETE' }),
  updateItem: (id: number, status: string) => request<HomeData>(`/home/items/${id}`, { method: 'PATCH', body: json({ status }) }),
  addItem: (body: { name: string; group: string }) => request<HomeData>('/home/items', { method: 'POST', body: json(body) }),
  deleteItem: (id: number) => request<HomeData>(`/home/items/${id}`, { method: 'DELETE' }),
  essentialsGuide: () =>
    request<{ groups: Record<string, string>; items: Omit<HomeItem, 'id' | 'source'>[] }>('/guide/essentials'),
}
