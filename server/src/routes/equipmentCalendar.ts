import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/equipment-bookings?item_id=X
router.get('/projects/:projectId/equipment-bookings', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const itemId = req.query.item_id ? Number(req.query.item_id) : null

    let bookings: any[]
    if (itemId) {
      bookings = await db.all(`
        SELECT * FROM equipment_bookings
        WHERE project_id = ? AND equipment_item_id = ?
        ORDER BY start_date ASC
      `, [projectId, itemId]) as any[]
    } else {
      bookings = await db.all(`
        SELECT * FROM equipment_bookings
        WHERE project_id = ?
        ORDER BY start_date ASC
      `, [projectId]) as any[]
    }

    res.json({ data: bookings, error: null })
  } catch (err) {
    console.error('[equipmentCalendar GET]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// GET /api/projects/:projectId/equipment-bookings/conflicts
// Must be declared BEFORE /:id routes to avoid ambiguity
router.get('/projects/:projectId/equipment-bookings/conflicts', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)

    const bookings = await db.all(`
      SELECT * FROM equipment_bookings
      WHERE project_id = ?
      ORDER BY equipment_item_id ASC, start_date ASC
    `, [projectId]) as any[]

    const conflicts: Array<{ booking_a: any; booking_b: any }> = []

    for (let i = 0; i < bookings.length; i++) {
      for (let j = i + 1; j < bookings.length; j++) {
        const a = bookings[i]
        const b = bookings[j]

        // Only compare bookings for the same equipment item
        if (a.equipment_item_id !== b.equipment_item_id) continue

        // Overlap condition: start_a <= end_b AND end_a >= start_b
        const aStart = new Date(a.start_date)
        const aEnd = new Date(a.end_date)
        const bStart = new Date(b.start_date)
        const bEnd = new Date(b.end_date)

        if (aStart <= bEnd && aEnd >= bStart) {
          conflicts.push({ booking_a: a, booking_b: b })
        }
      }
    }

    res.json({ data: conflicts, error: null })
  } catch (err) {
    console.error('[equipmentCalendar GET conflicts]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/:projectId/equipment-bookings
router.post('/projects/:projectId/equipment-bookings', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const { equipment_item_id, item_name = '', start_date, end_date, notes = '' } = req.body

    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date und end_date sind erforderlich' })
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ data: null, error: 'end_date darf nicht vor start_date liegen' })
    }

    const result = await db.run(`
      INSERT INTO equipment_bookings (project_id, equipment_item_id, item_name, start_date, end_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [projectId, equipment_item_id ?? null, item_name, start_date, end_date, notes])

    const row = await db.get('SELECT * FROM equipment_bookings WHERE id = ?', [result.id])
    res.status(201).json({ data: row, error: null })
  } catch (err) {
    console.error('[equipmentCalendar POST]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// PUT /api/equipment-bookings/:id
router.put('/equipment-bookings/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    const { equipment_item_id, item_name, start_date, end_date, notes } = req.body

    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ data: null, error: 'end_date darf nicht vor start_date liegen' })
    }

    await db.run(`
      UPDATE equipment_bookings
      SET equipment_item_id = COALESCE(?, equipment_item_id),
          item_name = COALESCE(?, item_name),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          notes = COALESCE(?, notes)
      WHERE id = ?
    `, [equipment_item_id ?? null, item_name ?? null, start_date ?? null, end_date ?? null, notes ?? null, req.params.id])

    const row = await db.get('SELECT * FROM equipment_bookings WHERE id = ?', [req.params.id])
    res.json({ data: row, error: null })
  } catch (err) {
    console.error('[equipmentCalendar PUT]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// DELETE /api/equipment-bookings/:id
router.delete('/equipment-bookings/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    await db.run('DELETE FROM equipment_bookings WHERE id = ?', [req.params.id])
    res.json({ data: { ok: true }, error: null })
  } catch (err) {
    console.error('[equipmentCalendar DELETE]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
