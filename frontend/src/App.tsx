import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { AppShell } from '@/components/AppShell'
import AuthPage from '@/pages/AuthPage'
import OnboardingPage from '@/pages/OnboardingPage'
import DashboardPage from '@/pages/DashboardPage'
import ListingsPage from '@/pages/ListingsPage'
import ListingFormPage from '@/pages/ListingFormPage'
import ListingDetailPage from '@/pages/ListingDetailPage'
import CheckPage from '@/pages/CheckPage'
import ComparePage from '@/pages/ComparePage'
import HomePage from '@/pages/HomePage'
import IntroPage from '@/pages/IntroPage'
import GuidePage from '@/pages/GuidePage'
import PrecheckPage from '@/pages/PrecheckPage'
import SurveyPage from '@/pages/SurveyPage'
import SurveyResultsPage from '@/pages/SurveyResultsPage'

function FullLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

function ServerDown({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-border bg-background p-6 text-center shadow-soft">
        <h1 className="text-lg font-semibold">서버에 연결하지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <p className="mt-4 rounded-lg bg-surface p-3 text-left text-xs text-muted-foreground">
          확인할 것: ① MySQL 실행 ② backend 폴더에서 <code>uvicorn app.main:app --reload --port 8000</code> 실행 ③
          http://localhost:8000/api/health 가 ok인지
        </p>
        <button onClick={() => location.reload()} className="mt-4 text-sm font-medium text-primary cursor-pointer">
          다시 시도
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false })
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile, enabled: !!me.data })

  // 서비스 소개는 로그인 없이도 볼 수 있습니다.
  if (location.pathname === '/intro') {
    if (me.isLoading) return <FullLoader />
    return <IntroPage authed={!!me.data} />
  }
  if (location.pathname === '/login') {
    if (me.data) return <Navigate to="/" replace />
    return <AuthPage />
  }
  if (me.isLoading) return <FullLoader />
  if (me.error) {
    // 처음 방문(로그인 전)이면 서비스 소개부터 보여 줍니다.
    if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to={location.pathname === '/' ? '/intro' : '/login'} replace />
    return <ServerDown message={me.error.message} />
  }
  if (!me.data) return <FullLoader />
  if (profile.isLoading) return <FullLoader />

  const needsOnboarding = !profile.data?.profile?.onboarding_done
  if (needsOnboarding && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />

  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage firstTime={needsOnboarding} />} />
      <Route element={<AppShell user={me.data} />}>
        <Route index element={<DashboardPage user={me.data} />} />
        <Route path="/listings" element={<ListingsPage />} />
        <Route path="/listings/new" element={<ListingFormPage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/listings/:id/edit" element={<ListingFormPage />} />
        <Route path="/listings/:id/check" element={<CheckPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/precheck" element={<PrecheckPage />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/survey/results" element={<SurveyResultsPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/settings" element={<OnboardingPage firstTime={false} embedded />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
