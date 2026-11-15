import { describe, it, expect } from 'vitest'
import { finanzierungsstand } from '../lib/kalkulation'

/** Finanzierungsplan mit Status, Lücke und Raten (Plan Kino-Ausbau, AP B2). Beträge in Cent. */
describe('finanzierungsstand', () => {
  // Sieben Geldgeber, zusammen genau die Herstellungskosten; drei zugesagt, einer davon ausgezahlt
  const geldgeber = [
    { id: 1, amount_cents: 100_000_00, status: 'zugesagt' },
    { id: 2, amount_cents: 85_000_00, status: 'ausgezahlt' },
    { id: 3, amount_cents: 120_000_00, status: 'zugesagt' },
    { id: 4, amount_cents: 30_000_00, status: 'beantragt' },
    { id: 5, amount_cents: 45_000_00, status: 'beantragt' },
    { id: 6, amount_cents: 20_000_00, status: 'geplant' },
    { id: 7, amount_cents: 30_000_00, status: 'geplant' },
  ]
  const hk = 430_000_00

  it('Lücke 0, zugesagt und noch nicht zugesagt', () => {
    const s = finanzierungsstand(geldgeber, [], hk, '2026-11-15')
    expect(s).toMatchObject({
      summe_cents: hk, luecke_cents: 0, ueberfinanziert_cents: 0,
      zugesagt_cents: 305_000_00, nicht_zugesagt_cents: 125_000_00, ausgezahlt_cents: 85_000_00,
    })
  })

  it('ausgezahlt zählt eingegangene Raten zugesagter Geldgeber mit; überfällig ist fällig und nicht eingegangen', () => {
    const raten = [
      { id: 10, entry_id: 1, amount_cents: 40_000_00, due_on: '2026-10-01', received_on: '2026-10-03' },
      { id: 11, entry_id: 1, amount_cents: 60_000_00, due_on: '2026-11-01', received_on: null },
      { id: 12, entry_id: 3, amount_cents: 50_000_00, due_on: 'Rohschnittabnahme', received_on: null },
      { id: 13, entry_id: 3, amount_cents: 70_000_00, due_on: '2026-12-01', received_on: null },
    ]
    const s = finanzierungsstand(geldgeber, raten as any, hk, '2026-11-15')
    expect(s.ausgezahlt_cents).toBe(85_000_00 + 40_000_00)
    expect(s.ueberfaellig).toEqual([{ id: 11, entry_id: 1, amount_cents: 60_000_00, due_on: '2026-11-01' }])
    expect(s.je_geldgeber[1]).toEqual({ summe_cents: 100_000_00, eingegangen_cents: 40_000_00, ueber_betrag: false })
  })

  it('Raten über dem Betrag melden sich, eine Überfinanzierung auch', () => {
    const s = finanzierungsstand(geldgeber, [{ entry_id: 6, amount_cents: 25_000_00 }], hk - 10_000_00, '2026-11-15')
    expect(s.je_geldgeber[6].ueber_betrag).toBe(true)
    expect(s.ueberfinanziert_cents).toBe(10_000_00)
    expect(s.luecke_cents).toBe(0)
  })

  it('ohne Geldgeber ist die Lücke die ganze Kalkulation', () => {
    expect(finanzierungsstand([], [], hk, '2026-11-15')).toMatchObject({ luecke_cents: hk, summe_cents: 0 })
  })
})
