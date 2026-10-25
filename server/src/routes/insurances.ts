import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { laufzeitFehler } from '../lib/datum'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/insurances
router.get('/projects/:projectId/insurances', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = await db.all('SELECT * FROM insurances WHERE project_id = ? ORDER BY sort_order ASC, id ASC', [projectId])
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[insurances GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/insurances
router.post('/projects/:projectId/insurances', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const {
      ins_type = 'Filmversicherung',
      provider = '',
      policy_number = '',
      coverage_amount_cents = 0,
      premium_cents = 0,
      start_date = null,
      end_date = null,
      notes = '',
      sort_order = 0,
    } = req.body as {
      ins_type?: string
      provider?: string
      policy_number?: string
      coverage_amount_cents?: number
      premium_cents?: number
      start_date?: string | null
      end_date?: string | null
      notes?: string
      sort_order?: number
    }
    const fehler = laufzeitFehler(start_date, end_date)
    if (fehler) return res.status(400).json({ data: null, error: fehler })
    const result = await db.run(`
      INSERT INTO insurances (project_id, ins_type, provider, policy_number, coverage_amount_cents, premium_cents, start_date, end_date, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, ins_type, provider, policy_number, coverage_amount_cents, premium_cents, start_date, end_date, notes, sort_order])
    const row = await db.get('SELECT * FROM insurances WHERE id = ?', [result.id])
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[insurances POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/insurances/:id
router.put('/projects/:projectId/insurances/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    // Nur eine Zeile aus dem Projekt im Pfad. Sonst ließ sich über eine
    // fremde Kennung die Zeile eines anderen Projekts ändern und auslesen.
    const existing = await db.get('SELECT * FROM insurances WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
    if (!existing) return res.status(404).json({ data: null, error: 'Versicherung nicht gefunden' })

    const {
      ins_type,
      provider,
      policy_number,
      coverage_amount_cents,
      premium_cents,
      start_date,
      end_date,
      notes,
      sort_order,
    } = req.body as {
      ins_type?: string
      provider?: string
      policy_number?: string
      coverage_amount_cents?: number
      premium_cents?: number
      start_date?: string | null
      end_date?: string | null
      notes?: string
      sort_order?: number
    }
    // Gegen das, was nach dem Ändern dasteht
    const fehler = laufzeitFehler(start_date ?? existing.start_date, end_date ?? existing.end_date)
    if (fehler) return res.status(400).json({ data: null, error: fehler })

    await db.run(`
      UPDATE insurances SET
        ins_type = COALESCE(?, ins_type),
        provider = COALESCE(?, provider),
        policy_number = COALESCE(?, policy_number),
        coverage_amount_cents = COALESCE(?, coverage_amount_cents),
        premium_cents = COALESCE(?, premium_cents),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        notes = COALESCE(?, notes),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `, [
      ins_type ?? null,
      provider ?? null,
      policy_number ?? null,
      coverage_amount_cents ?? null,
      premium_cents ?? null,
      start_date ?? null,
      end_date ?? null,
      notes ?? null,
      sort_order ?? null,
      id
    ])

    const row = await db.get('SELECT * FROM insurances WHERE id = ?', [id])
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[insurances PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/insurances/:id
router.delete('/projects/:projectId/insurances/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    // Nur aus dem Projekt im Pfad: sonst löschte eine fremde Kennung im fremden Projekt
    const result = await db.run('DELETE FROM insurances WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Versicherung nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[insurances DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
