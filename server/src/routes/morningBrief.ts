import { Router, Request, Response } from 'express'
import { db } from '../db'
import puppeteer from 'puppeteer'

const router = Router()

function resolveChromium(): string | undefined {
  const fs = require('fs')
  const { execSync } = require('child_process')
  try {
    const found = execSync(
      'which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || which google-chrome 2>/dev/null',
      { encoding: 'utf8', timeout: 3000 }
    ).trim().split('\n')[0]
    if (found) return found
  } catch { /* */ }
  const exists = (p: string) => { try { return fs.existsSync(p) } catch { return false } }
  return [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser', '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
    '/root/.nix-profile/bin/chromium',
  ].filter(Boolean).find(exists as any)
}

function fmtTime(mins: number) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// GET /api/shoot-days/:dayId/morning-brief
// Returns JSON data for the briefing
router.get('/shoot-days/:dayId/morning-brief', async (req: Request, res: Response) => {
  const { dayId } = req.params
  const shootDay = await db.get('SELECT * FROM shoot_days WHERE id = ?', [dayId]) as any
  if (!shootDay) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [shootDay.project_id]) as any

  // Scenes for the day
  const scenes = await db.all(`
    SELECT s.*, l.name as location_name, l.address, l.city, l.zip, l.lat, l.lng
    FROM shoot_day_scenes sds
    JOIN scenes s ON s.id = sds.scene_id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE sds.shoot_day_id = ?
    ORDER BY sds.sort_order ASC
  `, [dayId]) as any[]

  // Call sheet
  const callSheet = await db.get('SELECT * FROM call_sheets WHERE shoot_day_id = ?', [dayId]) as any
  const entries = callSheet
    ? await db.all('SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC', [callSheet.id]) as any[]
    : []

  // Enrich entries with names
  const enrichedEntries = await Promise.all(entries.map(async (e: any) => {
    if (e.person_type === 'cast') {
      const p = await db.get('SELECT c.actor_name as name, ch.name as role FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?', [e.person_id]) as any
      return { ...e, name: p?.name || '', role: p?.role || '' }
    }
    const p = await db.get('SELECT name, role FROM crew WHERE id = ?', [e.person_id]) as any
    return { ...e, name: p?.name || '', role: p?.role || '' }
  }))

  // First / last call times
  const callTimes = enrichedEntries.map((e: any) => e.call_time).filter(Boolean)
  const firstCall = callTimes.length > 0 ? Math.min(...callTimes) : null
  const generalCall = callSheet?.general_call ?? firstCall

  // Sun data (use first scene's location)
  let sunData: any = null
  const firstLocation = scenes.find((s: any) => s.lat && s.lng)
  if (firstLocation) {
    try {
      const SunCalc = require('suncalc')
      const date = new Date(shootDay.date)
      const times = SunCalc.getTimes(date, firstLocation.lat, firstLocation.lng)
      sunData = {
        sunrise: times.sunrise,
        sunset: times.sunset,
        golden_hour_morning: times.goldenHourEnd,
        golden_hour_evening: times.goldenHour,
      }
    } catch { /* suncalc optional */ }
  }

  // Catering
  const cateringPrefs = await db.all(`
    SELECT cp.*, c.actor_name as cast_name, cr.name as crew_name
    FROM catering_preferences cp
    LEFT JOIN "cast" c ON cp.person_type = 'cast' AND cp.person_id = c.id
    LEFT JOIN crew cr ON cp.person_type = 'crew' AND cp.person_id = cr.id
    WHERE cp.project_id = ?
  `, [shootDay.project_id]) as any[]

  const cateringSummary: Record<string, number> = {}
  for (const pref of cateringPrefs) {
    if (pref.dietary && pref.dietary !== 'keine') {
      cateringSummary[pref.dietary] = (cateringSummary[pref.dietary] || 0) + 1
    }
  }

  // Unique locations today
  const uniqueLocations = scenes.reduce((acc: any[], s: any) => {
    if (s.location_name && !acc.find(l => l.name === s.location_name)) {
      acc.push({ name: s.location_name, address: s.address, city: s.city, zip: s.zip })
    }
    return acc
  }, [])

  res.json({
    data: {
      project: { title: project.title, director: project.director },
      shoot_day: { id: shootDay.id, day_number: shootDay.day_number, date: shootDay.date, status: shootDay.status, notes: shootDay.notes },
      general_call: generalCall,
      first_scene: scenes[0] || null,
      last_scene: scenes[scenes.length - 1] || null,
      total_scenes: scenes.length,
      total_pages: scenes.reduce((sum: number, s: any) => sum + (s.eighths || 0), 0) / 8,
      locations: uniqueLocations,
      crew_count: enrichedEntries.filter((e: any) => e.person_type === 'crew').length,
      cast_count: enrichedEntries.filter((e: any) => e.person_type === 'cast').length,
      weather: callSheet?.weather_forecast || '',
      sunrise: callSheet?.sunrise || (sunData ? new Date(sunData.sunrise).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''),
      sunset: callSheet?.sunset || (sunData ? new Date(sunData.sunset).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''),
      golden_hour_morning: sunData ? new Date(sunData.golden_hour_morning).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
      golden_hour_evening: sunData ? new Date(sunData.golden_hour_evening).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
      catering_summary: cateringSummary,
      call_sheet: callSheet,
      top_entries: enrichedEntries.slice(0, 8),
    },
    error: null,
  })
})

// GET /api/shoot-days/:dayId/morning-brief/pdf
router.get('/shoot-days/:dayId/morning-brief/pdf', async (req: Request, res: Response) => {
  const { dayId } = req.params
  const shootDay = await db.get('SELECT * FROM shoot_days WHERE id = ?', [dayId]) as any
  if (!shootDay) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [shootDay.project_id]) as any
  const scenes = await db.all(`
    SELECT s.*, l.name as location_name, l.address, l.city, l.zip
    FROM shoot_day_scenes sds
    JOIN scenes s ON s.id = sds.scene_id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE sds.shoot_day_id = ?
    ORDER BY sds.sort_order ASC
  `, [dayId]) as any[]

  const callSheet = await db.get('SELECT * FROM call_sheets WHERE shoot_day_id = ?', [dayId]) as any
  const entries = callSheet
    ? await db.all('SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC LIMIT 8', [callSheet.id]) as any[]
    : []

  const enriched = await Promise.all(entries.map(async (e: any) => {
    if (e.person_type === 'cast') {
      const p = await db.get('SELECT c.actor_name as name, ch.name as role FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?', [e.person_id]) as any
      return { ...e, name: p?.name || '–', role: p?.role || '' }
    }
    const p = await db.get('SELECT name, role FROM crew WHERE id = ?', [e.person_id]) as any
    return { ...e, name: p?.name || '–', role: p?.role || '' }
  }))

  const dateStr = shootDay.date
    ? new Date(shootDay.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : ''

  const uniqueLocations = scenes.reduce((acc: any[], s: any) => {
    if (s.location_name && !acc.find(l => l.name === s.location_name)) acc.push(s)
    return acc
  }, [])

  const sceneList = scenes.map((s: any) => `<tr>
    <td>${s.scene_number || '–'}</td>
    <td>${s.int_ext || ''} / ${s.day_night || ''}</td>
    <td>${s.title || ''}</td>
    <td>${s.location_name || '–'}</td>
    <td class="center">${((s.eighths || 0) / 8).toFixed(2)}</td>
  </tr>`).join('')

  const topCallList = enriched.slice(0, 6).map((e: any) => `<tr>
    <td>${e.name}</td>
    <td class="muted">${e.role}</td>
    <td class="bold">${fmtTime(e.call_time)}</td>
  </tr>`).join('')

  const locationList = uniqueLocations.map((l: any) => `
    <div class="location-card">
      <strong>${l.location_name}</strong><br>
      <span class="muted">${[l.address, l.zip, l.city].filter(Boolean).join(', ')}</span>
    </div>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #111; background: #fff; }
  .header { background: #0a0a0a; color: #fff; padding: 12px 16px; display: flex; align-items: baseline; justify-content: space-between; }
  .header-title { font-size: 16px; font-weight: 800; letter-spacing: -0.5px; }
  .header-sub { font-size: 10px; opacity: 0.6; }
  .header-badge { background: #dc2626; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .body { padding: 12px 16px; }
  .date-row { font-size: 13px; font-weight: 700; margin-bottom: 10px; color: #111; }
  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .meta-card { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px; }
  .meta-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 2px; }
  .meta-value { font-size: 15px; font-weight: 800; color: #111; }
  .meta-sub { font-size: 8px; color: #666; margin-top: 1px; }
  h2 { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 600; border-bottom: 1px solid #e5e5e5; padding-bottom: 3px; margin: 10px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 8px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; text-align: left; padding: 3px 6px; border-bottom: 1px solid #e5e5e5; }
  td { padding: 4px 6px; border-bottom: 1px solid #f3f3f3; vertical-align: top; }
  .bold { font-weight: 700; }
  .muted { color: #666; }
  .center { text-align: center; }
  .sun-bar { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; display: flex; gap: 16px; align-items: center; }
  .sun-item { display: flex; flex-direction: column; align-items: center; }
  .sun-label { font-size: 8px; color: #888; text-transform: uppercase; margin-bottom: 1px; }
  .sun-time { font-size: 13px; font-weight: 800; }
  .sun-time.gold { color: #d97706; }
  .sun-divider { flex: 1; height: 3px; background: linear-gradient(to right, #1e3a5f, #f59e0b, #87ceeb, #f59e0b, #1e3a5f); border-radius: 2px; }
  .location-card { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 7px 10px; margin-bottom: 6px; }
  .notes-box { background: #fefce8; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; font-size: 9px; color: #78350f; margin-top: 10px; }
  .footer { text-align: center; font-size: 8px; color: #bbb; border-top: 1px solid #e5e5e5; padding: 6px; margin-top: 10px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">${project.title}</div>
      <div class="header-sub">Regie: ${project.director || '–'}</div>
    </div>
    <div class="header-badge">DREHTAG ${shootDay.day_number}</div>
  </div>

  <div class="body">
    <div class="date-row">${dateStr}</div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">General Call</div>
        <div class="meta-value">${callSheet ? fmtTime(callSheet.general_call) : '–'}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Szenen</div>
        <div class="meta-value">${scenes.length}</div>
        <div class="meta-sub">${scenes.map((s: any) => s.scene_number).join(', ')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Seiten</div>
        <div class="meta-value">${(scenes.reduce((sum: number, s: any) => sum + (s.eighths || 0), 0) / 8).toFixed(1)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Crew / Cast</div>
        <div class="meta-value">${enriched.filter(e => e.person_type === 'crew').length} / ${enriched.filter(e => e.person_type === 'cast').length}</div>
      </div>
    </div>

    ${(callSheet?.sunrise || callSheet?.sunset) ? `
    <div class="sun-bar">
      <div class="sun-item"><div class="sun-label">Sonnenaufgang</div><div class="sun-time">${callSheet.sunrise || '–'}</div></div>
      <div class="sun-divider"></div>
      <div class="sun-item"><div class="sun-label">Sonnenuntergang</div><div class="sun-time">${callSheet.sunset || '–'}</div></div>
      ${callSheet?.weather_forecast ? `<div style="margin-left:auto;font-size:10px;color:#555;padding: 0 6px;">${callSheet.weather_forecast}</div>` : ''}
    </div>` : ''}

    <div class="two-col">
      <div>
        <h2>Szenenplan</h2>
        <table>
          <tr><th>#</th><th>INT/EXT</th><th>Titel</th><th>Motiv</th><th>Seiten</th></tr>
          ${sceneList}
        </table>
      </div>
      <div>
        <h2>Motive</h2>
        ${locationList || '<p class="muted" style="font-size:9px">Keine Motive erfasst</p>'}

        <h2>Call-Zeiten</h2>
        <table>
          <tr><th>Name</th><th>Funktion</th><th>Call</th></tr>
          ${topCallList}
        </table>
      </div>
    </div>

    ${shootDay.notes ? `<div class="notes-box">⚠ ${shootDay.notes}</div>` : ''}
    ${callSheet?.notes ? `<div class="notes-box" style="margin-top:4px">📋 ${callSheet.notes}</div>` : ''}
  </div>

  <div class="footer">Morning Brief — ${project.title} — ${dateStr} — Generiert mit CutSheet</div>
</body>
</html>`

  const executablePath = resolveChromium()
  const launchOptions: any = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--no-zygote'],
  }
  if (executablePath) launchOptions.executablePath = executablePath

  const browser = await (puppeteer as any).launch(launchOptions)
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="morning-brief-tag-${shootDay.day_number}.pdf"`)
    res.send(Buffer.from(pdf))
  } finally {
    await browser.close()
  }
})

export default router
