import { Router } from 'express'
import { db } from '../db'
import { validate } from '../middleware/validate'
import { ProjectSchema } from '../schemas'

const router = Router()

// GET /api/projects
router.get('/', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all()
  res.json({ data: projects, error: null })
})

// POST /api/projects
router.post('/', validate(ProjectSchema), (req, res) => {
  const { title = 'Neues Projekt', genre = '', format = 'Kurzfilm', length_minutes = 0, status = 'Vorproduktion',
    synopsis = '', director = '', producer = '', dop = '', production_company = '', shoot_start = null, shoot_end = null } = req.body

  const result = db.prepare(`
    INSERT INTO projects (title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end)

  const id = result.lastInsertRowid
  db.prepare('INSERT INTO project_settings (project_id) VALUES (?)').run(id)

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  res.status(201).json({ data: project, error: null })
})

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const settings = db.prepare('SELECT * FROM project_settings WHERE project_id = ?').get(req.params.id)
  res.json({ data: { ...project as object, settings }, error: null })
})

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const { title, genre, format, length_minutes, status, synopsis = '', director, producer, dop, production_company, shoot_start, shoot_end } = req.body

  db.prepare(`
    UPDATE projects SET title=?, genre=?, format=?, length_minutes=?, status=?, synopsis=?, director=?, producer=?, dop=?, production_company=?, shoot_start=?, shoot_end=?, updated_at=datetime('now')
    WHERE id=?
  `).run(title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, req.params.id)

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  res.json({ data: project, error: null })
})

// PUT /api/projects/:id/settings
router.put('/:id/settings', (req, res) => {
  const {
    default_call_time = 480,
    default_wrap_time = 1200,
    turnaround_hours = 11,
    currency = 'EUR',
    country = 'Deutschland',
    logo_url = null,
    header_color = '#f59e0b',
  } = req.body

  const existing = db.prepare('SELECT id FROM project_settings WHERE project_id = ?').get(req.params.id)
  if (existing) {
    db.prepare(`
      UPDATE project_settings
      SET default_call_time=?, default_wrap_time=?, turnaround_hours=?, currency=?, country=?, logo_url=?, header_color=?
      WHERE project_id=?
    `).run(default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color, req.params.id)
  } else {
    db.prepare(`
      INSERT INTO project_settings (project_id, default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color)
  }

  const settings = db.prepare('SELECT * FROM project_settings WHERE project_id = ?').get(req.params.id)
  res.json({ data: settings, error: null })
})

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ data: { ok: true }, error: null })
})

// POST /api/projects/:id/duplicate
router.post('/:id/duplicate', (req, res) => {
  const original = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any
  if (!original) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const result = db.prepare(`
    INSERT INTO projects (title, genre, format, length_minutes, status, director, producer, dop, production_company)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `${original.title} (Kopie)`, original.genre, original.format, original.length_minutes,
    'Entwicklung', original.director, original.producer, original.dop, original.production_company
  )

  const newId = result.lastInsertRowid
  db.prepare('INSERT INTO project_settings (project_id) VALUES (?)').run(newId)

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId)
  res.status(201).json({ data: project, error: null })
})

// GET /api/projects/:id/stats
router.get('/:id/stats', (req, res) => {
  const pid = req.params.id

  const total_scenes = (db.prepare('SELECT COUNT(*) as c FROM scenes WHERE project_id = ?').get(pid) as any).c
  const scheduled_scenes = (db.prepare(`
    SELECT COUNT(DISTINCT scene_id) as c FROM shoot_day_scenes sds
    JOIN shoot_days sd ON sds.shoot_day_id = sd.id
    WHERE sd.project_id = ?
  `).get(pid) as any).c
  const total_shoot_days = (db.prepare('SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ?').get(pid) as any).c
  const completed_shoot_days = (db.prepare("SELECT COUNT(*) as c FROM shoot_days WHERE project_id = ? AND status = 'Abgedreht'").get(pid) as any).c
  const total_cast = (db.prepare('SELECT COUNT(*) as c FROM cast WHERE project_id = ?').get(pid) as any).c
  const total_crew = (db.prepare('SELECT COUNT(*) as c FROM crew WHERE project_id = ?').get(pid) as any).c
  const pagesRow = db.prepare('SELECT COALESCE(SUM(eighths), 0) as s FROM scenes WHERE project_id = ?').get(pid) as any
  const budgetRow = db.prepare('SELECT COALESCE(MAX(total_cents), 0) as s FROM budget_versions WHERE project_id = ? AND status = "Aktiv"').get(pid) as any
  const finRow = db.prepare('SELECT COALESCE(MAX(total_cents), 0) as s FROM financing_plan_versions WHERE project_id = ?').get(pid) as any

  const next_shoot_day = db.prepare(`
    SELECT * FROM shoot_days WHERE project_id = ? AND date >= date('now') AND status != 'Ausgefallen'
    ORDER BY date ASC LIMIT 1
  `).get(pid)

  res.json({
    data: {
      total_scenes,
      scheduled_scenes,
      unscheduled_scenes: total_scenes - scheduled_scenes,
      total_shoot_days,
      completed_shoot_days,
      total_pages: pagesRow.s / 8,
      total_cast,
      total_crew,
      budget_total_cents: budgetRow.s,
      financing_total_cents: finRow.s,
      next_shoot_day: next_shoot_day || null,
    },
    error: null,
  })
})

export default router
