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
  const teilnehmer = await db.all(
    "SELECT event_id, person_id FROM event_people WHERE project_id = ? AND person_type = 'cast'", [req.params.projectId]
  ) as any[]
  const parsed = (events as any[]).map(e => ({
    ...e,
    all_day: !!e.all_day,
    cast_ids: teilnehmer.filter(t => Number(t.event_id) === Number(e.id)).map(t => Number(t.person_id)),
  }))
  res.json({ data: parsed, error: null })
})

/**
 * Wer aus der Besetzung an einem Termin teilnimmt (seit 13.11.2026).
 *
 * Proben und Kostümproben stehen so im DOOD der Person (lib/dood.ts). Nicht
 * geschickt heißt: bleibt, wie es ist. Nur Darsteller aus dem Projekt des
 * Termins - sonst 404 für die ganze Anfrage, bevor etwas gespeichert ist.
 */
function castListe(wert: unknown): number[] | null | 'falsch' {
  if (wert === undefined) return null
  if (!Array.isArray(wert) || !wert.every(x => Number.isInteger(x) && x > 0)) return 'falsch'
  return [...new Set(wert as number[])]
}

async function fremdeDarsteller(projectId: number, ids: number[]): Promise<boolean> {
  if (ids.length === 0) return false
  const eigene = await db.all('SELECT id FROM "cast" WHERE project_id = ? AND id = ANY(?::int[])', [projectId, ids]) as any[]
  return eigene.length !== ids.length
}

async function teilnehmerSetzen(tx: { run: typeof db.run }, projectId: number, eventId: number, ids: number[]) {
  await tx.run("DELETE FROM event_people WHERE event_id = ? AND person_type = 'cast'", [eventId])
  for (const id of ids) {
    await tx.run("INSERT INTO event_people (project_id, event_id, person_type, person_id) VALUES (?, ?, 'cast', ?)", [projectId, eventId, id])
  }
}

async function mitTeilnehmern(eventId: number) {
  const row = await db.get('SELECT * FROM project_events WHERE id = ?', [eventId]) as any
  const teilnehmer = await db.all("SELECT person_id FROM event_people WHERE event_id = ? AND person_type = 'cast'", [eventId]) as any[]
  return { ...row, all_day: !!row.all_day, cast_ids: teilnehmer.map(t => Number(t.person_id)) }
}
const TEILNEHMER_FEHLER = 'cast_ids ist eine Liste von Kennungen aus der Besetzung'

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
  const projectId = Number(req.params.projectId)
  const besetzung = castListe(req.body.cast_ids)
  if (besetzung === 'falsch') return res.status(400).json({ data: null, error: TEILNEHMER_FEHLER })
  if (besetzung && await fremdeDarsteller(projectId, besetzung)) return res.status(404).json({ data: null, error: 'Darsteller nicht gefunden' })
  const result = await db.run('INSERT INTO project_events (project_id, title, start_date, end_date, type, color, notes, all_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.params.projectId, title, daten.start, daten.ende, type, color, notes, all_day ? 1 : 0])
  if (besetzung) await teilnehmerSetzen(db, projectId, result.id, besetzung)
  res.status(201).json({ data: await mitTeilnehmern(result.id), error: null })
})

// PUT /api/events/:id
router.put('/events/:id', async (req, res) => {
  // Gemessen am 25.10.2026: Ein Termin, den es nicht gibt, ergab 500.
  const termin = await db.get('SELECT id, project_id FROM project_events WHERE id = ?', [req.params.id]) as any
  if (!termin) {
    return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  }
  const { title, start_date, end_date, type, color, notes, all_day } = req.body
  const daten = terminDaten(start_date, end_date)
  if (!daten) return res.status(400).json({ data: null, error: TERMIN_DATUM_FEHLER })
  const besetzung = castListe(req.body.cast_ids)
  if (besetzung === 'falsch') return res.status(400).json({ data: null, error: TEILNEHMER_FEHLER })
  if (besetzung && await fremdeDarsteller(Number(termin.project_id), besetzung)) return res.status(404).json({ data: null, error: 'Darsteller nicht gefunden' })
  await db.run('UPDATE project_events SET title=?, start_date=?, end_date=?, type=?, color=?, notes=?, all_day=? WHERE id=?', [title, daten.start, daten.ende, type, color, notes, all_day ? 1 : 0, req.params.id])
  if (besetzung) await teilnehmerSetzen(db, Number(termin.project_id), Number(req.params.id), besetzung)
  res.json({ data: await mitTeilnehmern(Number(req.params.id)), error: null })
})

// DELETE /api/events/:id
router.delete('/events/:id', async (req, res) => {
  await db.run('DELETE FROM project_events WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
