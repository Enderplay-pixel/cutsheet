import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { loeschePersonenspuren } from '../lib/person'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/crew
router.get('/projects/:projectId/crew', async (req, res) => {
  const crew = await db.all('SELECT * FROM crew WHERE project_id = ? ORDER BY department ASC, sort_order ASC, name ASC', [req.params.projectId])
  res.json({ data: crew, error: null })
})

// POST /api/projects/:projectId/crew
router.post('/projects/:projectId/crew', async (req, res) => {
  const { name = '', department = '', role = '', email = '', phone = '', fee_per_day = 0, contract_type = 'Tagesgage', availability_notes = '', notes = '' } = req.body
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM crew WHERE project_id = ? AND department = ?', [req.params.projectId, department]) as any
  const maxSort = maxSortRow.m
  const result = await db.run(`
    INSERT INTO crew (project_id, name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.projectId, name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, maxSort + 1])
  res.status(201).json({ data: await db.get('SELECT * FROM crew WHERE id = ?', [result.id]), error: null })
})

// PUT /api/crew/:id
router.put('/crew/:id', async (req, res) => {
  const { name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes } = req.body
  await db.run(`
    UPDATE crew SET name=?, department=?, role=?, email=?, phone=?, fee_per_day=?, contract_type=?, availability_notes=?, notes=?
    WHERE id=?
  `, [name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, req.params.id])
  res.json({ data: await db.get('SELECT * FROM crew WHERE id = ?', [req.params.id]), error: null })
})

// DELETE /api/crew/:id
router.delete('/crew/:id', async (req, res) => {
  await loeschePersonenspuren('crew', req.params.id)
  await db.run('DELETE FROM crew WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
