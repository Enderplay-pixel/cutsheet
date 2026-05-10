import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/sticky-notes
router.get('/projects/:projectId/sticky-notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = await db.all('SELECT * FROM sticky_notes WHERE project_id = ? ORDER BY created_at ASC', [projectId])
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[sticky-notes GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/sticky-notes
router.post('/projects/:projectId/sticky-notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const { content = '', color = '#fef08a', position_x = 0, position_y = 0 } = req.body as {
      content?: string
      color?: string
      position_x?: number
      position_y?: number
    }
    const result = await db.run(`
      INSERT INTO sticky_notes (project_id, content, color, position_x, position_y, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [projectId, content, color, position_x, position_y, req.user?.id ?? null])
    const row = await db.get('SELECT * FROM sticky_notes WHERE id = ?', [result.id])
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[sticky-notes POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/sticky-notes/:id
router.put('/projects/:projectId/sticky-notes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { content, color, position_x, position_y } = req.body as {
      content?: string
      color?: string
      position_x?: number
      position_y?: number
    }
    const existing = await db.get('SELECT * FROM sticky_notes WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ data: null, error: 'Notiz nicht gefunden' })

    await db.run(`
      UPDATE sticky_notes SET
        content = COALESCE(?, content),
        color = COALESCE(?, color),
        position_x = COALESCE(?, position_x),
        position_y = COALESCE(?, position_y),
        updated_at = datetime('now')
      WHERE id = ?
    `, [content ?? null, color ?? null, position_x ?? null, position_y ?? null, id])

    const row = await db.get('SELECT * FROM sticky_notes WHERE id = ?', [id])
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[sticky-notes PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/sticky-notes/:id
router.delete('/projects/:projectId/sticky-notes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = await db.run('DELETE FROM sticky_notes WHERE id = ?', [id])
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Notiz nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[sticky-notes DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
