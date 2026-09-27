import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'

const router = Router()

// Verpflegungswuensche sind Gesundheitsangaben - nur fuer Projektbeteiligte
router.use('/shoot-days/:dayId', requireMemberVia(projectIdFromTable('shoot_days', 'dayId')))
router.use('/projects/:pid', requireMemberVia(async req => Number(req.params.pid) || null))

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

// GET /api/projects/:pid/catering-preferences
router.get('/projects/:pid/catering-preferences', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const rows = await db.all(
    'SELECT * FROM catering_preferences WHERE project_id = ? ORDER BY person_type ASC, person_id ASC',
    [req.params.pid]
  ) as any[]

  const enriched = await Promise.all(rows.map(enrichWithPersonName))
  return res.json({ data: enriched, error: null })
})

// POST /api/projects/:pid/catering-preferences - upsert
router.post('/projects/:pid/catering-preferences', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const { person_type, person_id, dietary = 'keine', allergies = '', notes = '' } = req.body

  if (!person_type || !person_id) {
    return res.status(400).json({ data: null, error: 'person_type und person_id erforderlich' })
  }

  // Upsert: INSERT ... ON CONFLICT DO UPDATE
  const result = await db.run(
    `INSERT INTO catering_preferences (project_id, person_type, person_id, dietary, allergies, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (project_id, person_type, person_id)
     DO UPDATE SET dietary=EXCLUDED.dietary, allergies=EXCLUDED.allergies, notes=EXCLUDED.notes`,
    [req.params.pid, person_type, person_id, dietary, allergies, notes]
  )

  // Retrieve the upserted row
  const row = await db.get(
    'SELECT * FROM catering_preferences WHERE project_id = ? AND person_type = ? AND person_id = ?',
    [req.params.pid, person_type, person_id]
  ) as any

  return res.status(200).json({ data: await enrichWithPersonName(row), error: null })
})

// DELETE /api/catering-preferences/:id
router.delete('/catering-preferences/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM catering_preferences WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })

  await db.run('DELETE FROM catering_preferences WHERE id = ?', [req.params.id])
  return res.json({ data: { id: parseInt(req.params.id) }, error: null })
})

// GET /api/shoot-days/:dayId/catering-list
router.get('/shoot-days/:dayId/catering-list', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const day = await db.get('SELECT * FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
  if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  // Get call sheet for this day
  const sheet = await db.get('SELECT id FROM call_sheets WHERE shoot_day_id = ?', [req.params.dayId]) as any

  let callEntries: any[] = []
  if (sheet) {
    callEntries = await db.all(
      'SELECT DISTINCT person_type, person_id FROM call_sheet_entries WHERE call_sheet_id = ?',
      [sheet.id]
    ) as any[]
  }

  // For each person, look up catering preference and name
  const entries = await Promise.all(callEntries.map(async (e: any) => {
    let person_name = ''
    if (e.person_type === 'cast') {
      const person = await db.get('SELECT actor_name as name FROM "cast" WHERE id = ?', [e.person_id]) as any
      person_name = person?.name || ''
    } else {
      const person = await db.get('SELECT name FROM crew WHERE id = ?', [e.person_id]) as any
      person_name = person?.name || ''
    }

    const pref = await db.get(
      'SELECT * FROM catering_preferences WHERE project_id = ? AND person_type = ? AND person_id = ?',
      [day.project_id, e.person_type, e.person_id]
    ) as any

    return {
      person_type: e.person_type,
      person_id: e.person_id,
      person_name,
      dietary: pref?.dietary || 'keine',
      allergies: pref?.allergies || '',
      notes: pref?.notes || '',
      catering_preference_id: pref?.id || null,
    }
  }))

  // Build summary counts by dietary
  const summary: Record<string, number> = {}
  for (const entry of entries) {
    const key = entry.dietary || 'keine'
    summary[key] = (summary[key] || 0) + 1
  }

  return res.json({ data: { entries, summary }, error: null })
})

export default router
