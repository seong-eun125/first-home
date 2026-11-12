import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Check, CircleAlert, CircleCheck, ClipboardCheck, Eye, EyeOff, GitCompareArrows, Loader2, Sparkles, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/AppShell'
import { cn } from '@/lib/utils'

// 백엔드(schemas.password_problems)와 같은 규칙
const SPECIALS = /[!@#$%^&*()_+\-=[\]{};':",.<>/?\\|`~]/
const PW_RULES = [
  { label: '8자 이상', test: (p: string) => p.length >= 8 && p.length <= 72 },
  { label: '영문 포함', test: (p: string) => /[A-Za-z]/.test(p) },
  { label: '숫자 포함', test: (p: string) => /\d/.test(p) },
  { label: '특수문자 포함 (!@#$ 등)', test: (p: string) => SPECIALS.test(p) },
  { label: '공백 없음', test: (p: string) => p.length > 0 && !/\s/.test(p) },
]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmailState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailState, setEmailState] = useState<EmailState>('idle')
  const [emailTouched, setEmailTouched] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  // 회원가입: 입력을 멈추고 0.5초 뒤 이메일 중복 확인
  useEffect(() => {
    if (mode !== 'signup') return
    const v = email.trim()
    if (!v) return setEmailState('idle')
    if (!EMAIL_RE.test(v)) return setEmailState('invalid')
    setEmailState('checking')
    let alive = true
    const t = setTimeout(() => {
      api
        .checkEmail(v)
        .then((r) => alive && setEmailState(r.available ? 'available' : r.reason === 'taken' ? 'taken' : 'invalid'))
        .catch(() => alive && setEmailState('error'))
    }, 500)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [email, mode])

  const pwOk = PW_RULES.every((r) => r.test(password))
  const pwMatch = password2.length > 0 && password === password2
  const signupReady = name.trim().length > 0 && emailState === 'available' && pwOk && pwMatch

  const switchMode = (m: 'login' | 'signup') => {
    setMode(m)
    setPassword('')
    setPassword2('')
    setShowPw(false)
  }

  const submit = async (e?: React.FormEvent, demo = false) => {
    e?.preventDefault()
    if (!demo && mode === 'signup' && !signupReady) {
      toast.error('입력 조건을 모두 채워 주세요.')
      return
    }
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
                type="button"
                onClick={() => switchMode(m)}
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
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                required
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={mode === 'signup' && (emailState === 'taken' || (emailState === 'invalid' && emailTouched))}
                aria-describedby={mode === 'signup' ? 'email-hint' : undefined}
              />
              {mode === 'signup' && <EmailHint state={emailState === 'invalid' && !emailTouched ? 'idle' : emailState} />}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={72}
                  className="pr-10"
                  placeholder={mode === 'signup' ? '영문·숫자·특수문자 포함 8자 이상' : ''}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  aria-describedby={mode === 'signup' ? 'pw-rules' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'signup' && (
                <ul id="pw-rules" className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  {PW_RULES.map((r) => {
                    const ok = r.test(password)
                    return (
                      <li key={r.label} className={cn('flex items-center gap-1', ok ? 'text-good' : 'text-muted-foreground')}>
                        {ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="h-1 w-1 shrink-0 rounded-full bg-current mx-[5px]" />}
                        {r.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password2">비밀번호 확인</Label>
                <Input
                  id="password2"
                  type={showPw ? 'text' : 'password'}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  maxLength={72}
                  placeholder="비밀번호를 한 번 더 입력"
                  autoComplete="new-password"
                  aria-invalid={password2.length > 0 && !pwMatch}
                  aria-describedby="pw2-hint"
                />
                {password2.length > 0 && (
                  <p id="pw2-hint" className={cn('flex items-center gap-1 text-[12px]', pwMatch ? 'text-good' : 'text-bad')}>
                    {pwMatch ? <CircleCheck className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {pwMatch ? '비밀번호가 일치해요.' : '비밀번호가 일치하지 않아요.'}
                  </p>
                )}
              </div>
            )}
            <Button type="submit" size="lg" disabled={loading || (mode === 'signup' && !signupReady)} className="mt-2">
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

function EmailHint({ state }: { state: EmailState }) {
  if (state === 'idle') return null
  const map: Record<Exclude<EmailState, 'idle'>, { text: string; cls: string; icon: React.ReactNode }> = {
    checking: { text: '사용할 수 있는 이메일인지 확인하는 중…', cls: 'text-muted-foreground', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    available: { text: '사용할 수 있는 이메일이에요.', cls: 'text-good', icon: <CircleCheck className="h-3.5 w-3.5" /> },
    taken: { text: '이미 가입된 이메일이에요. 로그인해 주세요.', cls: 'text-bad', icon: <CircleAlert className="h-3.5 w-3.5" /> },
    invalid: { text: '이메일 형식을 확인해 주세요.', cls: 'text-bad', icon: <CircleAlert className="h-3.5 w-3.5" /> },
    error: { text: '중복 확인에 실패했어요. 잠시 후 다시 시도해 주세요.', cls: 'text-bad', icon: <CircleAlert className="h-3.5 w-3.5" /> },
  }
  const m = map[state]
  return (
    <p id="email-hint" className={cn('flex items-center gap-1 text-[12px]', m.cls)} aria-live="polite">
      {m.icon}
      {m.text}
    </p>
  )
}
