import { Router, Request, Response } from 'express'
import { db } from '../db'
import { validate } from '../middleware/validate'
import { ProjectSchema } from '../schemas'
import { getUserProjectRole, requireMember, ROLE_RANK } from '../middleware/projectAuth'
import { requireAuth } from '../middleware/auth'

const router = Router()

// GET /api/projects — only show own projects + projects user is member of
router.get('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const showArchived = req.query.archived === '1'

  // Global admins see all projects
  if (user.role === 'admin') {
    const projects = db.prepare(`
      SELECT DISTINCT p.* FROM projects p WHERE p.archived = ? ORDER BY p.updated_at DESC
    `).all(showArchived ? 1 : 0)
    return res.json({ data: projects, error: null })
  }

  const projects = db.prepare(`
    SELECT DISTINCT p.* FROM projects p
    WHERE (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
      AND p.archived = ?
    ORDER BY p.updated_at DESC
  `).all(user.id, user.id, showArchived ? 1 : 0)
  res.json({ data: projects, error: null })
})

// PATCH /api/projects/:id/archive
router.patch('/:id/archive', requireAuth, (req, res) => {
  const { archived } = req.body
  db.prepare("UPDATE projects SET archived=?, updated_at=datetime('now') WHERE id=?")
    .run(archived ? 1 : 0, req.params.id)
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json({ data: project, error: null })
})

// POST /api/projects — set owner, add creator as admin member
router.post('/', validate(ProjectSchema), (req, res) => {
  const userId = (req as any).user?.id
  const { title = 'Neues Projekt', genre = '', format = 'Kurzfilm', length_minutes = 0, status = 'Vorproduktion',
    synopsis = '', director = '', producer = '', dop = '', production_company = '', shoot_start = null, shoot_end = null } = req.body

  const result = db.prepare(`
    INSERT INTO projects (title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, userId || null)

  const id = result.lastInsertRowid
  db.prepare('INSERT INTO project_settings (project_id) VALUES (?)').run(id)

  // Add creator as project admin
  if (userId) {
    try {
      db.prepare('INSERT OR REPLACE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(id, userId, 'admin')
    } catch { /* ignore */ }
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  res.status(201).json({ data: project, error: null })
})

// GET /api/projects/:id
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  if (user.role !== 'admin') {
    const role = getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    ;(req as any).projectRole = role
  }

  const settings = db.prepare('SELECT * FROM project_settings WHERE project_id = ?').get(projectId)
  const my_role = (req as any).projectRole ?? 'admin'

  res.json({ data: { ...project as object, settings, my_role }, error: null })
})

// PUT /api/projects/:id
router.put('/:id', requireAuth, (req, res) => {
  const { title, genre, format, length_minutes, status, synopsis = '', director, producer, dop, production_company, shoot_start, shoot_end } = req.body

  db.prepare(`
    UPDATE projects SET title=?, genre=?, format=?, length_minutes=?, status=?, synopsis=?, director=?, producer=?, dop=?, production_company=?, shoot_start=?, shoot_end=?, updated_at=datetime('now')
    WHERE id=?
  `).run(title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, req.params.id)

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json({ data: project, error: null })
})

// PUT /api/projects/:id/settings
router.put('/:id/settings', requireAuth, (req, res) => {
  const {
    default_call_time = 480,
    default_wrap_time = 1200,
    turnaround_hours = 11,
    currency = 'EUR',
    country = 'Deutschland',
    logo_url = null,
    header_color = '#f59e0b',
  } = req.body

  const existing = db.prepare('SELECT id FROM project_settings WHERE project_id = ?').get(req.params.id)
  if (existing) {
    db.prepare(`
      UPDATE project_settings
      SET default_call_time=?, default_wrap_time=?, turnaround_hours=?, currency=?, country=?, logo_url=?, header_color=?
      WHERE project_id=?
    `).run(default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color, req.params.id)
  } else {
    db.prepare(`
      INSERT INTO project_settings (project_id, default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color)
  }

  const settings = db.prepare('SELECT * FROM project_settings WHERE project_id = ?').get(req.params.id)
  res.json({ data: settings, error: null })
})

// DELETE /api/projects/:id — owner or global admin only
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any
    if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })
    if (project.owner_id !== user.id) {
      return res.status(403).json({ data: null, error: 'Nur der Projektinhaber kann das Projekt löschen' })
    }
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
  res.json({ data: { ok: true }, error: null })
})

// ─── Member management ────────────────────────────────────────────────────────

// GET /api/projects/:id/members — list members with user info (owner always included)
router.get('/:id/members', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const members = db.prepare(`
    SELECT pm.user_id, pm.role, u.name, u.email
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(projectId) as any[]

  // Mark owner
  const result = members.map((m: any) => ({
    ...m,
    is_owner: m.user_id === project.owner_id,
  }))

  // If owner is not already in members list, add them
  if (project.owner_id && !members.find((m: any) => m.user_id === project.owner_id)) {
    const ownerUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(project.owner_id) as any
    if (ownerUser) {
      result.unshift({ user_id: ownerUser.id, role: 'admin', name: ownerUser.name, email: ownerUser.email, is_owner: true })
    }
  }

  res.json({ data: result, error: null })
})

// POST /api/projects/:id/members — add member { userId, role }
router.post('/:id/members', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    if ((ROLE_RANK[role] ?? 0) < ROLE_RANK.producer) {
      return res.status(403).json({ data: null, error: 'Nur Admins/Produzenten können Mitglieder hinzufügen' })
    }
  }

  const { userId, role: memberRole = 'read_only' } = req.body
  if (!userId) return res.status(400).json({ data: null, error: 'userId fehlt' })

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const targetUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as any
  if (!targetUser) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })

  db.prepare('INSERT OR REPLACE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(projectId, userId, memberRole)

  res.status(201).json({ data: { user_id: targetUser.id, name: targetUser.name, email: targetUser.email, role: memberRole }, error: null })
})

// PUT /api/projects/:id/members/:userId/role — change role
router.put('/:id/members/:userId/role', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    if ((ROLE_RANK[role] ?? 0) < ROLE_RANK.producer) {
      return res.status(403).json({ data: null, error: 'Nur Admins/Produzenten können Rollen ändern' })
    }
  }

  const targetUserId = Number(req.params.userId)
  const { role: newRole } = req.body
  if (!newRole) return res.status(400).json({ data: null, error: 'role fehlt' })

  const member = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, targetUserId)
  if (!member) return res.status(404).json({ data: null, error: 'Mitglied nicht gefunden' })

  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(newRole, projectId, targetUserId)

  const updated = db.prepare(`
    SELECT pm.user_id, pm.role, u.name, u.email
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ? AND pm.user_id = ?
  `).get(projectId, targetUserId)
  res.json({ data: updated, error: null })
})

// DELETE /api/projects/:id/members/:userId — remove member (can't remove owner)
router.delete('/:id/members/:userId', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    if ((ROLE_RANK[role] ?? 0) < ROLE_RANK.producer) {
      return res.status(403).json({ data: null, error: 'Nur Admins/Produzenten können Mitglieder entfernen' })
    }
  }

  const targetUserId = Number(req.params.userId)

  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  if (project.owner_id === targetUserId) {
    return res.status(400).json({ data: null, error: 'Der Projektinhaber kann nicht entfernt werden' })
  }

  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, targetUserId)
  res.json({ data: { ok: true }, error: null })
})

// POST /api/projects/:id/duplicate
router.post('/:id/duplicate', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const original = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any
  if (!original) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const result = db.prepare(`
    INSERT INTO projects (title, genre, format, length_minutes, status, director, producer, dop, production_company, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `${original.title} (Kopie)`, original.genre, original.format, original.length_minutes,
    'Entwicklung', original.director, original.producer, original.dop, original.production_company,
    user.id
  )

  const newId = result.lastInsertRowid
  db.prepare('INSERT INTO project_settings (project_id) VALUES (?)').run(newId)
  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(newId, user.id, 'admin')

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId)
  res.status(201).json({ data: project, error: null })
})

// GET /api/projects/:id/stats
router.get('/:id/stats', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)
  if (user.role !== 'admin') {
    const role = getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const pid = req.params.id

  const total_scenes = (db.prepare('SELECT COUNT(*) as c FROM scenes WHERE project_id = ?').get(pid) as any).c
  const shot_scenes = (db.prepare("SELECT COUNT(*) as c FROM scenes WHERE project_id = ? AND shot_status = 'abgedreht'").get(pid) as any).c
  const scheduled_scenes = (db.prepare(`
    SELECT COUNT(DISTINCT scene_id) as c FROM shoot_day_scenes sds
    JOIN shoot_days sd ON sds.shoot_day_id = sd.id
    WHERE sd.project_id = ?
  `).get(pid) as any).c
  const total_shoot_days = (db.prepare('SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ?').get(pid) as any).c
  const completed_shoot_days = (db.prepare("SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ? AND status = 'Abgedreht'").get(pid) as any).c
  const total_cast = (db.prepare('SELECT COUNT(*) as c FROM cast WHERE project_id = ?').get(pid) as any).c
  const total_crew = (db.prepare('SELECT COUNT(*) as c FROM crew WHERE project_id = ?').get(pid) as any).c
  const pagesRow = db.prepare('SELECT COALESCE(SUM(eighths), 0) as s FROM scenes WHERE project_id = ?').get(pid) as any
  const budgetRow = db.prepare('SELECT COALESCE(MAX(total_cents), 0) as s FROM budget_versions WHERE project_id = ? AND status = "Aktiv"').get(pid) as any
  const finRow = db.prepare('SELECT COALESCE(MAX(total_cents), 0) as s FROM financing_plan_versions WHERE project_id = ?').get(pid) as any

  const next_shoot_day = db.prepare(`
    SELECT * FROM shoot_days WHERE project_id = ? AND date >= date('now') AND status != 'Ausgefallen'
    ORDER BY date ASC LIMIT 1
  `).get(pid)

  res.json({
    data: {
      total_scenes,
      shot_scenes,
      scheduled_scenes,
      unscheduled_scenes: total_scenes - scheduled_scenes,
      total_shoot_days,
      completed_shoot_days,
      total_pages: pagesRow.s / 8,
      total_cast,
      total_crew,
      budget_total_cents: budgetRow.s,
      financing_total_cents: finRow.s,
      next_shoot_day: next_shoot_day || null,
    },
    error: null,
  })
})

export default router
