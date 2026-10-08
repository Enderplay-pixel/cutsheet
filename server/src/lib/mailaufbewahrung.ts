/**
 * Aufbewahrung im Postausgang.
 *
 * Ein Dispo-PDF wiegt ein paar hundert Kilobyte. Bei täglichem Versand wäre
 * die Datenbank nach einer Staffel voller Anhänge, die niemand mehr öffnet.
 * Der Text der Mails bleibt - er ist der Beleg, dass etwas rausging - die
 * Anhänge fallen nach der Frist weg.
 */
import { db } from '../db'

/** Nach wie vielen Tagen ein Anhang verschwindet. */
export const ANHANG_TAGE = 60

/** Nach wie vielen Tagen eine Postausgangszeile verschwindet. */
export const PROTOKOLL_TAGE = 365

export async function raeumeMailanhaengeAuf(): Promise<{ anhaenge: number; zeilen: number }> {
  const anhaenge = await db.run(
    `DELETE FROM email_attachments
      WHERE created_at < NOW() - (? || ' days')::interval`,
    [String(ANHANG_TAGE)]
  )
  const zeilen = await db.run(
    `DELETE FROM email_outbox
      WHERE created_at < NOW() - (? || ' days')::interval`,
    [String(PROTOKOLL_TAGE)]
  )
  if (anhaenge.changes > 0 || zeilen.changes > 0) {
    console.log(`[Mail] Aufbewahrung: ${anhaenge.changes} Anhänge, ${zeilen.changes} Protokollzeilen entfernt`)
  }
  return { anhaenge: anhaenge.changes, zeilen: zeilen.changes }
}
