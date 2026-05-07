import { Router } from 'express'
import { db } from '../db'

const router = Router()

function getCallSheet(id: number) {
  const sheet = db.prepare('SELECT cs.*, l.name as location_name FROM call_sheets cs LEFT JOIN locations l ON cs.location_id = l.id WHERE cs.id = ?').get(id) as any
  if (!sheet) return null
  const entries = db.prepare('SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC').all(id) as any[]

  // Enrich entries with person names
  const enriched = entries.map((e: any) => {
    if (e.person_type === 'cast') {
      const person = db.prepare('SELECT c.actor_name as name, ch.name as role FROM cast c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?').get(e.person_id) as any
      return { ...e, person_name: person?.name || '', role: person?.role || '' }
    } else {
      const person = db.prepare('SELECT name, role FROM crew WHERE id = ?').get(e.person_id) as any
      return { ...e, person_name: person?.name || '', role: person?.role || '' }
    }
  })

  return { ...sheet, entries: enriched }
}

// GET /api/shoot-days/:dayId/call-sheet
router.get('/shoot-days/:dayId/call-sheet', (req, res) => {
  const sheet = db.prepare('SELECT * FROM call_sheets WHERE shoot_day_id = ?').get(req.params.dayId) as any
  if (!sheet) return res.json({ data: null, error: null })
  res.json({ data: getCallSheet(sheet.id), error: null })
})

// POST /api/shoot-days/:dayId/call-sheet
router.post('/shoot-days/:dayId/call-sheet', (req, res) => {
  // Look up project settings to get default call time
  const shootDay = db.prepare('SELECT project_id FROM shoot_days WHERE id = ?').get(req.params.dayId) as any
  const settings = shootDay
    ? db.prepare('SELECT default_call_time FROM project_settings WHERE project_id = ?').get(shootDay.project_id) as any
    : null
  const settingsCallTime = settings?.default_call_time ?? 480

  const {
    general_call = settingsCallTime,
    shooting_call = settingsCallTime + 30,
    location_id = null,
    weather_forecast = '',
    sunrise = '',
    sunset = '',
    notes = '',
  } = req.body

  const existing = db.prepare('SELECT id FROM call_sheets WHERE shoot_day_id = ?').get(req.params.dayId) as any
  let sheetId: number

  if (existing) {
    db.prepare('UPDATE call_sheets SET general_call=?, shooting_call=?, location_id=?, weather_forecast=?, sunrise=?, sunset=?, notes=?, updated_at=datetime("now") WHERE id=?').run(general_call, shooting_call, location_id, weather_forecast, sunrise, sunset, notes, existing.id)
    sheetId = existing.id
  } else {
    const result = db.prepare('INSERT INTO call_sheets (shoot_day_id, general_call, shooting_call, location_id, weather_forecast, sunrise, sunset, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.dayId, general_call, shooting_call, location_id, weather_forecast, sunrise, sunset, notes)
    sheetId = result.lastInsertRowid as number

    // Auto-populate entries from crew and cast
    if (shootDay) {
      const crew = db.prepare('SELECT id FROM crew WHERE project_id = ?').all(shootDay.project_id) as any[]
      const cast = db.prepare('SELECT id FROM cast WHERE project_id = ?').all(shootDay.project_id) as any[]

      crew.forEach((c: any, i: number) => {
        db.prepare('INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order) VALUES (?, ?, ?, ?, ?)').run(sheetId, 'crew', c.id, general_call, i)
      })
      cast.forEach((c: any, i: number) => {
        db.prepare('INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order) VALUES (?, ?, ?, ?, ?)').run(sheetId, 'cast', c.id, general_call, crew.length + i)
      })
    }
  }

  res.json({ data: getCallSheet(sheetId), error: null })
})

// PUT /api/call-sheets/:id/entries
router.put('/call-sheets/:id/entries', (req, res) => {
  const { entries } = req.body // array of entry objects
  const update = db.prepare('UPDATE call_sheet_entries SET call_time=?, pickup_location=?, notes=? WHERE id=?')
  const updateAll = db.transaction((items: any[]) => {
    items.forEach(e => update.run(e.call_time, e.pickup_location || '', e.notes || '', e.id))
  })
  updateAll(entries)
  res.json({ data: getCallSheet(parseInt(req.params.id)), error: null })
})

// POST /api/call-sheets/:id/entries/add  — add a person not yet on the sheet
router.post('/call-sheets/:id/entries/add', (req, res) => {
  const { person_type, person_id, call_time = 480 } = req.body
  const sheet = db.prepare('SELECT id FROM call_sheets WHERE id = ?').get(req.params.id) as any
  if (!sheet) return res.status(404).json({ data: null, error: 'Call Sheet nicht gefunden' })

  // Check not already on sheet
  const existing = db.prepare('SELECT id FROM call_sheet_entries WHERE call_sheet_id = ? AND person_type = ? AND person_id = ?').get(req.params.id, person_type, person_id)
  if (existing) return res.status(409).json({ data: null, error: 'Person bereits im Call Sheet' })

  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM call_sheet_entries WHERE call_sheet_id = ?').get(req.params.id) as any).m
  db.prepare('INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order) VALUES (?, ?, ?, ?, ?)').run(req.params.id, person_type, person_id, call_time, maxOrder + 1)
  res.status(201).json({ data: getCallSheet(parseInt(req.params.id)), error: null })
})

// DELETE /api/call-sheets/:id/entries/:entryId
router.delete('/call-sheets/:id/entries/:entryId', (req, res) => {
  db.prepare('DELETE FROM call_sheet_entries WHERE id = ? AND call_sheet_id = ?').run(req.params.entryId, req.params.id)
  res.json({ data: getCallSheet(parseInt(req.params.id)), error: null })
})

// POST /api/call-sheets/:id/shift-times
router.post('/call-sheets/:id/shift-times', (req, res) => {
  const { minutes = 0 } = req.body
  db.prepare('UPDATE call_sheet_entries SET call_time = call_time + ? WHERE call_sheet_id = ?').run(minutes, req.params.id)
  db.prepare("UPDATE call_sheets SET general_call = general_call + ?, shooting_call = shooting_call + ?, updated_at = datetime('now') WHERE id = ?").run(minutes, minutes, req.params.id)
  res.json({ data: getCallSheet(parseInt(req.params.id)), error: null })
})

export default router
