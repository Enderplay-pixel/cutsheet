import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

// GET /api/projects/:projectId/camera-presets
router.get('/projects/:projectId/camera-presets', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = db.prepare('SELECT * FROM camera_presets WHERE project_id = ? ORDER BY id ASC').all(projectId)
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[camera-presets GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/camera-presets
router.post('/projects/:projectId/camera-presets', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const {
      name = '',
      camera = '',
      lenses = '',
      notes = '',
    } = req.body as {
      name?: string
      camera?: string
      lenses?: string
      notes?: string
    }
    const result = db.prepare(`
      INSERT INTO camera_presets (project_id, name, camera, lenses, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(projectId, name, camera, lenses, notes)
    const row = db.prepare('SELECT * FROM camera_presets WHERE id = ?').get(result.lastInsertRowid)
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[camera-presets POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/camera-presets/:id
router.put('/projects/:projectId/camera-presets/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = db.prepare('SELECT * FROM camera_presets WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ data: null, error: 'Kamera-Preset nicht gefunden' })

    const { name, camera, lenses, notes } = req.body as {
      name?: string
      camera?: string
      lenses?: string
      notes?: string
    }

    db.prepare(`
      UPDATE camera_presets SET
        name = COALESCE(?, name),
        camera = COALESCE(?, camera),
        lenses = COALESCE(?, lenses),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(name ?? null, camera ?? null, lenses ?? null, notes ?? null, id)

    const row = db.prepare('SELECT * FROM camera_presets WHERE id = ?').get(id)
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[camera-presets PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/camera-presets/:id
router.delete('/projects/:projectId/camera-presets/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = db.prepare('DELETE FROM camera_presets WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Kamera-Preset nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[camera-presets DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
