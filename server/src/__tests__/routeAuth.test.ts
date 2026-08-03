/**
 * Leseschutz der Routen, die ueber eine Kind-Ressource adressiert werden.
 *
 * Anlass: projectWriteGuard laesst GET-Anfragen bewusst durch, der Leseschutz
 * haengt also an jedem Router einzeln. Drei Router hatten gar keinen — der
 * Morning Brief (Namen, Call-Zeiten, Motivadressen), der Motivvertrag (Name,
 * Anschrift und Verguetung des Eigentuemers) und die Kameraberichte waren ohne
 * Anmeldung aus dem Netz abrufbar.
 *
 * Hier laeuft die echte Middleware, nur die Datenbank ist gefaelscht.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'http'

const OWNER_ID = 1
const FREMD_ID = 99

vi.mock('../db', () => ({
  db: {
    get: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT owner_id FROM projects')) return { owner_id: OWNER_ID }
      if (sql.includes('project_members')) return null          // kein Mitglied
      if (sql.includes('FROM camera_reports')) return { project_id: 1 }
      if (sql.includes('FROM call_sheets cs')) return { project_id: 1 }
      if (sql.includes('project_id FROM shoot_days')) return { project_id: 1 }
      if (sql.includes('project_id FROM locations')) return { project_id: 1 }
      if (sql.includes('FROM shoot_days')) return { id: 1, day_number: 1, date: '2026-08-05', project_id: 1 }
      if (sql.includes('FROM locations')) return { id: 1, name: 'Motiv', project_id: 1 }
      if (sql.includes('FROM projects')) return { id: 1, title: 'Sprachlos' }
      return null
    }),
    all: vi.fn(async () => []),
    run: vi.fn(async () => ({})),
  },
}))

let server: http.Server
let base = ''
/** Wer gilt fuer die naechste Anfrage als angemeldet — null heisst: niemand. */
let currentUser: any = null

beforeAll(async () => {
  const [brief, release, cameras, timesheets, catering, checkin, sun, sides] = await Promise.all([
    import('../routes/morningBrief'),
    import('../routes/locationRelease'),
    import('../routes/cameraReports'),
    import('../routes/timesheets'),
    import('../routes/catering'),
    import('../routes/checkin'),
    import('../routes/sun'),
    import('../routes/scriptSides'),
  ])
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { if (currentUser) (req as any).user = currentUser; next() })
  app.use('/api', brief.default)
  app.use('/api', release.default)
  app.use('/api', cameras.default)
  app.use('/api', timesheets.default)
  app.use('/api', catering.default)
  app.use('/api', checkin.default)
  app.use('/api', sun.default)
  app.use('/api', sides.default)
  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`
      resolve()
    })
  })
}, 30_000)

afterAll(() => { server?.close() })

const geschuetzt = [
  ['Morning Brief (JSON)', '/api/shoot-days/1/morning-brief'],
  ['Morning Brief (PDF)', '/api/shoot-days/1/morning-brief/pdf'],
  ['Motivvertrag (JSON)', '/api/locations/1/release'],
  ['Motivvertrag (PDF)', '/api/locations/1/release/pdf'],
  ['Kameraberichte', '/api/shoot-days/1/camera-reports'],
  // Diese fuenf prueften bisher nur die Anmeldung, nicht das Projekt: jedes
  // Konto kam an fremde Produktionen
  ['Arbeitszeiten', '/api/shoot-days/1/timesheets'],
  ['Gagen-Export', '/api/projects/1/timesheets/export.csv'],
  ['Verpflegungsliste', '/api/shoot-days/1/catering-list'],
  ['Verpflegungswuensche', '/api/projects/1/catering-preferences'],
  ['Check-in-Stand', '/api/call-sheets/1/checkin-status'],
  ['Sonnenstand', '/api/locations/1/sun'],
  ['Script Sides', '/api/shoot-days/1/script-sides/pdf'],
]

describe('Leseschutz', () => {
  for (const [name, url] of geschuetzt) {
    it(`${name} verlangt eine Anmeldung`, async () => {
      currentUser = null
      const r = await fetch(base + url)
      expect(r.status).toBe(401)
    })

    it(`${name} weist Projektfremde ab`, async () => {
      currentUser = { id: FREMD_ID, role: 'user' }
      const r = await fetch(base + url)
      expect(r.status).toBe(403)
    })
  }

  it('laesst die Eigentuemerin durch', async () => {
    currentUser = { id: OWNER_ID, role: 'user' }
    const r = await fetch(base + '/api/locations/1/release')
    expect(r.status).toBe(200)
  })

  it('laesst globale Administratoren durch', async () => {
    currentUser = { id: 4711, role: 'admin' }
    const r = await fetch(base + '/api/locations/1/release')
    expect(r.status).toBe(200)
  })
})
