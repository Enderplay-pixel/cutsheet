import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole } from '../middleware/projectAuth'
import { renderCallSheetHtml } from '../lib/callSheetLayout'
import { renderShotlistHtml, groupShots, type GroupMode } from '../lib/shotlist'
import {
  renderDocument, table, stats, section, definitions, badge, paragraph, hint,
  fmtMoney, fmtTime, fmtDuration, fmtDate, fmtDateLong, fmtEighths,
  type Column,
} from '../lib/documentLayout'
import {
  layoutScreenplay,
  renderScreenplayHtml,
  buildTitlePage,
  buildTextPage,
  PAPER,
  type PaperName,
  type SceneInput,
} from '../lib/screenplayFormat'
import { dauer, nettoDrehzeit } from '../lib/drehzeit'

const router = Router()

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
/** Wo zuletzt gesucht wurde - geht in die Fehlermeldung, damit sie diagnostizierbar ist. */
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
  /** Querformat - für breite Layouts wie den Set-Plan. */
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
      // Renderer bei Page.printToPDF abstürzen ("Target closed") - der Grund,
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

// Helper: fetch project settings (accent color + currency)
async function getProjectSettings(projectId: number | string): Promise<{ accentColor: string; currency: string }> {
  const settings = await db.get('SELECT header_color, currency FROM project_settings WHERE project_id = ?', [projectId]) as any
  return {
    accentColor: settings?.header_color || '#f59e0b',
    currency: settings?.currency || 'EUR',
  }
}

/**
 * Dateiname fuer den Download.
 *
 * Anfuehrungszeichen im Projekttitel wuerden sonst den Content-Disposition-Header
 * zerlegen, Umlaute je nach Browser als Kauderwelsch ankommen.
 */
function slug(value: string): string {
  const out = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim().replace(/\s+/g, '-').toLowerCase()
  return out || 'dokument'
}

/**
 * PDF ausliefern - oder den Fehler als JSON melden, damit der Client ihn zeigen kann.
 *
 * Die generische Puppeteer-Fusszeile bleibt aus: renderDocument setzt eine eigene,
 * die zusaetzlich Projekt und Dokumentart nennt. Beide zusammen lagen im selben
 * Band uebereinander. Die Raender entsprechen der @page-Regel der Dokumenthuelle -
 * ein an page.pdf() uebergebener Rand uebersteuert das CSS.
 */
async function sendPdf(res: Response, html: string, filename: string, opts?: PdfOptions) {
  try {
    const pdf = await generatePdf(html, {
      footer: false,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      ...opts,
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
}

/** INT/EXT als Marke - auf einen Blick unterscheidbar. */
function ieBadge(value: string): string {
  return badge(String(value || '—'), String(value).toUpperCase() === 'INT' ? 'warn' : 'info')
}

// All /projects/:projectId/* PDF routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/pdf/drehplan
router.get('/projects/:projectId/pdf/drehplan', async (req: Request, res: Response) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor } = await getProjectSettings(req.params.projectId)
  const days = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number ASC', [req.params.projectId]) as any[]

  let totalScenes = 0
  let totalEighths = 0
  let totalMinutes = 0
  const dayParts: string[] = []

  for (const day of days) {
    const scenes = await db.all(`
      SELECT sds.*, s.scene_number, s.title, s.int_ext, s.day_night, s.eighths, s.estimated_minutes, l.name as location_name
      FROM shoot_day_scenes sds
      JOIN scenes s ON sds.scene_id = s.id
      LEFT JOIN locations l ON s.location_id = l.id
      WHERE sds.shoot_day_id = ?
      ORDER BY sds.sort_order ASC
    `, [day.id]) as any[]

    const dayEighths = scenes.reduce((sum: number, sc: any) => sum + (Number(sc.eighths) || 0), 0)
    const dayMinutes = scenes.reduce((sum: number, sc: any) => sum + (Number(sc.estimated_minutes) || 0), 0)
    totalScenes += scenes.length
    totalEighths += dayEighths
    totalMinutes += dayMinutes

    dayParts.push(section(
      `Drehtag ${day.day_number} - ${fmtDateLong(day.date)}`,
      (day.notes ? definitions([{ label: 'Notiz', value: day.notes, wide: true }]) : '') +
      table({
        columns: [
          { header: '#', value: (_r: any, i: number) => i + 1, width: '4%', muted: true },
          { header: 'Szene', value: (r: any) => r.scene_number, width: '9%' },
          { header: 'Inhalt', value: (r: any) => r.title },
          { header: 'Motiv', value: (r: any) => r.location_name, width: '20%' },
          { header: 'I/E', value: (r: any) => ieBadge(r.int_ext), html: true, align: 'center', width: '7%' },
          { header: 'T/N', value: (r: any) => r.day_night, align: 'center', width: '7%' },
          { header: 'Seiten', value: (r: any) => fmtEighths(r.eighths), align: 'right', width: '8%' },
          { header: 'Zeit', value: (r: any) => fmtDuration(r.estimated_minutes), align: 'right', width: '9%' },
        ],
        rows: scenes,
        empty: 'Für diesen Tag ist noch nichts disponiert.',
      }),
      `${scenes.length} Szenen · ${fmtEighths(dayEighths)} Seiten · ${fmtDuration(dayMinutes)}`
    ))
  }

  // Was noch auf keinem Drehtag steht - beim Disponieren die eigentliche Frage
  const unscheduled = await db.all(`
    SELECT s.*, l.name as location_name
    FROM scenes s
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE s.project_id = ?
      AND NOT EXISTS (SELECT 1 FROM shoot_day_scenes sds WHERE sds.scene_id = s.id)
    ORDER BY s.sort_order ASC
  `, [req.params.projectId]) as any[]

  const openEighths = unscheduled.reduce((sum: number, sc: any) => sum + (Number(sc.eighths) || 0), 0)

  const html = renderDocument({
    kind: 'Drehplan',
    title: project.title,
    project: project.title,
    accent: accentColor,
    subtitle: days.length > 0
      ? `${days.length} Drehtage · ${fmtDate(days[0].date)} bis ${fmtDate(days[days.length - 1].date)}`
      : 'Noch keine Drehtage angelegt',
    meta: [
      { label: 'Regie', value: project.director },
      { label: 'Produktion', value: project.producer },
      { label: 'Stand', value: fmtDate(new Date().toISOString()) },
    ],
    body:
      stats([
        { label: 'Drehtage', value: days.length },
        { label: 'Szenen', value: totalScenes, hint: unscheduled.length > 0 ? `${unscheduled.length} noch offen` : 'vollständig disponiert' },
        { label: 'Seiten', value: fmtEighths(totalEighths) },
        { label: 'Geplante Drehzeit', value: fmtDuration(totalMinutes) },
      ]) +
      (dayParts.join('') || section('Drehtage', table({
        columns: [{ header: 'Drehtag', value: () => '' }], rows: [],
        empty: 'Noch keine Drehtage angelegt.',
      }))) +
      (unscheduled.length > 0 ? section(
        'Noch nicht disponiert',
        table({
          columns: [
            { header: 'Szene', value: (r: any) => r.scene_number, width: '10%' },
            { header: 'Inhalt', value: (r: any) => r.title },
            { header: 'Motiv', value: (r: any) => r.location_name, width: '22%' },
            { header: 'I/E', value: (r: any) => ieBadge(r.int_ext), html: true, align: 'center', width: '8%' },
            { header: 'T/N', value: (r: any) => r.day_night, align: 'center', width: '8%' },
            { header: 'Seiten', value: (r: any) => fmtEighths(r.eighths), align: 'right', width: '9%' },
          ],
          rows: unscheduled,
        }),
        `${unscheduled.length} Szenen · ${fmtEighths(openEighths)} Seiten`
      ) : ''),
  })

  await sendPdf(res, html, `drehplan-${slug(project.title)}.pdf`,
    { watermark: req.query.watermark ? String(req.query.watermark) : undefined })
})

// Tagesdispo-HTML - geteilt zwischen PDF-Download-Route und Dispo-Versand
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

  // Cast und Crew getrennt aufbereiten - auf dem Blatt stehen sie in
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

  // Vorschau auf die naechsten beiden Drehtage - steht im Standard unten auf
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
  for (const c of crew) {
    const dept = c.department || 'Ohne Abteilung'
    if (!byDept[dept]) byDept[dept] = []
    byDept[dept].push(c)
  }

  const columns: Column<any>[] = [
    { header: 'Name', value: (r: any) => r.name, width: '26%' },
    { header: 'Funktion', value: (r: any) => r.role, width: '26%' },
    { header: 'Telefon', value: (r: any) => r.phone, width: '20%' },
    { header: 'E-Mail', value: (r: any) => r.email },
  ]

  const body = Object.entries(byDept).map(([dept, members]) =>
    section(dept, table({ columns, rows: members }), `${members.length} Personen`)
  ).join('')

  const html = renderDocument({
    kind: 'Stabliste',
    title: project.title,
    project: project.title,
    accent: accentColor,
    subtitle: `${crew.length} Personen in ${Object.keys(byDept).length} Abteilungen`,
    meta: [
      { label: 'Regie', value: project.director },
      { label: 'Produktion', value: project.producer },
      { label: 'Stand', value: fmtDate(new Date().toISOString()) },
    ],
    footnote: 'Kontaktdaten - vertraulich, nur für den internen Gebrauch',
    body: body || section('Stab', table({ columns, rows: [], empty: 'Noch keine Crew erfasst.' })),
  })

  await sendPdf(res, html, `stabliste-${slug(project.title)}.pdf`)
})

// GET /api/projects/:projectId/pdf/besetzungsliste
router.get('/projects/:projectId/pdf/besetzungsliste', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor } = await getProjectSettings(req.params.projectId)
  const cast = await db.all(
    'SELECT ca.*, ch.name as character_name FROM cast ca LEFT JOIN characters ch ON ca.character_id = ch.id WHERE ca.project_id = ? ORDER BY ch.sort_order ASC',
    [req.params.projectId]
  ) as any[]

  const html = renderDocument({
    kind: 'Besetzungsliste',
    title: project.title,
    project: project.title,
    accent: accentColor,
    subtitle: `${cast.length} Rollen besetzt`,
    meta: [
      { label: 'Regie', value: project.director },
      { label: 'Stand', value: fmtDate(new Date().toISOString()) },
    ],
    footnote: 'Kontaktdaten - vertraulich, nur für den internen Gebrauch',
    body: table({
      columns: [
        { header: 'Rolle', value: (r: any) => r.character_name, width: '20%' },
        { header: 'Darsteller*in', value: (r: any) => r.actor_name, width: '22%' },
        { header: 'Telefon', value: (r: any) => r.phone, width: '17%' },
        { header: 'E-Mail', value: (r: any) => r.email },
        { header: 'Agentur', value: (r: any) => r.agency || r.agent, width: '18%' },
      ],
      rows: cast,
      empty: 'Noch keine Rollen besetzt.',
    }),
  })

  await sendPdf(res, html, `besetzungsliste-${slug(project.title)}.pdf`)
})

// GET /api/projects/:projectId/pdf/motivliste
router.get('/projects/:projectId/pdf/motivliste', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor, currency } = await getProjectSettings(req.params.projectId)
  const locs = await db.all('SELECT * FROM locations WHERE project_id = ? ORDER BY name ASC', [req.params.projectId]) as any[]

  const totalFee = locs.reduce((sum: number, l: any) => sum + (Number(l.rental_fee) || 0), 0)

  /** Adresse zusammensetzen - fehlende Teile weglassen statt "null, null" zu drucken. */
  const address = (l: any) => [l.address, [l.zip, l.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  const html = renderDocument({
    kind: 'Motivliste',
    title: project.title,
    project: project.title,
    accent: accentColor,
    subtitle: `${locs.length} Motive`,
    meta: [{ label: 'Stand', value: fmtDate(new Date().toISOString()) }],
    body:
      stats([
        { label: 'Motive', value: locs.length },
        { label: 'Mit Stromanschluss', value: locs.filter((l: any) => l.power_available).length },
        { label: 'Mieten gesamt', value: fmtMoney(totalFee, currency) },
      ]) +
      table({
        columns: [
          { header: 'Motiv', value: (r: any) => r.name, width: '20%' },
          { header: 'Adresse', value: (r: any) => address(r), width: '26%' },
          { header: 'Kontakt', value: (r: any) => r.contact_name, width: '16%' },
          { header: 'Telefon', value: (r: any) => r.contact_phone, width: '15%' },
          { header: 'Strom', value: (r: any) => (r.power_available ? 'Ja' : 'Nein'), align: 'center', width: '8%' },
          { header: 'Tagesmiete', value: (r: any) => fmtMoney(r.rental_fee, currency), align: 'right', width: '15%' },
        ],
        rows: locs,
        empty: 'Noch keine Motive erfasst.',
        footer: totalFee > 0 ? [{ label: 'Mieten gesamt', value: fmtMoney(totalFee, currency) }] : undefined,
      }),
  })

  await sendPdf(res, html, `motivliste-${slug(project.title)}.pdf`)
})

// GET /api/projects/:projectId/pdf/kalkulation/:versionId
router.get('/projects/:projectId/pdf/kalkulation/:versionId', async (req, res) => {
  const [project, version] = await Promise.all([
    db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]),
    db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.versionId]),
  ]) as any[]
  if (!version) return res.status(404).json({ data: null, error: 'Kalkulation nicht gefunden' })

  const { accentColor, currency } = await getProjectSettings(req.params.projectId)
  const lines = await db.all(
    'SELECT * FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order ASC, account_code ASC',
    [req.params.versionId]
  ) as any[]

  const byCategory: Record<string, any[]> = {}
  for (const l of lines) {
    const cat = l.category || 'Ohne Kategorie'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(l)
  }

  const catTotals = Object.entries(byCategory).map(([cat, items]) => ({
    cat,
    items,
    total: items.reduce((sum: number, i: any) => sum + (Number(i.total_cents) || 0), 0),
  }))
  const grandTotal = catTotals.reduce((sum, c) => sum + c.total, 0)
  const share = (cents: number) => (grandTotal > 0 ? `${Math.round((cents / grandTotal) * 100)} %` : '—')

  // Übersicht zuerst: die Frage "wo steckt das Geld?" ohne Blättern beantworten
  const overview = section('Übersicht', table({
    columns: [
      { header: 'Kategorie', value: (r: any) => r.cat },
      { header: 'Positionen', value: (r: any) => r.items.length, align: 'right', width: '14%' },
      { header: 'Anteil', value: (r: any) => share(r.total), align: 'right', width: '12%' },
      { header: 'Summe', value: (r: any) => fmtMoney(r.total, currency), align: 'right', width: '20%' },
    ],
    rows: catTotals,
    empty: 'Noch keine Positionen erfasst.',
    footer: [{ label: 'Gesamtbudget', value: fmtMoney(grandTotal, currency) }],
  }))

  const detail = catTotals.map(({ cat, items, total }) => section(cat, table({
    columns: [
      { header: 'Konto', value: (r: any) => r.account_code, width: '10%' },
      { header: 'Bezeichnung', value: (r: any) => r.description },
      { header: 'Einheit', value: (r: any) => r.unit, width: '11%' },
      { header: 'Menge', value: (r: any) => r.quantity, align: 'right', width: '9%' },
      { header: 'Einzelpreis', value: (r: any) => fmtMoney(r.unit_price_cents, currency), align: 'right', width: '15%' },
      { header: 'Gesamt', value: (r: any) => fmtMoney(r.total_cents, currency), align: 'right', width: '15%' },
    ],
    rows: items,
    footer: [{ label: `Summe ${cat}`, value: fmtMoney(total, currency) }],
  }), `${share(total)} des Budgets`)).join('')

  const html = renderDocument({
    kind: 'Kalkulation',
    title: project?.title || 'Kalkulation',
    project: project?.title,
    accent: accentColor,
    subtitle: version.name,
    meta: [
      { label: 'Fassung', value: version.name },
      { label: 'Stand', value: fmtDate(new Date().toISOString()) },
    ],
    body:
      stats([
        { label: 'Gesamtbudget', value: fmtMoney(grandTotal, currency) },
        { label: 'Kategorien', value: catTotals.length },
        { label: 'Positionen', value: lines.length },
      ]) + overview + detail,
  })

  await sendPdf(res, html, `kalkulation-${slug(version.name)}.pdf`)
})

// GET /api/shoot-days/:dayId/pdf/tagesbericht
router.get('/shoot-days/:dayId/pdf/tagesbericht', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const day = await db.get('SELECT sd.*, p.title as project_title, p.director, p.producer, p.id as project_id FROM shoot_days sd JOIN projects p ON sd.project_id = p.id WHERE sd.id = ?', [req.params.dayId]) as any
  if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  if (user.role !== 'admin' && await getUserProjectRole(user.id, day.project_id) === null)
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })

  const [{ accentColor }, report, scenes] = await Promise.all([
    getProjectSettings(day.project_id),
    db.get('SELECT * FROM daily_reports WHERE shoot_day_id = ?', [req.params.dayId]),
    db.all('SELECT sds.*, s.scene_number, s.title, s.eighths, l.name as location_name FROM shoot_day_scenes sds JOIN scenes s ON sds.scene_id = s.id LEFT JOIN locations l ON s.location_id = l.id WHERE sds.shoot_day_id = ? ORDER BY sds.sort_order', [req.params.dayId]),
  ]) as any[]

  // dauer() trägt den Tageswechsel: ein Nachtdreh mit Wrap um 02:00 steht als
  // 120 in der Datenbank und ergab vorher eine negative Drehzeit.
  const gross = dauer(report?.call_time, report?.wrap) ?? 0
  const lunch = dauer(report?.lunch_in, report?.lunch_out) ?? 0
  const netto = nettoDrehzeit(report?.call_time, report?.wrap, report?.lunch_in, report?.lunch_out) ?? 0

  const plannedEighths = scenes.reduce((sum: number, sc: any) => sum + (Number(sc.eighths) || 0), 0)

  const html = renderDocument({
    kind: 'Tagesbericht',
    title: `Drehtag ${day.day_number}`,
    project: day.project_title,
    accent: accentColor,
    subtitle: fmtDateLong(day.date),
    meta: [
      { label: 'Projekt', value: day.project_title },
      { label: 'Regie', value: day.director },
      { label: 'Stand', value: fmtDate(new Date().toISOString()) },
    ],
    body:
      stats([
        { label: 'Drehzeit brutto', value: fmtDuration(gross) },
        { label: 'Netto ohne Pause', value: fmtDuration(netto), hint: lunch > 0 ? `${fmtDuration(lunch)} Pause` : 'keine Pause erfasst' },
        { label: 'Gedrehte Seiten', value: fmtEighths(report?.pages_shot) , hint: `${fmtEighths(plannedEighths)} geplant` },
        { label: 'Setups', value: report?.total_setups ?? '—' },
      ]) +
      section('Zeiten', definitions([
        { label: 'Crew Call', value: fmtTime(report?.call_time) },
        { label: 'First Shot', value: fmtTime(report?.first_shot) },
        { label: 'Mittagspause', value: lunch > 0 ? `${fmtTime(report.lunch_in)} – ${fmtTime(report.lunch_out)}` : null },
        { label: 'Drehschluss', value: fmtTime(report?.wrap) },
      ]) || hint('Für diesen Tag sind noch keine Zeiten erfasst.')) +
      section('Material', definitions([
        { label: 'Kamerarollen', value: report?.camera_rolls },
        { label: 'Tonrollen', value: report?.sound_rolls },
      ]) || hint('Kein Material erfasst.')) +
      section('Szenen des Tages', table({
        columns: [
          { header: 'Szene', value: (r: any) => r.scene_number, width: '12%' },
          { header: 'Inhalt', value: (r: any) => r.title },
          { header: 'Motiv', value: (r: any) => r.location_name, width: '25%' },
          { header: 'Seiten', value: (r: any) => fmtEighths(r.eighths), align: 'right', width: '12%' },
        ],
        rows: scenes,
        empty: 'Keine Szenen disponiert.',
      }), `${scenes.length} Szenen · ${fmtEighths(plannedEighths)} Seiten geplant`) +
      (paragraph(report?.production_notes) ? section('Drehbericht', paragraph(report.production_notes)) : '') +
      (paragraph(report?.notes) ? section('Interne Notizen', paragraph(report.notes, true)) : ''),
  })

  await sendPdf(res, html, `tagesbericht-tag${day.day_number}-${slug(day.project_title)}.pdf`)
})

// GET /api/projects/:projectId/pdf/shotlist?nach=szene|drehtag
router.get('/projects/:projectId/pdf/shotlist', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const mode: GroupMode = String(req.query.nach || '') === 'drehtag' ? 'drehtag' : 'szene'

  const [{ accentColor }, scenes, days, shots] = await Promise.all([
    getProjectSettings(req.params.projectId),
    db.all(`
      SELECT s.*, l.name as location_name
      FROM scenes s
      LEFT JOIN locations l ON s.location_id = l.id
      WHERE s.project_id = ?
      ORDER BY s.sort_order ASC
    `, [req.params.projectId]),
    db.all('SELECT id, day_number, date FROM shoot_days WHERE project_id = ? ORDER BY day_number ASC', [req.params.projectId]),
    db.all('SELECT * FROM shots WHERE project_id = ? ORDER BY sort_order ASC, id ASC', [req.params.projectId]),
  ]) as any[]

  // Storyboards als Daten-URI einbetten: Der Druck laeuft in einem eigenen
  // Browser ohne Sitzung, ein Link auf /uploads/... bliebe leer. Fehlt eine
  // Datei - auf Render ueberlebt der Speicher keinen Deploy -, bleibt das Feld
  // leer statt das PDF scheitern zu lassen.
  const storyboardDir = pathMod.join(__dirname, '../../uploads/storyboard')
  for (const shot of shots as any[]) {
    if (!shot.storyboard_url) continue
    try {
      const file = pathMod.join(storyboardDir, pathMod.basename(String(shot.storyboard_url)))
      if (fileExists(file)) {
        const ext = pathMod.extname(file).toLowerCase().replace('.', '') || 'png'
        shot.storyboard = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${fsMod.readFileSync(file).toString('base64')}`
      }
    } catch (err: any) {
      console.warn('[shotlist] Storyboard nicht lesbar:', err?.message)
    }
  }

  const html = renderShotlistHtml({
    projectTitle: project.title,
    director: project.director,
    dop: project.dop,
    accent: accentColor,
    mode,
    groups: groupShots(shots, scenes, days, mode),
    allShots: shots,
    scenes,
    days,
  })

  await sendPdf(res, html, `shotlist-${mode}-${slug(project.title)}.pdf`)
})

// GET /api/projects/:projectId/pdf/equipment
router.get('/projects/:projectId/pdf/equipment', async (req, res) => {
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const [{ accentColor, currency }, lists] = await Promise.all([
    getProjectSettings(req.params.projectId),
    db.all('SELECT * FROM equipment_lists WHERE project_id = ? ORDER BY department ASC, created_at ASC', [req.params.projectId]),
  ]) as any[]

  const columns: Column<any>[] = [
    { header: 'Artikel', value: (r: any) => r.item },
    { header: 'Menge', value: (r: any) => r.quantity, align: 'right', width: '8%' },
    { header: 'Verleiher', value: (r: any) => r.supplier, width: '18%' },
    { header: 'Tagesmiete', value: (r: any) => fmtMoney(r.rental_per_day_cents, currency), align: 'right', width: '14%' },
    { header: 'Tage', value: (r: any) => r.total_days, align: 'right', width: '7%' },
    { header: 'Gesamt', value: (r: any) => fmtMoney(r.total_cents, currency), align: 'right', width: '14%' },
    { header: 'Da', value: (r: any) => (r.checked ? '✓' : ''), align: 'center', width: '5%' },
  ]

  let projectTotal = 0
  let itemCount = 0
  let openCount = 0
  const parts: string[] = []

  for (const list of lists) {
    const items = await db.all('SELECT * FROM equipment_items WHERE equipment_list_id = ? ORDER BY sort_order ASC', [list.id]) as any[]
    const listTotal = items.reduce((sum: number, i: any) => sum + (Number(i.total_cents) || 0), 0)
    projectTotal += listTotal
    itemCount += items.length
    openCount += items.filter((i: any) => !i.checked).length

    parts.push(section(
      list.name,
      (list.notes ? definitions([{ label: 'Notiz', value: list.notes, wide: true }]) : '') +
      table({ columns, rows: items, footer: [{ label: `Summe ${list.name}`, value: fmtMoney(listTotal, currency) }] }),
      [list.department, `${items.length} Positionen`, fmtMoney(listTotal, currency)].filter(Boolean).join(' · ')
    ))
  }

  const html = renderDocument({
    kind: 'Equipmentliste',
    title: project.title,
    project: project.title,
    accent: accentColor,
    subtitle: `${lists.length} Listen · ${itemCount} Positionen`,
    meta: [{ label: 'Stand', value: fmtDate(new Date().toISOString()) }],
    body:
      stats([
        { label: 'Positionen', value: itemCount, hint: openCount > 0 ? `${openCount} noch offen` : 'alles abgehakt' },
        { label: 'Listen', value: lists.length },
        { label: 'Kosten gesamt', value: fmtMoney(projectTotal, currency) },
      ]) +
      (parts.join('') || section('Equipment', table({ columns, rows: [], empty: 'Noch keine Equipmentlisten vorhanden.' }))),
  })

  await sendPdf(res, html, `equipment-${slug(project.title)}.pdf`)
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
      // Die Geometrie steckt in den Seitenkästen - Chromium darf nichts addieren
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
