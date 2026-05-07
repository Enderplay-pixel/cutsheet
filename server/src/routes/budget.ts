import { Router } from 'express'
import { db } from '../db'

const router = Router()

function recalcBudgetTotal(versionId: number) {
  const total = (db.prepare('SELECT COALESCE(SUM(total_cents), 0) as s FROM budget_lines WHERE budget_version_id = ?').get(versionId) as any).s
  db.prepare("UPDATE budget_versions SET total_cents = ?, updated_at = datetime('now') WHERE id = ?").run(total, versionId)
  return total
}

// GET /api/projects/:projectId/budget-versions
router.get('/projects/:projectId/budget-versions', (req, res) => {
  const versions = db.prepare('SELECT * FROM budget_versions WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId)
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/budget-versions
router.post('/projects/:projectId/budget-versions', (req, res) => {
  const { name = 'Neue Kalkulation', status = 'Entwurf' } = req.body
  const result = db.prepare('INSERT INTO budget_versions (project_id, name, status) VALUES (?, ?, ?)').run(req.params.projectId, name, status)
  res.status(201).json({ data: db.prepare('SELECT * FROM budget_versions WHERE id = ?').get(result.lastInsertRowid), error: null })
})

// GET /api/budget-versions/:id/lines
router.get('/budget-versions/:id/lines', (req, res) => {
  const lines = db.prepare('SELECT * FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order ASC, account_code ASC').all(req.params.id)
  res.json({ data: lines, error: null })
})

// POST /api/budget-versions/:id/lines
router.post('/budget-versions/:id/lines', (req, res) => {
  const { category = '', account_code = '', description = '', unit = 'Pauschal', quantity = 1, unit_price_cents = 0, notes = '' } = req.body
  const total_cents = Math.round(quantity * unit_price_cents)
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM budget_lines WHERE budget_version_id = ?').get(req.params.id) as any).m
  const result = db.prepare('INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, maxSort + 1)
  recalcBudgetTotal(parseInt(req.params.id))
  res.status(201).json({ data: db.prepare('SELECT * FROM budget_lines WHERE id = ?').get(result.lastInsertRowid), error: null })
})

// PUT /api/budget-lines/:id
router.put('/budget-lines/:id', (req, res) => {
  const { category, account_code, description, unit, quantity, unit_price_cents, notes } = req.body
  const total_cents = Math.round((quantity || 0) * (unit_price_cents || 0))
  db.prepare('UPDATE budget_lines SET category=?, account_code=?, description=?, unit=?, quantity=?, unit_price_cents=?, total_cents=?, notes=? WHERE id=?').run(category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, req.params.id)
  const line = db.prepare('SELECT * FROM budget_lines WHERE id = ?').get(req.params.id) as any
  if (line) recalcBudgetTotal(line.budget_version_id)
  res.json({ data: line, error: null })
})

// DELETE /api/budget-lines/:id
router.delete('/budget-lines/:id', (req, res) => {
  const line = db.prepare('SELECT * FROM budget_lines WHERE id = ?').get(req.params.id) as any
  db.prepare('DELETE FROM budget_lines WHERE id = ?').run(req.params.id)
  if (line) recalcBudgetTotal(line.budget_version_id)
  res.json({ data: { ok: true }, error: null })
})

// POST /api/budget-versions/:id/pull-crew
router.post('/budget-versions/:id/pull-crew', (req, res) => {
  const version = db.prepare('SELECT * FROM budget_versions WHERE id = ?').get(req.params.id) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const crew = db.prepare('SELECT * FROM crew WHERE project_id = ? AND contract_type = "Tagesgage"').all(version.project_id) as any[]
  const shootDays = (db.prepare('SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ?').get(version.project_id) as any).c

  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM budget_lines WHERE budget_version_id = ?').get(req.params.id) as any).m
  crew.forEach((c: any, i: number) => {
    const total = c.fee_per_day * shootDays
    db.prepare('INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.id, `${c.department}`, `AUTO`, `${c.name} — ${c.role}`, 'Tage', shootDays, c.fee_per_day, total, maxSort + 1 + i)
  })
  recalcBudgetTotal(parseInt(req.params.id))
  res.json({ data: { added: crew.length }, error: null })
})

// POST /api/budget-versions/:id/pull-cast
router.post('/budget-versions/:id/pull-cast', (req, res) => {
  const version = db.prepare('SELECT * FROM budget_versions WHERE id = ?').get(req.params.id) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const cast = db.prepare('SELECT ca.*, ch.name as char_name FROM cast ca LEFT JOIN characters ch ON ca.character_id = ch.id WHERE ca.project_id = ? AND ca.contract_type = "Tagesgage"').all(version.project_id) as any[]
  const shootDays = (db.prepare('SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ?').get(version.project_id) as any).c

  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM budget_lines WHERE budget_version_id = ?').get(req.params.id) as any).m
  cast.forEach((c: any, i: number) => {
    const total = c.fee_per_day * shootDays
    db.prepare('INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.id, 'Darstellung', 'AUTO', `${c.actor_name}${c.char_name ? ` als ${c.char_name}` : ''}`, 'Tage', shootDays, c.fee_per_day, total, maxSort + 1 + i)
  })
  recalcBudgetTotal(parseInt(req.params.id))
  res.json({ data: { added: cast.length }, error: null })
})

// GET /api/projects/:projectId/financing-versions
router.get('/projects/:projectId/financing-versions', (req, res) => {
  const versions = db.prepare('SELECT * FROM financing_plan_versions WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId)
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/financing-versions
router.post('/projects/:projectId/financing-versions', (req, res) => {
  const { name = 'Finanzierungsplan' } = req.body
  const result = db.prepare('INSERT INTO financing_plan_versions (project_id, name) VALUES (?, ?)').run(req.params.projectId, name)
  res.status(201).json({ data: db.prepare('SELECT * FROM financing_plan_versions WHERE id = ?').get(result.lastInsertRowid), error: null })
})

// GET /api/financing-versions/:id/entries
router.get('/financing-versions/:id/entries', (req, res) => {
  const entries = db.prepare('SELECT * FROM financing_entries WHERE financing_version_id = ? ORDER BY sort_order ASC').all(req.params.id)
  const parsed = (entries as any[]).map(e => ({ ...e, confirmed: !!e.confirmed }))
  res.json({ data: parsed, error: null })
})

// POST /api/financing-versions/:id/entries
router.post('/financing-versions/:id/entries', (req, res) => {
  const { source = '', type = 'Förderung', amount_cents = 0, confirmed = false, notes = '' } = req.body
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM financing_entries WHERE financing_version_id = ?').get(req.params.id) as any).m
  const result = db.prepare('INSERT INTO financing_entries (financing_version_id, source, type, amount_cents, confirmed, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(req.params.id, source, type, amount_cents, confirmed ? 1 : 0, notes, maxSort + 1)

  // Recalc total
  const total = (db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as s FROM financing_entries WHERE financing_version_id = ?').get(req.params.id) as any).s
  db.prepare('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?').run(total, req.params.id)

  const row = db.prepare('SELECT * FROM financing_entries WHERE id = ?').get(result.lastInsertRowid) as any
  res.status(201).json({ data: { ...row, confirmed: !!row.confirmed }, error: null })
})

// PUT /api/financing-entries/:id
router.put('/financing-entries/:id', (req, res) => {
  const { source, type, amount_cents, confirmed, notes } = req.body
  db.prepare('UPDATE financing_entries SET source=?, type=?, amount_cents=?, confirmed=?, notes=? WHERE id=?').run(source, type, amount_cents, confirmed ? 1 : 0, notes, req.params.id)
  const entry = db.prepare('SELECT * FROM financing_entries WHERE id = ?').get(req.params.id) as any
  // Recalc total
  const total = (db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as s FROM financing_entries WHERE financing_version_id = ?').get(entry.financing_version_id) as any).s
  db.prepare('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?').run(total, entry.financing_version_id)
  res.json({ data: { ...entry, confirmed: !!entry.confirmed }, error: null })
})

// DELETE /api/financing-entries/:id
router.delete('/financing-entries/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM financing_entries WHERE id = ?').get(req.params.id) as any
  db.prepare('DELETE FROM financing_entries WHERE id = ?').run(req.params.id)
  if (entry) {
    const total = (db.prepare('SELECT COALESCE(SUM(amount_cents), 0) as s FROM financing_entries WHERE financing_version_id = ?').get(entry.financing_version_id) as any).s
    db.prepare('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?').run(total, entry.financing_version_id)
  }
  res.json({ data: { ok: true }, error: null })
})

export default router
