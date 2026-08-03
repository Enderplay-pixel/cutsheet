import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'

const router = Router()

// Arbeitszeiten und Gagen: bisher genuegte irgendein Konto, egal welches Projekt
router.use('/shoot-days/:dayId', requireMemberVia(projectIdFromTable('shoot_days', 'dayId')))
router.use('/projects/:pid', requireMemberVia(async req => Number(req.params.pid) || null))

function calcOvertimeHours(callTime: number | null, wrapTime: number | null): number {
  if (callTime == null || wrapTime == null) return 0
  return Math.max(0, (wrapTime - callTime) / 60 - 10)
}

function minutesToHHMM(minutes: number | null): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

async function enrichWithPersonName(entry: any): Promise<any> {
  if (entry.person_type === 'cast') {
    const person = await db.get(
      'SELECT actor_name as name FROM "cast" WHERE id = ?',
      [entry.person_id]
    ) as any
    return { ...entry, person_name: person?.name || '' }
  } else {
    const person = await db.get('SELECT name FROM crew WHERE id = ?', [entry.person_id]) as any
    return { ...entry, person_name: person?.name || '' }
  }
}

// GET /api/shoot-days/:dayId/timesheets
router.get('/shoot-days/:dayId/timesheets', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const rows = await db.all(
    'SELECT * FROM timesheets WHERE shoot_day_id = ? ORDER BY id ASC',
    [req.params.dayId]
  ) as any[]

  const enriched = await Promise.all(rows.map(enrichWithPersonName))
  return res.json({ data: enriched, error: null })
})

// POST /api/shoot-days/:dayId/timesheets
router.post('/shoot-days/:dayId/timesheets', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const day = await db.get('SELECT * FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
  if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  const {
    person_type,
    person_id,
    call_time = null,
    wrap_time = null,
    meal_penalty = false,
    notes = '',
  } = req.body

  if (!person_type || !person_id) {
    return res.status(400).json({ data: null, error: 'person_type und person_id erforderlich' })
  }

  const overtime_hours = calcOvertimeHours(call_time, wrap_time)

  const result = await db.run(
    `INSERT INTO timesheets (project_id, shoot_day_id, person_type, person_id, call_time, wrap_time, meal_penalty, overtime_hours, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [day.project_id, req.params.dayId, person_type, person_id, call_time, wrap_time, meal_penalty, overtime_hours, notes]
  )

  const row = await db.get('SELECT * FROM timesheets WHERE id = ?', [result.id]) as any
  return res.status(201).json({ data: await enrichWithPersonName(row), error: null })
})

// PUT /api/timesheets/:id
router.put('/timesheets/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM timesheets WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Timesheet nicht gefunden' })

  const {
    call_time = existing.call_time,
    wrap_time = existing.wrap_time,
    meal_penalty = existing.meal_penalty,
    notes = existing.notes,
  } = req.body

  const overtime_hours = calcOvertimeHours(call_time, wrap_time)

  await db.run(
    'UPDATE timesheets SET call_time=?, wrap_time=?, meal_penalty=?, overtime_hours=?, notes=? WHERE id=?',
    [call_time, wrap_time, meal_penalty, overtime_hours, notes, req.params.id]
  )

  const row = await db.get('SELECT * FROM timesheets WHERE id = ?', [req.params.id]) as any
  return res.json({ data: await enrichWithPersonName(row), error: null })
})

// DELETE /api/timesheets/:id
router.delete('/timesheets/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM timesheets WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Timesheet nicht gefunden' })

  await db.run('DELETE FROM timesheets WHERE id = ?', [req.params.id])
  return res.json({ data: { id: parseInt(req.params.id) }, error: null })
})

// GET /api/projects/:pid/timesheets/export.csv
router.get('/projects/:pid/timesheets/export.csv', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  // Join with shoot_days to get date and day_number
  const rows = await db.all(
    `SELECT t.*, sd.date, sd.day_number
     FROM timesheets t
     JOIN shoot_days sd ON t.shoot_day_id = sd.id
     WHERE t.project_id = ?
     ORDER BY sd.date ASC, t.person_id ASC`,
    [req.params.pid]
  ) as any[]

  // Enrich with person names
  const enriched = await Promise.all(rows.map(enrichWithPersonName))

  const header = 'Name,Tag,Datum,Call,Wrap,Überstunden,Notizen'
  const lines = enriched.map((r: any) => {
    const name = `"${(r.person_name || '').replace(/"/g, '""')}"`
    const tag = r.day_number ?? ''
    const datum = r.date ?? ''
    const call = minutesToHHMM(r.call_time)
    const wrap = minutesToHHMM(r.wrap_time)
    const overtime = typeof r.overtime_hours === 'number' ? r.overtime_hours.toFixed(2) : '0.00'
    const notes = `"${(r.notes || '').replace(/"/g, '""')}"`
    return [name, tag, datum, call, wrap, overtime, notes].join(',')
  })

  const csv = [header, ...lines].join('\r\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="timesheets-project-${req.params.pid}.csv"`)
  return res.send('﻿' + csv) // BOM for Excel UTF-8 compatibility
})

export default router
