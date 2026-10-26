import { describe, it, expect } from 'vitest'
import { motivAusTitel, alsMotivname } from '../lib/motive'

describe('motivAusTitel', () => {
  it('nimmt den Ort vor dem ersten Bindestrich - das Set dahinter gehört zum Motiv', () => {
    expect(motivAusTitel('WOHNUNG ANDI - KÜCHE')).toBe('WOHNUNG ANDI')
    expect(motivAusTitel('HAFEN')).toBe('HAFEN')
    expect(motivAusTitel('  STADTPARK   OST  ')).toBe('STADTPARK OST')
  })

  it('legt für den Platzhalter einer Szene ohne Titel kein Motiv an', () => {
    expect(motivAusTitel('SZENE 7')).toBe('')
    expect(motivAusTitel('Scene 12A')).toBe('')
    // So legt der Editor eine Szene an - unverändert ist das kein Spielort
    expect(motivAusTitel('NEUE SZENE')).toBe('')
    expect(motivAusTitel('')).toBe('')
    expect(motivAusTitel(null)).toBe('')
  })
})

describe('alsMotivname', () => {
  it('macht aus Großbuchstaben einen lesbaren Namen, kleine Wörter bleiben klein', () => {
    expect(alsMotivname('BÜRO VON DR. MÜLLER')).toBe('Büro von Dr. Müller')
    expect(alsMotivname('CAFÉ AM HAFEN')).toBe('Café am Hafen')
    expect(alsMotivname('HOUSE OF THE DEAD')).toBe('House of the Dead')
    expect(alsMotivname('LAGERHALLE NORD-WEST')).toBe('Lagerhalle Nord-West')
  })

  it('lässt einen gemischt geschriebenen Namen so, wie er geschrieben wurde', () => {
    expect(alsMotivname('Wohnküche von Andi')).toBe('Wohnküche von Andi')
    expect(alsMotivname('wohnküche')).toBe('wohnküche')
  })
})
