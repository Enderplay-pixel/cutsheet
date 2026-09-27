import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

router.use('/projects/:projectId', requireMember)

// ─── Suggestion generation engine ────────────────────────────────────────────

interface Suggestion {
  project_id: number
  suggestion_type: string
  title: string
  description: string
  savings_days: number
  scene_ids: string // JSON array string
}

async function generateSuggestions(projectId: number): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = []

  // ── Rule 1: Location clustering ───────────────────────────────────────────
  // Find scenes at the same location that are on different shoot days
  const scenesWithDays = await db.all(`
    SELECT s.id as scene_id, s.scene_number, s.location_id, l.name as location_name,
           sds.shoot_day_id, sd.day_number, sd.date
    FROM scenes s
    LEFT JOIN locations l ON l.id = s.location_id
    JOIN shoot_day_scenes sds ON sds.scene_id = s.id
    JOIN shoot_days sd ON sd.id = sds.shoot_day_id
    WHERE s.project_id = ? AND s.location_id IS NOT NULL
    ORDER BY s.location_id, sd.date
  `, [projectId]) as any[]

  // Group by location
  const byLocation = new Map<number, typeof scenesWithDays>()
  for (const row of scenesWithDays) {
    if (!byLocation.has(row.location_id)) byLocation.set(row.location_id, [])
    byLocation.get(row.location_id)!.push(row)
  }

  for (const [locationId, rows] of byLocation.entries()) {
    const shootDayIds = new Set(rows.map((r: any) => r.shoot_day_id))
    if (shootDayIds.size >= 2) {
      const locationName = rows[0].location_name || `Motiv ${locationId}`
      const sceneNumbers = [...new Set(rows.map((r: any) => r.scene_number))].join(', ')
      const sceneIds = [...new Set(rows.map((r: any) => r.scene_id))]
      suggestions.push({
        project_id: projectId,
        suggestion_type: 'location_clustering',
        title: `Szenen am gleichen Motiv zusammenlegen: ${locationName}`,
        description: `Szenen ${sceneNumbers} sind am Motiv "${locationName}" auf ${shootDayIds.size} verschiedene Drehtage verteilt - Bündelung kann Drehtage reduzieren.`,
        savings_days: shootDayIds.size - 1,
        scene_ids: JSON.stringify(sceneIds),
      })
    }
  }

  // ── Rule 2: Cast gaps ─────────────────────────────────────────────────────
  // For each cast member, find gaps between first and last shoot day with no scenes
  const castShootDays = await db.all(`
    SELECT c.id as cast_id, c.actor_name,
           sd.id as shoot_day_id, sd.day_number, sd.date
    FROM "cast" c
    JOIN scene_characters sc ON sc.character_id = c.character_id
    JOIN shoot_day_scenes sds ON sds.scene_id = sc.scene_id
    JOIN shoot_days sd ON sd.id = sds.shoot_day_id
    WHERE c.project_id = ? AND sd.date IS NOT NULL
    ORDER BY c.id, sd.date
  `, [projectId]) as any[]

  const byCast = new Map<number, typeof castShootDays>()
  for (const row of castShootDays) {
    if (!byCast.has(row.cast_id)) byCast.set(row.cast_id, [])
    byCast.get(row.cast_id)!.push(row)
  }

  for (const [castId, rows] of byCast.entries()) {
    const sortedDates = [...new Set(rows.map((r: any) => r.date as string))].sort()
    if (sortedDates.length < 2) continue

    const firstDate = new Date(sortedDates[0])
    const lastDate = new Date(sortedDates[sortedDates.length - 1])
    const workingDateSet = new Set(sortedDates)

    // Count calendar days between first and last - subtract working days
    let totalDays = 0
    const cursor = new Date(firstDate)
    while (cursor <= lastDate) {
      totalDays++
      cursor.setDate(cursor.getDate() + 1)
    }
    const holdDays = totalDays - workingDateSet.size

    if (holdDays > 1) {
      const actorName = rows[0].actor_name || `Darsteller ${castId}`
      const sceneIds = [...new Set(rows.map((r: any) => r.scene_id || null))].filter(Boolean)
      suggestions.push({
        project_id: projectId,
        suggestion_type: 'cast_gaps',
        title: `Hold-Tage für ${actorName} reduzieren`,
        description: `Darsteller ${actorName} hat ${holdDays} Hold-Tage zwischen Drehtagen - Zusammenlegung der Drehtage könnte Kosten senken.`,
        savings_days: holdDays,
        scene_ids: JSON.stringify(sceneIds),
      })
    }
  }

  // ── Rule 3: Night scenes clustered by week ────────────────────────────────
  // If night scenes are spread across more than 1 week, suggest clustering
  const nightScenes = await db.all(`
    SELECT s.id as scene_id, s.scene_number, sd.date
    FROM scenes s
    JOIN shoot_day_scenes sds ON sds.scene_id = s.id
    JOIN shoot_days sd ON sd.id = sds.shoot_day_id
    WHERE s.project_id = ? AND s.day_night = 'NACHT' AND sd.date IS NOT NULL
    ORDER BY sd.date
  `, [projectId]) as any[]

  if (nightScenes.length > 0) {
    const weekNumbers = new Set<string>()
    for (const row of nightScenes) {
      const d = new Date(row.date)
      // ISO week: year + week number
      const startOfYear = new Date(d.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
      weekNumbers.add(`${d.getFullYear()}-W${weekNum}`)
    }

    if (weekNumbers.size > 1) {
      const sceneIds = nightScenes.map((r: any) => r.scene_id)
      const sceneNumbers = [...new Set(nightScenes.map((r: any) => r.scene_number))].join(', ')
      suggestions.push({
        project_id: projectId,
        suggestion_type: 'night_scenes',
        title: 'Nacht-Szenen bündeln',
        description: `Nacht-Szenen (${sceneNumbers}) sind über ${weekNumbers.size} Wochen verteilt - Bündelung würde Kosten für Nacht-Crew und Equipment senken.`,
        savings_days: weekNumbers.size - 1,
        scene_ids: JSON.stringify(sceneIds),
      })
    }
  }

  return suggestions
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/scheduling-suggestions
// dismissed ist in Postgres BOOLEAN. `dismissed = 0` ist kein "false",
// sondern ein Typfehler ("operator does not exist: boolean = integer") - in
// SQLite war es dasselbe, hier nicht. Gemessen am 26.09.2026: jede Route
// dieser Datei antwortete mit 500, die Drehplan-Optimierung war tot.
router.get('/projects/:projectId/scheduling-suggestions', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Check if there are any non-dismissed suggestions created in the last 24h
    const existing = await db.all(`
      SELECT * FROM scheduling_suggestions
      WHERE project_id = ? AND dismissed = false AND created_at >= ?
      ORDER BY created_at DESC
    `, [projectId, oneDayAgo]) as any[]

    if (existing.length > 0) {
      // Return existing fresh suggestions
      const parsed = existing.map((s: any) => ({
        ...s,
        dismissed: !!s.dismissed,
        scene_ids: (() => { try { return JSON.parse(s.scene_ids) } catch { return [] } })(),
      }))
      return res.json({ data: parsed, error: null })
    }

    // Generate fresh suggestions
    await runGenerationForProject(projectId)

    const fresh = await db.all(`
      SELECT * FROM scheduling_suggestions
      WHERE project_id = ? AND dismissed = false
      ORDER BY created_at DESC
    `, [projectId]) as any[]

    const parsed = fresh.map((s: any) => ({
      ...s,
      dismissed: !!s.dismissed,
      scene_ids: (() => { try { return JSON.parse(s.scene_ids) } catch { return [] } })(),
    }))

    res.json({ data: parsed, error: null })
  } catch (err) {
    console.error('[optimizationSuggestions GET]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/scheduling-suggestions/generate
router.post('/projects/:projectId/scheduling-suggestions/generate', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    await runGenerationForProject(projectId)

    const suggestions = await db.all(`
      SELECT * FROM scheduling_suggestions
      WHERE project_id = ? AND dismissed = false
      ORDER BY created_at DESC
    `, [projectId]) as any[]

    const parsed = suggestions.map((s: any) => ({
      ...s,
      dismissed: !!s.dismissed,
      scene_ids: (() => { try { return JSON.parse(s.scene_ids) } catch { return [] } })(),
    }))

    res.json({ data: parsed, error: null })
  } catch (err) {
    console.error('[optimizationSuggestions POST generate]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PATCH /api/scheduling-suggestions/:id/dismiss
router.patch('/scheduling-suggestions/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    await db.run('UPDATE scheduling_suggestions SET dismissed = true WHERE id = ?', [req.params.id])
    const row = await db.get('SELECT * FROM scheduling_suggestions WHERE id = ?', [req.params.id]) as any

    if (!row) return res.status(404).json({ data: null, error: 'Vorschlag nicht gefunden' })

    res.json({
      data: {
        ...row,
        dismissed: !!row.dismissed,
        scene_ids: (() => { try { return JSON.parse(row.scene_ids) } catch { return [] } })(),
      },
      error: null,
    })
  } catch (err) {
    console.error('[optimizationSuggestions PATCH dismiss]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// ─── Shared generation helper ─────────────────────────────────────────────────

async function runGenerationForProject(projectId: number): Promise<void> {
  // Delete all non-dismissed suggestions for clean slate
  await db.run(`
    DELETE FROM scheduling_suggestions WHERE project_id = ? AND dismissed = false
  `, [projectId])

  const suggestions = await generateSuggestions(projectId)

  for (const s of suggestions) {
    await db.run(`
      INSERT INTO scheduling_suggestions
        (project_id, suggestion_type, title, description, savings_days, scene_ids, dismissed)
      VALUES (?, ?, ?, ?, ?, ?, false)
    `, [s.project_id, s.suggestion_type, s.title, s.description, s.savings_days, s.scene_ids])
  }
}

export default router
