import { Router, Request, Response } from 'express'
import { db } from '../db'
import { personAngaben } from '../lib/person'
import { heuteISO } from '../lib/datum'
import { requireMemberVia, projectIdFromCallSheet } from '../middleware/projectAuth'

const router = Router()

router.use('/call-sheets/:id', requireMemberVia(projectIdFromCallSheet))

// POST /api/call-sheet-entries/:id/checkin - mit Anmeldung, ab Abteilungsleitung
// (projectWriteGuard über das Muster für /call-sheet-entries/:id; gemessen ohne
// Anmeldung 401). Der Kommentar sagte bis zum 25.10.2026 "public, no auth".
// Body optional: { checked_in: boolean } - ohne Body wird eingecheckt (Bestandsverhalten)
router.post('/call-sheet-entries/:id/checkin', async (req: Request, res: Response) => {
  const entry = await db.get('SELECT * FROM call_sheet_entries WHERE id = ?', [req.params.id]) as any
  if (!entry) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })

  const checkedIn = (req.body as { checked_in?: boolean })?.checked_in !== false

  // Eingecheckt wird am Drehtag, nicht Monate vorher (Testbericht SALZWIND:
  // Check-in zu einem Drehtag im März 2027 am 09.11.2026). Ein Tag Spielraum
  // für Nachtdrehs und frühe Calls; zurücknehmen geht immer, nachtragen danach auch.
  if (checkedIn) {
    const tag = (await db.get(
      `SELECT sd.date FROM call_sheets cs JOIN shoot_days sd ON sd.id = cs.shoot_day_id WHERE cs.id = ?`,
      [entry.call_sheet_id]
    )) as any
    const datum = String(tag?.date ?? '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
      const morgen = heuteISO(new Date(Date.now() + 24 * 60 * 60 * 1000))
      if (datum > morgen) {
        const lesbar = `${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)}`
        return res.status(400).json({ data: null, error: `Einchecken geht erst am Drehtag (${lesbar})` })
      }
    }
  }

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
    const person = await personAngaben(e.person_type, e.person_id)
    return { ...e, person_name: person?.name || '', role: person?.rolle || '' }
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
