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

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  projectId?: number
}) {
  const transporter = getTransporter()
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to]
  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'CutSheet <noreply@cutsheet.app>',
      to: recipients.join(', '),
      subject: opts.subject,
      html: opts.html,
    })
  }
  // Always log
  if (opts.projectId) {
    await db.run(
      'INSERT INTO email_log (project_id, subject, recipients, body, sent_at) VALUES (?, ?, ?, ?, NOW())',
      [opts.projectId, opts.subject, JSON.stringify(recipients), opts.html]
    )
  }
  return { sent: !!transporter, logged: true }
}

export function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}
