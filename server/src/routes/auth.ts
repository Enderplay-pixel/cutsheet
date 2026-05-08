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

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
      return res.status(409).json({ data: null, error: 'E-Mail bereits registriert' })
    }

    // Every user is admin of their own projects — global role is always 'admin'
    const role = 'admin'

    const password_hash = await bcrypt.hash(password, 12)
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
    ).run(email, password_hash, name || '', role)

    const authUser: AuthUser = { id: result.lastInsertRowid, email, name: name || '', role }
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

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined
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
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name || '', req.user.id)
    const updated = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.user.id) as Omit<UserRow, 'password_hash' | 'created_at'>
    return res.json({ data: updated, error: null })
  } catch (err) {
    console.error('[auth/me PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /users (admin only)
router.get('/users', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC').all()
  return res.json({ data: users, error: null })
})

// PUT /users/:id/role (admin only)
router.put('/users/:id/role', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { role } = req.body as { role?: string }
    const validRoles = ['admin', 'producer', 'director', 'dept_head', 'read_only']
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ data: null, error: 'Ungültige Rolle' })
    }
    const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })
    return res.json({ data: { id, role }, error: null })
  } catch (err) {
    console.error('[auth/users/:id/role]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /users/:id (admin only)
router.delete('/users/:id', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    if (req.user && req.user.id === id) {
      return res.status(400).json({ data: null, error: 'Eigenen Account kann man nicht löschen' })
    }
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[auth/users/:id DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
