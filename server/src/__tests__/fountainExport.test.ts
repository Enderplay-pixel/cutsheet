import { describe, it, expect } from 'vitest'
import { fountainZeilen } from '../lib/fountainExport'

/**
 * Fountain-Export, Zeile für Zeile.
 *
 * Gemessen am 24.10.2026: Eine Anmerkung - die interne Randnotiz - stand im
 * exportierten Drehbuch als gewöhnliche Aktionszeile. Wer das Drehbuch
 * bekam, las die Notizen der Produktion mit.
 */

describe('fountainZeilen', () => {
  it('druckt eine Anmerkung nicht als Drehbuchtext', () => {
    const zeilen = fountainZeilen({ block_type: 'annotation', content: 'Kostüm noch klären' })
    // In doppelten Klammern bleibt sie in der Datei, druckt aber nicht.
    expect(zeilen[0]).toBe('[[Kostüm noch klären]]')
  })

  it('behandelt eine Notiz genauso', () => {
    expect(fountainZeilen({ block_type: 'note', content: 'Licht?' })[0]).toBe('[[Licht?]]')
  })

  it('kennzeichnet eine Einblendung', () => {
    expect(fountainZeilen({ block_type: 'super', content: '9 Monate später' })[0])
      .toBe('SUPER: "9 Monate später"')
  })

  it('setzt kein zweites SUPER davor', () => {
    expect(fountainZeilen({ block_type: 'super', content: 'Super: Berlin' })[0]).toBe('SUPER: BERLIN')
  })

  it('kennzeichnet einen Intercut', () => {
    expect(fountainZeilen({ block_type: 'intercut', content: 'Mark / David' })[0])
      .toBe('INTERCUT WITH: MARK / DAVID')
  })

  it('erzwingt eine Überschrift, die nicht mit INT oder EXT beginnt', () => {
    expect(fountainZeilen({ block_type: 'scene_heading', content: 'Montage' })[0]).toBe('.MONTAGE')
    expect(fountainZeilen({ block_type: 'scene_heading', content: 'INT. Raum - Tag' })[0])
      .toBe('INT. RAUM - TAG')
  })

  it('erzwingt deutsche Überschriften - Fountain kennt nur INT, EXT, EST, INT./EXT und I/E', () => {
    expect(fountainZeilen({ block_type: 'scene_heading', content: 'INNEN. Küche - Tag' })[0]).toBe('.INNEN. KÜCHE - TAG')
    expect(fountainZeilen({ block_type: 'scene_heading', content: 'AUSSEN. Hafen - Nacht' })[0]).toBe('.AUSSEN. HAFEN - NACHT')
    expect(fountainZeilen({ block_type: 'scene_heading', content: 'EST. Stadt - Tag' })[0]).toBe('EST. STADT - TAG')
    expect(fountainZeilen({ block_type: 'scene_heading', content: 'INT./EXT. Auto - Tag' })[0]).toBe('INT./EXT. AUTO - TAG')
  })

  it('setzt Figur, Klammer und Dialog ohne Leerzeile dazwischen', () => {
    // Fountain erkennt eine Figur nur, wenn der Dialog direkt darunter steht.
    expect(fountainZeilen({ block_type: 'character', content: 'Mark' })).toEqual(['MARK'])
    expect(fountainZeilen({ block_type: 'parenthetical', content: 'leise' })).toEqual(['(leise)'])
    expect(fountainZeilen({ block_type: 'dialogue', content: 'Nein.' })).toEqual(['Nein.', ''])
  })

  it('erzwingt einen Übergang', () => {
    expect(fountainZeilen({ block_type: 'transition', content: 'Schnitt auf:' })[0]).toBe('> SCHNITT AUF:')
  })

  it('lässt leere Zeilen weg', () => {
    expect(fountainZeilen({ block_type: 'action', content: '   ' })).toEqual([])
  })
})
