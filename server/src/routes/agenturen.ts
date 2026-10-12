/**
 * Agenturen und Besetzungsanfragen.
 *
 * Eine Besetzung entsteht selten dadurch, dass man Darsteller einzeln anruft.
 * Man schreibt Agenturen an - mit den Rollen, dem Zeitraum und der Gage - und
 * bekommt Vorschläge zurück. Diese Runde bildet genau das ab.
 *
 * Der Weg ist derselbe wie bei Dispos und Verträgen: Entwurf, Versand über
 * die Mailwarteschlange, Antwort über einen Link ohne Konto. Eine Agentur
 * legt sich kein Benutzerkonto an, um auf eine Anfrage zu antworten.
 *
 * Der Anfragetext wird beim Versand eingefroren. Wer später die Gage ändert,
 * ändert nicht rückwirkend das, worauf geantwortet wurde.
 */
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { erfordereFirma } from './companies'
import { logAudit } from './audit'
import { reiheEin } from '../lib/mailversand'
import { euro } from '../lib/rechnung'

const router = Router()

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function appBasisUrl(): string {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
}

function datumText(wert: string | null | undefined): string {
  if (!wert) return ''
  const d = new Date(`${String(wert).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return String(wert)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Agenturen ───────────────────────────────────────────────────────────────

router.get('/companies/:companyId/agenturen', requireAuth, erfordereFirma('mitarbeiter'), async (req: Request, res: Response) => {
  const zeilen = await db.all(
    `SELECT a.*,
            (SELECT COUNT(*) FROM casting_requests r
              JOIN projects p ON r.project_id = p.id
             WHERE r.agency_id = a.id AND p.company_id = a.company_id) AS anfragen
       FROM agencies a
      WHERE a.company_id = ? AND a.archived = false
      ORDER BY a.name ASC`,
    [Number(req.params.companyId)]
  )
  return res.json({ data: zeilen, error: null })
})

router.post('/companies/:companyId/agenturen', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ data: null, error: 'Die Agentur braucht einen Namen' })
  const zeile = await db.run(
    `INSERT INTO agencies (company_id, name, contact_name, email, phone, address, city, website, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(req.params.companyId), name,
      String(req.body?.contact_name || ''), String(req.body?.email || ''),
      String(req.body?.phone || ''), String(req.body?.address || ''),
      String(req.body?.city || ''), String(req.body?.website || ''),
      String(req.body?.notes || ''),
    ]
  )
  return res.json({ data: await db.get('SELECT * FROM agencies WHERE id = ?', [zeile.id]), error: null })
})

/**
 * Eine Agentur ändern - nur die mitgeschickten Felder.
 *
 * Feldweise von Anfang an: Ein PUT, das fehlende Felder leert, hat in dieser
 * Anwendung schon einmal Daten gelöscht (siehe `routes/invoices.ts`).
 */
router.put('/companies/:companyId/agenturen/:id', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const felder: string[] = []
  const werte: any[] = []
  const setze = (spalte: string, wert: any) => { felder.push(`${spalte} = ?`); werte.push(String(wert ?? '')) }

  if ('name' in req.body) {
    if (!String(req.body.name).trim()) {
      return res.status(400).json({ data: null, error: 'Die Agentur braucht einen Namen' })
    }
    setze('name', String(req.body.name).trim())
  }
  for (const feld of ['contact_name', 'email', 'phone', 'address', 'city', 'website', 'notes']) {
    if (feld in req.body) setze(feld, req.body[feld])
  }
  if ('archived' in req.body) { felder.push('archived = ?'); werte.push(req.body.archived === true) }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  const zeile = await db.run(
    `UPDATE agencies SET ${felder.join(', ')} WHERE id = ? AND company_id = ?`,
    [...werte, Number(req.params.id), Number(req.params.companyId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Agentur nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

// ─── Besetzungsanfragen ──────────────────────────────────────────────────────

async function ladeAnfrage(projectId: number, id: number) {
  const kopf = (await db.get(
    `SELECT r.*, a.name AS agentur, a.email AS agentur_email, a.contact_name AS agentur_kontakt,
            p.title AS projekt
       FROM casting_requests r
       LEFT JOIN agencies a ON r.agency_id = a.id
       JOIN projects p ON r.project_id = p.id
      WHERE r.id = ? AND r.project_id = ?`,
    [id, projectId]
  )) as any
  if (!kopf) return null
  const [rollen, vorschlaege] = await Promise.all([
    db.all(
      `SELECT rr.*, c.name AS figur
         FROM casting_request_roles rr
         LEFT JOIN characters c ON rr.character_id = c.id
        WHERE rr.request_id = ? ORDER BY rr.sort_order ASC`,
      [id]
    ) as Promise<any[]>,
    db.all('SELECT * FROM casting_proposals WHERE request_id = ? ORDER BY id ASC', [id]) as Promise<any[]>,
  ])
  return { ...kopf, rollen, vorschlaege }
}

router.get('/projects/:projectId/casting-anfragen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const heute = heuteISO()
  const zeilen = (await db.all(
    `SELECT r.*, a.name AS agentur, a.email AS agentur_email,
            (SELECT COUNT(*) FROM casting_request_roles rr WHERE rr.request_id = r.id) AS rollen,
            (SELECT COUNT(*) FROM casting_proposals cp WHERE cp.request_id = r.id) AS vorschlaege
       FROM casting_requests r
       LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.project_id = ?
      ORDER BY r.created_at DESC`,
    [projectId]
  )) as any[]

  return res.json({
    data: zeilen.map((z) => ({
      ...z,
      // Eine Anfrage ohne Antwort nach der Frist ist nicht "offen", sondern
      // überfällig - und das ist der Unterschied, der zum Nachfassen führt.
      ueberfaellig: z.status === 'versendet' && z.deadline
        ? String(z.deadline).slice(0, 10) < heute
        : false,
    })),
    error: null,
  })
})

router.get('/projects/:projectId/casting-anfragen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const anfrage = await ladeAnfrage(Number(req.params.projectId), Number(req.params.id))
  if (!anfrage) return res.status(404).json({ data: null, error: 'Anfrage nicht gefunden' })
  return res.json({ data: anfrage, error: null })
})

router.post('/projects/:projectId/casting-anfragen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const zeile = await db.run(
    `INSERT INTO casting_requests (project_id, agency_id, subject, body, deadline, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      req.body?.agency_id ? Number(req.body.agency_id) : null,
      String(req.body?.subject || '').slice(0, 200),
      String(req.body?.body || ''),
      req.body?.deadline ? String(req.body.deadline).slice(0, 10) : null,
      (req as any).user?.id ?? null,
    ]
  )
  return res.json({ data: await ladeAnfrage(projectId, zeile.id), error: null })
})

router.put('/projects/:projectId/casting-anfragen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const anfrage = (await db.get(
    'SELECT status FROM casting_requests WHERE id = ? AND project_id = ?', [id, projectId]
  )) as any
  if (!anfrage) return res.status(404).json({ data: null, error: 'Anfrage nicht gefunden' })
  if (anfrage.status !== 'entwurf') {
    return res.status(400).json({
      data: null,
      error: 'Eine verschickte Anfrage wird nicht geändert. Für eine neue Fassung eine neue anlegen.',
    })
  }

  const felder: string[] = []
  const werte: any[] = []
  if ('agency_id' in req.body) {
    felder.push('agency_id = ?')
    werte.push(req.body.agency_id ? Number(req.body.agency_id) : null)
  }
  if ('subject' in req.body) { felder.push('subject = ?'); werte.push(String(req.body.subject || '').slice(0, 200)) }
  if ('body' in req.body) { felder.push('body = ?'); werte.push(String(req.body.body || '')) }
  if ('deadline' in req.body) {
    felder.push('deadline = ?')
    werte.push(req.body.deadline ? String(req.body.deadline).slice(0, 10) : null)
  }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  await db.run(
    `UPDATE casting_requests SET ${felder.join(', ')}, updated_at = NOW() WHERE id = ?`,
    [...werte, id]
  )
  return res.json({ data: await ladeAnfrage(projectId, id), error: null })
})

/** Die Rollen einer Anfrage setzen - als Ganzes, wie die Rechnungspositionen. */
router.put('/projects/:projectId/casting-anfragen/:id/rollen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const anfrage = (await db.get(
    'SELECT status FROM casting_requests WHERE id = ? AND project_id = ?', [id, projectId]
  )) as any
  if (!anfrage) return res.status(404).json({ data: null, error: 'Anfrage nicht gefunden' })
  if (anfrage.status !== 'entwurf') {
    return res.status(400).json({ data: null, error: 'Eine verschickte Anfrage wird nicht geändert' })
  }

  const rollen = Array.isArray(req.body?.rollen) ? req.body.rollen : []
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM casting_request_roles WHERE request_id = ?', [id])
    for (let i = 0; i < rollen.length; i++) {
      const r = rollen[i]
      await tx.run(
        `INSERT INTO casting_request_roles
           (request_id, character_id, role_name, description, shoot_from, shoot_to,
            shoot_days, fee_per_day_cents, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          r?.character_id ? Number(r.character_id) : null,
          String(r?.role_name || ''),
          String(r?.description || ''),
          r?.shoot_from ? String(r.shoot_from).slice(0, 10) : null,
          r?.shoot_to ? String(r.shoot_to).slice(0, 10) : null,
          Math.max(0, Math.round(Number(r?.shoot_days ?? 0))),
          Math.max(0, Math.round(Number(r?.fee_per_day_cents ?? 0))),
          i,
        ]
      )
    }
  })
  return res.json({ data: await ladeAnfrage(projectId, id), error: null })
})

router.delete('/projects/:projectId/casting-anfragen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const zeile = await db.run(
    "DELETE FROM casting_requests WHERE id = ? AND project_id = ? AND status = 'entwurf'",
    [Number(req.params.id), Number(req.params.projectId)]
  )
  if (zeile.changes === 0) return res.status(400).json({ data: null, error: 'Nur Entwürfe lassen sich löschen' })
  return res.json({ data: { geloescht: true }, error: null })
})

/** Der Text der Anfrage - mit den Rollen als Tabelle. */
function anfrageMail(anfrage: any, rollen: any[], link: string): string {
  const anrede = anfrage.agentur_kontakt
    ? `Guten Tag ${anfrage.agentur_kontakt},`
    : 'Guten Tag,'

  const zeilen = rollen.map((r) => `
    <tr>
      <td style="padding:6px 12px 6px 0;vertical-align:top"><strong>${r.role_name || r.figur || 'Rolle'}</strong>
        ${r.description ? `<br><span style="color:#555">${r.description}</span>` : ''}</td>
      <td style="padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap">
        ${r.shoot_from ? datumText(r.shoot_from) : ''}${r.shoot_to && r.shoot_to !== r.shoot_from ? ` bis ${datumText(r.shoot_to)}` : ''}
        ${r.shoot_days ? `<br>${r.shoot_days} ${r.shoot_days === 1 ? 'Drehtag' : 'Drehtage'}` : ''}</td>
      <td style="padding:6px 0;vertical-align:top;white-space:nowrap">
        ${r.fee_per_day_cents ? `${euro(r.fee_per_day_cents)} / Tag` : 'nach Absprache'}</td>
    </tr>`).join('')

  return `<p>${anrede}</p>
${anfrage.body ? `<p>${String(anfrage.body).replace(/\n/g, '<br>')}</p>` : ''}
<p>Für die Produktion <strong>${anfrage.projekt}</strong> suchen wir:</p>
<table style="border-collapse:collapse;font-size:14px">${zeilen}</table>
<p>Über den folgenden Link können Sie uns Ihre Vorschläge direkt zurückmelden -
ohne Anmeldung:<br><a href="${link}">${link}</a></p>
${anfrage.deadline ? `<p>Wir freuen uns über eine Rückmeldung bis zum ${datumText(anfrage.deadline)}.</p>` : ''}
<p>Vielen Dank und beste Grüße</p>`
}

router.post('/projects/:projectId/casting-anfragen/:id/senden', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const anfrage = await ladeAnfrage(projectId, id)
  if (!anfrage) return res.status(404).json({ data: null, error: 'Anfrage nicht gefunden' })
  if (anfrage.status === 'beantwortet') {
    return res.status(400).json({ data: null, error: 'Diese Anfrage ist bereits beantwortet' })
  }
  if (anfrage.rollen.length === 0) {
    return res.status(400).json({ data: null, error: 'Ohne Rolle keine Anfrage' })
  }
  const empfaenger = String(anfrage.agentur_email || '').trim()
  if (!empfaenger) {
    return res.status(400).json({ data: null, error: 'Für diese Agentur ist keine Mailadresse hinterlegt' })
  }

  const token = anfrage.token || crypto.randomBytes(24).toString('hex')
  const link = `${appBasisUrl()}/casting/${token}`

  const eingereiht = await reiheEin({
    projectId,
    betreff: anfrage.subject || `Besetzungsanfrage ${anfrage.projekt}`,
    html: anfrageMail(anfrage, anfrage.rollen, link),
    empfaenger: [{ email: empfaenger, name: anfrage.agentur_kontakt || anfrage.agentur || '' }],
    anlass: 'casting',
    bezugId: id,
    erstelltVon: (req as any).user?.id ?? null,
  })

  await db.run(
    "UPDATE casting_requests SET status = 'versendet', token = ?, sent_at = NOW(), updated_at = NOW() WHERE id = ?",
    [token, id]
  )
  logAudit(projectId, (req as any).user as AuthUser, 'besetzungsanfrage versendet', 'casting_requests', id,
    null, { agentur: anfrage.agentur, rollen: anfrage.rollen.length })

  return res.json({ data: { status: 'versendet', an: empfaenger, mail_id: eingereiht[0]?.id ?? null, link }, error: null })
})

/** Nachfassen - derselbe Link, neue Mail. */
router.post('/projects/:projectId/casting-anfragen/:id/nachfassen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const anfrage = await ladeAnfrage(projectId, id)
  if (!anfrage) return res.status(404).json({ data: null, error: 'Anfrage nicht gefunden' })
  if (anfrage.status !== 'versendet' || !anfrage.token) {
    return res.status(400).json({ data: null, error: 'Nachfassen geht nur bei einer verschickten Anfrage' })
  }
  const empfaenger = String(anfrage.agentur_email || '').trim()
  if (!empfaenger) return res.status(400).json({ data: null, error: 'Keine Mailadresse hinterlegt' })

  const link = `${appBasisUrl()}/casting/${anfrage.token}`
  await reiheEin({
    projectId,
    betreff: `Erinnerung: ${anfrage.subject || `Besetzungsanfrage ${anfrage.projekt}`}`,
    html: `<p>Guten Tag${anfrage.agentur_kontakt ? ` ${anfrage.agentur_kontakt}` : ''},</p>
<p>unsere Anfrage zur Produktion <strong>${anfrage.projekt}</strong> ist vermutlich untergegangen -
das passiert. Der Link ist weiterhin gültig:<br><a href="${link}">${link}</a></p>
<p>Falls die Rollen inzwischen anders besetzt sind, genügt eine kurze Nachricht.</p>
<p>Beste Grüße</p>`,
    empfaenger: [{ email: empfaenger, name: anfrage.agentur_kontakt || anfrage.agentur || '' }],
    anlass: 'casting',
    bezugId: id,
    erstelltVon: (req as any).user?.id ?? null,
  })
  await db.run('UPDATE casting_requests SET reminded_at = NOW(), updated_at = NOW() WHERE id = ?', [id])
  return res.json({ data: { nachgefasst: true, an: empfaenger }, error: null })
})

/**
 * Einen Vorschlag in die Besetzung übernehmen.
 *
 * Legt einen Eintrag in `cast` an und merkt sich am Vorschlag, dass er
 * übernommen wurde - damit niemand dieselbe Person zweimal anlegt.
 */
router.post('/projects/:projectId/casting-vorschlaege/:id/uebernehmen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const vorschlag = (await db.get(
    `SELECT cp.*, rr.character_id, r.agency_id
       FROM casting_proposals cp
       JOIN casting_requests r ON cp.request_id = r.id
       LEFT JOIN casting_request_roles rr ON cp.role_id = rr.id
      WHERE cp.id = ? AND r.project_id = ?`,
    [Number(req.params.id), projectId]
  )) as any
  if (!vorschlag) return res.status(404).json({ data: null, error: 'Vorschlag nicht gefunden' })
  if (vorschlag.taken_cast_id) {
    return res.status(400).json({ data: null, error: 'Dieser Vorschlag ist bereits übernommen' })
  }

  const agentur = vorschlag.agency_id
    ? ((await db.get('SELECT name, email FROM agencies WHERE id = ?', [vorschlag.agency_id])) as any)
    : null

  const zeile = await db.run(
    `INSERT INTO "cast" (project_id, character_id, actor_name, agent_email, agency, agency_id, fee_per_day, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      vorschlag.character_id ?? null,
      String(vorschlag.actor_name || ''),
      String(agentur?.email || ''),
      String(agentur?.name || ''),
      vorschlag.agency_id ?? null,
      Number(vorschlag.fee_per_day_cents || 0),
      String(vorschlag.note || ''),
    ]
  )
  await db.run('UPDATE casting_proposals SET taken_cast_id = ? WHERE id = ?', [zeile.id, vorschlag.id])
  logAudit(projectId, (req as any).user as AuthUser, 'vorschlag übernommen', 'cast', zeile.id,
    null, { name: vorschlag.actor_name })
  return res.json({ data: { cast_id: zeile.id }, error: null })
})

// ─── Der öffentliche Teil ────────────────────────────────────────────────────

/**
 * Die Anfrage über den Link ansehen.
 *
 * Gibt nur heraus, worum es in dieser Anfrage geht - keine anderen Agenturen,
 * keine anderen Vorschläge, nichts aus dem Projekt darüber hinaus.
 */
router.get('/casting/:token', async (req: Request, res: Response) => {
  const anfrage = (await db.get(
    `SELECT r.*, p.title AS projekt, a.name AS agentur
       FROM casting_requests r
       JOIN projects p ON r.project_id = p.id
       LEFT JOIN agencies a ON r.agency_id = a.id
      WHERE r.token = ?`,
    [String(req.params.token)]
  )) as any
  if (!anfrage) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })

  const [rollen, eigene] = await Promise.all([
    db.all(
      `SELECT rr.id, rr.role_name, rr.description, rr.shoot_from, rr.shoot_to,
              rr.shoot_days, rr.fee_per_day_cents, c.name AS figur
         FROM casting_request_roles rr
         LEFT JOIN characters c ON rr.character_id = c.id
        WHERE rr.request_id = ? ORDER BY rr.sort_order ASC`,
      [anfrage.id]
    ) as Promise<any[]>,
    db.all(
      'SELECT id, role_id, actor_name, available, fee_per_day_cents, showreel_url, note FROM casting_proposals WHERE request_id = ? ORDER BY id ASC',
      [anfrage.id]
    ) as Promise<any[]>,
  ])

  return res.json({
    data: {
      projekt: anfrage.projekt,
      agentur: anfrage.agentur || '',
      betreff: anfrage.subject || '',
      text: anfrage.body || '',
      frist: anfrage.deadline,
      status: anfrage.status,
      beantwortet_am: anfrage.answered_at,
      rollen,
      vorschlaege: eigene,
    },
    error: null,
  })
})

/**
 * Die Agentur meldet ihre Vorschläge zurück.
 *
 * Ersetzt die bisherigen Vorschläge vollständig: Eine Agentur, die ihre
 * Antwort überarbeitet, soll nicht doppelte Einträge erzeugen. Übernommene
 * Vorschläge bleiben stehen - was schon in der Besetzung ist, verschwindet
 * nicht, weil jemand das Formular noch einmal abschickt.
 */
router.post('/casting/:token/antwort', async (req: Request, res: Response) => {
  const anfrage = (await db.get(
    'SELECT id, project_id, status FROM casting_requests WHERE token = ?', [String(req.params.token)]
  )) as any
  if (!anfrage) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })

  const vorschlaege = Array.isArray(req.body?.vorschlaege) ? req.body.vorschlaege : []
  if (vorschlaege.length === 0) {
    return res.status(400).json({ data: null, error: 'Bitte mindestens einen Vorschlag eintragen' })
  }

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM casting_proposals WHERE request_id = ? AND taken_cast_id IS NULL', [anfrage.id])
    for (const v of vorschlaege) {
      const name = String(v?.actor_name || '').trim()
      if (!name) continue
      await tx.run(
        `INSERT INTO casting_proposals
           (request_id, role_id, actor_name, available, fee_per_day_cents, showreel_url, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          anfrage.id,
          v?.role_id ? Number(v.role_id) : null,
          name.slice(0, 200),
          v?.available === undefined || v?.available === null ? null : v.available === true,
          Math.max(0, Math.round(Number(v?.fee_per_day_cents ?? 0))),
          String(v?.showreel_url || '').slice(0, 500),
          String(v?.note || '').slice(0, 1000),
        ]
      )
    }
    await tx.run(
      "UPDATE casting_requests SET status = 'beantwortet', answered_at = NOW(), updated_at = NOW() WHERE id = ?",
      [anfrage.id]
    )
  })

  logAudit(anfrage.project_id, undefined, 'besetzungsanfrage beantwortet', 'casting_requests', anfrage.id,
    null, { vorschlaege: vorschlaege.length })
  return res.json({ data: { status: 'beantwortet', anzahl: vorschlaege.length }, error: null })
})

export default router
