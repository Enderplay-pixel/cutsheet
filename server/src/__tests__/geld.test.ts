/**
 * Geldgrenze und Prüfung der Beträge.
 *
 * Anlass (gemessen am 12.11.2026): Alle Geldspalten waren INTEGER. Über
 * 21.474.836,47 € Summe antwortete die Kalkulation mit 400, hatte die Zeile
 * aber gespeichert, und die Summe der Fassung blieb falsch. Eine Menge von -5
 * wurde angenommen, eine Menge "abc" ergab HTTP 500.
 */
import { describe, it, expect } from 'vitest'
import {
  GELD_MAX_CENT, GELDSPALTEN, istGeldfeld, pruefeBudgetzeile, pruefeGeldgeberBetrag,
} from '../lib/geld'

describe('istGeldfeld', () => {
  it('erkennt Beträge in Cent am Namen', () => {
    for (const name of ['unit_price_cents', 'amount_cents', 'total_cents', 'fee_per_day', 'fee_per_week', 'rental_fee', 'hold_fee_per_day']) {
      expect(istGeldfeld(name), name).toBe(true)
    }
  })

  it('lässt alles andere bei der Grenze von INTEGER', () => {
    for (const name of ['eighths', 'quantity', 'sort_order', 'id', 'cents', 'total_days']) {
      expect(istGeldfeld(name), name).toBe(false)
    }
  })
})

describe('GELDSPALTEN', () => {
  it('nennt jede Spalte als Geldfeld oder hat einen Grund im Namen', () => {
    // Die Liste und die Erkennung am Namen dürfen nicht auseinanderlaufen:
    // Sonst ist eine Spalte BIGINT, die Eingabeprüfung lässt aber nur 21 Mio. € durch.
    for (const [tabelle, spalten] of Object.entries(GELDSPALTEN)) {
      for (const spalte of spalten) expect(istGeldfeld(spalte), `${tabelle}.${spalte}`).toBe(true)
    }
  })
})

describe('pruefeBudgetzeile', () => {
  it('rechnet Menge mal Preis in ganzen Cent', () => {
    expect(pruefeBudgetzeile(1.5, 10000)).toEqual({ ok: true, quantity: 1.5, unit_price_cents: 10000, total_cents: 15000 })
    expect(pruefeBudgetzeile(0, 10000)).toMatchObject({ ok: true, total_cents: 0 })
  })

  it('trägt Beträge über der alten Grenze von 21,4 Mio. €', () => {
    expect(pruefeBudgetzeile(3, 1_000_000_000)).toMatchObject({ ok: true, total_cents: 3_000_000_000 })
  })

  it('lehnt eine negative oder unlesbare Menge mit Grund ab', () => {
    for (const menge of [-5, 'abc', '2', NaN, Infinity, null, undefined]) {
      const r = pruefeBudgetzeile(menge, 10000)
      expect(r.ok, String(menge)).toBe(false)
      if ('fehler' in r) expect(r.fehler).toBe('Die Menge muss eine Zahl ab 0 sein.')
    }
  })

  it('lehnt einen Preis ab, der kein Betrag in ganzen Cent ist', () => {
    for (const preis of [100.5, '100', NaN, null, undefined]) {
      const r = pruefeBudgetzeile(1, preis)
      expect(r.ok, String(preis)).toBe(false)
      if ('fehler' in r) expect(r.fehler).toBe('Der Preis muss ein Betrag in ganzen Cent sein.')
    }
  })

  it('lässt einen negativen Preis als Abzug zu', () => {
    // Im freien Schema ist ein Abzug nicht anders zu buchen. Das FFA-Schema
    // (AP B1) hat dafür die Kostenart "Kostenmindernde Erträge".
    expect(pruefeBudgetzeile(2, -10000)).toMatchObject({ ok: true, total_cents: -20000 })
  })

  it('lehnt eine Zeile über der Geldgrenze ab', () => {
    const r = pruefeBudgetzeile(3, GELD_MAX_CENT)
    expect(r.ok).toBe(false)
    if ('fehler' in r) expect(r.fehler).toContain('999.999.999,99 €')
    expect(pruefeBudgetzeile(1, GELD_MAX_CENT).ok).toBe(true)
    expect(pruefeBudgetzeile(1, GELD_MAX_CENT + 1).ok).toBe(false)
  })
})

describe('pruefeGeldgeberBetrag', () => {
  it('nimmt Beträge ab 0 in ganzen Cent', () => {
    expect(pruefeGeldgeberBetrag(0)).toEqual({ ok: true, amount_cents: 0 })
    expect(pruefeGeldgeberBetrag(3_000_000_000)).toEqual({ ok: true, amount_cents: 3_000_000_000 })
  })

  it('lehnt einen negativen Betrag mit Grund ab', () => {
    const r = pruefeGeldgeberBetrag(-500000)
    expect(r.ok).toBe(false)
    if ('fehler' in r) expect(r.fehler).toBe('Der Betrag eines Geldgebers kann nicht negativ sein.')
  })

  it('lehnt ab, was kein Betrag in ganzen Cent ist', () => {
    for (const betrag of [10.5, 'abc', NaN, null]) expect(pruefeGeldgeberBetrag(betrag).ok, String(betrag)).toBe(false)
    expect(pruefeGeldgeberBetrag(GELD_MAX_CENT + 1).ok).toBe(false)
  })
})
