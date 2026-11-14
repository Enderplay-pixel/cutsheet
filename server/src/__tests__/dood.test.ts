/**
 * Day out of Days nach den Regeln der Branche (Movie Magic Scheduling, R1 im
 * Plan "CutSheet Kino-Ausbau", AP A1).
 *
 * Bis zum 13.11.2026 bekam jeder Tag zwischen erstem und letztem Arbeitstag
 * ein H, auch ein Sperrtag und für jede Person, und der letzte Arbeitstag hieß
 * F statt WF. Haltetage kosteten nichts und kamen in keiner Kalkulation vor.
 */
import { describe, it, expect } from 'vitest'
import { berechneDood, type DoodTag, type DoodRegeln } from '../lib/dood'

/** Aufeinanderfolgende Kalendertage ab `start`; `drehtage` nennt je Index die Drehtag-Kennung. */
function kalender(start: string, anzahl: number, drehtage: Record<number, number>): DoodTag[] {
  const tage: DoodTag[] = []
  const d = new Date(`${start}T12:00:00Z`)
  for (let i = 0; i < anzahl; i++) {
    const datum = d.toISOString().slice(0, 10)
    const id = drehtage[i]
    tage.push({ datum, drehtagIds: id ? [id] : [], frei: !id })
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return tage
}

const leer = () => ({ arbeit: new Set<number>(), reise: new Set<string>(), probe: new Set<string>(), anprobe: new Set<string>() })
const AUS: DoodRegeln = { haltetage: false, drop: false, dropMinTage: 0 }
const HALT: DoodRegeln = { haltetage: true, drop: false, dropMinTage: 0 }
const DROP10: DoodRegeln = { haltetage: true, drop: true, dropMinTage: 10 }

// Montag 16.11.2026 bis Freitag 20.11.2026, Drehtage 1 bis 5
const WOCHE = kalender('2026-11-16', 5, { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 })

describe('berechneDood', () => {
  it('Arbeit an Tag 1, 2 und 5, Haltetage aus: dazwischen leer', () => {
    const e = leer(); [1, 2, 5].forEach(t => e.arbeit.add(t))
    const r = berechneDood(WOCHE, e, AUS)
    expect(r.codes).toEqual(['SW', 'W', '', '', 'WF'])
    expect(r.summen).toMatchObject({ drehtage: 3, arbeit: 3, halt: 0 })
    expect([r.start, r.ende]).toEqual(['2026-11-16', '2026-11-20'])
  })

  it('derselbe Fall mit Haltetagen', () => {
    const e = leer(); [1, 2, 5].forEach(t => e.arbeit.add(t))
    const r = berechneDood(WOCHE, e, HALT)
    expect(r.codes).toEqual(['SW', 'W', 'H', 'H', 'WF'])
    expect(r.summen).toMatchObject({ drehtage: 3, halt: 2 })
  })

  it('ein Wochenende ohne Drehtag ist kein Halt', () => {
    // Freitag 20.11. Drehtag 1, Montag 23.11. Drehtag 2
    const tage = kalender('2026-11-20', 4, { 0: 1, 3: 2 })
    const e = leer(); e.arbeit.add(1); e.arbeit.add(2)
    const r = berechneDood(tage, e, HALT)
    expect(r.codes).toEqual(['SW', '', '', 'WF'])
    expect(r.summen.halt).toBe(0)
  })

  it('ein Sperrtag zwischen zwei Arbeitstagen ist frei', () => {
    // Der Lader gibt einen Sperrtag als freien Tag ohne Drehtag weiter
    const tage = kalender('2026-11-16', 3, { 0: 1, 2: 3 })
    const e = leer(); e.arbeit.add(1); e.arbeit.add(3)
    const r = berechneDood(tage, e, HALT)
    expect(r.codes).toEqual(['SW', '', 'WF'])
    expect(r.summen.halt).toBe(0)
  })

  it('ein einziger Arbeitstag ist SWF', () => {
    const e = leer(); e.arbeit.add(3)
    const r = berechneDood(WOCHE, e, HALT)
    expect(r.codes).toEqual(['', '', 'SWF', '', ''])
    expect(r.summen).toMatchObject({ drehtage: 1, halt: 0 })
  })

  // Arbeit am ersten Tag, zwölf Drehtage ohne die Person, Arbeit am 14. Tag
  const LANG = kalender('2026-11-02', 14, Object.fromEntries(Array.from({ length: 14 }, (_, i) => [i, i + 1])))

  it('Lücke von 12 Kalendertagen, Drop ab 10: SWD, leer, PWF', () => {
    const e = leer(); e.arbeit.add(1); e.arbeit.add(14)
    const r = berechneDood(LANG, e, DROP10)
    expect(r.codes[0]).toBe('SWD')
    expect(r.codes.slice(1, 13)).toEqual(Array(12).fill(''))
    expect(r.codes[13]).toBe('PWF')
    expect(r.summen).toMatchObject({ drehtage: 2, arbeit: 2, halt: 0 })
  })

  it('dieselbe Lücke mit einem Reisetag darin: kein Drop', () => {
    const e = leer(); e.arbeit.add(1); e.arbeit.add(14); e.reise.add(LANG[5].datum)
    const r = berechneDood(LANG, e, DROP10)
    expect(r.codes[0]).toBe('SW')
    expect(r.codes[5]).toBe('TR')
    expect(r.codes.filter(c => c === 'H')).toHaveLength(11)
    expect(r.codes[13]).toBe('WF')
    expect(r.summen).toMatchObject({ drehtage: 2, arbeit: 3, halt: 11, reise: 1 })
  })

  it('zwei Lücken über der Mindestzahl: nur die erste wird Drop', () => {
    const tage = kalender('2026-11-02', 23, Object.fromEntries(Array.from({ length: 23 }, (_, i) => [i, i + 1])))
    const e = leer(); [1, 12, 23].forEach(t => e.arbeit.add(t))
    const r = berechneDood(tage, e, DROP10)
    expect(r.codes[0]).toBe('SWD')
    expect(r.codes.slice(1, 11)).toEqual(Array(10).fill(''))
    expect(r.codes[11]).toBe('PW')
    expect(r.codes.slice(12, 22)).toEqual(Array(10).fill('H'))
    expect(r.codes[22]).toBe('WF')
    expect(r.summen.halt).toBe(10)
  })

  it('Drop gibt es nur mit Haltetagen und mit einer Mindestzahl', () => {
    const e = leer(); e.arbeit.add(1); e.arbeit.add(14)
    expect(berechneDood(LANG, e, { haltetage: false, drop: true, dropMinTage: 10 }).codes[0]).toBe('SW')
    expect(berechneDood(LANG, e, { haltetage: true, drop: true, dropMinTage: 0 }).codes[0]).toBe('SW')
  })

  it('Reisetag vor dem ersten Arbeitstag: TR gezählt, SW bleibt am Arbeitstag', () => {
    // Sonntag 15.11. ohne Drehtag, Montag und Dienstag gedreht
    const tage = kalender('2026-11-15', 3, { 1: 1, 2: 2 })
    const e = leer(); e.arbeit.add(1); e.arbeit.add(2); e.reise.add('2026-11-15')
    const r = berechneDood(tage, e, HALT)
    expect(r.codes).toEqual(['TR', 'SW', 'WF'])
    expect(r.summen).toMatchObject({ drehtage: 2, arbeit: 3, reise: 1 })
    expect(r.start).toBe('2026-11-15')
  })

  it('ohne Arbeitstag, nur ein Reisetag: nur TR', () => {
    const e = leer(); e.reise.add('2026-11-17')
    const r = berechneDood(WOCHE, e, HALT)
    expect(r.codes).toEqual(['', 'TR', '', '', ''])
    expect(r.summen).toMatchObject({ drehtage: 0, arbeit: 1, halt: 0, reise: 1 })
  })

  it('Probe und Anprobe zählen als gearbeitet', () => {
    const tage = kalender('2026-11-13', 4, { 3: 1 })
    const e = leer(); e.arbeit.add(1); e.probe.add('2026-11-13'); e.anprobe.add('2026-11-14')
    const r = berechneDood(tage, e, HALT)
    expect(r.codes).toEqual(['R', 'FT', '', 'SWF'])
    expect(r.summen).toMatchObject({ drehtage: 1, arbeit: 3, probe: 1, anprobe: 1 })
  })

  it('Arbeit geht vor Reise am selben Tag', () => {
    const e = leer(); e.arbeit.add(1); e.reise.add(WOCHE[0].datum)
    const r = berechneDood(WOCHE, e, HALT)
    expect(r.codes[0]).toBe('SWF')
    expect(r.summen).toMatchObject({ drehtage: 1, arbeit: 1, reise: 0 })
  })

  it('zwei Drehtage am selben Datum: Arbeit an einem davon zählt', () => {
    const tage: DoodTag[] = [{ datum: '2026-11-16', drehtagIds: [1, 2], frei: false }]
    const e = leer(); e.arbeit.add(2)
    expect(berechneDood(tage, e, HALT).codes).toEqual(['SWF'])
  })
})
