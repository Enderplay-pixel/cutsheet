import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

async function getReport(id: number) {
  const report = await db.get('SELECT * FROM daily_reports WHERE id = ?', [id]) as any
  if (!report) return null
  const cast = await db.all(`
    SELECT drc.*, c.actor_name, ch.name as character_name
    FROM daily_report_cast drc
    JOIN cast c ON drc.cast_id = c.id
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE drc.daily_report_id = ?
  `, [id])
  return {
    ...report,
    scenes_completed: JSON.parse(report.scenes_completed || '[]'),
    scenes_partial: JSON.parse(report.scenes_partial || '[]'),
    cast,
  }
}

// GET /api/projects/:projectId/time-analysis
router.get('/projects/:projectId/time-analysis', async (req, res) => {
  const pid = req.params.projectId

  // Get all scenes for the project with their estimated minutes
  const scenes = await db.all(`
    SELECT s.id as scene_id, s.scene_number, s.title, s.estimated_minutes
    FROM scenes s
    WHERE s.project_id = ?
    ORDER BY s.scene_number ASC
  `, [pid]) as any[]

  // Get actual minutes per scene accumulated across all shoot days
  // We look at shoot_day_scenes to find what was shot, and daily_reports to get timing data
  // Since actual time per scene isn't stored granularly, we estimate from daily report wrap/call times
  // divided by number of scenes shot that day (scenes_completed + scenes_partial)
  const shootDays = await db.all(`
    SELECT sd.id as shoot_day_id, dr.id as report_id, dr.call_time, dr.first_shot, dr.wrap,
           dr.scenes_completed, dr.scenes_partial
    FROM shoot_days sd
    LEFT JOIN daily_reports dr ON dr.shoot_day_id = sd.id
    WHERE sd.project_id = ? AND dr.id IS NOT NULL
  `, [pid]) as any[]

  // Build a map of scene_id -> actual_minutes
  const actualMinutesMap: Record<number, number> = {}
  // Welche Szenen tragen nur einen rechnerischen Anteil statt einer Messung
  const geschaetzt = new Set<number>()

  for (const day of shootDays) {
    const completedIds: number[] = JSON.parse(day.scenes_completed || '[]')
    const partialIds: number[] = JSON.parse(day.scenes_partial || '[]')
    const allSceneIds = [...completedIds, ...partialIds]

    if (allSceneIds.length === 0) continue

    // Total shooting time for the day in minutes (from first_shot to wrap)
    const firstShot = day.first_shot ?? day.call_time ?? 480
    const wrap = day.wrap ?? 1200
    // Times are stored as minutes-since-midnight
    let totalDayMinutes = wrap - firstShot
    if (totalDayMinutes <= 0) totalDayMinutes = 0

    // Subtract lunch break if present (lunch_in and lunch_out stored as minutes-since-midnight)
    const row = await db.get('SELECT lunch_in, lunch_out FROM daily_reports WHERE id = ?', [day.report_id]) as any
    if (row && row.lunch_in != null && row.lunch_out != null && row.lunch_out > row.lunch_in) {
      totalDayMinutes -= (row.lunch_out - row.lunch_in)
    }

    if (totalDayMinutes < 0) totalDayMinutes = 0

    // Gemessene Zeiten haben Vorrang. Was gemessen wurde, zaehlt genau so;
    // nur der Rest des Tages wird auf die uebrigen Szenen aufgeteilt.
    const gemessen = await db.all(
      'SELECT scene_id, actual_minutes FROM shoot_day_scenes WHERE shoot_day_id = ? AND actual_minutes IS NOT NULL',
      [day.shoot_day_id]
    ) as any[]

    const gemessenJeSzene = new Map<number, number>()
    for (const g of gemessen) gemessenJeSzene.set(Number(g.scene_id), Number(g.actual_minutes))

    let restMinuten = totalDayMinutes
    for (const sceneId of allSceneIds) {
      const m = gemessenJeSzene.get(Number(sceneId))
      if (m !== undefined) {
        actualMinutesMap[sceneId] = (actualMinutesMap[sceneId] || 0) + m
        geschaetzt.delete(Number(sceneId))
        restMinuten -= m
      }
    }
    if (restMinuten < 0) restMinuten = 0

    const offene = allSceneIds.filter(id => gemessenJeSzene.get(Number(id)) === undefined)
    if (offene.length > 0) {
      // Aufteilung nach geplanter Dauer, nicht zu gleichen Teilen: sonst steht
      // eine 30-Minuten-Szene mit demselben Wert da wie eine Zweistuendige und
      // erscheint dramatisch ueberzogen, obwohl niemand sie gemessen hat.
      const plan = new Map<number, number>()
      for (const id of offene) {
        const s = scenes.find((x: any) => Number(x.scene_id) === Number(id))
        plan.set(Number(id), Math.max(1, Number(s?.estimated_minutes) || 1))
      }
      const planSumme = [...plan.values()].reduce((a, b) => a + b, 0)
      for (const id of offene) {
        const anteil = Math.round(restMinuten * (plan.get(Number(id))! / planSumme))
        actualMinutesMap[id] = (actualMinutesMap[id] || 0) + anteil
        geschaetzt.add(Number(id))
      }
    }
  }

  // Build result
  const result = scenes.map((s: any) => {
    const estimated = s.estimated_minutes ?? 0
    const actual = actualMinutesMap[s.scene_id] ?? 0
    return {
      scene_id: s.scene_id,
      scene_number: s.scene_number,
      title: s.title,
      estimated_minutes: estimated,
      actual_minutes: actual,
      difference_minutes: actual - estimated,
      // true heisst: nicht gemessen, sondern aus der Tagesdrehzeit abgeleitet
      geschaetzt: geschaetzt.has(Number(s.scene_id)),
    }
  })

  res.json({ data: result, error: null })
})

// GET /api/shoot-days/:dayId/daily-report
router.get('/shoot-days/:dayId/daily-report', requireMemberVia(projectIdFromTable('shoot_days', 'dayId')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const day = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
    if (day && (await getUserProjectRole(user.id, day.project_id)) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const report = await db.get('SELECT * FROM daily_reports WHERE shoot_day_id = ?', [req.params.dayId]) as any
  if (!report) return res.json({ data: null, error: null })
  res.json({ data: await getReport(report.id), error: null })
})

// POST /api/shoot-days/:dayId/daily-report
router.post('/shoot-days/:dayId/daily-report', async (req, res) => {
  // Pull project settings for default times when creating a new report
  const shootDay = await db.get('SELECT project_id, date FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
  const settings = shootDay
    ? await db.get('SELECT default_call_time, default_wrap_time FROM project_settings WHERE project_id = ?', [shootDay.project_id]) as any
    : null
  const defCall = settings?.default_call_time ?? 480
  const defWrap = settings?.default_wrap_time ?? 1200

  const {
    date = shootDay?.date || '',
    call_time = defCall,
    first_shot = defCall + 30,
    lunch_in = null,
    lunch_out = null,
    wrap = defWrap,
    scenes_completed = [],
    scenes_partial = [],
    // { sceneId: Minuten | null }. null loescht eine Messung wieder.
    scene_actuals = null,
    pages_shot = 0,
    total_setups = 0,
    camera_rolls = '',
    sound_rolls = '',
    notes = '',
    production_notes = '',
  } = req.body

  const existing = await db.get('SELECT id FROM daily_reports WHERE shoot_day_id = ?', [req.params.dayId]) as any

  let reportId: number
  if (existing) {
    await db.run(`UPDATE daily_reports SET date=?, call_time=?, first_shot=?, lunch_in=?, lunch_out=?, wrap=?, scenes_completed=?, scenes_partial=?, pages_shot=?, total_setups=?, camera_rolls=?, sound_rolls=?, notes=?, production_notes=?, updated_at=datetime('now') WHERE id=?`, [date, call_time, first_shot, lunch_in, lunch_out, wrap, JSON.stringify(scenes_completed), JSON.stringify(scenes_partial), pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes, existing.id])
    reportId = existing.id
  } else {
    const result = await db.run(`INSERT INTO daily_reports (shoot_day_id, date, call_time, first_shot, lunch_in, lunch_out, wrap, scenes_completed, scenes_partial, pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [req.params.dayId, date, call_time, first_shot, lunch_in, lunch_out, wrap, JSON.stringify(scenes_completed), JSON.stringify(scenes_partial), pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes])
    reportId = result.id
  }

  // Gemessene Minuten je Szene liegen an der Verbindung Drehtag-Szene, nicht
  // am Bericht: eine Szene kann ueber mehrere Tage gedreht werden.
  if (scene_actuals && typeof scene_actuals === 'object') {
    for (const [sceneId, wert] of Object.entries(scene_actuals)) {
      const minuten = wert === null || wert === '' ? null : Number(wert)
      if (minuten !== null && (!Number.isFinite(minuten) || minuten < 0)) continue
      await db.run(
        'UPDATE shoot_day_scenes SET actual_minutes = ? WHERE shoot_day_id = ? AND scene_id = ?',
        [minuten, req.params.dayId, sceneId]
      )
    }
  }

  res.json({ data: await getReport(reportId), error: null })
})

// PUT /api/daily-reports/:id
router.put('/daily-reports/:id', async (req, res) => {
  const { date, call_time, first_shot, lunch_in, lunch_out, wrap, scenes_completed, scenes_partial, pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes } = req.body
  await db.run(`UPDATE daily_reports SET date=?, call_time=?, first_shot=?, lunch_in=?, lunch_out=?, wrap=?, scenes_completed=?, scenes_partial=?, pages_shot=?, total_setups=?, camera_rolls=?, sound_rolls=?, notes=?, production_notes=?, updated_at=datetime('now') WHERE id=?`, [date, call_time, first_shot, lunch_in, lunch_out, wrap, JSON.stringify(scenes_completed || []), JSON.stringify(scenes_partial || []), pages_shot, total_setups, camera_rolls, sound_rolls, notes, production_notes, req.params.id])
  res.json({ data: await getReport(parseInt(req.params.id)), error: null })
})

export default router
