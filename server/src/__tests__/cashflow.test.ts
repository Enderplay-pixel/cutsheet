import { describe, it, expect } from 'vitest'
import { cashflow, verteilen, zeitraeume, zeitraumVon, datumAus } from '../lib/cashflow'

/** Cashflowplan (Plan Kino-Ausbau, AP E2). Beträge in Cent. */
describe('verteilen', () => {
  it('10.000 € über drei Wochen: 3.333,33 €, 3.333,33 € und 3.333,34 €', () => {
    // Montag, 02.11.2026, bis Sonntag, 22.11.2026
    expect(verteilen(1_000_000, '2026-11-02', '2026-11-22', 'woche')).toEqual([
      { schluessel: '2026-11-02', cents: 333_333 },
      { schluessel: '2026-11-09', cents: 333_333 },
      { schluessel: '2026-11-16', cents: 333_334 },
    ])
  })

  it('eine angebrochene Woche bekommt ihren Anteil nach Tagen; die Summe stimmt immer', () => {
    // Donnerstag bis Mittwoch: 4 Tage in der ersten, 3 in der zweiten Woche
    const teile = verteilen(700_000, '2026-11-05', '2026-11-11', 'woche')
    expect(teile).toEqual([{ schluessel: '2026-11-02', cents: 400_000 }, { schluessel: '2026-11-09', cents: 300_000 }])
    for (const [c, von, bis] of [[1, '2026-01-01', '2026-12-31'], [999_999, '2026-02-27', '2026-03-02'], [-500_001, '2026-11-01', '2026-11-30']] as const) {
      expect(verteilen(c, von, bis, 'woche').reduce((s, t) => s + t.cents, 0)).toBe(c)
      expect(verteilen(c, von, bis, 'monat').reduce((s, t) => s + t.cents, 0)).toBe(c)
    }
  })
})

describe('Zeiträume', () => {
  it('die Woche beginnt montags, der Monat am Ersten; über den Jahreswechsel lückenlos', () => {
    expect(zeitraumVon('2026-11-22', 'woche')).toEqual({ schluessel: '2026-11-16', von: '2026-11-16', bis: '2026-11-22' })
    expect(zeitraumVon('2028-02-10', 'monat')).toEqual({ schluessel: '2028-02', von: '2028-02-01', bis: '2028-02-29' })
    expect(zeitraeume('2026-12-30', '2027-01-05', 'woche').map((z) => z.schluessel)).toEqual(['2026-12-28', '2027-01-04'])
    expect(zeitraeume('2026-11-15', '2027-01-02', 'monat').map((z) => z.schluessel)).toEqual(['2026-11', '2026-12', '2027-01'])
  })

  it('nur echte Daten gelten', () => {
    expect(datumAus('2026-02-30')).toBeNull()
    expect(datumAus('16.11.2026')).toBeNull()
    expect(datumAus('2026-11-16T10:00:00Z')).toBe('2026-11-16')
    expect(datumAus(null)).toBeNull()
  })
})

describe('cashflow', () => {
  const eingabe = {
    zeilen: [
      { bezeichnung: 'Kamera', cents: 1_000_000, von: '2026-11-02', bis: '2026-11-22' },
      { bezeichnung: 'Versicherung', cents: 250_000 },
    ],
    einnahmen: [{ bezeichnung: 'Sender: erste Rate', cents: 600_000, datum: '2026-11-18' }],
    belege: [{ bezeichnung: 'Verleih', cents: 120_000, datum: '2026-11-10' }],
    ereignisse: [{ datum: '2026-11-02', titel: 'Drehbeginn', art: 'drehbeginn' as const }],
  }

  it('Rate in Woche 3, Beleg in Woche 2; Saldo aufgelaufen und Unterdeckung', () => {
    const cf = cashflow({ ...eingabe, raster: 'woche' })
    expect(cf.perioden.map((p) => [p.schluessel, p.einnahmen_cents, p.ausgaben_plan_cents, p.ausgaben_ist_cents, p.saldo_aufgelaufen_cents, p.unterdeckung])).toEqual([
      ['2026-11-02', 0, 333_333, 0, -333_333, true],
      ['2026-11-09', 0, 333_333, 120_000, -666_666, true],
      ['2026-11-16', 600_000, 333_334, 0, -400_000, true],
    ])
    expect(cf.perioden[0].ereignisse.map((x) => x.titel)).toEqual(['Drehbeginn'])
    expect(cf.erste_unterdeckung).toBe('2026-11-02')
  })

  it('eine Zeile ohne Zeitraum steht gesondert, mit ihrem Betrag', () => {
    const cf = cashflow({ ...eingabe, raster: 'woche' })
    expect(cf.nicht_terminiert.ausgaben).toEqual([{ bezeichnung: 'Versicherung', cents: 250_000 }])
    expect(cf.nicht_terminiert.ausgaben_cents).toBe(250_000)
    // Nur ein Ende, oder das Ende vor dem Anfang: ebenfalls nicht terminiert
    const halb = cashflow({ ...eingabe, raster: 'woche', zeilen: [{ bezeichnung: 'Halb', cents: 1, von: '2026-11-02' }, { bezeichnung: 'Verkehrt', cents: 2, von: '2026-11-09', bis: '2026-11-02' }] })
    expect(halb.nicht_terminiert.ausgaben.map((x) => x.bezeichnung)).toEqual(['Halb', 'Verkehrt'])
  })

  it('Wochen- und Monatsraster haben dieselbe Gesamtsumme', () => {
    const woche = cashflow({ ...eingabe, raster: 'woche' })
    const monat = cashflow({ ...eingabe, raster: 'monat' })
    expect(monat.perioden.map((p) => p.schluessel)).toEqual(['2026-11'])
    expect(monat.summen).toEqual(woche.summen)
    expect(woche.summen).toEqual({ einnahmen_cents: 600_000, ausgaben_plan_cents: 1_000_000, ausgaben_ist_cents: 120_000, saldo_cents: -400_000 })
  })

  it('Rate vorziehen: das Minus verschwindet', () => {
    const cf = cashflow({ ...eingabe, raster: 'woche', einnahmen: [{ bezeichnung: 'Sender', cents: 1_000_000, datum: '2026-11-02' }] })
    expect(cf.perioden.every((p) => !p.unterdeckung)).toBe(true)
    expect(cf.erste_unterdeckung).toBeNull()
  })

  it('ohne irgendein Datum gibt es keine Zeiträume, nur Nicht-Terminiertes', () => {
    const cf = cashflow({ raster: 'monat', zeilen: [{ bezeichnung: 'A', cents: 5 }], einnahmen: [{ bezeichnung: 'B', cents: 7 }], belege: [{ bezeichnung: 'C', cents: 3 }], ereignisse: [] })
    expect(cf.perioden).toEqual([])
    expect(cf.nicht_terminiert).toMatchObject({ ausgaben_cents: 5, einnahmen_cents: 7, belege_cents: 3 })
  })
})
