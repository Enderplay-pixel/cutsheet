import { Router } from 'express'
import { db } from '../db'
import { getHolidays } from '../services/holidays'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/holidays?year=2026&state=NW
router.get('/projects/:projectId/holidays', (req, res) => {
  const year = parseInt(String(req.query.year)) || new Date().getFullYear()
  const state = String(req.query.state || 'NRW')
  const holidays = getHolidays(year, state)
  res.json({ data: holidays, error: null })
})

// GET /api/projects/:projectId/events
router.get('/projects/:projectId/events', async (req, res) => {
  const events = await db.all('SELECT * FROM project_events WHERE project_id = ? ORDER BY start_date ASC', [req.params.projectId])
  const parsed = (events as any[]).map(e => ({ ...e, all_day: !!e.all_day }))
  res.json({ data: parsed, error: null })
})

// POST /api/projects/:projectId/events
router.post('/projects/:projectId/events', async (req, res) => {
  const { title = '', start_date, end_date = null, type = 'Meeting', color = '#f59e0b', notes = '', all_day = true } = req.body
  const result = await db.run('INSERT INTO project_events (project_id, title, start_date, end_date, type, color, notes, all_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.params.projectId, title, start_date, end_date, type, color, notes, all_day ? 1 : 0])
  const row = await db.get('SELECT * FROM project_events WHERE id = ?', [result.id]) as any
  res.status(201).json({ data: { ...row, all_day: !!row.all_day }, error: null })
})

// PUT /api/events/:id
router.put('/events/:id', async (req, res) => {
  const { title, start_date, end_date, type, color, notes, all_day } = req.body
  await db.run('UPDATE project_events SET title=?, start_date=?, end_date=?, type=?, color=?, notes=?, all_day=? WHERE id=?', [title, start_date, end_date, type, color, notes, all_day ? 1 : 0, req.params.id])
  const row = await db.get('SELECT * FROM project_events WHERE id = ?', [req.params.id]) as any
  res.json({ data: { ...row, all_day: !!row.all_day }, error: null })
})

// DELETE /api/events/:id
router.delete('/events/:id', async (req, res) => {
  await db.run('DELETE FROM project_events WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
