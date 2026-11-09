/**
 * Gagen und Kalkulation sieht nur die Produktion.
 *
 * CUTSHEET.md verspricht für die Rolle Regie "planen und ändern, keine
 * Gagen". Gemessen am 09.11.2026 (Testbericht SALZWIND): Ein Konto mit der
 * Rolle Regie sah jede Tagesgage in Besetzung und Stab, die ganze Kalkulation
 * und im Änderungsprotokoll die alten und neuen Beträge. Der Server kannte
 * nur Lesen und Schreiben, keine Felder.
 *
 * Die Regel steht hier an einer Stelle statt in jedem Router: Unterhalb von
 * Produzent (Regie, Gewerksleitung, Nur lesen) werden
 * - die Geldbereiche ganz gesperrt (`NUR_PRODUKTION`),
 * - Gagenfelder in jeder JSON-Antwort zu null,
 * - Gagenfelder aus jedem geschriebenen Körper entfernt, damit niemand eine
 *   Gage setzt oder beim Speichern einer Zeile mit verborgenem Wert löscht.
 *
 * CSV, PDF und das Änderungsprotokoll schreiben keinen JSON-Körper mit
 * Feldnamen - die fragen `ohneGagen(req)` selbst.
 */
import type { Request, Response, NextFunction } from 'express'
import { ROLE_RANK, getUserProjectRole, extractProjectId } from '../middleware/projectAuth'

/** Felder, die eine Gage oder eine Summe aus Gagen und Kalkulation tragen. */
export const GAGENFELDER = new Set([
  'fee_per_day',          // Besetzung, Stab
  'fee_per_day_cents',    // Besetzungsanfragen und Vorschläge der Agenturen
  'fee_cents',            // Verträge, Motivverträge
  'total_cost_cents',     // DOOD: Drehtage mal Gage
  'budget_total_cents',   // Dashboard
  'financing_total_cents',
])

/** Bereiche, die ganz der Produktion gehören - Pfade unterhalb von /api. */
const NUR_PRODUKTION: RegExp[] = [
  /^\/projects\/\d+\/budget/,
  /^\/budget-(versions|lines)\//,
  /^\/projects\/\d+\/financing/,
  /^\/financing-(versions|entries)\//,
  /^\/projects\/\d+\/(expenses|kostenstand)\b/,
  /^\/expenses\//,
  /^\/projects\/\d+\/payroll\//,
  /^\/projects\/\d+\/foerderantrag\b/,
  /^\/projects\/\d+\/backup\b/,
  /^\/projects\/\d+\/pdf\/kalkulation\b/,
  /^\/projects\/\d+\/(vertraege|vertragsvorlagen)\b/,
]

export const GESPERRT = 'Gagen, Kalkulation und Verträge sieht nur die Produktion.'

/** Darf diese Projektrolle Gagen sehen? Unbekannt heißt nein. */
export function siehtGagen(rolle: string | null | undefined): boolean {
  return (ROLE_RANK[rolle ?? ''] ?? 0) >= ROLE_RANK.producer
}

/** Hat der Wächter für diese Anfrage Gagen verborgen? */
export function ohneGagen(req: Request): boolean {
  return (req as any).ohneGagen === true
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return Object.prototype.toString.call(wert) === '[object Object]'
}

/** Eine Kopie, in der jedes Gagenfeld null ist - in jeder Tiefe. */
export function gagenVerbergen<T>(wert: T): T {
  if (Array.isArray(wert)) return wert.map((w) => gagenVerbergen(w)) as unknown as T
  if (istObjekt(wert)) {
    const aus: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(wert)) aus[k] = GAGENFELDER.has(k) ? null : gagenVerbergen(v)
    return aus as T
  }
  return wert
}

/** Gagenfelder aus einem eingehenden Körper entfernen - in jeder Tiefe. */
export function gagenEntfernen(wert: unknown): void {
  if (Array.isArray(wert)) { wert.forEach(gagenEntfernen); return }
  if (!istObjekt(wert)) return
  for (const k of Object.keys(wert)) {
    if (GAGENFELDER.has(k)) delete wert[k]
    else gagenEntfernen(wert[k])
  }
}

async function projektRolle(req: Request): Promise<string | null> {
  const bekannt = (req as any).projectRole
  if (typeof bekannt === 'string') return bekannt
  const user = (req as any).user
  const projektId = await extractProjectId(req.method, req.path, req.body)
  if (!projektId) return null
  return getUserProjectRole(user.id, projektId)
}

/**
 * Steht in index.ts nach den Rechteprüfungen und vor allen Routern.
 * Anfragen ohne Projekt (Firma, Konto, Links ohne Anmeldung) gehen durch.
 */
export async function gagenschutz(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user
  if (!user || user.role === 'admin') return next()

  const rolle = await projektRolle(req)
  if (rolle === null || siehtGagen(rolle)) return next()

  if (NUR_PRODUKTION.some((m) => m.test(req.path))) {
    return res.status(403).json({ data: null, error: GESPERRT })
  }

  ;(req as any).ohneGagen = true
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) gagenEntfernen(req.body)

  const json = res.json.bind(res)
  res.json = (koerper: any) => json(gagenVerbergen(koerper))
  next()
}

/**
 * Für das Änderungsprotokoll: Was dort als JSON-Text steht, ohne Gagen.
 * Kein JSON (altes Format) bleibt, wie es ist.
 */
export function protokollwertOhneGagen(text: string | null): string | null {
  if (!text) return text
  try {
    return JSON.stringify(gagenVerbergen(JSON.parse(text)))
  } catch {
    return text
  }
}

/** Protokollbereiche, die zur Kalkulation gehören - unterhalb von Produzent nicht gezeigt. */
export const GELD_BEREICHE = new Set([
  'Budgetposten', 'Kalkulationsfassung', 'Finanzierungsfassung', 'Finanzierungsposten', 'Beleg',
  'budget-alerts', 'kosten-uebernehmen', 'vertraege', 'vertragsvorlagen',
])
