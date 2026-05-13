import { Router, Request, Response } from 'express'
import { db } from '../db'

const router = Router()

// 1x1 transparent PNG
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

// POST /api/call-sheet-entries/:id/confirm  (no auth — public link)
router.post('/call-sheet-entries/:id/confirm', async (req: Request, res: Response) => {
  const entryId = parseInt(req.params.id)

  const entry = await db.get('SELECT * FROM call_sheet_entries WHERE id = ?', [entryId])
  if (!entry) {
    return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  }

  await db.run(
    "UPDATE call_sheet_entries SET confirmed_at = NOW() WHERE id = ?",
    [entryId]
  )

  const updated = await db.get('SELECT * FROM call_sheet_entries WHERE id = ?', [entryId])
  return res.json({ data: updated, error: null })
})

// GET /api/call-sheet-entries/:id/track.png  (no auth — email tracking pixel)
router.get('/call-sheet-entries/:id/track.png', async (req: Request, res: Response) => {
  const entryId = parseInt(req.params.id)

  // Only set viewed_at the first time
  const entry = await db.get('SELECT id, viewed_at FROM call_sheet_entries WHERE id = ?', [entryId])
  if (entry && !entry.viewed_at) {
    await db.run(
      "UPDATE call_sheet_entries SET viewed_at = NOW() WHERE id = ?",
      [entryId]
    )
  }

  res.set('Content-Type', 'image/png')
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  return res.send(TRACKING_PIXEL)
})

export default router
