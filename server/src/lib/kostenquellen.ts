/**
 * Woraus sich die Kosten einer Produktion ergeben - an einer Stelle.
 *
 * Gagen, Mieten und Prämien werden an vier verschiedenen Orten erfasst
 * (Besetzung, Stab, Equipment, Versicherungen) und tauchten in der
 * Kalkulation bisher gar nicht auf. Man musste sie ein zweites Mal eintippen,
 * und ab dem Moment liefen beide Zahlen auseinander.
 *
 * Die Funktionen hier sind rein: sie bekommen Zeilen und geben Posten zurück.
 * Das Laden macht die Route, damit sich das Rechnen testen lässt.
 */

/** Ein Kostenposten, wie er in der Kalkulation stehen soll. */
export type Kostenposten = {
  /** Herkunft, z.B. "cast:12". Leer = von Hand angelegt, wird nie angefasst. */
  schluessel: string
  kategorie: string
  /** Kostenart im FFA-Schema (lib/ffaSchema.ts), AP B1 */
  kostenart: number
  beschreibung: string
  einheit: string
  menge: number
  einzelpreis_cent: number
  gesamt_cent: number
}

/**
 * Number(null) ist 0 und Number('') auch - eine nie gefüllte Gage darf nicht
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
  einheit: string, menge: number, einzelpreis_cent: number, kostenart: number,
): Kostenposten {
  return {
    schluessel, kategorie, kostenart, beschreibung, einheit,
    menge, einzelpreis_cent,
    gesamt_cent: Math.round(menge * einzelpreis_cent),
  }
}

/** "4.200,00 €" - für Beschreibungen, die einen Betrag nennen */
const euro = (cent: number) =>
  `${(cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/** Kostenarten des FFA-Schemas, in die sich die Quellen einordnen (Plan AP B1, Soll 5) */
export const KOSTENART = { gagen: 3, atelier: 4, technik: 5, reise: 6, versicherung: 9 } as const

// ─── Gagen ──────────────────────────────────────────────────────────────────

export type Haltende = { id: number; name?: string | null; hold_fee_per_day?: unknown }

/**
 * Haltetage mal Haltegage, ein eigener Posten je Person (seit 13.11.2026).
 * Die Tage kommen aus dem DOOD (lib/dood.ts) und zählen nur, wenn für die
 * Person Haltetage vereinbart sind. Ohne Tage oder ohne Haltegage: kein
 * Posten - unbezahlte Haltetage sind die Vorgabe.
 */
export function haltePosten(personen: Haltende[], halteTage: Map<number, number>): Kostenposten[] {
  const out: Kostenposten[] = []
  for (const person of personen) {
    const satz = zahl(person.hold_fee_per_day)
    const tage = halteTage.get(Number(person.id)) ?? 0
    if (satz === null || satz <= 0 || tage <= 0) continue
    const name = String(person.name ?? '').trim() || 'Ohne Namen'
    out.push(posten(`cast-halt:${person.id}`, 'Gagen Besetzung', `Haltetage ${name}`, 'Tag', tage, satz, KOSTENART.gagen))
  }
  return out
}

export type Person = {
  id: number
  name?: string | null
  rolle?: string | null
  fee_per_day?: unknown
  /** Nur Stab (AP B1): Vertragsart, Wochengage, Vor- und Nachbereitungstage */
  contract_type?: string | null
  fee_per_week?: unknown
  prep_days?: unknown
  wrap_days?: unknown
}

/**
 * Gage mal Drehtage. Ohne Gage oder ohne Tag entsteht KEIN Posten - eine
 * Zeile über 0,00 Euro behauptet, die Person koste nichts.
 *
 * Stab (AP B1): Zu den Drehtagen kommen Vorbereitungs- und Abwicklungstage.
 * Mit Wochengage ist der Posten Wochengage mal Wochen; eine Woche hat so
 * viele Tage, wie das Projekt Arbeitstage je Woche hat (Stammdaten, AP A2).
 */
export function gagenPosten(
  personen: Person[],
  tageJePerson: Map<number, number>,
  art: 'cast' | 'crew',
  tageJeWoche = 5,
): Kostenposten[] {
  const kategorie = art === 'cast' ? 'Gagen Besetzung' : 'Gagen Stab'
  const out: Kostenposten[] = []
  for (const person of personen) {
    const drehtage = tageJePerson.get(Number(person.id)) ?? 0
    const vor = art === 'crew' ? Math.max(0, Math.round(zahl(person.prep_days) ?? 0)) : 0
    const nach = art === 'crew' ? Math.max(0, Math.round(zahl(person.wrap_days) ?? 0)) : 0
    const tage = drehtage + vor + nach
    const name = String(person.name ?? '').trim() || 'Ohne Namen'
    const rolle = String(person.rolle ?? '').trim()
    const zusatz = [vor > 0 ? `Vorbereitung ${vor}` : '', nach > 0 ? `Abwicklung ${nach}` : ''].filter(Boolean)
    const beschreibung = (rolle ? `${name} (${rolle})` : name) + (zusatz.length ? `, ${zusatz.join(', ')} ${vor + nach === 1 ? 'Tag' : 'Tage'}` : '')
    const woche = zahl(person.fee_per_week)
    if (art === 'crew' && person.contract_type === 'Wochengage' && woche !== null && woche > 0) {
      if (tage <= 0) continue
      const wochen = Math.round((tage / Math.max(1, tageJeWoche)) * 100) / 100
      out.push(posten(`${art}:${person.id}`, kategorie, beschreibung, 'Woche', wochen, woche, KOSTENART.gagen))
      continue
    }
    const satz = zahl(person.fee_per_day)
    if (satz === null || satz <= 0 || tage <= 0) continue
    out.push(posten(`${art}:${person.id}`, kategorie, beschreibung, 'Tag', tage, satz, KOSTENART.gagen))
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
  /** Einheit des Preises: tag, woche oder pauschal (AP B1) */
  rate_unit?: string | null
}

/**
 * Preis mal Anzahl mal Stück, mit der Einheit des Verleihs (AP B1): "3 Wochen
 * zu 4.200,00 €". Kein eingebauter Umrechnungsfaktor Tag zu Woche - den hat
 * jeder Verleih anders. Ohne Preis, aber mit Summe (alte Einträge): die Summe
 * als Pauschale.
 */
export function equipmentPosten(items: EquipmentPosten[]): Kostenposten[] {
  const out: Kostenposten[] = []
  for (const it of items) {
    const summe = zahl(it.total_cents)
    const satz = zahl(it.rental_per_day_cents)
    const stueck = zahl(it.quantity) ?? 1
    const anzahl = zahl(it.days) ?? 1
    const name = String(it.name ?? '').trim() || 'Ohne Bezeichnung'
    const einheit = it.rate_unit === 'woche' ? 'woche' : it.rate_unit === 'pauschal' ? 'pauschal' : 'tag'
    const mal = stueck !== 1 ? `, ${stueck} Stück` : ''

    // Passen Summe und Preis nicht zusammen (alte oder unvollständige
    // Einträge), gilt die gespeicherte Summe als Pauschale - wie vor AP B1
    const gerechnet = satz !== null ? Math.round(satz * stueck * (einheit === 'pauschal' ? 1 : anzahl)) : 0
    const widerspruch = summe !== null && summe > 0 && summe !== gerechnet
    if (!widerspruch && satz !== null && satz > 0 && stueck > 0) {
      if (einheit === 'pauschal') {
        out.push(posten(`equipment:${it.id}`, 'Equipment', `${name}, pauschal zu ${euro(satz)}${mal}`, 'Pauschal', stueck, satz, KOSTENART.technik))
      } else if (anzahl > 0) {
        const wort = einheit === 'woche' ? (anzahl === 1 ? 'Woche' : 'Wochen') : (anzahl === 1 ? 'Tag' : 'Tage')
        out.push(posten(`equipment:${it.id}`, 'Equipment', `${name}, ${anzahl.toLocaleString('de-DE')} ${wort} zu ${euro(satz)}${mal}`,
          einheit === 'woche' ? 'Woche' : 'Tag', anzahl * stueck, satz, KOSTENART.technik))
      }
    } else if (summe !== null && summe > 0) {
      out.push(posten(`equipment:${it.id}`, 'Equipment', name, 'Pauschal', 1, summe, KOSTENART.technik))
    }
  }
  return out
}

// ─── Motive, Reisen, Unterkünfte (AP B1) ────────────────────────────────────

export type Motiv = { id: number; name?: string | null; rental_fee?: unknown }
export type Motivvertrag = { id: number; location_id: number; owner_name?: string | null; fee_cents?: unknown }

/**
 * Motivmieten in Kostenart 4 (Atelier). Die Miete am Motiv ist ein Tagessatz
 * - die Motive-Seite rechnet sie mal Drehtage am Motiv. Gibt es zum Motiv
 * einen Motivvertrag mit Betrag, gilt der Vertrag statt der Schätzung, sonst
 * stünde dieselbe Miete zweimal in der Kalkulation.
 */
export function motivPosten(motive: Motiv[], tageJeMotiv: Map<number, number>, vertraege: Motivvertrag[]): Kostenposten[] {
  const out: Kostenposten[] = []
  for (const m of motive) {
    const name = String(m.name ?? '').trim() || 'Motiv ohne Namen'
    const eigene = vertraege.filter((v) => Number(v.location_id) === Number(m.id) && (zahl(v.fee_cents) ?? 0) > 0)
    if (eigene.length > 0) {
      for (const v of eigene) {
        const wer = String(v.owner_name ?? '').trim()
        out.push(posten(`motiv-vertrag:${v.id}`, 'Motivmieten', `${name}, Motivvertrag${wer ? ` ${wer}` : ''}`, 'Pauschal', 1, zahl(v.fee_cents)!, KOSTENART.atelier))
      }
      continue
    }
    const satz = zahl(m.rental_fee)
    const tage = tageJeMotiv.get(Number(m.id)) ?? 0
    if (satz === null || satz <= 0 || tage <= 0) continue
    out.push(posten(`motiv:${m.id}`, 'Motivmieten', `${name}, Miete`, 'Tag', tage, satz, KOSTENART.atelier))
  }
  return out
}

export type Reise = { id: number; person_name?: string | null; purpose?: string | null; gesamt_cent: number }

/** Reisen in Kostenart 6: Verpflegung, Fahrt und Übernachtung je Reise (lib/spesen.ts rechnet). */
export function reisePosten(reisen: Reise[]): Kostenposten[] {
  return reisen
    .filter((r) => r.gesamt_cent > 0)
    .map((r) => {
      const wer = String(r.person_name ?? '').trim() || 'Ohne Namen'
      const wozu = String(r.purpose ?? '').trim()
      return posten(`reise:${r.id}`, 'Reisekosten', `Reise ${wer}${wozu ? `, ${wozu}` : ''}`, 'Pauschal', 1, r.gesamt_cent, KOSTENART.reise)
    })
}

export type Unterkunft = { id: number; name?: string | null; price_per_night_cents?: unknown; naechte: number }

/** Unterkünfte in Kostenart 6: Nächte aller Zimmer mal Preis je Nacht, wie die Seite Reise rechnet. */
export function unterkunftPosten(haeuser: Unterkunft[]): Kostenposten[] {
  const out: Kostenposten[] = []
  for (const h of haeuser) {
    const preis = zahl(h.price_per_night_cents)
    if (preis === null || preis <= 0 || h.naechte <= 0) continue
    const name = String(h.name ?? '').trim() || 'Unterkunft'
    out.push(posten(`unterkunft:${h.id}`, 'Unterkünfte', name, 'Nacht', h.naechte, preis, KOSTENART.reise))
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
      'Pauschal', 1, praemie, KOSTENART.versicherung,
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
  /** Nur beim FFA-Schema verglichen: eine falsche Kostenart ist eine Änderung */
  cost_group?: unknown
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
 * Betrachtet werden ausschließlich Zeilen MIT Herkunftsschlüssel. Alles von
 * Hand Eingetragene bleibt unangetastet - sonst wäre die Übernahme ein
 * Datenverlust statt einer Hilfe.
 */
export function abgleiche(vorhanden: Zeile[], soll: Kostenposten[], mitKostenart = false): Abgleich {
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
      (zahl(alt.total_cents) ?? 0) === p.gesamt_cent &&
      (!mitKostenart || Number(alt.cost_group) === p.kostenart)
    if (gleich) unveraendert++
    else geaendert.push({ id: alt.id, posten: p })
  }

  // Quelle gelöscht oder Gage auf 0 gesetzt: die erzeugte Zeile muss weg,
  // sonst bleibt eine Kostenstelle stehen, die es nicht mehr gibt.
  const entfallen = erzeugt
    .filter(z => !gesehen.has(String(z.source_key)))
    .map(z => z.id)

  return { neu, geaendert, entfallen, unveraendert }
}
