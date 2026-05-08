import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

const VALID_ROLES = ['admin', 'producer', 'director', 'dept_head', 'read_only']

// Helper: check if user owns or is admin-member of a project
function isProjectOwner(projectId: string | number, userId: number): boolean {
  const project = db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any
  if (!project) return false
  if (project.owner_id === userId) return true
  const mem = db.prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'admin'").get(projectId, userId)
  return !!mem
}

// ── Invite CRUD ────────────────────────────────────────────────────────────────

// GET /api/projects/:id/invites
router.get('/projects/:id/invites', requireAuth, (req: Request, res: Response) => {
  if (!isProjectOwner(req.params.id, req.user!.id)) {
    return res.status(403).json({ data: null, error: 'Nur Projekt-Admins können Einladungslinks sehen' })
  }
  const invites = db.prepare(
    'SELECT * FROM project_invites WHERE project_id = ? ORDER BY created_at DESC'
  ).all(req.params.id)
  return res.json({ data: invites, error: null })
})

// POST /api/projects/:id/invites
router.post('/projects/:id/invites', requireAuth, (req: Request, res: Response) => {
  if (!isProjectOwner(req.params.id, req.user!.id)) {
    return res.status(403).json({ data: null, error: 'Nur Projekt-Admins können Einladungslinks erstellen' })
  }
  const role = VALID_ROLES.includes(req.body.role) ? req.body.role : 'read_only'
  const label = String(req.body.label || '')
  const token = crypto.randomBytes(20).toString('hex')

  const result = db.prepare(
    'INSERT INTO project_invites (project_id, token, role, label, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, token, role, label, req.user!.id)

  const invite = db.prepare('SELECT * FROM project_invites WHERE id = ?').get(result.lastInsertRowid)
  return res.status(201).json({ data: invite, error: null })
})

// DELETE /api/projects/:id/invites/:iid
router.delete('/projects/:id/invites/:iid', requireAuth, (req: Request, res: Response) => {
  if (!isProjectOwner(req.params.id, req.user!.id)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  db.prepare('DELETE FROM project_invites WHERE id = ? AND project_id = ?').run(req.params.iid, req.params.id)
  return res.json({ data: { ok: true }, error: null })
})

// ── Public invite info (no auth) ───────────────────────────────────────────────

// GET /api/invites/:token
router.get('/invites/:token', (req: Request, res: Response) => {
  const invite = db.prepare(`
    SELECT pi.id, pi.token, pi.role, pi.label, pi.project_id, pi.expires_at,
           p.title as project_title, p.director, p.genre, p.format
    FROM project_invites pi
    JOIN projects p ON pi.project_id = p.id
    WHERE pi.token = ?
  `).get(req.params.token) as any

  if (!invite) return res.status(404).json({ data: null, error: 'Einladungslink ungültig oder abgelaufen' })

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ data: null, error: 'Dieser Einladungslink ist abgelaufen' })
  }

  return res.json({ data: invite, error: null })
})

// POST /api/invites/:token/accept  (requires auth)
router.post('/invites/:token/accept', requireAuth, (req: Request, res: Response) => {
  const invite = db.prepare(`
    SELECT pi.*, p.title as project_title
    FROM project_invites pi
    JOIN projects p ON pi.project_id = p.id
    WHERE pi.token = ?
  `).get(req.params.token) as any

  if (!invite) return res.status(404).json({ data: null, error: 'Einladungslink ungültig' })
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ data: null, error: 'Dieser Einladungslink ist abgelaufen' })
  }

  // Don't overwrite owner's existing admin role
  const existing = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(invite.project_id, req.user!.id) as any
  if (!existing || existing.role !== 'admin') {
    db.prepare(`
      INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
    `).run(invite.project_id, req.user!.id, invite.role)
  }

  return res.json({ data: { project_id: invite.project_id, project_title: invite.project_title, role: invite.role }, error: null })
})

// ── Members list ───────────────────────────────────────────────────────────────

// GET /api/projects/:id/members
router.get('/projects/:id/members', requireAuth, (req: Request, res: Response) => {
  if (!isProjectOwner(req.params.id, req.user!.id)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  const members = db.prepare(`
    SELECT pm.id, pm.role, u.id as user_id, u.email, u.name
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
    ORDER BY pm.id ASC
  `).all(req.params.id)
  return res.json({ data: members, error: null })
})

// PUT /api/projects/:id/members/:uid/role
router.put('/projects/:id/members/:uid/role', requireAuth, (req: Request, res: Response) => {
  if (!isProjectOwner(req.params.id, req.user!.id)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  const role = VALID_ROLES.includes(req.body.role) ? req.body.role : 'read_only'
  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(role, req.params.id, req.params.uid)
  return res.json({ data: { ok: true }, error: null })
})

// DELETE /api/projects/:id/members/:uid
router.delete('/projects/:id/members/:uid', requireAuth, (req: Request, res: Response) => {
  if (!isProjectOwner(req.params.id, req.user!.id)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.uid)
  return res.json({ data: { ok: true }, error: null })
})

export default router
