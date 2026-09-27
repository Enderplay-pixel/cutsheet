import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { sendEmail, isSmtpConfigured } from './emailService'

const router = Router()

// POST /api/projects/:pid/email/send
router.post('/projects/:pid/email/send', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const { subject, recipients, html, text } = req.body

  if (!subject || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ data: null, error: 'subject und recipients sind erforderlich' })
  }

  let htmlBody: string
  if (html) {
    htmlBody = html
  } else if (text) {
    htmlBody = `<pre style="font-family: sans-serif; white-space: pre-wrap;">${text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre>`
  } else {
    return res.status(400).json({ data: null, error: 'html oder text ist erforderlich' })
  }

  try {
    const result = await sendEmail({
      to: recipients,
      subject,
      html: htmlBody,
      projectId,
    })
    return res.json({ data: result, error: null })
  } catch (err: any) {
    return res.status(500).json({ data: null, error: err.message || 'E-Mail konnte nicht gesendet werden' })
  }
})

// GET /api/projects/:pid/email/status
router.get('/projects/:pid/email/status', async (_req: Request, res: Response) => {
  return res.json({
    data: {
      configured: isSmtpConfigured(),
      smtp_host: process.env.SMTP_HOST || null,
    },
    error: null,
  })
})

// POST /api/projects/:pid/email/test
router.post('/projects/:pid/email/test', requireAuth, async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const user = req.user!

  if (!user.email) {
    return res.status(400).json({ data: null, error: 'Keine E-Mail-Adresse für den Benutzer hinterlegt' })
  }

  try {
    const result = await sendEmail({
      to: user.email,
      subject: 'CutSheet - Test-E-Mail',
      html: `<h2>Test-E-Mail von CutSheet</h2><p>Hallo ${user.name},</p><p>Die E-Mail-Konfiguration funktioniert korrekt.</p><p>- CutSheet</p>`,
      projectId,
    })
    return res.json({ data: result, error: null })
  } catch (err: any) {
    return res.status(500).json({ data: null, error: err.message || 'Test-E-Mail konnte nicht gesendet werden' })
  }
})

export default router
