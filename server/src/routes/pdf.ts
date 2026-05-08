import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole } from '../middleware/projectAuth'

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

// Resolve chromium executable — prefer PATH lookup (works in Nix), fall back to known paths
function resolveChromium(): string | undefined {
  const fs = require('fs')
  const { execSync } = require('child_process')

  // 1. Try shell PATH — Nix puts chromium on PATH correctly
  try {
    const found = execSync(
      'which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || which google-chrome 2>/dev/null',
      { encoding: 'utf8', timeout: 3000 }
    ).trim().split('\n')[0]
    if (found) { console.log('[PDF] Chromium via which:', found); return found }
  } catch { /* shell not available */ }

  // 2. Env var + known static paths
  const exists = (p: string) => { try { return fs.existsSync(p) } catch { return false } }
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/root/.nix-profile/bin/chromium',
    '/nix/var/nix/profiles/default/bin/chromium',
    '/run/current-system/sw/bin/chromium',
  ].filter(Boolean) as string[]
  const found = candidates.find(exists)
  console.log('[PDF] Chromium static lookup:', found ?? 'NONE')
  return found
}

// Generic PDF generator using puppeteer (lazily loaded)
async function generatePdf(html: string): Promise<Buffer> {
  const puppeteer = require('puppeteer')
  const executablePath = resolveChromium()
  console.log('[PDF] Launching puppeteer, executablePath:', executablePath ?? '(bundled)')
  const launchOptions: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
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
    throw new Error(`Chromium konnte nicht gestartet werden: ${launchErr.message}`)
  }
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } })
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
function getProjectSettings(projectId: number | string): { accentColor: string; currency: string } {
  const settings = db.prepare('SELECT header_color, currency FROM project_settings WHERE project_id = ?').get(projectId) as any
  return {
    accentColor: settings?.header_color || '#f59e0b',
    currency: settings?.currency || 'EUR',
  }
}

// All /projects/:projectId/* PDF routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/pdf/drehplan
router.get('/projects/:projectId/pdf/drehplan', async (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor } = getProjectSettings(req.params.projectId)
  const days = db.prepare('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number ASC').all(req.params.projectId) as any[]

  let daysHtml = ''
  for (const day of days) {
    const scenes = db.prepare(`
      SELECT sds.*, s.scene_number, s.title, s.int_ext, s.day_night, s.eighths, s.estimated_minutes, l.name as location_name
      FROM shoot_day_scenes sds
      JOIN scenes s ON sds.scene_id = s.id
      LEFT JOIN locations l ON s.location_id = l.id
      WHERE sds.shoot_day_id = ?
      ORDER BY sds.sort_order ASC
    `).all(day.id) as any[]

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
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="drehplan-${project.title.replace(/\s+/g, '-')}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/shoot-days/:dayId/pdf/tagesdispo
router.get('/shoot-days/:dayId/pdf/tagesdispo', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const day = db.prepare('SELECT project_id FROM shoot_days WHERE id = ?').get(req.params.dayId) as any
    if (day && getUserProjectRole(user.id, day.project_id) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const day = db.prepare('SELECT sd.*, p.title as project_title, p.id as project_id FROM shoot_days sd JOIN projects p ON sd.project_id = p.id WHERE sd.id = ?').get(req.params.dayId) as any
  if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  const { accentColor } = getProjectSettings(day.project_id)
  const sheet = db.prepare('SELECT cs.*, l.name as location_name FROM call_sheets cs LEFT JOIN locations l ON cs.location_id = l.id WHERE cs.shoot_day_id = ?').get(req.params.dayId) as any
  const entries = sheet ? db.prepare('SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC').all(sheet.id) as any[] : []

  const enrichedEntries = entries.map((e: any) => {
    if (e.person_type === 'cast') {
      const p = db.prepare('SELECT ca.actor_name as name, ch.name as role FROM cast ca LEFT JOIN characters ch ON ca.character_id = ch.id WHERE ca.id = ?').get(e.person_id) as any
      return { ...e, name: p?.name || '—', role: p?.role || '' }
    } else {
      const p = db.prepare('SELECT name, role FROM crew WHERE id = ?').get(e.person_id) as any
      return { ...e, name: p?.name || '—', role: p?.role || '' }
    }
  })

  const scenes = db.prepare(`SELECT sds.*, s.scene_number, s.title, s.eighths, l.name as location_name FROM shoot_day_scenes sds JOIN scenes s ON sds.scene_id = s.id LEFT JOIN locations l ON s.location_id = l.id WHERE sds.shoot_day_id = ? ORDER BY sds.sort_order`).all(req.params.dayId) as any[]

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Tagesdisposition</title>${buildCss(accentColor)}</head><body>
    <div class="header">
      <h1>Tagesdisposition — ${day.project_title}</h1>
      <p class="meta">Drehtag ${day.day_number} | ${day.date} | Allgemeiner Drehbeginn: ${sheet ? fmtTime(sheet.general_call) : '—'} | Drehbeginn: ${sheet ? fmtTime(sheet.shooting_call) : '—'}</p>
      ${sheet?.location_name ? `<p class="meta">Motiv: ${sheet.location_name}</p>` : ''}
      ${sheet?.weather_forecast ? `<p class="meta">Wetter: ${sheet.weather_forecast} | Sonnenaufgang: ${sheet.sunrise} | -untergang: ${sheet.sunset}</p>` : ''}
    </div>
    <h2>Szenen des Tages</h2>
    <table>
      <thead><tr><th>#</th><th>Szene</th><th>Titel</th><th>Motiv</th><th>Seiten</th></tr></thead>
      <tbody>${scenes.map((s: any, i: number) => `<tr><td>${i+1}</td><td>${s.scene_number}</td><td>${s.title}</td><td>${s.location_name || '—'}</td><td>${s.eighths}/8</td></tr>`).join('')}</tbody>
    </table>
    <h2>Callsheet</h2>
    <table>
      <thead><tr><th>Name</th><th>Funktion</th><th>Call Time</th><th>Abholort</th><th>Bemerkung</th></tr></thead>
      <tbody>${enrichedEntries.map((e: any) => `<tr><td>${e.name}</td><td>${e.role}</td><td style="font-weight:bold">${fmtTime(e.call_time)}</td><td>${e.pickup_location || '—'}</td><td>${e.notes || ''}</td></tr>`).join('')}</tbody>
    </table>
    ${sheet?.notes ? `<h2>Notizen</h2><p>${sheet.notes}</p>` : ''}
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="tagesdispo-tag${day.day_number}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// GET /api/projects/:projectId/pdf/stabliste
router.get('/projects/:projectId/pdf/stabliste', async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor } = getProjectSettings(req.params.projectId)
  const crew = db.prepare('SELECT * FROM crew WHERE project_id = ? ORDER BY department ASC, sort_order ASC').all(req.params.projectId) as any[]
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
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
  const { accentColor } = getProjectSettings(req.params.projectId)
  const cast = db.prepare('SELECT ca.*, ch.name as character_name FROM cast ca LEFT JOIN characters ch ON ca.character_id = ch.id WHERE ca.project_id = ? ORDER BY ch.sort_order ASC').all(req.params.projectId) as any[]

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
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
  const { accentColor, currency } = getProjectSettings(req.params.projectId)
  const locs = db.prepare('SELECT * FROM locations WHERE project_id = ? ORDER BY name ASC').all(req.params.projectId) as any[]

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
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
  const version = db.prepare('SELECT * FROM budget_versions WHERE id = ?').get(req.params.versionId) as any
  if (!version) return res.status(404).json({ data: null, error: 'Kalkulation nicht gefunden' })

  const { accentColor, currency } = getProjectSettings(req.params.projectId)
  const lines = db.prepare('SELECT * FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order ASC, account_code ASC').all(req.params.versionId) as any[]
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

  const day = db.prepare('SELECT sd.*, p.title as project_title, p.director, p.id as project_id FROM shoot_days sd JOIN projects p ON sd.project_id = p.id WHERE sd.id = ?').get(req.params.dayId) as any
  if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  if (user.role !== 'admin' && getUserProjectRole(user.id, day.project_id) === null)
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })

  const { accentColor } = getProjectSettings(day.project_id)
  const report = db.prepare('SELECT * FROM daily_reports WHERE shoot_day_id = ?').get(req.params.dayId) as any
  const scenes = db.prepare(`SELECT sds.*, s.scene_number, s.title, s.eighths, l.name as location_name FROM shoot_day_scenes sds JOIN scenes s ON sds.scene_id = s.id LEFT JOIN locations l ON s.location_id = l.id WHERE sds.shoot_day_id = ? ORDER BY sds.sort_order`).all(req.params.dayId) as any[]

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
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor } = getProjectSettings(req.params.projectId)
  const scenes = db.prepare('SELECT * FROM scenes WHERE project_id = ? ORDER BY sort_order ASC').all(req.params.projectId) as any[]
  const allShots = db.prepare('SELECT * FROM shots WHERE project_id = ? ORDER BY scene_id ASC, sort_order ASC').all(req.params.projectId) as any[]

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
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor, currency } = getProjectSettings(req.params.projectId)
  const lists = db.prepare('SELECT * FROM equipment_lists WHERE project_id = ? ORDER BY department ASC, created_at ASC').all(req.params.projectId) as any[]

  let listsHtml = ''
  let projectTotal = 0

  for (const list of lists) {
    const items = db.prepare('SELECT * FROM equipment_items WHERE equipment_list_id = ? ORDER BY sort_order ASC').all(list.id) as any[]
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

// GET /api/projects/:projectId/pdf/screenplay
router.get('/projects/:projectId/pdf/screenplay', async (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const { accentColor } = getProjectSettings(req.params.projectId)
  const blocks = db.prepare(`
    SELECT sb.*, s.scene_number, s.title, s.int_ext, s.day_night
    FROM screenplay_blocks sb
    JOIN scenes s ON sb.scene_id = s.id
    WHERE sb.project_id = ?
    ORDER BY s.sort_order ASC, sb.sort_order ASC
  `).all(req.params.projectId) as any[]

  // Group blocks by scene
  const sceneMap: Record<number, { scene_number: string; title: string; int_ext: string; day_night: string; blocks: any[] }> = {}
  for (const b of blocks) {
    if (!sceneMap[b.scene_id]) sceneMap[b.scene_id] = { scene_number: b.scene_number, title: b.title, int_ext: b.int_ext, day_night: b.day_night, blocks: [] }
    sceneMap[b.scene_id].blocks.push(b)
  }

  const typeStyle: Record<string, string> = {
    scene_heading: 'font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;margin-top:20px;',
    action: 'margin:8px 0;line-height:1.6;',
    dialogue: 'margin:6px auto;max-width:70%;line-height:1.6;',
    character: 'font-weight:bold;text-align:center;text-transform:uppercase;margin-top:12px;',
    parenthetical: 'text-align:center;font-style:italic;color:#555;',
    transition: 'text-align:right;text-transform:uppercase;font-weight:bold;margin:12px 0;',
    note: 'color:#888;font-style:italic;border-left:3px solid #ddd;padding-left:8px;',
  }

  const scenesHtml = Object.values(sceneMap).map(scene => {
    const blocksHtml = scene.blocks.map(b => {
      const style = typeStyle[b.block_type] || 'margin:4px 0;'
      return `<div style="${style}font-family:Courier,monospace;font-size:12px">${b.content || ''}</div>`
    }).join('')
    return `
      <div style="page-break-inside:avoid;margin-bottom:16px;">
        <div style="font-weight:bold;font-size:11px;color:${accentColor};text-transform:uppercase;letter-spacing:0.08em;padding:4px 0;border-bottom:1px solid #eee;margin-bottom:8px;">
          ${scene.scene_number}. ${scene.title} — ${scene.int_ext} / ${scene.day_night}
        </div>
        ${blocksHtml}
      </div>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Drehbuch</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Courier, monospace; font-size: 12px; color: #111; background: #fff; padding: 20mm; max-width: 210mm; margin: 0 auto; }
      .header { border-bottom: 3px solid ${accentColor}; margin-bottom: 24px; padding-bottom: 12px; }
      h1 { font-size: 22px; font-family: Arial, sans-serif; }
      .meta { color: #555; font-size: 10px; font-family: Arial, sans-serif; margin-top: 4px; }
    </style>
  </head><body>
    <div class="header">
      <h1>${project.title}</h1>
      <p class="meta">Regie: ${project.director || '—'} · Produzent: ${project.producer || '—'} · Stand: ${new Date().toLocaleDateString('de-DE')}</p>
    </div>
    ${scenesHtml || '<p style="color:#555">Kein Drehbuchinhalt vorhanden.</p>'}
  </body></html>`

  try {
    const pdf = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="drehbuch-${project.title.replace(/\s+/g, '-')}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

export default router
