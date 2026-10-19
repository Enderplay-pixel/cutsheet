/**
 * Zahlungseingänge verrechnen.
 *
 * Eine Stelle für alle Wege, auf denen Geld erfasst wird. Vorher schrieb die
 * Rechnungsseite nur `paid_cents`, die Offene-Posten-Seite Zeilen in
 * `invoice_payments` - und beide Seiten sahen verschiedene Stände derselben
 * Rechnung. Maßgeblich sind die Zeilen; `paid_cents` folgt aus ihnen.
 */
import { db } from '../db'
import { zahlungsstand } from './rechnung'

export async function zahlungenVerrechnen(invoiceId: number): Promise<any> {
  const rechnung = (await db.get('SELECT gross_cents, status FROM invoices WHERE id = ?', [invoiceId])) as any
  const summe = (await db.get(
    'SELECT COALESCE(SUM(amount_cents), 0) AS summe, MAX(paid_on) AS letzte FROM invoice_payments WHERE invoice_id = ?',
    [invoiceId]
  )) as any
  const bezahlt = Number(summe?.summe ?? 0)
  const stand = zahlungsstand(Number(rechnung?.gross_cents ?? 0), bezahlt)
  // Eine stornierte Rechnung bleibt storniert, auch wenn später noch etwas
  // eingeht - sonst stünde eine Gutschrift plötzlich wieder als Forderung da.
  const status = rechnung?.status === 'storniert'
    ? 'storniert'
    : stand === 'bezahlt' ? 'bezahlt' : 'versendet'
  await db.run(
    'UPDATE invoices SET paid_cents = ?, paid_at = ?, status = ?, updated_at = NOW() WHERE id = ?',
    [bezahlt, stand === 'bezahlt' ? (summe?.letzte ?? null) : null, status, invoiceId]
  )
  return { bezahlt_cents: bezahlt, stand, status }
}
