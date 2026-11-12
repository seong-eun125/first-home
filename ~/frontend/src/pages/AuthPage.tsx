import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, ClipboardCheck, GitCompareArrows, Loader2, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/AppShell'
import { cn } from '@/lib/utils'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const submit = async (e?: React.FormEvent, demo = false) => {
    e?.preventDefault()
    setLoading(true)
    try {
      if (demo) await api.login('demo@firsthome.app', 'demo1234')
      else if (mode === 'login') await api.login(email, password)
      else await api.signup(email, password, name)
      await qc.invalidateQueries()
      navigate('/')
    } catch (err) {
      toast.error((err as Error).message + (demo ? ' (python -m app.seed --demo 로 데모 계정을 만들었는지 확인하세요)' : ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-white lg:flex lg:flex-col">
        <Logo className="[&>span:first-child]:bg-white [&>span:first-child]:text-primary" />
        <div className="mt-auto max-w-md">
          <p className="text-sm font-medium text-white/70">처음 혼자 집을 구하는 사람을 위한</p>
          <h1 className="mt-3 text-[40px] font-bold leading-[1.15] tracking-tight">
            집을 보는 순간부터
            <br />
            정착까지, 내 기준으로.
          </h1>
          <ul className="mt-10 flex flex-col gap-5 text-[15px] text-white/85">
            <li className="flex gap-3">
              <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
              현장에서 놓치기 쉬운 항목을 순서대로 체크하고, 확인 못 한 것은 따로 남겨요.
            </li>
            <li className="flex gap-3">
              <GitCompareArrows className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
              내 생활 패턴을 반영한 적합도로 여러 집을 한 화면에서 비교해요.
            </li>
            <li className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
              AI가 실제 기록을 근거로 장단점과 다시 확인할 것을 정리해 줘요.
            </li>
          </ul>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -right-10 top-40 h-56 w-56 rounded-full bg-white/5" />
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h2 className="text-2xl font-bold tracking-tight">{mode === 'login' ? '다시 오신 걸 환영해요' : '계정 만들기'}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === 'login' ? '기록해 둔 매물과 비교 결과를 이어서 볼 수 있어요.' : '이메일로 가입하고 내 기준을 설정해 보세요.'}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-surface p-1 text-sm">
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn('rounded-md py-1.5 font-medium text-muted-foreground cursor-pointer', mode === m && 'bg-background text-foreground shadow-soft')}
              >
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">이름</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} placeholder="홍길동" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 8 : 1}
                placeholder={mode === 'signup' ? '8자 이상' : ''}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <Button type="submit" size="lg" disabled={loading} className="mt-2">
              {loading ? <Loader2 className="animate-spin" /> : null}
              {mode === 'login' ? '로그인' : '가입하고 시작하기'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> 또는 <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" size="lg" className="w-full" disabled={loading} onClick={() => submit(undefined, true)}>
            시연용 데모 계정으로 둘러보기 <ArrowRight />
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">데모 계정의 매물과 주소는 모두 가상 데이터입니다.</p>
          <p className="mt-6 text-center text-[13px]">
            <a href="/intro" className="font-medium text-primary underline-offset-4 hover:underline">
              FIRST HOME은 어떤 서비스인가요? →
            </a>
          </p>
        </div>
      </section>
    </div>
  )
}
