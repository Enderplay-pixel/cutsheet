import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { loeschePersonenspuren } from '../lib/person'
import { dispoFuerDrehtag } from '../lib/dispo'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireAuth, requireMember)

/**
 * Komparsen mit ihren Drehtagen. Zugeordnet wird über die Dispo des Tages -
 * dort stehen sie mit Call-Zeit, und dort lesen Vertrag (Drehtage, Gesamtgage),
 * Jugendschutzprüfung, Verpflegung und Check-in.
 */
const MIT_DREHTAGEN = `SELECT e.*,
    COALESCE((SELECT array_agg(DISTINCT cs.shoot_day_id)
                FROM call_sheet_entries cse JOIN call_sheets cs ON cse.call_sheet_id = cs.id
               WHERE cse.person_type = 'extra' AND cse.person_id = e.id), '{}') AS drehtage,
    -- Abruf je Drehtag mit Kopfzahl (AP C1)
    COALESCE((SELECT json_agg(json_build_object('tag', cs.shoot_day_id, 'anzahl', cse.headcount, 'call', cse.call_time) ORDER BY cs.shoot_day_id)
                FROM call_sheet_entries cse JOIN call_sheets cs ON cse.call_sheet_id = cs.id
               WHERE cse.person_type = 'extra' AND cse.person_id = e.id), '[]'::json) AS abrufe
  FROM extras e`

/**
 * Angaben eines Komparsen-Eintrags (AP C1): Person oder Gruppe, Kopfzahl,
 * Tagessatz, Agentur, "mit Minderjährigen". Was nicht mitkommt, bleibt. Eine
 * Person zählt immer 1; eine Gruppe nicht weniger Köpfe, als abgerufen sind.
 */
async function eintragAngaben(body: any, vorher: any): Promise<{ werte: Record<string, unknown> } | { fehler: string }> {
  const gruppe = body?.is_group === undefined ? vorher?.is_group === true : body.is_group === true
  let kopfzahl = 1
  if (gruppe) {
    const roh = body?.headcount === undefined ? (vorher?.headcount ?? 1) : body.headcount
    kopfzahl = Number(roh)
    if (!Number.isInteger(kopfzahl) || kopfzahl < 1 || kopfzahl > 10_000) return { fehler: 'Eine Gruppe hat 1 bis 10.000 Köpfe' }
  }
  if (vorher) {
    const abgerufen = await db.get(
      "SELECT COALESCE(MAX(headcount), 0) AS m FROM call_sheet_entries WHERE person_type = 'extra' AND person_id = ?", [vorher.id]) as any
    if (Number(abgerufen?.m ?? 0) > kopfzahl) {
      return { fehler: `An einem Drehtag sind ${abgerufen.m} Köpfe abgerufen - die Gruppe braucht mindestens so viele` }
    }
  }
  const satzRoh = body?.fee_per_day === undefined ? (vorher?.fee_per_day ?? 0) : body.fee_per_day
  const satz = satzRoh === null || satzRoh === '' ? 0 : Number(satzRoh)
  if (!Number.isInteger(satz) || satz < 0 || satz > 100_000_000) return { fehler: 'Der Tagessatz ist ein Betrag ab 0' }
  const text = (k: string, vorgabe = '') => (body?.[k] === undefined ? String(vorher?.[k] ?? vorgabe) : String(body[k] ?? '').trim())
  return {
    werte: {
      name: text('name'), phone: text('phone'), email: text('email'), tariff_group: text('tariff_group', 'Standard'), notes: text('notes'),
      is_group: gruppe, headcount: kopfzahl, fee_per_day: satz, agency: text('agency'),
      minors_included: gruppe && (body?.minors_included === undefined ? vorher?.minors_included === true : body.minors_included === true),
    },
  }
}

// GET /api/projects/:projectId/extras
router.get('/projects/:projectId/extras', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const rows = await db.all(`${MIT_DREHTAGEN} WHERE e.project_id = ? ORDER BY e.id ASC`, [projectId])
  return res.json({ data: rows, error: null })
})

// PUT /api/projects/:projectId/extras/:id/drehtage - { drehtage: [Drehtag-Kennungen] }
// oder mit Kopfzahl je Tag: { drehtage: [{ tag, anzahl }] } (AP C1)
router.put('/projects/:projectId/extras/:id/drehtage', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const roh = req.body?.drehtage
  if (!Array.isArray(roh) || !roh.every((t: any) => Number.isInteger(t) || (t && Number.isInteger(t.tag)))) {
    return res.status(400).json({ data: null, error: 'drehtage muss eine Liste von Drehtag-Kennungen sein' })
  }
  const extra = await db.get('SELECT id, is_group, headcount FROM extras WHERE id = ? AND project_id = ?', [id, projectId]) as any
  if (!extra) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })
  // Eine Person hat immer 1; eine Gruppe ohne Angabe alle ihre Köpfe
  const anzahlJeTag = new Map<number, number>()
  for (const t of roh as any[]) {
    const tag = Number.isInteger(t) ? Number(t) : Number(t.tag)
    const anzahl = extra.is_group !== true ? 1 : Number.isInteger(t) || t.anzahl === undefined ? Number(extra.headcount) : Number(t.anzahl)
    if (!Number.isInteger(anzahl) || anzahl < 1) return res.status(400).json({ data: null, error: 'Abgerufen wird mindestens ein Kopf' })
    if (anzahl > Number(extra.headcount)) {
      return res.status(400).json({ data: null, error: `Die Gruppe hat ${extra.headcount} Köpfe - ${anzahl} lassen sich nicht abrufen` })
    }
    anzahlJeTag.set(tag, anzahl)
  }
  const drehtage = [...anzahlJeTag.keys()]
  const gueltig = await db.all('SELECT id FROM shoot_days WHERE project_id = ? AND id = ANY(?::int[])', [projectId, drehtage]) as any[]
  if (gueltig.length !== new Set(drehtage).size) {
    return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
  }

  // Abgewählte Tage: aus deren Dispo nehmen
  await db.run(
    `DELETE FROM call_sheet_entries cse USING call_sheets cs, shoot_days sd
      WHERE cse.call_sheet_id = cs.id AND cs.shoot_day_id = sd.id AND sd.project_id = ?
        AND cse.person_type = 'extra' AND cse.person_id = ? AND NOT (cs.shoot_day_id = ANY(?::int[]))`,
    [projectId, id, drehtage]
  )
  // Gewählte Tage: in die Dispo, mit der allgemeinen Call-Zeit des Tages
  for (const tagId of new Set<number>(drehtage)) {
    const dispo = await dispoFuerDrehtag(tagId)
    if (!dispo) continue
    const steht = await db.get(
      "SELECT id FROM call_sheet_entries WHERE call_sheet_id = ? AND person_type = 'extra' AND person_id = ?", [dispo.id, id]
    ) as any
    if (steht) {
      await db.run('UPDATE call_sheet_entries SET headcount = ? WHERE id = ?', [anzahlJeTag.get(tagId) ?? 1, steht.id])
      continue
    }
    const ende = await db.get('SELECT COALESCE(MAX(sort_order), -1) AS m FROM call_sheet_entries WHERE call_sheet_id = ?', [dispo.id]) as any
    await db.run(
      "INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order, headcount) VALUES (?, 'extra', ?, ?, ?, ?)",
      [dispo.id, id, dispo.general_call, Number(ende.m) + 1, anzahlJeTag.get(tagId) ?? 1]
    )
  }
  const row = await db.get(`${MIT_DREHTAGEN} WHERE e.id = ?`, [id])
  return res.json({ data: row, error: null })
})

// POST /api/projects/:projectId/extras
router.post('/projects/:projectId/extras', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const a = await eintragAngaben(req.body, null)
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  const w = a.werte
  const result = await db.run(`
    INSERT INTO extras (project_id, name, phone, email, tariff_group, notes, is_group, headcount, fee_per_day, agency, minors_included)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, w.name, w.phone, w.email, w.tariff_group, w.notes, w.is_group, w.headcount, w.fee_per_day, w.agency, w.minors_included])
  const row = await db.get(`${MIT_DREHTAGEN} WHERE e.id = ?`, [result.id])
  return res.status(201).json({ data: row, error: null })
})

/**
 * POST /api/projects/:projectId/extras/mehrere - schnell erfassen (AP C1):
 * `{ namen: string[], tariff_group?, agency?, fee_per_day? }`, je Name eine
 * Person, in einer Transaktion. Leere Zeilen fallen weg.
 */
router.post('/projects/:projectId/extras/mehrere', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const namen = Array.isArray(req.body?.namen) ? (req.body.namen as unknown[]).map((n) => String(n ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean) : []
  if (!namen.length) return res.status(400).json({ data: null, error: 'Keine Namen' })
  if (namen.length > 500) return res.status(400).json({ data: null, error: 'Höchstens 500 Namen auf einmal' })
  const a = await eintragAngaben({ ...req.body, is_group: false }, null)
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  const w = a.werte
  const ids = await db.transaction(async (tx) => {
    const neu: number[] = []
    for (const name of namen) {
      neu.push((await tx.run(
        `INSERT INTO extras (project_id, name, tariff_group, fee_per_day, agency) VALUES (?, ?, ?, ?, ?)`,
        [projectId, name, w.tariff_group, w.fee_per_day, w.agency])).id)
    }
    return neu
  })
  const rows = await db.all(`${MIT_DREHTAGEN} WHERE e.id = ANY(?::int[]) ORDER BY e.id ASC`, [ids])
  return res.status(201).json({ data: rows, error: null })
})

// PUT /api/projects/:projectId/extras/:id
router.put('/projects/:projectId/extras/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur eine Zeile aus dem Projekt im Pfad. Sonst ließ sich über eine
  // fremde Kennung die Zeile eines anderen Projekts ändern und auslesen.
  const existing = await db.get('SELECT * FROM extras WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (!existing) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })

  const a = await eintragAngaben(req.body, existing)
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  const w = a.werte
  await db.run(`
    UPDATE extras SET name = ?, phone = ?, email = ?, tariff_group = ?, notes = ?,
      is_group = ?, headcount = ?, fee_per_day = ?, agency = ?, minors_included = ?
    WHERE id = ?
  `, [w.name, w.phone, w.email, w.tariff_group, w.notes, w.is_group, w.headcount, w.fee_per_day, w.agency, w.minors_included, id])
  // Eine Person ist an jedem Tag genau einer
  if (w.is_group !== true) await db.run("UPDATE call_sheet_entries SET headcount = 1 WHERE person_type = 'extra' AND person_id = ?", [id])

  const row = await db.get(`${MIT_DREHTAGEN} WHERE e.id = ?`, [id])
  return res.json({ data: row, error: null })
})

// DELETE /api/projects/:projectId/extras/:id
router.delete('/projects/:projectId/extras/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id)
  // Nur aus dem Projekt im Pfad: sonst löschte eine fremde Kennung im fremden Projekt
  const vorhanden = await db.get('SELECT id FROM extras WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  if (!vorhanden) return res.status(404).json({ data: null, error: 'Komparse nicht gefunden' })
  // Dispo-Einträge, Zeiten und Verpflegung hängen ohne Fremdschlüssel dran
  await loeschePersonenspuren('extra', id)
  await db.run('DELETE FROM extras WHERE id = ? AND project_id = ?', [id, Number(req.params.projectId)])
  return res.json({ data: { id }, error: null })
})

export default router
