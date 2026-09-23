import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/scenes
router.get('/projects/:projectId/scenes', async (req, res) => {
  const scenes = await db.all(`
    SELECT s.*, l.name as location_name
    FROM scenes s
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE s.project_id = ?
    ORDER BY s.sort_order ASC, s.scene_number ASC
  `, [req.params.projectId])

  const scenesWithDetails = await Promise.all((scenes as any[]).map(async scene => {
    const characters = await db.all(`
      SELECT sc.*, c.name as character_name
      FROM scene_characters sc
      JOIN characters c ON sc.character_id = c.id
      WHERE sc.scene_id = ?
    `, [scene.id])
    const inventory = await db.all('SELECT * FROM scene_inventory WHERE scene_id = ?', [scene.id])
    return { ...scene, characters, inventory }
  }))

  res.json({ data: scenesWithDetails, error: null })
})

// POST /api/projects/:projectId/scenes
router.post('/projects/:projectId/scenes', async (req, res) => {
  const { scene_number = '', title = '', description = '', location_id = null, int_ext = 'INT', day_night = 'TAG', eighths = 8, estimated_minutes = 60, notes = '' } = req.body
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?', [req.params.projectId])
  const maxSort = (maxSortRow as any).m
  const result = await db.run(`
    INSERT INTO scenes (project_id, scene_number, sort_order, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.projectId, scene_number, maxSort + 1, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes])

  const scene = await db.get('SELECT *, null as location_name FROM scenes WHERE id = ?', [result.id])
  // Auto-create an empty action block so the scene shows up in the screenplay editor
  await db.run(`INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content) VALUES (?, ?, 0, 'action', '')`,
    [result.id, req.params.projectId])
  res.status(201).json({ data: { ...scene as object, characters: [], inventory: [] }, error: null })
})

// PUT /api/scenes/:id
router.put('/scenes/:id', async (req, res) => {
  const { scene_number, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes, sort_order, shot_status, updated_at } = req.body

  // Optimistisches Sperren. Ohne das ueberschreibt der zweite Speichervorgang
  // den ersten stillschweigend: nachgemessen am 23.09.2026 - A aenderte den
  // Titel, B die Notizen auf altem Stand, danach war A's Titel weg und niemand
  // hat es gemerkt. Wer kein updated_at mitschickt, wird nicht geprueft, damit
  // Aufrufe ohne Vorlesen weiter funktionieren.
  if (updated_at) {
    const stand = await db.get('SELECT updated_at FROM scenes WHERE id = ?', [req.params.id]) as any
    if (!stand) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
    const gespeichert = new Date(stand.updated_at).getTime()
    const mitgebracht = new Date(updated_at).getTime()
    // Eine Sekunde Spielraum: manche Treiber runden Zeitstempel.
    if (Number.isFinite(gespeichert) && Number.isFinite(mitgebracht)
        && gespeichert - mitgebracht > 1000) {
      return res.status(409).json({
        data: null,
        error: 'Diese Szene wurde inzwischen von jemand anderem geändert. Bitte neu laden.',
      })
    }
  }

  await db.run(`
    UPDATE scenes SET scene_number=?, title=?, description=?, location_id=?, int_ext=?, day_night=?, eighths=?, estimated_minutes=?, notes=?, sort_order=COALESCE(?,sort_order), shot_status=COALESCE(?,shot_status), updated_at=datetime('now')
    WHERE id=?
  `, [scene_number, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes, sort_order ?? null, shot_status ?? null, req.params.id])

  const scene = await db.get(`
    SELECT s.*, l.name as location_name FROM scenes s LEFT JOIN locations l ON s.location_id = l.id WHERE s.id = ?
  `, [req.params.id])
  const characters = await db.all(`SELECT sc.*, c.name as character_name FROM scene_characters sc JOIN characters c ON sc.character_id = c.id WHERE sc.scene_id = ?`, [req.params.id])
  const inventory = await db.all('SELECT * FROM scene_inventory WHERE scene_id = ?', [req.params.id])
  res.json({ data: { ...scene as object, characters, inventory }, error: null })
})

// DELETE /api/scenes/:id
router.delete('/scenes/:id', async (req, res) => {
  await db.run('DELETE FROM scenes WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/scenes/:id/characters
router.post('/scenes/:id/characters', async (req, res) => {
  const { character_id, role_in_scene = '' } = req.body
  await db.run('INSERT INTO scene_characters (scene_id, character_id, role_in_scene) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [req.params.id, character_id, role_in_scene])
  const chars = await db.all(`SELECT sc.*, c.name as character_name FROM scene_characters sc JOIN characters c ON sc.character_id = c.id WHERE sc.scene_id = ?`, [req.params.id])
  res.json({ data: chars, error: null })
})

// DELETE /api/scenes/:id/characters/:characterId
router.delete('/scenes/:id/characters/:characterId', async (req, res) => {
  await db.run('DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?', [req.params.id, req.params.characterId])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/scenes/:id/inventory
router.post('/scenes/:id/inventory', async (req, res) => {
  const { item, category = 'Requisite', quantity = 1, notes = '' } = req.body
  const result = await db.run('INSERT INTO scene_inventory (scene_id, item, category, quantity, notes) VALUES (?, ?, ?, ?, ?)', [req.params.id, item, category, quantity, notes])
  const row = await db.get('SELECT * FROM scene_inventory WHERE id = ?', [result.id])
  res.status(201).json({ data: row, error: null })
})

// DELETE /api/scenes/:id/inventory/:itemId
router.delete('/scenes/:id/inventory/:itemId', async (req, res) => {
  await db.run('DELETE FROM scene_inventory WHERE id = ? AND scene_id = ?', [req.params.itemId, req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/projects/:projectId/scenes/import
router.post('/projects/:projectId/scenes/import', async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ data: null, error: 'Kein Text angegeben' })

  const lines = (text as string).split('\n').filter((l: string) => l.trim())
  const sceneRegex = /^(\d+[A-Z]?)\s+(INT|EXT|INT\/EXT)[\s.]+(.+?)\s+(TAG|NACHT|DÄMMERUNG|MORGEN)/i

  const created: any[] = []
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?', [req.params.projectId])
  const maxSort = (maxSortRow as any).m

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(sceneRegex)
    if (match) {
      const [, num, intExt, title, dayNight] = match
      const result = await db.run(`
        INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [req.params.projectId, num, maxSort + 1 + i, title.trim(), intExt.toUpperCase(), dayNight.toUpperCase()])
      created.push(await db.get('SELECT * FROM scenes WHERE id = ?', [result.id]))
    }
  }

  res.json({ data: created, error: null })
})

export default router
