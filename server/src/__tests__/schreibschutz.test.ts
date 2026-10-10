/**
 * Kein fremdes Konto darf irgendwo schreiben.
 *
 * Anlass: am 26.09.2026 mit zwei echten Konten nachgemessen - ein fremdes
 * Konto konnte Moodboard-Bilder, Anschlussnotizen, Verpflegungswünsche,
 * Szenenkommentare, Sperrtage und ARBEITSZEITEN eines anderen Projekts
 * ändern oder löschen. Sieben Löcher, alle mit derselben Ursache:
 *
 *   const projectId = await extractProjectId(...)
 *   if (!projectId) return next()      // Projekt unbekannt -> durchlassen
 *
 * Liegt eine Route nicht unter /projects/:id und fehlt sie in entityPatterns,
 * findet der Wächter kein Projekt und lässt sie durch.
 *
 * Der Test zählt die Routen nicht aus dem Quelltext ab, sondern fragt Express
 * selbst nach seinem Routenbaum und ruft JEDE schreibende Route auf - mit
 * einem angemeldeten Konto, das im Projekt nichts zu suchen hat. Damit sind
 * alle vier Schutzwege abgedeckt: Pfadpräfix, entityPatterns,
 * requireMemberVia im Router und Prüfungen im Handler. Eine neue Route ist
 * automatisch mitgeprüft.
 *
 * Erwartung: nie eine Antwort im 2xx-Bereich.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'http'

const FREMDER = { id: 99, email: 'fremd@test.local', role: 'user' }

vi.mock('../db', () => {
  const projektZeile = { id: 1, project_id: 1, owner_id: 1, title: 'Fremdes Projekt' }
  return {
    pool: { query: vi.fn(async () => ({ rows: [] })) },
    toPg: (sql: string) => sql,
    db: {
      // Jede Nachschlage findet etwas, das zu Projekt 1 gehört - sonst käme
      // ein 404 heraus und der Test prüfte gar nichts.
      get: vi.fn(async (sql: string) => {
        if (sql.includes('project_members')) return null        // kein Mitglied
        if (sql.includes('SELECT owner_id FROM projects')) return { owner_id: 1 }
        return projektZeile
      }),
      all: vi.fn(async () => []),
      run: vi.fn(async () => ({ id: 1, changes: 1 })),
      transaction: vi.fn(async (fn: any) => fn({
        get: async () => projektZeile, all: async () => [], run: async () => ({ id: 1, changes: 1 }),
      })),
    },
  }
})

let server: http.Server
let base = ''
const routen: Array<{ methode: string; pfad: string }> = []

beforeAll(async () => {
  const module = await Promise.all([
    import('../routes/projects'), import('../routes/scenes'), import('../routes/characters'),
    import('../routes/crew'), import('../routes/locations'), import('../routes/drehplan'),
    import('../routes/callsheets'), import('../routes/dailyreports'), import('../routes/shots'),
    import('../routes/budget'), import('../routes/equipment'), import('../routes/calendar'),
    import('../routes/stickyNotes'), import('../routes/vehicles'), import('../routes/extras'),
    import('../routes/cameraPresets'), import('../routes/screenplay'), import('../routes/vfx'),
    import('../routes/postplan'), import('../routes/musicCues'), import('../routes/insurances'),
    import('../routes/sceneComments'), import('../routes/equipmentCalendar'),
    import('../routes/moodboard'), import('../routes/blackoutDates'),
    import('../routes/optimizationSuggestions'), import('../routes/checkin'),
    import('../routes/timesheets'), import('../routes/catering'), import('../routes/continuity'),
    import('../routes/creator'), import('../routes/floorplans'), import('../routes/cameraReports'),
    import('../routes/tasks'), import('../routes/expenses'),
    // Der Rest der Router mit schreibenden Routen. Nur /auth und /admin
    // fehlen: die eine liegt vor jedem Projekt, die andere ist Adminsache.
    import('../routes/aiBreakdown'), import('../routes/aiScheduling'),
    import('../routes/backup'), import('../routes/guestTokens'),
    import('../routes/invites'), import('../routes/push'),
    import('../routes/youtube'), import('../routes/emailRoutes'),
    import('../routes/confirmation'), import('../routes/feedback'),
    import('../routes/locationRelease'), import('../routes/scriptSides'),
    import('../routes/dood'), import('../routes/payroll'),
    import('../routes/morningBrief'), import('../routes/foerderantrag'),
    import('../routes/pdf'), import('../routes/audit'),
    import('../routes/activityFeed'), import('../routes/search'),
    import('../routes/contactsExport'), import('../routes/ical'),
    import('../routes/insurances'), import('../routes/vfx'),
    import('../routes/companies'), import('../routes/invoices'),
    import('../routes/datenschutz'), import('../routes/papierkorb'),
  ])
  const { projectWriteGuard } = await import('../middleware/projectAuth')

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { (req as any).user = FREMDER; next() })
  app.use('/api', projectWriteGuard)
  app.use('/api/projects', module[0].default)
  for (const m of module.slice(1)) app.use('/api', m.default)

  // Express nach seinem eigenen Routenbaum fragen - keine Liste von Hand.
  const sammle = (schicht: any, praefix: string) => {
    if (schicht.route) {
      for (const m of Object.keys(schicht.route.methods)) {
        if (['post', 'put', 'patch', 'delete'].includes(m)) {
          routen.push({ methode: m.toUpperCase(), pfad: praefix + schicht.route.path })
        }
      }
    } else if (schicht.handle?.stack) {
      const eigen = schicht.regexp?.source
        ?.replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/')
        .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, '1') ?? ''
      const p = eigen && eigen !== '/^\\/?$/i' && !eigen.includes('?') ? eigen : ''
      for (const s of schicht.handle.stack) sammle(s, praefix + (p.startsWith('/') ? p : ''))
    }
  }
  for (const s of (app as any)._router.stack) sammle(s, '')

  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`
      resolve()
    })
  })
}, 30_000)

afterAll(() => { server?.close() })

/** Platzhalter durch eine 1 ersetzen; Token-Pfade bekommen etwas Textliches. */
function beispiel(pfad: string): string {
  return pfad.replace(/:token/g, 'abc').replace(/:[A-Za-z]+/g, '1')
}

/** Routen ohne Projektbezug - jede Zeile eine Entscheidung, mit Grund. */
const FREIGESTELLT = [
  /^\/api\/cse\/t\//,           // öffentlicher Dispo-Link, 160-Bit-Token
  /^\/api\/projects$/,          // Projekt anlegen
]

describe('Schreibschutz gegen fremde Konten', () => {
  it('kennt genug Routen, um aussagekräftig zu sein', () => {
    console.log(`  ${routen.length} schreibende Routen geprüft`)
    expect(routen.length).toBeGreaterThan(80)
  })

  it('lässt ein fremdes Konto nirgends schreiben', async () => {
    const durchgelassen: string[] = []

    for (const r of routen) {
      const url = base + beispiel(r.pfad)
      if (FREIGESTELLT.some(m => m.test(beispiel(r.pfad)))) continue
      let status = 0
      try {
        const antwort = await fetch(url, {
          method: r.methode,
          headers: { 'Content-Type': 'application/json' },
          body: r.methode === 'DELETE' ? undefined : JSON.stringify({}),
        })
        status = antwort.status
      } catch {
        continue                      // Verbindungsfehler ist kein Durchlass
      }
      if (status >= 200 && status < 300) durchgelassen.push(`${r.methode} ${beispiel(r.pfad)} -> ${status}`)
    }

    expect(durchgelassen, 'Diese Routen antworten einem Fremden mit Erfolg').toEqual([])
  }, 60_000)
})
