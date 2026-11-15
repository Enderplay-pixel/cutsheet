import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { massgeblicheKalkulation } from '../lib/kalkulation'
import { auswertung, istKostenart, KOSTENARTEN } from '../lib/ffaSchema'

/**
 * Kostenart eines Belegs (AP B1): 1 bis 11 oder leer. Ohne Angabe, aber mit
 * Kalkulationszeile, gilt die Kostenart der Zeile. undefined heißt Unsinn.
 */
async function kostenartDesBelegs(wert: unknown, zeileId: unknown): Promise<number | null | undefined> {
  if (wert !== undefined && wert !== null && wert !== '') {
    const n = Number(wert)
    return istKostenart(n) ? n : undefined
  }
  if (wert === undefined && zeileId) {
    const z = await db.get('SELECT cost_group FROM budget_lines WHERE id = ?', [zeileId]) as any
    return istKostenart(Number(z?.cost_group)) ? Number(z.cost_group) : null
  }
  return null
}

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
  // Nur eine Kalkulationszeile aus diesem Projekt
  if (budget_line_id) {
    const zeile = await db.get(
      'SELECT bl.id FROM budget_lines bl JOIN budget_versions bv ON bl.budget_version_id = bv.id WHERE bl.id = ? AND bv.project_id = ?',
      [budget_line_id, req.params.projectId]
    )
    if (!zeile) return res.status(404).json({ data: null, error: 'Kalkulationszeile nicht gefunden' })
  }
  const kostenart = await kostenartDesBelegs((req.body as any).cost_group, budget_line_id)
  if (kostenart === undefined) return res.status(400).json({ data: null, error: 'Unbekannte Kostenart' })

  const result = await db.run(
    `INSERT INTO expenses (project_id, description, category, amount_cents, receipt_no, expense_date, budget_line_id, paid, cost_group)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.projectId, description.trim(), category || '', amount, receipt_no || '',
     expense_date || null, budget_line_id || null, paid !== false, kostenart]
  )
  const row = await db.get('SELECT * FROM expenses WHERE id = ?', [result.id])
  return res.status(201).json({ data: row, error: null })
})

// PUT /api/expenses/:id
router.put('/expenses/:id', requireAuth, async (req: Request, res: Response) => {
  const existing = await db.get('SELECT * FROM expenses WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Beleg nicht gefunden' })

  const { description, category, amount_cents, receipt_no, expense_date, budget_line_id, paid } = req.body as any
  // Nur eine Kalkulationszeile aus dem Projekt des Belegs
  if (budget_line_id) {
    const zeile = await db.get(
      'SELECT bl.id FROM budget_lines bl JOIN budget_versions bv ON bl.budget_version_id = bv.id WHERE bl.id = ? AND bv.project_id = ?',
      [budget_line_id, existing.project_id]
    )
    if (!zeile) return res.status(404).json({ data: null, error: 'Kalkulationszeile nicht gefunden' })
  }
  const kostenartNeu = (req.body as any).cost_group === undefined && budget_line_id === undefined
    ? existing.cost_group
    : await kostenartDesBelegs((req.body as any).cost_group, budget_line_id)
  if (kostenartNeu === undefined) return res.status(400).json({ data: null, error: 'Unbekannte Kostenart' })
  await db.run(
    `UPDATE expenses SET description = ?, category = ?, amount_cents = ?, receipt_no = ?, expense_date = ?, budget_line_id = ?, paid = ?, cost_group = ?
     WHERE id = ?`,
    [description?.trim() || existing.description, category ?? existing.category,
     amount_cents !== undefined ? Math.round(Number(amount_cents) || 0) : existing.amount_cents,
     receipt_no ?? existing.receipt_no,
     expense_date !== undefined ? (expense_date || null) : existing.expense_date,
     budget_line_id !== undefined ? (budget_line_id || null) : existing.budget_line_id,
     paid !== undefined ? paid !== false : existing.paid,
     kostenartNeu,
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
  // Die aktive Fassung, sonst die neueste (lib/kalkulation.ts)
  const activeVersion = await massgeblicheKalkulation(String(req.params.projectId))

  // FFA-Schema (AP B1): Soll und Ist je Kostenart, darunter je Zeile. Belege
  // ohne Kostenart stehen in einer eigenen, benannten Zeile.
  if (activeVersion?.schema === 'ffa') {
    const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [activeVersion.id]) as any
    const zeilen = await db.all(
      'SELECT id, cost_group, social, total_cents, description, category FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order, id',
      [activeVersion.id]) as any[]
    const belege = await db.all('SELECT cost_group, budget_line_id, amount_cents FROM expenses WHERE project_id = ?', [req.params.projectId]) as any[]
    const a = auswertung(zeilen, version)
    const istJeArt = new Map<number | null, number>()
    const istJeZeile = new Map<number, number>()
    for (const b of belege) {
      const art = istKostenart(Number(b.cost_group)) ? Number(b.cost_group) : null
      istJeArt.set(art, (istJeArt.get(art) ?? 0) + (Number(b.amount_cents) || 0))
      if (b.budget_line_id) istJeZeile.set(Number(b.budget_line_id), (istJeZeile.get(Number(b.budget_line_id)) ?? 0) + (Number(b.amount_cents) || 0))
    }
    const zeileAus = (z: any) => {
      const soll = Number(z.total_cents) || 0
      const ist = istJeZeile.get(Number(z.id)) ?? 0
      return { id: Number(z.id), description: z.description || z.category || '', soll_cents: soll, ist_cents: ist, diff_cents: soll - ist }
    }
    const rows = KOSTENARTEN.map((k) => {
      const soll = a.arten.find((x) => x.nr === k.nr)?.summe_cent ?? 0
      const ist = istJeArt.get(k.nr) ?? 0
      const eigene = zeilen.filter((z) => Number(z.cost_group) === k.nr).map(zeileAus)
      if (k.nr === 3 && a.zusatzkosten_gagen_cent !== null) {
        eigene.push({ id: 0, description: 'Zusatzkosten Gagen', soll_cents: a.zusatzkosten_gagen_cent, ist_cents: 0, diff_cents: a.zusatzkosten_gagen_cent })
      }
      return { cost_group: k.nr, category: `${k.nr} ${k.name}`, soll_cents: soll, ist_cents: ist, diff_cents: soll - ist, zeilen: eigene }
    })
    const ohneSoll = a.ohne_kostenart.summe_cent
    const ohneIst = istJeArt.get(null) ?? 0
    if (ohneSoll > 0 || ohneIst > 0) {
      rows.push({ cost_group: null as any, category: 'Ohne Kostenart', soll_cents: ohneSoll, ist_cents: ohneIst, diff_cents: ohneSoll - ohneIst,
        zeilen: zeilen.filter((z) => !istKostenart(Number(z.cost_group))).map(zeileAus) })
    }
    // Die Erträge (Kostenart 11) mindern - in der Summe wird abgezogen
    const vorzeichen = (r: { cost_group: number | null }) => (r.cost_group === 11 ? -1 : 1)
    const sollTotal = rows.reduce((s, r) => s + vorzeichen(r) * r.soll_cents, 0)
    const istTotal = rows.reduce((s, r) => s + vorzeichen(r) * r.ist_cents, 0)
    return res.json({
      data: {
        budget_version: { id: activeVersion.id, name: activeVersion.name, status: activeVersion.status, schema: 'ffa' },
        rows,
        totals: { soll_cents: sollTotal, ist_cents: istTotal, diff_cents: sollTotal - istTotal },
        rechenwerk: a.rechenwerk,
        hinweise: a.hinweise,
      },
      error: null,
    })
  }

  const sollByCategory: Record<string, number> = {}
  if (activeVersion) {
    const lines = await db.all(
      'SELECT category, SUM(total_cents) as total FROM budget_lines WHERE budget_version_id = ? GROUP BY category',
      [activeVersion.id]
    ) as Array<{ category: string; total: number }>
    // Wie bei den Belegen unten: ohne Kategorie heißt "Ohne Kategorie". Vorher
    // standen Soll und Ist derselben leeren Kategorie in zwei Zeilen ("" und
    // "Ohne Kategorie") - gemessen am 25.10.2026.
    for (const l of lines) {
      const kategorie = l.category || 'Ohne Kategorie'
      sollByCategory[kategorie] = (sollByCategory[kategorie] || 0) + (Number(l.total) || 0)
    }
  }

  const istRows = await db.all(
    'SELECT category, SUM(amount_cents) as total FROM expenses WHERE project_id = ? GROUP BY category',
    [req.params.projectId]
  ) as Array<{ category: string; total: number }>
  const istByCategory: Record<string, number> = {}
  for (const r of istRows) {
    const kategorie = r.category || 'Ohne Kategorie'
    istByCategory[kategorie] = (istByCategory[kategorie] || 0) + (Number(r.total) || 0)
  }

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
      budget_version: activeVersion ? { id: activeVersion.id, name: activeVersion.name, status: activeVersion.status, schema: activeVersion.schema } : null,
      rows,
      totals: { soll_cents: sollTotal, ist_cents: istTotal, diff_cents: sollTotal - istTotal },
    },
    error: null,
  })
})

export default router
