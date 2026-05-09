import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/post-phases
router.get('/projects/:projectId/post-phases', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = db.prepare('SELECT * FROM post_phases WHERE project_id = ? ORDER BY sort_order ASC, id ASC').all(projectId)
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[post-phases GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/post-phases
router.post('/projects/:projectId/post-phases', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const {
      phase = 'Rohschnitt',
      start_date = null,
      end_date = null,
      status = 'Ausstehend',
      responsible = '',
      notes = '',
      sort_order = 0,
    } = req.body as {
      phase?: string
      start_date?: string | null
      end_date?: string | null
      status?: string
      responsible?: string
      notes?: string
      sort_order?: number
    }
    const result = db.prepare(`
      INSERT INTO post_phases (project_id, phase, start_date, end_date, status, responsible, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, phase, start_date, end_date, status, responsible, notes, sort_order)
    const row = db.prepare('SELECT * FROM post_phases WHERE id = ?').get(result.lastInsertRowid)
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[post-phases POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/post-phases/:id
router.put('/projects/:projectId/post-phases/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = db.prepare('SELECT * FROM post_phases WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ data: null, error: 'Post-Phase nicht gefunden' })

    const {
      phase,
      start_date,
      end_date,
      status,
      responsible,
      notes,
      sort_order,
    } = req.body as {
      phase?: string
      start_date?: string | null
      end_date?: string | null
      status?: string
      responsible?: string
      notes?: string
      sort_order?: number
    }

    db.prepare(`
      UPDATE post_phases SET
        phase = COALESCE(?, phase),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        status = COALESCE(?, status),
        responsible = COALESCE(?, responsible),
        notes = COALESCE(?, notes),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(
      phase ?? null,
      start_date ?? null,
      end_date ?? null,
      status ?? null,
      responsible ?? null,
      notes ?? null,
      sort_order ?? null,
      id
    )

    const row = db.prepare('SELECT * FROM post_phases WHERE id = ?').get(id)
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[post-phases PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/post-phases/:id
router.delete('/projects/:projectId/post-phases/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = db.prepare('DELETE FROM post_phases WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Post-Phase nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[post-phases DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
