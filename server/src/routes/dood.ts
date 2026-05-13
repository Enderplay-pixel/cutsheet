import { Router, Request, Response } from 'express'
import { db } from '../db'

const router = Router()

// GET /api/projects/:pid/dood-report
router.get('/projects/:pid/dood-report', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  // 1. Get all cast for project with character name
  const castList = await db.all(
    `SELECT c.id, c.actor_name, c.fee_per_day, ch.name as character_name
     FROM "cast" c
     LEFT JOIN characters ch ON c.character_id = ch.id
     WHERE c.project_id = ?
     ORDER BY ch.sort_order ASC, c.id ASC`,
    [req.params.pid]
  ) as any[]

  // 2. Get all shoot days ordered by date
  const shootDays = await db.all(
    'SELECT id, date, day_number FROM shoot_days WHERE project_id = ? ORDER BY date ASC',
    [req.params.pid]
  ) as any[]

  if (castList.length === 0 || shootDays.length === 0) {
    return res.json({
      data: { cast: [], shoot_days: shootDays },
      error: null,
    })
  }

  // 3. For each cast member, determine which shoot days they are needed
  //    Cast is needed on a day if their character_id appears in scene_characters for a scene that is on that day
  const castRows = await Promise.all(castList.map(async (castMember: any) => {
    // Build a set of shoot_day_ids where this cast member is scheduled
    const scheduledDays = await db.all(
      `SELECT DISTINCT sds.shoot_day_id
       FROM scene_characters sc
       JOIN shoot_day_scenes sds ON sc.scene_id = sds.scene_id
       JOIN "cast" c ON sc.character_id = c.character_id
       WHERE c.id = ?`,
      [castMember.id]
    ) as any[]

    const scheduledDayIds = new Set(scheduledDays.map((r: any) => r.shoot_day_id))

    // 4 & 5. Build days array with raw work flags first
    const days = shootDays.map((sd: any) => ({
      date: sd.date,
      day_number: sd.day_number,
      shoot_day_id: sd.id,
      isWork: scheduledDayIds.has(sd.id),
      code: '',
    }))

    // Determine first and last work day indices
    const workIndices = days.map((d, i) => d.isWork ? i : -1).filter(i => i >= 0)

    if (workIndices.length === 0) {
      // No work days — all empty
      const emptyDays = days.map(d => ({ date: d.date, day_number: d.day_number, code: '' }))
      return {
        id: castMember.id,
        actor_name: castMember.actor_name,
        character_name: castMember.character_name || '',
        fee_per_day: castMember.fee_per_day,
        days: emptyDays,
        total_work_days: 0,
        total_hold_days: 0,
        total_cost_cents: 0,
      }
    }

    const firstWork = workIndices[0]
    const lastWork = workIndices[workIndices.length - 1]

    // Assign codes
    for (let i = 0; i < days.length; i++) {
      const d = days[i]
      if (d.isWork) {
        d.code = 'W'
      } else if (i > firstWork && i < lastWork) {
        // Between first and last work day → Hold
        d.code = 'H'
      } else {
        d.code = ''
      }
    }

    // Apply SW (Start/Work) and F (Finish) markers
    // First W → SW; last W → F; if same → SWF
    if (firstWork === lastWork) {
      days[firstWork].code = 'SWF'
    } else {
      days[firstWork].code = 'SW'
      days[lastWork].code = 'F'
    }

    const totalWorkDays = days.filter(d => d.code === 'W' || d.code === 'SW' || d.code === 'F' || d.code === 'SWF').length
    const totalHoldDays = days.filter(d => d.code === 'H').length
    const totalCostCents = totalWorkDays * (castMember.fee_per_day || 0)

    return {
      id: castMember.id,
      actor_name: castMember.actor_name,
      character_name: castMember.character_name || '',
      fee_per_day: castMember.fee_per_day,
      days: days.map(d => ({ date: d.date, day_number: d.day_number, code: d.code })),
      total_work_days: totalWorkDays,
      total_hold_days: totalHoldDays,
      total_cost_cents: totalCostCents,
    }
  }))

  return res.json({
    data: {
      cast: castRows,
      shoot_days: shootDays.map(sd => ({ id: sd.id, date: sd.date, day_number: sd.day_number })),
    },
    error: null,
  })
})

export default router
