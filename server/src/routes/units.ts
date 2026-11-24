/**
 * Units je Projekt (Plan Kino-Ausbau, AP C2): Name, Kürzel, Farbe,
 * Reihenfolge. Die Haupteinheit hat jedes Projekt von Anfang an; sie lässt
 * sich umbenennen, aber nicht löschen.
 */
import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { hauptUnit, effektiveUnit } from '../lib/units'
import { nummeriereDrehtage } from './drehplan'

const router = Router()
router.use('/projects/:projectId', requireMember)

const FARBE = /^#[0-9a-fA-F]{6}$/

/** Angaben einer Unit; was nicht mitkommt, bleibt. */
async function angaben(body: any, vorher: any, projectId: number) {
  const name = body?.name === undefined ? String(vorher?.name ?? '') : String(body.name ?? '').trim()
  if (!name) return { fehler: 'Eine Unit braucht einen Namen' }
  if (name.length > 60) return { fehler: 'Der Name einer Unit hat höchstens 60 Zeichen' }
  const short = body?.short === undefined ? String(vorher?.short ?? '') : String(body.short ?? '').trim()
  if (short.length > 6) return { fehler: 'Das Kürzel einer Unit hat höchstens 6 Zeichen' }
  const color = body?.color === undefined ? String(vorher?.color ?? '') : String(body.color ?? '').trim()
  if (color && !FARBE.test(color)) return { fehler: 'Die Farbe hat die Form #RRGGBB' }
  const gleich = await db.get(
    'SELECT id FROM units WHERE project_id = ? AND LOWER(name) = LOWER(?) AND id <> ?',
    [projectId, name, vorher?.id ?? 0])
  if (gleich) return { fehler: `Eine Unit „${name}" gibt es schon` }
  return { werte: { name, short, color } }
}

const MIT_ZAHLEN = (wo: string) => `
  SELECT u.*,
         (SELECT COUNT(*)::int FROM shoot_days d WHERE d.project_id = u.project_id AND ${effektiveUnit('d')} = u.id) AS tage_anzahl,
         (SELECT COUNT(*)::int FROM crew c WHERE c.project_id = u.project_id AND NOT c.all_units AND ${effektiveUnit('c')} = u.id) AS stab_anzahl
    FROM units u WHERE ${wo}`

// GET /api/projects/:projectId/units - die Haupteinheit zuerst
router.get('/projects/:projectId/units', async (req, res) => {
  await hauptUnit(db, req.params.projectId)
  const zeilen = await db.all(`${MIT_ZAHLEN('u.project_id = ?')} ORDER BY u.is_main DESC, u.sort_order ASC, u.id ASC`, [req.params.projectId])
  res.json({ data: zeilen, error: null })
})

// POST /api/projects/:projectId/units
router.post('/projects/:projectId/units', async (req, res) => {
  const pid = Number(req.params.projectId)
  // Die Haupteinheit zuerst: Eine zweite Unit ohne erste ergäbe keinen Vergleich
  await hauptUnit(db, pid)
  const a = await angaben(req.body, null, pid)
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  const neu = await db.run(
    `INSERT INTO units (project_id, name, short, color, is_main, sort_order)
     VALUES (?, ?, ?, ?, false, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units WHERE project_id = ?))`,
    [pid, a.werte.name, a.werte.short, a.werte.color, pid])
  res.status(201).json({ data: await db.get(MIT_ZAHLEN('u.id = ?'), [neu.id]), error: null })
})

// PUT /api/units/:id
router.put('/units/:id', async (req, res) => {
  const vorher = await db.get('SELECT * FROM units WHERE id = ?', [req.params.id]) as any
  if (!vorher) return res.status(404).json({ data: null, error: 'Unit nicht gefunden' })
  const a = await angaben(req.body, vorher, Number(vorher.project_id))
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  let sortOrder = Number(vorher.sort_order)
  if (req.body?.sort_order !== undefined) {
    sortOrder = Number(req.body.sort_order)
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000) return res.status(400).json({ data: null, error: 'Die Reihenfolge ist eine Zahl von 0 bis 1.000' })
  }
  await db.transaction(async (tx) => {
    await tx.run('UPDATE units SET name = ?, short = ?, color = ?, sort_order = ? WHERE id = ?',
      [a.werte.name, a.werte.short, a.werte.color, sortOrder, vorher.id])
    // Die Textspalte der Tage zieht mit, solange sie noch jemand liest
    if (a.werte.name !== vorher.name) {
      await tx.run(`UPDATE shoot_days d SET unit = ? WHERE d.project_id = ? AND ${effektiveUnit('d')} = ?`,
        [a.werte.name, vorher.project_id, vorher.id])
    }
  })
  res.json({ data: await db.get(MIT_ZAHLEN('u.id = ?'), [vorher.id]), error: null })
})

// DELETE /api/units/:id?bestaetigt=1 - die Tage wandern zur Haupteinheit
router.delete('/units/:id', async (req, res) => {
  const unit = await db.get('SELECT * FROM units WHERE id = ?', [req.params.id]) as any
  if (!unit) return res.status(404).json({ data: null, error: 'Unit nicht gefunden' })
  if (unit.is_main) return res.status(400).json({ data: null, error: 'Die Haupteinheit lässt sich nicht löschen' })
  const tage = Number(((await db.get('SELECT COUNT(*)::int AS n FROM shoot_days WHERE unit_id = ?', [unit.id])) as any).n)
  if (tage > 0 && req.query.bestaetigt !== '1') {
    return res.status(409).json({
      data: { tage },
      error: `Die Unit hat ${tage} ${tage === 1 ? 'Drehtag' : 'Drehtage'} - beim Löschen wandern sie zur Haupteinheit.`,
    })
  }
  const haupt = await hauptUnit(db, unit.project_id)
  await db.transaction(async (tx) => {
    await tx.run('UPDATE shoot_days SET unit_id = ?, unit = ? WHERE unit_id = ?', [haupt.id, haupt.name, unit.id])
    // Der Stab der Unit gehört danach zur Haupteinheit (leer)
    await tx.run('DELETE FROM units WHERE id = ?', [unit.id])
    await nummeriereDrehtage(unit.project_id, tx)
  })
  res.json({ data: { ok: true, tage }, error: null })
})

export default router
