import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { loeschePersonenspuren } from '../lib/person'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/characters
router.get('/projects/:projectId/characters', async (req, res) => {
  const chars = await db.all('SELECT * FROM characters WHERE project_id = ? ORDER BY sort_order ASC, name ASC', [req.params.projectId])
  res.json({ data: chars, error: null })
})

// POST /api/projects/:projectId/characters
router.post('/projects/:projectId/characters', async (req, res) => {
  const { name = '', description = '', age_range = '', gender = '' } = req.body
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM characters WHERE project_id = ?', [req.params.projectId])
  const maxSort = (maxSortRow as any).m
  const result = await db.run('INSERT INTO characters (project_id, name, description, age_range, gender, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [req.params.projectId, name, description, age_range, gender, maxSort + 1])
  res.status(201).json({ data: await db.get('SELECT * FROM characters WHERE id = ?', [result.id]), error: null })
})

// PUT /api/characters/:id
router.put('/characters/:id', async (req, res) => {
  const { name, description, age_range, gender, sort_order } = req.body
  await db.run('UPDATE characters SET name=?, description=?, age_range=?, gender=?, sort_order=COALESCE(?,sort_order) WHERE id=?', [name, description, age_range, gender, sort_order ?? null, req.params.id])
  res.json({ data: await db.get('SELECT * FROM characters WHERE id = ?', [req.params.id]), error: null })
})

// DELETE /api/characters/:id
router.delete('/characters/:id', async (req, res) => {
  await db.run('DELETE FROM characters WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// GET /api/projects/:projectId/cast
router.get('/projects/:projectId/cast', async (req, res) => {
  const cast = await db.all(`
    SELECT c.*, ch.name as character_name
    FROM cast c
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE c.project_id = ?
    ORDER BY ch.sort_order ASC, c.actor_name ASC
  `, [req.params.projectId])
  res.json({ data: cast, error: null })
})

// POST /api/projects/:projectId/cast
router.post('/projects/:projectId/cast', async (req, res) => {
  const { character_id = null, actor_name = '', email = '', phone = '', agent = '', agent_email = '', agency = '', fee_per_day = 0, contract_type = 'Tagesgage', availability_notes = '', notes = '' } = req.body
  const result = await db.run(`
    INSERT INTO cast (project_id, character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.projectId, character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes])

  const row = await db.get('SELECT c.*, ch.name as character_name FROM cast c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?', [result.id])
  res.status(201).json({ data: row, error: null })
})

// PUT /api/cast/:id
router.put('/cast/:id', async (req, res) => {
  const { character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes } = req.body
  await db.run(`
    UPDATE cast SET character_id=?, actor_name=?, email=?, phone=?, agent=?, agent_email=?, agency=?, fee_per_day=?, contract_type=?, availability_notes=?, notes=?
    WHERE id=?
  `, [character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes, req.params.id])
  const row = await db.get('SELECT c.*, ch.name as character_name FROM cast c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?', [req.params.id])
  res.json({ data: row, error: null })
})

// DELETE /api/cast/:id
router.delete('/cast/:id', async (req, res) => {
  await loeschePersonenspuren('cast', req.params.id)
  await db.run('DELETE FROM cast WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
