import { describe, it, expect } from 'vitest'
import { resolveAccent, PDF_DEFAULT_ACCENT } from '../lib/pdfFonts'

describe('resolveAccent', () => {
  it('nimmt eine gewählte Farbe und ersetzt die alte Voreinstellung', () => {
    expect(resolveAccent('#E11D48')).toBe('#E11D48')
    expect(resolveAccent('#abc')).toBe('#abc')
    expect(resolveAccent('#f59e0b')).toBe(PDF_DEFAULT_ACCENT)
    expect(resolveAccent('')).toBe(PDF_DEFAULT_ACCENT)
    expect(resolveAccent(null)).toBe(PDF_DEFAULT_ACCENT)
  })

  it('lässt nur Farben ins Stylesheet - alles andere wird der Standard', () => {
    expect(resolveAccent('red; } body { display: none')).toBe(PDF_DEFAULT_ACCENT)
    expect(resolveAccent('#fff</style>')).toBe(PDF_DEFAULT_ACCENT)
  })
})
