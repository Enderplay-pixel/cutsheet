import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

// GET /api/projects/:projectId/vehicles
router.get('/projects/:projectId/vehicles', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const rows = await db.all('SELECT * FROM vehicles WHERE project_id = ? ORDER BY id ASC', [projectId])
    return res.json({ data: rows, error: null })
  } catch (err) {
    console.error('[vehicles GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/vehicles
router.post('/projects/:projectId/vehicles', requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const {
      name = '',
      license_plate = '',
      type = 'PKW',
      capacity = 4,
      driver_name = '',
      driver_phone = '',
      notes = '',
    } = req.body as {
      name?: string
      license_plate?: string
      type?: string
      capacity?: number
      driver_name?: string
      driver_phone?: string
      notes?: string
    }
    const result = await db.run(`
      INSERT INTO vehicles (project_id, name, license_plate, type, capacity, driver_name, driver_phone, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, name, license_plate, type, capacity, driver_name, driver_phone, notes])
    const row = await db.get('SELECT * FROM vehicles WHERE id = ?', [result.id])
    return res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[vehicles POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/projects/:projectId/vehicles/:id
router.put('/projects/:projectId/vehicles/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const existing = await db.get('SELECT * FROM vehicles WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ data: null, error: 'Fahrzeug nicht gefunden' })

    const {
      name,
      license_plate,
      type,
      capacity,
      driver_name,
      driver_phone,
      notes,
    } = req.body as {
      name?: string
      license_plate?: string
      type?: string
      capacity?: number
      driver_name?: string
      driver_phone?: string
      notes?: string
    }

    await db.run(`
      UPDATE vehicles SET
        name = COALESCE(?, name),
        license_plate = COALESCE(?, license_plate),
        type = COALESCE(?, type),
        capacity = COALESCE(?, capacity),
        driver_name = COALESCE(?, driver_name),
        driver_phone = COALESCE(?, driver_phone),
        notes = COALESCE(?, notes)
      WHERE id = ?
    `, [name ?? null, license_plate ?? null, type ?? null, capacity ?? null, driver_name ?? null, driver_phone ?? null, notes ?? null, id])

    const row = await db.get('SELECT * FROM vehicles WHERE id = ?', [id])
    return res.json({ data: row, error: null })
  } catch (err) {
    console.error('[vehicles PUT]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/projects/:projectId/vehicles/:id
router.delete('/projects/:projectId/vehicles/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = await db.run('DELETE FROM vehicles WHERE id = ?', [id])
    if (result.changes === 0) return res.status(404).json({ data: null, error: 'Fahrzeug nicht gefunden' })
    return res.json({ data: { id }, error: null })
  } catch (err) {
    console.error('[vehicles DELETE]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
