/**
 * Was mit den Projekten eines gelöschten Kontos geschieht.
 *
 * Florian (03.11.2026): Projekte gelöschter Konten nur 30 Tage behalten -
 * meldet sich in der Zeit jemand mit derselben Adresse wieder an, bekommt er
 * sie zurück. Bis dahin blieben sie nach einer Admin-Löschung ohne Inhaber
 * für immer stehen, und die Selbstlöschung löschte Solo-Projekte sofort.
 *
 *  - Arbeitet noch jemand mit (Rolle über Lesezugriff), übernimmt die Person
 *    mit der höchsten Rolle das Projekt. Ein Team verliert seinen Dreh nicht,
 *    weil das anlegende Konto geht.
 *  - Sonst wird das Projekt vorgemerkt: ohne Inhaber, mit Datum und Adresse.
 *    Nach 30 Tagen räumt der tägliche Lauf es ab.
 */
import { db } from '../db'

export const AUFBEWAHRUNG_KONTO_TAGE = 30

type Zugriff = {
  get: (sql: string, werte?: any[]) => Promise<any>
  all: (sql: string, werte?: any[]) => Promise<any[]>
  run: (sql: string, werte?: any[]) => Promise<{ id: number; changes: number }>
}

/** Übernahme in dieser Reihenfolge; Lesezugriff übernimmt nichts. */
const RANG = ['admin', 'producer', 'director', 'dept_head']

/**
 * Die Projekte regeln, nachdem das Konto gelöscht ist (die Mitgliedschaften
 * des Kontos sind dann schon weg). Gibt zurück, wie viele übergeben und wie
 * viele vorgemerkt wurden.
 */
export async function projekteRegeln(
  z: Zugriff, projektIds: number[], email: string | null
): Promise<{ uebergeben: number; vorgemerkt: number }> {
  let uebergeben = 0
  let vorgemerkt = 0
  for (const id of projektIds) {
    const nachfolge = await z.get(
      `SELECT user_id FROM project_members
        WHERE project_id = ? AND role = ANY(?::text[])
        ORDER BY array_position(?::text[], role), id
        LIMIT 1`,
      [id, RANG, RANG]
    )
    if (nachfolge) {
      await z.run(
        'UPDATE projects SET owner_id = ?, verwaist_seit = NULL, verwaist_email = NULL WHERE id = ?',
        [nachfolge.user_id, id]
      )
      uebergeben++
    } else {
      await z.run(
        'UPDATE projects SET owner_id = NULL, verwaist_seit = NOW(), verwaist_email = ? WHERE id = ?',
        [email ? email.trim().toLowerCase() : null, id]
      )
      vorgemerkt++
    }
  }
  return { uebergeben, vorgemerkt }
}

/** Meldet sich jemand mit der Adresse wieder an: die vorgemerkten Projekte zurück. */
export async function projekteZurueckgeben(z: Zugriff, userId: number, email: string): Promise<number> {
  const r = await z.run(
    `UPDATE projects SET owner_id = ?, verwaist_seit = NULL, verwaist_email = NULL
      WHERE verwaist_email = ? AND verwaist_seit > NOW() - (? * INTERVAL '1 day')`,
    [userId, email.trim().toLowerCase(), AUFBEWAHRUNG_KONTO_TAGE]
  )
  return r.changes
}

/** Täglich: vorgemerkte Projekte nach Ablauf der Frist löschen. */
export async function raeumeVerwaisteProjekteAuf(): Promise<number> {
  const r = await db.run(
    `DELETE FROM projects
      WHERE owner_id IS NULL AND verwaist_seit IS NOT NULL
        AND verwaist_seit < NOW() - (? * INTERVAL '1 day')`,
    [AUFBEWAHRUNG_KONTO_TAGE]
  )
  return r.changes
}
