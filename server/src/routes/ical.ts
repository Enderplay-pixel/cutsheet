import { Router, Request, Response } from 'express'
import ical from 'ical-generator'
import { db } from '../db'
import { optionalAuth } from '../middleware/auth'

const router = Router()

// GET /api/projects/:pid/calendar/export.ics
// Optional query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/projects/:pid/calendar/export.ics', optionalAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const { from, to } = req.query as { from?: string; to?: string }

  const project = await db.get('SELECT id, title FROM projects WHERE id = ?', [projectId])
  if (!project) {
    return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })
  }

  const cal = ical({ name: project.title || 'CutSheet Kalender' })

  // ── Project events ────────────────────────────────────────────────────────
  let eventSql = 'SELECT * FROM project_events WHERE project_id = ?'
  const eventParams: any[] = [projectId]
  if (from) { eventSql += ' AND start_date >= ?'; eventParams.push(from) }
  if (to)   { eventSql += ' AND start_date <= ?'; eventParams.push(to) }

  const projectEvents = await db.all(eventSql, eventParams)
  for (const ev of projectEvents) {
    const startDate = new Date(ev.start_date)
    const endDate = ev.end_date ? new Date(ev.end_date) : new Date(ev.start_date)

    // Make end inclusive for all-day events (add 1 day)
    if (ev.all_day) {
      endDate.setDate(endDate.getDate() + 1)
    }

    cal.createEvent({
      start: startDate,
      end: endDate,
      summary: ev.title || '',
      description: ev.notes || '',
      allDay: !!ev.all_day,
    })
  }

  // ── Shoot days (all-day events) ───────────────────────────────────────────
  let daySql = 'SELECT * FROM shoot_days WHERE project_id = ?'
  const dayParams: any[] = [projectId]
  if (from) { daySql += ' AND date >= ?'; dayParams.push(from) }
  if (to)   { daySql += ' AND date <= ?'; dayParams.push(to) }

  const shootDays = await db.all(daySql, dayParams)
  for (const day of shootDays) {
    const dayDate = new Date(day.date)
    const dayEnd = new Date(day.date)
    dayEnd.setDate(dayEnd.getDate() + 1)

    cal.createEvent({
      start: dayDate,
      end: dayEnd,
      summary: `Drehtag ${day.day_number}${day.unit !== 'Haupteinheit' ? ` (${day.unit})` : ''}`,
      description: day.notes || '',
      allDay: true,
    })
  }

  // ── Authenticated user's call sheet entries ───────────────────────────────
  if (req.user) {
    const userId = req.user.id

    // Find all crew/cast records linked to this user (by email match)
    const userRecord = await db.get('SELECT email FROM users WHERE id = ?', [userId])
    if (userRecord?.email) {
      const crewMembers = await db.all(
        'SELECT id FROM crew WHERE project_id = ? AND email = ?',
        [projectId, userRecord.email]
      )
      const castMembers = await db.all(
        'SELECT id FROM "cast" WHERE project_id = ? AND email = ?',
        [projectId, userRecord.email]
      )

      for (const cm of crewMembers) {
        await appendCallEntries(cal, cm.id, 'crew', shootDays, from, to)
      }
      for (const cm of castMembers) {
        await appendCallEntries(cal, cm.id, 'cast', shootDays, from, to)
      }
    }
  }

  res.set('Content-Type', 'text/calendar; charset=utf-8')
  res.set('Content-Disposition', 'attachment; filename="cutsheet.ics"')
  return res.send(cal.toString())
})

async function appendCallEntries(
  cal: ReturnType<typeof ical>,
  personId: number,
  personType: string,
  shootDays: any[],
  from?: string,
  to?: string
) {
  // Build a lookup map of shoot_day_id → date from already-fetched shoot days
  const dayMap = new Map<number, string>()
  for (const d of shootDays) {
    dayMap.set(d.id, d.date)
  }

  // Get entries joined through call_sheets → shoot_days
  const entries = await db.all(
    `SELECT cse.*, cs.shoot_day_id, cs.general_call
     FROM call_sheet_entries cse
     JOIN call_sheets cs ON cse.call_sheet_id = cs.id
     WHERE cse.person_type = ? AND cse.person_id = ?`,
    [personType, personId]
  )

  for (const entry of entries) {
    const dayDate = dayMap.get(entry.shoot_day_id)
    if (!dayDate) continue
    if (from && dayDate < from) continue
    if (to && dayDate > to) continue

    // call_time is minutes since midnight
    const callMinutes: number = entry.call_time ?? entry.general_call ?? 480
    const base = new Date(dayDate)
    base.setHours(0, 0, 0, 0)
    const start = new Date(base.getTime() + callMinutes * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // 1-hour placeholder

    cal.createEvent({
      start,
      end,
      summary: `Call Time - ${personType === 'cast' ? 'Darsteller' : 'Crew'}`,
      description: entry.notes || entry.pickup_location || '',
      allDay: false,
    })
  }
}

export default router
