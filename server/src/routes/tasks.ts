import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// Aufgabenmanagement mit Abnahmeschleife (PreProducer-Parität):
// offen → in_arbeit → abnahme → erledigt
const VALID_STATUS = ['offen', 'in_arbeit', 'abnahme', 'erledigt']

// GET /api/projects/:projectId/tasks
router.get('/projects/:projectId/tasks', requireAuth, requireMember, async (req: Request, res: Response) => {
  const rows = await db.all(
    `SELECT t.*, u.name as created_by_name FROM project_tasks t
     LEFT JOIN users u ON t.created_by = u.id
     WHERE t.project_id = ?
     ORDER BY CASE t.status WHEN 'erledigt' THEN 1 ELSE 0 END, t.due_date NULLS LAST, t.sort_order, t.id`,
    [req.params.projectId]
  )
  return res.json({ data: rows, error: null })
})

// POST /api/projects/:projectId/tasks
router.post('/projects/:projectId/tasks', requireAuth, requireMember, async (req: Request, res: Response) => {
  const { title, description, department, assignee, due_date, status } = req.body as Record<string, string | undefined>
  if (!title?.trim()) return res.status(400).json({ data: null, error: 'Titel erforderlich' })

  const result = await db.run(
    `INSERT INTO project_tasks (project_id, title, description, department, assignee, due_date, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.projectId, title.trim(), description || '', department || '', assignee || '',
     due_date || null, VALID_STATUS.includes(String(status)) ? status : 'offen', req.user!.id]
  )
  const task = await db.get('SELECT * FROM project_tasks WHERE id = ?', [result.id])
  return res.status(201).json({ data: task, error: null })
})

// PUT /api/tasks/:id
router.put('/tasks/:id', requireAuth, async (req: Request, res: Response) => {
  const existing = await db.get('SELECT * FROM project_tasks WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Aufgabe nicht gefunden' })

  const { title, description, department, assignee, due_date, status } = req.body as Record<string, string | undefined>
  const newStatus = VALID_STATUS.includes(String(status)) ? String(status) : existing.status
  const completedAt = newStatus === 'erledigt'
    ? (existing.completed_at || new Date())
    : null

  await db.run(
    `UPDATE project_tasks SET title = ?, description = ?, department = ?, assignee = ?, due_date = ?, status = ?, completed_at = ?
     WHERE id = ?`,
    [title?.trim() || existing.title, description ?? existing.description, department ?? existing.department,
     assignee ?? existing.assignee, due_date !== undefined ? (due_date || null) : existing.due_date,
     newStatus, completedAt, req.params.id]
  )
  const task = await db.get('SELECT * FROM project_tasks WHERE id = ?', [req.params.id])
  return res.json({ data: task, error: null })
})

// DELETE /api/tasks/:id
router.delete('/tasks/:id', requireAuth, async (req: Request, res: Response) => {
  await db.run('DELETE FROM project_tasks WHERE id = ?', [req.params.id])
  return res.json({ data: { ok: true }, error: null })
})

export default router
