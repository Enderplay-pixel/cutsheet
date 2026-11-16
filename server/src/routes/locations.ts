import { Router } from 'express'
import { db } from '../db'
import multer from 'multer'
import { requireMember } from '../middleware/projectAuth'

import { speichereDatei, MAX_BYTES } from '../lib/dateien'
import { alsMotivname } from '../lib/motive'
import { KEIN_DREHTAG_SQL } from '../lib/drehtage'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// In den Arbeitsspeicher, nicht auf die Platte - siehe lib/dateien.ts.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } })

// GET /api/projects/:projectId/locations - mit Sets, Zahl der Szenen und
// Drehtage, Vertragsstand und Genehmigungen je Motiv (AP C3)
router.get('/projects/:projectId/locations', async (req, res) => {
  const pid = req.params.projectId
  const locs = await db.all('SELECT * FROM locations WHERE project_id = ? ORDER BY name ASC', [pid]) as any[]
  const ids = locs.map((l) => l.id)
  const [sets, szenen, tage, vertraege, genehmigungen] = ids.length ? await Promise.all([
    db.all(`SELECT st.*, (SELECT COUNT(*) FROM scenes s WHERE s.set_id = st.id AND NOT s.omitted) AS szenen
              FROM location_sets st WHERE st.location_id = ANY(?::int[]) ORDER BY st.sort_order, st.id`, [ids]),
    db.all('SELECT location_id, COUNT(*) AS n FROM scenes WHERE location_id = ANY(?::int[]) AND NOT omitted GROUP BY location_id', [ids]),
    db.all(`SELECT s.location_id, COUNT(DISTINCT sd.id) AS n, MIN(sd.date) FILTER (WHERE sd.date <> '') AS erster
              FROM scenes s JOIN shoot_day_scenes sds ON sds.scene_id = s.id JOIN shoot_days sd ON sd.id = sds.shoot_day_id
             WHERE s.location_id = ANY(?::int[]) AND NOT s.omitted AND sd.status NOT IN ${KEIN_DREHTAG_SQL}
             GROUP BY s.location_id`, [ids]),
    db.all('SELECT location_id, status FROM location_releases WHERE location_id = ANY(?::int[])', [ids]),
    db.all('SELECT location_id, status FROM permits WHERE location_id = ANY(?::int[])', [ids]),
  ]) as any[][] : [[], [], [], [], []]
  const parsed = locs.map(l => ({
    ...l, photos: JSON.parse(l.photos || '[]'), power_available: !!l.power_available,
    sets: sets.filter((s) => s.location_id === l.id).map((s) => ({ ...s, szenen: Number(s.szenen) })),
    szenen_anzahl: Number(szenen.find((x) => x.location_id === l.id)?.n ?? 0),
    drehtage_anzahl: Number(tage.find((x) => x.location_id === l.id)?.n ?? 0),
    erster_drehtag: tage.find((x) => x.location_id === l.id)?.erster ?? null,
    vertrag_status: vertraege.find((x) => x.location_id === l.id)?.status ?? null,
    genehmigungen: { anzahl: genehmigungen.filter((g) => g.location_id === l.id).length, liegt_vor: genehmigungen.filter((g) => g.location_id === l.id && g.status === 'liegt vor').length },
  }))
  res.json({ data: parsed, error: null })
})

/** Drehort-Angaben aus der Anfrage (AP C3); was nicht mitkommt, bleibt. */
const DREHORT_TEXTE = ['hospital_name', 'hospital_address', 'hospital_phone', 'basecamp', 'directions'] as const
function drehortAngaben(body: any, vorher: any) {
  const w: Record<string, unknown> = {}
  for (const k of DREHORT_TEXTE) w[k] = body?.[k] === undefined ? String(vorher?.[k] ?? '') : String(body[k] ?? '').trim()
  w.permit_required = body?.permit_required === undefined ? vorher?.permit_required === true : body.permit_required === true
  return w
}

// POST /api/projects/:projectId/locations
router.post('/projects/:projectId/locations', async (req, res) => {
  const { name = '', address = '', city = '', zip = '', country = 'Deutschland', lat = null, lng = null,
    contact_name = '', contact_phone = '', contact_email = '', rental_fee = 0, parking_info = '', power_available = false, notes = '' } = req.body
  const result = await db.run(`
    INSERT INTO locations (project_id, name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.projectId, name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available ? 1 : 0, notes])
  const d = drehortAngaben(req.body, null)
  await db.run('UPDATE locations SET hospital_name = ?, hospital_address = ?, hospital_phone = ?, basecamp = ?, directions = ?, permit_required = ? WHERE id = ?',
    [d.hospital_name, d.hospital_address, d.hospital_phone, d.basecamp, d.directions, d.permit_required, result.id])
  const row = await db.get('SELECT * FROM locations WHERE id = ?', [result.id]) as any
  res.status(201).json({ data: { ...row, photos: [], power_available: !!row.power_available, sets: [] }, error: null })
})

// PUT /api/locations/:id
router.put('/locations/:id', async (req, res) => {
  // Gemessen am 25.10.2026: Ein Motiv, das es nicht gibt, ergab 500.
  const vorher = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  if (!vorher) {
    return res.status(404).json({ data: null, error: 'Motiv nicht gefunden' })
  }
  const { name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available, notes } = req.body
  const d = drehortAngaben(req.body, vorher)
  await db.run(`
    UPDATE locations SET name=?, address=?, city=?, zip=?, country=?, lat=?, lng=?, contact_name=?, contact_phone=?, contact_email=?, rental_fee=?, parking_info=?, power_available=?, notes=?,
      hospital_name=?, hospital_address=?, hospital_phone=?, basecamp=?, directions=?, permit_required=?
    WHERE id=?
  `, [name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available ? 1 : 0, notes,
      d.hospital_name, d.hospital_address, d.hospital_phone, d.basecamp, d.directions, d.permit_required, req.params.id])
  const row = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  res.json({ data: { ...row, photos: JSON.parse(row.photos || '[]'), power_available: !!row.power_available }, error: null })
})

// DELETE /api/locations/:id
router.delete('/locations/:id', async (req, res) => {
  await db.run('DELETE FROM locations WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// ─── Sets unter dem Motiv (AP C3) ───────────────────────────────────────────

/** Name eines Sets: nicht leer, unter dem Motiv einmalig (ohne Groß- und Kleinschreibung). */
async function setName(locationId: number, name: unknown, ausser: number | null): Promise<{ name: string } | { fehler: string }> {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!n) return { fehler: 'Ein Set braucht einen Namen' }
  const doppelt = await db.get('SELECT id FROM location_sets WHERE location_id = ? AND lower(name) = lower(?) AND id <> ?', [locationId, n, ausser ?? 0])
  if (doppelt) return { fehler: 'Dieses Set gibt es am Motiv schon' }
  return { name: alsMotivname(n) }
}

// POST /api/locations/:id/sets
router.post('/locations/:id/sets', async (req, res) => {
  const loc = await db.get('SELECT id FROM locations WHERE id = ?', [req.params.id]) as any
  if (!loc) return res.status(404).json({ data: null, error: 'Motiv nicht gefunden' })
  const n = await setName(loc.id, req.body?.name, null)
  if ('fehler' in n) return res.status(400).json({ data: null, error: n.fehler })
  const sort = Number(((await db.get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM location_sets WHERE location_id = ?', [loc.id])) as any)?.m ?? 0) + 1
  const neu = await db.run('INSERT INTO location_sets (location_id, name, notes, sort_order) VALUES (?, ?, ?, ?)', [loc.id, n.name, String(req.body?.notes ?? '').trim(), sort])
  res.status(201).json({ data: await db.get('SELECT * FROM location_sets WHERE id = ?', [neu.id]), error: null })
})

// PUT /api/location-sets/:id - Name und Notiz
router.put('/location-sets/:id', async (req, res) => {
  const set = await db.get('SELECT * FROM location_sets WHERE id = ?', [req.params.id]) as any
  if (!set) return res.status(404).json({ data: null, error: 'Set nicht gefunden' })
  let name = set.name
  if (req.body?.name !== undefined) {
    const n = await setName(set.location_id, req.body.name, set.id)
    if ('fehler' in n) return res.status(400).json({ data: null, error: n.fehler })
    name = n.name
  }
  const notes = req.body?.notes === undefined ? set.notes : String(req.body.notes ?? '').trim()
  await db.run('UPDATE location_sets SET name = ?, notes = ? WHERE id = ?', [name, notes, set.id])
  res.json({ data: await db.get('SELECT * FROM location_sets WHERE id = ?', [set.id]), error: null })
})

// DELETE /api/location-sets/:id - die Szenen verlieren das Set, landet im Papierkorb
router.delete('/location-sets/:id', async (req, res) => {
  if (!(await db.get('SELECT id FROM location_sets WHERE id = ?', [req.params.id]))) return res.status(404).json({ data: null, error: 'Set nicht gefunden' })
  await db.run('DELETE FROM location_sets WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/locations/:id/photos
router.post('/locations/:id/photos', upload.single('photo'), async (req, res) => {
  const loc = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  if (!loc) return res.status(404).json({ data: null, error: 'Motiv nicht gefunden' })
  if (!req.file) return res.status(400).json({ data: null, error: 'Kein Foto hochgeladen' })

  const gespeichert = await speichereDatei(db, {
    projectId: loc.project_id,
    art: 'foto',
    datei: req.file,
    bezugTyp: 'location',
    bezugId: loc.id,
    nutzerId: (req as any).user?.id ?? null,
  })
  const photos = JSON.parse(loc.photos || '[]')
  photos.push(gespeichert.url)
  await db.run('UPDATE locations SET photos = ? WHERE id = ?', [JSON.stringify(photos), req.params.id])
  res.json({ data: { photos }, error: null })
})

export default router
