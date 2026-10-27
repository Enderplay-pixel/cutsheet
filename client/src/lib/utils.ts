import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { parseISO } from 'date-fns'
import { aktuellesGebietsschema } from './useT'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Datum und Beträge in der gewählten Sprache. Vorher fest Deutsch: Im
// englischen Modus stand auf dem Dashboard "Montag, 26. Oktober 2026".
function datum(date: string | Date, form: Intl.DateTimeFormatOptions): string {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (Number.isNaN(d.getTime())) return String(date)
    return d.toLocaleDateString(aktuellesGebietsschema(), form)
  } catch {
    return String(date)
  }
}

export function formatDate(date: string | Date): string {
  return datum(date, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateLong(date: string | Date): string {
  return datum(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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
  return (cents / 100).toLocaleString(aktuellesGebietsschema(), { style: 'currency', currency: 'EUR' })
}

export function eighthsToString(eighths: number): string {
  const full = Math.floor(eighths / 8)
  const remainder = eighths % 8
  if (remainder === 0) return `${full}`
  if (full === 0) return `${remainder}/8`
  return `${full} ${remainder}/8`
}

/**
 * Streifenfarbe aus INT/EXT und Tageszeit.
 *
 * Vorher kannte die Zuordnung nur INT/EXT × TAG/NACHT, alles andere wurde
 * Außen-Nacht - gemessen am 27.10.2026: INT MORGEN, INT DÄMMERUNG und jede
 * INT/EXT-Szene erschienen so. Jetzt: MORGEN zählt als Tag, DÄMMERUNG als
 * Nacht, INT/EXT als Außen (Wetter und Licht hängen am Außenteil).
 */
export function getStripClass(intExt: string, dayNight: string): string {
  const innen = intExt === 'INT'
  const nacht = dayNight === 'NACHT' || dayNight === 'DÄMMERUNG'
  return `strip-${innen ? 'int' : 'ext'}-${nacht ? 'nacht' : 'tag'}`
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
