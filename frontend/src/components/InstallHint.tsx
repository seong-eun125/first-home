/**
 * '홈 화면에 추가' 안내 (휴대폰에서만, 이미 설치했거나 닫았으면 표시 안 함)
 * - 안드로이드 크롬: 브라우저가 주는 설치 창을 바로 띄움
 * - 아이폰 사파리: 공유 버튼 → 홈 화면에 추가 방법 안내
 */
import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const KEY = 'fh-install-hint-dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function InstallHint() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null)
  const [hidden, setHidden] = useState(readDismissed)
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (hidden || standalone || !isMobile) return null

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* 저장 안 돼도 이번 화면에서만 숨김 */
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-brand-soft/70 p-4">
      <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">홈 화면에 추가하면 앱처럼 쓸 수 있어요</div>
        {deferred ? (
          <Button
            size="sm"
            className="mt-2"
            onClick={async () => {
              await deferred.prompt()
              await deferred.userChoice
              setDeferred(null)
              dismiss()
            }}
          >
            <Download /> 앱으로 설치하기
          </Button>
        ) : isIOS ? (
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/75">
            사파리 아래쪽 <Share className="inline h-3.5 w-3.5 align-[-2px]" /> 공유 버튼 → <b>홈 화면에 추가</b>를 눌러 주세요.
          </p>
        ) : (
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/75">
            브라우저 메뉴(⋮)에서 <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러 주세요.
          </p>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="안내 닫기" className="rounded-md p-1 text-muted-foreground hover:bg-white/60 cursor-pointer">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
