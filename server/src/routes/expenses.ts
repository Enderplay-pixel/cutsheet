import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { massgeblicheKalkulation, kostenstand, vierZahlen } from '../lib/kalkulation'
import { auswertung, istKostenart, KOSTENARTEN, kostenartName } from '../lib/ffaSchema'

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

// GET /api/projects/:projectId/kostenstand - Kalkulation, Ist, noch zu erwarten
// und Endstand je Kostenart (FFA) oder Kategorie, darunter je Zeile (AP B1, E1)
router.get('/projects/:projectId/kostenstand', requireAuth, requireMember, async (req: Request, res: Response) => {
  // Die aktive Fassung, sonst die neueste (lib/kalkulation.ts)
  const activeVersion = await massgeblicheKalkulation(String(req.params.projectId))
  const ffa = activeVersion?.schema === 'ffa'
  const version = activeVersion ? await db.get('SELECT * FROM budget_versions WHERE id = ?', [activeVersion.id]) as any : null
  const zeilenRoh = activeVersion ? await db.all(
    `SELECT bl.id, bl.cost_group, bl.social, bl.total_cents, bl.description, bl.category, bl.forecast_rest_cents, bl.closed, bl.deferred_cents, bl.in_kind_cents,
            bl.forecast_set_at, u.name AS forecast_set_by_name
       FROM budget_lines bl LEFT JOIN users u ON u.id = bl.forecast_set_by
      WHERE bl.budget_version_id = ? ORDER BY bl.sort_order, bl.id`,
    [activeVersion.id]) as any[] : []
  const belegeRoh = await db.all('SELECT cost_group, category, budget_line_id, amount_cents FROM expenses WHERE project_id = ?', [req.params.projectId]) as any[]

  // Gruppe: im FFA-Schema die Kostenart ("ohne" ohne), sonst die Kategorie
  const gruppeFfa = (nr: unknown) => (istKostenart(Number(nr)) ? String(Number(nr)) : 'ohne')
  const gruppeFrei = (k: unknown) => String(k || '').trim() || 'Ohne Kategorie'
  const zeilen = zeilenRoh.map((z) => ({ ...z, gruppe: ffa ? gruppeFfa(z.cost_group) : gruppeFrei(z.category) }))
  const belege = belegeRoh.map((b) => ({ ...b, gruppe: ffa ? gruppeFfa(b.cost_group) : gruppeFrei(b.category) }))
  const a = ffa ? auswertung(zeilenRoh, version) : null
  const gruppen = ffa
    ? KOSTENARTEN.map((k) => ({
      gruppe: String(k.nr),
      ...(k.nr === 3 && a!.zusatzkosten_gagen_cent !== null ? { zusatz: { description: 'Zusatzkosten Gagen', cents: a!.zusatzkosten_gagen_cent } } : {}),
    }))
    : [...new Set(zeilen.map((z) => z.gruppe))].sort().map((g) => ({ gruppe: g }))
  const stand = kostenstand(zeilen, belege, gruppen)
  const rows = stand.map((g) => ffa
    ? { ...g, cost_group: g.gruppe === 'ohne' ? null : Number(g.gruppe), category: g.gruppe === 'ohne' ? 'Ohne Kostenart' : `${g.gruppe} ${kostenartName(Number(g.gruppe))}` }
    : { ...g, category: g.gruppe })
  // Die Erträge (Kostenart 11) mindern - in der Summe wird abgezogen
  const vorzeichen = (r: any) => (ffa && r.cost_group === 11 ? -1 : 1)
  const summe = (k: 'soll_cents' | 'ist_cents' | 'rest_cents' | 'ohne_zahlung_cents') => rows.reduce((s, r: any) => s + vorzeichen(r) * r[k], 0)
  const totals = vierZahlen(summe('soll_cents'), summe('ist_cents'), summe('rest_cents'), summe('ohne_zahlung_cents'))
  const hinweise = [...(a?.hinweise ?? [])]
  if (stand.some((g) => g.zeilen.some((z) => z.description === 'Belege ohne Zeile'))) {
    hinweise.push('Belege ohne Zeile mindern keinen Rest - der Endstand kann zu hoch sein')
  }

  return res.json({
    data: {
      budget_version: activeVersion ? { id: activeVersion.id, name: activeVersion.name, status: activeVersion.status, schema: activeVersion.schema } : null,
      // Ohne Fassung keine Zeilen; ohne Soll und Ist bleibt eine leere Kostenart weg
      rows: ffa ? rows : rows.filter((r) => r.soll_cents !== 0 || r.ist_cents !== 0),
      totals,
      ...(a ? { rechenwerk: a.rechenwerk } : {}),
      hinweise,
    },
    error: null,
  })
})

export default router
