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
router.get('/projects/:projectId/shots', async (req, res) => {
  const { sceneId, shootDayId } = req.query
  let query = 'SELECT sh.*, s.scene_number, s.title as scene_title FROM shots sh LEFT JOIN scenes s ON sh.scene_id = s.id WHERE sh.project_id = ?'
  const params: any[] = [req.params.projectId]

  if (sceneId) { query += ' AND sh.scene_id = ?'; params.push(sceneId) }
  if (shootDayId) { query += ' AND sh.shoot_day_id = ?'; params.push(shootDayId) }
  query += ' ORDER BY sh.sort_order ASC'

  res.json({ data: await db.all(query, params), error: null })
})

// POST /api/scenes/:sceneId/shots
router.post('/scenes/:sceneId/shots', async (req, res) => {
  const { shot_number = '', size = 'HN', movement = 'Statisch', lens_mm = '', description = '', notes = '', duration_seconds = null } = req.body
  const scene = await db.get('SELECT project_id FROM scenes WHERE id = ?', [req.params.sceneId]) as any
  if (!scene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })

  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM shots WHERE scene_id = ?', [req.params.sceneId])
  const maxSort = (maxSortRow as any).m
  const result = await db.run(`INSERT INTO shots (project_id, scene_id, shot_number, sort_order, size, movement, lens_mm, description, notes, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [scene.project_id, req.params.sceneId, shot_number, maxSort + 1, size, movement, lens_mm, description, notes, duration_seconds])
  res.status(201).json({ data: await db.get('SELECT * FROM shots WHERE id = ?', [result.id]), error: null })
})

// PUT /api/shots/:id
router.put('/shots/:id', async (req, res) => {
  const { shot_number, size, movement, lens_mm, description, notes, best_take, duration_seconds, sort_order, done } = req.body
  await db.run(
    'UPDATE shots SET shot_number=?, size=?, movement=?, lens_mm=?, description=?, notes=?, best_take=COALESCE(?,best_take), duration_seconds=?, sort_order=COALESCE(?,sort_order), done=COALESCE(?,done) WHERE id=?',
    [shot_number, size, movement, lens_mm, description, notes, best_take ?? null, duration_seconds, sort_order ?? null, done != null ? (done ? 1 : 0) : null, req.params.id]
  )
  res.json({ data: await db.get('SELECT * FROM shots WHERE id = ?', [req.params.id]), error: null })
})

// PATCH /api/shots/:id/done - toggle done status (0↔1)
router.patch('/shots/:id/done', async (req, res) => {
  const shot = await db.get('SELECT id, done FROM shots WHERE id = ?', [req.params.id]) as any
  if (!shot) return res.status(404).json({ data: null, error: 'Shot nicht gefunden' })
  const newDone = shot.done ? 0 : 1
  await db.run('UPDATE shots SET done = ? WHERE id = ?', [newDone, req.params.id])
  res.json({ data: await db.get('SELECT * FROM shots WHERE id = ?', [req.params.id]), error: null })
})

// DELETE /api/shots/:id
router.delete('/shots/:id', async (req, res) => {
  await db.run('DELETE FROM shots WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/shots/:id/storyboard
router.post('/shots/:id/storyboard', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ data: null, error: 'Kein Bild hochgeladen' })
  const url = `/uploads/storyboard/${req.file.filename}`
  await db.run('UPDATE shots SET storyboard_url = ? WHERE id = ?', [url, req.params.id])
  res.json({ data: { storyboard_url: url }, error: null })
})

export default router
