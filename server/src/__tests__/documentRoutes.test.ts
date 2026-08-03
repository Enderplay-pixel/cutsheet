/**
 * Prueft alle Dokumentrouten auf der HTML-Ebene: echte Route, echtes Layout,
 * gefaelschte Datenbank und gefaelschtes Chromium.
 *
 * Die Testdaten sind absichtlich unangenehm — fehlende Felder, Sonderzeichen,
 * Anfuehrungszeichen im Titel. Genau daran ist die alte Fassung gescheitert:
 * `${row.email}` schrieb bei einem leeren Feld das Wort "null" ins PDF, und
 * ein "&" im Namen landete unmaskiert im Markup.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'http'

// ── gefaelschte Datenbank ────────────────────────────────────────────────────

const project = {
  id: 1, title: 'Sprachlos & Laut <Arbeitstitel>', director: 'Sarah Müller',
  producer: 'Jan Groß', dop: '', format: 'Kurzfilm', genre: 'Drama',
  length_minutes: 24, production_company: 'Nordlicht Film',
  shoot_start: '2026-08-05', shoot_end: '2026-08-06',
  synopsis: 'Zwei Menschen, ein Fluss.',
}

const crew = Array.from({ length: 42 }, (_, i) => ({
  id: i + 1,
  name: i === 0 ? 'Ann & Bo <Team>' : `Crew Person ${i + 1}`,
  role: i % 3 === 0 ? 'Kamera-Assistenz' : 'Set-Aufnahmeleitung',
  department: ['Regie', 'Kamera', 'Ton', 'Licht'][i % 4],
  email: i % 4 === 0 ? null : `person${i}@example.com`,
  phone: i % 3 === 0 ? '' : '+49 170 1234567',
  fee_per_day: i % 5 === 0 ? null : 25000,
  sort_order: i,
}))

const scenes = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1, scene_number: `${i + 1}`, title: `Szene ${i + 1} — Am Fluss`,
  int_ext: i % 2 === 0 ? 'INT' : 'EXT', day_night: i % 3 === 0 ? 'NACHT' : 'TAG',
  eighths: (i % 7) + 1, estimated_minutes: 30 + i * 5, sort_order: i,
  location_name: i % 5 === 0 ? null : 'Altbauwohnung',
}))

const days = [
  { id: 1, day_number: 1, date: '2026-08-05', status: 'geplant', notes: 'Treffpunkt Basecamp' },
  { id: 2, day_number: 2, date: '2026-08-06', status: 'geplant', notes: null },
]

// Zweites Motiv ohne jede Adressangabe — hier stand frueher "null, null null"
const locations = [
  { id: 1, name: 'Altbauwohnung', address: 'Hauptstr. 1', zip: '10115', city: 'Berlin', country: 'Deutschland', contact_name: 'H. Meier', contact_phone: '030 1234', power_available: 1, rental_fee: 45000, project_id: 1 },
  { id: 2, name: 'Waldlichtung', address: null, zip: null, city: null, country: null, contact_name: null, contact_phone: null, power_available: 0, rental_fee: null, project_id: 1 },
]

const budgetLines = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1, category: ['Stab', 'Technik', 'Ausstattung'][i % 3],
  account_code: `${100 + i}`, description: `Position ${i + 1}`, unit: 'Tag',
  quantity: (i % 4) + 1, unit_price_cents: 12000 + i * 500,
  total_cents: ((i % 4) + 1) * (12000 + i * 500), sort_order: i,
}))

const shots = Array.from({ length: 55 }, (_, i) => ({
  id: i + 1, scene_id: (i % 6) + 1, shot_number: `${(i % 6) + 1}${String.fromCharCode(65 + (i % 5))}`,
  size: ['Totale', 'Halbnah', 'Nah', 'Detail'][i % 4],
  movement: i % 3 === 0 ? 'Schwenk' : null,
  lens_mm: i % 2 === 0 ? 35 : null,
  description: `Einstellung ${i + 1}: Figur geht durch das Bild & bleibt stehen`,
  duration_seconds: i % 4 === 0 ? null : 8 + i, sort_order: i,
  notes: i % 5 === 0 ? 'Achtung: Glasbruch & Sicherheitsabstand' : null,
  done: i % 3 === 0 ? 1 : 0,
  shoot_day_id: i % 7 === 0 ? null : (i % 2) + 1,
  storyboard_url: null,
}))

const equipmentItems = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1, item: `Artikel ${i + 1}`, quantity: (i % 3) + 1,
  supplier: i % 4 === 0 ? null : 'Verleih Nord',
  rental_per_day_cents: 3000 + i * 200, total_days: 3,
  total_cents: 3 * (3000 + i * 200), checked: i % 2, sort_order: i,
}))

const callSheet = {
  id: 1, shoot_day_id: 1, general_call: 420, sunrise: '05:42', sunset: '21:14',
  weather_forecast: '18 °C, Regen ab 14 Uhr', notes: 'Parken nur Hofeinfahrt & Seitenstraße',
}

const callEntries = [
  { id: 1, person_type: 'crew', person_id: 1, call_time: 420, sort_order: 0 },
  { id: 2, person_type: 'cast', person_id: 2, call_time: 480, sort_order: 1 },
  { id: 3, person_type: 'crew', person_id: 3, call_time: null, sort_order: 2 },
]

const blocks = [
  { scene_id: 1, block_type: 'scene_heading', content: 'INT. ALTBAUWOHNUNG – TAG', sort_order: 0 },
  { scene_id: 1, block_type: 'action', content: 'ANNA steht am Fenster und sieht hinaus.', sort_order: 1 },
  { scene_id: 1, block_type: 'character', content: 'ANNA', sort_order: 2 },
  { scene_id: 1, block_type: 'parenthetical', content: '(leise)', sort_order: 3 },
  { scene_id: 1, block_type: 'dialogue', content: 'Es hört nicht auf zu regnen. Und ich weiß nicht mehr, ob ich das noch aushalte.', sort_order: 4 },
]

function fakeGet(sql: string): any {
  if (sql.includes('FROM call_sheets')) return callSheet
  if (sql.includes('FROM crew WHERE id')) return { name: 'Ann & Bo <Team>', role: 'Kamera-Assistenz' }
  if (sql.includes('actor_name as name')) return { name: 'Mira Ø', role: 'Anna' }
  if (sql.includes('location_releases')) {
    return {
      id: 1, owner_name: 'Familie Schmidt & Co', owner_address: null,
      shoot_dates: '["2026-08-05"]', fee_cents: null,
      special_conditions: null, status: 'Entwurf', signature_data: null,
    }
  }
  if (sql.includes('FROM locations')) return locations[1]
  if (sql.includes('project_settings')) return { header_color: '#e11d48', currency: 'EUR' }
  if (sql.includes('budget_versions')) return { id: 1, name: 'Fassung 3 "final"', total_cents: 1409000 }
  if (sql.includes('financing_versions')) return { id: 1, total_cents: 900000 }
  if (sql.includes('FROM daily_reports')) {
    return {
      call_time: 420, first_shot: 540, lunch_in: 780, lunch_out: 825, wrap: 1230,
      pages_shot: 19, total_setups: 14, camera_rolls: 'A001, A002', sound_rolls: null,
      production_notes: 'Regen ab 14 Uhr.\nSzene 12 verschoben — Licht & Ton ok.',
      notes: null,
    }
  }
  if (sql.includes('FROM shoot_days sd JOIN projects')) {
    return { ...days[0], project_title: project.title, director: project.director, producer: project.producer, project_id: 1 }
  }
  if (sql.includes('FROM projects')) return project
  // Morning Brief und Sides laden den Drehtag ohne JOIN
  if (sql.includes('FROM shoot_days')) return { ...days[0], project_id: 1 }
  return null
}

function fakeAll(sql: string): any[] {
  if (sql.includes('call_sheet_entries')) return callEntries
  if (sql.includes('screenplay_blocks')) return blocks
  if (sql.includes('catering_preferences')) return []
  // Der Foerderantrag holt die jeweils juengste Fassung per db.all(... LIMIT 1)
  if (sql.includes('budget_versions')) return [{ id: 1, name: 'Fassung 3 "final"', total_cents: 1409000 }]
  if (sql.includes('financing_plan_versions')) return [{ id: 1, total_cents: 900000 }]
  if (sql.includes('FROM shoot_days')) return days
  if (sql.includes('FROM shoot_day_scenes')) return scenes.slice(0, 6)
  if (sql.includes('NOT EXISTS')) return scenes.slice(6, 12)
  if (sql.includes('FROM scenes')) return scenes
  if (sql.includes('FROM crew')) return crew
  // Der Foerderantrag schreibt die Tabelle in Anfuehrungszeichen: FROM "cast"
  if (sql.includes('FROM cast') || sql.includes('FROM "cast"')) {
    return crew.slice(0, 12).map((c, i) => ({
      ...c, actor_name: c.name, character_name: i === 1 ? null : `Rolle ${i + 1}`,
      agency: i % 3 === 0 ? null : 'Agentur Süd', agent: null,
    }))
  }
  if (sql.includes('FROM locations')) return locations
  if (sql.includes('FROM budget_lines')) return budgetLines
  if (sql.includes('financing_entries')) {
    return [
      { source: 'Filmförderung Nord', type: 'Zuschuss', amount_cents: 600000, confirmed: 1 },
      { source: 'Eigenmittel', type: 'Eigenanteil', amount_cents: 300000, confirmed: 0 },
    ]
  }
  if (sql.includes('FROM shots')) return shots
  if (sql.includes('FROM equipment_lists')) {
    return [
      { id: 1, name: 'Kamera & Optik', department: 'Kamera', notes: 'Abholung Fr 8 Uhr' },
      { id: 2, name: 'Licht', department: 'Licht', notes: null },
    ]
  }
  if (sql.includes('FROM equipment_items')) return equipmentItems
  return []
}

vi.mock('../db', () => ({
  db: {
    get: vi.fn(async (sql: string) => fakeGet(sql)),
    all: vi.fn(async (sql: string) => fakeAll(sql)),
    run: vi.fn(async () => ({})),
  },
}))

vi.mock('../middleware/projectAuth', () => ({
  requireMember: (_req: any, _res: any, next: any) => next(),
  getUserProjectRole: async () => 'admin',
}))

// ── gefaelschtes Chromium ────────────────────────────────────────────────────

const captured = new Map<string, { html: string; opts: any }>()
let current = ''
let server: http.Server
let base = ''

beforeAll(async () => {
  // generatePdf laedt puppeteer per require zur Laufzeit — vi.mock erreicht das
  // nicht, der Modul-Cache von Node schon.
  const { createRequire } = await import('module')
  const req = createRequire(__filename)
  const pptrPath = req.resolve('puppeteer')
  req.cache[pptrPath] = {
    id: pptrPath, filename: pptrPath, loaded: true, children: [], paths: [],
    exports: {
      launch: async () => ({
        newPage: async () => ({
          setContent: async (html: string) => {
            captured.set(current, { html, opts: captured.get(current)?.opts })
          },
          pdf: async (opts: any) => {
            captured.set(current, { html: captured.get(current)?.html || '', opts })
            return Buffer.from('%PDF-1.4 attrappe')
          },
        }),
        close: async () => {},
      }),
    },
  } as any

  const [pdfRouter, foerder, release, brief, sides] = await Promise.all([
    import('../routes/pdf'), import('../routes/foerderantrag'), import('../routes/locationRelease'),
    import('../routes/morningBrief'), import('../routes/scriptSides'),
  ])
  const app = express()
  app.use((req, _res, next) => { (req as any).user = { id: 1, role: 'admin' }; next() })
  app.use('/api', pdfRouter.default)
  app.use('/api', foerder.default)
  app.use('/api', release.default)
  app.use('/api', brief.default)
  app.use('/api', sides.default)
  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`
      resolve()
    })
  })
}, 60_000)

afterAll(() => { server?.close() })

const docs: Array<[string, string]> = [
  ['drehplan', '/api/projects/1/pdf/drehplan'],
  ['stabliste', '/api/projects/1/pdf/stabliste'],
  ['besetzungsliste', '/api/projects/1/pdf/besetzungsliste'],
  ['motivliste', '/api/projects/1/pdf/motivliste'],
  ['kalkulation', '/api/projects/1/pdf/kalkulation/1'],
  ['tagesbericht', '/api/shoot-days/1/pdf/tagesbericht'],
  ['shotlist', '/api/projects/1/pdf/shotlist'],
  ['shotlist-drehtag', '/api/projects/1/pdf/shotlist?nach=drehtag'],
  ['equipment', '/api/projects/1/pdf/equipment'],
  ['foerderantrag', '/api/projects/1/foerderantrag/export?format=pdf'],
  ['motivvertrag', '/api/locations/2/release/pdf'],
  ['morning-brief', '/api/shoot-days/1/morning-brief/pdf'],
]

async function hole(name: string, url: string) {
  current = name
  const r = await fetch(base + url)
  const body = Buffer.from(await r.arrayBuffer())
  if (r.status !== 200) throw new Error(`${name}: ${r.status} ${body.toString('utf8').slice(0, 300)}`)
  const cap = captured.get(name)
  if (!cap?.html) throw new Error(`${name}: kein HTML abgefangen`)
  // DOC_DUMP=<verzeichnis> legt das HTML ab, um die Dokumente anzusehen
  if (process.env.DOC_DUMP) require('fs').writeFileSync(`${process.env.DOC_DUMP}/doc-${name}.html`, cap.html)
  return { r, ...cap }
}

describe('Dokumentrouten', () => {
  for (const [name, url] of docs) {
    describe(name, () => {
      it('behauptet keine Werte, die es nicht gibt', async () => {
        const { html } = await hole(name, url)
        const sichtbar = html.replace(/<[^>]*>/g, ' ')
        expect(sichtbar).not.toMatch(/\bnull\b/)
        expect(sichtbar).not.toMatch(/\bundefined\b/)
        expect(sichtbar).not.toMatch(/\bNaN\b/)
      })

      it('maskiert Eingaben', async () => {
        const { html } = await hole(name, url)
        expect(html).not.toContain('<Arbeitstitel>')
        expect(html).not.toContain('<Team>')
      })

      it('setzt genau eine Fusszeile', async () => {
        const { html, opts } = await hole(name, url)
        // Die generische Puppeteer-Fusszeile muss aus sein, sonst stehen zwei
        // Fusszeilen im selben Band uebereinander
        expect(opts.displayHeaderFooter).toBe(false)
        expect(html).toContain('doc-foot')
      })

      it('haengt einen unversehrten Dateinamen an', async () => {
        const { r } = await hole(name, url)
        const disp = String(r.headers.get('content-disposition'))
        // Ein Anfuehrungszeichen im Titel wuerde den Header sonst zerlegen
        expect(disp.match(/"/g)?.length).toBe(2)
      })
    })
  }

  it('setzt fehlende Adressteile nicht zusammen', async () => {
    const { html } = await hole('motivliste', '/api/projects/1/pdf/motivliste')
    expect(html).toContain('Hauptstr. 1, 10115 Berlin')
    expect(html).not.toContain(', &nbsp;')
  })

  it('gruppiert die Shotlist wahlweise nach Drehtag', async () => {
    const { html } = await hole('shotlist-drehtag', '/api/projects/1/pdf/shotlist?nach=drehtag')
    expect(html).toContain('Drehtag 1')
    expect(html).toContain('Noch keinem Drehtag zugeordnet')
  })

  it('nimmt Notiz und Erledigt-Haken der Einstellung mit', async () => {
    const { html } = await hole('shotlist', '/api/projects/1/pdf/shotlist')
    expect(html).toContain('shot-note')
    expect(html).toContain('Glasbruch')
    expect(html).toContain('kasten voll')
  })

  it('nennt jedes Motiv im Morning Brief nur einmal', async () => {
    const { html } = await hole('morning-brief', '/api/shoot-days/1/morning-brief/pdf')
    const abschnitt = html.slice(html.indexOf('>Motive<'), html.indexOf('>Call-Zeiten<'))
    expect(abschnitt.split('Altbauwohnung').length - 1).toBe(1)
  })

  it('setzt die Sides im Drehbuchsatz', async () => {
    const { html } = await hole('sides', '/api/shoot-days/1/script-sides/pdf')
    // Gleiche Maschine wie das Drehbuch: Courier auf festem Zeilenraster
    expect(html).toContain('Courier New')
    expect(html).toContain('class="script"')
    // Kopfzeile auf jeder Seite, damit ein loses Blatt zuzuordnen ist
    expect(html).toContain('class="shead"')
    expect(html).toContain('Drehtag 1')
    expect(html).toContain('ANNA')
    // Kein rohes Markup aus dem Blockinhalt mehr
    expect(html).not.toContain('<p class="dialogue">')
  })

  it('weist die Finanzierungsluecke aus', async () => {
    const { html } = await hole('foerderantrag', '/api/projects/1/foerderantrag/export?format=pdf')
    expect(html).toContain('Finanzierungslücke')
  })

  it('haelt den Vertrag ohne Verguetung offen statt 0 zu behaupten', async () => {
    const { html } = await hole('motivvertrag', '/api/locations/2/release/pdf')
    expect(html).toContain('Vergütung')
    expect(html).not.toContain('0,00')
  })
})
