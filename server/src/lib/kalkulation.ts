import { db } from '../db'

type Zugriff = { get: typeof db.get }

export type Kalkulation = { id: number; name: string; status: string; total_cents: number }

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
    `SELECT id, name, status, COALESCE(total_cents, 0) AS total_cents
       FROM budget_versions WHERE project_id = ?
      ORDER BY (status = 'Aktiv') DESC, created_at DESC, id DESC LIMIT 1`,
    [projectId]
  )) as any
  if (!zeile) return null
  return { id: Number(zeile.id), name: String(zeile.name), status: String(zeile.status), total_cents: Number(zeile.total_cents) || 0 }
}
