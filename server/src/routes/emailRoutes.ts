/**
 * Mailbetrieb: Vorlagen, Verteiler, Absender, Postausgang.
 *
 * Alles unter `/api/projects/:pid/...` ist durch `requireMember` und den
 * Schreibschutz aus `middleware/projectAuth` gedeckt - hier steht nur, was
 * darüber hinaus gilt: Wer an fremde Adressen schreiben darf, wie viele Mails
 * ein Projekt pro Stunde auslösen kann, und dass fremdes HTML gesäubert wird,
 * bevor es ein Postfach erreicht.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { getUserProjectRole, ROLE_RANK } from '../middleware/projectAuth'
import { sendEmail, isSmtpConfigured, appBaseUrl } from './emailService'
import {
  reiheEin,
  sendeFaellige,
  erneutVersuchen,
  quittiere,
  istAdresse,
  smtpEingerichtet,
} from '../lib/mailversand'
import {
  STANDARDVORLAGEN,
  PLATZHALTER,
  fuelleVorlage,
  platzhalterIn,
  textZuHtml,
  saeubereHtml,
  maskiere,
} from '../lib/mailvorlagen'

const router = Router()

/** Wie viele Mails ein Projekt in einer Stunde auslösen darf. */
const STUNDENGRENZE = 200

/** Ab dieser Rolle darf an Adressen geschrieben werden, die nicht im Projekt stehen. */
const FREMDE_ADRESSEN_AB = ROLE_RANK.producer

async function rolleImProjekt(req: Request, projectId: number): Promise<string | null> {
  const user = (req as any).user
  if (!user) return null
  if (user.role === 'admin') return 'admin'
  return getUserProjectRole(user.id, projectId)
}

/** Alle Adressen, die im Projekt hinterlegt sind - Stab, Besetzung, Komparsen, Mitglieder. */
async function bekannteAdressen(projectId: number): Promise<Set<string>> {
  const quellen = await Promise.all([
    db.all('SELECT email FROM crew WHERE project_id = ? AND email <> \'\'', [projectId]),
    db.all('SELECT email FROM "cast" WHERE project_id = ? AND email <> \'\'', [projectId]),
    db.all('SELECT email FROM extras WHERE project_id = ? AND email <> \'\'', [projectId]),
    db.all(
      `SELECT u.email FROM users u
         JOIN project_members m ON m.user_id = u.id
        WHERE m.project_id = ?`,
      [projectId]
    ),
    db.all('SELECT u.email FROM users u JOIN projects p ON p.owner_id = u.id WHERE p.id = ?', [projectId]),
    db.all('SELECT email FROM project_invites WHERE project_id = ?', [projectId]),
  ])
  const menge = new Set<string>()
  for (const zeilen of quellen) {
    for (const zeile of zeilen as any[]) {
      if (zeile?.email) menge.add(String(zeile.email).trim().toLowerCase())
    }
  }
  return menge
}

/** Wie viele Mails das Projekt in der letzten Stunde erzeugt hat. */
async function mailsLetzteStunde(projectId: number): Promise<number> {
  const zeile = (await db.get(
    "SELECT COUNT(*) AS c FROM email_outbox WHERE project_id = ? AND created_at > NOW() - INTERVAL '1 hour'",
    [projectId]
  )) as any
  return Number(zeile?.c ?? 0)
}

// ─── Status und Test ──────────────────────────────────────────────────────────

// GET /api/projects/:pid/email/status
router.get('/projects/:pid/email/status', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const [letzteStunde, offen] = await Promise.all([
    mailsLetzteStunde(projectId),
    db.get(
      "SELECT COUNT(*) AS c FROM email_outbox WHERE project_id = ? AND status = 'wartet'",
      [projectId]
    ) as Promise<any>,
  ])
  return res.json({
    data: {
      configured: isSmtpConfigured(),
      // Der Hostname bleibt im Haus: Er verrät, bei wem die Produktion ihre
      // Mail hat, und das geht niemanden ausserhalb etwas an.
      limit_pro_stunde: STUNDENGRENZE,
      verbraucht_letzte_stunde: letzteStunde,
      wartend: Number(offen?.c ?? 0),
      platzhalter: PLATZHALTER,
    },
    error: null,
  })
})

// POST /api/projects/:pid/email/test
router.post('/projects/:pid/email/test', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const user = (req as any).user
  if (!user?.email) {
    return res.status(400).json({ data: null, error: 'Für dein Konto ist keine E-Mail-Adresse hinterlegt' })
  }
  const ergebnis = await sendEmail({
    to: user.email,
    subject: 'CutSheet - Test',
    anlass: 'test',
    projectId,
    erstelltVon: user.id,
    html: `<p>Hallo ${maskiere(user.name || '')},</p>
           <p>diese Mail kommt aus deinem Projekt. Wenn sie da ist, stimmt die Einrichtung.</p>`,
  })
  return res.json({ data: ergebnis, error: null })
})

// ─── Versand ──────────────────────────────────────────────────────────────────

// POST /api/projects/:pid/email/send
router.post('/projects/:pid/email/send', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const user = (req as any).user
  const { subject, recipients, html, text, template_id, group_id, scheduled_for, mit_quittung } = req.body || {}

  if (!smtpEingerichtet()) {
    return res.status(400).json({
      data: { configured: false },
      error: 'Es ist kein Mailserver eingerichtet. Ohne SMTP-Zugang geht nichts raus.',
    })
  }

  // Empfänger: entweder frei übergeben oder aus einem Verteiler
  let liste: Array<{ email: string; name?: string; werte?: Record<string, string> }> = []
  if (group_id) {
    liste = await loeseGruppeAuf(projectId, Number(group_id))
  } else if (Array.isArray(recipients)) {
    liste = recipients.map((eintrag: any) =>
      typeof eintrag === 'string' ? { email: eintrag } : { email: eintrag.email, name: eintrag.name }
    )
  }
  liste = liste.filter((e) => istAdresse(e.email || ''))
  if (liste.length === 0) {
    return res.status(400).json({ data: null, error: 'Keine gültigen Empfänger' })
  }

  // Vorlage oder freier Text
  let betreff = String(subject || '')
  let rumpf = ''
  if (template_id) {
    const vorlage = (await db.get(
      'SELECT * FROM email_templates WHERE id = ? AND project_id = ?',
      [Number(template_id), projectId]
    )) as any
    if (!vorlage) return res.status(404).json({ data: null, error: 'Vorlage nicht gefunden' })
    betreff = betreff || vorlage.subject
    rumpf = vorlage.body
  } else if (typeof text === 'string' && text.trim()) {
    rumpf = text
  } else if (typeof html === 'string' && html.trim()) {
    rumpf = ''
  } else {
    return res.status(400).json({ data: null, error: 'Es fehlt der Text der Nachricht' })
  }
  if (!betreff.trim()) {
    return res.status(400).json({ data: null, error: 'Es fehlt der Betreff' })
  }

  // Wer darf an fremde Adressen schreiben?
  const rolle = await rolleImProjekt(req, projectId)
  const rang = ROLE_RANK[rolle || ''] ?? 0
  if (rang < FREMDE_ADRESSEN_AB) {
    const bekannt = await bekannteAdressen(projectId)
    const fremde = liste.filter((e) => !bekannt.has(e.email.trim().toLowerCase()))
    if (fremde.length > 0) {
      return res.status(403).json({
        data: { fremde: fremde.map((f) => f.email) },
        error:
          'An Adressen ausserhalb des Projekts dürfen nur Produktion und Admin schreiben. ' +
          'Trag die Person in den Stab oder die Besetzung ein, dann geht es.',
      })
    }
  }

  // Stundengrenze - ein Versehen in einer Schleife soll keine 5000 Mails lösen
  const verbraucht = await mailsLetzteStunde(projectId)
  if (verbraucht + liste.length > STUNDENGRENZE) {
    return res.status(429).json({
      data: { verbraucht, limit: STUNDENGRENZE },
      error: `Dieses Projekt hat in der letzten Stunde schon ${verbraucht} Mails ausgelöst. Grenze: ${STUNDENGRENZE}.`,
    })
  }

  const geplant = scheduled_for ? new Date(scheduled_for) : null
  if (geplant && Number.isNaN(geplant.getTime())) {
    return res.status(400).json({ data: null, error: 'Der Versandzeitpunkt ist kein gültiges Datum' })
  }

  const projekt = (await db.get('SELECT title FROM projects WHERE id = ?', [projectId])) as any
  const absender = (await db.get(
    'SELECT sender_name FROM email_identities WHERE project_id = ?',
    [projectId]
  )) as any

  const basisWerte: Record<string, string> = {
    projekt: projekt?.title || '',
    absender: absender?.sender_name || projekt?.title || '',
  }

  const eingereiht = await reiheEin({
    projectId,
    betreff: fuelleVorlage(betreff, basisWerte),
    anlass: template_id ? 'manuell' : 'manuell',
    geplantFuer: geplant,
    erstelltVon: user.id,
    mitQuittung: !!mit_quittung,
    empfaenger: liste,
    html: (person) => {
      const werte = {
        ...basisWerte,
        ...(person.werte || {}),
        name: person.name || '',
        vorname: (person.name || '').split(' ')[0] || '',
      }
      const koerper = rumpf
        ? textZuHtml(fuelleVorlage(rumpf, werte))
        : saeubereHtml(fuelleVorlage(String(html || ''), werte))
      const quittung = mit_quittung
        ? `<p style="margin:24px 0 0;"><a href="{{quittung_link}}" style="color:#0a84ff;">Empfang bestätigen</a></p>`
        : ''
      return `<div style="font-family:Arial,sans-serif;max-width:560px;color:#111;">${koerper}${quittung}</div>`
    },
  })

  if (geplant) {
    return res.json({
      data: { queued: eingereiht.length, sent: 0, scheduled_for: geplant.toISOString() },
      error: null,
    })
  }
  const lauf = await sendeFaellige(eingereiht.length + 5)
  return res.json({
    data: {
      sent: lauf.gesendet,
      queued: eingereiht.length - lauf.gesendet - lauf.ohneVersand,
      ohne_versand: lauf.ohneVersand,
      empfaenger: eingereiht.length,
    },
    error: null,
  })
})

// ─── Postausgang ──────────────────────────────────────────────────────────────

// GET /api/projects/:pid/email/outbox
router.get('/projects/:pid/email/outbox', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const status = String(req.query.status || '')
  const bedingungen = ['project_id = ?']
  const werte: any[] = [projectId]
  if (status && ['wartet', 'gesendet', 'fehlgeschlagen', 'ohne_versand'].includes(status)) {
    bedingungen.push('status = ?')
    werte.push(status)
  }
  const zeilen = await db.all(
    `SELECT id, subject, recipient_email, recipient_name, purpose, status, attempts,
            last_error, scheduled_for, sent_at, read_at, created_at,
            (attachment_id IS NOT NULL) AS hat_anhang
       FROM email_outbox
      WHERE ${bedingungen.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT 200`,
    werte
  )
  const zusammenfassung = await db.all(
    'SELECT status, COUNT(*) AS anzahl FROM email_outbox WHERE project_id = ? GROUP BY status',
    [projectId]
  )
  return res.json({ data: { mails: zeilen, nach_status: zusammenfassung }, error: null })
})

// POST /api/projects/:pid/email/outbox/:id/retry
router.post('/projects/:pid/email/outbox/:id/retry', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const ok = await erneutVersuchen(Number(req.params.id), projectId)
  if (!ok) {
    return res.status(400).json({ data: null, error: 'Diese Mail lässt sich nicht erneut senden' })
  }
  const lauf = await sendeFaellige(5)
  return res.json({ data: lauf, error: null })
})

// DELETE /api/projects/:pid/email/outbox/:id - geplante Mail zurückziehen
router.delete('/projects/:pid/email/outbox/:id', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const geloescht = await db.run(
    "DELETE FROM email_outbox WHERE id = ? AND project_id = ? AND status = 'wartet'",
    [Number(req.params.id), projectId]
  )
  if (geloescht.changes === 0) {
    return res.status(400).json({ data: null, error: 'Nur wartende Mails lassen sich zurückziehen' })
  }
  return res.json({ data: { zurueckgezogen: true }, error: null })
})

// ─── Vorlagen ─────────────────────────────────────────────────────────────────

// GET /api/projects/:pid/email/templates
router.get('/projects/:pid/email/templates', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  let zeilen = (await db.all(
    'SELECT * FROM email_templates WHERE project_id = ? ORDER BY name ASC',
    [projectId]
  )) as any[]
  // Beim ersten Aufruf die Standardvorlagen anlegen, damit niemand vor einem
  // leeren Kasten sitzt.
  if (zeilen.length === 0) {
    for (const vorlage of STANDARDVORLAGEN) {
      await db.run(
        'INSERT INTO email_templates (project_id, template_key, name, subject, body) VALUES (?, ?, ?, ?, ?)',
        [projectId, vorlage.schluessel, vorlage.name, vorlage.betreff, vorlage.text]
      )
    }
    zeilen = (await db.all(
      'SELECT * FROM email_templates WHERE project_id = ? ORDER BY name ASC',
      [projectId]
    )) as any[]
  }
  return res.json({
    data: zeilen.map((z) => ({ ...z, platzhalter: platzhalterIn(`${z.subject} ${z.body}`) })),
    error: null,
  })
})

// POST /api/projects/:pid/email/templates
router.post('/projects/:pid/email/templates', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const { name, subject, body, template_key } = req.body || {}
  if (!name || !String(name).trim()) {
    return res.status(400).json({ data: null, error: 'Die Vorlage braucht einen Namen' })
  }
  const zeile = await db.run(
    'INSERT INTO email_templates (project_id, template_key, name, subject, body) VALUES (?, ?, ?, ?, ?)',
    [projectId, String(template_key || ''), String(name), String(subject || ''), String(body || '')]
  )
  return res.json({ data: { id: zeile.id }, error: null })
})

// PUT /api/projects/:pid/email/templates/:id
router.put('/projects/:pid/email/templates/:id', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const { name, subject, body } = req.body || {}
  const zeile = await db.run(
    `UPDATE email_templates SET name = ?, subject = ?, body = ?, updated_at = NOW()
      WHERE id = ? AND project_id = ?`,
    [String(name || ''), String(subject || ''), String(body || ''), Number(req.params.id), projectId]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Vorlage nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

// DELETE /api/projects/:pid/email/templates/:id
router.delete('/projects/:pid/email/templates/:id', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const zeile = await db.run('DELETE FROM email_templates WHERE id = ? AND project_id = ?', [
    Number(req.params.id),
    projectId,
  ])
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Vorlage nicht gefunden' })
  return res.json({ data: { geloescht: true }, error: null })
})

// POST /api/projects/:pid/email/templates/:id/preview - Vorschau mit Beispielwerten
router.post('/projects/:pid/email/templates/:id/preview', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const vorlage = (await db.get('SELECT * FROM email_templates WHERE id = ? AND project_id = ?', [
    Number(req.params.id),
    projectId,
  ])) as any
  if (!vorlage) return res.status(404).json({ data: null, error: 'Vorlage nicht gefunden' })

  const projekt = (await db.get('SELECT title FROM projects WHERE id = ?', [projectId])) as any
  const beispiel: Record<string, string> = { projekt: projekt?.title || 'Projekt' }
  for (const platz of PLATZHALTER) {
    if (!beispiel[platz.schluessel]) beispiel[platz.schluessel] = platz.beispiel
  }
  const werte = { ...beispiel, ...(req.body?.werte || {}) }
  return res.json({
    data: {
      subject: fuelleVorlage(vorlage.subject, werte),
      html: textZuHtml(fuelleVorlage(vorlage.body, werte)),
      platzhalter: platzhalterIn(`${vorlage.subject} ${vorlage.body}`),
    },
    error: null,
  })
})

// ─── Verteiler ────────────────────────────────────────────────────────────────

/**
 * Löst einen Verteiler in Adressen auf. Regeln werden bei jedem Versand frisch
 * ausgewertet - wer heute zum Stab kommt, ist morgen im Verteiler, ohne dass
 * jemand die Liste pflegt.
 */
async function loeseGruppeAuf(
  projectId: number,
  gruppenId: number
): Promise<Array<{ email: string; name?: string; werte?: Record<string, string> }>> {
  const gruppe = (await db.get('SELECT * FROM email_groups WHERE id = ? AND project_id = ?', [
    gruppenId,
    projectId,
  ])) as any
  if (!gruppe) return []

  const alsListe = (zeilen: any[], namensfeld = 'name') =>
    zeilen
      .filter((z) => z?.email)
      .map((z) => ({ email: String(z.email), name: String(z[namensfeld] || ''), werte: { rolle: String(z.role || '') } }))

  switch (gruppe.rule) {
    case 'crew_alle':
      return alsListe(
        (await db.all("SELECT name, email, role FROM crew WHERE project_id = ? AND email <> ''", [projectId])) as any[]
      )
    case 'crew_abteilung':
      return alsListe(
        (await db.all(
          "SELECT name, email, role FROM crew WHERE project_id = ? AND email <> '' AND department = ?",
          [projectId, gruppe.parameter]
        )) as any[]
      )
    case 'cast_alle':
      return alsListe(
        (await db.all(
          'SELECT actor_name AS name, email FROM "cast" WHERE project_id = ? AND email <> \'\'',
          [projectId]
        )) as any[]
      )
    case 'komparsen':
      return alsListe(
        (await db.all("SELECT name, email FROM extras WHERE project_id = ? AND email <> ''", [projectId])) as any[]
      )
    case 'mitglieder':
      return alsListe(
        (await db.all(
          `SELECT u.name, u.email FROM users u JOIN project_members m ON m.user_id = u.id WHERE m.project_id = ?
           UNION
           SELECT u.name, u.email FROM users u JOIN projects p ON p.owner_id = u.id WHERE p.id = ?`,
          [projectId, projectId]
        )) as any[]
      )
    case 'drehtag': {
      const eintraege = (await db.all(
        `SELECT e.person_type, e.person_id, e.call_time
           FROM call_sheet_entries e
           JOIN call_sheets s ON e.call_sheet_id = s.id
          WHERE s.shoot_day_id = ?`,
        [Number(gruppe.parameter)]
      )) as any[]
      const personen: Array<{ email: string; name?: string; werte?: Record<string, string> }> = []
      const istBesetzung = 'cast'
      for (const eintrag of eintraege) {
        const person =
          eintrag.person_type === istBesetzung
            ? ((await db.get('SELECT actor_name AS name, email FROM "cast" WHERE id = ?', [eintrag.person_id])) as any)
            : ((await db.get('SELECT name, email, role FROM crew WHERE id = ?', [eintrag.person_id])) as any)
        if (person?.email) {
          const stunden = Math.floor((eintrag.call_time ?? 0) / 60)
          const minuten = (eintrag.call_time ?? 0) % 60
          personen.push({
            email: person.email,
            name: person.name,
            werte: {
              rolle: person.role || '',
              call: eintrag.call_time == null ? '' : `${String(stunden).padStart(2, '0')}:${String(minuten).padStart(2, '0')}`,
            },
          })
        }
      }
      return personen
    }
    default: {
      const mitglieder = (await db.all(
        'SELECT name, email FROM email_group_members WHERE group_id = ? AND project_id = ?',
        [gruppenId, projectId]
      )) as any[]
      return alsListe(mitglieder)
    }
  }
}

// GET /api/projects/:pid/email/groups
router.get('/projects/:pid/email/groups', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const gruppen = (await db.all('SELECT * FROM email_groups WHERE project_id = ? ORDER BY name ASC', [
    projectId,
  ])) as any[]
  const mitAnzahl = await Promise.all(
    gruppen.map(async (g) => ({ ...g, anzahl: (await loeseGruppeAuf(projectId, g.id)).length }))
  )
  return res.json({ data: mitAnzahl, error: null })
})

// POST /api/projects/:pid/email/groups
router.post('/projects/:pid/email/groups', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const { name, rule, parameter, members } = req.body || {}
  if (!name || !String(name).trim()) {
    return res.status(400).json({ data: null, error: 'Der Verteiler braucht einen Namen' })
  }
  const erlaubt = ['manuell', 'crew_alle', 'crew_abteilung', 'cast_alle', 'komparsen', 'mitglieder', 'drehtag']
  const regel = erlaubt.includes(String(rule)) ? String(rule) : 'manuell'
  const zeile = await db.run(
    'INSERT INTO email_groups (project_id, name, rule, parameter) VALUES (?, ?, ?, ?)',
    [projectId, String(name), regel, String(parameter ?? '')]
  )
  if (regel === 'manuell' && Array.isArray(members)) {
    for (const mitglied of members) {
      if (!istAdresse(mitglied?.email || '')) continue
      await db.run(
        'INSERT INTO email_group_members (group_id, project_id, kind, person_id, name, email) VALUES (?, ?, ?, ?, ?, ?)',
        [zeile.id, projectId, String(mitglied.kind || 'extern'), mitglied.person_id ?? null, String(mitglied.name || ''), String(mitglied.email)]
      )
    }
  }
  return res.json({ data: { id: zeile.id }, error: null })
})

// DELETE /api/projects/:pid/email/groups/:id
router.delete('/projects/:pid/email/groups/:id', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const zeile = await db.run('DELETE FROM email_groups WHERE id = ? AND project_id = ?', [
    Number(req.params.id),
    projectId,
  ])
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Verteiler nicht gefunden' })
  return res.json({ data: { geloescht: true }, error: null })
})

// GET /api/projects/:pid/email/groups/:id/recipients - Vorschau der Adressen
router.get('/projects/:pid/email/groups/:id/recipients', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const liste = await loeseGruppeAuf(projectId, Number(req.params.id))
  return res.json({ data: liste, error: null })
})

// ─── Absender und Signatur ────────────────────────────────────────────────────

// GET /api/projects/:pid/email/identity
router.get('/projects/:pid/email/identity', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const zeile = (await db.get('SELECT * FROM email_identities WHERE project_id = ?', [projectId])) as any
  const projekt = (await db.get('SELECT title FROM projects WHERE id = ?', [projectId])) as any
  return res.json({
    data:
      zeile || {
        project_id: projectId,
        sender_name: projekt?.title ? `Produktion ${projekt.title}` : '',
        reply_to: '',
        signature: '',
        logo_url: '',
        accent_color: '#0A84FF',
        footer_note: '',
      },
    error: null,
  })
})

// PUT /api/projects/:pid/email/identity
router.put('/projects/:pid/email/identity', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const { sender_name, reply_to, signature, logo_url, accent_color, footer_note } = req.body || {}
  if (reply_to && !istAdresse(String(reply_to))) {
    return res.status(400).json({ data: null, error: 'Die Antwortadresse ist keine gültige E-Mail-Adresse' })
  }
  await db.run(
    `INSERT INTO email_identities (project_id, sender_name, reply_to, signature, logo_url, accent_color, footer_note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
     ON CONFLICT (project_id) DO UPDATE SET
       sender_name = EXCLUDED.sender_name,
       reply_to = EXCLUDED.reply_to,
       signature = EXCLUDED.signature,
       logo_url = EXCLUDED.logo_url,
       accent_color = EXCLUDED.accent_color,
       footer_note = EXCLUDED.footer_note,
       updated_at = NOW()`,
    [
      projectId,
      String(sender_name || ''),
      String(reply_to || ''),
      String(signature || ''),
      String(logo_url || ''),
      String(accent_color || '#0A84FF'),
      String(footer_note || ''),
    ]
  )
  return res.json({ data: { gespeichert: true }, error: null })
})

// ─── Quittung ─────────────────────────────────────────────────────────────────

// GET /api/email/receipt/:token - öffentlich, bestätigt den Empfang
router.get('/email/receipt/:token', async (req: Request, res: Response) => {
  const treffer = await quittiere(String(req.params.token))
  if (!treffer) {
    return res.status(404).send('<p style="font-family:sans-serif">Dieser Link ist nicht gültig.</p>')
  }
  res.set('Content-Type', 'text/html; charset=utf-8')
  return res.send(`<!doctype html><html lang="de"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Empfang bestätigt</title></head>
    <body style="font-family:system-ui,sans-serif;background:#111113;color:#fafafa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
      <div style="text-align:center;max-width:420px;padding:24px;">
        <p style="font-size:20px;margin:0 0 8px;">Danke, Empfang bestätigt.</p>
        <p style="color:#9b9ba3;margin:0;">${maskiere(treffer.betreff)}</p>
        <p style="margin-top:28px;"><a href="${appBaseUrl()}" style="color:#0a84ff;">CutSheet</a></p>
      </div>
    </body></html>`)
})

export default router
