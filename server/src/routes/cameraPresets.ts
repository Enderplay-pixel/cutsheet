import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/camera-presets
router.get('/projects/:projectId/camera-presets', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = await db.all('SELECT * FROM camera_presets WHERE project_id = ? ORDER BY id ASC', [projectId])
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[camera-presets GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/camera-presets
router.post('/projects/:projectId/camera-presets', requireAuth, async (req: Request, res: Response) => {
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
    const result = await db.run(`
      INSERT INTO camera_presets (project_id, name, camera, lenses, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [projectId, name, camera, lenses, notes])
    const row = await db.get('SELECT * FROM camera_presets WHERE id = ?', [result.id])
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[camera-presets POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/camera-presets/:id
router.put('/projects/:projectId/camera-presets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await db.get('SELECT * FROM camera_presets WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ data: null, error: 'Kamera-Preset nicht gefunden' })

    const { name, camera, lenses, notes } = req.body as {
      name?: string
      camera?: string
      lenses?: string
      notes?: string
    }

    await db.run(`
      UPDATE camera_presets SET
        name = COALESCE(?, name),
        camera = COALESCE(?, camera),
        lenses = COALESCE(?, lenses),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `, [name ?? null, camera ?? null, lenses ?? null, notes ?? null, id])

    const row = await db.get('SELECT * FROM camera_presets WHERE id = ?', [id])
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[camera-presets PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/camera-presets/:id
router.delete('/projects/:projectId/camera-presets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = await db.run('DELETE FROM camera_presets WHERE id = ?', [id])
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Kamera-Preset nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[camera-presets DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
