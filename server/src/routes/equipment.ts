import { Router } from 'express'
import { db } from '../db'

const router = Router()

// GET /api/projects/:projectId/equipment-lists
router.get('/projects/:projectId/equipment-lists', (req, res) => {
  const lists = db.prepare('SELECT * FROM equipment_lists WHERE project_id = ? ORDER BY department ASC, name ASC').all(req.params.projectId)
  res.json({ data: lists, error: null })
})

// POST /api/projects/:projectId/equipment-lists
router.post('/projects/:projectId/equipment-lists', (req, res) => {
  const { name = '', department = '', shoot_day_id = null, notes = '' } = req.body
  const result = db.prepare('INSERT INTO equipment_lists (project_id, name, department, shoot_day_id, notes) VALUES (?, ?, ?, ?, ?)').run(req.params.projectId, name, department, shoot_day_id, notes)
  res.status(201).json({ data: db.prepare('SELECT * FROM equipment_lists WHERE id = ?').get(result.lastInsertRowid), error: null })
})

// GET /api/equipment-lists/:id/items
router.get('/equipment-lists/:id/items', (req, res) => {
  const items = db.prepare('SELECT * FROM equipment_items WHERE equipment_list_id = ? ORDER BY sort_order ASC').all(req.params.id)
  const parsed = (items as any[]).map(i => ({ ...i, checked: !!i.checked }))
  res.json({ data: parsed, error: null })
})

// POST /api/equipment-lists/:id/items
router.post('/equipment-lists/:id/items', (req, res) => {
  const { item = '', quantity = 1, supplier = '', rental_per_day_cents = 0, total_days = 1, notes = '' } = req.body
  const total_cents = rental_per_day_cents * total_days * quantity
  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM equipment_items WHERE equipment_list_id = ?').get(req.params.id) as any).m
  const result = db.prepare('INSERT INTO equipment_items (equipment_list_id, item, quantity, supplier, rental_per_day_cents, total_days, total_cents, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.id, item, quantity, supplier, rental_per_day_cents, total_days, total_cents, notes, maxSort + 1)
  const row = db.prepare('SELECT * FROM equipment_items WHERE id = ?').get(result.lastInsertRowid) as any
  res.status(201).json({ data: { ...row, checked: !!row.checked }, error: null })
})

// PUT /api/equipment-items/:id
router.put('/equipment-items/:id', (req, res) => {
  const { item, quantity, supplier, rental_per_day_cents, total_days, checked, notes } = req.body
  const total_cents = (rental_per_day_cents || 0) * (total_days || 1) * (quantity || 1)
  db.prepare('UPDATE equipment_items SET item=?, quantity=?, supplier=?, rental_per_day_cents=?, total_days=?, total_cents=?, checked=?, notes=? WHERE id=?').run(item, quantity, supplier, rental_per_day_cents, total_days, total_cents, checked ? 1 : 0, notes, req.params.id)
  const row = db.prepare('SELECT * FROM equipment_items WHERE id = ?').get(req.params.id) as any
  res.json({ data: { ...row, checked: !!row.checked }, error: null })
})

// DELETE /api/equipment-items/:id
router.delete('/equipment-items/:id', (req, res) => {
  db.prepare('DELETE FROM equipment_items WHERE id = ?').run(req.params.id)
  res.json({ data: { ok: true }, error: null })
})

export default router
