import { Router, Request, Response } from 'express'
import * as kosten from '../lib/kostenquellen'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'

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

  // Doppelte Anfuehrungszeichen sind in Postgres ein BEZEICHNER, kein Text:
  // status = "Aktiv" suchte eine Spalte namens Aktiv. Die Auswertung
  // antwortete deshalb bei JEDEM Projekt mit 500 - und mit ihr der
  // Budgetalarm, der nie ausgeloest hat.
  const budgetRow = await db.get("SELECT COALESCE(MAX(total_cents), 0) as total FROM budget_versions WHERE project_id = ? AND status = 'Aktiv'", [pid]) as any
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
router.get('/budget-versions/:id/lines', requireMemberVia(projectIdFromTable('budget_versions', 'id')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const version = await db.get('SELECT project_id FROM budget_versions WHERE id = ?', [req.params.id]) as any
    if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
    if ((await getUserProjectRole(user.id, version.project_id)) === null)
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

// POST /api/budget-versions/:id/kosten-uebernehmen
//
// Ersetzt die frueheren Routen pull-crew und pull-cast. Die waren aus drei
// Gruenden unbrauchbar:
//   1. `contract_type = "Tagesgage"` - doppelte Anfuehrungszeichen sind in
//      Postgres ein BEZEICHNER. Die Abfrage suchte eine Spalte namens
//      Tagesgage und lief auf HTTP 500.
//   2. Jede Person bekam ALLE Drehtage des Projekts angerechnet, nicht ihre
//      eigenen. Wer in einer Szene mitspielt, kostete den ganzen Dreh.
//   3. Zweimal aufgerufen standen alle Zeilen doppelt drin.
//
// Diese Route ist wiederholbar: erzeugte Zeilen tragen einen
// Herkunftsschluessel, handgeschriebene bleiben unangetastet.
router.post('/budget-versions/:id/kosten-uebernehmen', async (req, res) => {
  const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const pid = version.project_id
  const nurZeigen = Boolean(req.body?.nurZeigen)

  // Arbeitstage je Person - aus den Tagesdispos, wie im Gagen-Export.
  // Wer auf keiner Dispo steht, hat null Tage und bekommt keine Zeile.
  async function tageJePerson(art: 'cast' | 'crew'): Promise<Map<number, number>> {
    const zeilen = await db.all(
      `SELECT cse.person_id AS pid, COUNT(DISTINCT sd.id) AS tage
       FROM call_sheet_entries cse
       JOIN call_sheets cs ON cse.call_sheet_id = cs.id
       JOIN shoot_days sd ON cs.shoot_day_id = sd.id
       WHERE cse.person_type = ? AND sd.project_id = ?
       GROUP BY cse.person_id`,
      [art, pid]
    ) as any[]
    return new Map(zeilen.map(z => [Number(z.pid), Number(z.tage)]))
  }

  const besetzung = await db.all(
    `SELECT c.id, c.actor_name AS name, ch.name AS rolle, c.fee_per_day
     FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id
     WHERE c.project_id = ?`, [pid]) as any[]
  const stab = await db.all(
    'SELECT id, name, role AS rolle, fee_per_day FROM crew WHERE project_id = ?', [pid]) as any[]
  const equipment = await db.all(
    `SELECT ei.id, ei.item AS name, ei.quantity, ei.total_days AS days,
            ei.rental_per_day_cents, ei.total_cents
     FROM equipment_items ei
     JOIN equipment_lists el ON ei.equipment_list_id = el.id
     WHERE el.project_id = ?`, [pid]) as any[]
  const policen = await db.all(
    'SELECT id, ins_type AS type, provider, premium_cents FROM insurances WHERE project_id = ?', [pid]) as any[]

  const castTage = await tageJePerson('cast')
  const stabTage = await tageJePerson('crew')

  const soll = [
    ...kosten.gagenPosten(besetzung, castTage, 'cast'),
    ...kosten.gagenPosten(stab, stabTage, 'crew'),
    ...kosten.equipmentPosten(equipment),
    ...kosten.versicherungsPosten(policen),
  ]

  // Wer eine Gage hat, aber auf keiner Dispo steht, faellt still heraus.
  // Das muss man sehen, sonst sucht man den fehlenden Posten vergeblich.
  const ohneDrehtag = [...besetzung.map(x => ({ ...x, art: 'cast' as const })),
                       ...stab.map(x => ({ ...x, art: 'crew' as const }))]
    .filter(x => (kosten.zahl(x.fee_per_day) ?? 0) > 0
              && ((x.art === 'cast' ? castTage : stabTage).get(Number(x.id)) ?? 0) === 0)
    .map(x => String(x.name ?? '').trim() || 'Ohne Namen')

  const vorhanden = await db.all(
    'SELECT id, source_key, description, quantity, unit_price_cents, total_cents FROM budget_lines WHERE budget_version_id = ?',
    [req.params.id]) as any[]
  const plan = kosten.abgleiche(vorhanden, soll)

  if (!nurZeigen) {
    const maxRow = await db.get(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM budget_lines WHERE budget_version_id = ?',
      [req.params.id]) as any
    let sort = Number(maxRow?.m ?? 0)

    for (const n of plan.neu) {
      sort++
      await db.run(
        `INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit,
         quantity, unit_price_cents, total_cents, sort_order, source_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.params.id, n.kategorie, '', n.beschreibung, n.einheit,
         n.menge, n.einzelpreis_cent, n.gesamt_cent, sort, n.schluessel])
    }
    for (const g of plan.geaendert) {
      await db.run(
        `UPDATE budget_lines SET category = ?, description = ?, unit = ?, quantity = ?,
         unit_price_cents = ?, total_cents = ? WHERE id = ?`,
        [g.posten.kategorie, g.posten.beschreibung, g.posten.einheit, g.posten.menge,
         g.posten.einzelpreis_cent, g.posten.gesamt_cent, g.id])
    }
    for (const id of plan.entfallen) {
      await db.run('DELETE FROM budget_lines WHERE id = ?', [id])
    }
    await recalcBudgetTotal(parseInt(req.params.id))
  }

  res.json({
    data: {
      nurZeigen,
      neu: plan.neu.length,
      geaendert: plan.geaendert.length,
      entfallen: plan.entfallen.length,
      unveraendert: plan.unveraendert,
      summe_cent: soll.reduce((s, p) => s + p.gesamt_cent, 0),
      ohne_drehtag: ohneDrehtag,
      posten: plan.neu.concat(plan.geaendert.map(g => g.posten)),
    },
    error: null,
  })
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
router.get('/financing-versions/:id/entries', requireMemberVia(projectIdFromTable('financing_plan_versions', 'id')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const version = await db.get('SELECT project_id FROM financing_plan_versions WHERE id = ?', [req.params.id]) as any
    if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
    if ((await getUserProjectRole(user.id, version.project_id)) === null)
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
