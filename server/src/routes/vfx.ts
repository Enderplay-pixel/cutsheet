import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { istIsoDatum } from '../lib/datum'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// Fehler gehen an den Übersetzer (middleware/eingabe.ts) - vorher fing jede
// Route sie selbst ab und meldete auch eine falsche Eingabe als 500.

/** Deadline: leer oder ein echtes Datum. Die Spalte ist Text, gemessen am 25.10.2026 stand dort "morgen". */
const deadlineFalsch = (wert: unknown) =>
  wert !== undefined && wert !== null && wert !== '' && !istIsoDatum(wert)

// GET /api/projects/:projectId/vfx
// Mit der Szenennummer: scene_id ist die Kennung der Szene, nicht ihre Nummer.
router.get('/projects/:projectId/vfx', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const rows = await db.all(
    `SELECT v.*, s.scene_number
       FROM vfx_shots v
       LEFT JOIN scenes s ON s.id = v.scene_id
      WHERE v.project_id = ?
      ORDER BY v.id ASC`,
    [projectId]
  )
  return res.json({ data: rows, error: null })
})

// POST /api/projects/:projectId/vfx
router.post('/projects/:projectId/vfx', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const {
    scene_id = null,
    shot_number = '',
    description = '',
    vfx_type = 'Compositing',
    status = 'Offen',
    artist = '',
    deadline = null,
    complexity = 'Mittel',
    notes = '',
  } = req.body as {
    scene_id?: number | null
    shot_number?: string
    description?: string
    vfx_type?: string
    status?: string
    artist?: string
    deadline?: string | null
    complexity?: string
    notes?: string
  }
  if (deadlineFalsch(deadline)) return res.status(400).json({ data: null, error: 'deadline ist ein Datum (JJJJ-MM-TT)' })
  // Nur eine Szene aus diesem Projekt
  if (scene_id) {
    const szene = await db.get('SELECT id FROM scenes WHERE id = ? AND project_id = ?', [scene_id, projectId])
    if (!szene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  }
  const result = await db.run(`
    INSERT INTO vfx_shots (project_id, scene_id, shot_number, description, vfx_type, status, artist, deadline, complexity, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, scene_id || null, shot_number, description, vfx_type, status, artist, deadline, complexity, notes])
  const row = await db.get('SELECT * FROM vfx_shots WHERE id = ?', [result.id])
  return res.status(201).json({ data: row, error: null })
})

// PUT /api/projects/:projectId/vfx/:id
router.put('/projects/:projectId/vfx/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur eine Zeile aus dem Projekt im Pfad. Sonst ließ sich über eine
  // fremde Kennung die Zeile eines anderen Projekts ändern und auslesen.
  const existing = await db.get('SELECT * FROM vfx_shots WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (!existing) return res.status(404).json({ data: null, error: 'VFX-Shot nicht gefunden' })

  const {
    scene_id,
    shot_number,
    description,
    vfx_type,
    status,
    artist,
    deadline,
    complexity,
    notes,
  } = req.body as {
    scene_id?: number | null
    shot_number?: string
    description?: string
    vfx_type?: string
    status?: string
    artist?: string
    deadline?: string | null
    complexity?: string
    notes?: string
  }
  if (deadlineFalsch(deadline)) return res.status(400).json({ data: null, error: 'deadline ist ein Datum (JJJJ-MM-TT)' })

  // Nur eine Szene aus diesem Projekt
  if (scene_id) {
    const szene = await db.get('SELECT id FROM scenes WHERE id = ? AND project_id = ?', [scene_id, Number(req.params.projectId)])
    if (!szene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  }
  // scene_id null löst die Szene. Mit COALESCE wie die übrigen Felder ließ sie
  // sich nicht mehr lösen (gemessen am 25.10.2026).
  const szeneNeu = req.body && 'scene_id' in req.body ? (scene_id || null) : existing.scene_id

  await db.run(`
    UPDATE vfx_shots SET
      scene_id = ?,
      shot_number = COALESCE(?, shot_number),
      description = COALESCE(?, description),
      vfx_type = COALESCE(?, vfx_type),
      status = COALESCE(?, status),
      artist = COALESCE(?, artist),
      deadline = COALESCE(?, deadline),
      complexity = COALESCE(?, complexity),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `, [
    szeneNeu,
    shot_number ?? null,
    description ?? null,
    vfx_type ?? null,
    status ?? null,
    artist ?? null,
    deadline ?? null,
    complexity ?? null,
    notes ?? null,
    id
  ])

  const row = await db.get('SELECT * FROM vfx_shots WHERE id = ?', [id])
  return res.json({ data: row, error: null })
})

// DELETE /api/projects/:projectId/vfx/:id
router.delete('/projects/:projectId/vfx/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur aus dem Projekt im Pfad: sonst löschte eine fremde Kennung im fremden Projekt
  const result = await db.run('DELETE FROM vfx_shots WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (result.changes === 0) return res.status(404).json({ data: null, error: 'VFX-Shot nicht gefunden' })
  return res.json({ data: { id }, error: null })
})

export default router
