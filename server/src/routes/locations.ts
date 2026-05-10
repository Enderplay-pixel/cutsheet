import { Router } from 'express'
import { db } from '../db'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

const uploadsDir = path.join(__dirname, '../../uploads/locations')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// GET /api/projects/:projectId/locations
router.get('/projects/:projectId/locations', async (req, res) => {
  const locs = await db.all('SELECT * FROM locations WHERE project_id = ? ORDER BY name ASC', [req.params.projectId])
  const parsed = (locs as any[]).map(l => ({ ...l, photos: JSON.parse(l.photos || '[]'), power_available: !!l.power_available }))
  res.json({ data: parsed, error: null })
})

// POST /api/projects/:projectId/locations
router.post('/projects/:projectId/locations', async (req, res) => {
  const { name = '', address = '', city = '', zip = '', country = 'Deutschland', lat = null, lng = null,
    contact_name = '', contact_phone = '', contact_email = '', rental_fee = 0, parking_info = '', power_available = false, notes = '' } = req.body
  const result = await db.run(`
    INSERT INTO locations (project_id, name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.projectId, name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available ? 1 : 0, notes])
  const row = await db.get('SELECT * FROM locations WHERE id = ?', [result.id]) as any
  res.status(201).json({ data: { ...row, photos: [], power_available: !!row.power_available }, error: null })
})

// PUT /api/locations/:id
router.put('/locations/:id', async (req, res) => {
  const { name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available, notes } = req.body
  await db.run(`
    UPDATE locations SET name=?, address=?, city=?, zip=?, country=?, lat=?, lng=?, contact_name=?, contact_phone=?, contact_email=?, rental_fee=?, parking_info=?, power_available=?, notes=?
    WHERE id=?
  `, [name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available ? 1 : 0, notes, req.params.id])
  const row = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  res.json({ data: { ...row, photos: JSON.parse(row.photos || '[]'), power_available: !!row.power_available }, error: null })
})

// DELETE /api/locations/:id
router.delete('/locations/:id', async (req, res) => {
  await db.run('DELETE FROM locations WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/locations/:id/photos
router.post('/locations/:id/photos', upload.single('photo'), async (req, res) => {
  const loc = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  if (!loc) return res.status(404).json({ data: null, error: 'Location nicht gefunden' })
  if (!req.file) return res.status(400).json({ data: null, error: 'Kein Foto hochgeladen' })

  const photos = JSON.parse(loc.photos || '[]')
  photos.push(`/uploads/locations/${req.file.filename}`)
  await db.run('UPDATE locations SET photos = ? WHERE id = ?', [JSON.stringify(photos), req.params.id])
  res.json({ data: { photos }, error: null })
})

export default router
