import { Router, Request, Response } from 'express'
import { db } from '../db'
import { generatePdf } from './pdf'
import {
  renderDocument, table, stats, section, definitions, paragraph, fmtTime, fmtEighths,
} from '../lib/documentLayout'

const router = Router()


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

  const settings = await db.get('SELECT header_color FROM project_settings WHERE project_id = ?', [shootDay.project_id]) as any
  const accentColor = settings?.header_color || '#f59e0b'

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

  // Nach location_name vergleichen, nicht nach name: abgelegt wird die Szene,
  // die kein Feld "name" hat — die Pruefung lief immer ins Leere und jedes
  // Motiv stand so oft da, wie Szenen darin spielen.
  const uniqueLocations = scenes.reduce((acc: any[], s: any) => {
    if (s.location_name && !acc.some((l: any) => l.location_name === s.location_name)) acc.push(s)
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

  const seitenAchtel = scenes.reduce((sum: number, s: any) => sum + (Number(s.eighths) || 0), 0)
  const crewZahl = enriched.filter((e: any) => e.person_type === 'crew').length
  const castZahl = enriched.filter((e: any) => e.person_type === 'cast').length

  const html = renderDocument({
    kind: 'Morning Brief',
    title: `Drehtag ${shootDay.day_number}`,
    project: project.title,
    subtitle: dateStr,
    accent: accentColor,
    meta: [
      { label: 'Projekt', value: project.title },
      { label: 'Regie', value: project.director },
    ],
    body:
      stats([
        { label: 'General Call', value: callSheet ? fmtTime(callSheet.general_call) : '—' },
        { label: 'Szenen', value: scenes.length, hint: scenes.map((s: any) => s.scene_number).filter(Boolean).join(', ') || undefined },
        { label: 'Seiten', value: fmtEighths(seitenAchtel) },
        { label: 'Crew / Cast', value: `${crewZahl} / ${castZahl}` },
      ]) +
      (definitions([
        { label: 'Sonnenaufgang', value: callSheet?.sunrise },
        { label: 'Sonnenuntergang', value: callSheet?.sunset },
        { label: 'Wetter', value: callSheet?.weather_forecast },
      ]) || '') +
      section('Szenenplan', table({
        columns: [
          { header: 'Szene', value: (r: any) => r.scene_number, width: '9%' },
          { header: 'I/E', value: (r: any) => r.int_ext, align: 'center', width: '8%' },
          { header: 'T/N', value: (r: any) => r.day_night, align: 'center', width: '8%' },
          { header: 'Inhalt', value: (r: any) => r.title },
          { header: 'Motiv', value: (r: any) => r.location_name, width: '22%' },
          { header: 'Seiten', value: (r: any) => fmtEighths(r.eighths), align: 'right', width: '9%' },
        ],
        rows: scenes,
        empty: 'Für diesen Tag ist noch nichts disponiert.',
      }), `${scenes.length} Szenen · ${fmtEighths(seitenAchtel)} Seiten`) +
      section('Motive', table({
        columns: [
          { header: 'Motiv', value: (r: any) => r.location_name, width: '30%' },
          // Adressteile einzeln — fehlende duerfen nicht als "null" erscheinen
          { header: 'Adresse', value: (r: any) => [r.address, [r.zip, r.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') },
        ],
        rows: uniqueLocations,
        empty: 'Keine Motive erfasst.',
      })) +
      section('Call-Zeiten', table({
        columns: [
          { header: 'Name', value: (r: any) => r.name, width: '34%' },
          { header: 'Funktion', value: (r: any) => r.role, muted: true },
          { header: 'Call', value: (r: any) => fmtTime(r.call_time), align: 'right', width: '14%' },
        ],
        rows: enriched,
        empty: 'Noch keine Call-Zeiten gesetzt.',
      }), enriched.length >= 8 ? 'Auszug — vollständig auf der Tagesdispo' : undefined) +
      (paragraph(shootDay.notes) ? section('Hinweise zum Drehtag', paragraph(shootDay.notes)) : '') +
      (paragraph(callSheet?.notes) ? section('Hinweise zur Disposition', paragraph(callSheet.notes)) : ''),
  })

  try {
    const pdf = await generatePdf(html, {
      footer: false,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="morning-brief-tag-${shootDay.day_number}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

export default router
