import { describe, it, expect } from 'vitest'
import {
  positionsNetto,
  summiere,
  faelligkeit,
  zahlungsstand,
  istUeberfaellig,
  tageUeberfaellig,
  formatiereNummer,
  euro,
  menge,
} from '../lib/rechnung'

describe('Rechnen in Cent', () => {
  it('rechnet eine Position kaufmännisch', () => {
    expect(positionsNetto({ quantity_milli: 1000, unit_price_cents: 45000, tax_percent: 19 })).toBe(45000)
    expect(positionsNetto({ quantity_milli: 500, unit_price_cents: 45000, tax_percent: 19 })).toBe(22500)
    expect(positionsNetto({ quantity_milli: 3000, unit_price_cents: 12345, tax_percent: 19 })).toBe(37035)
  })

  it('rundet krumme Mengen auf den Cent', () => {
    // 0,333 Tage zu 100,00 Euro sind 33,30 Euro
    expect(positionsNetto({ quantity_milli: 333, unit_price_cents: 10000, tax_percent: 19 })).toBe(3330)
    // 1/3 von 1 Cent rundet auf 0
    expect(positionsNetto({ quantity_milli: 333, unit_price_cents: 1, tax_percent: 19 })).toBe(0)
  })

  it('summiert mit Umsatzsteuer und trennt nach Sätzen', () => {
    const summen = summiere([
      { quantity_milli: 2000, unit_price_cents: 50000, tax_percent: 19 },
      { quantity_milli: 1000, unit_price_cents: 10000, tax_percent: 7 },
    ])
    expect(summen.netto).toBe(110000)
    expect(summen.nachSatz).toEqual([
      { satz: 7, netto: 10000, steuer: 700 },
      { satz: 19, netto: 100000, steuer: 19000 },
    ])
    expect(summen.steuer).toBe(19700)
    expect(summen.brutto).toBe(129700)
  })

  it('rechnet die Steuer auf die Summe je Satz, nicht je Zeile', () => {
    // Drei Zeilen zu 3,33 Euro: zeilenweise waere 3 x 63,27 Cent = 189 Cent,
    // auf die Summe gerechnet sind es 189,81 -> 190 Cent.
    const drei = Array.from({ length: 3 }, () => ({
      quantity_milli: 1000, unit_price_cents: 333, tax_percent: 19,
    }))
    const summen = summiere(drei)
    expect(summen.netto).toBe(999)
    expect(summen.steuer).toBe(190)
    expect(summen.brutto).toBe(1189)
  })

  it('weist beim Kleinunternehmen keine Steuer aus', () => {
    const summen = summiere(
      [{ quantity_milli: 1000, unit_price_cents: 50000, tax_percent: 19 }],
      'kleinunternehmer'
    )
    expect(summen.steuer).toBe(0)
    expect(summen.brutto).toBe(summen.netto)
    expect(summen.nachSatz).toEqual([{ satz: 0, netto: 50000, steuer: 0 }])
  })

  it('kommt mit einer leeren Rechnung zurecht', () => {
    expect(summiere([])).toEqual({ netto: 0, steuer: 0, brutto: 0, nachSatz: [] })
  })
})

describe('Fristen', () => {
  it('rechnet die Fälligkeit aus dem Zahlungsziel', () => {
    expect(faelligkeit('2026-10-08', 14)).toBe('2026-10-22')
    expect(faelligkeit('2026-10-08', 0)).toBe('2026-10-08')
  })

  it('rechnet über Monats- und Jahresgrenzen', () => {
    expect(faelligkeit('2026-12-28', 14)).toBe('2027-01-11')
    expect(faelligkeit('2028-02-20', 14)).toBe('2028-03-05') // Schaltjahr
  })

  it('zählt die Tage über der Fälligkeit', () => {
    expect(tageUeberfaellig('2026-10-01', '2026-10-08')).toBe(7)
    expect(tageUeberfaellig('2026-10-08', '2026-10-08')).toBe(0)
    expect(tageUeberfaellig('2026-10-20', '2026-10-08')).toBe(0)
    expect(tageUeberfaellig(null, '2026-10-08')).toBe(0)
  })
})

describe('Zahlungsstand', () => {
  it('unterscheidet offen, teilweise und bezahlt', () => {
    expect(zahlungsstand(10000, 0)).toBe('offen')
    expect(zahlungsstand(10000, 4000)).toBe('teilweise')
    expect(zahlungsstand(10000, 10000)).toBe('bezahlt')
    expect(zahlungsstand(10000, 12000)).toBe('bezahlt')
  })

  it('macht aus einem Entwurf nie eine überfällige Rechnung', () => {
    const entwurf = { status: 'entwurf', due_date: '2020-01-01', gross_cents: 10000, paid_cents: 0 }
    expect(istUeberfaellig(entwurf, '2026-10-08')).toBe(false)
  })

  it('erkennt überfällig nur bei verschickt und unbezahlt', () => {
    const basis = { status: 'versendet', due_date: '2026-10-01', gross_cents: 10000, paid_cents: 0 }
    expect(istUeberfaellig(basis, '2026-10-08')).toBe(true)
    expect(istUeberfaellig({ ...basis, paid_cents: 10000 }, '2026-10-08')).toBe(false)
    expect(istUeberfaellig({ ...basis, due_date: '2026-10-20' }, '2026-10-08')).toBe(false)
    expect(istUeberfaellig({ ...basis, status: 'storniert' }, '2026-10-08')).toBe(false)
    expect(istUeberfaellig({ ...basis, due_date: null }, '2026-10-08')).toBe(false)
  })

  it('behandelt den Fälligkeitstag selbst noch nicht als überfällig', () => {
    const heute = { status: 'versendet', due_date: '2026-10-08', gross_cents: 10000, paid_cents: 0 }
    expect(istUeberfaellig(heute, '2026-10-08')).toBe(false)
  })
})

describe('Darstellung', () => {
  it('baut Rechnungsnummern, die sortieren', () => {
    expect(formatiereNummer(2026, 1)).toBe('2026-0001')
    expect(formatiereNummer(2026, 42)).toBe('2026-0042')
    expect(formatiereNummer(2026, 12345)).toBe('2026-12345')
    const sortiert = [formatiereNummer(2026, 10), formatiereNummer(2026, 2), formatiereNummer(2025, 99)].sort()
    expect(sortiert).toEqual(['2025-0099', '2026-0002', '2026-0010'])
  })

  it('schreibt Beträge deutsch', () => {
    expect(euro(129700)).toMatch(/1\.297,00/)
    expect(euro(0)).toMatch(/0,00/)
  })

  it('schreibt Mengen ohne überflüssige Nullen', () => {
    expect(menge(1000)).toBe('1')
    expect(menge(500)).toBe('0,5')
    expect(menge(2500)).toBe('2,5')
  })
})
