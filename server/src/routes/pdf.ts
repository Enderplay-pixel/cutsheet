import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole } from '../middleware/projectAuth'
import { renderCallSheetHtml } from '../lib/callSheetLayout'
import {
  layoutScreenplay,
  renderScreenplayHtml,
  buildTitlePage,
  buildTextPage,
  PAPER,
  type PaperName,
  type SceneInput,
} from '../lib/screenplayFormat'

const router = Router()

// Helper to format minutes as HH:MM
function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Helper to format cents as a currency amount
function fmtMoney(cents: number, currency = 'EUR'): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency })
}

const fsMod = require('fs')
const pathMod = require('path')

const fileExists = (p: string) => { try { return fsMod.existsSync(p) } catch { return false } }

/**
 * Sucht ein von puppeteer heruntergeladenes Chrome in einem Cache-Verzeichnis.
 * Aufbau: <cache>/chrome/<plattform-version>/chrome-<plattform>/chrome[.exe]
 * Die Version steht im Ordnernamen, deshalb wird gescannt statt geraten.
 */
export function findInPuppeteerCache(cacheDir: string): string | undefined {
  const root = pathMod.join(cacheDir, 'chrome')
  if (!fileExists(root)) return undefined

  let builds: string[]
  try { builds = fsMod.readdirSync(root).sort().reverse() } catch { return undefined }

  const binaries = ['chrome', 'chrome.exe', 'chrome-headless-shell', 'chrome-headless-shell.exe']
  for (const build of builds) {
    const buildDir = pathMod.join(root, build)
    let inner: string[]
    try { inner = fsMod.readdirSync(buildDir) } catch { continue }
    for (const dir of inner) {
      for (const bin of binaries) {
        const candidate = pathMod.join(buildDir, dir, bin)
        if (fileExists(candidate)) return candidate
      }
    }
  }
  return undefined
}

/**
 * Findet ein startbares Chromium. Bewusst mehrstufig, damit der PDF-Export in
 * jeder Umgebung läuft: lokal (Chrome/Edge/Chromium installiert), auf Render und
 * Railway (von puppeteer geladenes Chrome im Projekt-Cache) und in Nix-Images
 * (Chromium auf dem PATH).
 */
/** Wo zuletzt gesucht wurde — geht in die Fehlermeldung, damit sie diagnostizierbar ist. */
let lastProbedPaths: string[] = []

function resolveChromium(): string | undefined {
  lastProbedPaths = []

  // 1. Explizit gesetzter Pfad hat immer Vorrang
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fileExists(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    console.log('[PDF] Chromium via PUPPETEER_EXECUTABLE_PATH:', process.env.PUPPETEER_EXECUTABLE_PATH)
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  // 2. Von puppeteer heruntergeladenes Chrome. Reihenfolge: konfigurierter
  //    Cache, Projekt-Cache (.puppeteerrc.cjs), HOME-Cache.
  const cacheDirs = [
    process.env.PUPPETEER_CACHE_DIR,
    pathMod.resolve(__dirname, '../../../.cache/puppeteer'),  // Repo-Wurzel aus dist/routes
    pathMod.resolve(process.cwd(), '.cache/puppeteer'),
    process.env.HOME ? pathMod.join(process.env.HOME, '.cache/puppeteer') : undefined,
  ].filter(Boolean) as string[]

  for (const dir of cacheDirs) {
    lastProbedPaths.push(`${dir}${fileExists(dir) ? '' : ' (existiert nicht)'}`)
    const found = findInPuppeteerCache(dir)
    if (found) { console.log('[PDF] Chromium im Cache gefunden:', found); return found }
  }

  // 3. Systeminstallation auf dem PATH (Nix, Debian-Images)
  try {
    const { execSync } = require('child_process')
    const found = execSync(
      'which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || which google-chrome 2>/dev/null',
      { encoding: 'utf8', timeout: 3000 }
    ).trim().split('\n')[0]
    if (found) { console.log('[PDF] Chromium via which:', found); return found }
  } catch { /* keine Shell verfügbar */ }

  // 4. Bekannte feste Pfade, inklusive Windows für die lokale Entwicklung
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/root/.nix-profile/bin/chromium',
    '/nix/var/nix/profiles/default/bin/chromium',
    '/run/current-system/sw/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  const found = candidates.find(fileExists)
  // Kein Fund ist kein Fehler: puppeteer löst dann seinen eigenen Pfad auf
  console.log('[PDF] Chromium statische Suche:', found ?? 'nichts gefunden, puppeteer entscheidet')
  return found
}

export interface PdfOptions {
  watermark?: string
  /** Papierformat; Standard A4. */
  format?: 'A4' | 'Letter'
  /** Seitenränder. Achtung: übersteuert @page-margin aus dem CSS. */
  margin?: { top: string; bottom: string; left: string; right: string }
  /** Querformat — für breite Layouts wie den Set-Plan. */
  landscape?: boolean
  /**
   * CutSheet-Fußzeile mit Seitenzahl. Standard true. Das Drehbuch schaltet sie
   * ab, weil es seine Seitenzahlen normgerecht selbst oben rechts setzt.
   */
  footer?: boolean
}

// Generic PDF generator using puppeteer (lazily loaded)
export async function generatePdf(html: string, opts?: PdfOptions): Promise<Buffer> {
  const puppeteer = require('puppeteer')
  const executablePath = resolveChromium()
  console.log('[PDF] Launching puppeteer, executablePath:', executablePath ?? '(bundled)')
  const launchOptions: any = {
    headless: true,
    args: [
      // ACHTUNG: Kein --single-process und kein --no-zygote. Beide lassen den
      // Renderer bei Page.printToPDF abstürzen ("Target closed") — der Grund,
      // weshalb sämtliche PDF-Exporte fehlgeschlagen sind.
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--no-first-run',
    ],
  }
  if (executablePath) launchOptions.executablePath = executablePath
  let browser: any
  try {
    browser = await puppeteer.launch(launchOptions)
  } catch (launchErr: any) {
    console.error('[PDF] puppeteer.launch failed:', launchErr.message)
    console.error('[PDF] durchsuchte Cache-Verzeichnisse:', lastProbedPaths)
    // Die durchsuchten Pfade mitgeben: ohne sie ist im Betrieb nicht zu
    // erkennen, ob der Browser fehlt oder nur woanders liegt.
    const probed = lastProbedPaths.length ? ` Durchsucht: ${lastProbedPaths.join(', ')}.` : ''
    throw new Error(
      `Chromium konnte nicht gestartet werden: ${launchErr.message}${probed}` +
      ' Abhilfe: "npm install" erneut ausfuehren (installiert Chromium ins Projekt) oder PUPPETEER_EXECUTABLE_PATH setzen.'
    )
  }
  try {
    const page = await browser.newPage()
    // Optionales Wasserzeichen: position:fixed wiederholt sich beim Druck auf jeder Seite
    let content = html
    if (opts?.watermark) {
      const wm = String(opts.watermark).slice(0, 60)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      content = html.replace('<body>', `<body>
        <div style="position:fixed;top:42%;left:4%;width:92%;text-align:center;transform:rotate(-28deg);
          font-size:56px;font-weight:bold;color:rgba(17,17,17,0.07);z-index:9999;pointer-events:none;
          font-family:Arial,sans-serif;letter-spacing:4px;">${wm}</div>`)
    }
    await page.setContent(content, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const withFooter = opts?.footer !== false
    const pdf = await page.pdf({
      format: opts?.format ?? 'A4',
      landscape: opts?.landscape ?? false,
      printBackground: true,
      displayHeaderFooter: withFooter,
      ...(withFooter ? {
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="width:100%;text-align:center;font-size:7px;color:#9ca3af;font-family:Arial,sans-serif;">
        Erstellt mit CutSheet &middot; cutsheet.app &nbsp;&nbsp;|&nbsp;&nbsp; Seite <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      } : {}),
      margin: opts?.margin ?? { top: '15mm', bottom: '18mm', left: '15mm', right: '15mm' },
    })
    return pdf
  } finally {
    await browser.close()
  }
}

function buildCss(accentColor: string): string {
  return `<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #111; background: #fff; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin: 12px 0 6px; border-bottom: 2px solid ${accentColor}; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 8px 0 4px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: ${accentColor}; color: #000; text-align: left; padding: 5px 8px; font-size: 10px; }
  td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .header { border-bottom: 3px solid ${accentColor}; margin-bottom: 16px; padding-bottom: 8px; }
  .meta { color: #555; font-size: 10px; }
  .badge-int { background: rgba(245,158,11,0.2); color: #92400e; padding: 1px 6px; border-radius: 4px; font-size: 9px; }
  .badge-ext { background: rgba(59,130,246,0.2); color: #1e40af; padding: 1px 6px; border-radius: 4px; font-size: 9px; }
  .badge-nacht { background: rgba(99,102,241,0.2); color: #3730a3; padding: 1px 6px; border-radius: 4px; font-size: 9px; }
  .summary { background: #f3f4f6; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; display: flex; gap: 24px; }
  .summary span { font-weight: bold; }
  .total-row { border-top: 3px solid ${accentColor}; padding-top: 8px; text-align: right; font-size: 16px; font-weight: bold; }
</style>`
}

// Helper: fetch project settings (accent color + currency)
async function getProjectSettings(projectId: number | string): Promise<{ accentColor: string; currency: string }> {
  const settings = await db.get('SELECT header_color, currency FROM project_settings WHERE project_id = ?', [projectId]) as any
  return {
    accentColor: settings?.header_color || '#f59e0b',
    currency: settings?.currency || 'EUR',
  }
}

// All /projects/:projectId/* PDF routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/pdf/drehplan
router.get('/projects/:projectId/pdf/drehplan', async (req: Request, res: Response) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor } = await getProjectSettings(req.params.projectId)
  const days = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number ASC', [req.params.projectId]) as any[]

  let daysHtml = ''
  for (const day of days) {
    const scenes = await db.all(`
      SELECT sds.*, s.scene_number, s.title, s.int_ext, s.day_night, s.eighths, s.estimated_minutes, l.name as location_name
      FROM shoot_day_scenes sds
      JOIN scenes s ON sds.scene_id = s.id
      LEFT JOIN locations l ON s.location_id = l.id
      WHERE sds.shoot_day_id = ?
      ORDER BY sds.sort_order ASC
    `, [day.id]) as any[]

    const totalEighths = scenes.reduce((s: number, sc: any) => s + sc.eighths, 0)
    const totalMins = scenes.reduce((s: number, sc: any) => s + sc.estimated_minutes, 0)

    daysHtml += `
      <h2>Drehtag ${day.day_number} — ${day.date} <small style="font-weight:normal;color:#555">${day.status}</small></h2>
      ${day.notes ? `<p style="color:#555;margin-bottom:6px;font-style:italic">${day.notes}</p>` : ''}
      <div class="summary">
        <div>Szenen: <span>${scenes.length}</span></div>
        <div>Seiten: <span>${(totalEighths / 8).toFixed(2)}</span></div>
        <div>Geschätzt: <span>${Math.round(totalMins / 60)}h ${totalMins % 60}min</span></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Szene</th><th>Titel</th><th>Motiv</th><th>INT/EXT</th><th>T/N</th><th>Seiten</th></tr></thead>
        <tbody>
          ${scenes.map((s: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td style="font-weight:bold">${s.scene_number}</td>
              <td>${s.title}</td>
              <td>${s.location_name || '—'}</td>
              <td><span class="badge-${s.int_ext === 'INT' ? 'int' : 'ext'}">${s.int_ext}</span></td>
              <td>${s.day_night}</td>
              <td>${s.eighths}/8</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Drehplan</title>${buildCss(accentColor)}</head><body>
    <div class="header">
      <h1>Drehplan — ${project.title}</h1>
      <p class="meta">Regie: ${project.director} | Produktion: ${project.producer} | Erstellt: ${new Date().toLocaleDateString('de-DE')}</p>
    </div>
    ${daysHtml}
  </body></html>`

  try {
    const pdf = await generatePdf(html, { watermark: req.query.watermark ? String(req.query.watermark) : undefined })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="drehplan-${project.title.replace(/\s+/g, '-')}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// Tagesdispo-HTML — geteilt zwischen PDF-Download-Route und Dispo-Versand
export async function buildTagesdispoHtml(dayId: number | string): Promise<{ html: string; day: any; sheet: any } | null> {
  const day = await db.get(
    'SELECT sd.*, p.title as project_title, p.id as project_id FROM shoot_days sd JOIN projects p ON sd.project_id = p.id WHERE sd.id = ?',
    [dayId]
  ) as any
  if (!day) return null

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [day.project_id]) as any
  const sheet = await db.get(
    'SELECT cs.*, l.name as location_name FROM call_sheets cs LEFT JOIN locations l ON cs.location_id = l.id WHERE cs.shoot_day_id = ?',
    [dayId]
  ) as any

  const entries = sheet
    ? await db.all('SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC', [sheet.id]) as any[]
    : []

  // Cast und Crew getrennt aufbereiten — auf dem Blatt stehen sie in
  // unterschiedlichen Tabellen mit unterschiedlichen Spalten
  const cast: any[] = []
  const crewCalls = new Map<number, number>()

  for (const e of entries) {
    if (e.person_type === 'cast') {
      const p = await db.get(
        'SELECT ca.actor_name as name, ch.name as role FROM cast ca LEFT JOIN characters ch ON ca.character_id = ch.id WHERE ca.id = ?',
        [e.person_id]
      ) as any
      cast.push({ ...e, cast_no: cast.length + 1, name: p?.name || '', role: p?.role || '' })
    } else {
      crewCalls.set(e.person_id, e.call_time)
    }
  }

  // Ganze Crew des Projekts zeigen, nicht nur die disponierte: Auf dem Blatt
  // steht die Abteilung vollstaendig, Call-Zeiten nur wo disponiert.
  const crewRows = await db.all(
    'SELECT id, name, role, department FROM crew WHERE project_id = ? ORDER BY sort_order ASC, id ASC',
    [day.project_id]
  ) as any[]
  const crew = crewRows.map(c => ({ ...c, call_time: crewCalls.get(c.id) ?? null }))

  // Komparserie: die Tabelle heisst extras. Call-Zeiten gibt es dort nicht,
  // deshalb bleibt die Spalte leer und wird am Set eingetragen.
  const background = await db.all(
    'SELECT name, tariff_group as role FROM extras WHERE project_id = ? ORDER BY id ASC LIMIT 30',
    [day.project_id]
  ) as any[]

  const loadScenes = async (id: number | string) => await db.all(`
    SELECT sds.*, s.scene_number, s.title, s.description, s.int_ext, s.day_night, s.eighths,
           s.notes, l.name as location_name
    FROM shoot_day_scenes sds
    JOIN scenes s ON sds.scene_id = s.id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE sds.shoot_day_id = ?
    ORDER BY sds.sort_order
  `, [id]) as any[]

  const scenes = await loadScenes(dayId)

  // Vorschau auf die naechsten beiden Drehtage — steht im Standard unten auf
  // Seite 1, damit die Crew weiss, was auf sie zukommt
  const nextDays = await db.all(
    'SELECT * FROM shoot_days WHERE project_id = ? AND day_number > ? ORDER BY day_number ASC LIMIT 2',
    [day.project_id, day.day_number]
  ) as any[]
  const advance = await Promise.all(nextDays.map(async d => ({ day: d, scenes: await loadScenes(d.id) })))

  const totalRow = await db.get(
    'SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ?', [day.project_id]
  ) as { c: number }

  const html = renderCallSheetHtml({
    project,
    day,
    sheet,
    scenes,
    cast,
    background,
    crew,
    advance,
    totalDays: Number(totalRow?.c) || 1,
  })

  return { html, day, sheet }
}

// GET /api/shoot-days/:dayId/pdf/tagesdispo
router.get('/shoot-days/:dayId/pdf/tagesdispo', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const dayCheck = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
    if (dayCheck && await getUserProjectRole(user.id, dayCheck.project_id) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const built = await buildTagesdispoHtml(req.params.dayId)
  if (!built) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
  const { html, day } = built

  try {
    // Enge Raender und keine CutSheet-Fusszeile: Das Call Sheet bringt seine
    // eigene Geometrie mit und endet unten mit den Unterschriften.
    const pdf = await generatePdf(html, {
      watermark: req.query.watermark ? String(req.query.watermark) : undefined,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      footer: false,
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="tagesdispo-tag${day.day_number}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/projects/:projectId/pdf/stabliste
router.get('/projects/:projectId/pdf/stabliste', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor } = await getProjectSettings(req.params.projectId)
  const crew = await db.all('SELECT * FROM crew WHERE project_id = ? ORDER BY department ASC, sort_order ASC', [req.params.projectId]) as any[]
  const byDept: Record<string, any[]> = {}
  crew.forEach((c: any) => { if (!byDept[c.department]) byDept[c.department] = []; byDept[c.department].push(c) })

  const deptHtml = Object.entries(byDept).map(([dept, members]) => `
    <h2>${dept}</h2>
    <table>
      <thead><tr><th>Name</th><th>Funktion</th><th>E-Mail</th><th>Telefon</th></tr></thead>
      <tbody>${members.map(m => `<tr><td>${m.name}</td><td>${m.role}</td><td>${m.email}</td><td>${m.phone}</td></tr>`).join('')}</tbody>
    </table>
  `).join('')

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Stabliste</title>${buildCss(accentColor)}</head><body>
    <div class="header"><h1>Stabliste — ${project.title}</h1><p class="meta">Regie: ${project.director} | Stand: ${new Date().toLocaleDateString('de-DE')}</p></div>
    ${deptHtml}
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="stabliste-${project.title.replace(/\s+/g, '-')}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/projects/:projectId/pdf/besetzungsliste
router.get('/projects/:projectId/pdf/besetzungsliste', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  const { accentColor } = await getProjectSettings(req.params.projectId)
  const cast = await db.all('SELECT ca.*, ch.name as character_name FROM cast ca LEFT JOIN characters ch ON ca.character_id = ch.id WHERE ca.project_id = ? ORDER BY ch.sort_order ASC', [req.params.projectId]) as any[]

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Besetzungsliste</title>${buildCss(accentColor)}</head><body>
    <div class="header"><h1>Besetzungsliste — ${project?.title}</h1><p class="meta">Stand: ${new Date().toLocaleDateString('de-DE')}</p></div>
    <table>
      <thead><tr><th>Rolle</th><th>Darsteller*in</th><th>E-Mail</th><th>Telefon</th><th>Agentur</th></tr></thead>
      <tbody>${cast.map(c => `<tr><td>${c.character_name || '—'}</td><td>${c.actor_name}</td><td>${c.email}</td><td>${c.phone}</td><td>${c.agency || c.agent}</td></tr>`).join('')}</tbody>
    </table>
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="besetzungsliste.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/projects/:projectId/pdf/motivliste
router.get('/projects/:projectId/pdf/motivliste', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  const { accentColor, currency } = await getProjectSettings(req.params.projectId)
  const locs = await db.all('SELECT * FROM locations WHERE project_id = ? ORDER BY name ASC', [req.params.projectId]) as any[]

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Motivliste</title>${buildCss(accentColor)}</head><body>
    <div class="header"><h1>Motivliste — ${project?.title}</h1><p class="meta">Stand: ${new Date().toLocaleDateString('de-DE')}</p></div>
    <table>
      <thead><tr><th>Motiv</th><th>Adresse</th><th>Kontakt</th><th>Telefon</th><th>Strom</th><th>Tagesmiete</th></tr></thead>
      <tbody>${locs.map(l => `<tr><td>${l.name}</td><td>${l.address}, ${l.zip} ${l.city}</td><td>${l.contact_name}</td><td>${l.contact_phone}</td><td>${l.power_available ? 'Ja' : 'Nein'}</td><td>${fmtMoney(l.rental_fee, currency)}</td></tr>`).join('')}</tbody>
    </table>
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="motivliste.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/projects/:projectId/pdf/kalkulation/:versionId
router.get('/projects/:projectId/pdf/kalkulation/:versionId', async (req, res) => {
  const [project, version] = await Promise.all([
    db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]),
    db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.versionId]),
  ]) as any[]
  if (!version) return res.status(404).json({ data: null, error: 'Kalkulation nicht gefunden' })

  const { accentColor, currency } = await getProjectSettings(req.params.projectId)
  const lines = await db.all('SELECT * FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order ASC, account_code ASC', [req.params.versionId]) as any[]
  const byCategory: Record<string, any[]> = {}
  lines.forEach((l: any) => { if (!byCategory[l.category]) byCategory[l.category] = []; byCategory[l.category].push(l) })

  const catHtml = Object.entries(byCategory).map(([cat, items]) => {
    const catTotal = items.reduce((s: number, i: any) => s + i.total_cents, 0)
    return `
      <h2>${cat} <span style="float:right;font-weight:normal">${fmtMoney(catTotal, currency)}</span></h2>
      <table>
        <thead><tr><th>Konto</th><th>Bezeichnung</th><th>Einheit</th><th style="text-align:right">Menge</th><th style="text-align:right">Einzelpreis</th><th style="text-align:right">Gesamt</th></tr></thead>
        <tbody>${items.map(i => `<tr><td>${i.account_code}</td><td>${i.description}</td><td>${i.unit}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${fmtMoney(i.unit_price_cents, currency)}</td><td style="text-align:right;font-weight:bold">${fmtMoney(i.total_cents, currency)}</td></tr>`).join('')}</tbody>
      </table>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Kalkulation</title>${buildCss(accentColor)}</head><body>
    <div class="header"><h1>Kalkulation — ${project?.title}</h1><p class="meta">${version.name} | Stand: ${new Date().toLocaleDateString('de-DE')}</p></div>
    ${catHtml}
    <div class="total-row">Gesamtbudget: ${fmtMoney(version.total_cents, currency)}</div>
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="kalkulation-${version.name.replace(/\s+/g, '-')}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/shoot-days/:dayId/pdf/tagesbericht
router.get('/shoot-days/:dayId/pdf/tagesbericht', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const day = await db.get('SELECT sd.*, p.title as project_title, p.director, p.id as project_id FROM shoot_days sd JOIN projects p ON sd.project_id = p.id WHERE sd.id = ?', [req.params.dayId]) as any
  if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  if (user.role !== 'admin' && await getUserProjectRole(user.id, day.project_id) === null)
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })

  const [{ accentColor }, report, scenes] = await Promise.all([
    getProjectSettings(day.project_id),
    db.get('SELECT * FROM daily_reports WHERE shoot_day_id = ?', [req.params.dayId]),
    db.all('SELECT sds.*, s.scene_number, s.title, s.eighths, l.name as location_name FROM shoot_day_scenes sds JOIN scenes s ON sds.scene_id = s.id LEFT JOIN locations l ON s.location_id = l.id WHERE sds.shoot_day_id = ? ORDER BY sds.sort_order', [req.params.dayId]),
  ]) as any[]

  const shootDuration = report ? report.wrap - report.call_time : 0
  const lunchBreak = report?.lunch_in && report?.lunch_out ? report.lunch_out - report.lunch_in : 0

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Tagesbericht</title>${buildCss(accentColor)}</head><body>
    <div class="header">
      <h1>Tagesbericht — ${day.project_title}</h1>
      <p class="meta">Drehtag ${day.day_number} | ${day.date} | Regie: ${day.director}</p>
    </div>
    <h2>Zeiten</h2>
    <table>
      <thead><tr><th>Call Time</th><th>First Shot</th><th>Mittagspause</th><th>Drehschluss</th><th>Drehdauer</th>${lunchBreak > 0 ? '<th>Netto</th>' : ''}</tr></thead>
      <tbody><tr>
        <td style="font-weight:bold">${report ? fmtTime(report.call_time) : '—'}</td>
        <td style="font-weight:bold">${report ? fmtTime(report.first_shot) : '—'}</td>
        <td>${report?.lunch_in && report?.lunch_out ? `${fmtTime(report.lunch_in)} – ${fmtTime(report.lunch_out)}` : '—'}</td>
        <td style="font-weight:bold">${report ? fmtTime(report.wrap) : '—'}</td>
        <td>${shootDuration > 0 ? `${Math.floor(shootDuration / 60)}h ${shootDuration % 60}min` : '—'}</td>
        ${lunchBreak > 0 ? `<td>${Math.floor((shootDuration - lunchBreak) / 60)}h ${(shootDuration - lunchBreak) % 60}min</td>` : ''}
      </tr></tbody>
    </table>
    <h2>Produktionsdaten</h2>
    <table>
      <thead><tr><th>Gedrehte Seiten (1/8)</th><th>Setups</th><th>Kamerarollen</th><th>Tonrollen</th></tr></thead>
      <tbody><tr>
        <td style="font-weight:bold">${report?.pages_shot ?? '—'}</td>
        <td>${report?.total_setups ?? '—'}</td>
        <td>${report?.camera_rolls || '—'}</td>
        <td>${report?.sound_rolls || '—'}</td>
      </tr></tbody>
    </table>
    ${scenes.length > 0 ? `
    <h2>Szenen des Tages</h2>
    <table>
      <thead><tr><th>Szene</th><th>Titel</th><th>Motiv</th><th>Seiten</th></tr></thead>
      <tbody>${scenes.map(s => `<tr><td style="font-weight:bold">${s.scene_number}</td><td>${s.title}</td><td>${s.location_name || '—'}</td><td>${s.eighths}/8</td></tr>`).join('')}</tbody>
    </table>` : ''}
    ${report?.production_notes ? `<h2>Drehbericht</h2><p style="line-height:1.6">${report.production_notes}</p>` : ''}
    ${report?.notes ? `<h2>Interne Notizen</h2><p style="line-height:1.6;color:#555">${report.notes}</p>` : ''}
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="tagesbericht-tag${day.day_number}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/projects/:projectId/pdf/shotlist
router.get('/projects/:projectId/pdf/shotlist', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const [{ accentColor }, scenes, allShots] = await Promise.all([
    getProjectSettings(req.params.projectId),
    db.all('SELECT * FROM scenes WHERE project_id = ? ORDER BY sort_order ASC', [req.params.projectId]),
    db.all('SELECT * FROM shots WHERE project_id = ? ORDER BY scene_id ASC, sort_order ASC', [req.params.projectId]),
  ]) as any[]

  const shotsByScene: Record<number, any[]> = {}
  allShots.forEach((s: any) => {
    if (!shotsByScene[s.scene_id]) shotsByScene[s.scene_id] = []
    shotsByScene[s.scene_id].push(s)
  })

  const scenesHtml = scenes.map((scene: any) => {
    const shots = shotsByScene[scene.id] || []
    if (shots.length === 0) return ''
    const sceneDuration = shots.reduce((s: number, sh: any) => s + (sh.duration_seconds || 0), 0)
    return `
      <h2>Szene ${scene.scene_number}: ${scene.title}
        ${sceneDuration > 0 ? `<span style="float:right;font-weight:normal;font-size:11px">${Math.floor(sceneDuration/60)}m ${sceneDuration%60}s</span>` : ''}
      </h2>
      <table>
        <thead><tr><th>Nr.</th><th>Größe</th><th>Bewegung</th><th>Objektiv</th><th>Beschreibung</th><th>Dauer</th></tr></thead>
        <tbody>
          ${shots.map((sh: any) => `
            <tr>
              <td style="font-weight:bold">${sh.shot_number}</td>
              <td>${sh.size || '—'}</td>
              <td>${sh.movement || '—'}</td>
              <td>${sh.lens_mm ? `${sh.lens_mm}mm` : '—'}</td>
              <td>${sh.description || ''}</td>
              <td>${sh.duration_seconds ? `${sh.duration_seconds}s` : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }).join('')

  const totalShots = allShots.length
  const totalDuration = allShots.reduce((s: number, sh: any) => s + (sh.duration_seconds || 0), 0)

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Shotlist</title>${buildCss(accentColor)}</head><body>
    <div class="header">
      <h1>Auflösung & Shotlist — ${project.title}</h1>
      <p class="meta">Regie: ${project.director} | ${totalShots} Einstellungen · ${Math.round(totalDuration / 60)} Min. geplante Drehdauer | Stand: ${new Date().toLocaleDateString('de-DE')}</p>
    </div>
    ${scenesHtml || '<p style="color:#555">Keine Einstellungen erfasst.</p>'}
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="shotlist-${project.title.replace(/\s+/g, '-')}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/projects/:projectId/pdf/equipment
router.get('/projects/:projectId/pdf/equipment', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const [{ accentColor, currency }, lists] = await Promise.all([
    getProjectSettings(req.params.projectId),
    db.all('SELECT * FROM equipment_lists WHERE project_id = ? ORDER BY department ASC, created_at ASC', [req.params.projectId]),
  ]) as any[]

  let listsHtml = ''
  let projectTotal = 0

  for (const list of lists) {
    const items = await db.all('SELECT * FROM equipment_items WHERE equipment_list_id = ? ORDER BY sort_order ASC', [list.id]) as any[]
    const listTotal = items.reduce((s: number, i: any) => s + i.total_cents, 0)
    projectTotal += listTotal

    listsHtml += `
      <h2>${list.name} <small style="font-weight:normal;color:#555">${list.department}</small>
        <span style="float:right;font-weight:normal;font-size:12px">${fmtMoney(listTotal, currency)}</span>
      </h2>
      ${list.notes ? `<p style="color:#555;font-style:italic;margin-bottom:6px">${list.notes}</p>` : ''}
      <table>
        <thead><tr><th>Artikel</th><th>Menge</th><th>Verleiher</th><th style="text-align:right">Tagesmiete</th><th style="text-align:right">Tage</th><th style="text-align:right">Gesamt</th><th>✓</th></tr></thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${i.item}</td>
              <td>${i.quantity}</td>
              <td>${i.supplier || '—'}</td>
              <td style="text-align:right">${fmtMoney(i.rental_per_day_cents, currency)}</td>
              <td style="text-align:right">${i.total_days}</td>
              <td style="text-align:right;font-weight:bold">${fmtMoney(i.total_cents, currency)}</td>
              <td style="text-align:center">${i.checked ? '✓' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Equipmentliste</title>${buildCss(accentColor)}</head><body>
    <div class="header">
      <h1>Equipmentlisten — ${project.title}</h1>
      <p class="meta">Stand: ${new Date().toLocaleDateString('de-DE')} | ${lists.length} Liste(n)</p>
    </div>
    ${listsHtml || '<p style="color:#555">Keine Equipmentlisten vorhanden.</p>'}
    ${lists.length > 1 ? `<div class="total-row">Gesamtkosten Equipment: ${fmtMoney(projectTotal, currency)}</div>` : ''}
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="equipment-${project.title.replace(/\s+/g, '-')}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// ─── Screenplay PDF helpers ───────────────────────────────────────────────────

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// GET /api/projects/:projectId/pdf/screenplay?notes=0|1&paper=a4|letter
//
// Drehbuchsatz nach Industriestandard. Die Paginierung macht screenplayFormat,
// damit Zeilenraster, (MORE)/(CONT'D) und Seitenzahlen exakt sitzen; hier wird
// nur noch gelesen, gruppiert und ausgeliefert.
router.get('/projects/:projectId/pdf/screenplay', async (req, res) => {
  const includeAnnotations = req.query.notes === '1'
  const paper: PaperName = String(req.query.paper || '').toLowerCase() === 'letter' ? 'letter' : 'a4'

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  // Szenen separat laden: Szenen ohne Blöcke fielen bei einem JOIN über die
  // Blöcke komplett aus dem PDF. Ihre Überschrift wird unten synthetisiert.
  const scenes = await db.all(`
    SELECT id, scene_number, title, int_ext, day_night
    FROM scenes
    WHERE project_id = ?
    ORDER BY sort_order ASC, scene_number ASC
  `, [req.params.projectId]) as any[]

  const blocks = await db.all(`
    SELECT sb.scene_id, sb.block_type, sb.content, sb.annotation_color, sb.sort_order
    FROM screenplay_blocks sb
    JOIN scenes s ON sb.scene_id = s.id
    WHERE sb.project_id = ?
    ORDER BY s.sort_order ASC, s.scene_number ASC, sb.sort_order ASC
  `, [req.params.projectId]) as any[]

  const bySceneId = new Map<number, any[]>()
  for (const b of blocks) {
    const list = bySceneId.get(b.scene_id)
    if (list) list.push(b)
    else bySceneId.set(b.scene_id, [b])
  }

  const sceneInputs: SceneInput[] = scenes.map(scene => {
    const own = bySceneId.get(scene.id) ?? []
    if (own.length > 0) return { scene_number: scene.scene_number, blocks: own }

    // Leere Szene: Überschrift aus den Szenen-Metadaten bauen, damit sie im
    // Drehbuch nicht fehlt (gleiches Verhalten wie beim Fountain-Export).
    const intExt = String(scene.int_ext || 'INT').toUpperCase()
    const heading = [
      `${intExt}.`,
      String(scene.title || `SZENE ${scene.scene_number}`).toUpperCase(),
      scene.day_night ? `– ${String(scene.day_night).toUpperCase()}` : '',
    ].filter(Boolean).join(' ')
    return {
      scene_number: scene.scene_number,
      blocks: [{ block_type: 'scene_heading', content: heading }],
    }
  })

  const scriptPages = layoutScreenplay(sceneInputs, { includeAnnotations })

  const front: typeof scriptPages = [
    buildTitlePage({
      title: project.title || 'Drehbuch',
      author: project.director || undefined,
      producer: project.producer || undefined,
      dateLine: `Stand: ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      draftNote: includeAnnotations ? 'Fassung mit Notizen' : undefined,
    }),
  ]
  const synopsisPage = buildTextPage('Synopsis', project.synopsis)
  if (synopsisPage) front.push(synopsisPage)

  const html = renderScreenplayHtml([...front, ...scriptPages], {
    paper,
    docTitle: `${project.title || 'Drehbuch'} – Drehbuch`,
  })

  try {
    const pdf = await generatePdf(html, {
      format: PAPER[paper].cssFormat as 'A4' | 'Letter',
      // Die Geometrie steckt in den Seitenkästen — Chromium darf nichts addieren
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      footer: false,
    })
    const suffix = includeAnnotations ? '-mit-notizen' : ''
    const slug = String(project.title || 'drehbuch').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="drehbuch-${slug}${suffix}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

export default router
