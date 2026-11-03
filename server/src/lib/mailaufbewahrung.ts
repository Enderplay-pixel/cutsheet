/**
 * Aufbewahrung im Postausgang.
 *
 * Ein Dispo-PDF wiegt ein paar hundert Kilobyte. Bei täglichem Versand wäre
 * die Datenbank nach einer Staffel voller Anhänge, die niemand mehr öffnet.
 * Der Text der Mails bleibt - er ist der Beleg, dass etwas rausging - die
 * Anhänge fallen nach der Frist weg.
 *
 * Ausgenommen sind Geschäftsbriefe: Mahnungen, Verträge und Rechnungsmails
 * samt Anhang. Abgesandte Handelsbriefe sind nach § 257 Abs. 1 Nr. 3, Abs. 4
 * HGB sechs Jahre aufzubewahren, die Frist beginnt mit dem Schluss des
 * Kalenderjahres (Abs. 5). Bis zum 03.11.2026 löschte der Lauf auch sie nach
 * 365 Tagen, ihre PDFs nach 60.
 */
import { db } from '../db'

/** Nach wie vielen Tagen ein Anhang verschwindet. */
export const ANHANG_TAGE = 60

/** Nach wie vielen Tagen eine Postausgangszeile verschwindet. */
export const PROTOKOLL_TAGE = 365

/** Anlässe, deren Mails Handelsbriefe sind. */
export const GESCHAEFTSBRIEFE = ['rechnung', 'mahnung', 'vertrag']

/** Aufbewahrung für Geschäftsbriefe in Jahren, ab Ende des Kalenderjahres. */
export const GESCHAEFTSBRIEF_JAHRE = 6

/** Vor diesem Zeitpunkt entstandene Geschäftsbriefe dürfen weg. */
const GESCHAEFTSBRIEF_GRENZE = `date_trunc('year', NOW()) - (? * INTERVAL '1 year')`

export async function raeumeMailanhaengeAuf(): Promise<{ anhaenge: number; zeilen: number }> {
  const anhaenge = await db.run(
    `DELETE FROM email_attachments a
      WHERE a.created_at < NOW() - (? || ' days')::interval
        AND (NOT EXISTS (SELECT 1 FROM email_outbox o
                          WHERE o.attachment_id = a.id AND o.purpose = ANY(?::text[]))
             OR a.created_at < ${GESCHAEFTSBRIEF_GRENZE})`,
    [String(ANHANG_TAGE), GESCHAEFTSBRIEFE, GESCHAEFTSBRIEF_JAHRE]
  )
  const zeilen = await db.run(
    `DELETE FROM email_outbox
      WHERE created_at < NOW() - (? || ' days')::interval
        AND (purpose IS NULL OR NOT (purpose = ANY(?::text[]))
             OR created_at < ${GESCHAEFTSBRIEF_GRENZE})`,
    [String(PROTOKOLL_TAGE), GESCHAEFTSBRIEFE, GESCHAEFTSBRIEF_JAHRE]
  )
  if (anhaenge.changes > 0 || zeilen.changes > 0) {
    console.log(`[Mail] Aufbewahrung: ${anhaenge.changes} Anhänge, ${zeilen.changes} Protokollzeilen entfernt`)
  }
  return { anhaenge: anhaenge.changes, zeilen: zeilen.changes }
}
