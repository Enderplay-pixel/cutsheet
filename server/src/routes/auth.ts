import { Router, Request, Response } from 'express'
import { hashPasswort, pruefePasswort } from '../lib/passwort'
import crypto from 'crypto'
import { z } from 'zod'
import { db, seedDemoData } from '../db'
import {
  requireAuth, requireRole, AuthUser,
  starteSitzung, beendeSitzung, beendeAlleSitzungen, vergissKonto,
} from '../middleware/auth'
import {
  erzeugeSchluessel, otpauthUrl, pruefeCode,
  erzeugeWiederherstellungscodes, legeCodeAb, codePasst,
} from '../lib/zweiterFaktor'
import { validate } from '../middleware/validate'
import { sendEmail, isSmtpConfigured, appBaseUrl } from './emailService'
import { maskiere } from '../lib/mailvorlagen'

const router = Router()

// Adressen kleingeschrieben und ohne Leerraum: Ein Postfach ist ein Konto.
// Gemessen am 24.10.2026: Wer sich als "Max@..." registrierte - Telefone
// schreiben den ersten Buchstaben gern gross -, kam mit "max@..." nicht
// hinein, und dieselbe Adresse liess sich kleingeschrieben ein zweites Mal
// registrieren.
const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben'),
  name: z.string().optional(),
})

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort erforderlich'),
  // Zweiter Faktor: Code aus der App oder ein Wiederherstellungscode. Muss
  // hier stehen - `validate` ersetzt den Rumpf durch das geparste Objekt,
  // und was nicht im Schema steht, faellt weg.
  code: z.string().max(32).optional(),
})

/** Ablageform eines Rücksetz-Tokens - in der Datenbank steht nur sie. */
function tokenAblage(token: string): string {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex')
}

/**
 * Die Adresse eines Geräts für Sitzung und Anmeldeverlauf.
 *
 * `req.ip`, nicht der Kopf `X-Forwarded-For`: Den setzt der Client selbst,
 * und im eigenen Anmeldeverlauf stand dann, was der Anmeldende hineinschrieb.
 * Hinter dem Hoster liest Express die echte Adresse (`trust proxy`).
 */
function adresse(req: Request): string {
  return String(req.ip || '')
}

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
  const { email, password, name } = req.body as z.infer<typeof RegisterSchema>

  // LOWER auf der Spalte: Konten aus der Zeit davor stehen teils gross geschrieben.
  const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [email])
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

  // Auch die erste Anmeldung ist eine Sitzung. Vorher signToken allein:
  // Gemessen am 24.10.2026 überstand dieses Token "alle anderen abmelden"
  // und das Zurücksetzen des Passworts - 30 Tage lang.
  const authUser: AuthUser = { id: result.id, email, name: name || '', role }
  const { token } = await starteSitzung(authUser, {
    device: String(req.headers['user-agent'] || ''),
    ip: adresse(req),
  })
  return res.status(201).json({ data: { token, user: authUser }, error: null })
})

// POST /login
router.post('/login', validate(LoginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as z.infer<typeof LoginSchema>

  // Aus der Zeit, als Gross- und Kleinschreibung zählte, kann es zu einer
  // Adresse zwei Konten geben. Dann entscheidet das Passwort, welches gemeint
  // ist - sonst wäre eines davon nicht mehr erreichbar.
  const kandidaten = await db.all(
    'SELECT * FROM users WHERE LOWER(email) = ? ORDER BY id ASC', [email]
  ) as UserRow[]
  let user: UserRow | undefined
  for (const k of kandidaten) {
    if (await pruefePasswort(password, k.password_hash)) { user = k; break }
  }
  if (!user) {
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
      // Wiederherstellungscode? Er gilt genau einmal. Gespeichert ist nur
      // seine Ablageform (siehe db/index.ts).
      const codes: string[] = JSON.parse(faktor.recovery_codes || '[]')
      let index = -1
      for (let i = 0; i < codes.length && index < 0; i++) {
        if (await codePasst(eingabe, codes[i])) index = i
      }
      if (index >= 0) {
        codes.splice(index, 1)
        // Nur, wenn die Liste noch dieselbe ist: Zwei gleichzeitige
        // Anmeldungen mit demselben Code dürfen nicht beide durchkommen.
        const zeile = await db.run(
          'UPDATE user_totp SET recovery_codes = ? WHERE user_id = ? AND recovery_codes = ?',
          [JSON.stringify(codes), user.id, faktor.recovery_codes]
        )
        erkannt = zeile.changes > 0
      }
    }
    if (!erkannt) {
      await protokolliereAnmeldung(req, user.id, email, 'code_falsch')
      return res.status(401).json({ data: { zweiter_faktor: true }, error: 'Der Code stimmt nicht' })
    }
  }

  const { token } = await starteSitzung(authUser, {
    device: String(req.headers['user-agent'] || ''),
    ip: adresse(req),
  })
  await protokolliereAnmeldung(req, user.id, email, 'ok')
  return res.json({ data: { token, user: authUser }, error: null })
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
        adresse(req).slice(0, 60),
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
    return res.status(400).json({ data: null, error: 'Der Code stimmt nicht. Geht die Uhr des Geräts richtig?' })
  }
  const codes = erzeugeWiederherstellungscodes()
  const abgelegt = await Promise.all(codes.map(legeCodeAb))
  await db.run(
    'UPDATE user_totp SET confirmed_at = NOW(), recovery_codes = ? WHERE user_id = ?',
    [JSON.stringify(abgelegt), user.id]
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
        `INSERT INTO password_reset_tokens (user_id, token, token_gehasht, expires_at)
         VALUES (?, ?, true, NOW() + INTERVAL '60 minutes')`,
        [user.id, tokenAblage(token)]
      )
      const link = `${appBaseUrl()}/reset-password/${token}`
      await sendEmail({
        to: email,
        subject: 'CutSheet - Passwort zurücksetzen',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;">
            <h2 style="color:#111;">Passwort zurücksetzen</h2>
            <p>Hallo${user.name ? ' ' + maskiere(user.name) : ''},</p>
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
})

// POST /reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string }
  if (!token || !password) return res.status(400).json({ data: null, error: 'Felder fehlen' })
  if (password.length < 6) return res.status(400).json({ data: null, error: 'Passwort muss mindestens 6 Zeichen haben' })

  const row = await db.get(
    `SELECT * FROM password_reset_tokens
      WHERE token = ? AND token_gehasht AND used_at IS NULL AND expires_at > NOW()`,
    [tokenAblage(String(token))]
  ) as { id: number; user_id: number } | undefined
  if (!row) return res.status(400).json({ data: null, error: 'Link ungültig oder abgelaufen. Bitte fordere einen neuen an.' })

  const hash = await hashPasswort(password, 12)
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id])
  // Alle offenen Links des Kontos verfallen, nicht nur dieser.
  await db.run('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [row.user_id])
  // Wer zurücksetzt, tut es oft, weil jemand anderes drin ist. Gemessen am
  // 24.10.2026: Alle Anmeldungen galten danach weiter.
  await beendeAlleSitzungen(row.user_id)
  return res.json({ data: { success: true }, error: null })
})

// GET /me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.json({ data: req.user, error: null })
})

// GET /me/export - DSGVO Art. 20: alle personenbezogenen Daten als JSON-Download
router.get('/me/export', requireAuth, async (req: Request, res: Response) => {
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
  // Auch, was über das Konto mitgeschrieben wird - mit IP und Gerät sind
  // das personenbezogene Daten. Gemessen am 24.10.2026 fehlten sie im Export.
  const anmeldungen = await db.all(
    'SELECT result, ip, device, created_at FROM login_events WHERE user_id = ? ORDER BY created_at DESC', [uid])
  const sitzungen = await db.all(
    'SELECT device, ip, created_at, last_seen, revoked_at FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC', [uid])
  const firmen = await db.all(
    `SELECT c.name, cm.role, cm.created_at FROM company_members cm
     JOIN companies c ON c.id = cm.company_id WHERE cm.user_id = ?`, [uid])
  const faktor = await db.get('SELECT confirmed_at, created_at FROM user_totp WHERE user_id = ?', [uid]) as any

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
    company_memberships: firmen,
    login_events: anmeldungen,
    sessions: sitzungen,
    // Der Schlüssel selbst bleibt drinnen: Mit ihm ließe sich der Code erzeugen.
    two_factor: faktor ? { eingerichtet_am: faktor.created_at, aktiv_seit: faktor.confirmed_at } : null,
  })
})

// DELETE /me - DSGVO Art. 17: Konto löschen (blockt, wenn Projekte mit weiteren Mitgliedern existieren)
router.delete('/me', requireAuth, async (req: Request, res: Response) => {
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
  vergissKonto(user.id)
  return res.json({ data: { success: true }, error: null })
})

// PUT /me
router.put('/me', requireAuth, async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string }
  if (!req.user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  await db.run('UPDATE users SET name = ? WHERE id = ?', [name || '', req.user.id])
  const updated = await db.get('SELECT id, email, name, role FROM users WHERE id = ?', [req.user.id]) as Omit<UserRow, 'password_hash' | 'created_at'>
  return res.json({ data: updated, error: null })
})

// PUT /me/password
router.put('/me/password', requireAuth, async (req: Request, res: Response) => {
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
  // Die anderen Geräte melden sich neu an, dieses bleibt angemeldet.
  await beendeAlleSitzungen(req.user.id, req.user.sid)
  return res.json({ data: { success: true }, error: null })
})

// GET /users (admin only)
router.get('/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const users = await db.all('SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC', [])
  return res.json({ data: users, error: null })
})

// PUT /users/:id/role (admin only)
router.put('/users/:id/role', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  const { role } = req.body as { role?: string }
  const validRoles = ['admin', 'producer', 'director', 'dept_head', 'read_only']
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ data: null, error: 'Ungültige Rolle' })
  }
  const result = await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id])
  if (result.changes === 0) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })
  vergissKonto(id)
  return res.json({ data: { id, role }, error: null })
})

// DELETE /users/:id (admin only)
router.delete('/users/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  if (req.user && req.user.id === id) {
    return res.status(400).json({ data: null, error: 'Eigenen Account kann man nicht löschen' })
  }
  const result = await db.run('DELETE FROM users WHERE id = ?', [id])
  if (result.changes === 0) return res.status(404).json({ data: null, error: 'Benutzer nicht gefunden' })
  vergissKonto(id)
  return res.json({ data: { id }, error: null })
})

export default router
