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
  it('fällt bei leerem Titel auf den Ersatz zurück', () => {
    expect(dateiname('')).toBe('dokument')
    expect(dateiname(null, 'drehbuch')).toBe('drehbuch')
  })
})
