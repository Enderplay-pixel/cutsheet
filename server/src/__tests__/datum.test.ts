/**
 * Heutiges Datum in deutscher Zeit.
 *
 * Anlass: am 26.09.2026 rechneten Server und Auswertungen mit dem UTC-Datum.
 * Zwischen Mitternacht und 02:00 deutscher Zeit ist das der Vortag - genau
 * die Stunden, in denen ein Nachtdreh noch läuft.
 */
import { describe, it, expect } from 'vitest'
import { heuteISO, istIsoDatum, berlinZeitpunkt, isoWoche, laufzeitFehler } from '../lib/datum'

describe('heuteISO', () => {
  it('nimmt in der Sommernacht den deutschen Tag, nicht den UTC-Tag', () => {
    const nachts = new Date('2026-09-21T01:30:00+02:00')
    expect(nachts.toISOString().slice(0, 10)).toBe('2026-09-20')   // der alte Weg
    expect(heuteISO(nachts)).toBe('2026-09-21')
  })

  it('gilt auch im Winter, wo der Abstand nur eine Stunde ist', () => {
    expect(heuteISO(new Date('2026-01-15T00:30:00+01:00'))).toBe('2026-01-15')
  })

  it('liefert am Tag dasselbe wie UTC', () => {
    const mittags = new Date('2026-09-21T12:00:00+02:00')
    expect(heuteISO(mittags)).toBe(mittags.toISOString().slice(0, 10))
  })

  it('formatiert mit führenden Nullen', () => {
    expect(heuteISO(new Date('2026-03-05T12:00:00+01:00'))).toBe('2026-03-05')
  })
})

describe('istIsoDatum', () => {
  it('nimmt nur echte Kalenderdaten an', () => {
    expect(istIsoDatum('2026-10-25')).toBe(true)
    expect(istIsoDatum('2028-02-29')).toBe(true)
    // Kein Schalttag 2026, kein 30. Februar - new Date machte daraus März.
    expect(istIsoDatum('2026-02-29')).toBe(false)
    expect(istIsoDatum('2026-02-30')).toBe(false)
    expect(istIsoDatum('2026-13-01')).toBe(false)
    expect(istIsoDatum('abc')).toBe(false)
    expect(istIsoDatum('25.10.2026')).toBe(false)
    expect(istIsoDatum('2026-10-25T10:00')).toBe(false)
    expect(istIsoDatum(undefined)).toBe(false)
  })
})

describe('berlinZeitpunkt', () => {
  it('rechnet deutsche Uhrzeit in einen Zeitpunkt um - Winter, Sommer, nach Mitternacht', () => {
    expect(berlinZeitpunkt('2026-11-02', 7 * 60).toISOString()).toBe('2026-11-02T06:00:00.000Z')
    expect(berlinZeitpunkt('2026-07-01', 7 * 60).toISOString()).toBe('2026-07-01T05:00:00.000Z')
    // Drehschluss 01:30 am Folgetag, als 25:30 gezählt
    expect(berlinZeitpunkt('2026-07-01', 25 * 60 + 30).toISOString()).toBe('2026-07-01T23:30:00.000Z')
    // Umstellungstag Ende Oktober: 07:00 ist schon Winterzeit
    expect(berlinZeitpunkt('2026-10-25', 7 * 60).toISOString()).toBe('2026-10-25T06:00:00.000Z')
  })
})

describe('isoWoche', () => {
  it('beginnt montags und rechnet den Jahreswechsel wie die Norm', () => {
    expect(isoWoche('2026-11-07')).toBe('2026-W45') // Samstag
    expect(isoWoche('2026-11-08')).toBe('2026-W45') // Sonntag - dieselbe Woche
    expect(isoWoche('2026-11-09')).toBe('2026-W46') // Montag
    expect(isoWoche('2027-01-01')).toBe('2026-W53') // gehört zur letzten Woche 2026
    expect(isoWoche('2027-01-04')).toBe('2027-W1')
  })
})

describe('laufzeitFehler', () => {
  it('lässt leere Enden zu und weist Unsinn und verkehrte Reihenfolge ab', () => {
    expect(laufzeitFehler('', null)).toBeNull()
    expect(laufzeitFehler('2026-12-01', '2026-12-10')).toBeNull()
    expect(laufzeitFehler('morgen', '')).toMatch(/ein Datum/)
    expect(laufzeitFehler('2026-12-10', '2026-12-01')).toMatch(/nicht vor/)
  })
})
