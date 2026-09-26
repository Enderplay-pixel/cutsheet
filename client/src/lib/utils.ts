import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'dd.MM.yyyy', { locale: de })
  } catch {
    return String(date)
  }
}

export function formatDateLong(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'EEEE, d. MMMM yyyy', { locale: de })
  } catch {
    return String(date)
  }
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function eighthsToMinutes(eighths: number): number {
  return Math.round((eighths / 8) * 60)
}

export function eighthsToString(eighths: number): string {
  const full = Math.floor(eighths / 8)
  const remainder = eighths % 8
  if (remainder === 0) return `${full}`
  if (full === 0) return `${remainder}/8`
  return `${full} ${remainder}/8`
}

export function parseEighths(str: string): number {
  const trimmed = str.trim()
  const match = trimmed.match(/^(\d+)(?:\s+(\d+)\/8)?$|^(\d+)\/8$/)
  if (!match) return 0
  if (match[3]) return parseInt(match[3])
  return (parseInt(match[1] || '0') * 8) + parseInt(match[2] || '0')
}

export function getStripClass(intExt: string, dayNight: string): string {
  if (intExt === 'INT' && dayNight === 'TAG') return 'strip-int-tag'
  if (intExt === 'EXT' && dayNight === 'TAG') return 'strip-ext-tag'
  if (intExt === 'INT' && dayNight === 'NACHT') return 'strip-int-nacht'
  return 'strip-ext-nacht'
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    'Geplant': 'text-muted-foreground',
    'Bestätigt': 'text-blue-400',
    'Abgedreht': 'text-green-400',
    'Ausgefallen': 'text-red-400',
    'Sperrtag': 'text-yellow-400',
  }
  return map[status] || 'text-muted-foreground'
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

/**
 * Dauer zwischen zwei Uhrzeiten, die als Minuten seit Mitternacht vorliegen.
 * Liegt `bis` vor `von`, ging es über Mitternacht - dann zählt der nächste
 * Tag mit.
 *
 * Gemessen am 26.09.2026: der Tagesbericht rechnete für einen Nachtdreh von
 * 18:00 bis 02:00 `120 - 1080 = -960` Minuten und zeigte deshalb gar keine
 * Drehdauer an. Nachtdrehs sind im Film keine Ausnahme.
 *
 * Gleiche Uhrzeit heißt null Minuten, nicht 24 Stunden.
 */
export function dauer(von: number | null | undefined, bis: number | null | undefined): number {
  if (von == null || bis == null || !Number.isFinite(von) || !Number.isFinite(bis)) return 0
  const d = bis - von
  return d < 0 ? d + 24 * 60 : d
}

/**
 * Heutiges Datum als YYYY-MM-DD - aus den LOKALEN Bestandteilen.
 *
 * `new Date().toISOString().slice(0, 10)` liefert das Datum in UTC. In
 * Deutschland ist es zwischen Mitternacht und 02:00 dort noch der Vortag:
 * gemessen am 26.09.2026 markierte die Set-App um 01:30 den falschen Drehtag
 * als "Heute" - und die Kopfzeile daneben zeigte gleichzeitig das richtige.
 * Genau in dieser Stunde steht ein Nachtdreh noch am Set.
 */
export function heuteISO(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}
