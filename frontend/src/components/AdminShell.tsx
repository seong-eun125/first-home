/** 관리자 전용 화면 틀 — 운영 현황과 설문 결과 두 메뉴만 보여 줍니다. */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart3, Gauge, LogOut } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'
import { Logo } from '@/components/AppShell'

const ADMIN_NAV = [
  { to: '/admin', label: '운영 현황', icon: Gauge },
  { to: '/survey/results', label: '설문 결과', icon: BarChart3 },
]

export function AdminShell({ user }: { user: User }) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const logout = async () => {
    await api.logout()
    qc.clear()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-surface/60">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <NavLink to="/admin" aria-label="운영 현황" className="flex items-center gap-2">
            <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
            <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary">관리자</span>
          </NavLink>
          <nav className="flex items-center gap-1">
            {ADMIN_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground',
                    isActive && 'bg-surface text-foreground',
                  )
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden truncate text-sm text-muted-foreground lg:inline">{user.email}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-surface hover:text-foreground cursor-pointer"
              aria-label="로그아웃"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>
      <main className="print-full mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
