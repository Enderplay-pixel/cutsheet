import { Router, Request, Response } from 'express'
import { randomBytes } from 'crypto'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

// POST /api/projects/:projectId/guest-tokens — create a guest token
router.post('/projects/:projectId/guest-tokens', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const { shoot_day_id, expires_at } = req.body as {
      shoot_day_id?: number
      expires_at?: string
    }

    const token = randomBytes(32).toString('hex')

    const result = await db.run(`
      INSERT INTO guest_tokens (token, project_id, shoot_day_id, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [token, projectId, shoot_day_id ?? null, expires_at ?? null, req.user?.id ?? null])

    const row = await db.get('SELECT * FROM guest_tokens WHERE id = ?', [result.id])
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[guest-tokens POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /api/guest/:token — public endpoint, returns call sheet data
router.get('/guest/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const guestToken = await db.get(`
      SELECT * FROM guest_tokens WHERE token = ?
    `, [token]) as { id: number; project_id: number; shoot_day_id: number | null; expires_at: string | null } | undefined

    if (!guestToken) {
      return res.status(404).json({ data: null, error: 'Ungültiger oder abgelaufener Token' })
    }

    // Check expiry
    if (guestToken.expires_at && new Date(guestToken.expires_at) < new Date()) {
      return res.status(403).json({ data: null, error: 'Token abgelaufen' })
    }

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [guestToken.project_id])
    if (!project) {
      return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })
    }

    // If token is tied to a specific shoot day, return that day's call sheet
    if (guestToken.shoot_day_id) {
      const shootDay = await db.get('SELECT * FROM shoot_days WHERE id = ?', [guestToken.shoot_day_id])
      const callSheet = await db.get('SELECT * FROM call_sheets WHERE shoot_day_id = ?', [guestToken.shoot_day_id])
      const callSheetId = (callSheet as { id: number } | undefined)?.id
      const entries = callSheetId
        ? await db.all('SELECT * FROM call_sheet_entries WHERE call_sheet_id = ? ORDER BY sort_order ASC', [callSheetId])
        : []
      const scenes = await db.all(`
        SELECT s.*, sds.sort_order as day_sort_order, sds.estimated_minutes as day_estimated_minutes
        FROM scenes s
        JOIN shoot_day_scenes sds ON sds.scene_id = s.id
        WHERE sds.shoot_day_id = ?
        ORDER BY sds.sort_order ASC
      `, [guestToken.shoot_day_id])

      return res.json({
        data: { project, shoot_day: shootDay, call_sheet: callSheet, entries, scenes },
        error: null,
      })
    }

    // Otherwise return all shoot days for the project
    const shootDays = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number ASC', [guestToken.project_id])

    return res.json({ data: { project, shoot_days: shootDays }, error: null })
  } catch (err) {
    console.error('[guest-tokens GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
