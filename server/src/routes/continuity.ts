import { Router, Request, Response } from 'express'
import { db } from '../db'

const router = Router()

// GET /api/projects/:pid/continuity
router.get('/projects/:pid/continuity', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const conditions: string[] = ['cn.project_id = ?']
  const params: any[] = [req.params.pid]

  if (req.query.scene_id) {
    conditions.push('cn.scene_id = ?')
    params.push(req.query.scene_id)
  }
  if (req.query.cast_id) {
    conditions.push('cn.cast_id = ?')
    params.push(req.query.cast_id)
  }
  if (req.query.category) {
    conditions.push('cn.category = ?')
    params.push(req.query.category)
  }

  const where = conditions.join(' AND ')

  const rows = await db.all(
    `SELECT cn.*,
            s.scene_number, s.title as scene_title,
            c.actor_name as cast_name,
            sd.date as shoot_day_date, sd.day_number as shoot_day_number
     FROM continuity_notes cn
     LEFT JOIN scenes s ON cn.scene_id = s.id
     LEFT JOIN "cast" c ON cn.cast_id = c.id
     LEFT JOIN shoot_days sd ON cn.shoot_day_id = sd.id
     WHERE ${where}
     ORDER BY cn.created_at DESC`,
    params
  ) as any[]

  return res.json({ data: rows, error: null })
})

// POST /api/projects/:pid/continuity
router.post('/projects/:pid/continuity', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const {
    scene_id = null,
    cast_id = null,
    category = 'kostüm',
    description = '',
    photos = [],
    shoot_day_id = null,
  } = req.body

  const photosJson = Array.isArray(photos) ? JSON.stringify(photos) : photos

  const result = await db.run(
    `INSERT INTO continuity_notes (project_id, scene_id, cast_id, category, description, photos, shoot_day_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.params.pid, scene_id, cast_id, category, description, photosJson, shoot_day_id]
  )

  const row = await db.get(
    `SELECT cn.*,
            s.scene_number, s.title as scene_title,
            c.actor_name as cast_name,
            sd.date as shoot_day_date, sd.day_number as shoot_day_number
     FROM continuity_notes cn
     LEFT JOIN scenes s ON cn.scene_id = s.id
     LEFT JOIN "cast" c ON cn.cast_id = c.id
     LEFT JOIN shoot_days sd ON cn.shoot_day_id = sd.id
     WHERE cn.id = ?`,
    [result.id]
  ) as any

  return res.status(201).json({ data: row, error: null })
})

// PUT /api/continuity/:id
router.put('/continuity/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM continuity_notes WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Notiz nicht gefunden' })

  const {
    scene_id = existing.scene_id,
    cast_id = existing.cast_id,
    category = existing.category,
    description = existing.description,
    photos = existing.photos,
    shoot_day_id = existing.shoot_day_id,
  } = req.body

  const photosJson = Array.isArray(photos) ? JSON.stringify(photos) : photos

  await db.run(
    `UPDATE continuity_notes
     SET scene_id=?, cast_id=?, category=?, description=?, photos=?, shoot_day_id=?
     WHERE id=?`,
    [scene_id, cast_id, category, description, photosJson, shoot_day_id, req.params.id]
  )

  const row = await db.get(
    `SELECT cn.*,
            s.scene_number, s.title as scene_title,
            c.actor_name as cast_name,
            sd.date as shoot_day_date, sd.day_number as shoot_day_number
     FROM continuity_notes cn
     LEFT JOIN scenes s ON cn.scene_id = s.id
     LEFT JOIN "cast" c ON cn.cast_id = c.id
     LEFT JOIN shoot_days sd ON cn.shoot_day_id = sd.id
     WHERE cn.id = ?`,
    [req.params.id]
  ) as any

  return res.json({ data: row, error: null })
})

// DELETE /api/continuity/:id
router.delete('/continuity/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM continuity_notes WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Notiz nicht gefunden' })

  await db.run('DELETE FROM continuity_notes WHERE id = ?', [req.params.id])
  return res.json({ data: { id: parseInt(req.params.id) }, error: null })
})

export default router
