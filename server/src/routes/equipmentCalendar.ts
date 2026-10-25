import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { istIsoDatum } from '../lib/datum'

// Die Spalten sind Text - gemessen am 25.10.2026 nahm der Server "abc" an.
const DATUM_FEHLER = 'start_date und end_date sind ein Datum (JJJJ-MM-TT)'

/** Dasselbe Gerät: gleicher Posten, oder ohne Posten derselbe Name. */
function gleichesGeraet(a: any, b: any): boolean {
  if (a.equipment_item_id || b.equipment_item_id) return a.equipment_item_id === b.equipment_item_id
  const name = (x: any) => String(x.item_name || '').trim().toLowerCase()
  return name(a) !== '' && name(a) === name(b)
}

const router = Router()

router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/equipment-bookings?item_id=X
router.get('/projects/:projectId/equipment-bookings', async (req: Request, res: Response) => {
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
})

// GET /api/projects/:projectId/equipment-bookings/conflicts
// Must be declared BEFORE /:id routes to avoid ambiguity
router.get('/projects/:projectId/equipment-bookings/conflicts', async (req: Request, res: Response) => {
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

      // Nur dasselbe Gerät. Vorher galten zwei Buchungen ohne Posten immer als
      // dasselbe (null === null): gemessen "Kran / Dolly" als Konflikt.
      if (!gleichesGeraet(a, b)) continue

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
})

// POST /api/projects/:projectId/equipment-bookings
router.post('/projects/:projectId/equipment-bookings', async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const { equipment_item_id, item_name = '', start_date, end_date, notes = '' } = req.body

  if (!start_date || !end_date) {
    return res.status(400).json({ data: null, error: 'start_date und end_date sind erforderlich' })
  }
  if (!istIsoDatum(start_date) || !istIsoDatum(end_date)) {
    return res.status(400).json({ data: null, error: DATUM_FEHLER })
  }
  if (end_date < start_date) {
    return res.status(400).json({ data: null, error: 'end_date darf nicht vor start_date liegen' })
  }
  // Nur ein Equipment-Posten aus diesem Projekt
  if (equipment_item_id) {
    const posten = await db.get(
      'SELECT ei.id FROM equipment_items ei JOIN equipment_lists el ON ei.equipment_list_id = el.id WHERE ei.id = ? AND el.project_id = ?',
      [equipment_item_id, projectId]
    )
    if (!posten) return res.status(404).json({ data: null, error: 'Equipment-Posten nicht gefunden' })
  }

  const result = await db.run(`
    INSERT INTO equipment_bookings (project_id, equipment_item_id, item_name, start_date, end_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [projectId, equipment_item_id ?? null, item_name, start_date, end_date, notes])

  const row = await db.get('SELECT * FROM equipment_bookings WHERE id = ?', [result.id])
  res.status(201).json({ data: row, error: null })
})

// PUT /api/equipment-bookings/:id
router.put('/equipment-bookings/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const { equipment_item_id, item_name, start_date, end_date, notes } = req.body

  // Gemessen am 25.10.2026: Eine Buchung, die es nicht gibt, ergab 200 ohne Daten.
  const vorher = (await db.get('SELECT start_date, end_date FROM equipment_bookings WHERE id = ?', [req.params.id])) as any
  if (!vorher) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  if ((start_date != null && !istIsoDatum(start_date)) || (end_date != null && !istIsoDatum(end_date))) {
    return res.status(400).json({ data: null, error: DATUM_FEHLER })
  }
  // Gegen das, was nach dem Ändern dasteht - auch wenn nur ein Datum kommt
  if ((end_date ?? vorher.end_date) < (start_date ?? vorher.start_date)) {
    return res.status(400).json({ data: null, error: 'end_date darf nicht vor start_date liegen' })
  }
  // Nur ein Equipment-Posten aus dem Projekt dieser Buchung
  if (equipment_item_id) {
    const posten = await db.get(
      `SELECT ei.id FROM equipment_items ei JOIN equipment_lists el ON ei.equipment_list_id = el.id
         JOIN equipment_bookings b ON b.project_id = el.project_id WHERE ei.id = ? AND b.id = ?`,
      [equipment_item_id, req.params.id]
    )
    if (!posten) return res.status(404).json({ data: null, error: 'Equipment-Posten nicht gefunden' })
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
})

// DELETE /api/equipment-bookings/:id
router.delete('/equipment-bookings/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  await db.run('DELETE FROM equipment_bookings WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
