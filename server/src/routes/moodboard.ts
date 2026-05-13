import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/moodboard
router.get('/projects/:projectId/moodboard', async (req: Request, res: Response) => {
  try {
    const items = await db.all(`
      SELECT * FROM moodboard_items
      WHERE project_id = ?
      ORDER BY created_at ASC
    `, [req.params.projectId])

    res.json({ data: items, error: null })
  } catch (err) {
    console.error('[moodboard GET]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/moodboard
router.post('/projects/:projectId/moodboard', async (req: Request, res: Response) => {
  try {
    const {
      image_url = '',
      title = '',
      notes = '',
      category = '',
      position_x = 0,
      position_y = 0,
      width = 300,
    } = req.body

    const result = await db.run(`
      INSERT INTO moodboard_items (project_id, image_url, title, notes, category, position_x, position_y, width)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.projectId, image_url, title, notes, category, position_x, position_y, width])

    const row = await db.get('SELECT * FROM moodboard_items WHERE id = ?', [result.id])
    res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[moodboard POST]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/moodboard/:id
router.put('/moodboard/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    const { image_url, title, notes, category, position_x, position_y, width } = req.body

    await db.run(`
      UPDATE moodboard_items
      SET image_url   = COALESCE(?, image_url),
          title       = COALESCE(?, title),
          notes       = COALESCE(?, notes),
          category    = COALESCE(?, category),
          position_x  = COALESCE(?, position_x),
          position_y  = COALESCE(?, position_y),
          width       = COALESCE(?, width)
      WHERE id = ?
    `, [
      image_url ?? null,
      title ?? null,
      notes ?? null,
      category ?? null,
      position_x ?? null,
      position_y ?? null,
      width ?? null,
      req.params.id,
    ])

    const row = await db.get('SELECT * FROM moodboard_items WHERE id = ?', [req.params.id])
    res.json({ data: row, error: null })
  } catch (err) {
    console.error('[moodboard PUT]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/moodboard/:id
router.delete('/moodboard/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    await db.run('DELETE FROM moodboard_items WHERE id = ?', [req.params.id])
    res.json({ data: { ok: true }, error: null })
  } catch (err) {
    console.error('[moodboard DELETE]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
