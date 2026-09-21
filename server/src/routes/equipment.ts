import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/equipment-lists
router.get('/projects/:projectId/equipment-lists', async (req, res) => {
  const lists = await db.all('SELECT * FROM equipment_lists WHERE project_id = ? ORDER BY department ASC, name ASC', [req.params.projectId])
  res.json({ data: lists, error: null })
})

// POST /api/projects/:projectId/equipment-lists
router.post('/projects/:projectId/equipment-lists', async (req, res) => {
  const { name = '', department = '', shoot_day_id = null, notes = '' } = req.body
  const result = await db.run('INSERT INTO equipment_lists (project_id, name, department, shoot_day_id, notes) VALUES (?, ?, ?, ?, ?)', [req.params.projectId, name, department, shoot_day_id, notes])
  res.status(201).json({ data: await db.get('SELECT * FROM equipment_lists WHERE id = ?', [result.id]), error: null })
})

// GET /api/equipment-lists/:id/items
router.get('/equipment-lists/:id/items', requireMemberVia(projectIdFromTable('equipment_lists', 'id')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const list = await db.get('SELECT project_id FROM equipment_lists WHERE id = ?', [req.params.id]) as any
    if (list && (await getUserProjectRole(user.id, list.project_id)) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const items = await db.all('SELECT * FROM equipment_items WHERE equipment_list_id = ? ORDER BY sort_order ASC', [req.params.id])
  const parsed = (items as any[]).map(i => ({ ...i, checked: !!i.checked }))
  res.json({ data: parsed, error: null })
})

// POST /api/equipment-lists/:id/items
router.post('/equipment-lists/:id/items', async (req, res) => {
  const { item = '', quantity = 1, supplier = '', rental_per_day_cents = 0, total_days = 1, notes = '' } = req.body
  const total_cents = rental_per_day_cents * total_days * quantity
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM equipment_items WHERE equipment_list_id = ?', [req.params.id])
  const maxSort = (maxSortRow as any).m
  const result = await db.run('INSERT INTO equipment_items (equipment_list_id, item, quantity, supplier, rental_per_day_cents, total_days, total_cents, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.id, item, quantity, supplier, rental_per_day_cents, total_days, total_cents, notes, maxSort + 1])
  const row = await db.get('SELECT * FROM equipment_items WHERE id = ?', [result.id]) as any
  res.status(201).json({ data: { ...row, checked: !!row.checked }, error: null })
})

// PUT /api/equipment-items/:id
router.put('/equipment-items/:id', async (req, res) => {
  const { item, quantity, supplier, rental_per_day_cents, total_days, checked, notes } = req.body
  const total_cents = (rental_per_day_cents || 0) * (total_days || 1) * (quantity || 1)
  await db.run('UPDATE equipment_items SET item=?, quantity=?, supplier=?, rental_per_day_cents=?, total_days=?, total_cents=?, checked=?, notes=? WHERE id=?', [item, quantity, supplier, rental_per_day_cents, total_days, total_cents, checked ? 1 : 0, notes, req.params.id])
  const row = await db.get('SELECT * FROM equipment_items WHERE id = ?', [req.params.id]) as any
  res.json({ data: { ...row, checked: !!row.checked }, error: null })
})

// DELETE /api/equipment-items/:id
router.delete('/equipment-items/:id', async (req, res) => {
  await db.run('DELETE FROM equipment_items WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
