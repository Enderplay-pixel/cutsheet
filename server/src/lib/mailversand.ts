/**
 * Postausgang mit Warteschlange.
 *
 * Vorher ging eine Mail im selben Atemzug wie die Anfrage raus: Wenn der
 * Mailserver zickte, bekam die Oberfläche einen Fehler, und ob die Mail
 * angekommen war, wusste niemand. Jetzt wird jede Mail als Zeile abgelegt -
 * eine je Empfänger - und von einer Schleife abgearbeitet. Jede Zeile trägt
 * ihren Status, ihre Versuche und ihren letzten Fehler.
 *
 * Eine Zeile je Empfänger ist Absicht: Call-Zeiten sind persönlich, und ein
 * Sammelversand an zwanzig Adressen verrät jeder Person die Adressen der
 * anderen.
 */
import crypto from 'crypto'
import nodemailer, { Transporter } from 'nodemailer'
import { db } from '../db'

export type Versandstatus = 'wartet' | 'gesendet' | 'fehlgeschlagen' | 'ohne_versand'

/** Wofür die Mail steht - für Filter im Protokoll und für die Statistik. */
export type Anlass = 'dispo' | 'einladung' | 'passwort' | 'manuell' | 'test' | 'system'

export type Empfaenger = {
  email: string
  name?: string
  /** Persönliche Werte für die Platzhalter dieser einen Mail. */
  werte?: Record<string, string>
}

/** Nach dem wievielten Versuch die Mail als gescheitert gilt. */
export const MAX_VERSUCHE = 5

/**
 * Wartezeit bis zum nächsten Versuch. Wächst, damit ein Mailserver, der
 * gerade überlastet ist, nicht von uns weiter bedrängt wird.
 */
export function wartezeitMinuten(versuche: number): number {
  const stufen = [1, 5, 15, 60]
  if (versuche <= 0) return stufen[0]
  return stufen[Math.min(versuche - 1, stufen.length - 1)]
}

/** Grobe Prüfung auf eine brauchbare Adresse. Strenger als nötig schadet hier. */
export function istAdresse(wert: string): boolean {
  if (!wert || wert.length > 254) return false
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-zA-Z]{2,}$/.test(wert.trim())
}

let transporter: Transporter | null | undefined

export function smtpEingerichtet(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function holeTransport(): Transporter | null {
  if (transporter !== undefined) return transporter
  if (!process.env.SMTP_HOST) {
    transporter = null
    return null
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return transporter
}

/** Nur für Tests und für den Fall, dass die Zugangsdaten zur Laufzeit wechseln. */
export function vergissTransport() {
  transporter = undefined
}

export function appBasisUrl(): string {
  return (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
}

export type EinreihOptionen = {
  projectId: number | null
  betreff: string
  /** Fertiges HTML. Platzhalter sind zu diesem Zeitpunkt schon gefüllt. */
  html: string | ((empfaenger: Empfaenger) => string)
  empfaenger: Empfaenger[]
  anlass: Anlass
  bezugId?: number | null
  /** Wann frühestens gesendet werden soll. Leer heißt sofort. */
  geplantFuer?: Date | null
  erstelltVon?: number | null
  /** Legt je Mail einen Quittungs-Link an, über den Empfang bestätigt wird. */
  mitQuittung?: boolean
  /** Ein Anhang für alle Empfänger - wird einmal gespeichert. */
  anhang?: { dateiname: string; inhalt: Buffer } | null
}

export type EingereihteMail = {
  id: number
  email: string
  quittungToken: string | null
}

/**
 * Legt die Mails im Postausgang ab. Sendet noch nichts - das macht
 * `sendeFaellige`, direkt danach oder später aus der Schleife.
 */
export async function reiheEin(opts: EinreihOptionen): Promise<EingereihteMail[]> {
  const ergebnis: EingereihteMail[] = []
  let anhangId: number | null = null
  if (opts.anhang) {
    const zeile = await db.run(
      'INSERT INTO email_attachments (project_id, filename, content) VALUES (?, ?, ?)',
      [opts.projectId ?? null, opts.anhang.dateiname, opts.anhang.inhalt]
    )
    anhangId = zeile.id
  }
  for (const person of opts.empfaenger) {
    const email = (person.email || '').trim()
    if (!istAdresse(email)) continue
    const token = opts.mitQuittung ? crypto.randomBytes(16).toString('hex') : null
    const rohHtml = typeof opts.html === 'function' ? opts.html(person) : opts.html
    // Der Token entsteht erst hier, deshalb steht im Text nur ein Platzhalter.
    const html = rohHtml.replace(
      /\{\{\s*quittung_link\s*\}\}/g,
      token ? `${appBasisUrl()}/api/email/receipt/${token}` : ''
    )
    const zeile = await db.run(
      `INSERT INTO email_outbox
         (project_id, subject, html, recipient_email, recipient_name, purpose,
          reference_id, status, scheduled_for, receipt_token, created_by, attachment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'wartet', ?, ?, ?, ?)`,
      [
        opts.projectId,
        opts.betreff,
        html,
        email,
        person.name || '',
        opts.anlass,
        opts.bezugId ?? null,
        opts.geplantFuer ? opts.geplantFuer.toISOString() : null,
        token,
        opts.erstelltVon ?? null,
        anhangId,
      ]
    )
    ergebnis.push({ id: zeile.id, email, quittungToken: token })
  }
  return ergebnis
}

/** Absenderzeile und Antwortadresse eines Projekts, mit Rückfall auf die Umgebung. */
export async function holeAbsender(projectId: number | null): Promise<{ from: string; replyTo?: string }> {
  const standard = process.env.SMTP_FROM || 'CutSheet <noreply@cutsheet.app>'
  if (!projectId) return { from: standard }
  const zeile = (await db.get(
    'SELECT sender_name, reply_to FROM email_identities WHERE project_id = ?',
    [projectId]
  )) as any
  if (!zeile) return { from: standard }
  const adresse = standard.includes('<') ? standard.replace(/^.*</, '<') : `<${standard}>`
  const from = zeile.sender_name ? `${zeile.sender_name} ${adresse}` : standard
  return { from, replyTo: zeile.reply_to || undefined }
}

/**
 * Arbeitet fällige Mails ab. Gibt zurück, was passiert ist - der Aufrufer
 * kann damit sofort eine ehrliche Rückmeldung geben.
 */
export async function sendeFaellige(grenze = 25): Promise<{
  gesendet: number
  fehlgeschlagen: number
  ohneVersand: number
}> {
  const faellig = (await db.all(
    `SELECT * FROM email_outbox
      WHERE status = 'wartet'
        AND next_attempt_at <= NOW()
        AND (scheduled_for IS NULL OR scheduled_for <= NOW())
      ORDER BY id ASC
      LIMIT ?`,
    [grenze]
  )) as any[]

  let gesendet = 0
  let fehlgeschlagen = 0
  let ohneVersand = 0

  for (const mail of faellig) {
    const transport = holeTransport()
    if (!transport) {
      // Ohne Mailserver wird nichts verschickt - und die App behauptet es
      // auch nicht. Die Zeile bleibt als Beleg stehen.
      await db.run(
        `UPDATE email_outbox SET status = 'ohne_versand', last_error = ? WHERE id = ?`,
        ['Kein Mailserver eingerichtet (SMTP_HOST fehlt)', mail.id]
      )
      ohneVersand++
      continue
    }
    try {
      const { from, replyTo } = await holeAbsender(mail.project_id)
      let anhaenge: Array<{ filename: string; content: Buffer }> | undefined
      if (mail.attachment_id) {
        const datei = (await db.get(
          'SELECT filename, content FROM email_attachments WHERE id = ?',
          [mail.attachment_id]
        )) as any
        if (datei) anhaenge = [{ filename: datei.filename, content: datei.content }]
      }
      await transport.sendMail({
        from,
        replyTo,
        to: mail.recipient_name ? `${mail.recipient_name} <${mail.recipient_email}>` : mail.recipient_email,
        subject: mail.subject,
        html: mail.html,
        attachments: anhaenge,
      })
      await db.run(
        `UPDATE email_outbox SET status = 'gesendet', sent_at = NOW(), attempts = attempts + 1, last_error = '' WHERE id = ?`,
        [mail.id]
      )
      gesendet++
    } catch (fehler: any) {
      const versuche = Number(mail.attempts || 0) + 1
      const aufgeben = versuche >= MAX_VERSUCHE
      await db.run(
        `UPDATE email_outbox
            SET attempts = ?, last_error = ?, status = ?,
                next_attempt_at = NOW() + (? || ' minutes')::interval
          WHERE id = ?`,
        [
          versuche,
          String(fehler?.message || fehler).slice(0, 500),
          aufgeben ? 'fehlgeschlagen' : 'wartet',
          String(wartezeitMinuten(versuche)),
          mail.id,
        ]
      )
      if (aufgeben) fehlgeschlagen++
    }
  }
  return { gesendet, fehlgeschlagen, ohneVersand }
}

/** Setzt eine gescheiterte Mail zurück in die Warteschlange. */
export async function erneutVersuchen(id: number, projectId: number): Promise<boolean> {
  const zeile = await db.run(
    `UPDATE email_outbox
        SET status = 'wartet', attempts = 0, last_error = '', next_attempt_at = NOW()
      WHERE id = ? AND project_id = ? AND status IN ('fehlgeschlagen', 'ohne_versand')`,
    [id, projectId]
  )
  return zeile.changes > 0
}

/** Empfang bestätigen. Der Token steckt im Link am Ende der Mail. */
export async function quittiere(token: string): Promise<{ projectId: number; betreff: string } | null> {
  const mail = (await db.get(
    'SELECT id, project_id, subject, read_at FROM email_outbox WHERE receipt_token = ?',
    [token]
  )) as any
  if (!mail) return null
  if (!mail.read_at) {
    await db.run('UPDATE email_outbox SET read_at = NOW() WHERE id = ?', [mail.id])
  }
  return { projectId: mail.project_id, betreff: mail.subject }
}

let schleife: NodeJS.Timeout | null = null

/**
 * Startet die Hintergrundschleife. Alle 30 Sekunden ein Blick in den
 * Postausgang - das reicht für Dispos und hält die Datenbank in Ruhe.
 */
export function starteVersandSchleife(intervallMs = 30_000) {
  if (schleife) return
  schleife = setInterval(() => {
    sendeFaellige().catch((fehler) => {
      console.error('[Mail] Postausgang konnte nicht abgearbeitet werden:', fehler?.message || fehler)
    })
  }, intervallMs)
  // Der Prozess soll nicht wegen der Schleife am Leben bleiben.
  if (typeof schleife.unref === 'function') schleife.unref()
}

export function stoppeVersandSchleife() {
  if (schleife) {
    clearInterval(schleife)
    schleife = null
  }
}
