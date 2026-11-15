/**
 * Der Aufbau einer Kalkulation für Bildschirm, PDF, CSV und Förderantrag -
 * an einer Stelle, damit alle Ausgaben dieselben Blöcke und dieselben Summen
 * zeigen (Plan Kino-Ausbau, AP B1, Soll 8).
 *
 * Schema "frei": Blöcke je Kategorie, Summe der Zeilen.
 * Schema "FFA": die elf Kostenarten in ihrer Reihenfolge (auch leere, wie im
 * Formular), Zusatzkosten Gagen als eigene Zeile in Kostenart 3, Zeilen ohne
 * Kostenart als eigener Block, darunter das Rechenwerk.
 */
import { auswertung, KOSTENARTEN, GAGEN, MINDERND, UEBER_VORGABE, type Saetze } from './ffaSchema'

export type AufbauZeile = {
  konto: string
  bezeichnung: string
  einheit: string
  menge: number
  einzelpreis_cent: number
  gesamt_cent: number
}

export type Block = { titel: string; nr: number | null; zeilen: AufbauZeile[]; summe_cent: number; mindernd: boolean }

export type RechenwerkZeile = { bezeichnung: string; satz: string; betrag_cent: number; hinweis: string }

export type Aufbau = {
  schema: 'frei' | 'ffa'
  bloecke: Block[]
  rechenwerk: RechenwerkZeile[]
  gesamt_cent: number
  hinweise: string[]
}

const zeileAus = (l: any): AufbauZeile => ({
  konto: String(l.account_code ?? ''),
  bezeichnung: String(l.description ?? ''),
  einheit: String(l.unit ?? ''),
  menge: Number(l.quantity) || 0,
  einzelpreis_cent: Number(l.unit_price_cents) || 0,
  gesamt_cent: Number(l.total_cents) || 0,
})

const prozent = (bp: number) => `${(bp / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`
const euro = (cent: number) => `${(cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

/** Die Sätze in Worten, wie sie unter der Zeile stehen. */
export function satzTexte(s: Saetze) {
  return {
    handlungskosten: `${prozent(s.hu_percent_bp)} bis ${euro(s.hu_threshold_cents)}, ${prozent(s.hu_percent_above_bp)} darüber, höchstens ${euro(s.hu_cap_cents)}`,
    reserve: `${prozent(s.reserve_percent_bp)} der Fertigungskosten`,
    honorar: `${prozent(s.producer_fee_percent_bp)} der Herstellungskosten, höchstens ${euro(s.producer_fee_cap_cents)}`,
  }
}

export function kalkulationsAufbau(version: Record<string, any>, lines: any[]): Aufbau {
  if (version.schema !== 'ffa') {
    const jeKategorie = new Map<string, any[]>()
    for (const l of lines) {
      const k = String(l.category || '').trim() || 'Ohne Kategorie'
      jeKategorie.set(k, [...(jeKategorie.get(k) ?? []), l])
    }
    const bloecke = [...jeKategorie].map(([titel, zeilen]) => ({
      titel, nr: null, mindernd: false, zeilen: zeilen.map(zeileAus),
      summe_cent: zeilen.reduce((s, l) => s + (Number(l.total_cents) || 0), 0),
    }))
    return { schema: 'frei', bloecke, rechenwerk: [], gesamt_cent: bloecke.reduce((s, b) => s + b.summe_cent, 0), hinweise: [] }
  }

  const a = auswertung(lines, version)
  const bloecke: Block[] = KOSTENARTEN.map((k) => {
    const zeilen = lines.filter((l) => Number(l.cost_group) === k.nr).map(zeileAus)
    if (k.nr === GAGEN && a.zusatzkosten_gagen_cent !== null) {
      zeilen.push({ konto: '', bezeichnung: `Zusatzkosten Gagen (${prozent(Number(version.social_percent_bp) || 0)} auf sozialversicherungspflichtige Gagen)`,
        einheit: 'Pauschal', menge: 1, einzelpreis_cent: a.zusatzkosten_gagen_cent, gesamt_cent: a.zusatzkosten_gagen_cent })
    }
    return { titel: `${k.nr} ${k.name}`, nr: k.nr, zeilen, mindernd: k.nr === MINDERND, summe_cent: a.arten.find((x) => x.nr === k.nr)?.summe_cent ?? 0 }
  })
  const ohne = lines.filter((l) => !(Number(l.cost_group) >= 1 && Number(l.cost_group) <= 11))
  if (ohne.length > 0) {
    bloecke.push({ titel: 'Ohne Kostenart', nr: null, mindernd: false, zeilen: ohne.map(zeileAus), summe_cent: a.ohne_kostenart.summe_cent })
  }
  const rw = a.rechenwerk
  const t = satzTexte(a.saetze)
  const hinweis = (ueber: boolean, gedeckelt = false) => [ueber ? UEBER_VORGABE : '', gedeckelt ? 'gedeckelt' : ''].filter(Boolean).join(', ')
  const rechenwerk: RechenwerkZeile[] = [
    { bezeichnung: 'Fertigungskosten', satz: 'Kostenarten 1 bis 10 minus 11', betrag_cent: rw.fertigungskosten, hinweis: '' },
    { bezeichnung: 'Handlungskosten', satz: t.handlungskosten, betrag_cent: rw.handlungskosten, hinweis: hinweis(rw.ueber.handlungskosten, rw.gedeckelt.handlungskosten) },
    { bezeichnung: 'Überschreitungsreserve', satz: t.reserve, betrag_cent: rw.reserve, hinweis: hinweis(rw.ueber.reserve) },
    { bezeichnung: 'Produzentenhonorar', satz: t.honorar, betrag_cent: rw.honorar, hinweis: hinweis(rw.ueber.honorar, rw.gedeckelt.honorar) },
    { bezeichnung: 'Herstellungskosten', satz: '', betrag_cent: rw.herstellungskosten, hinweis: '' },
  ]
  return { schema: 'ffa', bloecke, rechenwerk, gesamt_cent: rw.herstellungskosten, hinweise: a.hinweise }
}
