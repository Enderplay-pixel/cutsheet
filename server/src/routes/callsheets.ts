import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import { sendEmail, isSmtpConfigured, appBaseUrl } from './emailService'
import { reiheEin, sendeFaellige } from '../lib/mailversand'
import { sendPushToUser } from './push'

const router = Router()

/** Push an alle Projektmitglieder außer dem Auslöser. Fehler werden geschluckt. */
export async function notifyProjectMembers(projectId: number, actorUserId: number | null, payload: { title: string; body: string; url: string }) {
  try {
    const rows = await db.all(
      `SELECT user_id FROM project_members WHERE project_id = ?
       UNION SELECT owner_id as user_id FROM projects WHERE id = ? AND owner_id IS NOT NULL`,
      [projectId, projectId]
    ) as Array<{ user_id: number }>
    for (const r of rows) {
      if (r.user_id && r.user_id !== actorUserId) {
        sendPushToUser(r.user_id, payload).catch(() => null)
      }
    }
  } catch (err) {
    console.error('[notifyProjectMembers]', err)
  }
}

const fmtCallTime = (mins: number | null) =>
  mins == null ? '—' : `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} Uhr`

async function getCallSheet(id: number) {
  const sheet = await db.get('SELECT cs.*, l.name as location_name FROM call_sheets cs LEFT JOIN locations l ON cs.location_id = l.id WHERE cs.id = ?', [id]) as any
  if (!sheet) return null
  const entries = await db.all('SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC', [id]) as any[]

  // Enrich entries with person names
  const enriched = await Promise.all(entries.map(async (e: any) => {
    if (e.person_type === 'cast') {
      const person = await db.get('SELECT c.actor_name as name, ch.name as role FROM cast c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?', [e.person_id]) as any
      return { ...e, person_name: person?.name || '', role: person?.role || '' }
    } else {
      const person = await db.get('SELECT name, role FROM crew WHERE id = ?', [e.person_id]) as any
      return { ...e, person_name: person?.name || '', role: person?.role || '' }
    }
  }))

  return { ...sheet, entries: enriched }
}

// GET /api/shoot-days/:dayId/call-sheet
router.get('/shoot-days/:dayId/call-sheet', requireMemberVia(projectIdFromTable('shoot_days', 'dayId')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const day = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
    if (day && (await getUserProjectRole(user.id, day.project_id)) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const sheet = await db.get('SELECT * FROM call_sheets WHERE shoot_day_id = ?', [req.params.dayId]) as any
  if (!sheet) return res.json({ data: null, error: null })
  res.json({ data: await getCallSheet(sheet.id), error: null })
})

// POST /api/shoot-days/:dayId/call-sheet
router.post('/shoot-days/:dayId/call-sheet', async (req, res) => {
  // Look up project settings to get default call time
  const shootDay = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
  const settings = shootDay
    ? await db.get('SELECT default_call_time FROM project_settings WHERE project_id = ?', [shootDay.project_id]) as any
    : null
  const settingsCallTime = settings?.default_call_time ?? 480

  const {
    general_call = settingsCallTime,
    shooting_call = settingsCallTime + 30,
    location_id = null,
    weather_forecast = '',
    sunrise = '',
    sunset = '',
    notes = '',
    // Felder des Call Sheets im Branchenstandard
    hospital_name = '',
    hospital_address = '',
    crew_parking = '',
    basecamp = '',
    breakfast_call = 0,
    lunch_call = 0,
    weather_high = '',
    weather_low = '',
    walkie_channels = '',
    dept_notes = '',
  } = req.body

  const extraCols = [hospital_name, hospital_address, crew_parking, basecamp,
    breakfast_call, lunch_call, weather_high, weather_low, walkie_channels, dept_notes]

  const existing = await db.get('SELECT id FROM call_sheets WHERE shoot_day_id = ?', [req.params.dayId]) as any
  let sheetId: number

  if (existing) {
    // NOW() statt datetime("now"): Doppelte Anfuehrungszeichen sind in Postgres
    // ein Bezeichner, keine Zeichenkette - das UPDATE lief in einen Fehler und
    // jede Aenderung nach dem ersten Anlegen ging still verloren.
    await db.run(`
      UPDATE call_sheets SET
        general_call=?, shooting_call=?, location_id=?, weather_forecast=?, sunrise=?, sunset=?, notes=?,
        hospital_name=?, hospital_address=?, crew_parking=?, basecamp=?,
        breakfast_call=?, lunch_call=?, weather_high=?, weather_low=?, walkie_channels=?, dept_notes=?,
        updated_at=NOW()
      WHERE id=?
    `, [general_call, shooting_call, location_id, weather_forecast, sunrise, sunset, notes, ...extraCols, existing.id])
    sheetId = existing.id
  } else {
    const result = await db.run(`
      INSERT INTO call_sheets (
        shoot_day_id, general_call, shooting_call, location_id, weather_forecast, sunrise, sunset, notes,
        hospital_name, hospital_address, crew_parking, basecamp,
        breakfast_call, lunch_call, weather_high, weather_low, walkie_channels, dept_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.dayId, general_call, shooting_call, location_id, weather_forecast, sunrise, sunset, notes, ...extraCols])
    sheetId = result.id

    // Auto-populate entries from crew and cast
    if (shootDay) {
      const crew = await db.all('SELECT id FROM crew WHERE project_id = ?', [shootDay.project_id]) as any[]
      const cast = await db.all('SELECT id FROM cast WHERE project_id = ?', [shootDay.project_id]) as any[]

      for (const [i, c] of crew.entries()) {
        await db.run('INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order) VALUES (?, ?, ?, ?, ?)', [sheetId, 'crew', c.id, general_call, i])
      }
      for (const [i, c] of cast.entries()) {
        await db.run('INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order) VALUES (?, ?, ?, ?, ?)', [sheetId, 'cast', c.id, general_call, crew.length + i])
      }
    }
  }

  res.json({ data: await getCallSheet(sheetId), error: null })
})

// PUT /api/call-sheets/:id/entries
router.put('/call-sheets/:id/entries', async (req, res) => {
  const { entries } = req.body // array of entry objects
  await db.transaction(async (tx) => {
    for (const e of entries as any[]) {
      await tx.run('UPDATE call_sheet_entries SET call_time=?, pickup_location=?, notes=? WHERE id=?', [e.call_time, e.pickup_location || '', e.notes || '', e.id])
    }
  })
  res.json({ data: await getCallSheet(parseInt(req.params.id)), error: null })
})

// POST /api/call-sheets/:id/entries/add  - add a person not yet on the sheet
router.post('/call-sheets/:id/entries/add', async (req, res) => {
  const { person_type, person_id, call_time = 480 } = req.body
  const sheet = await db.get('SELECT id FROM call_sheets WHERE id = ?', [req.params.id]) as any
  if (!sheet) return res.status(404).json({ data: null, error: 'Call Sheet nicht gefunden' })

  // Check not already on sheet
  const existing = await db.get('SELECT id FROM call_sheet_entries WHERE call_sheet_id = ? AND person_type = ? AND person_id = ?', [req.params.id, person_type, person_id])
  if (existing) return res.status(409).json({ data: null, error: 'Person bereits im Call Sheet' })

  const maxOrderRow = await db.get('SELECT COALESCE(MAX(sort_order), -1) as m FROM call_sheet_entries WHERE call_sheet_id = ?', [req.params.id]) as any
  await db.run('INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order) VALUES (?, ?, ?, ?, ?)', [req.params.id, person_type, person_id, call_time, maxOrderRow.m + 1])
  res.status(201).json({ data: await getCallSheet(parseInt(req.params.id)), error: null })
})

// DELETE /api/call-sheets/:id/entries/:entryId
router.delete('/call-sheets/:id/entries/:entryId', async (req, res) => {
  await db.run('DELETE FROM call_sheet_entries WHERE id = ? AND call_sheet_id = ?', [req.params.entryId, req.params.id])
  res.json({ data: await getCallSheet(parseInt(req.params.id)), error: null })
})

// POST /api/call-sheets/:id/shift-times
router.post('/call-sheets/:id/shift-times', async (req, res) => {
  const { minutes = 0 } = req.body
  await db.run('UPDATE call_sheet_entries SET call_time = call_time + ? WHERE call_sheet_id = ?', [minutes, req.params.id])
  await db.run('UPDATE call_sheets SET general_call = general_call + ?, shooting_call = shooting_call + ?, updated_at = NOW() WHERE id = ?', [minutes, minutes, req.params.id])

  // Crew sofort informieren - verschobene Drehbeginne sind die wichtigste Set-Info
  const ctx = await db.get(
    'SELECT sd.project_id, sd.day_number, sd.id as day_id FROM call_sheets cs JOIN shoot_days sd ON cs.shoot_day_id = sd.id WHERE cs.id = ?',
    [req.params.id]
  ) as any
  if (ctx && minutes !== 0) {
    const dir = minutes > 0 ? 'nach hinten' : 'nach vorne'
    notifyProjectMembers(ctx.project_id, (req as any).user?.id ?? null, {
      title: `Drehtag ${ctx.day_number}: Zeiten verschoben`,
      body: `Alle Call Times wurden um ${Math.abs(minutes)} Minuten ${dir} verschoben.`,
      url: `/projects/${ctx.project_id}/tagesdispo/${ctx.day_id}`,
    })
  }
  res.json({ data: await getCallSheet(parseInt(req.params.id)), error: null })
})

// POST /api/shoot-days/:dayId/call-sheet/send - Dispo per E-Mail an alle Beteiligten.
// Personalisierte Mail mit Call Time, Public-Link und PDF-Anhang. Der Versand
// laeuft ueber den Postausgang: Was hier zurueckkommt, ist gemessen und nicht
// geraten. Mit `scheduled_for` im Rumpf geht die Dispo erst spaeter raus -
// der Vorabend-Versand um 20 Uhr ist der haeufigste Fall.
router.post('/shoot-days/:dayId/call-sheet/send', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const day = await db.get(
    'SELECT sd.*, p.title as project_title, p.id as project_id FROM shoot_days sd JOIN projects p ON sd.project_id = p.id WHERE sd.id = ?',
    [req.params.dayId]
  ) as any
  if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
  if (user.role !== 'admin' && await getUserProjectRole(user.id, day.project_id) === null) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const smtpConfigured = isSmtpConfigured()
  if (!smtpConfigured) {
    return res.status(400).json({
      data: { smtp_configured: false },
      error: 'Es ist kein Mailserver eingerichtet. Ohne SMTP-Zugang geht nichts raus - die Dispo laesst sich aber als PDF herunterladen und ueber den Link teilen.',
    })
  }

  const sheet = await db.get('SELECT * FROM call_sheets WHERE shoot_day_id = ?', [req.params.dayId]) as any
  if (!sheet) return res.status(404).json({ data: null, error: 'Keine Dispo für diesen Drehtag angelegt' })

  const location = sheet.location_id
    ? await db.get('SELECT name, address, city FROM locations WHERE id = ?', [sheet.location_id]) as any
    : null

  // PDF einmal bauen (lazy import vermeidet Zirkularität beim Modul-Load)
  const { buildTagesdispoHtml, generatePdf } = require('./pdf')
  const built = await buildTagesdispoHtml(req.params.dayId)
  if (!built) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generatePdf(built.html)
  } catch (err: any) {
    console.error('[callsheet/send] PDF-Generierung fehlgeschlagen, sende ohne Anhang:', err.message)
  }

  const entries = await db.all(
    'SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC',
    [sheet.id]
  ) as any[]

  // Empfänger auflösen + fehlende Tokens erzeugen
  const recipients: Array<{ entry: any; name: string; email: string; token: string }> = []
  const skipped: string[] = []
  for (const entry of entries) {
    const person = entry.person_type === 'cast'
      ? await db.get('SELECT c.actor_name as name, c.email FROM "cast" c WHERE c.id = ?', [entry.person_id]) as any
      : await db.get('SELECT name, email FROM crew WHERE id = ?', [entry.person_id]) as any
    const name = person?.name || 'Unbekannt'
    if (!person?.email) { skipped.push(name); continue }

    let token = entry.public_token
    if (!token) {
      token = crypto.randomBytes(20).toString('hex')
      await db.run('UPDATE call_sheet_entries SET public_token = ? WHERE id = ?', [token, entry.id])
    }
    recipients.push({ entry, name, email: person.email, token })
  }

  const base = appBaseUrl()
  const dateStr = day.date ? new Date(day.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

  // Geplanter Versand: ein Zeitpunkt im Rumpf schiebt die Mails in die
  // Warteschlange, statt sie sofort rauszuschicken.
  const geplant = req.body?.scheduled_for ? new Date(req.body.scheduled_for) : null
  if (geplant && Number.isNaN(geplant.getTime())) {
    return res.status(400).json({ data: null, error: 'Der Versandzeitpunkt ist kein gueltiges Datum' })
  }

  const eingereiht = await reiheEin({
    projectId: day.project_id,
    betreff: `Tagesdispo Drehtag ${day.day_number} - ${day.project_title}`,
    anlass: 'dispo',
    bezugId: Number(req.params.dayId),
    geplantFuer: geplant,
    erstelltVon: user.id,
    anhang: pdfBuffer ? { dateiname: `tagesdispo-tag${day.day_number}.pdf`, inhalt: pdfBuffer } : null,
    empfaenger: recipients.map(r => ({ email: r.email, name: r.name, werte: { token: r.token } })),
    html: (person) => {
      const r = recipients.find(x => x.email === person.email)!
      return `
          <div style="font-family:Arial,sans-serif;max-width:520px;">
            <h2 style="color:#111;margin-bottom:4px;">Drehtag ${day.day_number} - ${day.project_title}</h2>
            <p style="color:#6b7280;margin-top:0;">${dateStr}</p>
            <p>Hallo ${r.name},</p>
            <p>hier ist deine Tagesdisposition:</p>
            <table style="border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Deine Call Time:</td>
                  <td style="padding:4px 0;font-weight:bold;font-size:18px;">${fmtCallTime(r.entry.call_time)}</td></tr>
              ${location ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Motiv:</td>
                  <td style="padding:4px 0;">${location.name}${location.address ? `, ${location.address}` : ''}${location.city ? `, ${location.city}` : ''}</td></tr>` : ''}
              ${r.entry.notes ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Hinweis:</td>
                  <td style="padding:4px 0;">${r.entry.notes}</td></tr>` : ''}
            </table>
            <p style="margin:24px 0;">
              <a href="${base}/dispo/${r.token}" style="background:#0a84ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Online ansehen und bestaetigen</a>
            </p>
            <p style="color:#6b7280;font-size:13px;">Die vollstaendige Dispo findest du im PDF-Anhang.</p>
          </div>`
    },
  })

  for (const r of recipients) {
    if (eingereiht.some(e => e.email === r.email)) {
      await db.run('UPDATE call_sheet_entries SET sent_at = NOW() WHERE id = ?', [r.entry.id])
    }
  }

  // Sofort-Versand gleich anstossen, damit die Antwort den wahren Stand kennt
  const lauf = geplant ? { gesendet: 0, fehlgeschlagen: 0, ohneVersand: 0 } : await sendeFaellige(eingereiht.length + 5)
  const sent = lauf.gesendet
  const failed = recipients
    .filter(r => !eingereiht.some(e => e.email === r.email))
    .map(r => r.name)

  // In-App-Push an alle Projektmitglieder
  notifyProjectMembers(day.project_id, user.id, {
    title: `Neue Tagesdispo: Drehtag ${day.day_number}`,
    body: `Die Dispo für ${dateStr} wurde versendet.`,
    url: `/projects/${day.project_id}/tagesdispo/${day.id}`,
  })

  return res.json({
    data: {
      sent,
      queued: eingereiht.length - sent,
      failed,
      skipped_no_email: skipped,
      smtp_configured: true,
      scheduled_for: geplant ? geplant.toISOString() : null,
    },
    error: null,
  })
})

export default router
