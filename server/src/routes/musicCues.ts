import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/music-cues
router.get('/projects/:projectId/music-cues', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = await db.all('SELECT * FROM music_cues WHERE project_id = ? ORDER BY sort_order ASC, id ASC', [projectId])
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[music-cues GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/music-cues
router.post('/projects/:projectId/music-cues', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const {
      scene_id = null,
      title = '',
      composer = '',
      publisher = '',
      duration_seconds = 0,
      cue_type = 'Original',
      usage_type = 'Unterlegt',
      lyrics_author = '',
      notes = '',
      sort_order = 0,
    } = req.body as {
      scene_id?: number | null
      title?: string
      composer?: string
      publisher?: string
      duration_seconds?: number
      cue_type?: string
      usage_type?: string
      lyrics_author?: string
      notes?: string
      sort_order?: number
    }
    const result = await db.run(`
      INSERT INTO music_cues (project_id, scene_id, title, composer, publisher, duration_seconds, cue_type, usage_type, lyrics_author, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, scene_id, title, composer, publisher, duration_seconds, cue_type, usage_type, lyrics_author, notes, sort_order])
    const row = await db.get('SELECT * FROM music_cues WHERE id = ?', [result.id])
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[music-cues POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/music-cues/:id
router.put('/projects/:projectId/music-cues/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await db.get('SELECT * FROM music_cues WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ data: null, error: 'Music-Cue nicht gefunden' })

    const {
      scene_id,
      title,
      composer,
      publisher,
      duration_seconds,
      cue_type,
      usage_type,
      lyrics_author,
      notes,
      sort_order,
    } = req.body as {
      scene_id?: number | null
      title?: string
      composer?: string
      publisher?: string
      duration_seconds?: number
      cue_type?: string
      usage_type?: string
      lyrics_author?: string
      notes?: string
      sort_order?: number
    }

    await db.run(`
      UPDATE music_cues SET
        scene_id = COALESCE(?, scene_id),
        title = COALESCE(?, title),
        composer = COALESCE(?, composer),
        publisher = COALESCE(?, publisher),
        duration_seconds = COALESCE(?, duration_seconds),
        cue_type = COALESCE(?, cue_type),
        usage_type = COALESCE(?, usage_type),
        lyrics_author = COALESCE(?, lyrics_author),
        notes = COALESCE(?, notes),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `, [
      scene_id ?? null,
      title ?? null,
      composer ?? null,
      publisher ?? null,
      duration_seconds ?? null,
      cue_type ?? null,
      usage_type ?? null,
      lyrics_author ?? null,
      notes ?? null,
      sort_order ?? null,
      id
    ])

    const row = await db.get('SELECT * FROM music_cues WHERE id = ?', [id])
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[music-cues PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/music-cues/:id
router.delete('/projects/:projectId/music-cues/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = await db.run('DELETE FROM music_cues WHERE id = ?', [id])
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Music-Cue nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[music-cues DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
