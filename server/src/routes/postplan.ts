import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { laufzeitFehler } from '../lib/datum'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// Fehler gehen an den Übersetzer (middleware/eingabe.ts) - vorher fing jede
// Route sie selbst ab und meldete auch eine falsche Eingabe als 500.
// Gemessen am 25.10.2026 außerdem: "morgen" als Datum und ein Ende vor dem
// Anfang wurden gespeichert - der Zeitplan rechnet damit.

// GET /api/projects/:projectId/post-phases
router.get('/projects/:projectId/post-phases', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const rows = await db.all('SELECT * FROM post_phases WHERE project_id = ? ORDER BY sort_order ASC, id ASC', [projectId])
  return res.json({ data: rows, error: null })
})

// POST /api/projects/:projectId/post-phases
router.post('/projects/:projectId/post-phases', requireAuth, async (req: Request, res: Response) => {
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
  const fehler = laufzeitFehler(start_date, end_date)
  if (fehler) return res.status(400).json({ data: null, error: fehler })
  const result = await db.run(`
    INSERT INTO post_phases (project_id, phase, start_date, end_date, status, responsible, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, phase, start_date, end_date, status, responsible, notes, sort_order])
  const row = await db.get('SELECT * FROM post_phases WHERE id = ?', [result.id])
  return res.status(201).json({ data: row, error: null })
})

// PUT /api/projects/:projectId/post-phases/:id
router.put('/projects/:projectId/post-phases/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur eine Zeile aus dem Projekt im Pfad. Sonst ließ sich über eine
  // fremde Kennung die Zeile eines anderen Projekts ändern und auslesen.
  const existing = await db.get('SELECT * FROM post_phases WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
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

  // Gegen das, was nach dem Ändern dasteht
  const fehler = laufzeitFehler(start_date ?? existing.start_date, end_date ?? existing.end_date)
  if (fehler) return res.status(400).json({ data: null, error: fehler })

  await db.run(`
    UPDATE post_phases SET
      phase = COALESCE(?, phase),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      status = COALESCE(?, status),
      responsible = COALESCE(?, responsible),
      notes = COALESCE(?, notes),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `, [
    phase ?? null,
    start_date ?? null,
    end_date ?? null,
    status ?? null,
    responsible ?? null,
    notes ?? null,
    sort_order ?? null,
    id
  ])

  const row = await db.get('SELECT * FROM post_phases WHERE id = ?', [id])
  return res.json({ data: row, error: null })
})

// DELETE /api/projects/:projectId/post-phases/:id
router.delete('/projects/:projectId/post-phases/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur aus dem Projekt im Pfad: sonst löschte eine fremde Kennung im fremden Projekt
  const result = await db.run('DELETE FROM post_phases WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (result.changes === 0) return res.status(404).json({ data: null, error: 'Post-Phase nicht gefunden' })
  return res.json({ data: { id }, error: null })
})

export default router
