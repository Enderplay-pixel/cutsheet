import { Router, Request, Response } from 'express'
import { db } from '../db'

const router = Router()

function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2)
}

function csvEscape(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  // Quote if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildRow(cols: (string | number | null | undefined)[]): string {
  return cols.map(csvEscape).join(',')
}

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
  const header = buildRow(['Typ', 'Name', 'Rolle', 'Drehtage', 'Tagesgage (EUR)', 'Gesamtgage (EUR)', 'Überstunden'])

  const dataRows = rows.map((r) => {
    const total_gage = r.fee_per_day * r.shoot_days
    return buildRow([
      r.typ,
      r.name,
      r.rolle,
      r.shoot_days,
      centsToEur(r.fee_per_day),
      centsToEur(total_gage),
      r.overtime_hours.toFixed(2),
    ])
  })

  const csv = [header, ...dataRows].join('\r\n')

  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', 'attachment; filename="payroll.csv"')
  // UTF-8 BOM so Excel opens with correct encoding
  return res.send('﻿' + csv)
})

export default router
