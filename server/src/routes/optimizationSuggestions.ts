import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { isoWoche } from '../lib/datum'

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
    SELECT c.id as cast_id, c.actor_name, sds.scene_id,
           sd.id as shoot_day_id, sd.day_number, sd.date
    FROM "cast" c
    JOIN scene_characters sc ON sc.character_id = c.character_id
    JOIN shoot_day_scenes sds ON sds.scene_id = sc.scene_id
    JOIN shoot_days sd ON sd.id = sds.shoot_day_id
    WHERE c.project_id = ? AND sd.date <> ''
    ORDER BY c.id, sd.date
  `, [projectId]) as any[]
  // shoot_days.date ist Text, NOT NULL DEFAULT '': "IS NOT NULL" ließ undatierte
  // Tage durch, und ein leeres Datum vorn ließ den ganzen Vorschlag ausfallen.
  const drehtage = (await db.all(
    "SELECT DISTINCT date FROM shoot_days WHERE project_id = ? AND date <> '' ORDER BY date",
    [projectId]
  ) as any[]).map((d) => String(d.date))

  const byCast = new Map<number, typeof castShootDays>()
  for (const row of castShootDays) {
    if (!byCast.has(row.cast_id)) byCast.set(row.cast_id, [])
    byCast.get(row.cast_id)!.push(row)
  }

  for (const [castId, rows] of byCast.entries()) {
    const sortedDates = [...new Set(rows.map((r: any) => r.date as string))].sort()
    if (sortedDates.length < 2) continue

    const firstDate = sortedDates[0]
    const lastDate = sortedDates[sortedDates.length - 1]
    const workingDateSet = new Set(sortedDates)

    // Hold wie im DOOD (routes/dood.ts): Drehtage zwischen dem ersten und
    // letzten Arbeitstag ohne die Person. Vorher Kalendertage samt
    // Wochenenden - gemessen am 25.10.2026: 6 statt 3.
    const holdDays = drehtage.filter((d) => d > firstDate && d < lastDate && !workingDateSet.has(d)).length

    if (holdDays > 1) {
      const actorName = rows[0].actor_name || `Darsteller ${castId}`
      const sceneIds = [...new Set(rows.map((r: any) => r.scene_id || null))].filter(Boolean)
      suggestions.push({
        project_id: projectId,
        suggestion_type: 'cast_gaps',
        title: `Hold-Tage für ${actorName} reduzieren`,
        description: `${actorName} hat ${holdDays} Hold-Tage zwischen den eigenen Drehtagen - Zusammenlegung der Drehtage könnte Kosten senken.`,
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
    WHERE s.project_id = ? AND s.day_night = 'NACHT' AND sd.date <> ''
    ORDER BY sd.date
  `, [projectId]) as any[]

  if (nightScenes.length > 0) {
    const weekNumbers = new Set<string>()
    for (const row of nightScenes) weekNumbers.add(isoWoche(row.date))

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
})

// POST /api/projects/:projectId/scheduling-suggestions/generate
router.post('/projects/:projectId/scheduling-suggestions/generate', async (req: Request, res: Response) => {
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
})

// PATCH /api/scheduling-suggestions/:id/dismiss
router.patch('/scheduling-suggestions/:id/dismiss', async (req: Request, res: Response) => {
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
})

// ─── Shared generation helper ─────────────────────────────────────────────────

async function runGenerationForProject(projectId: number): Promise<void> {
  // Delete all non-dismissed suggestions for clean slate
  await db.run(`
    DELETE FROM scheduling_suggestions WHERE project_id = ? AND dismissed = false
  `, [projectId])

  const suggestions = await generateSuggestions(projectId)
  // Verworfen bleibt verworfen, solange es dieselben Szenen betrifft. Vorher
  // kam ein verworfener Vorschlag beim nächsten Erzeugen wieder (gemessen am
  // 25.10.2026: alle verworfen, neu geladen - wieder da).
  const verworfen = new Set((await db.all(
    'SELECT suggestion_type, scene_ids FROM scheduling_suggestions WHERE project_id = ? AND dismissed = true',
    [projectId]
  ) as any[]).map((v) => `${v.suggestion_type}|${v.scene_ids}`))

  for (const s of suggestions) {
    if (verworfen.has(`${s.suggestion_type}|${s.scene_ids}`)) continue
    await db.run(`
      INSERT INTO scheduling_suggestions
        (project_id, suggestion_type, title, description, savings_days, scene_ids, dismissed)
      VALUES (?, ?, ?, ?, ?, ?, false)
    `, [s.project_id, s.suggestion_type, s.title, s.description, s.savings_days, s.scene_ids])
  }
}

export default router
