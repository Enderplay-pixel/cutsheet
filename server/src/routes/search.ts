import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { enthaeltMuster } from '../lib/suchmuster'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

function snippet(content: string, query: string, radius = 50): string {
  const lower = content.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, radius * 2)
  const start = Math.max(0, idx - radius)
  const end = Math.min(content.length, idx + query.length + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < content.length ? '…' : ''
  return prefix + content.slice(start, end) + suffix
}

/*
 * ILIKE statt LIKE: In SQLite war `LIKE` für ASCII unempfindlich gegenüber
 * Groß- und Kleinschreibung, in PostgreSQL ist es das nicht. Nach dem Umzug
 * fand "Jana" fünfzig Treffer und "jana" keinen.
 */
router.get('/projects/:projectId/search', async (req, res) => {
  const rawQ = String(req.query.q || '')
  if (!rawQ.trim()) {
    return res.json({ data: [], error: null })
  }
  const q = enthaeltMuster(rawQ)
  const pid = req.params.projectId

  const [scenesRaw, screenplayRaw, castRaw, crewRaw, locationsRaw, figurenRaw] = await Promise.all([
    db.all(
      "SELECT id, scene_number, title as name FROM scenes WHERE project_id = ? AND (title ILIKE ? OR scene_number ILIKE ? OR description ILIKE ?) LIMIT 50",
      [pid, q, q, q]
    ),
    db.all(
      `SELECT sb.id, sb.content, sb.block_type, s.id as scene_id, s.scene_number, s.title
       FROM screenplay_blocks sb
       JOIN scenes s ON sb.scene_id = s.id
       WHERE sb.project_id = ? AND sb.content ILIKE ? LIMIT 50`,
      [pid, q]
    ),
    db.all(
      `SELECT c.id, c.actor_name, c.character_id, ch.name AS figur
         FROM cast c LEFT JOIN characters ch ON ch.id = c.character_id
        WHERE c.project_id = ? AND c.actor_name ILIKE ? LIMIT 50`,
      [pid, q]
    ),
    db.all(
      "SELECT id, name, role, department FROM crew WHERE project_id = ? AND (name ILIKE ? OR role ILIKE ?) LIMIT 50",
      [pid, q, q]
    ),
    db.all(
      "SELECT id, name, city FROM locations WHERE project_id = ? AND (name ILIKE ? OR city ILIKE ? OR address ILIKE ?) LIMIT 50",
      [pid, q, q, q]
    ),
    db.all("SELECT id FROM characters WHERE project_id = ? AND name ILIKE ? LIMIT 20", [pid, q]),
  ])

  // Alles ist verknüpft (Florian, 27.10.2026): Wer eine Figur oder ihre
  // Darstellerin sucht, findet auch die Figur selbst, ihre Szenen und die
  // Drehtage, an denen sie dreht - nicht nur Textstellen mit dem Namen.
  const figurIds = [...new Set([
    ...(figurenRaw as any[]).map(f => f.id),
    ...(castRaw as any[]).filter(c => c.character_id).map(c => c.character_id),
  ])]
  const [figuren, besetzung, figurSzenen, figurTage] = figurIds.length === 0 ? [[], [], [], []] : await Promise.all([
    db.all('SELECT id, name FROM characters WHERE project_id = ? AND id = ANY(?::int[]) ORDER BY sort_order, name', [pid, figurIds]),
    db.all('SELECT character_id, actor_name FROM cast WHERE project_id = ? AND character_id = ANY(?::int[]) ORDER BY id', [pid, figurIds]),
    db.all(
      `SELECT s.id, s.scene_number, s.title AS name, ch.name AS figur
         FROM scene_characters sc
         JOIN scenes s ON s.id = sc.scene_id
         JOIN characters ch ON ch.id = sc.character_id
        WHERE s.project_id = ? AND sc.character_id = ANY(?::int[])
        ORDER BY s.sort_order, s.id`,
      [pid, figurIds]
    ),
    db.all(
      `SELECT sd.id, sd.day_number, sd.date, ch.name AS figur, s.scene_number
         FROM scene_characters sc
         JOIN characters ch ON ch.id = sc.character_id
         JOIN scenes s ON s.id = sc.scene_id
         JOIN shoot_day_scenes sds ON sds.scene_id = sc.scene_id
         JOIN shoot_days sd ON sd.id = sds.shoot_day_id
        WHERE sd.project_id = ? AND sc.character_id = ANY(?::int[])
        ORDER BY sd.date, sd.day_number, s.sort_order`,
      [pid, figurIds]
    ),
  ]) as any[][]

  // Die Beschriftungen setzt der Client in der gewählten Sprache zusammen
  const figurTreffer = figuren.map(f => ({
    type: 'character',
    id: f.id,
    title: f.name,
    darsteller: besetzung.filter(b => b.character_id === f.id).map(b => b.actor_name).filter(Boolean),
    url: `/projects/${pid}/besetzung`,
  }))

  const cast = (castRaw as any[]).map(r => ({
    type: 'cast',
    id: r.id,
    title: r.actor_name,
    figur: r.figur ?? null,
    url: `/projects/${pid}/besetzung`,
  }))

  const tage = new Map<number, { type: string; id: number; day_number: number; date: string; figuren: string[]; szenen: string[]; url: string }>()
  for (const t of figurTage) {
    const tag = tage.get(t.id) ?? { type: 'shoot_day', id: t.id, day_number: t.day_number, date: t.date, figuren: [], szenen: [], url: `/projects/${pid}/tagesdispo/${t.id}` }
    if (!tag.figuren.includes(t.figur)) tag.figuren.push(t.figur)
    if (!tag.szenen.includes(t.scene_number)) tag.szenen.push(t.scene_number)
    tage.set(t.id, tag)
  }

  // Szenen der Figur zuerst, dann die übrigen Treffer im Titel - jede Szene einmal
  const szenenIds = new Set<number>()
  const scenes = [
    ...figurSzenen.map(r => ({ ...r, figur: r.figur as string | null })),
    ...(scenesRaw as any[]).map(r => ({ ...r, figur: null })),
  ].filter(r => !szenenIds.has(r.id) && szenenIds.add(r.id)).map(r => ({
    type: 'scene',
    id: r.id,
    scene_number: r.scene_number,
    title: r.name,
    figur: r.figur,
    url: `/projects/${pid}/drehbuch`,
  }))

  const screenplay = (screenplayRaw as any[]).map(r => ({
    type: 'screenplay',
    id: r.id,
    scene_number: r.scene_number,
    block_type: r.block_type,
    snippet: snippet(r.content, rawQ, 50),
    scene_id: r.scene_id,
    url: `/projects/${pid}/drehbuch`,
  }))

  const crew = (crewRaw as any[]).map(r => ({
    type: 'crew',
    id: r.id,
    title: r.name,
    subtitle: `${r.role} - ${r.department}`,
    url: `/projects/${pid}/stabliste`,
  }))

  const locations = (locationsRaw as any[]).map(r => ({
    type: 'location',
    id: r.id,
    title: r.name,
    subtitle: r.city,
    url: `/projects/${pid}/motive`,
  }))

  const all = [...figurTreffer, ...cast, ...tage.values(), ...scenes, ...screenplay, ...crew, ...locations].slice(0, 50)
  res.json({ data: all, error: null })
})

export default router
