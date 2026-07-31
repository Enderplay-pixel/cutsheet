import { describe, it, expect, afterEach } from 'vitest'
import { checkSecrets, getJwtSecret, getStateSecret } from '../config/secrets'

const PLATZHALTER = 'cutsheet-dev-secret-change-in-production'
const GUT = 'x'.repeat(40)

const original = { ...process.env }
afterEach(() => { process.env = { ...original } })

describe('checkSecrets in der Produktion', () => {
  const prod = (extra: Record<string, string> = {}) =>
    checkSecrets({ NODE_ENV: 'production', ...extra } as any)

  it('beanstandet ein fehlendes JWT_SECRET', () => {
    const r = prod()
    expect(r.ok).toBe(false)
    expect(r.problems.some(p => p.includes('JWT_SECRET fehlt'))).toBe(true)
  })

  it('beanstandet den Platzhalter aus dem Quelltext', () => {
    const r = prod({ JWT_SECRET: PLATZHALTER })
    expect(r.ok).toBe(false)
    expect(r.problems.some(p => p.includes('Platzhalter'))).toBe(true)
  })

  it('beanstandet einen zu kurzen Schluessel', () => {
    const r = prod({ JWT_SECRET: 'kurz' })
    expect(r.ok).toBe(false)
    expect(r.problems.some(p => p.includes('zu kurz'))).toBe(true)
  })

  it('akzeptiert einen ordentlichen Schluessel', () => {
    expect(prod({ JWT_SECRET: GUT, APP_BASE_URL: 'https://beispiel.de' }).ok).toBe(true)
  })

  it('warnt bei fehlender APP_BASE_URL, verhindert den Start aber nicht', () => {
    const r = prod({ JWT_SECRET: GUT })
    expect(r.ok).toBe(true)
    expect(r.warnings.some(w => w.includes('APP_BASE_URL fehlt'))).toBe(true)
  })

  it('warnt bei einem Schraegstrich am Ende der APP_BASE_URL', () => {
    const r = prod({ JWT_SECRET: GUT, APP_BASE_URL: 'https://beispiel.de/' })
    expect(r.warnings.some(w => w.includes('Schrägstrich'))).toBe(true)
  })

  it('beanstandet fehlende Schluessel fuer Fremdtokens', () => {
    const r = prod()
    expect(r.problems.some(p => p.includes('TOKEN_ENCRYPTION_KEY'))).toBe(true)
  })

  it('laesst TOKEN_ENCRYPTION_KEY allein genuegen', () => {
    const r = prod({ JWT_SECRET: GUT, TOKEN_ENCRYPTION_KEY: 'y'.repeat(32) })
    expect(r.problems.some(p => p.includes('TOKEN_ENCRYPTION_KEY'))).toBe(false)
  })
})

describe('checkSecrets in der Entwicklung', () => {
  it('laesst ein fehlendes JWT_SECRET durchgehen, weist aber darauf hin', () => {
    const r = checkSecrets({ NODE_ENV: 'development' } as any)
    expect(r.ok).toBe(true)
    expect(r.warnings.some(w => w.includes('JWT_SECRET fehlt'))).toBe(true)
  })

  it('beanstandet den Platzhalter auch hier', () => {
    // Wer ihn ausdruecklich setzt, meint ihn vermutlich ernst — und das ist falsch
    expect(checkSecrets({ NODE_ENV: 'development', JWT_SECRET: PLATZHALTER } as any).ok).toBe(false)
  })
})

describe('getJwtSecret', () => {
  it('liefert den gesetzten Wert', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = GUT
    expect(getJwtSecret()).toBe(GUT)
  })

  it('verweigert in der Produktion den Rueckfallwert', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    expect(() => getJwtSecret()).toThrow('JWT_SECRET ist nicht gesetzt')
  })

  it('erlaubt den Rueckfallwert in der Entwicklung', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    expect(getJwtSecret()).toBe(PLATZHALTER)
  })
})

describe('getStateSecret', () => {
  it('verweigert in der Produktion den Rueckfallwert', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    expect(() => getStateSecret()).toThrow('nicht fälschungssicher')
  })

  it('erlaubt den Rueckfallwert in der Entwicklung', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    expect(getStateSecret()).toBe('cutsheet-dev-state-secret')
  })
})
