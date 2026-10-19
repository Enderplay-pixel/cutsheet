/**
 * Fremdschlüssel aus einem anderen Projekt oder einer anderen Firma.
 *
 * Anlass: Die Middleware sichert nur, dass jemand Mitglied des Projekts bzw.
 * der Firma IM PFAD ist. Eine Kennung im Anfragekörper oder in einem zweiten
 * Pfadparameter prüfte sie nicht. So landete eine fremde Kennung in der
 * eigenen Zeile, und die Lese-Abfrage holte per JOIN den Namen, die Adresse
 * oder den Sichtungslink aus dem fremden Projekt dazu - oder die Route
 * änderte gleich die fremde Zeile.
 *
 * Hier laufen die echten Router mit echtem Express, nur die Datenbank ist
 * gefälscht. Die Kennung 999 steht für "gehört einem anderen Projekt": jede
 * Abfrage, die 999 zusammen mit einer Zugehörigkeitsbedingung sucht, findet
 * nichts. Jede andere Abfrage findet eine Zeile aus dem eigenen Projekt.
 * Ohne die Prüfung in der Route kommt deshalb 2xx heraus, mit ihr 404.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'http'

const FREMD = 999

vi.mock('../db', () => {
  const zeile = {
    id: 1, project_id: 1, company_id: 1, owner_id: 1, m: 0, c: 0,
    status: 'entwurf', title: 'Eigenes Projekt', name: 'Eigen', tax_mode: 'regel',
    payment_days: 14, shoot_day_id: 1, scene_id: 1, cast_id: null, photos: '[]',
    category: 'kostüm', description: '', resolved: 0,
  }
  // Eine Zugehörigkeitsbedingung: die Abfrage fragt - direkt oder über einen
  // JOIN - ob die Kennung zu diesem Projekt, dieser Firma oder dieser Dispo
  // gehört.
  const zugehoerigkeit = /\b(project_id|company_id|call_sheet_id)\b/
  const get = vi.fn(async (sql: string, params: any[] = []) => {
    if (sql.includes('SELECT owner_id FROM projects')) return { owner_id: 1 }
    if (params.some(p => Number(p) === FREMD) && zugehoerigkeit.test(sql)) return null
    return zeile
  })
  const all = vi.fn(async () => [])
  const run = vi.fn(async () => ({ id: 1, changes: 1 }))
  return {
    pool: { query: vi.fn(async () => ({ rows: [] })) },
    toPg: (sql: string) => sql,
    db: {
      get, all, run,
      exec: vi.fn(async () => undefined),
      transaction: vi.fn(async (fn: any) => fn({ get, all, run })),
    },
  }
})

// requireAuth will ein signiertes Token. Hier zählt nur, wer angemeldet ist -
// die Anmeldung selbst prüfen andere Tests.
vi.mock('../middleware/auth', async (original) => {
  const echt = await original() as any
  return {
    ...echt,
    requireAuth: (req: any, res: any, next: any) =>
      req.user ? next() : res.status(401).json({ data: null, error: 'Nicht authentifiziert' }),
  }
})

let server: http.Server
let base = ''

beforeAll(async () => {
  const module = await Promise.all([
    import('../routes/guestTokens'), import('../routes/emailRoutes'),
    import('../routes/callsheets'), import('../routes/continuity'),
    import('../routes/floorplans'), import('../routes/scenes'),
    import('../routes/characters'), import('../routes/drehplan'),
    import('../routes/catering'), import('../routes/timesheets'),
    import('../routes/reise'), import('../routes/abnahme'),
    import('../routes/agenturen'), import('../routes/angebote'),
    import('../routes/invoices'), import('../routes/vertraege'),
    import('../routes/cameraPresets'), import('../routes/extras'),
    import('../routes/insurances'), import('../routes/musicCues'),
    import('../routes/postplan'), import('../routes/stickyNotes'),
    import('../routes/vehicles'), import('../routes/vfx'),
    import('../routes/equipment'), import('../routes/equipmentCalendar'),
    import('../routes/expenses'), import('../routes/cameraReports'),
    import('../routes/sceneComments'),
  ])
  const app = express()
  app.use(express.json())
  // Ein globaler Admin kommt an jeder Mitgliedschaftsprüfung vorbei. Damit
  // misst der Test allein die Zugehörigkeit der Kennung, nicht die Rolle.
  app.use((req, _res, next) => { (req as any).user = { id: 1, email: 'admin@test.local', role: 'admin' }; next() })
  for (const m of module) app.use('/api', m.default)
  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`
      resolve()
    })
  })
}, 30_000)

afterAll(() => { server?.close() })

type Fall = [name: string, methode: string, pfad: string, koerper: Record<string, unknown>]

const faelle: Fall[] = [
  // Sichtbar ohne Anmeldung: der Gastlink zeigt die Dispo des Drehtags
  ['Gastlink fremder Drehtag', 'POST', '/api/projects/1/guest-tokens', { shoot_day_id: FREMD }],
  // Namen und Mailadressen aus dem fremden Projekt
  ['Verteiler fremder Drehtag', 'POST', '/api/projects/1/email/groups', { name: 'Tag', rule: 'drehtag', parameter: String(FREMD) }],
  ['Dispo fremder Eintrag ändern', 'PUT', '/api/call-sheets/1/entries', { entries: [{ id: FREMD, call_time: 480 }] }],
  ['Dispo fremde Person', 'POST', '/api/call-sheets/1/entries/add', { person_type: 'cast', person_id: FREMD }],
  ['Dispo fremdes Motiv', 'POST', '/api/shoot-days/1/call-sheet', { location_id: FREMD }],
  ['Anschluss fremde Szene', 'POST', '/api/projects/1/continuity', { scene_id: FREMD }],
  ['Anschluss fremde Besetzung', 'POST', '/api/projects/1/continuity', { cast_id: FREMD }],
  ['Anschluss fremder Drehtag', 'POST', '/api/projects/1/continuity', { shoot_day_id: FREMD }],
  ['Anschluss ändern fremde Besetzung', 'PUT', '/api/continuity/1', { cast_id: FREMD }],
  ['Set-Plan fremde Szene', 'POST', '/api/projects/1/floorplans', { scene_id: FREMD }],
  ['Set-Plan fremdes Motiv', 'POST', '/api/projects/1/floorplans', { location_id: FREMD }],
  ['Set-Plan ändern fremdes Motiv', 'PUT', '/api/floorplans/1', { location_id: FREMD }],
  ['Szene fremdes Motiv', 'POST', '/api/projects/1/scenes', { location_id: FREMD }],
  ['Szene ändern fremdes Motiv', 'PUT', '/api/scenes/1', { location_id: FREMD }],
  ['Szene fremde Figur', 'POST', '/api/scenes/1/characters', { character_id: FREMD }],
  ['Besetzung fremde Figur', 'POST', '/api/projects/1/cast', { character_id: FREMD }],
  ['Besetzung ändern fremde Figur', 'PUT', '/api/cast/1', { character_id: FREMD }],
  ['Drehtag fremde Szene', 'POST', '/api/shoot-days/1/scenes', { scene_id: FREMD }],
  ['Verpflegung fremde Person', 'POST', '/api/projects/1/catering-preferences', { person_type: 'crew', person_id: FREMD }],
  ['Arbeitszeit fremde Person', 'POST', '/api/shoot-days/1/timesheets', { person_type: 'cast', person_id: FREMD }],
  ['Reise fremde Unterkunft', 'POST', '/api/projects/1/reisen', { from_date: '2026-10-01', to_date: '2026-10-02', accommodation_id: FREMD }],
  ['Reise ändern fremde Unterkunft', 'PUT', '/api/projects/1/reisen/1', { accommodation_id: FREMD }],
  ['Abnahme fremde Fassung', 'POST', '/api/projects/1/abnahmen', { cut_id: FREMD }],
  ['Abnahme fremder Kunde', 'POST', '/api/projects/1/abnahmen', { cut_id: 1, client_id: FREMD }],
  ['Abnahme ändern fremder Kunde', 'PUT', '/api/projects/1/abnahmen/1', { client_id: FREMD }],
  ['Besetzungsanfrage fremde Agentur', 'POST', '/api/projects/1/casting-anfragen', { agency_id: FREMD }],
  ['Besetzungsanfrage ändern fremde Agentur', 'PUT', '/api/projects/1/casting-anfragen/1', { agency_id: FREMD }],
  ['Besetzungsanfrage fremde Figur', 'PUT', '/api/projects/1/casting-anfragen/1/rollen', { rollen: [{ character_id: FREMD }] }],
  ['Angebot fremder Kunde', 'POST', '/api/companies/1/quotes', { client_id: FREMD }],
  ['Angebot fremdes Projekt', 'POST', '/api/companies/1/quotes', { project_id: FREMD }],
  ['Angebot ändern fremder Kunde', 'PUT', '/api/companies/1/quotes/1', { client_id: FREMD }],
  ['Angebot ändern fremdes Projekt', 'PUT', '/api/companies/1/quotes/1', { project_id: FREMD }],
  ['Rechnung fremder Kunde', 'POST', '/api/companies/1/invoices', { client_id: FREMD }],
  ['Rechnung ändern fremder Kunde', 'PUT', '/api/companies/1/invoices/1', { client_id: FREMD }],
  ['Rechnung ändern fremdes Projekt', 'PUT', '/api/companies/1/invoices/1', { project_id: FREMD }],
  // Zweiter Pfadparameter: die Zeile selbst gehört einem fremden Projekt
  ['Vertragsvorlage fremd ändern', 'PUT', `/api/projects/1/vertragsvorlagen/${FREMD}`, { name: 'Neu' }],
  ['Kamera-Preset fremd ändern', 'PUT', `/api/projects/1/camera-presets/${FREMD}`, { name: 'Neu' }],
  ['Komparse fremd ändern', 'PUT', `/api/projects/1/extras/${FREMD}`, { name: 'Neu' }],
  ['Versicherung fremd ändern', 'PUT', `/api/projects/1/insurances/${FREMD}`, { provider: 'Neu' }],
  ['Music-Cue fremd ändern', 'PUT', `/api/projects/1/music-cues/${FREMD}`, { title: 'Neu' }],
  ['Post-Phase fremd ändern', 'PUT', `/api/projects/1/post-phases/${FREMD}`, { phase: 'Schnitt' }],
  ['Notiz fremd ändern', 'PUT', `/api/projects/1/sticky-notes/${FREMD}`, { content: 'Neu' }],
  ['Fahrzeug fremd ändern', 'PUT', `/api/projects/1/vehicles/${FREMD}`, { name: 'Neu' }],
  ['VFX-Shot fremd ändern', 'PUT', `/api/projects/1/vfx/${FREMD}`, { description: 'Neu' }],
  // Niedrig: verwaiste Verweise ohne sichtbare Wirkung, trotzdem zu
  ['Music-Cue fremde Szene', 'POST', '/api/projects/1/music-cues', { title: 'Cue', scene_id: FREMD }],
  ['Music-Cue ändern fremde Szene', 'PUT', '/api/projects/1/music-cues/1', { scene_id: FREMD }],
  ['VFX-Shot fremde Szene', 'POST', '/api/projects/1/vfx', { description: 'Shot', scene_id: FREMD }],
  ['VFX-Shot ändern fremde Szene', 'PUT', '/api/projects/1/vfx/1', { scene_id: FREMD }],
  ['Equipment-Liste fremder Drehtag', 'POST', '/api/projects/1/equipment-lists', { shoot_day_id: FREMD }],
  ['Gerätebuchung fremder Posten', 'POST', '/api/projects/1/equipment-bookings', { equipment_item_id: FREMD, start_date: '2026-10-01', end_date: '2026-10-02' }],
  ['Gerätebuchung ändern fremder Posten', 'PUT', '/api/equipment-bookings/1', { equipment_item_id: FREMD }],
  ['Beleg fremde Kalkulationszeile', 'POST', '/api/projects/1/expenses', { description: 'Beleg', budget_line_id: FREMD }],
  ['Beleg ändern fremde Kalkulationszeile', 'PUT', '/api/expenses/1', { budget_line_id: FREMD }],
  ['Take fremde Einstellung', 'POST', '/api/camera-reports/1/takes', { shot_id: FREMD }],
  ['Take ändern fremde Einstellung', 'PUT', '/api/camera-takes/1', { shot_id: FREMD }],
  ['Szenenkommentar fremde Szene', 'POST', `/api/projects/1/scenes/${FREMD}/comments`, { content: 'Hallo' }],
  ['Vertrag fremde Vorlage', 'POST', '/api/projects/1/vertraege', { person_type: 'cast', person_id: 1, body: 'Text', template_id: FREMD }],
]

describe('Fremdschlüssel', () => {
  for (const [name, methode, pfad, koerper] of faelle) {
    it(`${name} wird mit 404 abgewiesen`, async () => {
      const r = await fetch(base + pfad, {
        method: methode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper),
      })
      const antwort = await r.json() as any
      expect(r.status, `${methode} ${pfad}: ${JSON.stringify(antwort)}`).toBe(404)
      expect(antwort.data).toBeNull()
      expect(antwort.error).toMatch(/nicht gefunden/)
    })
  }
})

// Gegenprobe: dieselben Routen mit einer eigenen Kennung dürfen nicht an der
// neuen Prüfung hängen bleiben. Sonst bestünde der Test oben auch mit einer
// Route, die immer 404 sagt.
const eigene: Fall[] = [
  ['Gastlink eigener Drehtag', 'POST', '/api/projects/1/guest-tokens', { shoot_day_id: 1 }],
  ['Verteiler eigener Drehtag', 'POST', '/api/projects/1/email/groups', { name: 'Tag', rule: 'drehtag', parameter: '1' }],
  ['Drehtag eigene Szene', 'POST', '/api/shoot-days/1/scenes', { scene_id: 1 }],
  ['Anschluss eigene Besetzung', 'POST', '/api/projects/1/continuity', { cast_id: 1 }],
  ['Szene eigenes Motiv', 'POST', '/api/projects/1/scenes', { location_id: 1 }],
  ['Besetzung eigene Figur', 'POST', '/api/projects/1/cast', { character_id: 1 }],
  ['Rechnung eigener Kunde', 'POST', '/api/companies/1/invoices', { client_id: 1 }],
  ['Komparse eigen ändern', 'PUT', '/api/projects/1/extras/1', { name: 'Neu' }],
]

describe('Fremdschlüssel - Gegenprobe', () => {
  for (const [name, methode, pfad, koerper] of eigene) {
    it(`${name} geht durch`, async () => {
      const r = await fetch(base + pfad, {
        method: methode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper),
      })
      expect(r.status, `${methode} ${pfad}`).toBeLessThan(300)
    })
  }
})
