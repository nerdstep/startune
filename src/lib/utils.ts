import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
export const fmtNum = (n: number) => compact.format(n)
export const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`
export const fmtDelta = (n: number) => `${n >= 0 ? '+' : '−'}${compact.format(Math.abs(n))}`

const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
export function ago(iso: string | null | undefined, now = new Date()): string {
  if (!iso) {
    return 'never'
  }
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) {
    return 'just now'
  }
  if (abs < 3600) {
    return rtf.format(Math.round(diff / 60), 'minute')
  }
  if (abs < 86400) {
    return rtf.format(Math.round(diff / 3600), 'hour')
  }
  if (abs < 86400 * 30) {
    return rtf.format(Math.round(diff / 86400), 'day')
  }
  if (abs < 86400 * 365) {
    return rtf.format(Math.round(diff / (86400 * 30)), 'month')
  }
  return rtf.format(Math.round(diff / (86400 * 365)), 'year')
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—'
  }
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) {
    out.push(arr.slice(i, i + n))
  }
  return out
}

/** Compact relative time for narrow readouts and table cells: 5y ago, 9mo ago, 12d ago, 3h ago. */
export function agoShort(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) {
    return 'never'
  }
  const d = (now - new Date(iso).getTime()) / 86_400_000
  if (d >= 365) {
    return `${Math.floor(d / 365)}y ago`
  }
  if (d >= 30) {
    return `${Math.floor(d / 30)}mo ago`
  }
  if (d >= 1) {
    return `${Math.floor(d)}d ago`
  }
  return `${Math.max(1, Math.floor(d * 24))}h ago`
}
