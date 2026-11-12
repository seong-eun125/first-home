import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, Gauge, Building2, GitCompareArrows, House, Info, KeyRound, LogOut, MessageSquareHeart, ScanSearch, SlidersHorizontal } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'

const NAV = [
  { to: '/', label: '홈', icon: House, end: true, mobile: true },
  { to: '/listings', label: '매물', icon: Building2, mobile: true },
  { to: '/precheck', label: 'AI 판정', icon: ScanSearch, mobile: true },
  { to: '/compare', label: '비교', icon: GitCompareArrows, mobile: true },
  { to: '/guide', label: '가이드', icon: BookOpenCheck, mobile: false },
  { to: '/home', label: '입주 준비', icon: KeyRound, mobile: true },
  { to: '/settings', label: '내 기준', icon: SlidersHorizontal, mobile: false },
]

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-bold tracking-tight', className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
        <svg viewBox="0 0 32 32" className="h-4.5 w-4.5" fill="currentColor" aria-hidden>
          <path d="M6 15.5 16 7l10 8.5V25a1.5 1.5 0 0 1-1.5 1.5h-5.5v-7h-6v7H7.5A1.5 1.5 0 0 1 6 25z" />
        </svg>
      </span>
      <span className="text-[15px]">FIRST HOME</span>
    </span>
  )
}

export function AppShell({ user }: { user: User }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: home } = useQuery({ queryKey: ['home'], queryFn: api.home })

  const logout = async () => {
    await api.logout()
    qc.clear()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-surface/60">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <NavLink to="/" aria-label="FIRST HOME 홈">
            <Logo />
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'text-foreground after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-primary',
                  )
                }
              >
                {n.label}
                {n.to === '/home' && home && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            {user.is_admin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-surface hover:text-foreground',
                    isActive && 'bg-surface text-foreground',
                  )
                }
                aria-label="운영 현황 (관리자)"
              >
                <Gauge className="h-4 w-4" />
                <span className="hidden sm:inline">운영 현황</span>
              </NavLink>
            )}
            <NavLink
              to="/survey"
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-primary hover:bg-brand-soft"
              aria-label="사용 후기 설문"
            >
              <MessageSquareHeart className="h-4 w-4" />
              <span className="hidden sm:inline">후기 설문</span>
            </NavLink>
            <NavLink to="/intro" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-surface hover:text-foreground">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">서비스 소개</span>
            </NavLink>
            <NavLink to="/settings" className="rounded-md p-1.5 text-muted-foreground hover:bg-surface md:hidden" aria-label="내 기준">
              <SlidersHorizontal className="h-4 w-4" />
            </NavLink>
            <span className="hidden text-sm text-muted-foreground lg:inline">{user.name}님</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-surface hover:text-foreground cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      <main className="print-full mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-16">
        <Outlet />
      </main>

      {/* 모바일 하단 탭 */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {NAV.filter((n) => n.mobile).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground', isActive && 'text-primary')
              }
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
