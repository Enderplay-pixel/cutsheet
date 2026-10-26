import { describe, it, expect } from 'vitest'
import { figurName, alsRollenname } from '../lib/figuren'

describe('Figuren aus dem Drehbuch', () => {
  it('nimmt den Namen ohne Zusätze und Fountain-Zeichen', () => {
    expect(figurName('JANA (O.S.)')).toBe('JANA')
    expect(figurName("JANA (CONT'D)")).toBe('JANA')
    expect(figurName('@McKENZIE')).toBe('McKENZIE')
    expect(figurName('BRICK ^')).toBe('BRICK')
    expect(figurName('  ')).toBe('')
    expect(figurName(null)).toBe('')
  })

  it('schreibt den Rollennamen wie in einer Rollenliste', () => {
    expect(alsRollenname('JANA')).toBe('Jana')
    expect(alsRollenname('DR. MÜLLER-LÜDENSCHEIDT')).toBe('Dr. Müller-Lüdenscheidt')
    expect(alsRollenname('ÖZLEM')).toBe('Özlem')
  })
})
