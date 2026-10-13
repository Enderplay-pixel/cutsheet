/**
 * Fassungen, Abnahmerunden und Anmerkungen.
 *
 * Das Ende der Kette: Eine Fassung geht an den Auftraggeber, er meldet sich
 * mit Anmerkungen, irgendwann nimmt er ab - und erst danach wird abgerechnet.
 * Bisher lief das über Mails, und wer "passt so" geschrieben hat, stand dann
 * in einem Postfach statt im Projekt.
 *
 * Eine Anmerkung mit Zeitstelle ist brauchbar ("bei 2:14 ist der Ton zu
 * laut"), eine ohne nicht. Deshalb ist die Zeitstelle das erste Feld und
 * nicht das letzte.
 *
 * Die Fassung selbst liegt **nicht** hier: Ein Schnitt ist Gigabytes groß und
 * gehört nicht in eine Datenbankspalte. Gespeichert wird der Link, unter dem
 * sie liegt - Frame.io, ein eigener Server, was auch immer.
 */
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { logAudit } from './audit'
import { reiheEin } from '../lib/mailversand'
import { generatePdf } from './pdf'
import { pdfFontFaces, PDF_SANS } from '../lib/pdfFonts'

const router = Router()

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function appBasisUrl(): string {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
}

/** Sekunden als Zeitstelle: 134 wird zu "2:14". */
export function alsZeitstelle(sekunden: number | null | undefined): string {
  if (sekunden === null || sekunden === undefined || !Number.isFinite(Number(sekunden))) return ''
  const s = Math.max(0, Math.round(Number(sekunden)))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = s % 60
  const zwei = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${zwei(m)}:${zwei(rest)}` : `${m}:${zwei(rest)}`
}

/**
 * Eine Zeitstelle in Sekunden: "2:14" wird zu 134.
 *
 * Nimmt auch "1:02:14" und eine blanke Sekundenzahl. Was sich nicht lesen
 * lässt, gibt null - eine Anmerkung ohne Zeitstelle ist immer noch eine
 * Anmerkung.
 */
export function ausZeitstelle(text: string): number | null {
  const roh = String(text || '').trim()
  if (!roh) return null
  if (/^\d+$/.test(roh)) return Number(roh)
  const teile = roh.split(':').map((t) => Number(t.trim()))
  if (teile.some((t) => !Number.isFinite(t) || t < 0)) return null
  if (teile.length === 2) return teile[0] * 60 + teile[1]
  if (teile.length === 3) return teile[0] * 3600 + teile[1] * 60 + teile[2]
  return null
}

/** Die Stufen einer Fassung, in der Reihenfolge, in der sie entstehen. */
export const STUFEN = [
  { stufe: 'rohschnitt', name: 'Rohschnitt' },
  { stufe: 'feinschnitt', name: 'Feinschnitt' },
  { stufe: 'picture_lock', name: 'Picture Lock' },
  { stufe: 'farbe_ton', name: 'Farbe und Ton' },
  { stufe: 'final', name: 'Finale Fassung' },
] as const

// ─── Fassungen ───────────────────────────────────────────────────────────────

router.get('/projects/:projectId/fassungen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const fassungen = (await db.all(
    `SELECT c.*,
            (SELECT COUNT(*) FROM reviews r WHERE r.cut_id = c.id) AS runden
       FROM cuts c WHERE c.project_id = ?
      ORDER BY c.version DESC, c.id DESC`,
    [projectId]
  )) as any[]
  return res.json({
    data: {
      fassungen: fassungen.map((f) => ({ ...f, dauer: alsZeitstelle(f.duration_seconds) })),
      stufen: STUFEN,
    },
    error: null,
  })
})

router.post('/projects/:projectId/fassungen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  // Die nächste Nummer ergibt sich, statt dass jemand sie tippt - zwei
  // Fassungen mit derselben Nummer sind in einer Abnahme das Ende jeder
  // Nachvollziehbarkeit.
  const letzte = (await db.get(
    'SELECT COALESCE(MAX(version), 0) AS hoechste FROM cuts WHERE project_id = ?', [projectId]
  )) as any
  const zeile = await db.run(
    `INSERT INTO cuts (project_id, label, stage, version, duration_seconds, watch_url, format, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      String(req.body?.label || '').slice(0, 200),
      String(req.body?.stage || 'rohschnitt'),
      Number(letzte?.hoechste ?? 0) + 1,
      Math.max(0, Math.round(Number(req.body?.duration_seconds ?? 0))),
      String(req.body?.watch_url || '').slice(0, 1000),
      String(req.body?.format || '').slice(0, 120),
      String(req.body?.notes || '').slice(0, 2000),
      (req as any).user?.id ?? null,
    ]
  )
  return res.json({ data: await db.get('SELECT * FROM cuts WHERE id = ?', [zeile.id]), error: null })
})

router.put('/projects/:projectId/fassungen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const felder: string[] = []
  const werte: any[] = []
  for (const feld of ['label', 'stage', 'watch_url', 'format', 'notes']) {
    if (feld in req.body) { felder.push(`${feld} = ?`); werte.push(String(req.body[feld] ?? '')) }
  }
  if ('duration_seconds' in req.body) {
    felder.push('duration_seconds = ?')
    werte.push(Math.max(0, Math.round(Number(req.body.duration_seconds) || 0)))
  }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  const zeile = await db.run(
    `UPDATE cuts SET ${felder.join(', ')} WHERE id = ? AND project_id = ?`,
    [...werte, Number(req.params.id), Number(req.params.projectId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Fassung nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

router.delete('/projects/:projectId/fassungen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const runden = (await db.get(
    'SELECT COUNT(*) AS anzahl FROM reviews WHERE cut_id = ?', [Number(req.params.id)]
  )) as any
  if (Number(runden?.anzahl ?? 0) > 0) {
    return res.status(400).json({
      data: null,
      error: 'Zu dieser Fassung gibt es Abnahmerunden. Was zur Abnahme vorlag, wird nicht gelöscht.',
    })
  }
  const zeile = await db.run(
    'DELETE FROM cuts WHERE id = ? AND project_id = ?',
    [Number(req.params.id), Number(req.params.projectId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Fassung nicht gefunden' })
  return res.json({ data: { geloescht: true }, error: null })
})

// ─── Abnahmerunden ───────────────────────────────────────────────────────────

async function ladeRunde(projectId: number, id: number) {
  const kopf = (await db.get(
    `SELECT r.*, c.label AS fassung, c.version, c.stage, c.watch_url, c.duration_seconds,
            k.name AS kunde, p.title AS projekt
       FROM reviews r
       LEFT JOIN cuts c ON r.cut_id = c.id
       LEFT JOIN company_clients k ON r.client_id = k.id
       JOIN projects p ON r.project_id = p.id
      WHERE r.id = ? AND r.project_id = ?`,
    [id, projectId]
  )) as any
  if (!kopf) return null
  const anmerkungen = (await db.all(
    'SELECT * FROM review_notes WHERE review_id = ? ORDER BY at_seconds ASC NULLS LAST, id ASC',
    [id]
  )) as any[]
  return {
    ...kopf,
    anmerkungen: anmerkungen.map((a) => ({ ...a, zeitstelle: alsZeitstelle(a.at_seconds) })),
    offen: anmerkungen.filter((a) => a.status === 'offen').length,
  }
}

router.get('/projects/:projectId/abnahmen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const heute = heuteISO()
  const runden = (await db.all(
    `SELECT r.*, c.label AS fassung, c.version, k.name AS kunde,
            (SELECT COUNT(*) FROM review_notes n WHERE n.review_id = r.id) AS anmerkungen,
            (SELECT COUNT(*) FROM review_notes n WHERE n.review_id = r.id AND n.status = 'offen') AS offen
       FROM reviews r
       LEFT JOIN cuts c ON r.cut_id = c.id
       LEFT JOIN company_clients k ON r.client_id = k.id
      WHERE r.project_id = ?
      ORDER BY r.created_at DESC`,
    [projectId]
  )) as any[]

  return res.json({
    data: runden.map((r) => ({
      ...r,
      ueberfaellig: r.status === 'versendet' && r.deadline
        ? String(r.deadline).slice(0, 10) < heute
        : false,
    })),
    error: null,
  })
})

router.get('/projects/:projectId/abnahmen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const runde = await ladeRunde(Number(req.params.projectId), Number(req.params.id))
  if (!runde) return res.status(404).json({ data: null, error: 'Abnahmerunde nicht gefunden' })
  return res.json({ data: runde, error: null })
})

router.post('/projects/:projectId/abnahmen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  if (!req.body?.cut_id) return res.status(400).json({ data: null, error: 'Ohne Fassung keine Abnahme' })

  const zeile = await db.run(
    `INSERT INTO reviews
       (project_id, cut_id, client_id, recipient_name, recipient_email, message, deadline, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      Number(req.body.cut_id),
      req.body?.client_id ? Number(req.body.client_id) : null,
      String(req.body?.recipient_name || '').slice(0, 200),
      String(req.body?.recipient_email || '').slice(0, 200),
      String(req.body?.message || ''),
      req.body?.deadline ? String(req.body.deadline).slice(0, 10) : null,
      (req as any).user?.id ?? null,
    ]
  )
  return res.json({ data: await ladeRunde(projectId, zeile.id), error: null })
})

router.put('/projects/:projectId/abnahmen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const runde = (await db.get(
    'SELECT status FROM reviews WHERE id = ? AND project_id = ?', [id, projectId]
  )) as any
  if (!runde) return res.status(404).json({ data: null, error: 'Abnahmerunde nicht gefunden' })
  if (runde.status === 'abgenommen') {
    return res.status(400).json({ data: null, error: 'Eine abgenommene Fassung wird nicht mehr geändert' })
  }

  const felder: string[] = []
  const werte: any[] = []
  for (const feld of ['recipient_name', 'recipient_email', 'message']) {
    if (feld in req.body) { felder.push(`${feld} = ?`); werte.push(String(req.body[feld] ?? '')) }
  }
  if ('client_id' in req.body) {
    felder.push('client_id = ?')
    werte.push(req.body.client_id ? Number(req.body.client_id) : null)
  }
  if ('deadline' in req.body) {
    felder.push('deadline = ?')
    werte.push(req.body.deadline ? String(req.body.deadline).slice(0, 10) : null)
  }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  await db.run(
    `UPDATE reviews SET ${felder.join(', ')}, updated_at = NOW() WHERE id = ?`, [...werte, id]
  )
  return res.json({ data: await ladeRunde(projectId, id), error: null })
})

/** Die Runde verschicken - der Auftraggeber bekommt einen Link ohne Konto. */
router.post('/projects/:projectId/abnahmen/:id/senden', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const runde = await ladeRunde(projectId, id)
  if (!runde) return res.status(404).json({ data: null, error: 'Abnahmerunde nicht gefunden' })
  if (runde.status === 'abgenommen') {
    return res.status(400).json({ data: null, error: 'Diese Fassung ist bereits abgenommen' })
  }
  const empfaenger = String(runde.recipient_email || '').trim()
  if (!empfaenger) return res.status(400).json({ data: null, error: 'Keine Mailadresse eingetragen' })
  if (!runde.watch_url) {
    return res.status(400).json({
      data: null,
      error: 'An der Fassung fehlt der Link, unter dem sie zu sehen ist',
    })
  }

  const token = runde.token || crypto.randomBytes(24).toString('hex')
  const link = `${appBasisUrl()}/abnahme/${token}`

  const eingereiht = await reiheEin({
    projectId,
    betreff: `${runde.projekt}: ${runde.fassung || `Fassung ${runde.version}`} zur Abnahme`,
    html: `<p>Guten Tag${runde.recipient_name ? ` ${runde.recipient_name}` : ''},</p>
${runde.message ? `<p>${String(runde.message).replace(/\n/g, '<br>')}</p>` : ''}
<p>die ${runde.fassung || `Fassung ${runde.version}`} zu <strong>${runde.projekt}</strong> steht
bereit. Über den folgenden Link können Sie sie ansehen, Anmerkungen mit Zeitstelle hinterlassen
und abnehmen - ohne Anmeldung:</p>
<p><a href="${link}">${link}</a></p>
${runde.deadline ? `<p>Wir freuen uns über Ihre Rückmeldung bis zum
${new Date(`${String(runde.deadline).slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE')}.</p>` : ''}
<p>Beste Grüße</p>`,
    empfaenger: [{ email: empfaenger, name: runde.recipient_name || '' }],
    anlass: 'abnahme',
    bezugId: id,
    erstelltVon: (req as any).user?.id ?? null,
  })

  await db.run(
    "UPDATE reviews SET status = 'versendet', token = ?, sent_at = NOW(), updated_at = NOW() WHERE id = ?",
    [token, id]
  )
  logAudit(projectId, (req as any).user as AuthUser, 'abnahme versendet', 'reviews', id,
    null, { fassung: runde.fassung, an: empfaenger })

  return res.json({ data: { status: 'versendet', an: empfaenger, mail_id: eingereiht[0]?.id ?? null, link }, error: null })
})

/** Eine Anmerkung als erledigt (oder wieder offen) kennzeichnen. */
router.put('/projects/:projectId/abnahmen/:id/anmerkungen/:notizId', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const notiz = (await db.get(
    `SELECT n.id FROM review_notes n JOIN reviews r ON n.review_id = r.id
      WHERE n.id = ? AND n.review_id = ? AND r.project_id = ?`,
    [Number(req.params.notizId), id, projectId]
  )) as any
  if (!notiz) return res.status(404).json({ data: null, error: 'Anmerkung nicht gefunden' })

  const stand = String(req.body?.status || 'offen')
  if (!['offen', 'erledigt', 'abgelehnt'].includes(stand)) {
    return res.status(400).json({ data: null, error: 'Unbekannter Stand' })
  }
  await db.run(
    `UPDATE review_notes SET status = ?, resolved_at = ?, resolved_note = ? WHERE id = ?`,
    [
      stand,
      stand === 'offen' ? null : new Date().toISOString(),
      String(req.body?.resolved_note || '').slice(0, 1000),
      notiz.id,
    ]
  )
  return res.json({ data: await ladeRunde(projectId, id), error: null })
})

/**
 * Das Abnahmeprotokoll.
 *
 * Ein Blatt, das sagt: Diese Fassung, dieser Stand, diese Person, dieser
 * Zeitpunkt. Zusammen mit den Anmerkungen ist das der Beleg dafür, worauf man
 * sich geeinigt hat - und die Grundlage für die Schlussrechnung.
 */
router.get('/projects/:projectId/abnahmen/:id/protokoll.pdf', requireAuth, requireMember, async (req: Request, res: Response) => {
  const runde = await ladeRunde(Number(req.params.projectId), Number(req.params.id))
  if (!runde) return res.status(404).json({ data: null, error: 'Abnahmerunde nicht gefunden' })

  const esc = (w: any) => String(w ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const datum = (w: any) => {
    if (!w) return '—'
    const d = new Date(w)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('de-DE')
  }

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Abnahmeprotokoll</title>
<style>
${pdfFontFaces()}
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: ${PDF_SANS}; font-size: 10.5pt; color: #111; line-height: 1.5; }
  .blatt { width: 210mm; min-height: 297mm; padding: 20mm 20mm 20mm 25mm; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  .unter { color: #555; font-size: 9.5pt; margin-bottom: 8mm; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 10pt; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em;
    color: #555; border-bottom: 0.6pt solid #333; padding: 2mm 2mm 2mm 0; }
  td { padding: 2mm 2mm 2mm 0; border-bottom: 0.3pt solid #ddd; vertical-align: top; }
  .angaben td { border: none; padding: 1mm 6mm 1mm 0; }
  .angaben td:first-child { color: #555; width: 42mm; }
  .stand { display: inline-block; padding: 1mm 3mm; border-radius: 2mm; font-size: 9pt; }
  .ja { background: #e6f6ec; }
  .offen { background: #fdf3e0; }
  .fuss { margin-top: 14mm; border-top: 0.3pt solid #ddd; padding-top: 3mm;
    font-size: 8pt; color: #666; }
</style></head>
<body><div class="blatt">
  <h1>Abnahmeprotokoll</h1>
  <div class="unter">${esc(runde.projekt)}</div>

  <table class="angaben">
    <tr><td>Fassung</td><td><b>${esc(runde.fassung || `Fassung ${runde.version}`)}</b>
      (Nr. ${esc(runde.version)})</td></tr>
    <tr><td>Auftraggeber</td><td>${esc(runde.kunde || runde.recipient_name || '—')}</td></tr>
    <tr><td>Zur Abnahme vorgelegt</td><td>${datum(runde.sent_at)}</td></tr>
    <tr><td>Entscheidung</td><td>${
      runde.status === 'abgenommen'
        ? `<span class="stand ja">abgenommen</span>`
        : `<span class="stand offen">${esc(runde.status)}</span>`
    }</td></tr>
    ${runde.decided_at ? `<tr><td>Am</td><td>${datum(runde.decided_at)}</td></tr>` : ''}
    ${runde.decided_by ? `<tr><td>Durch</td><td>${esc(runde.decided_by)}</td></tr>` : ''}
  </table>

  ${runde.decision ? `<p style="margin-top:6mm">${esc(runde.decision)}</p>` : ''}

  <h2 style="font-size:11.5pt;margin:10mm 0 2mm">Anmerkungen (${runde.anmerkungen.length})</h2>
  ${runde.anmerkungen.length === 0
    ? '<p style="color:#555">Keine Anmerkungen.</p>'
    : `<table>
    <thead><tr><th style="width:18mm">Stelle</th><th>Anmerkung</th><th style="width:26mm">Stand</th></tr></thead>
    <tbody>${runde.anmerkungen.map((a: any) => `<tr>
      <td>${esc(a.zeitstelle || '—')}</td>
      <td>${esc(a.body)}${a.author ? `<br><span style="color:#777;font-size:9pt">${esc(a.author)}</span>` : ''}
        ${a.resolved_note ? `<br><span style="color:#555;font-size:9pt">→ ${esc(a.resolved_note)}</span>` : ''}</td>
      <td>${esc(a.status)}</td></tr>`).join('')}</tbody>
  </table>`}

  <div class="fuss">
    Erstellt am ${new Date().toLocaleString('de-DE')} aus CutSheet.
    Die Zustimmung wurde in Textform über einen persönlichen Link erklärt.
  </div>
</div></body></html>`

  const pdf = await generatePdf(html)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="abnahme-${runde.id}.pdf"`)
  return res.send(pdf)
})

// ─── Der öffentliche Teil ────────────────────────────────────────────────────

router.get('/abnahme/:token', async (req: Request, res: Response) => {
  const runde = (await db.get(
    `SELECT r.*, c.label AS fassung, c.version, c.stage, c.watch_url, c.duration_seconds, c.format,
            p.title AS projekt
       FROM reviews r
       LEFT JOIN cuts c ON r.cut_id = c.id
       JOIN projects p ON r.project_id = p.id
      WHERE r.token = ?`,
    [String(req.params.token)]
  )) as any
  if (!runde) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })

  const anmerkungen = (await db.all(
    'SELECT id, at_seconds, body, author, status FROM review_notes WHERE review_id = ? ORDER BY at_seconds ASC NULLS LAST, id ASC',
    [runde.id]
  )) as any[]

  return res.json({
    data: {
      projekt: runde.projekt,
      fassung: runde.fassung || `Fassung ${runde.version}`,
      version: runde.version,
      stufe: runde.stage,
      watch_url: runde.watch_url,
      dauer: alsZeitstelle(runde.duration_seconds),
      format: runde.format,
      nachricht: runde.message,
      frist: runde.deadline,
      status: runde.status,
      entschieden_am: runde.decided_at,
      entschieden_von: runde.decided_by,
      anmerkungen: anmerkungen.map((a) => ({ ...a, zeitstelle: alsZeitstelle(a.at_seconds) })),
    },
    error: null,
  })
})

/** Eine Anmerkung hinterlassen - ohne Konto. */
router.post('/abnahme/:token/anmerkung', async (req: Request, res: Response) => {
  const runde = (await db.get(
    'SELECT id, project_id, status FROM reviews WHERE token = ?', [String(req.params.token)]
  )) as any
  if (!runde) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })
  if (runde.status === 'abgenommen') {
    return res.status(400).json({
      data: null,
      error: 'Diese Fassung ist abgenommen. Für Änderungen bitte bei der Produktion melden.',
    })
  }
  const text = String(req.body?.body || '').trim()
  if (!text) return res.status(400).json({ data: null, error: 'Bitte die Anmerkung eintragen' })

  const zeile = await db.run(
    'INSERT INTO review_notes (review_id, at_seconds, body, author) VALUES (?, ?, ?, ?)',
    [
      runde.id,
      ausZeitstelle(String(req.body?.zeitstelle || '')),
      text.slice(0, 2000),
      String(req.body?.author || '').slice(0, 200),
    ]
  )
  return res.json({ data: { id: zeile.id }, error: null })
})

/**
 * Abnehmen oder eine neue Fassung verlangen.
 *
 * Beides wird festgehalten, mit Name und Zeitpunkt. "Nicht abgenommen" ist
 * keine Ablehnung des Films, sondern die Ansage, dass eine Runde fehlt - und
 * genau so steht es auch da.
 */
router.post('/abnahme/:token/entscheiden', async (req: Request, res: Response) => {
  const runde = (await db.get(
    'SELECT id, project_id, status FROM reviews WHERE token = ?', [String(req.params.token)]
  )) as any
  if (!runde) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })
  if (runde.status === 'abgenommen') {
    return res.json({ data: { status: 'abgenommen' }, error: null })
  }
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ data: null, error: 'Bitte den Namen eintragen' })

  const abgenommen = req.body?.abgenommen === true
  await db.run(
    `UPDATE reviews SET status = ?, decided_at = NOW(), decided_by = ?, decision = ?, updated_at = NOW()
      WHERE id = ?`,
    [
      abgenommen ? 'abgenommen' : 'nachbesserung',
      name.slice(0, 200),
      String(req.body?.decision || '').slice(0, 2000),
      runde.id,
    ]
  )
  logAudit(runde.project_id, undefined, abgenommen ? 'fassung abgenommen' : 'nachbesserung verlangt',
    'reviews', runde.id, null, { von: name.slice(0, 200) })
  return res.json({ data: { status: abgenommen ? 'abgenommen' : 'nachbesserung' }, error: null })
})

export default router
