/**
 * Heutiges Datum in deutscher Zeit.
 *
 * Anlass: am 26.09.2026 rechneten Server und Auswertungen mit dem UTC-Datum.
 * Zwischen Mitternacht und 02:00 deutscher Zeit ist das der Vortag - genau
 * die Stunden, in denen ein Nachtdreh noch läuft.
 */
import { describe, it, expect } from 'vitest'
import { heuteISO } from '../lib/datum'

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
