import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// Fehler gehen an den Übersetzer (middleware/eingabe.ts) - vorher fing jede
// Route sie selbst ab und meldete auch eine falsche Eingabe als 500.

// GET /api/projects/:projectId/music-cues
// Mit der Szenennummer: scene_id ist die Kennung der Szene, nicht ihre Nummer.
router.get('/projects/:projectId/music-cues', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const rows = await db.all(
    `SELECT m.*, s.scene_number
       FROM music_cues m
       LEFT JOIN scenes s ON s.id = m.scene_id
      WHERE m.project_id = ?
      ORDER BY m.sort_order ASC, m.id ASC`,
    [projectId]
  )
  return res.json({ data: rows, error: null })
})

// POST /api/projects/:projectId/music-cues
router.post('/projects/:projectId/music-cues', requireAuth, async (req: Request, res: Response) => {
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
  // Nur eine Szene aus diesem Projekt
  if (scene_id) {
    const szene = await db.get('SELECT id FROM scenes WHERE id = ? AND project_id = ?', [scene_id, projectId])
    if (!szene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  }
  const result = await db.run(`
    INSERT INTO music_cues (project_id, scene_id, title, composer, publisher, duration_seconds, cue_type, usage_type, lyrics_author, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, scene_id || null, title, composer, publisher, duration_seconds, cue_type, usage_type, lyrics_author, notes, sort_order])
  const row = await db.get('SELECT * FROM music_cues WHERE id = ?', [result.id])
  return res.status(201).json({ data: row, error: null })
})

// PUT /api/projects/:projectId/music-cues/:id
router.put('/projects/:projectId/music-cues/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur eine Zeile aus dem Projekt im Pfad. Sonst ließ sich über eine
  // fremde Kennung die Zeile eines anderen Projekts ändern und auslesen.
  const existing = await db.get('SELECT * FROM music_cues WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
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

  // Nur eine Szene aus diesem Projekt
  if (scene_id) {
    const szene = await db.get('SELECT id FROM scenes WHERE id = ? AND project_id = ?', [scene_id, Number(req.params.projectId)])
    if (!szene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  }
  // scene_id null löst die Szene. Mit COALESCE wie die übrigen Felder ließ sie
  // sich nicht mehr lösen (gemessen am 25.10.2026).
  const szeneNeu = req.body && 'scene_id' in req.body ? (scene_id || null) : existing.scene_id

  await db.run(`
    UPDATE music_cues SET
      scene_id = ?,
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
    szeneNeu,
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
})

// DELETE /api/projects/:projectId/music-cues/:id
router.delete('/projects/:projectId/music-cues/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur aus dem Projekt im Pfad: sonst löschte eine fremde Kennung im fremden Projekt
  const result = await db.run('DELETE FROM music_cues WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (result.changes === 0) return res.status(404).json({ data: null, error: 'Music-Cue nicht gefunden' })
  return res.json({ data: { id }, error: null })
})

export default router
