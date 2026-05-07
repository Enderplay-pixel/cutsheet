import { Router } from 'express'
import { db } from '../db'

const router = Router()

function getReport(id: number) {
  const report = db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(id) as any
  if (!report) return null
  const cast = db.prepare(`
    SELECT drc.*, c.actor_name, ch.name as character_name
    FROM daily_report_cast drc
    JOIN cast c ON drc.cast_id = c.id
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE drc.daily_report_id = ?
  `).all(id)
  return {
    ...report,
    scenes_completed: JSON.parse(report.scenes_completed || '[]'),
    scenes_partial: JSON.parse(report.scenes_partial || '[]'),
    cast,
  }
}

// GET /api/shoot-days/:dayId/daily-report
router.get('/shoot-days/:dayId/daily-report', (req, res) => {
  const report = db.prepare('SELECT * FROM daily_reports WHERE shoot_day_id = ?').get(req.params.dayId) as any
  if (!report) return res.json({ data: null, error: null })
  res.json({ data: getReport(report.id), error: null })
})

// POST /api/shoot-days/:dayId/daily-report
router.post('/shoot-days/:dayId/daily-report', (req, res) => {
  // Pull project settings for default times when creating a new report
  const shootDay = db.prepare('SELECT project_id, date FROM shoot_days WHERE id = ?').get(req.params.dayId) as any
  const settings = shootDay
    ? db.prepare('SELECT default_call_time, default_wrap_time FROM project_settings WHERE project_id = ?').get(shootDay.project_id) as any
    : null
  const defCall = settings?.default_call_time ?? 480
  const defWrap = settings?.default_wrap_time ?? 1200

  const {
    date = shootDay?.date || '',
    call_time = defCall,
    first_shot = defCall + 30,
    lunch_in = null,
    lunch_out = null,
    wrap = defWrap,
    scenes_completed = [],
    scenes_partial = [],
    pages_shot = 0,
    total_setups = 0,
    camera_rolls = '',
    sound_rolls = '',
    notes = '',
    production_notes = '',
  } = req.body

  const existing = db.prepare('SELECT id FROM daily_reports WHERE shoot_day_id = ?').get(req.params.dayId) as any

  let reportId: number
  if (existing) {
    db.prepare(`UPDATE daily_reports SET date=?, call_time=?, first_shot=?, lunch_in=?, lunch_out=?, wrap=?, scenes_completed=?, scenes_partial=?, pages_shot=?, total_setups=?, camera_rolls=?, sound_rolls=?, notes=?, production_notes=?, updated_at=datetime('now') WHERE id=?`).run(date, call_time, first_shot, lunch_in, lunch_out, wrap, JSON.stringify(scenes_completed), JSON.stringify(scenes_partial), pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes, existing.id)
    reportId = existing.id
  } else {
    const result = db.prepare(`INSERT INTO daily_reports (shoot_day_id, date, call_time, first_shot, lunch_in, lunch_out, wrap, scenes_completed, scenes_partial, pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.params.dayId, date, call_time, first_shot, lunch_in, lunch_out, wrap, JSON.stringify(scenes_completed), JSON.stringify(scenes_partial), pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes)
    reportId = result.lastInsertRowid as number
  }

  res.json({ data: getReport(reportId), error: null })
})

// PUT /api/daily-reports/:id
router.put('/daily-reports/:id', (req, res) => {
  const { date, call_time, first_shot, lunch_in, lunch_out, wrap, scenes_completed, scenes_partial, pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes } = req.body
  db.prepare(`UPDATE daily_reports SET date=?, call_time=?, first_shot=?, lunch_in=?, lunch_out=?, wrap=?, scenes_completed=?, scenes_partial=?, pages_shot=?, total_setups=?, camera_rolls=?, sound_rolls=?, notes=?, production_notes=?, updated_at=datetime('now') WHERE id=?`).run(date, call_time, first_shot, lunch_in, lunch_out, wrap, JSON.stringify(scenes_completed || []), JSON.stringify(scenes_partial || []), pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes, req.params.id)
  res.json({ data: getReport(parseInt(req.params.id)), error: null })
})

export default router
