/**
 * Kalkulation nach dem Schema der FFA (Plan Kino-Ausbau, AP B1).
 *
 * Wer bei der FFA oder einer Länderförderung einreicht, kalkuliert in deren
 * Schema: elf Kostenarten, darunter das Rechenwerk aus Handlungskosten,
 * Überschreitungsreserve und Produzentenhonorar. Die Höchstsätze stammen aus
 * der FFA-FAQ 07/2021 (R7 im Plan); ein höherer Satz ist erlaubt einzugeben,
 * die Zeile sagt dann, dass er darüber liegt - kein Verbot.
 *
 * Die Unterkonten je Kostenart stehen im Formular der FFA (offener Punkt F4).
 * Solange es nicht vorliegt, gibt es hier nur die elf Hauptgruppen; ein
 * Unterkonto ist freier Text in `account_code`. Keine erfundenen Nummern.
 *
 * Alle Beträge in Cent, alle Sätze in Basispunkten (1000 = 10 %).
 */

export const KOSTENARTEN = [
  { nr: 1, name: 'Vorkosten' },
  { nr: 2, name: 'Rechte und Manuskript' },
  { nr: 3, name: 'Gagen' },
  { nr: 4, name: 'Atelier' },
  { nr: 5, name: 'Ausstattung und Technik' },
  { nr: 6, name: 'Reise- und Transportkosten' },
  { nr: 7, name: 'Filmmaterial und Bearbeitung' },
  { nr: 8, name: 'Endfertigung' },
  { nr: 9, name: 'Versicherungen' },
  { nr: 10, name: 'Allgemeine Kosten' },
  { nr: 11, name: 'Kostenmindernde Erträge' },
] as const

/** Die Kostenart, die von den übrigen abgezogen wird. */
export const MINDERND = 11
export const GAGEN = 3

export const SCHEMATA = ['frei', 'ffa'] as const
export type Schema = (typeof SCHEMATA)[number]

export const istKostenart = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 11
export const kostenartName = (nr: number): string => KOSTENARTEN.find((k) => k.nr === nr)?.name ?? ''

export type Saetze = {
  hu_percent_bp: number
  hu_percent_above_bp: number
  hu_threshold_cents: number
  hu_cap_cents: number
  reserve_percent_bp: number
  producer_fee_percent_bp: number
  producer_fee_cap_cents: number
}

/** Vorgaben nach FFA-FAQ 07/2021 (R7). */
export const VORGABE: Saetze = {
  hu_percent_bp: 1000,
  hu_percent_above_bp: 500,
  hu_threshold_cents: 500_000_000,
  hu_cap_cents: 65_000_000,
  reserve_percent_bp: 800,
  producer_fee_percent_bp: 500,
  producer_fee_cap_cents: 25_000_000,
}

export const UEBER_VORGABE = 'über dem Höchstsatz laut FFA-FAQ 07/2021'

/** Die Sätze einer Fassung; was fehlt oder Unsinn ist, nimmt die Vorgabe. */
export function saetzeAus(version: Record<string, unknown> | null | undefined): Saetze {
  const s = { ...VORGABE }
  for (const k of Object.keys(VORGABE) as Array<keyof Saetze>) {
    const n = Number(version?.[k])
    if (version?.[k] !== null && version?.[k] !== undefined && Number.isFinite(n) && n >= 0) s[k] = Math.round(n)
  }
  return s
}

const anteil = (betrag: number, bp: number) => Math.round((betrag * bp) / 10_000)

export type Rechenwerk = {
  fertigungskosten: number
  handlungskosten: number
  reserve: number
  honorar: number
  herstellungskosten: number
  /** Liegt ein eingegebener Satz (oder Deckel) über der Vorgabe? */
  ueber: { handlungskosten: boolean; reserve: boolean; honorar: boolean }
  /** Hat der Deckel gegriffen? */
  gedeckelt: { handlungskosten: boolean; honorar: boolean }
}

/**
 * Das Rechenwerk unter den Kostenarten.
 *
 * Handlungskosten: gestaffelt (Vorgabe 10 % bis 5 Mio. €, 5 % darüber),
 * gedeckelt. Reserve: Prozent der Fertigungskosten. Das Produzentenhonorar
 * ist ein Anteil der Herstellungskosten, zu denen es selbst gehört - also
 * Satz mal (Fertigungskosten plus Handlungskosten plus Reserve) geteilt
 * durch (1 minus Satz), dann gedeckelt.
 */
export function rechenwerk(fertigungskostenCent: number, s: Saetze): Rechenwerk {
  const fk = Math.round(fertigungskostenCent)
  const basis = Math.max(0, fk)
  const unten = Math.min(basis, s.hu_threshold_cents)
  const oben = Math.max(0, basis - s.hu_threshold_cents)
  const huRoh = anteil(unten, s.hu_percent_bp) + anteil(oben, s.hu_percent_above_bp)
  const handlungskosten = Math.min(huRoh, s.hu_cap_cents)
  const reserve = anteil(basis, s.reserve_percent_bp)
  const satz = Math.min(s.producer_fee_percent_bp, 9_999) / 10_000
  const honorarRoh = satz > 0 ? Math.round((satz * (basis + handlungskosten + reserve)) / (1 - satz)) : 0
  const honorar = Math.min(honorarRoh, s.producer_fee_cap_cents)
  return {
    fertigungskosten: fk,
    handlungskosten,
    reserve,
    honorar,
    herstellungskosten: fk + handlungskosten + reserve + honorar,
    ueber: {
      handlungskosten: s.hu_percent_bp > VORGABE.hu_percent_bp || s.hu_percent_above_bp > VORGABE.hu_percent_above_bp
        || s.hu_threshold_cents > VORGABE.hu_threshold_cents || s.hu_cap_cents > VORGABE.hu_cap_cents,
      reserve: s.reserve_percent_bp > VORGABE.reserve_percent_bp,
      honorar: s.producer_fee_percent_bp > VORGABE.producer_fee_percent_bp || s.producer_fee_cap_cents > VORGABE.producer_fee_cap_cents,
    },
    gedeckelt: { handlungskosten: huRoh > s.hu_cap_cents, honorar: honorarRoh > s.producer_fee_cap_cents },
  }
}

export type Zeile = { cost_group?: unknown; social?: unknown; total_cents?: unknown }

/**
 * Zusatzkosten Gagen: der Satz der Produktion auf alle Zeilen der Kostenart
 * Gagen, die als sozialversicherungspflichtig markiert sind. Ohne Satz gibt es
 * die Zeile nicht (null) - kein Vorgabewert, er hängt an Beitragssätzen, die
 * hier niemand belegt hat.
 */
export function zusatzkostenGagen(zeilen: Zeile[], socialBp: unknown): number | null {
  if (socialBp === null || socialBp === undefined || socialBp === '') return null
  const bp = Number(socialBp)
  if (!Number.isFinite(bp) || bp < 0) return null
  const basis = zeilen
    .filter((z) => Number(z.cost_group) === GAGEN && z.social === true)
    .reduce((s, z) => s + (Number(z.total_cents) || 0), 0)
  return anteil(basis, bp)
}

export type Auswertung = {
  arten: Array<{ nr: number; name: string; summe_cent: number; zeilen: number }>
  /** Zeilen ohne Kostenart zählen mit, stehen aber sichtbar für sich */
  ohne_kostenart: { summe_cent: number; zeilen: number }
  zusatzkosten_gagen_cent: number | null
  rechenwerk: Rechenwerk
  saetze: Saetze
  hinweise: string[]
}

/** Eine Fassung im FFA-Schema: Summen je Kostenart, Rechenwerk, Hinweise. */
export function auswertung(zeilen: Zeile[], version: Record<string, unknown>): Auswertung {
  const zusatz = zusatzkostenGagen(zeilen, version.social_percent_bp)
  const arten = KOSTENARTEN.map((k) => {
    const eigene = zeilen.filter((z) => Number(z.cost_group) === k.nr)
    const summe = eigene.reduce((s, z) => s + (Number(z.total_cents) || 0), 0) + (k.nr === GAGEN ? zusatz ?? 0 : 0)
    return { nr: k.nr, name: k.name, summe_cent: summe, zeilen: eigene.length }
  })
  const ohne = zeilen.filter((z) => !istKostenart(Number(z.cost_group)))
  const ohneSumme = ohne.reduce((s, z) => s + (Number(z.total_cents) || 0), 0)
  // Fertigungskosten: Kostenarten 1 bis 10 und Zeilen ohne Kostenart, minus 11
  const fk = arten.filter((a) => a.nr !== MINDERND).reduce((s, a) => s + a.summe_cent, 0) + ohneSumme
    - (arten.find((a) => a.nr === MINDERND)?.summe_cent ?? 0)
  const saetze = saetzeAus(version)
  const rw = rechenwerk(fk, saetze)
  const hinweise: string[] = []
  if (zusatz === null) hinweise.push('Zusatzkosten Gagen fehlen')
  if (ohne.length > 0) hinweise.push(`${ohne.length} ${ohne.length === 1 ? 'Zeile' : 'Zeilen'} ohne Kostenart`)
  return { arten, ohne_kostenart: { summe_cent: ohneSumme, zeilen: ohne.length }, zusatzkosten_gagen_cent: zusatz, rechenwerk: rw, saetze, hinweise }
}
