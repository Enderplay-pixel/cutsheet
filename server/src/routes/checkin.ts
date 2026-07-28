import { Router, Request, Response } from 'express'
import { db } from '../db'

const router = Router()

// POST /api/call-sheet-entries/:id/checkin — public, no auth required
// Body optional: { checked_in: boolean } — ohne Body wird eingecheckt (Bestandsverhalten)
router.post('/call-sheet-entries/:id/checkin', async (req: Request, res: Response) => {
  const entry = await db.get('SELECT * FROM call_sheet_entries WHERE id = ?', [req.params.id]) as any
  if (!entry) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })

  const checkedIn = (req.body as { checked_in?: boolean })?.checked_in !== false
  await db.run(
    'UPDATE call_sheet_entries SET checked_in = ?, checked_in_at = ? WHERE id = ?',
    [checkedIn, checkedIn ? new Date() : null, req.params.id]
  )

  const updated = await db.get('SELECT * FROM call_sheet_entries WHERE id = ?', [req.params.id]) as any
  return res.json({ data: updated, error: null })
})

// GET /api/call-sheets/:id/checkin-status
router.get('/call-sheets/:id/checkin-status', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const sheet = await db.get('SELECT * FROM call_sheets WHERE id = ?', [req.params.id]) as any
  if (!sheet) return res.status(404).json({ data: null, error: 'Call Sheet nicht gefunden' })

  const entries = await db.all(
    'SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC',
    [req.params.id]
  ) as any[]

  const enriched = await Promise.all(entries.map(async (e: any) => {
    if (e.person_type === 'cast') {
      const person = await db.get(
        'SELECT c.actor_name as name, ch.name as role FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?',
        [e.person_id]
      ) as any
      return { ...e, person_name: person?.name || '', role: person?.role || '' }
    } else {
      const person = await db.get('SELECT name, role FROM crew WHERE id = ?', [e.person_id]) as any
      return { ...e, person_name: person?.name || '', role: person?.role || '' }
    }
  }))

  const total = enriched.length
  const checked_in_count = enriched.filter((e: any) => e.checked_in).length

  return res.json({
    data: {
      call_sheet_id: sheet.id,
      shoot_day_id: sheet.shoot_day_id,
      entries: enriched,
      summary: { total, checked_in: checked_in_count, pending: total - checked_in_count },
    },
    error: null,
  })
})

export default router
