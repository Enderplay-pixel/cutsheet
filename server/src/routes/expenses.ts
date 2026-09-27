import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// Kostenstand: Ist-Kosten (Belege) gegen die aktive Kalkulation (PreProducer-Parität)

// GET /api/projects/:projectId/expenses
router.get('/projects/:projectId/expenses', requireAuth, requireMember, async (req: Request, res: Response) => {
  const rows = await db.all(
    'SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC NULLS LAST, id DESC',
    [req.params.projectId]
  )
  return res.json({ data: rows, error: null })
})

// POST /api/projects/:projectId/expenses
router.post('/projects/:projectId/expenses', requireAuth, requireMember, async (req: Request, res: Response) => {
  const { description, category, amount_cents, receipt_no, expense_date, budget_line_id, paid } = req.body as any
  if (!description?.trim()) return res.status(400).json({ data: null, error: 'Beschreibung erforderlich' })
  const amount = Math.round(Number(amount_cents) || 0)

  const result = await db.run(
    `INSERT INTO expenses (project_id, description, category, amount_cents, receipt_no, expense_date, budget_line_id, paid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.projectId, description.trim(), category || '', amount, receipt_no || '',
     expense_date || null, budget_line_id || null, paid !== false]
  )
  const row = await db.get('SELECT * FROM expenses WHERE id = ?', [result.id])
  return res.status(201).json({ data: row, error: null })
})

// PUT /api/expenses/:id
router.put('/expenses/:id', requireAuth, async (req: Request, res: Response) => {
  const existing = await db.get('SELECT * FROM expenses WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Beleg nicht gefunden' })

  const { description, category, amount_cents, receipt_no, expense_date, budget_line_id, paid } = req.body as any
  await db.run(
    `UPDATE expenses SET description = ?, category = ?, amount_cents = ?, receipt_no = ?, expense_date = ?, budget_line_id = ?, paid = ?
     WHERE id = ?`,
    [description?.trim() || existing.description, category ?? existing.category,
     amount_cents !== undefined ? Math.round(Number(amount_cents) || 0) : existing.amount_cents,
     receipt_no ?? existing.receipt_no,
     expense_date !== undefined ? (expense_date || null) : existing.expense_date,
     budget_line_id !== undefined ? (budget_line_id || null) : existing.budget_line_id,
     paid !== undefined ? paid !== false : existing.paid,
     req.params.id]
  )
  const row = await db.get('SELECT * FROM expenses WHERE id = ?', [req.params.id])
  return res.json({ data: row, error: null })
})

// DELETE /api/expenses/:id
router.delete('/expenses/:id', requireAuth, async (req: Request, res: Response) => {
  await db.run('DELETE FROM expenses WHERE id = ?', [req.params.id])
  return res.json({ data: { ok: true }, error: null })
})

// GET /api/projects/:projectId/kostenstand - Soll/Ist je Kategorie gegen aktive Kalkulation
router.get('/projects/:projectId/kostenstand', requireAuth, requireMember, async (req: Request, res: Response) => {
  const activeVersion = await db.get(
    `SELECT id, name, total_cents FROM budget_versions WHERE project_id = ? AND status = 'Aktiv'
     ORDER BY id DESC LIMIT 1`,
    [req.params.projectId]
  ) as any

  const sollByCategory: Record<string, number> = {}
  if (activeVersion) {
    const lines = await db.all(
      'SELECT category, SUM(total_cents) as total FROM budget_lines WHERE budget_version_id = ? GROUP BY category',
      [activeVersion.id]
    ) as Array<{ category: string; total: number }>
    for (const l of lines) sollByCategory[l.category] = Number(l.total) || 0
  }

  const istRows = await db.all(
    'SELECT category, SUM(amount_cents) as total FROM expenses WHERE project_id = ? GROUP BY category',
    [req.params.projectId]
  ) as Array<{ category: string; total: number }>
  const istByCategory: Record<string, number> = {}
  for (const r of istRows) istByCategory[r.category || 'Ohne Kategorie'] = Number(r.total) || 0

  const categories = Array.from(new Set([...Object.keys(sollByCategory), ...Object.keys(istByCategory)])).sort()
  const rows = categories.map(cat => {
    const soll = sollByCategory[cat] || 0
    const ist = istByCategory[cat] || 0
    return { category: cat, soll_cents: soll, ist_cents: ist, diff_cents: soll - ist }
  })

  const sollTotal = rows.reduce((s, r) => s + r.soll_cents, 0)
  const istTotal = rows.reduce((s, r) => s + r.ist_cents, 0)

  return res.json({
    data: {
      budget_version: activeVersion ? { id: activeVersion.id, name: activeVersion.name } : null,
      rows,
      totals: { soll_cents: sollTotal, ist_cents: istTotal, diff_cents: sollTotal - istTotal },
    },
    error: null,
  })
})

export default router
