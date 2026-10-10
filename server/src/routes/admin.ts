import { Router, Request, Response } from 'express'
import { hashPasswort, pruefePasswort } from '../lib/passwort'
import { db, seedDemoData } from '../db'
import { seedGrossproduktion } from '../db/grossproduktion'
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
/**
 * Betriebsuebersicht: ein Blick auf alles, was im laufenden Betrieb schiefgehen
 * kann.
 *
 * Nicht noch eine Zahlenwand, sondern Warnungen: Was ist auffaellig, und was
 * waere zu tun. Keine Auffaelligkeit heisst, dass nichts zu tun ist.
 */
/**
 * Welche Bereiche werden wirklich benutzt?
 *
 * Gezaehlt wird, in wie vielen Projekten ein Bereich ueberhaupt Daten hat -
 * das ist messbar. Vorher standen hier erfundene Prozentzahlen mit dem
 * Zusatz "Beispieldaten"; eine Zahl, die niemand nachrechnen kann, gehoert
 * nicht in eine Betriebsuebersicht.
 */
router.get('/nutzung', async (_req: Request, res: Response) => {
  const gesamt = Number(((await db.get('SELECT COUNT(*) AS c FROM projects')) as any)?.c ?? 0)

  const bereiche: Array<{ name: string; tabelle: string }> = [
    { name: 'Drehbuch',        tabelle: 'scenes' },
    { name: 'Stab',            tabelle: 'crew' },
    { name: 'Besetzung',       tabelle: 'cast' },
    { name: 'Motive',          tabelle: 'locations' },
    { name: 'Drehplan',        tabelle: 'shoot_days' },
    { name: 'Shotlist',        tabelle: 'shots' },
    { name: 'Budget',          tabelle: 'budget_lines' },
    { name: 'Equipment',       tabelle: 'equipment_items' },
    { name: 'Tagesberichte',   tabelle: 'daily_reports' },
    { name: 'Arbeitszeiten',   tabelle: 'timesheets' },
    { name: 'Kameraberichte',  tabelle: 'camera_reports' },
    { name: 'Aufgaben',        tabelle: 'project_tasks' },
  ]

  const zeilen: Array<{ name: string; projekte: number; anteil: number }> = []
  for (const bereich of bereiche) {
    const tabelle = bereich.tabelle === 'cast' ? '"cast"' : bereich.tabelle
    // daily_reports haengt am Drehtag, nicht direkt am Projekt
    const abfrage = bereich.tabelle === 'daily_reports'
      ? `SELECT COUNT(DISTINCT d.project_id) AS c FROM daily_reports r JOIN shoot_days d ON d.id = r.shoot_day_id`
      : `SELECT COUNT(DISTINCT project_id) AS c FROM ${tabelle}`
    try {
      const treffer = Number(((await db.get(abfrage)) as any)?.c ?? 0)
      zeilen.push({
        name: bereich.name,
        projekte: treffer,
        anteil: gesamt > 0 ? Math.round((treffer / gesamt) * 100) : 0,
      })
    } catch {
      // Eine Tabelle, die es (noch) nicht gibt, faellt still weg - lieber
      // eine Zeile weniger als eine erfundene.
    }
  }
  zeilen.sort((a, b) => b.projekte - a.projekte)

  return res.json({ data: { projekte_gesamt: gesamt, bereiche: zeilen }, error: null })
})

router.get('/betrieb', async (_req: Request, res: Response) => {
  const warnungen: Array<{ stufe: 'hoch' | 'mittel' | 'niedrig'; text: string; rat: string }> = []

  // Mailserver
  const mailserver = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  if (!mailserver) {
    warnungen.push({
      stufe: 'mittel',
      text: 'Es ist kein Mailserver eingerichtet.',
      rat: 'SMTP_HOST, SMTP_USER und SMTP_PASS setzen - sonst geht keine Dispo raus.',
    })
  }

  // Postausgang
  const postausgang = await db.all(
    'SELECT status, COUNT(*) AS anzahl FROM email_outbox GROUP BY status'
  ) as any[]
  const nachStatus = Object.fromEntries(postausgang.map(z => [z.status, Number(z.anzahl)]))
  if ((nachStatus.fehlgeschlagen ?? 0) > 0) {
    warnungen.push({
      stufe: 'hoch',
      text: nachStatus.fehlgeschlagen === 1
        ? 'Eine Mail ist endgueltig gescheitert.'
        : `${nachStatus.fehlgeschlagen} Mails sind endgueltig gescheitert.`,
      rat: 'Im E-Mail-Bereich des Projekts nachsehen und erneut senden.',
    })
  }
  const alteWartende = await db.get(
    "SELECT COUNT(*) AS c FROM email_outbox WHERE status = 'wartet' AND created_at < NOW() - INTERVAL '1 hour' AND (scheduled_for IS NULL OR scheduled_for < NOW())"
  ) as any
  if (Number(alteWartende?.c ?? 0) > 0) {
    warnungen.push({
      stufe: 'hoch',
      text: Number(alteWartende.c) === 1
        ? 'Eine Mail wartet laenger als eine Stunde.'
        : `${alteWartende.c} Mails warten laenger als eine Stunde.`,
      rat: 'Der Versand kommt nicht durch - Zugangsdaten des Mailservers pruefen.',
    })
  }

  // Sicherungen: wann wurde zuletzt eine gezogen?
  const letzteSicherung = await db.get(
    "SELECT MAX(created_at) AS zeitpunkt FROM audit_log WHERE action = 'backup_export'"
  ) as any
  if (!letzteSicherung?.zeitpunkt) {
    warnungen.push({
      stufe: 'mittel',
      text: 'Es ist keine Sicherung verzeichnet.',
      rat: 'In einem Projekt unter Sicherung einmal exportieren und die Datei ablegen.',
    })
  }

  // Papierkorb: was bald endgueltig verschwindet
  const baldWeg = await db.get(
    "SELECT COUNT(*) AS c FROM deleted_items WHERE restored_at IS NULL AND deleted_at < NOW() - INTERVAL '23 days'"
  ) as any
  if (Number(baldWeg?.c ?? 0) > 0) {
    warnungen.push({
      stufe: 'niedrig',
      text: Number(baldWeg.c) === 1
        ? 'Ein Eintrag im Papierkorb verschwindet in den naechsten Tagen endgueltig.'
        : `${baldWeg.c} Eintraege im Papierkorb verschwinden in den naechsten Tagen endgueltig.`,
      rat: 'Zurueckholen, was noch gebraucht wird.',
    })
  }

  // Konten ohne zweiten Faktor, die viel duerfen
  const ohneFaktor = await db.get(`
    SELECT COUNT(*) AS c FROM users u
     WHERE u.role = 'admin'
       AND NOT EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = u.id AND t.confirmed_at IS NOT NULL)
  `) as any
  if (Number(ohneFaktor?.c ?? 0) > 0) {
    warnungen.push({
      stufe: 'mittel',
      text: Number(ohneFaktor.c) === 1
        ? 'Ein Konto mit vollen Rechten hat keinen zweiten Faktor.'
        : `${ohneFaktor.c} Konten mit vollen Rechten haben keinen zweiten Faktor.`,
      rat: 'In den Einstellungen unter "Zweiter Faktor und Geraete" einrichten.',
    })
  }

  // Datenbank
  const beginn = Date.now()
  let datenbankMs = -1
  try {
    await db.get('SELECT 1')
    datenbankMs = Date.now() - beginn
  } catch { /* bleibt -1 */ }
  if (datenbankMs < 0) {
    warnungen.push({
      stufe: 'hoch',
      text: 'Die Datenbank antwortet nicht.',
      rat: 'Ohne sie laeuft nichts. Zustand beim Hoster pruefen.',
    })
  } else if (datenbankMs > 500) {
    warnungen.push({
      stufe: 'mittel',
      text: `Die Datenbank braucht ${datenbankMs} ms fuer eine einfache Abfrage.`,
      rat: 'Das ist langsam. Bei einem geteilten Plan kann das am Nachbarn liegen.',
    })
  }

  const speicher = process.memoryUsage()

  return res.json({
    data: {
      warnungen,
      alles_in_ordnung: warnungen.length === 0,
      mailserver,
      postausgang: nachStatus,
      letzte_sicherung: letzteSicherung?.zeitpunkt ?? null,
      datenbank_ms: datenbankMs,
      laufzeit_sekunden: Math.round(process.uptime()),
      speicher_mb: Math.round(speicher.rss / 1024 / 1024),
      node: process.version,
    },
    error: null,
  })
})

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
  const hash = await hashPasswort(new_password, 12)
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

  const hash = await hashPasswort(password, 12)
  const valid = ['admin', 'user', 'producer', 'director', 'dept_head', 'read_only']
  const finalRole = valid.includes(role) ? role : 'user'
  const result = await db.run(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    [email, hash, name || '', finalRole]
  )

  const created = await db.get('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [result.id])
  res.status(201).json({ data: created, error: null })
})

// ─── POST /api/admin/reseed ───────────────────────────────────────────────────
// Deletes the "Sprachlos" demo project and re-seeds all demo data fresh.
router.post('/reseed', async (_req: Request, res: Response) => {
  // Das globale Demo-Projekt heisst "Sprachlos (Demo)" und hat keinen Besitzer.
  // Die alte Abfrage suchte "Sprachlos" und fand es nie — jeder Reseed legte
  // ein weiteres Demo-Projekt daneben.
  const existing = await db.all(
    "SELECT id FROM projects WHERE is_demo = TRUE AND owner_id IS NULL AND title IN ('Sprachlos', 'Sprachlos (Demo)')"
  ) as any[]
  for (const p of existing) await db.run('DELETE FROM projects WHERE id = ?', [p.id])
  await seedDemoData()
  res.json({ data: { ok: true }, error: null })
})

// ─── POST /api/admin/grossproduktion ─────────────────────────────────────────
// Legt die Großproduktion "Nordlicht" für den anfragenden Admin an (ersetzt
// eine vorhandene). Antwort enthält die Zahlen und einmalig die Passwörter
// neu angelegter Teamkonten.
router.post('/grossproduktion', async (req: Request, res: Response) => {
  const ergebnis = await seedGrossproduktion((req as any).user.id)
  res.status(201).json({ data: ergebnis, error: null })
})

export default router
