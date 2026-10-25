import { Router, Request, Response } from 'express'
import { db } from '../db'
import { schreibeCsv, cents } from '../lib/tabelle'

const router = Router()

// GET /api/projects/:pid/payroll/export.csv
router.get('/projects/:pid/payroll/export.csv', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.pid)
  const { type = 'all', from, to } = req.query as { type?: string; from?: string; to?: string }

  const project = await db.get('SELECT id, title FROM projects WHERE id = ?', [projectId])
  if (!project) {
    return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })
  }

  interface PersonRow {
    typ: string
    name: string
    rolle: string
    fee_per_day: number
    shoot_days: number
    overtime_hours: number
  }

  /**
   * Drehtage je Person - eine Abfrage für alle statt eine je Person.
   *
   * Gezählt werden verschiedene Drehtage, an denen die Person auf einer
   * Disposition steht. Der Zeitraum wirkt auf das Datum des Drehtags.
   */
  const drehtageJePerson = async (art: 'cast' | 'crew'): Promise<Map<number, number>> => {
    let sql = `
      SELECT cse.person_id, COUNT(DISTINCT sd.id) AS cnt
        FROM call_sheet_entries cse
        JOIN call_sheets cs ON cse.call_sheet_id = cs.id
        JOIN shoot_days sd ON cs.shoot_day_id = sd.id
       WHERE cse.person_type = ? AND sd.project_id = ?
    `
    const werte: any[] = [art, projectId]
    if (from) { sql += ' AND sd.date >= ?'; werte.push(from) }
    if (to)   { sql += ' AND sd.date <= ?'; werte.push(to) }
    sql += ' GROUP BY cse.person_id'
    const zeilen = (await db.all(sql, werte)) as any[]
    return new Map(zeilen.map((z) => [Number(z.person_id), Number(z.cnt)]))
  }

  /** Überstunden je Person - ebenfalls eine Abfrage für alle. */
  const ueberstundenJePerson = async (art: 'cast' | 'crew'): Promise<Map<number, number>> => {
    let sql = `
      SELECT t.person_id, COALESCE(SUM(t.overtime_hours), 0) AS total_ot
        FROM timesheets t
        JOIN shoot_days sd ON t.shoot_day_id = sd.id
       WHERE t.person_type = ? AND t.project_id = ?
    `
    const werte: any[] = [art, projectId]
    if (from) { sql += ' AND sd.date >= ?'; werte.push(from) }
    if (to)   { sql += ' AND sd.date <= ?'; werte.push(to) }
    sql += ' GROUP BY t.person_id'
    const zeilen = (await db.all(sql, werte)) as any[]
    return new Map(zeilen.map((z) => [Number(z.person_id), Number(z.total_ot)]))
  }

  const rows: PersonRow[] = []

  // ── Cast ─────────────────────────────────────────────────────────────────
  if (type === 'cast' || type === 'all') {
    const castList = await db.all(
      `SELECT c.id, c.actor_name AS name, ch.name AS rolle, c.fee_per_day
       FROM "cast" c
       LEFT JOIN characters ch ON c.character_id = ch.id
       WHERE c.project_id = ?`,
      [projectId]
    )

    const [tageCast, ueberstundenCast] = await Promise.all([
      drehtageJePerson('cast'),
      ueberstundenJePerson('cast'),
    ])

    for (const person of castList) {
      rows.push({
        typ: 'Cast',
        name: person.name || '',
        rolle: person.rolle || '',
        fee_per_day: Number(person.fee_per_day ?? 0),
        shoot_days: tageCast.get(Number(person.id)) ?? 0,
        overtime_hours: ueberstundenCast.get(Number(person.id)) ?? 0,
      })
    }
  }

  // ── Crew ─────────────────────────────────────────────────────────────────
  if (type === 'crew' || type === 'all') {
    const crewList = await db.all(
      'SELECT id, name, role AS rolle, fee_per_day FROM crew WHERE project_id = ?',
      [projectId]
    )

    const [tageCrew, ueberstundenCrew] = await Promise.all([
      drehtageJePerson('crew'),
      ueberstundenJePerson('crew'),
    ])

    for (const person of crewList) {
      rows.push({
        typ: 'Crew',
        name: person.name || '',
        rolle: person.rolle || '',
        fee_per_day: Number(person.fee_per_day ?? 0),
        shoot_days: tageCrew.get(Number(person.id)) ?? 0,
        overtime_hours: ueberstundenCrew.get(Number(person.id)) ?? 0,
      })
    }
  }

  // ── Build CSV ─────────────────────────────────────────────────────────────
  // Wie jeder Export: Semikolon und Dezimalkomma (lib/tabelle.ts). Vorher
  // Komma und Dezimalpunkt - "6500.00" als einzige Ausnahme im Programm.
  const csv = schreibeCsv(
    ['Typ', 'Name', 'Rolle', 'Drehtage', 'Tagesgage (EUR)', 'Gesamtgage (EUR)', 'Überstunden'],
    rows.map((r) => [
      r.typ,
      r.name,
      r.rolle,
      r.shoot_days,
      cents(r.fee_per_day),
      cents(r.fee_per_day * r.shoot_days),
      r.overtime_hours.toFixed(2).replace('.', ','),
    ])
  )

  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', 'attachment; filename="payroll.csv"')
  return res.send(csv)
})

export default router
