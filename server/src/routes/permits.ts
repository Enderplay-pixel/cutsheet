/**
 * Drehgenehmigungen als eigene Einträge am Motiv (Plan Kino-Ausbau, AP C3):
 * Titel, Behörde, Status, gültig von bis, Auflagen und freiwillig eine Datei
 * aus der Ablage. Vorher waren Genehmigungen nur Dateien - eine beantragte,
 * die noch nicht da ist, ließ sich nicht führen, und kein Drehtag wusste von ihr.
 */
import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { istGenehmigungStatus } from '../lib/genehmigungen'

const router = Router()
router.use('/projects/:projectId', requireMember)

const datumAus = (w: unknown, alt: unknown): string | null | undefined => {
  if (w === undefined) return (alt === null || alt === undefined || alt === '') ? null : String(alt).slice(0, 10)
  if (w === null || w === '') return null
  return typeof w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : undefined
}

/** Angaben einer Genehmigung aus der Anfrage; was nicht mitkommt, bleibt. */
async function angaben(body: any, vorher: any, projectId: number) {
  const locationId = body?.location_id === undefined ? Number(vorher?.location_id) : Number(body.location_id)
  if (!Number.isInteger(locationId) || locationId <= 0) return { fehler: 'Eine Genehmigung gehört zu einem Motiv' }
  if (!(await db.get('SELECT id FROM locations WHERE id = ? AND project_id = ?', [locationId, projectId]))) return { fehler: 'Motiv nicht gefunden' }
  const status = body?.status === undefined ? (vorher?.status ?? 'offen') : body.status
  if (!istGenehmigungStatus(status)) return { fehler: 'Unbekannter Status einer Genehmigung' }
  const von = datumAus(body?.valid_from, vorher?.valid_from)
  const bis = datumAus(body?.valid_until, vorher?.valid_until)
  if (von === undefined || bis === undefined) return { fehler: 'Ein Datum hat die Form JJJJ-MM-TT' }
  if (von && bis && bis < von) return { fehler: 'Die Genehmigung endet vor ihrem Beginn' }
  let fileId: number | null = vorher?.file_id ?? null
  if (body?.file_id !== undefined) {
    if (body.file_id === null || body.file_id === '') fileId = null
    else {
      fileId = Number(body.file_id)
      if (!(await db.get('SELECT id FROM project_files WHERE id = ? AND project_id = ?', [fileId, projectId]))) return { fehler: 'Datei nicht gefunden' }
    }
  }
  const text = (k: string) => (body?.[k] === undefined ? String(vorher?.[k] ?? '') : String(body[k] ?? '').trim())
  return { werte: { location_id: locationId, title: text('title'), authority: text('authority'), status, valid_from: von, valid_until: bis, conditions: text('conditions'), file_id: fileId } }
}

const MIT_DATEI = `SELECT p.*, f.filename AS file_name, f.title AS file_title
  FROM permits p LEFT JOIN project_files f ON f.id = p.file_id`

// GET /api/projects/:projectId/genehmigungen
router.get('/projects/:projectId/genehmigungen', async (req, res) => {
  const zeilen = await db.all(`${MIT_DATEI} WHERE p.project_id = ? ORDER BY p.valid_from NULLS LAST, p.id`, [req.params.projectId])
  res.json({ data: zeilen, error: null })
})

// POST /api/projects/:projectId/genehmigungen
router.post('/projects/:projectId/genehmigungen', async (req, res) => {
  const pid = Number(req.params.projectId)
  const a = await angaben(req.body, null, pid)
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  const w = a.werte
  const neu = await db.run(
    `INSERT INTO permits (project_id, location_id, title, authority, status, valid_from, valid_until, conditions, file_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pid, w.location_id, w.title, w.authority, w.status, w.valid_from, w.valid_until, w.conditions, w.file_id])
  res.status(201).json({ data: await db.get(`${MIT_DATEI} WHERE p.id = ?`, [neu.id]), error: null })
})

// PUT /api/genehmigungen/:id
router.put('/genehmigungen/:id', async (req, res) => {
  const vorher = await db.get('SELECT * FROM permits WHERE id = ?', [req.params.id]) as any
  if (!vorher) return res.status(404).json({ data: null, error: 'Genehmigung nicht gefunden' })
  const a = await angaben(req.body, vorher, Number(vorher.project_id))
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  const w = a.werte
  await db.run(
    `UPDATE permits SET location_id = ?, title = ?, authority = ?, status = ?, valid_from = ?, valid_until = ?, conditions = ?, file_id = ? WHERE id = ?`,
    [w.location_id, w.title, w.authority, w.status, w.valid_from, w.valid_until, w.conditions, w.file_id, vorher.id])
  res.json({ data: await db.get(`${MIT_DATEI} WHERE p.id = ?`, [vorher.id]), error: null })
})

// DELETE /api/genehmigungen/:id - landet im Papierkorb (middleware/papierkorbWaechter.ts)
router.delete('/genehmigungen/:id', async (req, res) => {
  if (!(await db.get('SELECT id FROM permits WHERE id = ?', [req.params.id]))) return res.status(404).json({ data: null, error: 'Genehmigung nicht gefunden' })
  await db.run('DELETE FROM permits WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
