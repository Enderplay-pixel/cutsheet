import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'net'

const geschrieben: any[][] = []
vi.mock('../db', () => ({
  db: {
    run: vi.fn(async (_sql: string, params: any[]) => { geschrieben.push(params); return {} }),
    all: vi.fn(async () => []),
    get: vi.fn(async () => undefined),
  },
}))

import { aenderungenProtokollieren } from '../routes/audit'

/** Kleiner Server: setzt Nutzer und Projekt wie optionalAuth/projectWriteGuard. */
async function mitServer(fn: (base: string) => Promise<void>) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as any).user = { id: 7, email: 'p@x.de', name: 'Produktion', role: 'user' }
    ;(req as any).auditProjektId = 42
    next()
  })
  app.use('/api', aenderungenProtokollieren)
  app.post('/api/projects/42/tasks', (_req, res) => res.status(201).json({ data: { id: 99 }, error: null }))
  app.put('/api/tasks/5', (_req, res) => res.json({ data: {}, error: null }))
  app.patch('/api/shots/12/done', (_req, res) => res.json({ data: {}, error: null }))
  app.delete('/api/tasks/6', (_req, res) => res.status(403).json({ data: null, error: 'nein' }))
  app.post('/api/auth/login', (_req, res) => res.json({ data: {}, error: null }))
  const server = app.listen(0)
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    await new Promise(r => setTimeout(r, 20))
  } finally {
    server.close()
  }
}

const senden = (base: string, method: string, pfad: string, body?: unknown) =>
  fetch(base + pfad, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })

describe('Aenderungsprotokoll', () => {
  beforeEach(() => { geschrieben.length = 0 })

  it('schreibt Anlegen mit neuer ID und lesbarem Titel', async () => {
    await mitServer(async base => { await senden(base, 'POST', '/api/projects/42/tasks', { title: 'Genehmigung', password: 'geheim' }) })
    expect(geschrieben).toHaveLength(1)
    const [projekt, nutzer, name, aktion, entitaet, id, , neu] = geschrieben[0]
    expect([projekt, nutzer, name, aktion, entitaet, id]).toEqual([42, 7, 'Produktion', 'angelegt', 'Aufgabe', 99])
    // Passwoerter landen nie im Protokoll
    expect(JSON.parse(neu)).toEqual({ title: 'Genehmigung' })
  })

  it('erkennt Aendern und Unterpfade', async () => {
    await mitServer(async base => {
      await senden(base, 'PUT', '/api/tasks/5', { status: 'Erledigt' })
      await senden(base, 'PATCH', '/api/shots/12/done')
    })
    expect(geschrieben.map(p => [p[3], p[4], p[5]])).toEqual([
      ['geändert', 'Aufgabe', 5],
      ['geändert (done)', 'Einstellung', 12],
    ])
  })

  it('protokolliert keine abgewiesenen Aenderungen und keine Anmeldungen', async () => {
    await mitServer(async base => {
      await senden(base, 'DELETE', '/api/tasks/6')
      await senden(base, 'POST', '/api/auth/login', { email: 'a', password: 'b' })
    })
    expect(geschrieben).toHaveLength(0)
  })
})
