import { Router, Request, Response } from 'express'
import { hashPasswort, pruefePasswort } from '../lib/passwort'
import { db } from '../db'
import { signToken, AuthUser } from '../middleware/auth'

const router = Router()

// 1x1 transparent PNG
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

// Alle Public-Endpoints laufen über zufällige 160-Bit-Tokens statt
// enumerierbarer numerischer IDs (Sicherheit: Dispo-Links gehen per E-Mail raus).

interface EntryRow {
  id: number
  call_sheet_id: number
  person_type: string
  person_id: number
  call_time: number | null
  notes: string
  confirmed_at: string | null
  viewed_at: string | null
}

async function getEntryByToken(token: string): Promise<EntryRow | undefined> {
  if (!token || token.length < 16) return undefined
  return await db.get('SELECT * FROM call_sheet_entries WHERE public_token = ?', [token]) as EntryRow | undefined
}

async function getPersonForEntry(entry: EntryRow): Promise<{ name: string; role: string; email: string } | undefined> {
  if (entry.person_type === 'cast') {
    const p = await db.get(
      'SELECT c.actor_name as name, ch.name as role, c.email FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?',
      [entry.person_id]
    ) as any
    return p ? { name: p.name || '', role: p.role || '', email: p.email || '' } : undefined
  }
  const p = await db.get('SELECT name, role, email FROM crew WHERE id = ?', [entry.person_id]) as any
  return p ? { name: p.name || '', role: p.role || '', email: p.email || '' } : undefined
}

// GET /api/cse/t/:token - öffentliche Dispo-Daten für die Empfänger-Ansicht
// Bewusst OHNE Gagen und Telefonnummern.
router.get('/cse/t/:token', async (req: Request, res: Response) => {
  const entry = await getEntryByToken(req.params.token)
  if (!entry) return res.status(404).json({ data: null, error: 'Link ungültig' })

  const sheet = await db.get('SELECT * FROM call_sheets WHERE id = ?', [entry.call_sheet_id]) as any
  if (!sheet) return res.status(404).json({ data: null, error: 'Dispo nicht gefunden' })
  const day = await db.get('SELECT * FROM shoot_days WHERE id = ?', [sheet.shoot_day_id]) as any
  const project = await db.get('SELECT id, title, format, genre FROM projects WHERE id = ?', [day?.project_id]) as any
  const location = sheet.location_id
    ? await db.get('SELECT name, address, city, zip FROM locations WHERE id = ?', [sheet.location_id]) as any
    : null

  const person = await getPersonForEntry(entry)

  // Tagesplan: alle Einträge mit Namen + Call Times (keine Kontaktdaten)
  const allEntries = await db.all(
    'SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC',
    [entry.call_sheet_id]
  ) as EntryRow[]
  const schedule = await Promise.all(allEntries.map(async e => {
    const p = await getPersonForEntry(e)
    return { name: p?.name || '', role: p?.role || '', call_time: e.call_time, is_me: e.id === entry.id }
  }))

  const hasAccount = person?.email
    ? !!(await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [person.email.toLowerCase()]))
    : false

  return res.json({
    data: {
      project: { id: project?.id, title: project?.title || '', format: project?.format || '', genre: project?.genre || '' },
      day: { day_number: day?.day_number, date: day?.date, notes: day?.notes || '' },
      sheet: {
        general_call: sheet.general_call,
        shooting_call: sheet.shooting_call,
        weather_forecast: sheet.weather_forecast || '',
        sunrise: sheet.sunrise || '',
        sunset: sheet.sunset || '',
        notes: sheet.notes || '',
      },
      location,
      me: {
        name: person?.name || '',
        role: person?.role || '',
        call_time: entry.call_time,
        notes: entry.notes || '',
        confirmed_at: entry.confirmed_at,
        email: person?.email || '',
      },
      schedule,
      has_account: hasAccount,
    },
    error: null,
  })
})

// POST /api/cse/t/:token/confirm - Zusage bestätigen (öffentlich)
router.post('/cse/t/:token/confirm', async (req: Request, res: Response) => {
  const entry = await getEntryByToken(req.params.token)
  if (!entry) return res.status(404).json({ data: null, error: 'Link ungültig' })

  await db.run('UPDATE call_sheet_entries SET confirmed_at = NOW() WHERE id = ?', [entry.id])
  return res.json({ data: { confirmed: true }, error: null })
})

// GET /api/cse/t/:token/track.png - E-Mail-Tracking-Pixel (setzt viewed_at einmalig)
router.get('/cse/t/:token/track.png', async (req: Request, res: Response) => {
  const entry = await getEntryByToken(req.params.token)
  if (entry && !entry.viewed_at) {
    await db.run('UPDATE call_sheet_entries SET viewed_at = NOW() WHERE id = ?', [entry.id])
  }
  res.set('Content-Type', 'image/png')
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  return res.send(TRACKING_PIXEL)
})

// POST /api/cse/t/:token/claim - One-Click-Account für Crew-Mitglieder.
// E-Mail kommt aus dem Cast/Crew-Eintrag (nicht frei wählbar), Rolle: read_only.
router.post('/cse/t/:token/claim', async (req: Request, res: Response) => {
  try {
    const entry = await getEntryByToken(req.params.token)
    if (!entry) return res.status(404).json({ data: null, error: 'Link ungültig' })

    const { password, name } = req.body as { password?: string; name?: string }
    if (!password || password.length < 6) {
      return res.status(400).json({ data: null, error: 'Passwort muss mindestens 6 Zeichen haben' })
    }

    const person = await getPersonForEntry(entry)
    const email = (person?.email || '').trim().toLowerCase()
    if (!email) {
      return res.status(400).json({ data: null, error: 'Für diesen Eintrag ist keine E-Mail-Adresse hinterlegt' })
    }

    const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [email])
    if (existing) {
      return res.status(409).json({ data: null, error: 'Es existiert bereits ein Konto mit dieser E-Mail. Bitte melde dich an.' })
    }

    const sheet = await db.get('SELECT shoot_day_id FROM call_sheets WHERE id = ?', [entry.call_sheet_id]) as any
    const day = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [sheet?.shoot_day_id]) as any
    if (!day?.project_id) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

    const password_hash = await hashPasswort(password, 12)
    const userName = (name || person?.name || '').trim()
    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, password_hash, userName, 'user']
    )
    await db.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
      [day.project_id, result.id, 'read_only']
    )

    const authUser: AuthUser = { id: result.id, email, name: userName, role: 'user' }
    const token = signToken(authUser)
    return res.status(201).json({ data: { token, user: authUser, project_id: day.project_id }, error: null })
  } catch (err) {
    console.error('[cse/claim]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
