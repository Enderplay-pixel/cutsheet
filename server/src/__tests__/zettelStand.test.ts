import { describe, it, expect } from 'vitest'
import { darfStand, darfAendern, waehlbareStaende, gleicheAbteilung, unterschiede } from '../lib/zettelStand'

/** Freigabe der Stundenzettel in Stufen (Plan Kino-Ausbau, AP E8). */
describe('darfStand', () => {
  const kamera = { status: 'erfasst', abteilung: 'Kamera' }
  it('Abteilungsleitung: prüfen nur in der eigenen Abteilung, nie freigeben', () => {
    expect(darfStand('dept_head', 'geprueft', kamera, ['kamera'])).toBe(true)
    expect(darfStand('dept_head', 'geprueft', kamera, ['Licht'])).toBe(false)
    expect(darfStand('dept_head', 'geprueft', { status: 'erfasst', abteilung: '' }, [''])).toBe(false)
    expect(darfStand('dept_head', 'freigegeben', kamera, ['Kamera'])).toBe(false)
  })
  it('Regie prüft alles, Produktion und Admin geben frei und rechnen ab', () => {
    expect(darfStand('director', 'geprueft', kamera, [])).toBe(true)
    expect(darfStand('director', 'freigegeben', kamera, [])).toBe(false)
    expect(darfStand('producer', 'freigegeben', kamera, [])).toBe(true)
    expect(darfStand('admin', 'abgerechnet', kamera, [])).toBe(true)
    expect(darfStand('read_only', 'geprueft', kamera, ['Kamera'])).toBe(false)
  })
  it('ein freigegebener Zettel geht nur durch die Hand der Produktion zurück', () => {
    const frei = { status: 'freigegeben', abteilung: 'Kamera' }
    expect(darfStand('dept_head', 'erfasst', frei, ['Kamera'])).toBe(false)
    expect(darfStand('director', 'geprueft', frei, [])).toBe(false)
    expect(darfStand('producer', 'erfasst', frei, [])).toBe(true)
  })
})

describe('darfAendern und waehlbareStaende', () => {
  it('ab "freigegeben" ändert nur die Produktion', () => {
    expect(darfAendern('dept_head', 'geprueft')).toBe(true)
    expect(darfAendern('dept_head', 'freigegeben')).toBe(false)
    expect(darfAendern('director', 'abgerechnet')).toBe(false)
    expect(darfAendern('producer', 'abgerechnet')).toBe(true)
  })
  it('der jetzige Stand ist immer wählbar', () => {
    expect(waehlbareStaende('read_only', { status: 'freigegeben', abteilung: '' }, [])).toEqual(['freigegeben'])
    expect(waehlbareStaende('producer', { status: 'erfasst', abteilung: '' }, [])).toEqual(['erfasst', 'geprueft', 'freigegeben', 'abgerechnet'])
  })
})

describe('Hilfen', () => {
  it('gleiche Abteilung ohne Rücksicht auf Groß- und Kleinschreibung und Leerzeichen', () => {
    expect(gleicheAbteilung([' Kamera '], 'KAMERA')).toBe(true)
    expect(gleicheAbteilung(['Kamera'], '')).toBe(false)
  })
  it('unterschiede nennt nur Geändertes', () => {
    expect(unterschiede({ Call: '07:00', Wrap: '19:00' }, { Call: '07:30', Wrap: '19:00' })).toEqual({ alt: { Call: '07:00' }, neu: { Call: '07:30' } })
    expect(unterschiede({ Call: '07:00' }, { Call: '07:00' })).toBeNull()
  })
})
