import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// Fehler gehen an den Übersetzer (middleware/eingabe.ts) - vorher fing jede
// Route sie selbst ab und meldete auch eine falsche Eingabe als 500.

// GET /api/projects/:projectId/sticky-notes
router.get('/projects/:projectId/sticky-notes', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const rows = await db.all('SELECT * FROM sticky_notes WHERE project_id = ? ORDER BY created_at ASC', [projectId])
  return res.json({ data: rows, error: null })
})

// POST /api/projects/:projectId/sticky-notes
router.post('/projects/:projectId/sticky-notes', requireAuth, async (req: Request, res: Response) => {
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
})

// PUT /api/projects/:projectId/sticky-notes/:id
router.put('/projects/:projectId/sticky-notes/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { content, color, position_x, position_y } = req.body as {
    content?: string
    color?: string
    position_x?: number
    position_y?: number
  }
  // Nur eine Zeile aus dem Projekt im Pfad. Sonst ließ sich über eine
  // fremde Kennung die Zeile eines anderen Projekts ändern und auslesen.
  const existing = await db.get('SELECT * FROM sticky_notes WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
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
})

// DELETE /api/projects/:projectId/sticky-notes/:id
router.delete('/projects/:projectId/sticky-notes/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur aus dem Projekt im Pfad: sonst löschte eine fremde Kennung im fremden Projekt
  const result = await db.run('DELETE FROM sticky_notes WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (result.changes === 0) return res.status(404).json({ data: null, error: 'Notiz nicht gefunden' })
  return res.json({ data: { id }, error: null })
})

export default router
