import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { sendEmail, isSmtpConfigured, appBaseUrl } from './emailService'

const router = Router()

const VALID_ROLES = ['admin', 'producer', 'director', 'dept_head', 'read_only']

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  producer: 'Produktion',
  director: 'Regie',
  dept_head: 'Department-Leitung',
  read_only: 'Lesezugriff',
}

async function sendInviteEmail(invite: { token: string; role: string; email: string }, projectId: number, inviterName: string) {
  const project = await db.get('SELECT title FROM projects WHERE id = ?', [projectId]) as { title: string } | undefined
  if (!project) return false
  const link = `${appBaseUrl()}/invite/${invite.token}`
  await sendEmail({
    to: invite.email,
    subject: `Einladung zum Filmprojekt „${project.title}"`,
    projectId,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;">
        <h2 style="color:#111;">Du bist eingeladen!</h2>
        <p>${inviterName || 'Ein Teammitglied'} hat dich zum Filmprojekt <strong>„${project.title}"</strong> auf CutSheet eingeladen
           - Rolle: <strong>${ROLE_LABELS[invite.role] ?? invite.role}</strong>.</p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#b45309;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Einladung annehmen</a>
        </p>
        <p style="color:#6b7280;font-size:13px;">CutSheet ist kostenlos - Drehplan, Tagesdispo, Besetzung und mehr an einem Ort.</p>
      </div>`,
  })
  return true
}

// Helper: check if user owns or is admin-member of a project.
// Globale Admins duerfen wie ueberall sonst (siehe middleware/projectAuth) alles.
async function isProjectOwner(projectId: string | number, user: { id: number; role?: string }): Promise<boolean> {
  const userId = user.id
  const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId]) as any
  if (!project) return false
  if (user.role === 'admin') return true
  if (project.owner_id === userId) return true
  const mem = await db.get("SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND role = 'admin'", [projectId, userId])
  return !!mem
}

// ── Invite CRUD ────────────────────────────────────────────────────────────────

// GET /api/projects/:id/invites
router.get('/projects/:id/invites', requireAuth, async (req: Request, res: Response) => {
  if (!await isProjectOwner(req.params.id, req.user!)) {
    return res.status(403).json({ data: null, error: 'Nur Projekt-Admins können Einladungslinks sehen' })
  }
  const invites = await db.all(
    'SELECT * FROM project_invites WHERE project_id = ? ORDER BY created_at DESC',
    [req.params.id]
  )
  return res.json({ data: invites, error: null })
})

// POST /api/projects/:id/invites
router.post('/projects/:id/invites', requireAuth, async (req: Request, res: Response) => {
  if (!await isProjectOwner(req.params.id, req.user!)) {
    return res.status(403).json({ data: null, error: 'Nur Projekt-Admins können Einladungslinks erstellen' })
  }
  const role = VALID_ROLES.includes(req.body.role) ? req.body.role : 'read_only'
  const label = String(req.body.label || '')
  const email = String(req.body.email || '').trim()
  const token = crypto.randomBytes(20).toString('hex')

  const result = await db.run(
    'INSERT INTO project_invites (project_id, token, role, label, created_by, email) VALUES (?, ?, ?, ?, ?, ?)',
    [req.params.id, token, role, label, req.user!.id, email]
  )

  // Optional: Einladung direkt per E-Mail verschicken
  let emailSent = false
  if (email && isSmtpConfigured()) {
    try {
      emailSent = await sendInviteEmail({ token, role, email }, Number(req.params.id), req.user!.name)
      if (emailSent) {
        await db.run('UPDATE project_invites SET email_sent_at = NOW() WHERE id = ?', [result.id])
      }
    } catch (err) {
      console.error('[invites] E-Mail-Versand fehlgeschlagen', err)
    }
  }

  const invite = await db.get('SELECT * FROM project_invites WHERE id = ?', [result.id])
  return res.status(201).json({ data: { ...invite, email_sent: emailSent }, error: null })
})

// POST /api/projects/:id/invites/:iid/resend - Einladung erneut mailen
router.post('/projects/:id/invites/:iid/resend', requireAuth, async (req: Request, res: Response) => {
  if (!await isProjectOwner(req.params.id, req.user!)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  const invite = await db.get(
    'SELECT * FROM project_invites WHERE id = ? AND project_id = ?',
    [req.params.iid, req.params.id]
  ) as { token: string; role: string; email: string } | undefined
  if (!invite) return res.status(404).json({ data: null, error: 'Einladung nicht gefunden' })
  if (!invite.email) return res.status(400).json({ data: null, error: 'Einladung hat keine E-Mail-Adresse' })
  if (!isSmtpConfigured()) return res.status(400).json({ data: null, error: 'E-Mail-Versand ist auf diesem Server nicht konfiguriert' })

  try {
    await sendInviteEmail(invite, Number(req.params.id), req.user!.name)
    await db.run('UPDATE project_invites SET email_sent_at = NOW() WHERE id = ?', [req.params.iid])
    return res.json({ data: { ok: true }, error: null })
  } catch (err) {
    console.error('[invites/resend]', err)
    return res.status(500).json({ data: null, error: 'E-Mail-Versand fehlgeschlagen' })
  }
})

// DELETE /api/projects/:id/invites/:iid
router.delete('/projects/:id/invites/:iid', requireAuth, async (req: Request, res: Response) => {
  if (!await isProjectOwner(req.params.id, req.user!)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  await db.run('DELETE FROM project_invites WHERE id = ? AND project_id = ?', [req.params.iid, req.params.id])
  return res.json({ data: { ok: true }, error: null })
})

// ── Public invite info (no auth) ───────────────────────────────────────────────

// GET /api/invites/:token
router.get('/invites/:token', async (req: Request, res: Response) => {
  const invite = await db.get(`
    SELECT pi.id, pi.token, pi.role, pi.label, pi.project_id, pi.expires_at,
           p.title as project_title, p.director, p.genre, p.format
    FROM project_invites pi
    JOIN projects p ON pi.project_id = p.id
    WHERE pi.token = ?
  `, [req.params.token]) as any

  if (!invite) return res.status(404).json({ data: null, error: 'Einladungslink ungültig oder abgelaufen' })

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ data: null, error: 'Dieser Einladungslink ist abgelaufen' })
  }

  return res.json({ data: invite, error: null })
})

// POST /api/invites/:token/accept  (requires auth)
router.post('/invites/:token/accept', requireAuth, async (req: Request, res: Response) => {
  const invite = await db.get(`
    SELECT pi.*, p.title as project_title
    FROM project_invites pi
    JOIN projects p ON pi.project_id = p.id
    WHERE pi.token = ?
  `, [req.params.token]) as any

  if (!invite) return res.status(404).json({ data: null, error: 'Einladungslink ungültig' })
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ data: null, error: 'Dieser Einladungslink ist abgelaufen' })
  }

  // Don't overwrite owner's existing admin role
  const existing = await db.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [invite.project_id, req.user!.id]) as any
  if (!existing || existing.role !== 'admin') {
    await db.run(`
      INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
    `, [invite.project_id, req.user!.id, invite.role])
  }

  return res.json({ data: { project_id: invite.project_id, project_title: invite.project_title, role: invite.role }, error: null })
})

// ── Members list ───────────────────────────────────────────────────────────────

// GET /api/projects/:id/members
router.get('/projects/:id/members', requireAuth, async (req: Request, res: Response) => {
  if (!await isProjectOwner(req.params.id, req.user!)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  const members = await db.all(`
    SELECT pm.id, pm.role, u.id as user_id, u.email, u.name
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
    ORDER BY pm.id ASC
  `, [req.params.id])
  return res.json({ data: members, error: null })
})

// PUT /api/projects/:id/members/:uid/role
router.put('/projects/:id/members/:uid/role', requireAuth, async (req: Request, res: Response) => {
  if (!await isProjectOwner(req.params.id, req.user!)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  const role = VALID_ROLES.includes(req.body.role) ? req.body.role : 'read_only'
  await db.run('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?', [role, req.params.id, req.params.uid])
  return res.json({ data: { ok: true }, error: null })
})

// DELETE /api/projects/:id/members/:uid
router.delete('/projects/:id/members/:uid', requireAuth, async (req: Request, res: Response) => {
  if (!await isProjectOwner(req.params.id, req.user!)) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff' })
  }
  await db.run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [req.params.id, req.params.uid])
  return res.json({ data: { ok: true }, error: null })
})

export default router
