import nodemailer from 'nodemailer'
import { db } from '../db'

function getTransporter() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

/** Basis-URL der App für Links in E-Mails (Reset, Invite, Public-Dispo). */
export function appBaseUrl() {
  return (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
}

/** Dezenter Footer unter jeder E-Mail - der Viral-Grundstein. */
export function emailFooter() {
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;">
      Erstellt mit <a href="${appBaseUrl()}" style="color:#b45309;text-decoration:none;">CutSheet</a>
      &mdash; kostenloses Produktionsmanagement f&uuml;r Filmteams
    </div>`
}

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  projectId?: number
  attachments?: Array<{ filename: string; content: Buffer }>
  includeFooter?: boolean
}) {
  const transporter = getTransporter()
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to]
  const html = opts.includeFooter === false ? opts.html : opts.html + emailFooter()
  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'CutSheet <noreply@cutsheet.app>',
      to: recipients.join(', '),
      subject: opts.subject,
      html,
      attachments: opts.attachments,
    })
  }
  // Always log
  if (opts.projectId) {
    await db.run(
      'INSERT INTO email_log (project_id, subject, recipients, body, sent_at) VALUES (?, ?, ?, ?, NOW())',
      [opts.projectId, opts.subject, JSON.stringify(recipients), html]
    )
  }
  return { sent: !!transporter, logged: true }
}

export function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}
