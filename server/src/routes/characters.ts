import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/characters
router.get('/projects/:projectId/characters', (req, res) => {
  const chars = db.prepare('SELECT * FROM characters WHERE project_id = ? ORDER BY sort_order ASC, name ASC').all(req.params.projectId)
  res.json({ data: chars, error: null })
})

// POST /api/projects/:projectId/characters
router.post('/projects/:projectId/characters', (req, res) => {
  const { name = '', description = '', age_range = '', gender = '' } = req.body
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM characters WHERE project_id = ?').get(req.params.projectId) as any).m
  const result = db.prepare('INSERT INTO characters (project_id, name, description, age_range, gender, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.projectId, name, description, age_range, gender, maxSort + 1)
  res.status(201).json({ data: db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid), error: null })
})

// PUT /api/characters/:id
router.put('/characters/:id', (req, res) => {
  const { name, description, age_range, gender, sort_order } = req.body
  db.prepare('UPDATE characters SET name=?, description=?, age_range=?, gender=?, sort_order=COALESCE(?,sort_order) WHERE id=?').run(name, description, age_range, gender, sort_order ?? null, req.params.id)
  res.json({ data: db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id), error: null })
})

// DELETE /api/characters/:id
router.delete('/characters/:id', (req, res) => {
  db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id)
  res.json({ data: { ok: true }, error: null })
})

// GET /api/projects/:projectId/cast
router.get('/projects/:projectId/cast', (req, res) => {
  const cast = db.prepare(`
    SELECT c.*, ch.name as character_name
    FROM cast c
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE c.project_id = ?
    ORDER BY ch.sort_order ASC, c.actor_name ASC
  `).all(req.params.projectId)
  res.json({ data: cast, error: null })
})

// POST /api/projects/:projectId/cast
router.post('/projects/:projectId/cast', (req, res) => {
  const { character_id = null, actor_name = '', email = '', phone = '', agent = '', agent_email = '', agency = '', fee_per_day = 0, contract_type = 'Tagesgage', availability_notes = '', notes = '' } = req.body
  const result = db.prepare(`
    INSERT INTO cast (project_id, character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.projectId, character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes)

  const row = db.prepare('SELECT c.*, ch.name as character_name FROM cast c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?').get(result.lastInsertRowid)
  res.status(201).json({ data: row, error: null })
})

// PUT /api/cast/:id
router.put('/cast/:id', (req, res) => {
  const { character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes } = req.body
  db.prepare(`
    UPDATE cast SET character_id=?, actor_name=?, email=?, phone=?, agent=?, agent_email=?, agency=?, fee_per_day=?, contract_type=?, availability_notes=?, notes=?
    WHERE id=?
  `).run(character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes, req.params.id)
  const row = db.prepare('SELECT c.*, ch.name as character_name FROM cast c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?').get(req.params.id)
  res.json({ data: row, error: null })
})

// DELETE /api/cast/:id
router.delete('/cast/:id', (req, res) => {
  db.prepare('DELETE FROM cast WHERE id = ?').run(req.params.id)
  res.json({ data: { ok: true }, error: null })
})

export default router
