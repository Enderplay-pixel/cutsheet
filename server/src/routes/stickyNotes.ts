import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

// GET /api/projects/:projectId/sticky-notes
router.get('/projects/:projectId/sticky-notes', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = db.prepare('SELECT * FROM sticky_notes WHERE project_id = ? ORDER BY created_at ASC').all(projectId)
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[sticky-notes GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/sticky-notes
router.post('/projects/:projectId/sticky-notes', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const { content = '', color = '#fef08a', position_x = 0, position_y = 0 } = req.body as {
      content?: string
      color?: string
      position_x?: number
      position_y?: number
    }
    const result = db.prepare(`
      INSERT INTO sticky_notes (project_id, content, color, position_x, position_y, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, content, color, position_x, position_y, req.user?.id ?? null)
    const row = db.prepare('SELECT * FROM sticky_notes WHERE id = ?').get(result.lastInsertRowid)
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[sticky-notes POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/sticky-notes/:id
router.put('/projects/:projectId/sticky-notes/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { content, color, position_x, position_y } = req.body as {
      content?: string
      color?: string
      position_x?: number
      position_y?: number
    }
    const existing = db.prepare('SELECT * FROM sticky_notes WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ data: null, error: 'Notiz nicht gefunden' })

    db.prepare(`
      UPDATE sticky_notes SET
        content = COALESCE(?, content),
        color = COALESCE(?, color),
        position_x = COALESCE(?, position_x),
        position_y = COALESCE(?, position_y),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(content ?? null, color ?? null, position_x ?? null, position_y ?? null, id)

    const row = db.prepare('SELECT * FROM sticky_notes WHERE id = ?').get(id)
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[sticky-notes PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/sticky-notes/:id
router.delete('/projects/:projectId/sticky-notes/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = db.prepare('DELETE FROM sticky_notes WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Notiz nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[sticky-notes DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
