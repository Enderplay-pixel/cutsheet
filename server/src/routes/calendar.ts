import { Router } from 'express'
import { db } from '../db'
import { getHolidays } from '../services/holidays'
import { requireMember } from '../middleware/projectAuth'
import { heuteISO, istIsoDatum } from '../lib/datum'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/holidays?year=2026&state=NW
// Kürzel wie in services/holidays.ts. Der Standard war 'NRW' - das kennt die
// Liste nicht, gemessen am 25.10.2026 fehlten damit Fronleichnam und
// Allerheiligen (9 statt 13 Feiertage).
router.get('/projects/:projectId/holidays', (req, res) => {
  const year = parseInt(String(req.query.year)) || Number(heuteISO().slice(0, 4))
  const state = String(req.query.state || 'NW')
  const holidays = getHolidays(year, state)
  res.json({ data: holidays, error: null })
})

// GET /api/projects/:projectId/events
router.get('/projects/:projectId/events', async (req, res) => {
  const events = await db.all('SELECT * FROM project_events WHERE project_id = ? ORDER BY start_date ASC', [req.params.projectId])
  const parsed = (events as any[]).map(e => ({ ...e, all_day: !!e.all_day }))
  res.json({ data: parsed, error: null })
})

/**
 * Anfang und Ende eines Termins. Die Spalten sind Text - gemessen am
 * 25.10.2026 wurde "abc" gespeichert, und der Kalender zeigte den Termin an
 * keinem Tag. Ein leeres Ende (das Formular schickt '') heißt: kein Ende.
 */
function terminDaten(start: unknown, ende: unknown): { start: string; ende: string | null } | null {
  const bis = ende === '' || ende === null || ende === undefined ? null : String(ende)
  if (!istIsoDatum(start) || (bis !== null && !istIsoDatum(bis))) return null
  return { start: String(start), ende: bis }
}
const TERMIN_DATUM_FEHLER = 'Ein Termin braucht ein Datum (JJJJ-MM-TT)'

// POST /api/projects/:projectId/events
router.post('/projects/:projectId/events', async (req, res) => {
  const { title = '', start_date, end_date = null, type = 'Meeting', color = '#f59e0b', notes = '', all_day = true } = req.body
  const daten = terminDaten(start_date, end_date)
  if (!daten) return res.status(400).json({ data: null, error: TERMIN_DATUM_FEHLER })
  const result = await db.run('INSERT INTO project_events (project_id, title, start_date, end_date, type, color, notes, all_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.params.projectId, title, daten.start, daten.ende, type, color, notes, all_day ? 1 : 0])
  const row = await db.get('SELECT * FROM project_events WHERE id = ?', [result.id]) as any
  res.status(201).json({ data: { ...row, all_day: !!row.all_day }, error: null })
})

// PUT /api/events/:id
router.put('/events/:id', async (req, res) => {
  // Gemessen am 25.10.2026: Ein Termin, den es nicht gibt, ergab 500.
  if (!(await db.get('SELECT id FROM project_events WHERE id = ?', [req.params.id]))) {
    return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  }
  const { title, start_date, end_date, type, color, notes, all_day } = req.body
  const daten = terminDaten(start_date, end_date)
  if (!daten) return res.status(400).json({ data: null, error: TERMIN_DATUM_FEHLER })
  await db.run('UPDATE project_events SET title=?, start_date=?, end_date=?, type=?, color=?, notes=?, all_day=? WHERE id=?', [title, daten.start, daten.ende, type, color, notes, all_day ? 1 : 0, req.params.id])
  const row = await db.get('SELECT * FROM project_events WHERE id = ?', [req.params.id]) as any
  res.json({ data: { ...row, all_day: !!row.all_day }, error: null })
})

// DELETE /api/events/:id
router.delete('/events/:id', async (req, res) => {
  await db.run('DELETE FROM project_events WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
