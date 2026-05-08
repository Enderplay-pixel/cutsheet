import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/crew
router.get('/projects/:projectId/crew', (req, res) => {
  const crew = db.prepare('SELECT * FROM crew WHERE project_id = ? ORDER BY department ASC, sort_order ASC, name ASC').all(req.params.projectId)
  res.json({ data: crew, error: null })
})

// POST /api/projects/:projectId/crew
router.post('/projects/:projectId/crew', (req, res) => {
  const { name = '', department = '', role = '', email = '', phone = '', fee_per_day = 0, contract_type = 'Tagesgage', availability_notes = '', notes = '' } = req.body
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM crew WHERE project_id = ? AND department = ?').get(req.params.projectId, department) as any).m
  const result = db.prepare(`
    INSERT INTO crew (project_id, name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.projectId, name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, maxSort + 1)
  res.status(201).json({ data: db.prepare('SELECT * FROM crew WHERE id = ?').get(result.lastInsertRowid), error: null })
})

// PUT /api/crew/:id
router.put('/crew/:id', (req, res) => {
  const { name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes } = req.body
  db.prepare(`
    UPDATE crew SET name=?, department=?, role=?, email=?, phone=?, fee_per_day=?, contract_type=?, availability_notes=?, notes=?
    WHERE id=?
  `).run(name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, req.params.id)
  res.json({ data: db.prepare('SELECT * FROM crew WHERE id = ?').get(req.params.id), error: null })
})

// DELETE /api/crew/:id
router.delete('/crew/:id', (req, res) => {
  db.prepare('DELETE FROM crew WHERE id = ?').run(req.params.id)
  res.json({ data: { ok: true }, error: null })
})

export default router
