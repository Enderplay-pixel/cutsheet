/**
 * Drehgenehmigungen je Motiv (Plan Kino-Ausbau, AP C3).
 *
 * Ein Motiv kann "Genehmigung nötig" tragen. Dann muss für jeden Drehtag an
 * diesem Motiv eine Genehmigung mit Status "liegt vor" das Datum abdecken -
 * ein fehlendes Ende oder ein fehlender Anfang gilt als offen. Fehlt sie,
 * meldet sich das je nach Abstand: mehr als 14 Tage vor dem Dreh als Hinweis,
 * darunter als Warnung, am Drehtag und danach als Fehler.
 */
import { db } from '../db'
import { KEIN_DREHTAG_SQL } from './drehtage'

export const GENEHMIGUNG_STATUS = ['offen', 'beantragt', 'liegt vor', 'abgelehnt'] as const
export type GenehmigungStatus = (typeof GENEHMIGUNG_STATUS)[number]
export const istGenehmigungStatus = (s: unknown): s is GenehmigungStatus =>
  typeof s === 'string' && (GENEHMIGUNG_STATUS as readonly string[]).includes(s)

const tag = (d: unknown): string | null => {
  if (d === null || d === undefined || d === '') return null
  const t = (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}
const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000)

export type GDrehtag = { id: number; day_number: number; date: unknown; location_ids: number[] }
export type GMotiv = { id: number; name: string; permit_required: unknown }
export type GGenehmigung = { location_id: unknown; status: unknown; valid_from?: unknown; valid_until?: unknown }
export type GMeldung = {
  shoot_day_id: number; day_number: number; datum: string; location_id: number; motiv: string
  tage_bis: number; schwere: 'hinweis' | 'warnung' | 'fehler'
}

/** Deckt eine vorliegende Genehmigung das Datum? */
export function gedeckt(genehmigungen: GGenehmigung[], locationId: number, datum: string): boolean {
  return genehmigungen.some((g) => {
    if (Number(g.location_id) !== locationId || g.status !== 'liegt vor') return false
    const von = tag(g.valid_from)
    const bis = tag(g.valid_until)
    return (!von || von <= datum) && (!bis || bis >= datum)
  })
}

/** Je Drehtag und Motiv mit "Genehmigung nötig" ohne Deckung eine Meldung. */
export function genehmigungsstand(drehtage: GDrehtag[], motive: GMotiv[], genehmigungen: GGenehmigung[], heute: string): GMeldung[] {
  const noetig = new Map(motive.filter((m) => m.permit_required === true).map((m) => [Number(m.id), String(m.name)]))
  const meldungen: GMeldung[] = []
  for (const d of drehtage) {
    const datum = tag(d.date)
    if (!datum) continue
    for (const loc of [...new Set(d.location_ids.map(Number))]) {
      if (!noetig.has(loc) || gedeckt(genehmigungen, loc, datum)) continue
      const tageBis = tageZwischen(heute, datum)
      meldungen.push({
        shoot_day_id: d.id, day_number: d.day_number, datum, location_id: loc, motiv: noetig.get(loc)!,
        tage_bis: tageBis,
        schwere: tageBis > 14 ? 'hinweis' : tageBis > 0 ? 'warnung' : 'fehler',
      })
    }
  }
  return meldungen.sort((a, b) => a.datum.localeCompare(b.datum) || a.motiv.localeCompare(b.motiv))
}

/** Die Meldungen eines oder mehrerer Projekte aus der Datenbank; je Projekt gruppiert. */
export async function genehmigungsMeldungen(projectIds: number[], heute: string): Promise<Map<number, GMeldung[]>> {
  const ergebnis = new Map<number, GMeldung[]>()
  if (!projectIds.length) return ergebnis
  const motive = await db.all(
    'SELECT id, project_id, name, permit_required FROM locations WHERE project_id = ANY(?::int[]) AND permit_required = true', [projectIds]
  ) as any[]
  if (!motive.length) return ergebnis
  const tage = await db.all(
    `SELECT sd.id, sd.project_id, sd.day_number, sd.date, array_agg(DISTINCT s.location_id) AS orte
       FROM shoot_days sd
       JOIN shoot_day_scenes sds ON sds.shoot_day_id = sd.id
       JOIN scenes s ON s.id = sds.scene_id AND s.location_id IS NOT NULL AND NOT s.omitted
      WHERE sd.project_id = ANY(?::int[]) AND sd.status NOT IN ${KEIN_DREHTAG_SQL} AND sd.date <> ''
      GROUP BY sd.id, sd.project_id, sd.day_number, sd.date`, [projectIds]
  ) as any[]
  const genehmigungen = await db.all(
    'SELECT project_id, location_id, status, valid_from, valid_until FROM permits WHERE project_id = ANY(?::int[])', [projectIds]
  ) as any[]
  for (const pid of projectIds) {
    const m = genehmigungsstand(
      tage.filter((t) => Number(t.project_id) === pid).map((t) => ({ id: Number(t.id), day_number: Number(t.day_number), date: t.date, location_ids: (t.orte ?? []).map(Number) })),
      motive.filter((x) => Number(x.project_id) === pid),
      genehmigungen.filter((g) => Number(g.project_id) === pid),
      heute,
    )
    if (m.length) ergebnis.set(pid, m)
  }
  return ergebnis
}
