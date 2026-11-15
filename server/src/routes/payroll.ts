import { Router, Request, Response } from 'express'
import { db } from '../db'
import { schreibeCsv, cents } from '../lib/tabelle'
import { drehtageBesetzung, drehtageStab } from '../lib/drehtage'
import { ladeDood } from '../lib/dood'
import { zettelDesProjekts } from '../lib/arbeitszeitProjekt'
import { SATZ_ARTEN, type Saetze } from '../lib/arbeitszeit'

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
    hold_days: number
    hold_fee_per_day: number
    /** Minuten je Zuschlagsart und Betrag aus den Stundenzetteln (AP B3) */
    zuschlag_minuten: Saetze
    zuschlag_cent: number
  }

  // Überstunden und Zuschläge je Person aus den Stundenzetteln im Zeitraum -
  // dieselbe Rechnung wie in den Timesheets (lib/arbeitszeitProjekt.ts)
  // Nur freigegebene und abgerechnete Zettel (AP E8); wie viele fehlen, sagt
  // die Seite neben dem Knopf (GET …/timesheets/staende)
  const bedingung: string[] = [`AND t.status IN ('freigegeben', 'abgerechnet')`]
  const bedingungWerte: any[] = []
  if (from) { bedingung.push('AND sd.date >= ?'); bedingungWerte.push(from) }
  if (to) { bedingung.push('AND sd.date <= ?'); bedingungWerte.push(to) }
  const { zeilen: zettel, ergebnis } = await zettelDesProjekts(db, projectId, bedingung.join(' '), bedingungWerte)
  const zuschlagJePerson = new Map<string, { minuten: Saetze; cent: number }>()
  for (const z of zettel) {
    const a = ergebnis.get(Number(z.id))
    if (!a) continue
    const key = `${z.person_type}:${z.person_id}`
    const bisher = zuschlagJePerson.get(key) ?? { minuten: { elfte: 0, ab_zwoelfte: 0, nacht: 0, sonntag: 0, feiertag: 0 }, cent: 0 }
    for (const art of SATZ_ARTEN) bisher.minuten[art] += a.zuschlag_minuten[art]
    bisher.cent += a.surcharge_cents
    zuschlagJePerson.set(key, bisher)
  }
  const keinZuschlag = { minuten: { elfte: 0, ab_zwoelfte: 0, nacht: 0, sonntag: 0, feiertag: 0 }, cent: 0 }

  /**
   * Drehtage je Person - dieselbe Zählung wie Kalkulation, DOOD und Vertrag
   * (lib/drehtage.ts: Drehplan und Dispo), dazu jeder Tag mit einem
   * Stundenzettel. Der Zeitraum wirkt auf das Datum des Drehtags.
   *
   * Vorher nur Tage mit Disposition: Gemessen im Testbericht SALZWIND
   * (09.11.2026) hatte die Hauptdarstellerin für Drehtag 1 Tagesbericht und
   * Stundenzettel, aber keine Dispo - im Lohnexport 0 Drehtage, 0 €.
   */
  const tagesdatum = new Map<number, string>(
    ((await db.all('SELECT id, date FROM shoot_days WHERE project_id = ?', [projectId])) as any[])
      .map((z) => [Number(z.id), String(z.date ?? '')])
  )
  const imZeitraum = (tag: number): boolean => {
    const datum = tagesdatum.get(tag)
    if (datum === undefined) return false
    if (!from && !to) return true
    if (!datum) return false
    return (!from || datum >= from) && (!to || datum <= to)
  }
  const drehtageJePerson = async (art: 'cast' | 'crew'): Promise<Map<number, number>> => {
    const geplant = art === 'cast' ? await drehtageBesetzung(db, projectId) : await drehtageStab(db, projectId)
    const zettel = (await db.all(
      "SELECT DISTINCT person_id, shoot_day_id FROM timesheets WHERE person_type = ? AND project_id = ? AND shoot_day_id IS NOT NULL AND status IN ('freigegeben', 'abgerechnet')",
      [art, projectId]
    )) as any[]
    for (const z of zettel) {
      const person = Number(z.person_id)
      if (!geplant.has(person)) geplant.set(person, new Set())
      geplant.get(person)!.add(Number(z.shoot_day_id))
    }
    return new Map([...geplant].map(([person, tage]) => [person, [...tage].filter(imZeitraum).length]))
  }

  /** Überstunden je Person - ebenfalls eine Abfrage für alle. */
  const ueberstundenJePerson = async (art: 'cast' | 'crew'): Promise<Map<number, number>> => {
    let sql = `
      SELECT t.person_id, COALESCE(SUM(t.overtime_hours), 0) AS total_ot
        FROM timesheets t
        JOIN shoot_days sd ON t.shoot_day_id = sd.id
       WHERE t.person_type = ? AND t.project_id = ? AND t.status IN ('freigegeben', 'abgerechnet')
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

    const [tageCast, ueberstundenCast, dood] = await Promise.all([
      drehtageJePerson('cast'),
      ueberstundenJePerson('cast'),
      ladeDood(db, projectId),
    ])
    // Haltetage aus dem DOOD, im Zeitraum nach ihrem Datum (seit 13.11.2026)
    const imDatumsraum = (datum: string) => (!from && !to) || (!!datum && (!from || datum >= from) && (!to || datum <= to))
    const halt = new Map(dood.cast.map((c) => [c.id, {
      tage: c.days.filter((d) => d.code === 'H' && imDatumsraum(d.date)).length,
      satz: c.hold_fee_per_day ?? 0,
    }]))

    for (const person of castList) {
      rows.push({
        typ: 'Cast',
        name: person.name || '',
        rolle: person.rolle || '',
        fee_per_day: Number(person.fee_per_day ?? 0),
        shoot_days: tageCast.get(Number(person.id)) ?? 0,
        overtime_hours: ueberstundenCast.get(Number(person.id)) ?? 0,
        hold_days: halt.get(Number(person.id))?.tage ?? 0,
        hold_fee_per_day: halt.get(Number(person.id))?.satz ?? 0,
        zuschlag_minuten: (zuschlagJePerson.get(`cast:${person.id}`) ?? keinZuschlag).minuten,
        zuschlag_cent: (zuschlagJePerson.get(`cast:${person.id}`) ?? keinZuschlag).cent,
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
        // Kein Halt für den Stab (Nicht-Ziel im Plan, AP A1)
        hold_days: 0,
        hold_fee_per_day: 0,
        zuschlag_minuten: (zuschlagJePerson.get(`crew:${person.id}`) ?? keinZuschlag).minuten,
        zuschlag_cent: (zuschlagJePerson.get(`crew:${person.id}`) ?? keinZuschlag).cent,
      })
    }
  }

  // ── Build CSV ─────────────────────────────────────────────────────────────
  // Wie jeder Export: Semikolon und Dezimalkomma (lib/tabelle.ts). Vorher
  // Komma und Dezimalpunkt - "6500.00" als einzige Ausnahme im Programm.
  const csv = schreibeCsv(
    // Die Haltetage stehen hinten, damit vorhandene Importe ihre Spalten behalten
    // Die Zuschläge (AP B3) ebenfalls hinten: Stunden je Art und der Betrag
    ['Typ', 'Name', 'Rolle', 'Drehtage', 'Tagesgage (EUR)', 'Gesamtgage (EUR)', 'Überstunden', 'Haltetage', 'Haltegage gesamt (EUR)',
      'Std. erste Überstunde', 'Std. ab zweiter Überstunde', 'Std. Nacht', 'Std. Sonntag', 'Std. Feiertag', 'Zuschlag Überstunden und Zeiten'],
    rows.map((r) => [
      r.typ,
      r.name,
      r.rolle,
      r.shoot_days,
      cents(r.fee_per_day),
      cents(r.fee_per_day * r.shoot_days),
      r.overtime_hours.toFixed(2).replace('.', ','),
      r.hold_days,
      cents(r.hold_fee_per_day * r.hold_days),
      ...SATZ_ARTEN.map((art) => (r.zuschlag_minuten[art] / 60).toFixed(2).replace('.', ',')),
      cents(r.zuschlag_cent),
    ])
  )

  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', 'attachment; filename="payroll.csv"')
  return res.send(csv)
})

export default router
