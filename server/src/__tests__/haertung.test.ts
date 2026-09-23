/**
 * Grundhaertung.
 *
 * Anlass: am 23.09.2026 sendete die Anwendung keinen einzigen
 * Sicherheitskopf, verriet ihre Serversoftware und liess zehn falsche
 * Passwoerter in vier Sekunden zu.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { schutzkoepfe, bremse, bremseZuruecksetzen } from '../middleware/haertung'

function antwort() {
  const r: any = { koepfe: {} as Record<string, string>, code: 0, koerper: null, beendet: [] as Function[] }
  r.setHeader = (k: string, v: string) => { r.koepfe[k] = v }
  r.removeHeader = (k: string) => { delete r.koepfe[k] }
  r.status = (c: number) => { r.code = c; r.statusCode = c; return r }
  r.json = (k: any) => { r.koerper = k; return r }
  r.on = (e: string, fn: Function) => { if (e === 'finish') r.beendet.push(fn) }
  r.fertig = (code: number) => { r.statusCode = code; r.beendet.forEach((f: Function) => f()) }
  return r
}

describe('Schutzkoepfe', () => {
  it('setzt die Koepfe und entfernt X-Powered-By', () => {
    const res = antwort()
    res.koepfe['X-Powered-By'] = 'Express'
    schutzkoepfe(false)({} as any, res, vi.fn() as any)
    expect(res.koepfe['X-Powered-By']).toBeUndefined()
    expect(res.koepfe['X-Content-Type-Options']).toBe('nosniff')
    expect(res.koepfe['X-Frame-Options']).toBe('DENY')
    expect(res.koepfe['Referrer-Policy']).toContain('strict-origin')
    expect(res.koepfe['Permissions-Policy']).toContain('geolocation=()')
  })

  it('setzt HSTS nur in der Produktion', () => {
    const lokal = antwort()
    schutzkoepfe(false)({} as any, lokal, vi.fn() as any)
    // Lokal gesetzt wuerde der Browser http://localhost dauerhaft umschreiben
    expect(lokal.koepfe['Strict-Transport-Security']).toBeUndefined()

    const live = antwort()
    schutzkoepfe(true)({} as any, live, vi.fn() as any)
    expect(live.koepfe['Strict-Transport-Security']).toContain('max-age=31536000')
  })
})

describe('Bremse', () => {
  beforeEach(() => bremseZuruecksetzen())

  const mw = () => bremse({ grenze: 3, fensterMs: 60_000, sperreMs: 60_000 })
  const anfrage = (ip = '1.2.3.4') => ({ ip, socket: {}, body: {} } as any)

  function versuch(m: any, code: number, ip?: string) {
    const res = antwort(); const next = vi.fn()
    m(anfrage(ip), res, next)
    if (next.mock.calls.length) res.fertig(code)
    return res
  }

  it('laesst erfolgreiche Anmeldungen unbegrenzt durch', () => {
    const m = mw()
    for (let i = 0; i < 20; i++) {
      const res = versuch(m, 200)
      expect(res.code).not.toBe(429)
    }
  })

  it('sperrt nach der Grenze an Fehlversuchen', () => {
    const m = mw()
    versuch(m, 401); versuch(m, 401); versuch(m, 401)
    const res = versuch(m, 401)
    expect(res.code).toBe(429)
    expect(res.koerper.error).toContain('Fehlversuche')
    expect(res.koepfe['Retry-After']).toBeTruthy()
  })

  it('zaehlt 403 mit, nicht nur 401', () => {
    const m = mw()
    versuch(m, 403); versuch(m, 403); versuch(m, 403)
    expect(versuch(m, 403).code).toBe(429)
  })

  it('setzt nach erfolgreicher Anmeldung zurueck', () => {
    const m = mw()
    versuch(m, 401); versuch(m, 401)
    versuch(m, 200)                       // Erfolg loescht die Historie
    versuch(m, 401); versuch(m, 401)
    expect(versuch(m, 401).code).not.toBe(429)
  })

  it('trennt nach Anrufer - ein Gesperrter sperrt niemanden sonst', () => {
    const m = mw()
    for (let i = 0; i < 4; i++) versuch(m, 401, '9.9.9.9')
    expect(versuch(m, 401, '9.9.9.9').code).toBe(429)
    expect(versuch(m, 401, '8.8.8.8').code).not.toBe(429)
  })

  it('trennt zusaetzlich nach E-Mail', () => {
    const m = bremse({
      grenze: 2, fensterMs: 60_000, sperreMs: 60_000,
      schluessel: (req: any) => `${req.ip}|${req.body?.email ?? ''}`,
    })
    const stelle = (email: string, code: number) => {
      const res = antwort(); const next = vi.fn()
      m({ ip: '1.1.1.1', socket: {}, body: { email } } as any, res, next)
      if (next.mock.calls.length) res.fertig(code)
      return res
    }
    stelle('opfer@x.de', 401); stelle('opfer@x.de', 401)
    expect(stelle('opfer@x.de', 401).code).toBe(429)
    // Das echte Konto kommt weiterhin durch
    expect(stelle('echt@x.de', 401).code).not.toBe(429)
  })
})
