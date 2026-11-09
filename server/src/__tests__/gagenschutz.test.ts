/**
 * Gagen und Kalkulation sieht nur die Produktion (lib/gagenschutz.ts).
 *
 * Anlass: Testbericht SALZWIND vom 09.11.2026 - ein Konto mit der Rolle Regie
 * sah alle Gagen in Besetzung und Stab und die ganze Kalkulation, obwohl
 * CUTSHEET.md "Regie: keine Gagen" verspricht.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'http'

let rolle: string | null = 'director'

vi.mock('../db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  toPg: (sql: string) => sql,
  db: {
    get: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT owner_id FROM projects')) return { owner_id: 1 }
      if (sql.includes('project_members')) return rolle ? { role: rolle } : null
      // Kind-Ressourcen (/cast/5, /budget-versions/3/...) gehören zu Projekt 7
      return { project_id: 7 }
    }),
    all: vi.fn(async () => []),
    run: vi.fn(async () => ({ id: 1, changes: 1 })),
  },
}))

import { gagenschutz, gagenVerbergen, gagenEntfernen, siehtGagen, protokollwertOhneGagen } from '../lib/gagenschutz'

let server: http.Server
let base = ''
let letzterKoerper: any = null

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { (req as any).user = { id: 2, role: 'user' }; next() })
  app.use('/api', gagenschutz)
  app.get('/api/projects/7/cast', (_req, res) => {
    res.json({ data: [{ id: 5, actor_name: 'Ida Brandt', fee_per_day: 120000, rolle: { fee_per_day: 1 } }], error: null })
  })
  app.get('/api/projects/7/dood-report', (_req, res) => {
    res.json({ data: { rows: [{ actor_name: 'Ida Brandt', fee_per_day: 120000, total_cost_cents: 2400000, work_days: 20 }] }, error: null })
  })
  app.put('/api/cast/5', (req, res) => { letzterKoerper = req.body; res.json({ data: req.body, error: null }) })
  for (const pfad of [
    '/api/projects/7/budget-versions', '/api/projects/7/budget-summary', '/api/budget-versions/3/lines',
    '/api/projects/7/financing-versions', '/api/projects/7/kostenstand', '/api/projects/7/expenses',
    '/api/projects/7/payroll/export.csv', '/api/projects/7/vertraege', '/api/projects/7/vertraege/4/pdf',
    '/api/projects/7/backup', '/api/projects/7/pdf/kalkulation/3', '/api/projects/7/foerderantrag/export',
  ]) app.get(pfad, (_req, res) => res.json({ data: 'offen', error: null }))
  app.get('/api/projects/7/jugendschutz', (_req, res) => res.json({ data: 'offen', error: null }))
  server = http.createServer(app)
  await new Promise<void>((r) => server.listen(0, () => r()))
  const adresse = server.address() as any
  base = `http://127.0.0.1:${adresse.port}`
})

afterAll(() => new Promise<void>((r) => server.close(() => r())))

async function hole(pfad: string) {
  const antwort = await fetch(base + pfad)
  return { status: antwort.status, koerper: await antwort.json() as any }
}

describe('Regeln', () => {
  it('nur Produzent und Admin sehen Gagen', () => {
    expect(siehtGagen('admin')).toBe(true)
    expect(siehtGagen('producer')).toBe(true)
    expect(siehtGagen('director')).toBe(false)
    expect(siehtGagen('dept_head')).toBe(false)
    expect(siehtGagen('read_only')).toBe(false)
    expect(siehtGagen(null)).toBe(false)
  })

  it('verbirgt Gagenfelder in jeder Tiefe und lässt den Rest stehen', () => {
    const ein = { a: 1, fee_per_day: 5, liste: [{ fee_cents: 9, name: 'x' }], datum: new Date(0) }
    const aus = gagenVerbergen(ein)
    expect(aus).toEqual({ a: 1, fee_per_day: null, liste: [{ fee_cents: null, name: 'x' }], datum: new Date(0) })
    expect(ein.fee_per_day).toBe(5) // das Original bleibt unberührt
  })

  it('entfernt Gagenfelder aus einem Körper', () => {
    const koerper = { name: 'x', fee_per_day: 5, rollen: [{ fee_per_day_cents: 3, role_name: 'A' }] }
    gagenEntfernen(koerper)
    expect(koerper).toEqual({ name: 'x', rollen: [{ role_name: 'A' }] })
  })

  it('säubert gespeicherte Protokollwerte', () => {
    expect(protokollwertOhneGagen('{"actor_name":"Ida","fee_per_day":120000}')).toBe('{"actor_name":"Ida","fee_per_day":null}')
    expect(protokollwertOhneGagen('kein json')).toBe('kein json')
    expect(protokollwertOhneGagen(null)).toBe(null)
  })
})

describe('Regie', () => {
  it('sieht Besetzung ohne Gage', async () => {
    rolle = 'director'
    const { status, koerper } = await hole('/api/projects/7/cast')
    expect(status).toBe(200)
    expect(koerper.data[0].actor_name).toBe('Ida Brandt')
    expect(koerper.data[0].fee_per_day).toBeNull()
    expect(koerper.data[0].rolle.fee_per_day).toBeNull()
  })

  it('sieht den DOOD ohne Kosten', async () => {
    const { koerper } = await hole('/api/projects/7/dood-report')
    expect(koerper.data.rows[0].work_days).toBe(20)
    expect(koerper.data.rows[0].total_cost_cents).toBeNull()
  })

  it('kommt an Kalkulation, Finanzierung, Kostenstand, Verträge, Lohnexport und Sicherung nicht heran', async () => {
    for (const pfad of [
      '/api/projects/7/budget-versions', '/api/projects/7/budget-summary', '/api/budget-versions/3/lines',
      '/api/projects/7/financing-versions', '/api/projects/7/kostenstand', '/api/projects/7/expenses',
      '/api/projects/7/payroll/export.csv', '/api/projects/7/vertraege', '/api/projects/7/vertraege/4/pdf',
      '/api/projects/7/backup', '/api/projects/7/pdf/kalkulation/3', '/api/projects/7/foerderantrag/export',
    ]) {
      const { status } = await hole(pfad)
      expect(status, pfad).toBe(403)
    }
  })

  it('kommt an den Jugendschutz heran - der hängt nicht an Gagen', async () => {
    expect((await hole('/api/projects/7/jugendschutz')).status).toBe(200)
  })

  it('kann beim Speichern keine Gage setzen', async () => {
    await fetch(base + '/api/cast/5', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_name: 'Ida Brandt', fee_per_day: 1 }),
    })
    expect(letzterKoerper).toEqual({ actor_name: 'Ida Brandt' })
  })

  it('gilt genauso für Gewerksleitung und Nur lesen', async () => {
    for (const r of ['dept_head', 'read_only']) {
      rolle = r
      expect((await hole('/api/projects/7/cast')).koerper.data[0].fee_per_day, r).toBeNull()
      expect((await hole('/api/projects/7/budget-versions')).status, r).toBe(403)
    }
  })
})

describe('Produktion', () => {
  it('sieht alles', async () => {
    rolle = 'producer'
    expect((await hole('/api/projects/7/cast')).koerper.data[0].fee_per_day).toBe(120000)
    expect((await hole('/api/budget-versions/3/lines')).status).toBe(200)
    await fetch(base + '/api/cast/5', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_name: 'Ida Brandt', fee_per_day: 1 }),
    })
    expect(letzterKoerper.fee_per_day).toBe(1)
  })
})
