/**
 * Vorstopp in der Oberfläche (Plan Kino-Ausbau, AP E5). Dieselbe Regel wie
 * `server/src/lib/vorstopp.ts`: eingetragen, sonst ein Achtel 7,5 Sekunden.
 */

const SEKUNDEN_JE_ACHTEL = 7.5

/** Vorstopp einer Szene in Sekunden, eingetragen oder geschätzt. */
export function vorstopp(szene: { pretimed_seconds?: number | null; eighths?: number | null }): { sekunden: number; geschaetzt: boolean } {
  if (szene.pretimed_seconds !== null && szene.pretimed_seconds !== undefined) {
    return { sekunden: Number(szene.pretimed_seconds), geschaetzt: false }
  }
  return { sekunden: Math.round((Number(szene.eighths) || 0) * SEKUNDEN_JE_ACHTEL), geschaetzt: true }
}

/** "3:50", ab einer Stunde "1:02:05". */
export function zeitText(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
}

/**
 * Eine Eingabe wie "3:50", "1:02:05" oder "45" (Sekunden) in Sekunden.
 * Leer ist null, Unlesbares undefined.
 */
export function zeitLesen(text: string): number | null | undefined {
  const t = text.trim()
  if (!t) return null
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return undefined
  const teile = t.split(':').map(Number)
  if (teile.slice(1).some((n) => n > 59)) return undefined
  return teile.reduce((summe, n) => summe * 60 + n, 0)
}
