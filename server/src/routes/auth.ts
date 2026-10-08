import { Router, Request, Response } from 'express'
import { hashPasswort, pruefePasswort } from '../lib/passwort'
import crypto from 'crypto'
import { z } from 'zod'
import { db, seedDemoData } from '../db'
import {
  signToken, requireAuth, requireRole, AuthUser,
  starteSitzung, beendeSitzung, beendeAlleSitzungen,
} from '../middleware/auth'
import {
  erzeugeSchluessel, otpauthUrl, pruefeCode,
  erzeugeWiederherstellungscodes, normalisiereCode,
} from '../lib/zweiterFaktor'
import { validate } from '../middleware/validate'
import { sendEmail, isSmtpConfigured, appBaseUrl } from './emailService'

const router = Router()

const RegisterSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben'),
  name: z.string().optional(),
})

const LoginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort erforderlich'),
  // Zweiter Faktor: Code aus der App oder ein Wiederherstellungscode. Muss
  // hier stehen - `validate` ersetzt den Rumpf durch das geparste Objekt,
  // und was nicht im Schema steht, faellt weg.
  code: z.string().max(32).optional(),
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

    const password_hash = await hashPasswort(password, 12)
    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, password_hash, name || '', role]
    )

    // Persönliches Demo-Projekt, damit der erste Eindruck nie eine leere App ist.
    // Fire-and-forget: ~100 INSERTs würden die Registrierung um Sekunden verzögern.
    seedDemoData(result.id).catch(err => console.error('[auth/register] Demo-Seed fehlgeschlagen', err))

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

    const valid = await pruefePasswort(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ data: null, error: 'Ungültige Anmeldedaten' })
    }

    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role }

    // Zweiter Faktor, falls eingerichtet und bestaetigt.
    const faktor = await db.get(
      'SELECT secret, confirmed_at, recovery_codes FROM user_totp WHERE user_id = ? AND confirmed_at IS NOT NULL',
      [user.id]
    ) as any
    if (faktor) {
      const eingabe = String((req.body as any)?.code || '').trim()
      if (!eingabe) {
        await protokolliereAnmeldung(req, user.id, email, 'zweiter_faktor_noetig')
        return res.status(401).json({
          data: { zweiter_faktor: true },
          error: 'Bitte den Code aus deiner Authenticator-App eingeben',
        })
      }
      let erkannt = pruefeCode(faktor.secret, eingabe)
      if (!erkannt) {
        // Wiederherstellungscode? Er gilt genau einmal.
        const codes: string[] = JSON.parse(faktor.recovery_codes || '[]')
        const gesucht = normalisiereCode(eingabe)
        const index = codes.findIndex(c => normalisiereCode(c) === gesucht)
        if (index >= 0) {
          codes.splice(index, 1)
          await db.run('UPDATE user_totp SET recovery_codes = ? WHERE user_id = ?', [JSON.stringify(codes), user.id])
          erkannt = true
        }
      }
      if (!erkannt) {
        await protokolliereAnmeldung(req, user.id, email, 'code_falsch')
        return res.status(401).json({ data: { zweiter_faktor: true }, error: 'Der Code stimmt nicht' })
      }
    }

    const { token } = await starteSitzung(authUser, {
      device: String(req.headers['user-agent'] || ''),
      ip: String(req.headers['x-forwarded-for'] || req.ip || ''),
    })
    await protokolliereAnmeldung(req, user.id, email, 'ok')
    return res.json({ data: { token, user: authUser }, error: null })
  } catch (err) {
    console.error('[auth/login]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

/** Haelt fest, wer sich wann angemeldet hat - und was schiefging. */
async function protokolliereAnmeldung(req: Request, userId: number | null, email: string, ergebnis: string) {
  try {
    await db.run(
      'INSERT INTO login_events (user_id, email, result, ip, device) VALUES (?, ?, ?, ?, ?)',
      [
        userId,
        String(email || '').slice(0, 200),
        ergebnis,
        String(req.headers['x-forwarded-for'] || req.ip || '').slice(0, 60),
        String(req.headers['user-agent'] || '').slice(0, 200),
      ]
    )
  } catch {
    // Das Protokoll darf keine Anmeldung verhindern.
  }
}

// ─── Zweiter Faktor ───────────────────────────────────────────────────────────

// POST /api/auth/2fa/setup - Schluessel erzeugen, noch nicht scharf
router.post('/2fa/setup', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!
  const vorhanden = await db.get('SELECT confirmed_at FROM user_totp WHERE user_id = ?', [user.id]) as any
  if (vorhanden?.confirmed_at) {
    return res.status(400).json({ data: null, error: 'Der zweite Faktor ist bereits eingerichtet' })
  }
  const schluessel = erzeugeSchluessel()
  await db.run(
    // RETURNING ausdruecklich: db.run haengt sonst "RETURNING id" an, und
    // user_totp hat keine Spalte id - der Schluessel ist user_id.
    `INSERT INTO user_totp (user_id, secret, confirmed_at, recovery_codes) VALUES (?, ?, NULL, '[]')
     ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, confirmed_at = NULL, recovery_codes = '[]'
     RETURNING user_id`,
    [user.id, schluessel]
  )
  return res.json({
    data: { schluessel, url: otpauthUrl(schluessel, user.email) },
    error: null,
  })
})

// POST /api/auth/2fa/confirm - mit einem Code scharf schalten
router.post('/2fa/confirm', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!
  const zeile = await db.get('SELECT secret FROM user_totp WHERE user_id = ?', [user.id]) as any
  if (!zeile) return res.status(400).json({ data: null, error: 'Richte den zweiten Faktor zuerst ein' })
  if (!pruefeCode(zeile.secret, String((req.body as any)?.code || ''))) {
    return res.status(400).json({ data: null, error: 'Der Code stimmt nicht. Geht die Uhr des Geraets richtig?' })
  }
  const codes = erzeugeWiederherstellungscodes()
  await db.run(
    'UPDATE user_totp SET confirmed_at = NOW(), recovery_codes = ? WHERE user_id = ?',
    [JSON.stringify(codes), user.id]
  )
  return res.json({
    data: {
      aktiv: true,
      wiederherstellungscodes: codes,
      hinweis: 'Diese Codes jetzt notieren. Jeder gilt einmal und ersetzt die App, wenn das Geraet weg ist.',
    },
    error: null,
  })
})

// DELETE /api/auth/2fa - abschalten, nur mit Passwort
router.delete('/2fa', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!
  const konto = await db.get('SELECT password_hash FROM users WHERE id = ?', [user.id]) as any
  const passwort = String((req.body as any)?.password || '')
  if (!konto || !(await pruefePasswort(passwort, konto.password_hash))) {
    return res.status(401).json({ data: null, error: 'Das Passwort stimmt nicht' })
  }
  await db.run('DELETE FROM user_totp WHERE user_id = ?', [user.id])
  return res.json({ data: { aktiv: false }, error: null })
})

// GET /api/auth/2fa - Stand
router.get('/2fa', requireAuth, async (req: Request, res: Response) => {
  const zeile = await db.get(
    'SELECT confirmed_at, recovery_codes FROM user_totp WHERE user_id = ?',
    [req.user!.id]
  ) as any
  return res.json({
    data: {
      aktiv: !!zeile?.confirmed_at,
      eingerichtet: !!zeile,
      codes_uebrig: zeile ? JSON.parse(zeile.recovery_codes || '[]').length : 0,
    },
    error: null,
  })
})

// ─── Sitzungen ────────────────────────────────────────────────────────────────

// GET /api/auth/sessions - angemeldete Geraete
router.get('/sessions', requireAuth, async (req: Request, res: Response) => {
  const zeilen = await db.all(
    `SELECT id, device, ip, created_at, last_seen
       FROM user_sessions
      WHERE user_id = ? AND revoked_at IS NULL
      ORDER BY last_seen DESC`,
    [req.user!.id]
  ) as any[]
  const eigene = req.user!.sid
  return res.json({
    data: zeilen.map(z => ({ ...z, diese: z.id === eigene })),
    error: null,
  })
})

// DELETE /api/auth/sessions/:sid - ein Geraet abmelden
router.delete('/sessions/:sid', requireAuth, async (req: Request, res: Response) => {
  const ok = await beendeSitzung(String(req.params.sid), req.user!.id)
  if (!ok) return res.status(404).json({ data: null, error: 'Diese Anmeldung gibt es nicht mehr' })
  return res.json({ data: { beendet: true }, error: null })
})

// POST /api/auth/sessions/revoke-others - alle anderen abmelden
router.post('/sessions/revoke-others', requireAuth, async (req: Request, res: Response) => {
  const anzahl = await beendeAlleSitzungen(req.user!.id, req.user!.sid)
  return res.json({ data: { beendet: anzahl }, error: null })
})

// GET /api/auth/login-events - Anmeldeverlauf des eigenen Kontos
router.get('/login-events', requireAuth, async (req: Request, res: Response) => {
  const zeilen = await db.all(
    `SELECT result, ip, device, created_at FROM login_events
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [req.user!.id]
  )
  return res.json({ data: zeilen, error: null })
})

// POST /forgot-password - antwortet immer 200, verrät nie ob die E-Mail existiert
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const email = String((req.body as { email?: string })?.email || '').trim().toLowerCase()
    const emailConfigured = isSmtpConfigured()
    if (!email) return res.status(400).json({ data: null, error: 'E-Mail erforderlich' })

    const user = await db.get('SELECT id, name FROM users WHERE LOWER(email) = ?', [email]) as { id: number; name: string } | undefined
    if (user) {
      const active = await db.get(
        'SELECT COUNT(*) as c FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()',
        [user.id]
      ) as { c: number }
      if (Number(active?.c ?? 0) < 3) {
        const token = crypto.randomBytes(32).toString('hex')
        await db.run(
          `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, NOW() + INTERVAL '60 minutes')`,
          [user.id, token]
        )
        const link = `${appBaseUrl()}/reset-password/${token}`
        await sendEmail({
          to: email,
          subject: 'CutSheet - Passwort zurücksetzen',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;">
              <h2 style="color:#111;">Passwort zurücksetzen</h2>
              <p>Hallo${user.name ? ' ' + user.name : ''},</p>
              <p>du hast angefordert, dein CutSheet-Passwort zurückzusetzen. Der Link ist 60 Minuten gültig:</p>
              <p style="margin:24px 0;">
                <a href="${link}" style="background:#b45309;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Neues Passwort festlegen</a>
              </p>
              <p style="color:#6b7280;font-size:13px;">Falls du das nicht warst, kannst du diese E-Mail ignorieren.</p>
            </div>`,
        })
      }
    }
    return res.json({ data: { ok: true, emailConfigured }, error: null })
  } catch (err) {
    console.error('[auth/forgot-password]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string }
    if (!token || !password) return res.status(400).json({ data: null, error: 'Felder fehlen' })
    if (password.length < 6) return res.status(400).json({ data: null, error: 'Passwort muss mindestens 6 Zeichen haben' })

    const row = await db.get(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used_at IS NULL AND expires_at > NOW()',
      [token]
    ) as { id: number; user_id: number } | undefined
    if (!row) return res.status(400).json({ data: null, error: 'Link ungültig oder abgelaufen. Bitte fordere einen neuen an.' })

    const hash = await hashPasswort(password, 12)
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id])
    await db.run('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [row.id])
    return res.json({ data: { success: true }, error: null })
  } catch (err) {
    console.error('[auth/reset-password]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.json({ data: req.user, error: null })
})

// GET /me/export - DSGVO Art. 20: alle personenbezogenen Daten als JSON-Download
router.get('/me/export', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
    const uid = req.user.id
    const user = await db.get('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [uid])
    const memberships = await db.all(
      `SELECT pm.project_id, pm.role, p.title FROM project_members pm
       JOIN projects p ON p.id = pm.project_id WHERE pm.user_id = ?`, [uid])
    const ownedProjects = await db.all(
      'SELECT id, title, status, created_at, is_demo FROM projects WHERE owner_id = ?', [uid])
    const feedbackRows = await db.all(
      'SELECT category, message, page_path, created_at FROM feedback WHERE user_id = ?', [uid])
    const pushSubs = await db.all(
      'SELECT endpoint, created_at FROM push_subscriptions WHERE user_id = ?', [uid]).catch(() => [])

    res.setHeader('Content-Disposition', 'attachment; filename="cutsheet-datenexport.json"')
    res.setHeader('Content-Type', 'application/json')
    return res.json({
      exported_at: new Date().toISOString(),
      hinweis: 'Vollständige Projektdaten können pro Projekt über die Backup-Funktion exportiert werden.',
      user,
      project_memberships: memberships,
      owned_projects: ownedProjects,
      feedback: feedbackRows,
      push_subscriptions: pushSubs,
    })
  } catch (err) {
    console.error('[auth/me/export]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /me - DSGVO Art. 17: Konto löschen (blockt, wenn Projekte mit weiteren Mitgliedern existieren)
router.delete('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
    const { password } = req.body as { password?: string }
    if (!password) return res.status(400).json({ data: null, error: 'Passwort erforderlich' })

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]) as UserRow | undefined
    if (!user) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })
    const valid = await pruefePasswort(password, user.password_hash)
    if (!valid) return res.status(400).json({ data: null, error: 'Passwort falsch' })

    // Eigene Projekte mit weiteren Mitgliedern blockieren die Löschung -
    // explizite Übergabe statt stillem Datenverlust für das Team.
    const blocking = await db.all(
      `SELECT p.id, p.title FROM projects p
       WHERE p.owner_id = ?
         AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id != ?)`,
      [user.id, user.id]
    ) as Array<{ id: number; title: string }>
    if (blocking.length > 0) {
      return res.status(409).json({
        data: { blocking_projects: blocking },
        error: 'Du besitzt Projekte mit weiteren Mitgliedern. Bitte übertrage oder lösche diese Projekte zuerst.',
      })
    }

    // Solo-Projekte des Users löschen, dann den Account (project_members etc. kaskadieren)
    await db.run('DELETE FROM projects WHERE owner_id = ?', [user.id])
    await db.run('DELETE FROM push_subscriptions WHERE user_id = ?', [user.id]).catch(() => null)
    await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id])
    await db.run('DELETE FROM users WHERE id = ?', [user.id])
    return res.json({ data: { success: true }, error: null })
  } catch (err) {
    console.error('[auth/me DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
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
    const valid = await pruefePasswort(current_password, user.password_hash)
    if (!valid) return res.status(400).json({ data: null, error: 'Aktuelles Passwort falsch' })
    const hash = await hashPasswort(new_password, 12)
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
