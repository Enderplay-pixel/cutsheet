import { Router, Request, Response } from 'express'
import { db } from '../db'

const router = Router()

async function getReportWithTakes(reportId: number) {
  const report = await db.get('SELECT * FROM camera_reports WHERE id = ?', [reportId])
  if (!report) return null
  const takes = await db.all(
    'SELECT * FROM camera_takes WHERE camera_report_id = ? ORDER BY sort_order ASC, id ASC',
    [reportId]
  )
  return { ...report, takes }
}

// GET /api/shoot-days/:dayId/camera-reports
router.get('/shoot-days/:dayId/camera-reports', async (req: Request, res: Response) => {
  const reports = await db.all(
    'SELECT * FROM camera_reports WHERE shoot_day_id = ? ORDER BY id ASC',
    [req.params.dayId]
  )
  const enriched = await Promise.all(reports.map((r: any) => getReportWithTakes(r.id)))
  return res.json({ data: enriched, error: null })
})

// POST /api/shoot-days/:dayId/camera-reports
router.post('/shoot-days/:dayId/camera-reports', async (req: Request, res: Response) => {
  const { camera = 'A', magazine = '', format = '4K RAW' } = req.body
  const result = await db.run(
    'INSERT INTO camera_reports (shoot_day_id, camera, magazine, format) VALUES (?, ?, ?, ?)',
    [req.params.dayId, camera, magazine, format]
  )
  const report = await getReportWithTakes(result.id)
  return res.status(201).json({ data: report, error: null })
})

// PUT /api/camera-reports/:id
router.put('/camera-reports/:id', async (req: Request, res: Response) => {
  const { camera, magazine, format } = req.body
  const existing = await db.get('SELECT id FROM camera_reports WHERE id = ?', [req.params.id])
  if (!existing) {
    return res.status(404).json({ data: null, error: 'Kamerabericht nicht gefunden' })
  }

  const fields: string[] = []
  const values: any[] = []
  if (camera   !== undefined) { fields.push('camera = ?');   values.push(camera) }
  if (magazine !== undefined) { fields.push('magazine = ?'); values.push(magazine) }
  if (format   !== undefined) { fields.push('format = ?');   values.push(format) }

  if (fields.length > 0) {
    values.push(req.params.id)
    await db.run(`UPDATE camera_reports SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  const report = await getReportWithTakes(parseInt(req.params.id))
  return res.json({ data: report, error: null })
})

// DELETE /api/camera-reports/:id
router.delete('/camera-reports/:id', async (req: Request, res: Response) => {
  const existing = await db.get('SELECT id FROM camera_reports WHERE id = ?', [req.params.id])
  if (!existing) {
    return res.status(404).json({ data: null, error: 'Kamerabericht nicht gefunden' })
  }
  // Takes cascade via FK
  await db.run('DELETE FROM camera_reports WHERE id = ?', [req.params.id])
  return res.json({ data: { deleted: true }, error: null })
})

// POST /api/camera-reports/:reportId/takes
router.post('/camera-reports/:reportId/takes', async (req: Request, res: Response) => {
  const report = await db.get('SELECT id FROM camera_reports WHERE id = ?', [req.params.reportId])
  if (!report) {
    return res.status(404).json({ data: null, error: 'Kamerabericht nicht gefunden' })
  }

  const {
    shot_id = null,
    scene_number = '',
    take_number = 1,
    timecode_in = '',
    timecode_out = '',
    meters = null,
    circle = false,
    false_start = false,
    mute = false,
    directors_cut = false,
    notes = '',
    sort_order = 0,
  } = req.body

  const result = await db.run(
    `INSERT INTO camera_takes
      (camera_report_id, shot_id, scene_number, take_number, timecode_in, timecode_out,
       meters, circle, false_start, mute, directors_cut, notes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.params.reportId, shot_id, scene_number, take_number,
      timecode_in, timecode_out, meters,
      circle, false_start, mute, directors_cut,
      notes, sort_order,
    ]
  )

  const take = await db.get('SELECT * FROM camera_takes WHERE id = ?', [result.id])
  return res.status(201).json({ data: take, error: null })
})

// PUT /api/camera-takes/:id
router.put('/camera-takes/:id', async (req: Request, res: Response) => {
  const existing = await db.get('SELECT id FROM camera_takes WHERE id = ?', [req.params.id])
  if (!existing) {
    return res.status(404).json({ data: null, error: 'Take nicht gefunden' })
  }

  const allowed = [
    'shot_id', 'scene_number', 'take_number', 'timecode_in', 'timecode_out',
    'meters', 'circle', 'false_start', 'mute', 'directors_cut', 'notes', 'sort_order',
  ]
  const fields: string[] = []
  const values: any[] = []

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`)
      values.push(req.body[key])
    }
  }

  if (fields.length > 0) {
    values.push(req.params.id)
    await db.run(`UPDATE camera_takes SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  const take = await db.get('SELECT * FROM camera_takes WHERE id = ?', [req.params.id])
  return res.json({ data: take, error: null })
})

// DELETE /api/camera-takes/:id
router.delete('/camera-takes/:id', async (req: Request, res: Response) => {
  const existing = await db.get('SELECT id FROM camera_takes WHERE id = ?', [req.params.id])
  if (!existing) {
    return res.status(404).json({ data: null, error: 'Take nicht gefunden' })
  }
  await db.run('DELETE FROM camera_takes WHERE id = ?', [req.params.id])
  return res.json({ data: { deleted: true }, error: null })
})

export default router
