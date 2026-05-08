import { Router } from 'express'
import { db } from '../db'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

const uploadsDir = path.join(__dirname, '../../uploads/storyboard')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// GET /api/projects/:projectId/shots
router.get('/projects/:projectId/shots', (req, res) => {
  const { sceneId, shootDayId } = req.query
  let query = 'SELECT sh.*, s.scene_number, s.title as scene_title FROM shots sh LEFT JOIN scenes s ON sh.scene_id = s.id WHERE sh.project_id = ?'
  const params: any[] = [req.params.projectId]

  if (sceneId) { query += ' AND sh.scene_id = ?'; params.push(sceneId) }
  if (shootDayId) { query += ' AND sh.shoot_day_id = ?'; params.push(shootDayId) }
  query += ' ORDER BY sh.sort_order ASC'

  res.json({ data: db.prepare(query).all(...params), error: null })
})

// POST /api/scenes/:sceneId/shots
router.post('/scenes/:sceneId/shots', (req, res) => {
  const { shot_number = '', size = 'HN', movement = 'Statisch', lens_mm = '', description = '', notes = '', duration_seconds = null } = req.body
  const scene = db.prepare('SELECT project_id FROM scenes WHERE id = ?').get(req.params.sceneId) as any
  if (!scene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })

  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM shots WHERE scene_id = ?').get(req.params.sceneId) as any).m
  const result = db.prepare(`INSERT INTO shots (project_id, scene_id, shot_number, sort_order, size, movement, lens_mm, description, notes, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(scene.project_id, req.params.sceneId, shot_number, maxSort + 1, size, movement, lens_mm, description, notes, duration_seconds)
  res.status(201).json({ data: db.prepare('SELECT * FROM shots WHERE id = ?').get(result.lastInsertRowid), error: null })
})

// PUT /api/shots/:id
router.put('/shots/:id', (req, res) => {
  const { shot_number, size, movement, lens_mm, description, notes, duration_seconds, sort_order } = req.body
  db.prepare('UPDATE shots SET shot_number=?, size=?, movement=?, lens_mm=?, description=?, notes=?, duration_seconds=?, sort_order=COALESCE(?,sort_order) WHERE id=?').run(shot_number, size, movement, lens_mm, description, notes, duration_seconds, sort_order ?? null, req.params.id)
  res.json({ data: db.prepare('SELECT * FROM shots WHERE id = ?').get(req.params.id), error: null })
})

// DELETE /api/shots/:id
router.delete('/shots/:id', (req, res) => {
  db.prepare('DELETE FROM shots WHERE id = ?').run(req.params.id)
  res.json({ data: { ok: true }, error: null })
})

// POST /api/shots/:id/storyboard
router.post('/shots/:id/storyboard', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ data: null, error: 'Kein Bild hochgeladen' })
  const url = `/uploads/storyboard/${req.file.filename}`
  db.prepare('UPDATE shots SET storyboard_url = ? WHERE id = ?').run(url, req.params.id)
  res.json({ data: { storyboard_url: url }, error: null })
})

export default router
