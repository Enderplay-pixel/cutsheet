import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../db'
import { signToken, requireAuth, requireRole, AuthUser } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

const RegisterSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben'),
  name: z.string().optional(),
})

const LoginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort erforderlich'),
})

interface UserRow {
  id: number
  email: string
  password_hash: string
  name: string
  role: string
  created_at: string
}

// POST /register
router.post('/register', validate(RegisterSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body as z.infer<typeof RegisterSchema>

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email])
    if (existing) {
      return res.status(409).json({ data: null, error: 'E-Mail bereits registriert' })
    }

    // First registered user becomes site admin; everyone else is a regular user.
    // Per-project roles are managed separately via project_members.
    const userCount = Number(((await db.get('SELECT COUNT(*) as c FROM users', [])) as any)?.c ?? 0)
    const role = userCount === 0 ? 'admin' : 'user'

    const password_hash = await bcrypt.hash(password, 12)
    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, password_hash, name || '', role]
    )

    const authUser: AuthUser = { id: result.id, email, name: name || '', role }
    const token = signToken(authUser)
    return res.status(201).json({ data: { token, user: authUser }, error: null })
  } catch (err) {
    console.error('[auth/register]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /login
router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as z.infer<typeof LoginSchema>

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]) as UserRow | undefined
    if (!user) {
      return res.status(401).json({ data: null, error: 'Ungültige Anmeldedaten' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ data: null, error: 'Ungültige Anmeldedaten' })
    }

    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role }
    const token = signToken(authUser)
    return res.json({ data: { token, user: authUser }, error: null })
  } catch (err) {
    console.error('[auth/login]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.json({ data: req.user, error: null })
})

// PUT /me
router.put('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string }
    if (!req.user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
    await db.run('UPDATE users SET name = ? WHERE id = ?', [name || '', req.user.id])
    const updated = await db.get('SELECT id, email, name, role FROM users WHERE id = ?', [req.user.id]) as Omit<UserRow, 'password_hash' | 'created_at'>
    return res.json({ data: updated, error: null })
  } catch (err) {
    console.error('[auth/me PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /me/password
router.put('/me/password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body as { current_password?: string; new_password?: string }
    if (!current_password || !new_password) {
      return res.status(400).json({ data: null, error: 'Felder fehlen' })
    }
    if (new_password.length < 6) {
      return res.status(400).json({ data: null, error: 'Passwort muss mindestens 6 Zeichen haben' })
    }
    if (!req.user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]) as UserRow | undefined
    if (!user) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })
    const valid = await bcrypt.compare(current_password, user.password_hash)
    if (!valid) return res.status(400).json({ data: null, error: 'Aktuelles Passwort falsch' })
    const hash = await bcrypt.hash(new_password, 12)
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id])
    return res.json({ data: { success: true }, error: null })
  } catch (err) {
    console.error('[auth/me/password]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /users (admin only)
router.get('/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const users = await db.all('SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC', [])
  return res.json({ data: users, error: null })
})

// PUT /users/:id/role (admin only)
router.put('/users/:id/role', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { role } = req.body as { role?: string }
    const validRoles = ['admin', 'producer', 'director', 'dept_head', 'read_only']
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ data: null, error: 'Ungültige Rolle' })
    }
    const result = await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id])
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })
    return res.json({ data: { id, role }, error: null })
  } catch (err) {
    console.error('[auth/users/:id/role]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /users/:id (admin only)
router.delete('/users/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (req.user && req.user.id === id) {
      return res.status(400).json({ data: null, error: 'Eigenen Account kann man nicht löschen' })
    }
    const result = await db.run('DELETE FROM users WHERE id = ?', [id])
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[auth/users/:id DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
