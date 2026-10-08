/**
 * Rechnen für Rechnungen.
 *
 * Alles in Cent, alles ganzzahlig: Gleitkommazahlen und Geld vertragen sich
 * nicht. Mengen stehen in Tausendstel, damit ein halber Drehtag (500) ohne
 * Bruchrechnung durchgeht.
 *
 * Die Steuer wird **je Steuersatz auf die Summe** gerechnet, nicht je Zeile.
 * Zeilenweises Runden weicht bei vielen Positionen um Cent-Beträge ab, und
 * eine Rechnung, deren Summe nicht aufgeht, kommt aus der Buchhaltung zurück.
 */

export type Position = {
  description?: string
  /** Menge in Tausendstel: 1000 = 1, 500 = 0,5. */
  quantity_milli: number
  unit_price_cents: number
  tax_percent: number
}

export type Steuerart = 'regel' | 'kleinunternehmer'

export type Summen = {
  netto: number
  steuer: number
  brutto: number
  /** Je Steuersatz: Bemessungsgrundlage und Betrag. */
  nachSatz: Array<{ satz: number; netto: number; steuer: number }>
}

/** Netto einer einzelnen Position, kaufmännisch gerundet. */
export function positionsNetto(position: Position): number {
  const roh = (Number(position.quantity_milli || 0) * Number(position.unit_price_cents || 0)) / 1000
  return Math.round(roh)
}

/**
 * Summiert eine Rechnung.
 *
 * Bei `kleinunternehmer` fällt keine Umsatzsteuer an - dann ist der Brutto-
 * betrag gleich dem Nettobetrag, und auf der Rechnung steht der Hinweis auf
 * Paragraf 19 UStG.
 */
export function summiere(positionen: Position[], steuerart: Steuerart = 'regel'): Summen {
  const proSatz = new Map<number, number>()
  let netto = 0

  for (const position of positionen) {
    const zeile = positionsNetto(position)
    netto += zeile
    const satz = steuerart === 'kleinunternehmer' ? 0 : Math.max(0, Math.round(Number(position.tax_percent || 0)))
    proSatz.set(satz, (proSatz.get(satz) ?? 0) + zeile)
  }

  const nachSatz = [...proSatz.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([satz, grundlage]) => ({
      satz,
      netto: grundlage,
      steuer: Math.round((grundlage * satz) / 100),
    }))

  const steuer = nachSatz.reduce((summe, zeile) => summe + zeile.steuer, 0)
  return { netto, steuer, brutto: netto + steuer, nachSatz }
}

/** Fälligkeit: Rechnungsdatum plus Zahlungsziel in Tagen. */
export function faelligkeit(ausstellung: string, tage: number): string {
  const datum = new Date(`${ausstellung}T12:00:00Z`)
  if (Number.isNaN(datum.getTime())) return ausstellung
  datum.setUTCDate(datum.getUTCDate() + Math.max(0, Math.round(tage || 0)))
  return datum.toISOString().slice(0, 10)
}

export type Zahlungsstand = 'offen' | 'teilweise' | 'bezahlt'

/** Wie weit eine Rechnung bezahlt ist. Mehr als fällig gilt als bezahlt. */
export function zahlungsstand(bruttoCents: number, bezahltCents: number): Zahlungsstand {
  const brutto = Number(bruttoCents || 0)
  const bezahlt = Number(bezahltCents || 0)
  if (bezahlt <= 0) return 'offen'
  if (bezahlt >= brutto) return 'bezahlt'
  return 'teilweise'
}

/**
 * Überfällig ist eine Rechnung nur, wenn sie verschickt, nicht bezahlt und
 * das Fälligkeitsdatum vorbei ist. Ein Entwurf wird nie überfällig.
 */
export function istUeberfaellig(
  rechnung: { status: string; due_date?: string | null; gross_cents: number; paid_cents: number },
  heute: string
): boolean {
  if (rechnung.status === 'entwurf' || rechnung.status === 'storniert') return false
  if (zahlungsstand(rechnung.gross_cents, rechnung.paid_cents) === 'bezahlt') return false
  if (!rechnung.due_date) return false
  return String(rechnung.due_date).slice(0, 10) < heute
}

/** Tage über der Fälligkeit; 0, wenn noch nicht fällig. */
export function tageUeberfaellig(faellig: string | null | undefined, heute: string): number {
  if (!faellig) return 0
  const ziel = new Date(`${String(faellig).slice(0, 10)}T12:00:00Z`).getTime()
  const jetzt = new Date(`${heute}T12:00:00Z`).getTime()
  if (Number.isNaN(ziel) || Number.isNaN(jetzt) || jetzt <= ziel) return 0
  return Math.floor((jetzt - ziel) / 86_400_000)
}

/**
 * Baut die Rechnungsnummer. Jahr und laufende Nummer, vierstellig aufgefüllt:
 * `2026-0001`. Das ist lesbar, sortiert richtig und zeigt beim Blick aufs
 * Konto sofort, aus welchem Jahr die Rechnung stammt.
 */
export function formatiereNummer(jahr: number, laufend: number): string {
  return `${jahr}-${String(laufend).padStart(4, '0')}`
}

/** Betrag in Cent als deutscher Eurobetrag, für Dokumente. */
export function euro(cents: number): string {
  return (Number(cents || 0) / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  })
}

/** Menge aus Tausendstel, ohne überflüssige Nullen: 1000 → "1", 500 → "0,5". */
export function menge(milli: number): string {
  const wert = Number(milli || 0) / 1000
  return wert.toLocaleString('de-DE', { maximumFractionDigits: 3 })
}
