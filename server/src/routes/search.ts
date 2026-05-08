import { Router } from 'express'
import { db } from '../db'

const router = Router()

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

router.get('/projects/:projectId/search', (req, res) => {
  const rawQ = String(req.query.q || '')
  if (!rawQ.trim()) {
    return res.json({ data: [], error: null })
  }
  const q = `%${rawQ}%`
  const pid = req.params.projectId

  const scenes = (db.prepare(
    "SELECT id, scene_number, title as name FROM scenes WHERE project_id = ? AND (title LIKE ? OR scene_number LIKE ? OR description LIKE ?)"
  ).all(pid, q, q, q) as any[]).map(r => ({
    type: 'scene',
    id: r.id,
    title: `Szene ${r.scene_number}: ${r.name}`,
    subtitle: 'Szene',
    url: `/projects/${pid}/drehbuch`,
  }))

  const screenplay = (db.prepare(
    `SELECT sb.id, sb.content, sb.block_type, s.id as scene_id, s.scene_number, s.title
     FROM screenplay_blocks sb
     JOIN scenes s ON sb.scene_id = s.id
     WHERE sb.project_id = ? AND sb.content LIKE ?`
  ).all(pid, q) as any[]).map(r => {
    const snip = snippet(r.content, rawQ, 50)
    const label = `Szene ${r.scene_number}: ${snip.slice(0, 60)}${snip.length > 60 ? '…' : ''}`
    return {
      type: 'screenplay',
      id: r.id,
      title: label,
      subtitle: r.block_type,
      url: `/projects/${pid}/drehbuch`,
      snippet: snip,
      scene_id: r.scene_id,
    }
  })

  const cast = (db.prepare(
    "SELECT id, actor_name FROM cast WHERE project_id = ? AND actor_name LIKE ?"
  ).all(pid, q) as any[]).map(r => ({
    type: 'cast',
    id: r.id,
    title: r.actor_name,
    subtitle: 'Darsteller*in',
    url: `/projects/${pid}/besetzung`,
  }))

  const crew = (db.prepare(
    "SELECT id, name, role, department FROM crew WHERE project_id = ? AND (name LIKE ? OR role LIKE ?)"
  ).all(pid, q, q) as any[]).map(r => ({
    type: 'crew',
    id: r.id,
    title: r.name,
    subtitle: `${r.role} — ${r.department}`,
    url: `/projects/${pid}/stabliste`,
  }))

  const locations = (db.prepare(
    "SELECT id, name, city FROM locations WHERE project_id = ? AND (name LIKE ? OR city LIKE ? OR address LIKE ?)"
  ).all(pid, q, q, q) as any[]).map(r => ({
    type: 'location',
    id: r.id,
    title: r.name,
    subtitle: r.city,
    url: `/projects/${pid}/motive`,
  }))

  const all = [...scenes, ...screenplay, ...cast, ...crew, ...locations].slice(0, 50)
  res.json({ data: all, error: null })
})

export default router
