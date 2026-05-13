import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

router.use('/projects/:projectId', requireMember)

// GET /api/projects/:pid/scenes/:sceneId/comments
router.get('/projects/:projectId/scenes/:sceneId/comments', async (req: Request, res: Response) => {
  try {
    const comments = await db.all(`
      SELECT * FROM comments
      WHERE project_id = ? AND entity_type = 'scene' AND entity_id = ?
      ORDER BY created_at ASC
    `, [req.params.projectId, req.params.sceneId])

    const parsed = (comments as any[]).map(c => ({ ...c, resolved: !!c.resolved }))
    res.json({ data: parsed, error: null })
  } catch (err) {
    console.error('[sceneComments GET]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:pid/scenes/:sceneId/comments
router.post('/projects/:projectId/scenes/:sceneId/comments', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    const { content } = req.body
    if (!content || !String(content).trim()) {
      return res.status(400).json({ data: null, error: 'Inhalt darf nicht leer sein' })
    }

    const author = user.name || user.email || 'Unbekannt'

    const result = await db.run(`
      INSERT INTO comments (project_id, entity_type, entity_id, author, content, resolved)
      VALUES (?, 'scene', ?, ?, ?, 0)
    `, [req.params.projectId, req.params.sceneId, author, String(content).trim()])

    const row = await db.get('SELECT * FROM comments WHERE id = ?', [result.id]) as any
    res.status(201).json({ data: { ...row, resolved: !!row.resolved }, error: null })
  } catch (err) {
    console.error('[sceneComments POST]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PATCH /api/comments/:id/resolve — toggle resolved
router.patch('/comments/:id/resolve', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    const existing = await db.get('SELECT * FROM comments WHERE id = ?', [req.params.id]) as any
    if (!existing) return res.status(404).json({ data: null, error: 'Kommentar nicht gefunden' })

    const newResolved = existing.resolved ? 0 : 1
    await db.run('UPDATE comments SET resolved = ? WHERE id = ?', [newResolved, req.params.id])

    const row = await db.get('SELECT * FROM comments WHERE id = ?', [req.params.id]) as any
    res.json({ data: { ...row, resolved: !!row.resolved }, error: null })
  } catch (err) {
    console.error('[sceneComments PATCH resolve]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/comments/:id
router.delete('/comments/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    await db.run('DELETE FROM comments WHERE id = ?', [req.params.id])
    res.json({ data: { ok: true }, error: null })
  } catch (err) {
    console.error('[sceneComments DELETE]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
