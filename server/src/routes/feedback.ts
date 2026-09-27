import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth, requireRole } from '../middleware/auth'

const router = Router()

const VALID_CATEGORIES = ['fehler', 'idee', 'allgemein']

// POST /api/feedback - In-App-Feedback von eingeloggten Nutzern
router.post('/feedback', requireAuth, async (req: Request, res: Response) => {
  try {
    const { category, message, page_path } = req.body as { category?: string; message?: string; page_path?: string }
    const msg = String(message || '').trim()
    if (!msg) return res.status(400).json({ data: null, error: 'Nachricht erforderlich' })

    const cat = VALID_CATEGORIES.includes(String(category)) ? String(category) : 'allgemein'
    const result = await db.run(
      'INSERT INTO feedback (user_id, user_email, category, message, page_path) VALUES (?, ?, ?, ?, ?)',
      [req.user!.id, req.user!.email, cat, msg.slice(0, 4000), String(page_path || '').slice(0, 300)]
    )
    return res.status(201).json({ data: { id: result.id }, error: null })
  } catch (err) {
    console.error('[feedback POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /api/feedback - alle Einträge (nur Site-Admin)
router.get('/feedback', requireAuth, requireRole('admin'), async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 500', [])
  return res.json({ data: rows, error: null })
})

// PUT /api/feedback/:id - als erledigt markieren (nur Site-Admin)
router.put('/feedback/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const resolved = (req.body as { resolved?: boolean })?.resolved !== false
  await db.run('UPDATE feedback SET resolved = ? WHERE id = ?', [resolved, req.params.id])
  return res.json({ data: { ok: true }, error: null })
})

export default router
