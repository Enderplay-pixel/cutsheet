import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

function getShootDayWithScenes(dayId: number | bigint) {
  const day = db.prepare('SELECT * FROM shoot_days WHERE id = ?').get(dayId) as any
  if (!day) return null
  const scenes = db.prepare(`
    SELECT sds.*, s.scene_number, s.title, s.int_ext, s.day_night, s.eighths, s.estimated_minutes, s.description, s.notes,
           l.name as location_name
    FROM shoot_day_scenes sds
    JOIN scenes s ON sds.scene_id = s.id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE sds.shoot_day_id = ?
    ORDER BY sds.sort_order ASC
  `).all(dayId)

  const total_eighths = (scenes as any[]).reduce((sum: number, s: any) => sum + (s.eighths || 0), 0)
  const estimated_minutes = (scenes as any[]).reduce((sum: number, s: any) => sum + (s.estimated_minutes || 0), 0)
  return { ...day, scenes, total_eighths, estimated_minutes }
}

// GET /api/projects/:projectId/shoot-days
router.get('/projects/:projectId/shoot-days', (req, res) => {
  const days = db.prepare('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number ASC').all(req.params.projectId)
  const result = (days as any[]).map(d => getShootDayWithScenes(d.id))
  res.json({ data: result, error: null })
})

// POST /api/projects/:projectId/shoot-days
router.post('/projects/:projectId/shoot-days', (req, res) => {
  const { date, status = 'Geplant', unit = 'Haupteinheit', notes = '' } = req.body
  const maxDay = (db.prepare('SELECT COALESCE(MAX(day_number), 0) as m FROM shoot_days WHERE project_id = ?').get(req.params.projectId) as any).m
  const result = db.prepare('INSERT INTO shoot_days (project_id, day_number, date, status, unit, notes) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.projectId, maxDay + 1, date, status, unit, notes)
  res.status(201).json({ data: getShootDayWithScenes(result.lastInsertRowid), error: null })
})

// POST /api/projects/:projectId/shoot-days/batch — create multiple days from a date range
router.post('/projects/:projectId/shoot-days/batch', (req, res) => {
  const { dates } = req.body   // string[] of 'YYYY-MM-DD'
  if (!Array.isArray(dates) || dates.length === 0)
    return res.status(400).json({ data: null, error: 'dates array required' })

  const maxDayRow = db.prepare('SELECT COALESCE(MAX(day_number), 0) as m FROM shoot_days WHERE project_id = ?').get(req.params.projectId) as any
  let nextDay = (maxDayRow.m as number) + 1

  const created: any[] = []
  for (const date of dates) {
    const result = db.prepare(
      'INSERT INTO shoot_days (project_id, day_number, date, status, unit, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.params.projectId, nextDay++, date, 'Geplant', 'Haupteinheit', '')
    const day = getShootDayWithScenes(result.lastInsertRowid)
    if (day) created.push(day)
  }
  res.status(201).json({ data: created, error: null })
})

// PUT /api/shoot-days/:id
router.put('/shoot-days/:id', (req, res) => {
  const { date, status, unit, notes, catering_count } = req.body
  db.prepare('UPDATE shoot_days SET date=COALESCE(?,date), status=COALESCE(?,status), unit=COALESCE(?,unit), notes=COALESCE(?,notes), catering_count=COALESCE(?,catering_count) WHERE id=?')
    .run(date ?? null, status ?? null, unit ?? null, notes ?? null, catering_count ?? null, req.params.id)
  res.json({ data: getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// DELETE /api/shoot-days/:id
router.delete('/shoot-days/:id', (req, res) => {
  // Re-number remaining days
  const day = db.prepare('SELECT * FROM shoot_days WHERE id = ?').get(req.params.id) as any
  if (day) {
    db.prepare('DELETE FROM shoot_days WHERE id = ?').run(req.params.id)
    db.prepare('UPDATE shoot_days SET day_number = day_number - 1 WHERE project_id = ? AND day_number > ?').run(day.project_id, day.day_number)
  }
  res.json({ data: { ok: true }, error: null })
})

// POST /api/shoot-days/:id/scenes
router.post('/shoot-days/:id/scenes', (req, res) => {
  const { scene_id, sort_order = 0, estimated_minutes = null } = req.body
  try {
    db.prepare('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order, estimated_minutes) VALUES (?, ?, ?, ?)').run(req.params.id, scene_id, sort_order, estimated_minutes)
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return res.status(409).json({ data: null, error: 'Szene bereits in diesem Drehtag' })
    }
    throw e
  }
  res.json({ data: getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// DELETE /api/shoot-days/:dayId/scenes/:sceneId
router.delete('/shoot-days/:dayId/scenes/:sceneId', (req, res) => {
  db.prepare('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ? AND scene_id = ?').run(req.params.dayId, req.params.sceneId)
  res.json({ data: getShootDayWithScenes(parseInt(req.params.dayId)), error: null })
})

// PUT /api/shoot-days/:id/scenes/reorder
router.put('/shoot-days/:id/scenes/reorder', (req, res) => {
  const { order } = req.body // array of { sceneId, sortOrder }
  const update = db.prepare('UPDATE shoot_day_scenes SET sort_order = ? WHERE shoot_day_id = ? AND scene_id = ?')
  const updateMany = db.transaction((items: { sceneId: number; sortOrder: number }[]) => {
    items.forEach(item => update.run(item.sortOrder, req.params.id, item.sceneId))
  })
  updateMany(order)
  res.json({ data: getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// POST /api/shoot-days/move-scene
router.post('/shoot-days/move-scene', (req, res) => {
  const { sceneId, fromDayId, toDayId, sortOrder = 0 } = req.body

  const moveScene = db.transaction((_: void) => {
    if (fromDayId) {
      db.prepare('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ? AND scene_id = ?').run(fromDayId, sceneId)
    }
    if (toDayId) {
      try {
        db.prepare('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?)').run(toDayId, sceneId, sortOrder)
      } catch (e: any) {
        if (!e.message?.includes('UNIQUE')) throw e
        db.prepare('UPDATE shoot_day_scenes SET sort_order = ? WHERE shoot_day_id = ? AND scene_id = ?').run(sortOrder, toDayId, sceneId)
      }
    }
  })
  moveScene(undefined as void)

  res.json({ data: { ok: true }, error: null })
})

// GET /api/projects/:projectId/drehplan/versions
router.get('/projects/:projectId/drehplan/versions', (req, res) => {
  const versions = db.prepare('SELECT id, project_id, name, created_at FROM drehplan_versions WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId)
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/drehplan/snapshot
router.post('/projects/:projectId/drehplan/snapshot', (req, res) => {
  const { name = `Snapshot ${new Date().toLocaleString('de-DE')}` } = req.body
  const days = db.prepare('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number').all(req.params.projectId)
  const fullDrehplan = (days as any[]).map(d => getShootDayWithScenes(d.id))
  const result = db.prepare('INSERT INTO drehplan_versions (project_id, name, snapshot_json) VALUES (?, ?, ?)').run(req.params.projectId, name, JSON.stringify(fullDrehplan))
  res.status(201).json({ data: db.prepare('SELECT id, project_id, name, created_at FROM drehplan_versions WHERE id = ?').get(result.lastInsertRowid), error: null })
})

// POST /api/projects/:projectId/drehplan/restore/:versionId
router.post('/projects/:projectId/drehplan/restore/:versionId', (req, res) => {
  const version = db.prepare('SELECT * FROM drehplan_versions WHERE id = ? AND project_id = ?').get(req.params.versionId, req.params.projectId) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })

  const snapshot: any[] = JSON.parse(version.snapshot_json)

  // Delete all current shoot day ↔ scene assignments, keep the days + scenes themselves
  const currentDays = db.prepare('SELECT id FROM shoot_days WHERE project_id = ?').all(req.params.projectId) as any[]
  currentDays.forEach(d => db.prepare('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ?').run(d.id))

  // Re-apply scene assignments from snapshot
  snapshot.forEach(snapDay => {
    // Find matching live day by day_number (best-effort match)
    const liveDay = db.prepare('SELECT id FROM shoot_days WHERE project_id = ? AND day_number = ?').get(req.params.projectId, snapDay.day_number) as any
    if (!liveDay) return
    ;(snapDay.scenes || []).forEach((s: any, i: number) => {
      // scene is identified by scene_id in the snapshot
      const sceneId = s.scene_id || s.id
      const sceneExists = db.prepare('SELECT id FROM scenes WHERE id = ? AND project_id = ?').get(sceneId, req.params.projectId)
      if (!sceneExists) return
      try {
        db.prepare('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?)').run(liveDay.id, sceneId, i)
      } catch (e: any) {
        if (!e.message?.includes('UNIQUE')) throw e
      }
    })
  })

  const days = db.prepare('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number').all(req.params.projectId)
  res.json({ data: (days as any[]).map(d => getShootDayWithScenes(d.id)), error: null })
})

// DELETE /api/drehplan-versions/:id
router.delete('/drehplan-versions/:id', (req, res) => {
  db.prepare('DELETE FROM drehplan_versions WHERE id = ?').run(req.params.id)
  res.json({ data: { ok: true }, error: null })
})

export default router
