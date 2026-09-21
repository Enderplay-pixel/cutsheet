import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import { clampPosition, normalizeRotation, clampSize, renderFloorplanHtml } from '../lib/floorplan'
import { generatePdf } from './pdf'

const router = Router()

router.use('/projects/:projectId', requireMember)

const uploadsDir = path.join(__dirname, '../../uploads/floorplans')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    // Zeitstempel voran, damit zwei gleichnamige Grundrisse sich nicht überschreiben
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, '_')}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Nur Bilder: Der Grundriss wird als Hintergrund gezeichnet, alles andere
    // ergäbe im Plan und im PDF eine leere Fläche
    cb(null, /^image\//.test(file.mimetype))
  },
})

/** Plan laden und Projektzugriff prüfen. */
async function loadPlan(req: Request, res: Response): Promise<any | null> {
  const user = (req as any).user
  if (!user) { res.status(401).json({ data: null, error: 'Nicht authentifiziert' }); return null }

  const plan = await db.get(`
    SELECT f.*, p.title as project_title, s.scene_number, l.name as location_name
    FROM floorplans f
    JOIN projects p ON f.project_id = p.id
    LEFT JOIN scenes s ON f.scene_id = s.id
    LEFT JOIN locations l ON f.location_id = l.id
    WHERE f.id = ?
  `, [req.params.planId]) as any

  if (!plan) { res.status(404).json({ data: null, error: 'Set-Plan nicht gefunden' }); return null }
  if (user.role !== 'admin' && (await getUserProjectRole(user.id, plan.project_id)) === null) {
    res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    return null
  }
  return plan
}

const loadItems = (planId: number | string) =>
  db.all('SELECT * FROM floorplan_items WHERE floorplan_id = ? ORDER BY sort_order ASC, id ASC', [planId]) as Promise<any[]>

// ─── Pläne ────────────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/floorplans
router.get('/projects/:projectId/floorplans', async (req, res) => {
  const plans = await db.all(`
    SELECT f.*, s.scene_number, l.name as location_name,
           (SELECT COUNT(*) FROM floorplan_items i WHERE i.floorplan_id = f.id) as item_count
    FROM floorplans f
    LEFT JOIN scenes s ON f.scene_id = s.id
    LEFT JOIN locations l ON f.location_id = l.id
    WHERE f.project_id = ?
    ORDER BY f.id DESC
  `, [req.params.projectId])
  res.json({ data: plans, error: null })
})

// POST /api/projects/:projectId/floorplans
router.post('/projects/:projectId/floorplans', async (req, res) => {
  const { name = '', scene_id = null, location_id = null, notes = '' } = req.body
  const result = await db.run(
    'INSERT INTO floorplans (project_id, name, scene_id, location_id, notes) VALUES (?, ?, ?, ?, ?)',
    [req.params.projectId, String(name).trim() || 'Neuer Set-Plan', scene_id || null, location_id || null, notes]
  )
  res.status(201).json({ data: await db.get('SELECT * FROM floorplans WHERE id = ?', [result.id]), error: null })
})

// GET /api/floorplans/:planId
router.get('/floorplans/:planId', requireMemberVia(projectIdFromTable('floorplans', 'planId')), async (req, res) => {
  const plan = await loadPlan(req, res)
  if (!plan) return
  res.json({ data: { plan, items: await loadItems(plan.id) }, error: null })
})

// PUT /api/floorplans/:planId
router.put('/floorplans/:planId', async (req, res) => {
  if (!await loadPlan(req, res)) return

  const sets: string[] = []
  const params: any[] = []
  for (const f of ['name', 'notes'] as const) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]) }
  }
  for (const f of ['scene_id', 'location_id'] as const) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f] || null) }
  }
  if (sets.length === 0) return res.status(400).json({ data: null, error: 'Keine Felder zum Aktualisieren' })

  params.push(req.params.planId)
  await db.run(`UPDATE floorplans SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, params)
  res.json({ data: await db.get('SELECT * FROM floorplans WHERE id = ?', [req.params.planId]), error: null })
})

// DELETE /api/floorplans/:planId
router.delete('/floorplans/:planId', async (req, res) => {
  const plan = await loadPlan(req, res)
  if (!plan) return

  // Auch das Hintergrundbild wegräumen, sonst sammeln sich Waisen im Upload-Ordner
  if (plan.image_url) {
    const file = path.join(uploadsDir, path.basename(plan.image_url))
    try { if (fs.existsSync(file)) fs.unlinkSync(file) } catch { /* nicht schlimm */ }
  }
  await db.run('DELETE FROM floorplans WHERE id = ?', [req.params.planId])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/floorplans/:planId/image
router.post('/floorplans/:planId/image', upload.single('image'), async (req, res) => {
  const plan = await loadPlan(req, res)
  if (!plan) return
  if (!req.file) return res.status(400).json({ data: null, error: 'Kein Bild hochgeladen (nur Bilddateien)' })

  // Vorheriges Bild ersetzen, nicht anhäufen
  if (plan.image_url) {
    const old = path.join(uploadsDir, path.basename(plan.image_url))
    try { if (fs.existsSync(old)) fs.unlinkSync(old) } catch { /* nicht schlimm */ }
  }

  const url = `/uploads/floorplans/${req.file.filename}`
  await db.run('UPDATE floorplans SET image_url = ?, updated_at = NOW() WHERE id = ?', [url, plan.id])
  res.json({ data: { image_url: url }, error: null })
})

// ─── Elemente ─────────────────────────────────────────────────────────────────

// POST /api/floorplans/:planId/items
router.post('/floorplans/:planId/items', async (req, res) => {
  const plan = await loadPlan(req, res)
  if (!plan) return

  const { kind = 'kamera', label = '', notes = '' } = req.body
  const { x, y } = clampPosition(req.body.x, req.body.y)
  const maxRow = await db.get(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM floorplan_items WHERE floorplan_id = ?', [plan.id]
  ) as { m: number }

  const result = await db.run(
    'INSERT INTO floorplan_items (floorplan_id, project_id, kind, label, x, y, rotation, size, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [plan.id, plan.project_id, kind, label, x, y, normalizeRotation(req.body.rotation), clampSize(req.body.size), notes, maxRow.m + 1]
  )
  res.status(201).json({ data: await db.get('SELECT * FROM floorplan_items WHERE id = ?', [result.id]), error: null })
})

/** Element laden und Zugriff prüfen. */
async function loadItem(req: Request, res: Response): Promise<any | null> {
  const user = (req as any).user
  if (!user) { res.status(401).json({ data: null, error: 'Nicht authentifiziert' }); return null }

  const item = await db.get('SELECT * FROM floorplan_items WHERE id = ?', [req.params.itemId]) as any
  if (!item) { res.status(404).json({ data: null, error: 'Element nicht gefunden' }); return null }
  if (user.role !== 'admin' && (await getUserProjectRole(user.id, item.project_id)) === null) {
    res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    return null
  }
  return item
}

// PUT /api/floorplan-items/:itemId
router.put('/floorplan-items/:itemId', async (req, res) => {
  if (!await loadItem(req, res)) return

  const sets: string[] = []
  const params: any[] = []

  for (const f of ['kind', 'label', 'notes'] as const) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]) }
  }
  if (req.body.x !== undefined || req.body.y !== undefined) {
    const item = await db.get('SELECT x, y FROM floorplan_items WHERE id = ?', [req.params.itemId]) as any
    const { x, y } = clampPosition(req.body.x ?? item.x, req.body.y ?? item.y)
    sets.push('x = ?', 'y = ?')
    params.push(x, y)
  }
  if (req.body.rotation !== undefined) { sets.push('rotation = ?'); params.push(normalizeRotation(req.body.rotation)) }
  if (req.body.size !== undefined) { sets.push('size = ?'); params.push(clampSize(req.body.size)) }

  if (sets.length === 0) return res.status(400).json({ data: null, error: 'Keine Felder zum Aktualisieren' })

  params.push(req.params.itemId)
  await db.run(`UPDATE floorplan_items SET ${sets.join(', ')} WHERE id = ?`, params)
  res.json({ data: await db.get('SELECT * FROM floorplan_items WHERE id = ?', [req.params.itemId]), error: null })
})

// DELETE /api/floorplan-items/:itemId
router.delete('/floorplan-items/:itemId', async (req, res) => {
  if (!await loadItem(req, res)) return
  await db.run('DELETE FROM floorplan_items WHERE id = ?', [req.params.itemId])
  res.json({ data: { ok: true }, error: null })
})

// ─── PDF ──────────────────────────────────────────────────────────────────────

// GET /api/floorplans/:planId/pdf
router.get('/floorplans/:planId/pdf', async (req, res) => {
  const plan = await loadPlan(req, res)
  if (!plan) return

  // Bild als Daten-URI einbetten: Der Druck läuft in einem eigenen Browser
  // ohne Sitzung und ohne Basis-URL, ein Link auf /uploads/... bliebe leer.
  let dataUri: string | null = null
  if (plan.image_url) {
    try {
      const file = path.join(uploadsDir, path.basename(plan.image_url))
      if (fs.existsSync(file)) {
        const ext = path.extname(file).toLowerCase().replace('.', '') || 'png'
        const mime = ext === 'jpg' ? 'jpeg' : ext
        dataUri = `data:image/${mime};base64,${fs.readFileSync(file).toString('base64')}`
      }
    } catch (err: any) {
      console.warn('[floorplan/pdf] Bild nicht lesbar:', err?.message)
    }
  }

  const html = renderFloorplanHtml(plan, await loadItems(plan.id), dataUri)

  try {
    const pdf = await generatePdf(html, {
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      landscape: true,
      footer: false,
    })
    const slug = String(plan.name || 'set-plan').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="set-plan-${slug}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

export default router
