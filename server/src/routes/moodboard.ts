import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

router.use('/projects/:projectId', requireMember)

/**
 * Position und Breite sind ganze Pixel (INTEGER). Gemessen am 25.10.2026:
 * 120.5 ergab 500 - Zeigerkoordinaten können Bruchteile sein.
 */
const ganz = (wert: unknown) => (wert === undefined || wert === null ? null : Math.round(Number(wert)))

// Fehler gehen an den Übersetzer (middleware/eingabe.ts) - vorher fing jede
// Route sie selbst ab und meldete auch eine falsche Eingabe als 500.

// GET /api/projects/:projectId/moodboard
router.get('/projects/:projectId/moodboard', async (req: Request, res: Response) => {
  const items = await db.all(`
    SELECT * FROM moodboard_items
    WHERE project_id = ?
    ORDER BY created_at ASC
  `, [req.params.projectId])

  res.json({ data: items, error: null })
})

// POST /api/projects/:projectId/moodboard
router.post('/projects/:projectId/moodboard', async (req: Request, res: Response) => {
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
  `, [req.params.projectId, image_url, title, notes, category, ganz(position_x), ganz(position_y), ganz(width)])

  const row = await db.get('SELECT * FROM moodboard_items WHERE id = ?', [result.id])
  res.status(201).json({ data: row, error: null })
})

// PUT /api/moodboard/:id
router.put('/moodboard/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  // Gemessen am 25.10.2026: Ein Eintrag, den es nicht gibt, ergab 200 ohne Daten.
  if (!(await db.get('SELECT id FROM moodboard_items WHERE id = ?', [req.params.id]))) {
    return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  }

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
    ganz(position_x),
    ganz(position_y),
    ganz(width),
    req.params.id,
  ])

  const row = await db.get('SELECT * FROM moodboard_items WHERE id = ?', [req.params.id])
  res.json({ data: row, error: null })
})

// DELETE /api/moodboard/:id
router.delete('/moodboard/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  await db.run('DELETE FROM moodboard_items WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
