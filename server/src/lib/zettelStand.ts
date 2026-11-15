/**
 * Stand eines Stundenzettels und wer ihn setzen darf (Plan Kino-Ausbau,
 * AP E8). Vier Stufen: erfasst, geprüft (Abteilungsleitung, freiwillig),
 * freigegeben (Produktion), abgerechnet. Ab "freigegeben" ändert nur noch die
 * Produktion, und jede Änderung steht mit altem und neuem Wert im Protokoll.
 */
import { ROLE_RANK } from '../middleware/projectAuth'

export const STAENDE = ['erfasst', 'geprueft', 'freigegeben', 'abgerechnet'] as const
export type Stand = (typeof STAENDE)[number]

export const STAND_NAME: Record<Stand, string> = {
  erfasst: 'erfasst', geprueft: 'geprüft', freigegeben: 'freigegeben', abgerechnet: 'abgerechnet',
}

export const istStand = (s: unknown): s is Stand => typeof s === 'string' && (STAENDE as readonly string[]).includes(s)

/** Stufe 0 bis 3; Unbekanntes zählt als "erfasst". */
export const stufe = (s: unknown): number => Math.max(0, STAENDE.indexOf(s as Stand))

/** Gesperrt heißt: nur noch die Produktion ändert. */
export const gesperrt = (s: unknown): boolean => stufe(s) >= stufe('freigegeben')

const rang = (rolle: string | null | undefined) => ROLE_RANK[rolle ?? ''] ?? 0

/** Gleiche Abteilung, ohne Rücksicht auf Groß- und Kleinschreibung; leer ist keine Abteilung. */
export function gleicheAbteilung(eigene: string[], abteilung: string | null | undefined): boolean {
  const a = String(abteilung ?? '').trim().toLocaleLowerCase('de')
  return !!a && eigene.some((e) => e.trim().toLocaleLowerCase('de') === a)
}

/**
 * Darf diese Rolle den Zettel auf `ziel` setzen? "geprüft" (und zurück auf
 * "erfasst") setzt die Abteilungsleitung für die eigene Abteilung, Regie und
 * Produktion für alle. "freigegeben" und "abgerechnet" - und alles, was
 * einen freigegebenen Zettel betrifft - nur die Produktion.
 */
export function darfStand(
  rolle: string | null | undefined,
  ziel: Stand,
  zettel: { status: unknown; abteilung?: string | null },
  eigeneAbteilungen: string[],
): boolean {
  const r = rang(rolle)
  if (ziel === 'freigegeben' || ziel === 'abgerechnet' || gesperrt(zettel.status)) return r >= ROLE_RANK.producer
  if (r >= ROLE_RANK.director) return true
  return r >= ROLE_RANK.dept_head && gleicheAbteilung(eigeneAbteilungen, zettel.abteilung)
}

/** Ab "freigegeben" ändert nur die Produktion; davor gilt das Schreibrecht des Projekts. */
export function darfAendern(rolle: string | null | undefined, status: unknown): boolean {
  return !gesperrt(status) || rang(rolle) >= ROLE_RANK.producer
}

/** Die Stände, die diese Rolle an diesem Zettel wählen kann - der jetzige immer dabei. */
export function waehlbareStaende(
  rolle: string | null | undefined,
  zettel: { status: unknown; abteilung?: string | null },
  eigeneAbteilungen: string[],
): Stand[] {
  return STAENDE.filter((z) => z === zettel.status || darfStand(rolle, z, zettel, eigeneAbteilungen))
}

/** Was sich geändert hat, als zwei Objekte mit denselben Schlüsseln (für das Protokoll). */
export function unterschiede(alt: Record<string, string>, neu: Record<string, string>): { alt: Record<string, string>; neu: Record<string, string> } | null {
  const a: Record<string, string> = {}
  const n: Record<string, string> = {}
  for (const k of Object.keys(neu)) {
    if (alt[k] !== neu[k]) { a[k] = alt[k] ?? ''; n[k] = neu[k] }
  }
  return Object.keys(n).length ? { alt: a, neu: n } : null
}
