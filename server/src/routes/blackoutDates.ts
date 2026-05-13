import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/cast/:castId/blackout-dates
router.get('/projects/:projectId/cast/:castId/blackout-dates', async (req: Request, res: Response) => {
  try {
    const dates = await db.all(`
      SELECT * FROM cast_blackout_dates
      WHERE project_id = ? AND cast_id = ?
      ORDER BY start_date ASC
    `, [req.params.projectId, req.params.castId])

    res.json({ data: dates, error: null })
  } catch (err) {
    console.error('[blackoutDates GET cast]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /api/projects/:projectId/blackout-dates — all blackout dates, enriched with cast name
router.get('/projects/:projectId/blackout-dates', async (req: Request, res: Response) => {
  try {
    // Handle the /conflicts sub-path — Express evaluates routes in order but this GET
    // is registered after the conflicts route, so the conflicts route will match first.
    const dates = await db.all(`
      SELECT cbd.*, c.actor_name as cast_name
      FROM cast_blackout_dates cbd
      LEFT JOIN "cast" c ON cbd.cast_id = c.id
      WHERE cbd.project_id = ?
      ORDER BY cbd.start_date ASC
    `, [req.params.projectId])

    res.json({ data: dates, error: null })
  } catch (err) {
    console.error('[blackoutDates GET all]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /api/projects/:projectId/blackout-dates/conflicts
// Find shoot days that conflict with cast blackout dates
router.get('/projects/:projectId/blackout-dates/conflicts', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)

    // Get all shoot days with scenes and their cast
    const shootDays = await db.all(`
      SELECT * FROM shoot_days WHERE project_id = ? AND date IS NOT NULL
      ORDER BY date ASC
    `, [projectId]) as any[]

    // Get all blackout dates with cast names
    const blackouts = await db.all(`
      SELECT cbd.*, c.actor_name as cast_name
      FROM cast_blackout_dates cbd
      LEFT JOIN "cast" c ON cbd.cast_id = c.id
      WHERE cbd.project_id = ?
    `, [projectId]) as any[]

    const conflicts: Array<{ shoot_day: any; cast_name: string; blackout: any }> = []

    for (const day of shootDays) {
      const dayDate = new Date(day.date)

      // Get cast members scheduled for this shoot day
      const dayCast = await db.all(`
        SELECT DISTINCT c.id, c.actor_name
        FROM shoot_day_scenes sds
        JOIN scene_characters sc ON sc.scene_id = sds.scene_id
        JOIN characters ch ON ch.id = sc.character_id
        JOIN "cast" c ON c.character_id = ch.id
        WHERE sds.shoot_day_id = ? AND c.project_id = ?
      `, [day.id, projectId]) as any[]

      const dayCastIds = new Set(dayCast.map((c: any) => c.id))

      for (const blackout of blackouts) {
        // Only check blackouts for cast members working that day
        if (!dayCastIds.has(blackout.cast_id)) continue

        const blackoutStart = new Date(blackout.start_date)
        const blackoutEnd = new Date(blackout.end_date)

        // Conflict: shoot day falls within blackout period
        if (dayDate >= blackoutStart && dayDate <= blackoutEnd) {
          conflicts.push({
            shoot_day: day,
            cast_name: blackout.cast_name || 'Unbekannt',
            blackout: blackout,
          })
        }
      }
    }

    res.json({ data: conflicts, error: null })
  } catch (err) {
    console.error('[blackoutDates GET conflicts]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/cast/:castId/blackout-dates
router.post('/projects/:projectId/cast/:castId/blackout-dates', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, reason = '' } = req.body

    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date und end_date sind erforderlich' })
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ data: null, error: 'end_date darf nicht vor start_date liegen' })
    }

    const result = await db.run(`
      INSERT INTO cast_blackout_dates (project_id, cast_id, start_date, end_date, reason)
      VALUES (?, ?, ?, ?, ?)
    `, [req.params.projectId, req.params.castId, start_date, end_date, reason])

    const row = await db.get('SELECT * FROM cast_blackout_dates WHERE id = ?', [result.id])
    res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[blackoutDates POST]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/blackout-dates/:id
router.delete('/blackout-dates/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    await db.run('DELETE FROM cast_blackout_dates WHERE id = ?', [req.params.id])
    res.json({ data: { ok: true }, error: null })
  } catch (err) {
    console.error('[blackoutDates DELETE]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
