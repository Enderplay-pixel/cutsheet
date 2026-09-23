/**
 * Woraus sich die Kosten einer Produktion ergeben - an einer Stelle.
 *
 * Gagen, Mieten und Praemien werden an vier verschiedenen Orten erfasst
 * (Besetzung, Stab, Equipment, Versicherungen) und tauchten in der
 * Kalkulation bisher gar nicht auf. Man musste sie ein zweites Mal eintippen,
 * und ab dem Moment liefen beide Zahlen auseinander.
 *
 * Die Funktionen hier sind rein: sie bekommen Zeilen und geben Posten zurueck.
 * Das Laden macht die Route, damit sich das Rechnen testen laesst.
 */

/** Ein Kostenposten, wie er in der Kalkulation stehen soll. */
export type Kostenposten = {
  /** Herkunft, z.B. "cast:12". Leer = von Hand angelegt, wird nie angefasst. */
  schluessel: string
  kategorie: string
  beschreibung: string
  einheit: string
  menge: number
  einzelpreis_cent: number
  gesamt_cent: number
}

/**
 * Number(null) ist 0 und Number('') auch - eine nie gefuellte Gage darf nicht
 * als echte Null durchgehen, sonst steht in der Kalkulation eine 0,00 Euro,
 * wo in Wahrheit nichts erfasst wurde.
 */
export function zahl(wert: unknown): number | null {
  if (wert === null || wert === undefined || wert === '') return null
  const n = Number(wert)
  return Number.isFinite(n) ? n : null
}

function posten(
  schluessel: string, kategorie: string, beschreibung: string,
  einheit: string, menge: number, einzelpreis_cent: number,
): Kostenposten {
  return {
    schluessel, kategorie, beschreibung, einheit,
    menge, einzelpreis_cent,
    gesamt_cent: Math.round(menge * einzelpreis_cent),
  }
}

// ─── Gagen ──────────────────────────────────────────────────────────────────

export type Person = {
  id: number
  name?: string | null
  rolle?: string | null
  fee_per_day?: unknown
}

/**
 * Gage mal Drehtage. Ohne Gage oder ohne Drehtag entsteht KEIN Posten - eine
 * Zeile ueber 0,00 Euro behauptet, die Person koste nichts.
 */
export function gagenPosten(
  personen: Person[],
  tageJePerson: Map<number, number>,
  art: 'cast' | 'crew',
): Kostenposten[] {
  const kategorie = art === 'cast' ? 'Gagen Besetzung' : 'Gagen Stab'
  const out: Kostenposten[] = []
  for (const person of personen) {
    const satz = zahl(person.fee_per_day)
    const tage = tageJePerson.get(Number(person.id)) ?? 0
    if (satz === null || satz <= 0 || tage <= 0) continue
    const name = String(person.name ?? '').trim() || 'Ohne Namen'
    const rolle = String(person.rolle ?? '').trim()
    out.push(posten(
      `${art}:${person.id}`, kategorie,
      rolle ? `${name} (${rolle})` : name,
      'Tag', tage, satz,
    ))
  }
  return out
}

// ─── Equipment ──────────────────────────────────────────────────────────────

export type EquipmentPosten = {
  id: number
  name?: string | null
  quantity?: unknown
  days?: unknown
  rental_per_day_cents?: unknown
  total_cents?: unknown
}

/**
 * Bevorzugt die bereits gerechnete Summe. Nur wenn die fehlt, wird aus
 * Tagessatz, Menge und Tagen gerechnet - so bleibt eine von Hand korrigierte
 * Summe erhalten.
 */
export function equipmentPosten(items: EquipmentPosten[]): Kostenposten[] {
  const out: Kostenposten[] = []
  for (const it of items) {
    const summe = zahl(it.total_cents)
    const satz = zahl(it.rental_per_day_cents)
    const menge = zahl(it.quantity) ?? 1
    const tage = zahl(it.days) ?? 1
    const name = String(it.name ?? '').trim() || 'Ohne Bezeichnung'

    if (summe !== null && summe > 0) {
      out.push(posten(`equipment:${it.id}`, 'Equipment', name, 'Pauschal', 1, summe))
    } else if (satz !== null && satz > 0) {
      const einheiten = Math.max(1, menge * tage)
      out.push(posten(`equipment:${it.id}`, 'Equipment', name, 'Tag', einheiten, satz))
    }
  }
  return out
}

// ─── Versicherungen ─────────────────────────────────────────────────────────

export type Police = {
  id: number
  type?: string | null
  provider?: string | null
  premium_cents?: unknown
}

export function versicherungsPosten(policen: Police[]): Kostenposten[] {
  const out: Kostenposten[] = []
  for (const pol of policen) {
    const praemie = zahl(pol.premium_cents)
    if (praemie === null || praemie <= 0) continue
    const art = String(pol.type ?? '').trim() || 'Versicherung'
    const anbieter = String(pol.provider ?? '').trim()
    out.push(posten(
      `insurance:${pol.id}`, 'Versicherungen',
      anbieter ? `${art} - ${anbieter}` : art,
      'Pauschal', 1, praemie,
    ))
  }
  return out
}

// ─── Abgleich mit der bestehenden Kalkulation ───────────────────────────────

export type Zeile = {
  id: number
  source_key?: string | null
  description?: string | null
  quantity?: unknown
  unit_price_cents?: unknown
  total_cents?: unknown
}

export type Abgleich = {
  neu: Kostenposten[]
  geaendert: Array<{ id: number; posten: Kostenposten }>
  entfallen: number[]
  unveraendert: number
}

/**
 * Was muss passieren, damit die Kalkulation den Daten entspricht?
 *
 * Betrachtet werden ausschliesslich Zeilen MIT Herkunftsschluessel. Alles von
 * Hand Eingetragene bleibt unangetastet - sonst waere die Uebernahme ein
 * Datenverlust statt einer Hilfe.
 */
export function abgleiche(vorhanden: Zeile[], soll: Kostenposten[]): Abgleich {
  const erzeugt = vorhanden.filter(z => String(z.source_key ?? '').trim() !== '')
  const nachSchluessel = new Map<string, Zeile>()
  for (const z of erzeugt) nachSchluessel.set(String(z.source_key), z)

  const neu: Kostenposten[] = []
  const geaendert: Array<{ id: number; posten: Kostenposten }> = []
  let unveraendert = 0
  const gesehen = new Set<string>()

  for (const p of soll) {
    gesehen.add(p.schluessel)
    const alt = nachSchluessel.get(p.schluessel)
    if (!alt) { neu.push(p); continue }
    const gleich =
      String(alt.description ?? '') === p.beschreibung &&
      (zahl(alt.quantity) ?? 0) === p.menge &&
      (zahl(alt.unit_price_cents) ?? 0) === p.einzelpreis_cent &&
      (zahl(alt.total_cents) ?? 0) === p.gesamt_cent
    if (gleich) unveraendert++
    else geaendert.push({ id: alt.id, posten: p })
  }

  // Quelle geloescht oder Gage auf 0 gesetzt: die erzeugte Zeile muss weg,
  // sonst bleibt eine Kostenstelle stehen, die es nicht mehr gibt.
  const entfallen = erzeugt
    .filter(z => !gesehen.has(String(z.source_key)))
    .map(z => z.id)

  return { neu, geaendert, entfallen, unveraendert }
}
