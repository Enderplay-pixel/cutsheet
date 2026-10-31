import { Router, Request, Response } from 'express'
import { db } from '../db'
import { besetzungNachziehen } from '../lib/dispo'
import Anthropic from '@anthropic-ai/sdk'
import { getUserProjectRole, ROLE_RANK } from '../middleware/projectAuth'
import { ladeDrehtageMitSzenen } from './drehplan'

const router = Router()

// POST /api/projects/:pid/drehplan/ai-optimize
router.post('/projects/:pid/drehplan/ai-optimize', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  // Die Rolle im Projekt entscheidet, nicht die globale. Gemessen am
  // 24.10.2026: Die Inhaberin bekam in ihrem eigenen Projekt "Keine
  // Berechtigung" - registrierte Konten tragen global die Rolle "user", und
  // nur ein globaler Admin kam durch. Erlaubt ab Regie, wie vorher gemeint.
  const rolle = user.role === 'admin'
    ? 'admin'
    : await getUserProjectRole(user.id, Number(req.params.pid))
  if ((ROLE_RANK[rolle ?? ''] ?? 0) < ROLE_RANK.director) {
    return res.status(403).json({ data: null, error: 'Keine Berechtigung' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ data: null, error: 'KI nicht konfiguriert - ANTHROPIC_API_KEY fehlt' })
  }

  const pid = Number(req.params.pid)

  // Get all shoot days with their scenes
  const shootDays = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number ASC', [pid]) as any[]
  const scenes = await db.all(`
    SELECT s.*, l.name as location_name, sds.shoot_day_id, sds.sort_order as day_sort_order
    FROM scenes s
    LEFT JOIN locations l ON s.location_id = l.id
    LEFT JOIN shoot_day_scenes sds ON sds.scene_id = s.id
    WHERE s.project_id = ?
  `, [pid]) as any[]

  // Get cast per scene
  const castByScene: Record<number, string[]> = {}
  const sceneChars = await db.all(`
    SELECT sc.scene_id, c.actor_name
    FROM scene_characters sc
    JOIN characters ch ON ch.id = sc.character_id
    JOIN "cast" c ON c.character_id = ch.id AND c.project_id = ?
  `, [pid]) as any[]
  for (const sc of sceneChars) {
    if (!castByScene[sc.scene_id]) castByScene[sc.scene_id] = []
    castByScene[sc.scene_id].push(sc.actor_name)
  }

  // Sicherung vor dem Umbau - im selben Format wie "Version speichern"
  // (routes/drehplan.ts). Vorher { shoot_days, scenes }: Das Wiederherstellen
  // erwartete eine Liste von Tagen und brach mit 500 ab.
  await db.run(
    'INSERT INTO drehplan_versions (project_id, name, snapshot_json) VALUES (?, ?, ?)',
    [pid, `Vor KI-Optimierung ${new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}`, JSON.stringify(await ladeDrehtageMitSzenen(pid))]
  )

  // Build scene list for AI
  const sceneList = scenes.map((s: any) => ({
    id: s.id,
    scene_number: s.scene_number,
    location: s.location_name || 'Unbekannt',
    location_id: s.location_id,
    day_night: s.day_night,
    int_ext: s.int_ext,
    eighths: s.eighths,
    cast: castByScene[s.id] || [],
    current_day: s.shoot_day_id ? shootDays.find((d: any) => d.id === s.shoot_day_id)?.day_number : null,
  }))

  const prompt = `Du bist ein erfahrener Produktionsleiter. Optimiere den folgenden Drehplan.

Szenen: ${JSON.stringify(sceneList, null, 2)}

Drehtage: ${shootDays.length}

Optimierungsregeln (nach Priorität):
1. Gleiche Locations zusammenfassen (reduziert Rüstzeiten)
2. Cast-Konflikte vermeiden (gleicher Darsteller an verschiedenen Drehtagen)
3. Nacht-Szenen (day_night: NACHT) bündeln
4. INT-Szenen bei schlechtem Wetter bündeln
5. Kurze Szenen (wenige Achtel) als Puffer nutzen

Antworte NUR mit einem JSON-Array der optimierten Drehtags-Zuweisungen:
[
  { "scene_id": 1, "shoot_day_number": 1, "sort_order": 0 },
  { "scene_id": 2, "shoot_day_number": 1, "sort_order": 1 },
  ...
]

Verwende nur existierende Drehtagnummern (1-${shootDays.length}). Alle Szenen müssen zugewiesen werden.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = (msg.content[0] as any).text as string
  let assignments: any[]
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Kein JSON gefunden')
    assignments = JSON.parse(jsonMatch[0])
  } catch (e) {
    return res.status(500).json({ data: null, error: 'KI-Antwort konnte nicht verarbeitet werden' })
  }

  // Apply the new schedule - als Ganzes oder gar nicht. Vorher Zeile fuer
  // Zeile: Scheiterte eine mittendrin (etwa an einer sort_order wie "2a" aus
  // der KI-Antwort), blieb ein halb umgebauter Drehplan stehen.
  let movedCount = 0
  const zielTage: number[] = []
  await db.transaction(async (tx) => {
    for (const assignment of Array.isArray(assignments) ? assignments : []) {
      const day = shootDays.find((d: any) => d.day_number === Number(assignment?.shoot_day_number))
      if (!day) continue

      const scene = scenes.find((s: any) => s.id === Number(assignment?.scene_id))
      if (!scene) continue

      // Remove from current day if assigned
      if (scene.shoot_day_id) {
        await tx.run('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ? AND scene_id = ?', [scene.shoot_day_id, scene.id])
      }

      // Add to new day
      await tx.run(
        'INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
        [day.id, scene.id, Math.max(0, Math.round(Number(assignment?.sort_order) || 0))]
      )

      if (scene.shoot_day_id !== day.id) movedCount++
      zielTage.push(Number(day.id))
    }
    // Die Besetzung der verschobenen Szenen kommt in die Dispos (lib/dispo.ts)
    await besetzungNachziehen(tx, { tage: zielTage })
  })

  res.json({ data: { moved: movedCount, assignments, snapshot_created: true }, error: null })
})

export default router
