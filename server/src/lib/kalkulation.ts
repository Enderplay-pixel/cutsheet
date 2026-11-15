import { db } from '../db'

type Zugriff = { get: typeof db.get }

export type Kalkulation = { id: number; name: string; status: string; total_cents: number; schema: string }

/**
 * Die Kalkulation, gegen die gerechnet wird: die aktive, sonst die neueste.
 *
 * Eine neue Fassung beginnt als "Entwurf". Bis zum 09.11.2026 rechneten
 * Kostenstand, Dashboard und Budgetalarm nur gegen eine Fassung mit dem
 * Status "Aktiv" - gemessen im Testbericht SALZWIND: Kalkulation über
 * 4,7 Mio. € gefüllt, Kostenstand "Kalkuliert 0,00 €" und "Überzogen", weil
 * niemand die Fassung umgestellt hatte. Der Konfliktradar nahm schon die
 * neueste; jetzt gilt das überall, und die Seiten sagen, welche Fassung es ist.
 */
export async function massgeblicheKalkulation(projectId: number | string, zugriff: Zugriff = db): Promise<Kalkulation | null> {
  const zeile = (await zugriff.get(
    `SELECT id, name, status, COALESCE(total_cents, 0) AS total_cents, schema
       FROM budget_versions WHERE project_id = ?
      ORDER BY (status = 'Aktiv') DESC, created_at DESC, id DESC LIMIT 1`,
    [projectId]
  )) as any
  if (!zeile) return null
  return { id: Number(zeile.id), name: String(zeile.name), status: String(zeile.status), total_cents: Number(zeile.total_cents) || 0, schema: String(zeile.schema ?? 'frei') }
}

// ─── Finanzierung (Plan Kino-Ausbau, AP B2) ─────────────────────────────────

export const FINANZ_STATUS = ['geplant', 'beantragt', 'zugesagt', 'ausgezahlt'] as const
export type FinanzStatus = (typeof FINANZ_STATUS)[number]
export const istFinanzStatus = (s: unknown): s is FinanzStatus => typeof s === 'string' && (FINANZ_STATUS as readonly string[]).includes(s)
/** Zugesagt ist auch, was schon ausgezahlt ist. */
export const istZugesagt = (s: unknown) => s === 'zugesagt' || s === 'ausgezahlt'

/** Der Finanzierungsplan, der gilt: der neueste - wie im Konfliktradar. */
export async function massgeblicherFinanzierungsplan(projectId: number | string, zugriff: Zugriff = db): Promise<{ id: number; total_cents: number } | null> {
  const zeile = (await zugriff.get(
    'SELECT id, COALESCE(total_cents, 0) AS total_cents FROM financing_plan_versions WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
    [projectId]
  )) as any
  return zeile ? { id: Number(zeile.id), total_cents: Number(zeile.total_cents) || 0 } : null
}

export type Geldgeber = { id: number; amount_cents: unknown; status: unknown }
export type Rate = { id?: number; entry_id: number; amount_cents: unknown; due_on?: unknown; received_on?: unknown }

const tag = (d: unknown): string => (d instanceof Date ? d.toISOString() : String(d ?? '')).slice(0, 10)

/**
 * Stand einer Finanzierung gegen die Herstellungskosten: Summe, davon
 * zugesagt, davon ausgezahlt, Lücke, "noch nicht zugesagt" und
 * Überfinanzierung; je Geldgeber die Summe seiner Raten und ob sie den Betrag
 * übersteigt; die überfälligen Raten (fällig vor heute, nicht eingegangen).
 *
 * Ausgezahlt ist ein Geldgeber im Stand "ausgezahlt" ganz, sonst die Summe
 * seiner eingegangenen Raten.
 */
export function finanzierungsstand(eintraege: Geldgeber[], raten: Rate[], herstellungskosten: number, heute: string) {
  const betrag = (e: { amount_cents: unknown }) => Math.max(0, Number(e.amount_cents) || 0)
  const summe = eintraege.reduce((s, e) => s + betrag(e), 0)
  const zugesagt = eintraege.filter((e) => istZugesagt(e.status)).reduce((s, e) => s + betrag(e), 0)
  const jeGeldgeber = new Map<number, { summe_cents: number; eingegangen_cents: number; ueber_betrag: boolean }>()
  for (const e of eintraege) {
    const eigene = raten.filter((r) => Number(r.entry_id) === Number(e.id))
    const s = eigene.reduce((x, r) => x + betrag(r), 0)
    const ein = eigene.filter((r) => tag(r.received_on)).reduce((x, r) => x + betrag(r), 0)
    jeGeldgeber.set(Number(e.id), { summe_cents: s, eingegangen_cents: ein, ueber_betrag: s > betrag(e) })
  }
  const ausgezahlt = eintraege.reduce((s, e) => s + (e.status === 'ausgezahlt' ? betrag(e) : jeGeldgeber.get(Number(e.id))?.eingegangen_cents ?? 0), 0)
  const hk = Math.max(0, Math.round(herstellungskosten))
  const ueberfaellig = raten.filter((r) => tag(r.due_on) && tag(r.due_on) < heute && !tag(r.received_on))
  return {
    herstellungskosten_cents: hk,
    summe_cents: summe,
    zugesagt_cents: zugesagt,
    ausgezahlt_cents: ausgezahlt,
    luecke_cents: Math.max(0, hk - summe),
    nicht_zugesagt_cents: summe - zugesagt,
    ueberfinanziert_cents: Math.max(0, summe - hk),
    je_geldgeber: Object.fromEntries(jeGeldgeber),
    ueberfaellig: ueberfaellig.map((r) => ({ id: r.id, entry_id: Number(r.entry_id), amount_cents: betrag(r), due_on: tag(r.due_on) })),
  }
}
