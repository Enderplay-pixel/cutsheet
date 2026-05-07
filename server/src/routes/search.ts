import { Router } from 'express'
import { db } from '../db'

const router = Router()

router.get('/projects/:projectId/search', (req, res) => {
  const q = `%${req.query.q || ''}%`
  const pid = req.params.projectId

  const scenes = (db.prepare("SELECT id, scene_number, title as name FROM scenes WHERE project_id = ? AND (title LIKE ? OR scene_number LIKE ? OR description LIKE ?)").all(pid, q, q, q) as any[]).map(r => ({
    type: 'scene', id: r.id, title: `Szene ${r.scene_number}: ${r.name}`, subtitle: 'Szene', url: `/projects/${pid}/drehbuch`
  }))

  const cast = (db.prepare("SELECT id, actor_name FROM cast WHERE project_id = ? AND actor_name LIKE ?").all(pid, q) as any[]).map(r => ({
    type: 'cast', id: r.id, title: r.actor_name, subtitle: 'Darsteller*in', url: `/projects/${pid}/besetzung`
  }))

  const crew = (db.prepare("SELECT id, name, role, department FROM crew WHERE project_id = ? AND (name LIKE ? OR role LIKE ?)").all(pid, q, q) as any[]).map(r => ({
    type: 'crew', id: r.id, title: r.name, subtitle: `${r.role} — ${r.department}`, url: `/projects/${pid}/stabliste`
  }))

  const locations = (db.prepare("SELECT id, name, city FROM locations WHERE project_id = ? AND (name LIKE ? OR city LIKE ? OR address LIKE ?)").all(pid, q, q, q) as any[]).map(r => ({
    type: 'location', id: r.id, title: r.name, subtitle: r.city, url: `/projects/${pid}/motive`
  }))

  res.json({ data: [...scenes, ...cast, ...crew, ...locations].slice(0, 30), error: null })
})

export default router
