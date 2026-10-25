import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/extras
router.get('/projects/:projectId/extras', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const rows = await db.all('SELECT * FROM extras WHERE project_id = ? ORDER BY id ASC', [projectId])
  return res.json({ data: rows, error: null })
})

// POST /api/projects/:projectId/extras
router.post('/projects/:projectId/extras', requireAuth, async (req: Request, res: Response) => {
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
  const result = await db.run(`
    INSERT INTO extras (project_id, name, phone, email, tariff_group, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [projectId, name, phone, email, tariff_group, notes])
  const row = await db.get('SELECT * FROM extras WHERE id = ?', [result.id])
  return res.status(201).json({ data: row, error: null })
})

// PUT /api/projects/:projectId/extras/:id
router.put('/projects/:projectId/extras/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur eine Zeile aus dem Projekt im Pfad. Sonst ließ sich über eine
  // fremde Kennung die Zeile eines anderen Projekts ändern und auslesen.
  const existing = await db.get('SELECT * FROM extras WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (!existing) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })

  const { name, phone, email, tariff_group, notes } = req.body as {
    name?: string
    phone?: string
    email?: string
    tariff_group?: string
    notes?: string
  }

  await db.run(`
    UPDATE extras SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      tariff_group = COALESCE(?, tariff_group),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `, [name ?? null, phone ?? null, email ?? null, tariff_group ?? null, notes ?? null, id])

  const row = await db.get('SELECT * FROM extras WHERE id = ?', [id])
  return res.json({ data: row, error: null })
})

// DELETE /api/projects/:projectId/extras/:id
router.delete('/projects/:projectId/extras/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur aus dem Projekt im Pfad: sonst löschte eine fremde Kennung im fremden Projekt
  const result = await db.run('DELETE FROM extras WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (result.changes === 0) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })
  return res.json({ data: { id }, error: null })
})

export default router
