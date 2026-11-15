/**
 * Geld: welche Spalten Beträge tragen, wie groß ein Betrag sein darf und
 * wann eine Zeile der Kalkulation oder ein Geldgeber plausibel ist.
 *
 * Anlass, gemessen am 12.11.2026: Alle Geldspalten waren INTEGER in Cent,
 * die Grenze lag bei 21.474.836,47 €. Eine Kalkulation darüber antwortete
 * bei jeder weiteren Zeile mit 400 "Eine Zahl liegt außerhalb des
 * zulässigen Bereichs", hatte die Zeile aber gespeichert, und die Summe der
 * Fassung blieb falsch - die Summe wurde erst nach dem Schreiben gerechnet.
 * Eine Menge von -5 wurde angenommen (Summe der Fassung -450 €), eine Menge
 * "abc" ergab HTTP 500.
 *
 * Diese Datei ist rein: keine Datenbank, keine Anfrage. Die Migration
 * (db/index.ts), die Eingabeprüfung (middleware/eingabe.ts) und die Routen
 * lesen alle von hier.
 */

/**
 * Höchster einzelner Betrag in Cent: 999.999.999,99 €.
 *
 * Die Spalten sind BIGINT und trügen mehr. Die Grenze hält jede Summe weit
 * unter Number.MAX_SAFE_INTEGER, damit Beträge als gewöhnliche Zahl durch
 * JSON gehen können.
 */
export const GELD_MAX_CENT = 99_999_999_999

/** Die Grenze, wie sie in einer Meldung steht. */
export const GELD_MAX_TEXT = '999.999.999,99 €'

/**
 * Jede Spalte, die einen Geldbetrag in Cent trägt.
 *
 * Die Migration stellt genau diese Spalten auf BIGINT, ein Test prüft es
 * gegen die echte Datenbank und schlägt bei einer neuen Spalte mit `_cents`
 * im Namen an, die hier fehlt. Eine neue Geldspalte gehört in diese Liste.
 */
export const GELDSPALTEN: Record<string, string[]> = {
  budget_versions: ['total_cents', 'hu_threshold_cents', 'hu_cap_cents', 'producer_fee_cap_cents'],
  budget_lines: ['unit_price_cents', 'total_cents'],
  financing_plan_versions: ['total_cents'],
  financing_entries: ['amount_cents'],
  expenses: ['amount_cents'],
  invoices: ['net_cents', 'tax_cents', 'gross_cents', 'paid_cents'],
  invoice_items: ['unit_price_cents'],
  invoice_payments: ['amount_cents'],
  invoice_reminders: ['open_cents', 'interest_cents', 'fee_cents', 'lump_sum_cents', 'total_cents'],
  equipment_items: ['rental_per_day_cents', 'total_cents'],
  insurances: ['coverage_amount_cents', 'premium_cents'],
  cast: ['fee_per_day', 'hold_fee_per_day'],
  crew: ['fee_per_day', 'fee_per_week'],
  locations: ['rental_fee'],
  location_releases: ['fee_cents'],
  contracts: ['fee_cents'],
  company_contacts: ['day_rate_cents'],
  company_rates: ['day_rate_cents'],
  casting_request_roles: ['fee_per_day_cents'],
  casting_proposals: ['fee_per_day_cents'],
  accommodations: ['price_per_night_cents'],
  trips: ['lodging_cents'],
  creator_videos: ['sponsor_fee_cents'],
}

/** Geldfelder, deren Name nicht auf `_cents` endet. Auch sie sind Cent. */
const GELDFELDER_OHNE_ENDUNG = new Set(['fee_per_day', 'fee_per_week', 'rental_fee', 'hold_fee_per_day'])

/** Trägt ein Feld mit diesem Namen einen Geldbetrag in Cent? */
export function istGeldfeld(name: string): boolean {
  return name.endsWith('_cents') || GELDFELDER_OHNE_ENDUNG.has(name)
}

export const MENGE_FEHLER = 'Die Menge muss eine Zahl ab 0 sein.'
export const PREIS_FEHLER = 'Der Preis muss ein Betrag in ganzen Cent sein.'
export const ZEILE_ZU_GROSS = `Der Betrag der Zeile ist zu groß (höchstens ${GELD_MAX_TEXT}).`
export const GELDGEBER_NEGATIV = 'Der Betrag eines Geldgebers kann nicht negativ sein.'
export const GELDGEBER_FEHLER = `Der Betrag eines Geldgebers muss in ganzen Cent angegeben sein (höchstens ${GELD_MAX_TEXT}).`

export type Zeilenpruefung =
  | { ok: true; quantity: number; unit_price_cents: number; total_cents: number }
  | { ok: false; fehler: string }

/**
 * Eine Zeile der Kalkulation prüfen und ihre Summe rechnen.
 *
 * Die Menge darf 0 sein (Platzhalterzeile), nie negativ. Der Preis darf
 * negativ sein: Im freien Schema ist ein Abzug nicht anders zu buchen.
 */
export function pruefeBudgetzeile(menge: unknown, preisCent: unknown): Zeilenpruefung {
  if (typeof menge !== 'number' || !Number.isFinite(menge) || menge < 0) {
    return { ok: false, fehler: MENGE_FEHLER }
  }
  if (typeof preisCent !== 'number' || !Number.isInteger(preisCent)) {
    return { ok: false, fehler: PREIS_FEHLER }
  }
  const summe = Math.round(menge * preisCent)
  if (Math.abs(preisCent) > GELD_MAX_CENT || !Number.isFinite(summe) || Math.abs(summe) > GELD_MAX_CENT) {
    return { ok: false, fehler: ZEILE_ZU_GROSS }
  }
  // Aus -0 (Menge 0 mal negativer Preis) wird 0: In JSON stünde sonst "-0".
  return { ok: true, quantity: menge, unit_price_cents: preisCent, total_cents: summe === 0 ? 0 : summe }
}

export type Betragspruefung = { ok: true; amount_cents: number } | { ok: false; fehler: string }

/** Der Betrag eines Geldgebers: ganze Cent, nie negativ. */
export function pruefeGeldgeberBetrag(betrag: unknown): Betragspruefung {
  if (typeof betrag === 'number' && Number.isInteger(betrag) && betrag < 0) {
    return { ok: false, fehler: GELDGEBER_NEGATIV }
  }
  if (typeof betrag !== 'number' || !Number.isInteger(betrag) || betrag > GELD_MAX_CENT) {
    return { ok: false, fehler: GELDGEBER_FEHLER }
  }
  return { ok: true, amount_cents: betrag }
}
