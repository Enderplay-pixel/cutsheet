import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { loeschePersonenspuren } from '../lib/person'
import { unitDesProjekts } from '../lib/units'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

/**
 * Die Unit einer Person des Stabs (AP C2): eine Unit des Projekts, leer für
 * die Haupteinheit, oder alle Units. Was nicht mitkommt, bleibt.
 */
async function unitAngaben(body: any, vorher: any, projectId: number | string) {
  const alle = body?.all_units === undefined ? Boolean(vorher?.all_units) : body.all_units === true
  let unitId: number | null = vorher?.unit_id ?? null
  if (body?.unit_id !== undefined) {
    if (body.unit_id === null || body.unit_id === '') unitId = null
    else {
      const unit = await unitDesProjekts(db, projectId, body.unit_id)
      if (!unit) return { fehler: 'Die Unit gehört nicht zu diesem Projekt' }
      unitId = unit.id
    }
  }
  return { unit_id: alle ? null : unitId, all_units: alle }
}

// GET /api/projects/:projectId/crew
router.get('/projects/:projectId/crew', async (req, res) => {
  const crew = await db.all('SELECT * FROM crew WHERE project_id = ? ORDER BY department ASC, sort_order ASC, name ASC', [req.params.projectId])
  res.json({ data: crew, error: null })
})

// POST /api/projects/:projectId/crew
router.post('/projects/:projectId/crew', async (req, res) => {
  const { name = '', department = '', role = '', email = '', phone = '', fee_per_day = 0, contract_type = 'Tagesgage', availability_notes = '', notes = '' } = req.body
  const unit = await unitAngaben(req.body, null, req.params.projectId)
  if ('fehler' in unit) return res.status(400).json({ data: null, error: unit.fehler })
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM crew WHERE project_id = ? AND department = ?', [req.params.projectId, department]) as any
  const maxSort = maxSortRow.m
  const result = await db.run(`
    INSERT INTO crew (project_id, name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, sort_order, unit_id, all_units)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.projectId, name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, maxSort + 1, unit.unit_id, unit.all_units])
  res.status(201).json({ data: await db.get('SELECT * FROM crew WHERE id = ?', [result.id]), error: null })
})

// PUT /api/crew/:id
router.put('/crew/:id', async (req, res) => {
  // Gemessen am 25.10.2026: Ein Eintrag, den es nicht gibt, ergab 200 ohne Daten.
  const vorher = await db.get('SELECT id, project_id, unit_id, all_units FROM crew WHERE id = ?', [req.params.id]) as any
  if (!vorher) {
    return res.status(404).json({ data: null, error: 'Person nicht gefunden' })
  }
  const unit = await unitAngaben(req.body, vorher, vorher.project_id)
  if ('fehler' in unit) return res.status(400).json({ data: null, error: unit.fehler })
  const { name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes } = req.body
  // Wochengage, Vor- und Abwicklungstage (AP B1). Ohne Angabe bleibt, was war -
  // die Gage fehlt bei Rollen ohne Gagenrecht, weil der Gagenschutz sie streicht
  const tage = (w: unknown) => (w === undefined || w === null || w === '' ? null : Number(w))
  for (const w of [req.body.prep_days, req.body.wrap_days]) {
    const n = tage(w)
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 366)) return res.status(400).json({ data: null, error: 'Vor- und Abwicklungstage sind ganze Zahlen von 0 bis 366' })
  }
  await db.run(`
    UPDATE crew SET name=?, department=?, role=?, email=?, phone=?, fee_per_day=COALESCE(?, fee_per_day), contract_type=?, availability_notes=?, notes=?,
      fee_per_week=COALESCE(?, fee_per_week), prep_days=COALESCE(?, prep_days), wrap_days=COALESCE(?, wrap_days),
      unit_id=?, all_units=?
    WHERE id=?
  `, [name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes,
      req.body.fee_per_week ?? null, tage(req.body.prep_days), tage(req.body.wrap_days), unit.unit_id, unit.all_units, req.params.id])
  res.json({ data: await db.get('SELECT * FROM crew WHERE id = ?', [req.params.id]), error: null })
})

// DELETE /api/crew/:id
router.delete('/crew/:id', async (req, res) => {
  await loeschePersonenspuren('crew', req.params.id)
  await db.run('DELETE FROM crew WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
