import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { requireAuth, requireRole } from '../middleware/auth'

const router = Router()

// All admin routes require auth + admin role
router.use(requireAuth, requireRole('admin'))

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  const totalUsers    = ((await db.get('SELECT COUNT(*) as c FROM users', [])) as any).c
  const totalProjects = ((await db.get('SELECT COUNT(*) as c FROM projects', [])) as any).c
  const totalScenes   = ((await db.get('SELECT COUNT(*) as c FROM scenes', [])) as any).c
  const totalDays     = ((await db.get('SELECT COUNT(*) as c FROM shoot_days', [])) as any).c
  const totalCrew     = ((await db.get('SELECT COUNT(*) as c FROM crew', [])) as any).c
  const totalBlocks   = ((await db.get('SELECT COUNT(*) as c FROM screenplay_blocks', [])) as any).c

  // New users last 7 days
  const newUsers7d = ((await db.get(
    "SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now', '-7 days')", []
  )) as any).c

  // New projects last 7 days
  const newProjects7d = ((await db.get(
    "SELECT COUNT(*) as c FROM projects WHERE created_at >= datetime('now', '-7 days')", []
  )) as any).c

  // Most active users (by project membership)
  const topUsers = await db.all(`
    SELECT u.id, u.name, u.email, u.role, u.created_at,
           COUNT(DISTINCT pm.project_id) as project_count
    FROM users u
    LEFT JOIN project_members pm ON pm.user_id = u.id
    GROUP BY u.id
    ORDER BY project_count DESC, u.created_at DESC
    LIMIT 5
  `, [])

  // Recently created projects
  const recentProjects = await db.all(`
    SELECT p.id, p.title, p.status, p.created_at, p.archived,
           u.name as owner_name, u.email as owner_email,
           (SELECT COUNT(*) FROM scenes WHERE project_id = p.id) as scene_count,
           (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    ORDER BY p.created_at DESC
    LIMIT 5
  `, [])

  res.json({
    data: {
      totalUsers, totalProjects, totalScenes, totalDays, totalCrew, totalBlocks,
      newUsers7d, newProjects7d, topUsers, recentProjects,
    },
    error: null,
  })
})

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (_req: Request, res: Response) => {
  const users = await db.all(`
    SELECT u.id, u.email, u.name, u.role, u.created_at,
           COUNT(DISTINCT pm.project_id) as project_count,
           (SELECT p.title FROM projects p
            JOIN project_members pm2 ON pm2.project_id = p.id
            WHERE pm2.user_id = u.id
            ORDER BY p.updated_at DESC LIMIT 1) as last_project_title,
           (SELECT p.updated_at FROM projects p
            JOIN project_members pm2 ON pm2.project_id = p.id
            WHERE pm2.user_id = u.id
            ORDER BY p.updated_at DESC LIMIT 1) as last_active
    FROM users u
    LEFT JOIN project_members pm ON pm.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `, [])
  res.json({ data: users, error: null })
})

// ─── GET /api/admin/users/:id/projects ───────────────────────────────────────
router.get('/users/:id/projects', async (req: Request, res: Response) => {
  const userId = Number(req.params.id)
  const projects = await db.all(`
    SELECT p.id, p.title, p.status, p.archived, p.created_at, p.updated_at,
           pm.role as member_role,
           (SELECT COUNT(*) FROM scenes WHERE project_id = p.id) as scene_count,
           (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    ORDER BY p.updated_at DESC
  `, [userId])
  res.json({ data: projects, error: null })
})

// ─── GET /api/admin/projects ──────────────────────────────────────────────────
router.get('/projects', async (_req: Request, res: Response) => {
  const projects = await db.all(`
    SELECT p.id, p.title, p.status, p.archived, p.created_at, p.updated_at,
           u.id as owner_id, u.name as owner_name, u.email as owner_email,
           (SELECT COUNT(*) FROM scenes WHERE project_id = p.id) as scene_count,
           (SELECT COUNT(*) FROM shoot_days WHERE project_id = p.id) as day_count,
           (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
           (SELECT COUNT(*) FROM screenplay_blocks sb JOIN scenes s ON s.id = sb.scene_id WHERE s.project_id = p.id) as block_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    ORDER BY p.updated_at DESC
  `, [])
  res.json({ data: projects, error: null })
})

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete('/users/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if ((req as any).user?.id === id) {
    return res.status(400).json({ data: null, error: 'Eigenen Account nicht löschbar' })
  }
  const user = await db.get('SELECT id, email FROM users WHERE id = ?', [id]) as any
  if (!user) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })

  await db.run('DELETE FROM users WHERE id = ?', [id])
  res.json({ data: { id, email: user.email }, error: null })
})

// ─── DELETE /api/admin/projects/:id ──────────────────────────────────────────
router.delete('/projects/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const project = await db.get('SELECT id, title FROM projects WHERE id = ?', [id]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  await db.run('DELETE FROM projects WHERE id = ?', [id])
  res.json({ data: { id, title: project.title }, error: null })
})

// ─── PUT /api/admin/users/:id/role ───────────────────────────────────────────
router.put('/users/:id/role', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { role } = req.body as { role: string }
  const valid = ['admin', 'user', 'producer', 'director', 'dept_head', 'read_only']
  if (!role || !valid.includes(role)) {
    return res.status(400).json({ data: null, error: 'Ungültige Rolle' })
  }
  await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id])
  res.json({ data: { id, role }, error: null })
})

// ─── POST /api/admin/users/:id/reset-password ────────────────────────────────
router.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { new_password } = req.body as { new_password: string }
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ data: null, error: 'Mindestens 6 Zeichen' })
  }
  const hash = await bcrypt.hash(new_password, 12)
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id])
  res.json({ data: { success: true }, error: null })
})

// ─── POST /api/admin/users ────────────────────────────────────────────────────
router.post('/users', async (req: Request, res: Response) => {
  const { email, name, password, role } = req.body as {
    email: string; name: string; password: string; role: string
  }
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ data: null, error: 'E-Mail und Passwort (min. 6 Zeichen) erforderlich' })
  }
  const exists = await db.get('SELECT id FROM users WHERE email = ?', [email])
  if (exists) return res.status(409).json({ data: null, error: 'E-Mail bereits vergeben' })

  const hash = await bcrypt.hash(password, 12)
  const valid = ['admin', 'user', 'producer', 'director', 'dept_head', 'read_only']
  const finalRole = valid.includes(role) ? role : 'user'
  const result = await db.run(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    [email, hash, name || '', finalRole]
  )

  const created = await db.get('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [result.id])
  res.status(201).json({ data: created, error: null })
})

export default router
