import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { loeschePersonenspuren } from '../lib/person'
import { dispoFuerDrehtag } from '../lib/dispo'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

/**
 * Komparsen mit ihren Drehtagen. Zugeordnet wird über die Dispo des Tages -
 * dort stehen sie mit Call-Zeit, und dort lesen Vertrag (Drehtage, Gesamtgage),
 * Jugendschutzprüfung, Verpflegung und Check-in.
 */
const MIT_DREHTAGEN = `SELECT e.*,
    COALESCE((SELECT array_agg(DISTINCT cs.shoot_day_id)
                FROM call_sheet_entries cse JOIN call_sheets cs ON cse.call_sheet_id = cs.id
               WHERE cse.person_type = 'extra' AND cse.person_id = e.id), '{}') AS drehtage
  FROM extras e`

// GET /api/projects/:projectId/extras
router.get('/projects/:projectId/extras', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const rows = await db.all(`${MIT_DREHTAGEN} WHERE e.project_id = ? ORDER BY e.id ASC`, [projectId])
  return res.json({ data: rows, error: null })
})

// PUT /api/projects/:projectId/extras/:id/drehtage - { drehtage: [Drehtag-Kennungen] }
router.put('/projects/:projectId/extras/:id/drehtage', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const drehtage = req.body?.drehtage
  if (!Array.isArray(drehtage) || !drehtage.every((t: unknown) => Number.isInteger(t))) {
    return res.status(400).json({ data: null, error: 'drehtage muss eine Liste von Drehtag-Kennungen sein' })
  }
  const extra = await db.get('SELECT id FROM extras WHERE id = ? AND project_id = ?', [id, projectId])
  if (!extra) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })
  const gueltig = await db.all('SELECT id FROM shoot_days WHERE project_id = ? AND id = ANY(?::int[])', [projectId, drehtage]) as any[]
  if (gueltig.length !== new Set(drehtage).size) {
    return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
  }

  // Abgewählte Tage: aus deren Dispo nehmen
  await db.run(
    `DELETE FROM call_sheet_entries cse USING call_sheets cs, shoot_days sd
      WHERE cse.call_sheet_id = cs.id AND cs.shoot_day_id = sd.id AND sd.project_id = ?
        AND cse.person_type = 'extra' AND cse.person_id = ? AND NOT (cs.shoot_day_id = ANY(?::int[]))`,
    [projectId, id, drehtage]
  )
  // Gewählte Tage: in die Dispo, mit der allgemeinen Call-Zeit des Tages
  for (const tagId of new Set<number>(drehtage)) {
    const dispo = await dispoFuerDrehtag(tagId)
    if (!dispo) continue
    const steht = await db.get(
      "SELECT id FROM call_sheet_entries WHERE call_sheet_id = ? AND person_type = 'extra' AND person_id = ?", [dispo.id, id]
    )
    if (steht) continue
    const ende = await db.get('SELECT COALESCE(MAX(sort_order), -1) AS m FROM call_sheet_entries WHERE call_sheet_id = ?', [dispo.id]) as any
    await db.run(
      "INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order) VALUES (?, 'extra', ?, ?, ?)",
      [dispo.id, id, dispo.general_call, Number(ende.m) + 1]
    )
  }
  const row = await db.get(`${MIT_DREHTAGEN} WHERE e.id = ?`, [id])
  return res.json({ data: row, error: null })
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
  const row = await db.get(`${MIT_DREHTAGEN} WHERE e.id = ?`, [result.id])
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

  const row = await db.get(`${MIT_DREHTAGEN} WHERE e.id = ?`, [id])
  return res.json({ data: row, error: null })
})

// DELETE /api/projects/:projectId/extras/:id
router.delete('/projects/:projectId/extras/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur aus dem Projekt im Pfad: sonst löschte eine fremde Kennung im fremden Projekt
  const vorhanden = await db.get('SELECT id FROM extras WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (!vorhanden) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })
  // Dispo-Einträge, Zeiten und Verpflegung hängen ohne Fremdschlüssel dran
  await loeschePersonenspuren('extra', id)
  await db.run('DELETE FROM extras WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  return res.json({ data: { id }, error: null })
})

export default router
