import { Router } from 'express'
import { db } from '../db'

const router = Router()

// GET /api/projects/:projectId/scenes
router.get('/projects/:projectId/scenes', (req, res) => {
  const scenes = db.prepare(`
    SELECT s.*, l.name as location_name
    FROM scenes s
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE s.project_id = ?
    ORDER BY s.sort_order ASC, s.scene_number ASC
  `).all(req.params.projectId)

  const scenesWithDetails = (scenes as any[]).map(scene => {
    const characters = db.prepare(`
      SELECT sc.*, c.name as character_name
      FROM scene_characters sc
      JOIN characters c ON sc.character_id = c.id
      WHERE sc.scene_id = ?
    `).all(scene.id)
    const inventory = db.prepare('SELECT * FROM scene_inventory WHERE scene_id = ?').all(scene.id)
    return { ...scene, characters, inventory }
  })

  res.json({ data: scenesWithDetails, error: null })
})

// POST /api/projects/:projectId/scenes
router.post('/projects/:projectId/scenes', (req, res) => {
  const { scene_number = '', title = '', description = '', location_id = null, int_ext = 'INT', day_night = 'TAG', eighths = 8, estimated_minutes = 60, notes = '' } = req.body
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?').get(req.params.projectId) as any).m
  const result = db.prepare(`
    INSERT INTO scenes (project_id, scene_number, sort_order, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.projectId, scene_number, maxSort + 1, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes)

  const scene = db.prepare('SELECT *, null as location_name FROM scenes WHERE id = ?').get(result.lastInsertRowid)
  // Auto-create an empty action block so the scene shows up in the screenplay editor
  db.prepare(`INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content) VALUES (?, ?, 0, 'action', '')`)
    .run(result.lastInsertRowid, req.params.projectId)
  res.status(201).json({ data: { ...scene as object, characters: [], inventory: [] }, error: null })
})

// PUT /api/scenes/:id
router.put('/scenes/:id', (req, res) => {
  const { scene_number, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes, sort_order, shot_status } = req.body
  db.prepare(`
    UPDATE scenes SET scene_number=?, title=?, description=?, location_id=?, int_ext=?, day_night=?, eighths=?, estimated_minutes=?, notes=?, sort_order=COALESCE(?,sort_order), shot_status=COALESCE(?,shot_status), updated_at=datetime('now')
    WHERE id=?
  `).run(scene_number, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes, sort_order ?? null, shot_status ?? null, req.params.id)

  const scene = db.prepare(`
    SELECT s.*, l.name as location_name FROM scenes s LEFT JOIN locations l ON s.location_id = l.id WHERE s.id = ?
  `).get(req.params.id)
  const characters = db.prepare(`SELECT sc.*, c.name as character_name FROM scene_characters sc JOIN characters c ON sc.character_id = c.id WHERE sc.scene_id = ?`).all(req.params.id)
  const inventory = db.prepare('SELECT * FROM scene_inventory WHERE scene_id = ?').all(req.params.id)
  res.json({ data: { ...scene as object, characters, inventory }, error: null })
})

// DELETE /api/scenes/:id
router.delete('/scenes/:id', (req, res) => {
  db.prepare('DELETE FROM scenes WHERE id = ?').run(req.params.id)
  res.json({ data: { ok: true }, error: null })
})

// POST /api/scenes/:id/characters
router.post('/scenes/:id/characters', (req, res) => {
  const { character_id, role_in_scene = '' } = req.body
  db.prepare('INSERT OR IGNORE INTO scene_characters (scene_id, character_id, role_in_scene) VALUES (?, ?, ?)').run(req.params.id, character_id, role_in_scene)
  const chars = db.prepare(`SELECT sc.*, c.name as character_name FROM scene_characters sc JOIN characters c ON sc.character_id = c.id WHERE sc.scene_id = ?`).all(req.params.id)
  res.json({ data: chars, error: null })
})

// DELETE /api/scenes/:id/characters/:characterId
router.delete('/scenes/:id/characters/:characterId', (req, res) => {
  db.prepare('DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?').run(req.params.id, req.params.characterId)
  res.json({ data: { ok: true }, error: null })
})

// POST /api/scenes/:id/inventory
router.post('/scenes/:id/inventory', (req, res) => {
  const { item, category = 'Requisite', quantity = 1, notes = '' } = req.body
  const result = db.prepare('INSERT INTO scene_inventory (scene_id, item, category, quantity, notes) VALUES (?, ?, ?, ?, ?)').run(req.params.id, item, category, quantity, notes)
  const row = db.prepare('SELECT * FROM scene_inventory WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ data: row, error: null })
})

// DELETE /api/scenes/:id/inventory/:itemId
router.delete('/scenes/:id/inventory/:itemId', (req, res) => {
  db.prepare('DELETE FROM scene_inventory WHERE id = ? AND scene_id = ?').run(req.params.itemId, req.params.id)
  res.json({ data: { ok: true }, error: null })
})

// POST /api/projects/:projectId/scenes/import
router.post('/projects/:projectId/scenes/import', (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ data: null, error: 'Kein Text angegeben' })

  const lines = (text as string).split('\n').filter((l: string) => l.trim())
  const sceneRegex = /^(\d+[A-Z]?)\s+(INT|EXT|INT\/EXT)[\s.]+(.+?)\s+(TAG|NACHT|DÄMMERUNG|MORGEN)/i

  const created: any[] = []
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?').get(req.params.projectId) as any).m

  lines.forEach((line: string, i: number) => {
    const match = line.match(sceneRegex)
    if (match) {
      const [, num, intExt, title, dayNight] = match
      const result = db.prepare(`
        INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.params.projectId, num, maxSort + 1 + i, title.trim(), intExt.toUpperCase(), dayNight.toUpperCase())
      created.push(db.prepare('SELECT * FROM scenes WHERE id = ?').get(result.lastInsertRowid))
    }
  })

  res.json({ data: created, error: null })
})

export default router
