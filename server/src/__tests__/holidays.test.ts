import { describe, it, expect } from 'vitest'
import { getHolidays } from '../services/holidays'

describe('DACH Holidays', () => {
  it('returns Neujahr on Jan 1', () => {
    const holidays = getHolidays(2026, 'NW')
    const neujahr = holidays.find(h => h.name === 'Neujahr')
    expect(neujahr?.date).toBe('2026-01-01')
  })

  it('returns correct Easter Monday for 2026', () => {
    const holidays = getHolidays(2026, 'NW')
    const ostermontag = holidays.find(h => h.name === 'Ostermontag')
    // Easter 2026 is April 5, so Ostermontag = April 6
    expect(ostermontag?.date).toBe('2026-04-06')
  })

  it('NW gets Fronleichnam', () => {
    const holidays = getHolidays(2026, 'NW')
    const fronleichnam = holidays.find(h => h.name === 'Fronleichnam')
    expect(fronleichnam).toBeDefined()
  })

  it('HH does not get Fronleichnam', () => {
    const holidays = getHolidays(2026, 'HH')
    const fronleichnam = holidays.find(h => h.name === 'Fronleichnam')
    expect(fronleichnam).toBeUndefined()
  })

  it('returns at least 9 holidays for any German state', () => {
    expect(getHolidays(2026, 'NW').length).toBeGreaterThanOrEqual(9)
  })
})
