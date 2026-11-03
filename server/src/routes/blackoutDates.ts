import { Router, Request, Response } from 'express'
import { db } from '../db'
import { sperrtagKonflikte } from '../lib/sperrtage'
import { requireMember } from '../middleware/projectAuth'
import { istIsoDatum } from '../lib/datum'

const router = Router()

router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/cast/:castId/blackout-dates
router.get('/projects/:projectId/cast/:castId/blackout-dates', async (req: Request, res: Response) => {
  const dates = await db.all(`
    SELECT * FROM cast_blackout_dates
    WHERE project_id = ? AND cast_id = ?
    ORDER BY start_date ASC
  `, [req.params.projectId, req.params.castId])

  res.json({ data: dates, error: null })
})

// GET /api/projects/:projectId/blackout-dates - all blackout dates, enriched with cast name
router.get('/projects/:projectId/blackout-dates', async (req: Request, res: Response) => {
  // Handle the /conflicts sub-path - Express evaluates routes in order but this GET
  // is registered after the conflicts route, so the conflicts route will match first.
  const dates = await db.all(`
    SELECT cbd.*, c.actor_name as cast_name
    FROM cast_blackout_dates cbd
    LEFT JOIN "cast" c ON cbd.cast_id = c.id
    WHERE cbd.project_id = ?
    ORDER BY cbd.start_date ASC
  `, [req.params.projectId])

  res.json({ data: dates, error: null })
})

// GET /api/projects/:projectId/blackout-dates/conflicts
// Find shoot days that conflict with cast blackout dates
router.get('/projects/:projectId/blackout-dates/conflicts', async (req: Request, res: Response) => {
  // Dieselbe Prüfung wie im Konfliktradar (lib/sperrtage.ts)
  res.json({ data: await sperrtagKonflikte(db, Number(req.params.projectId)), error: null })
})

// POST /api/projects/:projectId/cast/:castId/blackout-dates
router.post('/projects/:projectId/cast/:castId/blackout-dates', async (req: Request, res: Response) => {
  const { start_date, end_date, reason = '' } = req.body

  if (!start_date || !end_date) {
    return res.status(400).json({ data: null, error: 'start_date und end_date sind erforderlich' })
  }
  // Die Spalten sind Text, die Datenbank prüft nichts. Gemessen am
  // 25.10.2026: "abc" wurde gespeichert, und die Konfliktprüfung gegen die
  // Drehtage übersah den Sperrtag danach still.
  if (!istIsoDatum(start_date) || !istIsoDatum(end_date)) {
    return res.status(400).json({ data: null, error: 'start_date und end_date sind ein Datum (JJJJ-MM-TT)' })
  }
  if (end_date < start_date) {
    return res.status(400).json({ data: null, error: 'end_date darf nicht vor start_date liegen' })
  }
  // Nur die eigene Besetzung: Die Listen holen den Namen per JOIN dazu, eine
  // fremde castId brächte den Namen aus einem fremden Projekt hierher.
  const darsteller = await db.get('SELECT id FROM "cast" WHERE id = ? AND project_id = ?', [req.params.castId, req.params.projectId])
  if (!darsteller) {
    return res.status(404).json({ data: null, error: 'Darsteller nicht gefunden' })
  }

  const result = await db.run(`
    INSERT INTO cast_blackout_dates (project_id, cast_id, start_date, end_date, reason)
    VALUES (?, ?, ?, ?, ?)
  `, [req.params.projectId, req.params.castId, start_date, end_date, reason])

  const row = await db.get('SELECT * FROM cast_blackout_dates WHERE id = ?', [result.id])
  res.status(201).json({ data: row, error: null })
})

// DELETE /api/blackout-dates/:id
router.delete('/blackout-dates/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  await db.run('DELETE FROM cast_blackout_dates WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
