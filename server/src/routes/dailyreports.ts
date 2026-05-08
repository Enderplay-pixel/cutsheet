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

// GET /api/projects/:projectId/time-analysis
router.get('/projects/:projectId/time-analysis', (req, res) => {
  const pid = req.params.projectId

  // Get all scenes for the project with their estimated minutes
  const scenes = db.prepare(`
    SELECT s.id as scene_id, s.scene_number, s.title, s.estimated_minutes
    FROM scenes s
    WHERE s.project_id = ?
    ORDER BY s.scene_number ASC
  `).all(pid) as any[]

  // Get actual minutes per scene accumulated across all shoot days
  // We look at shoot_day_scenes to find what was shot, and daily_reports to get timing data
  // Since actual time per scene isn't stored granularly, we estimate from daily report wrap/call times
  // divided by number of scenes shot that day (scenes_completed + scenes_partial)
  const shootDays = db.prepare(`
    SELECT sd.id as shoot_day_id, dr.id as report_id, dr.call_time, dr.first_shot, dr.wrap,
           dr.scenes_completed, dr.scenes_partial
    FROM shoot_days sd
    LEFT JOIN daily_reports dr ON dr.shoot_day_id = sd.id
    WHERE sd.project_id = ? AND dr.id IS NOT NULL
  `).all(pid) as any[]

  // Build a map of scene_id -> actual_minutes
  const actualMinutesMap: Record<number, number> = {}

  for (const day of shootDays) {
    const completedIds: number[] = JSON.parse(day.scenes_completed || '[]')
    const partialIds: number[] = JSON.parse(day.scenes_partial || '[]')
    const allSceneIds = [...completedIds, ...partialIds]

    if (allSceneIds.length === 0) continue

    // Total shooting time for the day in minutes (from first_shot to wrap)
    const firstShot = day.first_shot ?? day.call_time ?? 480
    const wrap = day.wrap ?? 1200
    // Times are stored as minutes-since-midnight
    let totalDayMinutes = wrap - firstShot
    if (totalDayMinutes <= 0) totalDayMinutes = 0

    // Subtract lunch break if present (lunch_in and lunch_out stored as minutes-since-midnight)
    const row = db.prepare('SELECT lunch_in, lunch_out FROM daily_reports WHERE id = ?').get(day.report_id) as any
    if (row && row.lunch_in != null && row.lunch_out != null && row.lunch_out > row.lunch_in) {
      totalDayMinutes -= (row.lunch_out - row.lunch_in)
    }

    if (totalDayMinutes < 0) totalDayMinutes = 0

    // Distribute evenly across scenes shot that day
    const minutesPerScene = allSceneIds.length > 0 ? Math.round(totalDayMinutes / allSceneIds.length) : 0

    for (const sceneId of allSceneIds) {
      actualMinutesMap[sceneId] = (actualMinutesMap[sceneId] || 0) + minutesPerScene
    }
  }

  // Build result
  const result = scenes.map((s: any) => {
    const estimated = s.estimated_minutes ?? 0
    const actual = actualMinutesMap[s.scene_id] ?? 0
    return {
      scene_id: s.scene_id,
      scene_number: s.scene_number,
      title: s.title,
      estimated_minutes: estimated,
      actual_minutes: actual,
      difference_minutes: actual - estimated,
    }
  })

  res.json({ data: result, error: null })
})

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
