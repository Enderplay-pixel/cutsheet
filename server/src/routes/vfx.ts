import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/vfx
router.get('/projects/:projectId/vfx', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = await db.all('SELECT * FROM vfx_shots WHERE project_id = ? ORDER BY id ASC', [projectId])
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[vfx GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/vfx
router.post('/projects/:projectId/vfx', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const {
      scene_id = null,
      shot_number = '',
      description = '',
      vfx_type = 'Compositing',
      status = 'Offen',
      artist = '',
      deadline = null,
      complexity = 'Mittel',
      notes = '',
    } = req.body as {
      scene_id?: number | null
      shot_number?: string
      description?: string
      vfx_type?: string
      status?: string
      artist?: string
      deadline?: string | null
      complexity?: string
      notes?: string
    }
    const result = await db.run(`
      INSERT INTO vfx_shots (project_id, scene_id, shot_number, description, vfx_type, status, artist, deadline, complexity, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, scene_id, shot_number, description, vfx_type, status, artist, deadline, complexity, notes])
    const row = await db.get('SELECT * FROM vfx_shots WHERE id = ?', [result.id])
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[vfx POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/vfx/:id
router.put('/projects/:projectId/vfx/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await db.get('SELECT * FROM vfx_shots WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ data: null, error: 'VFX-Shot nicht gefunden' })

    const {
      scene_id,
      shot_number,
      description,
      vfx_type,
      status,
      artist,
      deadline,
      complexity,
      notes,
    } = req.body as {
      scene_id?: number | null
      shot_number?: string
      description?: string
      vfx_type?: string
      status?: string
      artist?: string
      deadline?: string | null
      complexity?: string
      notes?: string
    }

    await db.run(`
      UPDATE vfx_shots SET
        scene_id = COALESCE(?, scene_id),
        shot_number = COALESCE(?, shot_number),
        description = COALESCE(?, description),
        vfx_type = COALESCE(?, vfx_type),
        status = COALESCE(?, status),
        artist = COALESCE(?, artist),
        deadline = COALESCE(?, deadline),
        complexity = COALESCE(?, complexity),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `, [
      scene_id ?? null,
      shot_number ?? null,
      description ?? null,
      vfx_type ?? null,
      status ?? null,
      artist ?? null,
      deadline ?? null,
      complexity ?? null,
      notes ?? null,
      id
    ])

    const row = await db.get('SELECT * FROM vfx_shots WHERE id = ?', [id])
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[vfx PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/vfx/:id
router.delete('/projects/:projectId/vfx/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = await db.run('DELETE FROM vfx_shots WHERE id = ?', [id])
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'VFX-Shot nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[vfx DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
