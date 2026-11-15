import { describe, it, expect } from 'vitest'
import { rechenwerk, VORGABE, saetzeAus, zusatzkostenGagen, auswertung, KOSTENARTEN } from '../lib/ffaSchema'

/** Kalkulation nach FFA-Schema (Plan Kino-Ausbau, AP B1). Beträge in Cent. */
const MIO = 100_000_000

describe('rechenwerk', () => {
  it('3 Mio. €: 10 % Handlungskosten, 8 % Reserve, Honorar als Anteil der Herstellungskosten', () => {
    const r = rechenwerk(3 * MIO, VORGABE)
    expect(r.handlungskosten).toBe(30_000_000)
    expect(r.reserve).toBe(24_000_000)
    // 5 % mal 354.000.000 geteilt durch 0,95
    expect(r.honorar).toBe(18_631_579)
    expect(r.herstellungskosten).toBe(300_000_000 + 30_000_000 + 24_000_000 + 18_631_579)
    // Probe: Honorar geteilt durch Herstellungskosten ergibt den Satz
    expect(r.honorar / r.herstellungskosten).toBeCloseTo(0.05, 6)
    expect(r.gedeckelt).toEqual({ handlungskosten: false, honorar: false })
    expect(r.ueber).toEqual({ handlungskosten: false, reserve: false, honorar: false })
  })

  it('8 Mio. €: 10 % auf 5 Mio. plus 5 % auf 3 Mio., das Honorar am Deckel', () => {
    const r = rechenwerk(8 * MIO, VORGABE)
    expect(r.handlungskosten).toBe(50_000_000 + 15_000_000)
    expect(r.honorar).toBe(25_000_000)
    expect(r.gedeckelt.honorar).toBe(true)
  })

  it('Handlungskosten höchstens 650.000 €', () => {
    const r = rechenwerk(12 * MIO, VORGABE)
    expect(r.handlungskosten).toBe(65_000_000)
    expect(r.gedeckelt.handlungskosten).toBe(true)
  })

  it('ein Satz über der Vorgabe wird gemeldet, nicht verboten', () => {
    const r = rechenwerk(3 * MIO, { ...VORGABE, reserve_percent_bp: 1000 })
    expect(r.reserve).toBe(30_000_000)
    expect(r.ueber.reserve).toBe(true)
    expect(rechenwerk(3 * MIO, { ...VORGABE, producer_fee_cap_cents: 30_000_000 }).ueber.honorar).toBe(true)
  })

  it('ohne Fertigungskosten keine Zuschläge', () => {
    expect(rechenwerk(0, VORGABE).herstellungskosten).toBe(0)
  })
})

describe('saetzeAus', () => {
  it('nimmt die Sätze der Fassung, Fehlendes aus der Vorgabe', () => {
    expect(saetzeAus({ reserve_percent_bp: 600 })).toEqual({ ...VORGABE, reserve_percent_bp: 600 })
    expect(saetzeAus({ reserve_percent_bp: 'x', hu_cap_cents: -5 })).toEqual(VORGABE)
  })
})

describe('Zusatzkosten Gagen und Auswertung', () => {
  const zeilen = [
    { cost_group: 3, social: true, total_cents: 100_000 },
    { cost_group: 3, social: false, total_cents: 50_000 },
    { cost_group: 5, social: false, total_cents: 200_000 },
    { cost_group: 11, social: false, total_cents: 30_000 },
    { cost_group: null, social: false, total_cents: 10_000 },
  ]
  it('Satz nur auf sozialversicherungspflichtige Gagen, ohne Satz keine Zeile', () => {
    expect(zusatzkostenGagen(zeilen, 2000)).toBe(20_000)
    expect(zusatzkostenGagen(zeilen, null)).toBeNull()
  })
  it('Kostenart 11 wird abgezogen, Zeilen ohne Kostenart zählen sichtbar mit', () => {
    const a = auswertung(zeilen, { social_percent_bp: 2000 })
    expect(a.arten).toHaveLength(KOSTENARTEN.length)
    expect(a.arten.find((x) => x.nr === 3)!.summe_cent).toBe(170_000)
    expect(a.ohne_kostenart).toEqual({ summe_cent: 10_000, zeilen: 1 })
    expect(a.rechenwerk.fertigungskosten).toBe(170_000 + 200_000 + 10_000 - 30_000)
    expect(a.hinweise).toEqual(['1 Zeile ohne Kostenart'])
    expect(auswertung(zeilen, {}).hinweise).toContain('Zusatzkosten Gagen fehlen')
  })
})
