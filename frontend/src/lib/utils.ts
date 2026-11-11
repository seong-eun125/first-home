import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 5000000 → "500만", 480000 → "48만", 12500 → "1.3만" */
export function won(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-'
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000)
    const man = Math.round((amount % 100_000_000) / 10_000)
    return man ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`
  }
  if (amount >= 10_000) {
    const man = amount / 10_000
    return `${Number.isInteger(man) ? man.toLocaleString() : man.toFixed(1)}만`
  }
  return amount.toLocaleString()
}

export function wonFull(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-'
  return `${amount.toLocaleString()}원`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
