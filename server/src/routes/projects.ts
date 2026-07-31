import { Router, Request, Response } from 'express'
import { db } from '../db'
import { validate } from '../middleware/validate'
import { ProjectSchema } from '../schemas'
import { getUserProjectRole, requireMember, ROLE_RANK } from '../middleware/projectAuth'
import { requireAuth } from '../middleware/auth'

const router = Router()

/**
 * Formate, die ein Creator-Projekt ergeben. Solche Projekte brauchen keinen
 * Drehplan und keine Tagesdispo, sondern Videos, Skript-Abschnitte und ein
 * Upload-Paket.
 */
export const CREATOR_FORMATS = ['YouTube-Video', 'YouTube Shorts', 'Reel / TikTok', 'Podcast', 'Stream / Live']

function isCreatorFormat(format: string): boolean {
  return CREATOR_FORMATS.includes(String(format || '').trim())
}

// GET /api/projects — only show own projects + projects user is member of
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const showArchived = req.query.archived === '1'

  // Global admins see all projects
  if (user.role === 'admin') {
    const projects = await db.all(`
      SELECT DISTINCT p.* FROM projects p WHERE p.archived = ? ORDER BY p.updated_at DESC
    `, [showArchived ? 1 : 0])
    return res.json({ data: projects, error: null })
  }

  const projects = await db.all(`
    SELECT DISTINCT p.* FROM projects p
    WHERE (p.owner_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))
      AND p.archived = ?
    ORDER BY p.updated_at DESC
  `, [user.id, user.id, showArchived ? 1 : 0])
  res.json({ data: projects, error: null })
})

// PATCH /api/projects/:id/archive
router.patch('/:id/archive', requireAuth, async (req, res) => {
  const { archived } = req.body
  await db.run("UPDATE projects SET archived=?, updated_at=datetime('now') WHERE id=?", [archived ? 1 : 0, req.params.id])
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id])
  res.json({ data: project, error: null })
})

// POST /api/projects — set owner, add creator as admin member
router.post('/', validate(ProjectSchema), async (req, res) => {
  const userId = (req as any).user?.id
  const { title = 'Neues Projekt', genre = '', format = 'Kurzfilm', length_minutes = 0, status = 'Vorproduktion',
    synopsis = '', director = '', producer = '', dop = '', production_company = '', shoot_start = null, shoot_end = null } = req.body

  // Projektart bestimmt Navigation und Feature-Set. Wird sie nicht mitgeschickt,
  // leitet der Server sie aus dem Format ab — damit ist sie unabhaengig davon
  // gesetzt, welcher Client das Projekt anlegt.
  const project_kind = req.body.project_kind ?? (isCreatorFormat(format) ? 'creator' : 'film')

  const result = await db.run(`
    INSERT INTO projects (title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, owner_id, project_kind)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, userId || null, project_kind])

  const id = result.id
  await db.run('INSERT INTO project_settings (project_id) VALUES (?)', [id])

  // Add creator as project admin
  if (userId) {
    await db.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role', [id, userId, 'admin'])
  }

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [id])
  res.status(201).json({ data: project, error: null })
})

// GET /api/projects/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  if (user.role !== 'admin') {
    const role = await getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    ;(req as any).projectRole = role
  }

  const settings = await db.get('SELECT * FROM project_settings WHERE project_id = ?', [projectId])
  const my_role = (req as any).projectRole ?? 'admin'

  res.json({ data: { ...project as object, settings, my_role }, error: null })
})

// PUT /api/projects/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { title, genre, format, length_minutes, status, synopsis = '', director, producer, dop, production_company, shoot_start, shoot_end } = req.body

  // Die Projektart wird beim Speichern immer aus dem Format abgeleitet — sie ist
  // abgeleiteter Zustand, nicht eigene Eingabe. Ein mitgeschicktes project_kind
  // wird bewusst ignoriert: Oberflaechen schicken den geladenen Datensatz
  // unveraendert zurueck, und der alte Wert wuerde den Formatwechsel aushebeln.
  const project_kind = isCreatorFormat(format) ? 'creator' : 'film'

  await db.run(`
    UPDATE projects SET title=?, genre=?, format=?, length_minutes=?, status=?, synopsis=?, director=?, producer=?, dop=?, production_company=?, shoot_start=?, shoot_end=?, project_kind=?, updated_at=NOW()
    WHERE id=?
  `, [title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, project_kind, req.params.id])

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id])
  res.json({ data: project, error: null })
})

// PUT /api/projects/:id/settings
router.put('/:id/settings', requireAuth, async (req, res) => {
  const {
    default_call_time = 480,
    default_wrap_time = 1200,
    turnaround_hours = 11,
    currency = 'EUR',
    country = 'Deutschland',
    logo_url = null,
    header_color = '#f59e0b',
  } = req.body

  const existing = await db.get('SELECT id FROM project_settings WHERE project_id = ?', [req.params.id])
  if (existing) {
    await db.run(`
      UPDATE project_settings
      SET default_call_time=?, default_wrap_time=?, turnaround_hours=?, currency=?, country=?, logo_url=?, header_color=?
      WHERE project_id=?
    `, [default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color, req.params.id])
  } else {
    await db.run(`
      INSERT INTO project_settings (project_id, default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.id, default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color])
  }

  const settings = await db.get('SELECT * FROM project_settings WHERE project_id = ?', [req.params.id])
  res.json({ data: settings, error: null })
})

// DELETE /api/projects/:id — owner or global admin only
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId]) as any
    if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })
    if (project.owner_id !== user.id) {
      return res.status(403).json({ data: null, error: 'Nur der Projektinhaber kann das Projekt löschen' })
    }
  }

  await db.run('DELETE FROM projects WHERE id = ?', [projectId])
  res.json({ data: { ok: true }, error: null })
})

// ─── Member management ────────────────────────────────────────────────────────

// GET /api/projects/:id/members — list members with user info (owner always included)
router.get('/:id/members', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = await getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const members = await db.all(`
    SELECT pm.user_id, pm.role, u.name, u.email
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `, [projectId]) as any[]

  // Mark owner
  const result = members.map((m: any) => ({
    ...m,
    is_owner: m.user_id === project.owner_id,
  }))

  // If owner is not already in members list, add them
  if (project.owner_id && !members.find((m: any) => m.user_id === project.owner_id)) {
    const ownerUser = await db.get('SELECT id, name, email FROM users WHERE id = ?', [project.owner_id]) as any
    if (ownerUser) {
      result.unshift({ user_id: ownerUser.id, role: 'admin', name: ownerUser.name, email: ownerUser.email, is_owner: true })
    }
  }

  res.json({ data: result, error: null })
})

// POST /api/projects/:id/members — add member { userId, role }
router.post('/:id/members', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = await getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    if ((ROLE_RANK[role] ?? 0) < ROLE_RANK.producer) {
      return res.status(403).json({ data: null, error: 'Nur Admins/Produzenten können Mitglieder hinzufügen' })
    }
  }

  const { userId, role: memberRole = 'read_only' } = req.body
  if (!userId) return res.status(400).json({ data: null, error: 'userId fehlt' })

  const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId])
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const targetUser = await db.get('SELECT id, name, email FROM users WHERE id = ?', [userId]) as any
  if (!targetUser) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })

  await db.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role', [projectId, userId, memberRole])

  res.status(201).json({ data: { user_id: targetUser.id, name: targetUser.name, email: targetUser.email, role: memberRole }, error: null })
})

// PUT /api/projects/:id/members/:userId/role — change role
router.put('/:id/members/:userId/role', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = await getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    if ((ROLE_RANK[role] ?? 0) < ROLE_RANK.producer) {
      return res.status(403).json({ data: null, error: 'Nur Admins/Produzenten können Rollen ändern' })
    }
  }

  const targetUserId = Number(req.params.userId)
  const { role: newRole } = req.body
  if (!newRole) return res.status(400).json({ data: null, error: 'role fehlt' })

  const member = await db.get('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, targetUserId])
  if (!member) return res.status(404).json({ data: null, error: 'Mitglied nicht gefunden' })

  await db.run('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?', [newRole, projectId, targetUserId])

  const updated = await db.get(`
    SELECT pm.user_id, pm.role, u.name, u.email
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ? AND pm.user_id = ?
  `, [projectId, targetUserId])
  res.json({ data: updated, error: null })
})

// DELETE /api/projects/:id/members/:userId — remove member (can't remove owner)
router.delete('/:id/members/:userId', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = await getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    if ((ROLE_RANK[role] ?? 0) < ROLE_RANK.producer) {
      return res.status(403).json({ data: null, error: 'Nur Admins/Produzenten können Mitglieder entfernen' })
    }
  }

  const targetUserId = Number(req.params.userId)

  const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  if (project.owner_id === targetUserId) {
    return res.status(400).json({ data: null, error: 'Der Projektinhaber kann nicht entfernt werden' })
  }

  await db.run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, targetUserId])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/projects/:id/duplicate
router.post('/:id/duplicate', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)

  if (user.role !== 'admin') {
    const role = await getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const original = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]) as any
  if (!original) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const result = await db.run(`
    INSERT INTO projects (title, genre, format, length_minutes, status, director, producer, dop, production_company, owner_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    `${original.title} (Kopie)`, original.genre, original.format, original.length_minutes,
    'Entwicklung', original.director, original.producer, original.dop, original.production_company,
    user.id
  ])

  const newId = result.id
  await db.run('INSERT INTO project_settings (project_id) VALUES (?)', [newId])
  await db.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [newId, user.id, 'admin'])

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [newId])
  res.status(201).json({ data: project, error: null })
})

// GET /api/projects/:id/stats
router.get('/:id/stats', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const projectId = Number(req.params.id)
  if (user.role !== 'admin') {
    const role = await getUserProjectRole(user.id, projectId)
    if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const pid = req.params.id

  const total_scenes = ((await db.get('SELECT COUNT(*) as c FROM scenes WHERE project_id = ?', [pid])) as any).c
  const shot_scenes = ((await db.get("SELECT COUNT(*) as c FROM scenes WHERE project_id = ? AND shot_status = 'abgedreht'", [pid])) as any).c
  const scheduled_scenes = ((await db.get(`
    SELECT COUNT(DISTINCT scene_id) as c FROM shoot_day_scenes sds
    JOIN shoot_days sd ON sds.shoot_day_id = sd.id
    WHERE sd.project_id = ?
  `, [pid])) as any).c
  const total_shoot_days = ((await db.get('SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ?', [pid])) as any).c
  const completed_shoot_days = ((await db.get("SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ? AND status = 'Abgedreht'", [pid])) as any).c
  const total_cast = ((await db.get('SELECT COUNT(*) as c FROM cast WHERE project_id = ?', [pid])) as any).c
  const total_crew = ((await db.get('SELECT COUNT(*) as c FROM crew WHERE project_id = ?', [pid])) as any).c
  const pagesRow = await db.get('SELECT COALESCE(SUM(eighths), 0) as s FROM scenes WHERE project_id = ?', [pid]) as any
  const budgetRow = await db.get('SELECT COALESCE(MAX(total_cents), 0) as s FROM budget_versions WHERE project_id = ? AND status = \'Aktiv\'', [pid]) as any
  const finRow = await db.get('SELECT COALESCE(MAX(total_cents), 0) as s FROM financing_plan_versions WHERE project_id = ?', [pid]) as any

  const next_shoot_day = await db.get(`
    SELECT * FROM shoot_days WHERE project_id = ? AND date::date >= CURRENT_DATE AND status != 'Ausgefallen'
    ORDER BY date ASC LIMIT 1
  `, [pid])

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
