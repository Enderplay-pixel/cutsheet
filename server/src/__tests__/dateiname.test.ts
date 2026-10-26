import { describe, it, expect } from 'vitest'
import { dateiname } from '../lib/dateiname'

describe('dateiname', () => {
  it('schreibt Umlaute und ß aus statt sie zu verschlucken', () => {
    expect(dateiname('Nordlicht (Großproduktion)')).toBe('nordlicht-grossproduktion')
    expect(dateiname('Müller & Söhne – Zürich')).toBe('mueller-soehne-zuerich')
  })
  it('entfernt andere Akzente und Randstriche', () => {
    expect(dateiname('  Été à Paris!  ')).toBe('ete-a-paris')
  })
  it('lässt nach dem Kürzen auf 80 Zeichen keinen Trenner hängen', () => {
    const name = dateiname('Drehplan ' + 'x'.repeat(70) + ' Woche 3')
    expect(name.length).toBeLessThanOrEqual(80)
    expect(name.endsWith('-')).toBe(false)
  })
  it('fällt bei leerem Titel auf den Ersatz zurück', () => {
    expect(dateiname('')).toBe('dokument')
    expect(dateiname(null, 'drehbuch')).toBe('drehbuch')
  })
})
