import { Router, Request, Response } from 'express'
import webpush from 'web-push'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

// Initialise VAPID at module load if keys are present
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@cutsheet.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// POST /api/push/subscribe
router.post('/push/subscribe', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id
  const { endpoint, keys } = req.body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ data: null, error: 'endpoint und keys (p256dh, auth) sind erforderlich' })
  }

  try {
    // Upsert: insert or update if endpoint already exists for this user
    const existing = await db.get(
      'SELECT id FROM push_subscriptions WHERE endpoint = ?',
      [endpoint]
    )
    if (existing) {
      await db.run(
        'UPDATE push_subscriptions SET p256dh = ?, auth = ? WHERE id = ?',
        [keys.p256dh, keys.auth, existing.id]
      )
    } else {
      await db.run(
        'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
        [userId, endpoint, keys.p256dh, keys.auth]
      )
    }
    return res.status(201).json({ data: { subscribed: true }, error: null })
  } catch (err: any) {
    return res.status(500).json({ data: null, error: err.message || 'Fehler beim Speichern der Subscription' })
  }
})

// POST /api/push/unsubscribe
router.post('/push/unsubscribe', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id
  const { endpoint } = req.body

  if (!endpoint) {
    return res.status(400).json({ data: null, error: 'endpoint ist erforderlich' })
  }

  await db.run(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    [userId, endpoint]
  )
  return res.json({ data: { unsubscribed: true }, error: null })
})

// GET /api/push/vapid-public-key
router.get('/push/vapid-public-key', (_req: Request, res: Response) => {
  return res.json({ data: { key: process.env.VAPID_PUBLIC_KEY || null }, error: null })
})

// Helper: send push notification to all subscriptions of a user
export async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string }
) {
  const subscriptions = await db.all(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    [userId]
  )

  const payloadString = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subscriptions.map((sub: any) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadString
      )
    )
  )

  // Clean up expired/invalid subscriptions (410 Gone)
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') {
      const err = result.reason as any
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [subscriptions[i].endpoint])
      }
    }
  }

  return results
}

export default router
