import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/extras
router.get('/projects/:projectId/extras', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = db.prepare('SELECT * FROM extras WHERE project_id = ? ORDER BY id ASC').all(projectId)
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[extras GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/extras
router.post('/projects/:projectId/extras', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const {
      name = '',
      phone = '',
      email = '',
      tariff_group = 'Standard',
      notes = '',
    } = req.body as {
      name?: string
      phone?: string
      email?: string
      tariff_group?: string
      notes?: string
    }
    const result = db.prepare(`
      INSERT INTO extras (project_id, name, phone, email, tariff_group, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(projectId, name, phone, email, tariff_group, notes)
    const row = db.prepare('SELECT * FROM extras WHERE id = ?').get(result.lastInsertRowid)
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[extras POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/extras/:id
router.put('/projects/:projectId/extras/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = db.prepare('SELECT * FROM extras WHERE id = ?').get(id)
    if (!existing) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })

    const { name, phone, email, tariff_group, notes } = req.body as {
      name?: string
      phone?: string
      email?: string
      tariff_group?: string
      notes?: string
    }

    db.prepare(`
      UPDATE extras SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        tariff_group = COALESCE(?, tariff_group),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(name ?? null, phone ?? null, email ?? null, tariff_group ?? null, notes ?? null, id)

    const row = db.prepare('SELECT * FROM extras WHERE id = ?').get(id)
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[extras PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/extras/:id
router.delete('/projects/:projectId/extras/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = db.prepare('DELETE FROM extras WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[extras DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
