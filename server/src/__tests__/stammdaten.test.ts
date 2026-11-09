import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  toPg: (sql: string) => sql,
  db: { get: vi.fn(), all: vi.fn(async () => []), run: vi.fn(async () => ({})) },
}))

/**
 * Stammdaten nur plausibel speichern. Testbericht SALZWIND (09.11.2026):
 * Laufzeit -5, Drehschluss vor Drehbeginn und das Jahr 42027 wurden
 * ohne Warnung gespeichert.
 */
describe('Stammdaten prüfen', () => {
  it('weist eine negative oder absurde Laufzeit ab', async () => {
    const { stammdatenFehler } = await import('../routes/projects')
    expect(stammdatenFehler(-5, null, null)).toContain('Laufzeit')
    expect(stammdatenFehler(20000, null, null)).toContain('Laufzeit')
    expect(stammdatenFehler('abc', null, null)).toContain('Laufzeit')
    expect(stammdatenFehler(118, null, null)).toBeNull()
    expect(stammdatenFehler(null, null, null)).toBeNull()
  })

  it('weist ein unmögliches Jahr und ein falsches Datum ab', async () => {
    const { stammdatenFehler } = await import('../routes/projects')
    expect(stammdatenFehler(null, '42027-03-01', null)).toContain('Drehbeginn')
    expect(stammdatenFehler(null, '2027-02-30', null)).toContain('Drehbeginn')
    expect(stammdatenFehler(null, null, '1850-01-01')).toContain('Drehschluss')
  })

  it('weist einen Drehschluss vor dem Drehbeginn ab', async () => {
    const { stammdatenFehler } = await import('../routes/projects')
    expect(stammdatenFehler(null, '2027-03-26', '2027-03-01')).toBe('Der Drehschluss liegt vor dem Drehbeginn')
    expect(stammdatenFehler(null, '2027-03-01', '2027-03-26')).toBeNull()
    expect(stammdatenFehler(null, '2027-03-01', '2027-03-01')).toBeNull()
  })
})
