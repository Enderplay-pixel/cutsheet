import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

async function recalcBudgetTotal(versionId: number) {
  const row = await db.get('SELECT COALESCE(SUM(total_cents), 0) as s FROM budget_lines WHERE budget_version_id = ?', [versionId])
  const total = (row as any).s
  await db.run("UPDATE budget_versions SET total_cents = ?, updated_at = datetime('now') WHERE id = ?", [total, versionId])
  return total
}

// GET /api/projects/:projectId/budget-alerts
router.get('/projects/:projectId/budget-alerts', async (req, res) => {
  const pid = req.params.projectId
  const row = await db.get('SELECT * FROM budget_alerts WHERE project_id = ?', [pid]) as any
  if (!row) {
    return res.json({ data: { project_id: Number(pid), threshold_percent: 80, enabled: false }, error: null })
  }
  res.json({ data: { ...row, enabled: !!row.enabled }, error: null })
})

// PUT /api/projects/:projectId/budget-alerts
router.put('/projects/:projectId/budget-alerts', async (req, res) => {
  const pid = req.params.projectId
  const { threshold_percent = 80, enabled = true } = req.body

  const existing = await db.get('SELECT id FROM budget_alerts WHERE project_id = ?', [pid])
  if (existing) {
    await db.run('UPDATE budget_alerts SET threshold_percent = ?, enabled = ? WHERE project_id = ?',
      [threshold_percent, enabled ? 1 : 0, pid])
  } else {
    await db.run('INSERT INTO budget_alerts (project_id, threshold_percent, enabled) VALUES (?, ?, ?)',
      [pid, threshold_percent, enabled ? 1 : 0])
  }

  const row = await db.get('SELECT * FROM budget_alerts WHERE project_id = ?', [pid]) as any
  res.json({ data: { ...row, enabled: !!row.enabled }, error: null })
})

// GET /api/projects/:projectId/budget-summary
router.get('/projects/:projectId/budget-summary', async (req, res) => {
  const pid = req.params.projectId

  const budgetRow = await db.get('SELECT COALESCE(MAX(total_cents), 0) as total FROM budget_versions WHERE project_id = ? AND status = "Aktiv"', [pid]) as any
  const spentRow = await db.get(`
    SELECT COALESCE(SUM(bl.total_cents), 0) as spent
    FROM budget_lines bl
    JOIN budget_versions bv ON bl.budget_version_id = bv.id
    WHERE bv.project_id = ? AND bv.status = 'Aktiv'
  `, [pid]) as any

  const budget_total = budgetRow.total
  const total_spent = spentRow.spent
  const current_percent = budget_total > 0 ? Math.round((total_spent / budget_total) * 100) : 0

  const alertConfig = await db.get('SELECT * FROM budget_alerts WHERE project_id = ?', [pid]) as any
  const threshold = alertConfig?.threshold_percent ?? 80
  const alertEnabled = alertConfig ? !!alertConfig.enabled : false
  const triggered = alertEnabled && budget_total > 0 && current_percent >= threshold

  const result: any = {
    budget_total_cents: budget_total,
    total_spent_cents: total_spent,
    current_percent,
  }

  if (triggered) {
    result.alert = { triggered: true, threshold, current_percent }
  }

  res.json({ data: result, error: null })
})

// GET /api/projects/:projectId/budget-versions
router.get('/projects/:projectId/budget-versions', async (req, res) => {
  const versions = await db.all('SELECT * FROM budget_versions WHERE project_id = ? ORDER BY created_at DESC', [req.params.projectId])
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/budget-versions
router.post('/projects/:projectId/budget-versions', async (req, res) => {
  const { name = 'Neue Kalkulation', status = 'Entwurf' } = req.body
  const result = await db.run('INSERT INTO budget_versions (project_id, name, status) VALUES (?, ?, ?)', [req.params.projectId, name, status])
  res.status(201).json({ data: await db.get('SELECT * FROM budget_versions WHERE id = ?', [result.id]), error: null })
})

// GET /api/budget-versions/:id/lines
router.get('/budget-versions/:id/lines', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const version = await db.get('SELECT project_id FROM budget_versions WHERE id = ?', [req.params.id]) as any
    if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
    if (getUserProjectRole(user.id, version.project_id) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const lines = await db.all('SELECT * FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order ASC, account_code ASC', [req.params.id])
  res.json({ data: lines, error: null })
})

// POST /api/budget-versions/:id/lines
router.post('/budget-versions/:id/lines', async (req, res) => {
  const { category = '', account_code = '', description = '', unit = 'Pauschal', quantity = 1, unit_price_cents = 0, notes = '' } = req.body
  const total_cents = Math.round(quantity * unit_price_cents)
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM budget_lines WHERE budget_version_id = ?', [req.params.id])
  const maxSort = (maxSortRow as any).m
  const result = await db.run('INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, maxSort + 1])
  await recalcBudgetTotal(parseInt(req.params.id))
  res.status(201).json({ data: await db.get('SELECT * FROM budget_lines WHERE id = ?', [result.id]), error: null })
})

// PUT /api/budget-lines/:id
router.put('/budget-lines/:id', async (req, res) => {
  const { category, account_code, description, unit, quantity, unit_price_cents, notes } = req.body
  const total_cents = Math.round((quantity || 0) * (unit_price_cents || 0))
  await db.run('UPDATE budget_lines SET category=?, account_code=?, description=?, unit=?, quantity=?, unit_price_cents=?, total_cents=?, notes=? WHERE id=?', [category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, req.params.id])
  const line = await db.get('SELECT * FROM budget_lines WHERE id = ?', [req.params.id]) as any
  if (line) await recalcBudgetTotal(line.budget_version_id)
  res.json({ data: line, error: null })
})

// DELETE /api/budget-lines/:id
router.delete('/budget-lines/:id', async (req, res) => {
  const line = await db.get('SELECT * FROM budget_lines WHERE id = ?', [req.params.id]) as any
  await db.run('DELETE FROM budget_lines WHERE id = ?', [req.params.id])
  if (line) await recalcBudgetTotal(line.budget_version_id)
  res.json({ data: { ok: true }, error: null })
})

// POST /api/budget-versions/:id/pull-crew
router.post('/budget-versions/:id/pull-crew', async (req, res) => {
  const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const crew = await db.all('SELECT * FROM crew WHERE project_id = ? AND contract_type = "Tagesgage"', [version.project_id]) as any[]
  const shootDaysRow = await db.get('SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ?', [version.project_id])
  const shootDays = (shootDaysRow as any).c

  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM budget_lines WHERE budget_version_id = ?', [req.params.id])
  const maxSort = (maxSortRow as any).m
  for (let i = 0; i < crew.length; i++) {
    const c = crew[i]
    const total = c.fee_per_day * shootDays
    await db.run('INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.id, `${c.department}`, `AUTO`, `${c.name} — ${c.role}`, 'Tage', shootDays, c.fee_per_day, total, maxSort + 1 + i])
  }
  await recalcBudgetTotal(parseInt(req.params.id))
  res.json({ data: { added: crew.length }, error: null })
})

// POST /api/budget-versions/:id/pull-cast
router.post('/budget-versions/:id/pull-cast', async (req, res) => {
  const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const cast = await db.all('SELECT ca.*, ch.name as char_name FROM cast ca LEFT JOIN characters ch ON ca.character_id = ch.id WHERE ca.project_id = ? AND ca.contract_type = "Tagesgage"', [version.project_id]) as any[]
  const shootDaysRow = await db.get('SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ?', [version.project_id])
  const shootDays = (shootDaysRow as any).c

  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM budget_lines WHERE budget_version_id = ?', [req.params.id])
  const maxSort = (maxSortRow as any).m
  for (let i = 0; i < cast.length; i++) {
    const c = cast[i]
    const total = c.fee_per_day * shootDays
    await db.run('INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.id, 'Darstellung', 'AUTO', `${c.actor_name}${c.char_name ? ` als ${c.char_name}` : ''}`, 'Tage', shootDays, c.fee_per_day, total, maxSort + 1 + i])
  }
  await recalcBudgetTotal(parseInt(req.params.id))
  res.json({ data: { added: cast.length }, error: null })
})

// GET /api/projects/:projectId/financing-versions
router.get('/projects/:projectId/financing-versions', async (req, res) => {
  const versions = await db.all('SELECT * FROM financing_plan_versions WHERE project_id = ? ORDER BY created_at DESC', [req.params.projectId])
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/financing-versions
router.post('/projects/:projectId/financing-versions', async (req, res) => {
  const { name = 'Finanzierungsplan' } = req.body
  const result = await db.run('INSERT INTO financing_plan_versions (project_id, name) VALUES (?, ?)', [req.params.projectId, name])
  res.status(201).json({ data: await db.get('SELECT * FROM financing_plan_versions WHERE id = ?', [result.id]), error: null })
})

// GET /api/financing-versions/:id/entries
router.get('/financing-versions/:id/entries', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const version = await db.get('SELECT project_id FROM financing_plan_versions WHERE id = ?', [req.params.id]) as any
    if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
    if (getUserProjectRole(user.id, version.project_id) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const entries = await db.all('SELECT * FROM financing_entries WHERE financing_version_id = ? ORDER BY sort_order ASC', [req.params.id])
  const parsed = (entries as any[]).map(e => ({ ...e, confirmed: !!e.confirmed }))
  res.json({ data: parsed, error: null })
})

// POST /api/financing-versions/:id/entries
router.post('/financing-versions/:id/entries', async (req, res) => {
  const { source = '', type = 'Förderung', amount_cents = 0, confirmed = false, notes = '' } = req.body
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM financing_entries WHERE financing_version_id = ?', [req.params.id])
  const maxSort = (maxSortRow as any).m
  const result = await db.run('INSERT INTO financing_entries (financing_version_id, source, type, amount_cents, confirmed, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.params.id, source, type, amount_cents, confirmed ? 1 : 0, notes, maxSort + 1])

  // Recalc total
  const totalRow = await db.get('SELECT COALESCE(SUM(amount_cents), 0) as s FROM financing_entries WHERE financing_version_id = ?', [req.params.id])
  const total = (totalRow as any).s
  await db.run('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?', [total, req.params.id])

  const row = await db.get('SELECT * FROM financing_entries WHERE id = ?', [result.id]) as any
  res.status(201).json({ data: { ...row, confirmed: !!row.confirmed }, error: null })
})

// PUT /api/financing-entries/:id
router.put('/financing-entries/:id', async (req, res) => {
  const { source, type, amount_cents, confirmed, notes } = req.body
  await db.run('UPDATE financing_entries SET source=?, type=?, amount_cents=?, confirmed=?, notes=? WHERE id=?', [source, type, amount_cents, confirmed ? 1 : 0, notes, req.params.id])
  const entry = await db.get('SELECT * FROM financing_entries WHERE id = ?', [req.params.id]) as any
  // Recalc total
  const totalRow = await db.get('SELECT COALESCE(SUM(amount_cents), 0) as s FROM financing_entries WHERE financing_version_id = ?', [entry.financing_version_id])
  const total = (totalRow as any).s
  await db.run('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?', [total, entry.financing_version_id])
  res.json({ data: { ...entry, confirmed: !!entry.confirmed }, error: null })
})

// DELETE /api/financing-entries/:id
router.delete('/financing-entries/:id', async (req, res) => {
  const entry = await db.get('SELECT * FROM financing_entries WHERE id = ?', [req.params.id]) as any
  await db.run('DELETE FROM financing_entries WHERE id = ?', [req.params.id])
  if (entry) {
    const totalRow = await db.get('SELECT COALESCE(SUM(amount_cents), 0) as s FROM financing_entries WHERE financing_version_id = ?', [entry.financing_version_id])
    const total = (totalRow as any).s
    await db.run('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?', [total, entry.financing_version_id])
  }
  res.json({ data: { ok: true }, error: null })
})

export default router
