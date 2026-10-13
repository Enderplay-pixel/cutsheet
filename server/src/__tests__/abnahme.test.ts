import { describe, it, expect } from 'vitest'
import { alsZeitstelle, ausZeitstelle, STUFEN } from '../routes/abnahme'

/**
 * Zeitstellen.
 *
 * Eine Anmerkung mit Zeitstelle ist brauchbar ("bei 2:14 ist der Ton zu
 * laut"), eine ohne nicht. Deshalb darf beim Eintippen möglichst nichts
 * schiefgehen - und was sich nicht lesen lässt, soll die Anmerkung nicht
 * verwerfen, sondern nur ohne Stelle speichern.
 */

describe('Sekunden als Zeitstelle', () => {
  it('schreibt Minuten und Sekunden', () => {
    expect(alsZeitstelle(0)).toBe('0:00')
    expect(alsZeitstelle(9)).toBe('0:09')
    expect(alsZeitstelle(134)).toBe('2:14')
    expect(alsZeitstelle(734)).toBe('12:14')
  })

  it('nimmt die Stunde dazu, sobald es eine gibt', () => {
    expect(alsZeitstelle(3599)).toBe('59:59')
    expect(alsZeitstelle(3600)).toBe('1:00:00')
    expect(alsZeitstelle(3734)).toBe('1:02:14')
  })

  it('gibt bei nichts auch nichts zurück', () => {
    // Eine Anmerkung ohne Stelle ist zulässig - dann steht dort kein "0:00".
    expect(alsZeitstelle(null)).toBe('')
    expect(alsZeitstelle(undefined)).toBe('')
    expect(alsZeitstelle(NaN)).toBe('')
  })
})

describe('Zeitstelle als Sekunden', () => {
  it('liest Minuten und Sekunden', () => {
    expect(ausZeitstelle('2:14')).toBe(134)
    expect(ausZeitstelle('12:14')).toBe(734)
    expect(ausZeitstelle('0:09')).toBe(9)
  })

  it('liest Stunden mit', () => {
    expect(ausZeitstelle('1:02:14')).toBe(3734)
    expect(ausZeitstelle('1:00:00')).toBe(3600)
  })

  it('nimmt eine blanke Sekundenzahl', () => {
    // Wer "134" tippt, meint 134 Sekunden - und soll nicht belehrt werden.
    expect(ausZeitstelle('134')).toBe(134)
  })

  it('erträgt Leerzeichen', () => {
    expect(ausZeitstelle('  2:14  ')).toBe(134)
    expect(ausZeitstelle('2 : 14')).toBe(134)
  })

  it('gibt null zurück, statt die Anmerkung zu verwerfen', () => {
    // Was sich nicht lesen lässt, kostet die Stelle - nicht die Anmerkung.
    expect(ausZeitstelle('')).toBeNull()
    expect(ausZeitstelle('irgendwo in der Mitte')).toBeNull()
    expect(ausZeitstelle('2:14:30:99')).toBeNull()
    expect(ausZeitstelle('-5:00')).toBeNull()
  })

  it('kommt von der einen Form in die andere und zurück', () => {
    for (const s of [0, 9, 134, 734, 3600, 3734, 7199]) {
      expect(ausZeitstelle(alsZeitstelle(s)), `${s}`).toBe(s)
    }
  })
})

describe('Stufen einer Fassung', () => {
  it('stehen in der Reihenfolge, in der sie entstehen', () => {
    expect(STUFEN.map((s) => s.stufe)).toEqual([
      'rohschnitt', 'feinschnitt', 'picture_lock', 'farbe_ton', 'final',
    ])
  })

  it('haben alle einen Namen', () => {
    for (const s of STUFEN) expect(s.name.length, s.stufe).toBeGreaterThan(3)
  })
})
