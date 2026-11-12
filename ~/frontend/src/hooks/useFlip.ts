import { useLayoutEffect, useRef } from 'react'

/**
 * 순위가 바뀔 때 카드가 새 자리로 부드럽게 이동하도록 하는 FLIP 애니메이션.
 * 각 요소에 data-flip-key 속성을 붙이고, 컨테이너 ref를 넘기면 됩니다.
 */
export function useFlip<T extends HTMLElement>(deps: unknown[]) {
  const container = useRef<T>(null)
  const prev = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-flip-key]'))
    const next = new Map<string, DOMRect>()
    nodes.forEach((n) => {
      const key = n.dataset.flipKey!
      const rect = n.getBoundingClientRect()
      next.set(key, rect)
      const old = prev.current.get(key)
      if (old) {
        const dx = old.left - rect.left
        const dy = old.top - rect.top
        if (dx || dy) {
          n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
            duration: 420,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          })
        }
      }
    })
    prev.current = next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return container
}
