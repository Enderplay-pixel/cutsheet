/**
 * Fassade für den Mailversand.
 *
 * Der eigentliche Versand liegt in `lib/mailversand.ts` - hier bleibt nur,
 * was Aufrufer aus dem Rest des Servers brauchen. `sendEmail` reiht ein und
 * stößt den Postausgang an; die Antwort sagt ehrlich, was passiert ist, statt
 * so zu tun, als wäre alles raus.
 */
import { db } from '../db'
import {
  reiheEin,
  sendeFaellige,
  smtpEingerichtet,
  appBasisUrl,
  type Anlass,
} from '../lib/mailversand'
import { saeubereHtml } from '../lib/mailvorlagen'

/** Basis-URL der App für Links in E-Mails (Reset, Invite, Public-Dispo). */
export function appBaseUrl() {
  return appBasisUrl()
}

/**
 * Dezenter Fußbereich unter jeder E-Mail. Trägt die Signatur des Projekts,
 * wenn eine hinterlegt ist, sonst nur den Hinweis auf die App.
 */
export async function emailFooter(projectId?: number | null) {
  let signatur = ''
  if (projectId) {
    const eigen = (await db.get(
      'SELECT signature, footer_note FROM email_identities WHERE project_id = ?',
      [projectId]
    )) as any
    if (eigen?.signature) {
      signatur = `<div style="margin-top:24px;font-size:13px;color:#4b5563;white-space:pre-line;">${saeubereHtml(
        eigen.signature
      )}</div>`
    }
    if (eigen?.footer_note) {
      signatur += `<div style="margin-top:8px;font-size:12px;color:#9ca3af;">${saeubereHtml(eigen.footer_note)}</div>`
    }
  }
  return `${signatur}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;">
      Erstellt mit <a href="${appBasisUrl()}" style="color:#0a84ff;text-decoration:none;">CutSheet</a>
      - Produktionsmanagement f&uuml;r Filmteams
    </div>`
}

export type SendeErgebnis = {
  /** Wie viele Mails tatsächlich an den Mailserver übergeben wurden. */
  sent: number
  /** Wie viele in der Warteschlange liegen (später oder geplant). */
  queued: number
  /** Wie viele nicht versendet werden konnten, weil kein Mailserver da ist. */
  ohneVersand: number
  /** Ob überhaupt ein Mailserver eingerichtet ist. */
  configured: boolean
}

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  projectId?: number | null
  attachments?: Array<{ filename: string; content: Buffer }>
  includeFooter?: boolean
  anlass?: Anlass
  bezugId?: number | null
  erstelltVon?: number | null
  geplantFuer?: Date | null
  mitQuittung?: boolean
}): Promise<SendeErgebnis> {
  const adressen = Array.isArray(opts.to) ? opts.to : [opts.to]
  const fuss = opts.includeFooter === false ? '' : await emailFooter(opts.projectId)
  const html = opts.html + fuss

  const eingereiht = await reiheEin({
    projectId: opts.projectId ?? null,
    betreff: opts.subject,
    html,
    empfaenger: adressen.map((email) => ({ email })),
    anlass: opts.anlass ?? 'system',
    bezugId: opts.bezugId ?? null,
    geplantFuer: opts.geplantFuer ?? null,
    erstelltVon: opts.erstelltVon ?? null,
    mitQuittung: opts.mitQuittung,
    anhang: opts.attachments?.[0]
      ? { dateiname: opts.attachments[0].filename, inhalt: opts.attachments[0].content }
      : null,
  })

  // Altes Protokoll weiterführen: die Oberfläche "Mail-Verlauf" liest es,
  // und ein Umzug der Altdaten wäre mehr Risiko als Nutzen.
  if (opts.projectId) {
    await db.run(
      'INSERT INTO email_log (project_id, subject, recipients, body, sent_at) VALUES (?, ?, ?, ?, NOW())',
      [opts.projectId, opts.subject, JSON.stringify(adressen), html]
    )
  }

  if (opts.geplantFuer) {
    return { sent: 0, queued: eingereiht.length, ohneVersand: 0, configured: smtpEingerichtet() }
  }

  const lauf = await sendeFaellige(Math.max(eingereiht.length, 10))
  return {
    sent: lauf.gesendet,
    queued: Math.max(eingereiht.length - lauf.gesendet - lauf.ohneVersand, 0),
    ohneVersand: lauf.ohneVersand,
    configured: smtpEingerichtet(),
  }
}

export function isSmtpConfigured() {
  return smtpEingerichtet()
}
