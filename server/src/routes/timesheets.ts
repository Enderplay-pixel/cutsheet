import { Router, Request, Response } from 'express'
import { db } from '../db'
import { personAngaben, istPersonenart, PERSONEN_TABELLE } from '../lib/person'
import { requireMemberVia, projectIdFromTable, getUserProjectRole } from '../middleware/projectAuth'
import { schreibeCsv } from '../lib/tabelle'
import { zettelDesProjekts, calcOvertimeHours } from '../lib/arbeitszeitProjekt'
import { logAudit } from './audit'
import { STAENDE, STAND_NAME, istStand, stufe, gesperrt, darfStand, darfAendern, waehlbareStaende, unterschiede, type Stand } from '../lib/zettelStand'

const router = Router()

// Arbeitszeiten und Gagen: bisher genügte irgendein Konto, egal welches Projekt
router.use('/shoot-days/:dayId', requireMemberVia(projectIdFromTable('shoot_days', 'dayId')))
router.use('/projects/:pid', requireMemberVia(async req => Number(req.params.pid) || null))

/** Pause in Minuten: ganze Zahl von 0 bis 720, sonst null (= Unsinn). */
function pauseAus(wert: unknown): number | null {
  const n = Number(wert ?? 0)
  return Number.isInteger(n) && n >= 0 && n <= 720 ? n : null
}

/** Fahrzeit in Minuten: ganze Zahl von 0 bis 1440, sonst null (AP E8). */
function fahrzeitAus(wert: unknown): number | null {
  const n = Number(wert ?? 0)
  return Number.isInteger(n) && n >= 0 && n <= 1440 ? n : null
}

/** Zählt die Fahrzeit in diesem Projekt zur Arbeitszeit? */
async function fahrzeitZaehlt(projectId: number | string): Promise<boolean> {
  const s = (await db.get('SELECT travel_counts FROM project_settings WHERE project_id = ?', [projectId])) as any
  return s?.travel_counts === true
}

/** Rolle im Projekt; ein globaler Admin ist überall Admin. */
async function rolleIn(req: Request, projectId: number): Promise<string | null> {
  const user = (req as any).user
  if (user?.role === 'admin') return 'admin'
  const bekannt = (req as any).projectRole
  if (typeof bekannt === 'string') return bekannt
  return user ? getUserProjectRole(user.id, projectId) : null
}

/**
 * Die Abteilungen des Kontos in diesem Projekt: über die E-Mail im Stab, wie
 * der Kalender-Abgleich (routes/ical.ts). Ohne Eintrag im Stab keine
 * Abteilung - dann prüft eine Abteilungsleitung nichts.
 */
async function eigeneAbteilungen(projectId: number, userId: number | undefined): Promise<string[]> {
  if (!userId) return []
  const zeilen = (await db.all(
    `SELECT DISTINCT c.department FROM crew c JOIN users u ON LOWER(u.email) = LOWER(c.email)
      WHERE c.project_id = ? AND u.id = ? AND c.email <> '' AND c.department <> ''`,
    [projectId, userId])) as any[]
  return zeilen.map((z) => String(z.department))
}

/** Abteilung je Stabmitglied; die Besetzung hat keine. */
async function abteilungenDesStabs(projectId: number): Promise<Map<number, string>> {
  const zeilen = (await db.all('SELECT id, department FROM crew WHERE project_id = ?', [projectId])) as any[]
  return new Map(zeilen.map((z) => [Number(z.id), String(z.department ?? '')]))
}

const abteilungDes = (zettel: any, stab: Map<number, string>) =>
  zettel.person_type === 'crew' ? (stab.get(Number(zettel.person_id)) ?? '') : ''

/** Zeit für das Protokoll lesbar: 420 → "07:00". */
const uhr = (m: unknown) => (m === null || m === undefined || m === '' ? '' : minutesToHHMM(Number(m)))

/** Die Felder eines Zettels, wie das Protokoll sie zeigt. */
function protokollFelder(z: any): Record<string, string> {
  return {
    Call: uhr(z.call_time),
    Wrap: uhr(z.wrap_time),
    Pause: `${Number(z.break_minutes ?? 0)} Min.`,
    Fahrzeit: `${Number(z.travel_minutes ?? 0)} Min.`,
    Mahlzeit: z.meal_penalty ? 'ja' : 'nein',
    Notizen: String(z.notes ?? ''),
  }
}

/**
 * Befunde, Minuten je Zuschlagsart und Betrag an die Zeilen hängen (AP B3).
 * Der Betrag ist ein Gagenfeld - unterhalb der Produktion macht der
 * Gagenschutz ihn zu null.
 */
async function mitAuswertung(projectId: number, zeilen: any[], req: Request): Promise<any[]> {
  if (zeilen.length === 0) return zeilen
  const [{ ergebnis }, rolle, eigene, stab] = await Promise.all([
    zettelDesProjekts(db, projectId),
    rolleIn(req, projectId),
    eigeneAbteilungen(projectId, (req as any).user?.id),
    abteilungenDesStabs(projectId),
  ])
  return zeilen.map((z) => {
    const a = ergebnis.get(Number(z.id))
    // Stand und was dieses Konto an der Zeile tun darf (AP E8) - die Seite
    // zeigt danach Auswahl und Felder, der Server prüft trotzdem selbst
    const abteilung = abteilungDes(z, stab)
    const recht = {
      abteilung,
      staende: waehlbareStaende(rolle, { status: z.status, abteilung }, eigene),
      darf_aendern: darfAendern(rolle, z.status),
    }
    return a ? { ...z, ...recht, befunde: a.befunde, zuschlag_minuten: a.zuschlag_minuten, surcharge_cents: a.surcharge_cents, arbeitszeit_minuten: a.arbeitszeit_minuten } : { ...z, ...recht }
  })
}

function minutesToHHMM(minutes: number | null): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

async function enrichWithPersonName(entry: any): Promise<any> {
  const person = await personAngaben(entry.person_type, entry.person_id)
  return { ...entry, person_name: person?.name || '' }
}

/**
 * Alle Namen eines Projekts auf einmal - für Listen.
 *
 * `enrichWithPersonName` macht je Zeile eine Abfrage. Bei einer einzelnen
 * Zeile ist das richtig; bei 2060 Arbeitszeiten sind es 2060 Abfragen für
 * Daten aus zwei Tabellen mit zusammen 135 Zeilen. Gemessen: 2,9 Sekunden
 * für den CSV-Export.
 *
 * Der Schlüssel der Karte ist `art:kennung`, weil dieselbe Zahl einmal eine
 * Person aus dem Stab und einmal aus der Besetzung sein kann.
 */
async function ladeNamen(projectId: number | string): Promise<Map<string, string>> {
  const [stab, besetzung] = await Promise.all([
    db.all('SELECT id, name FROM crew WHERE project_id = ?', [projectId]) as Promise<any[]>,
    db.all('SELECT id, actor_name AS name FROM "cast" WHERE project_id = ?', [projectId]) as Promise<any[]>,
  ])
  const karte = new Map<string, string>()
  for (const person of stab) karte.set(`crew:${person.id}`, person.name || '')
  for (const person of besetzung) karte.set(`cast:${person.id}`, person.name || '')
  return karte
}

/** Setzt die Namen aus einer vorab geladenen Karte ein. */
function mitNamen(zeilen: any[], karte: Map<string, string>): any[] {
  return zeilen.map((zeile) => ({
    ...zeile,
    person_name: karte.get(`${zeile.person_type}:${zeile.person_id}`) ?? '',
  }))
}

// GET /api/shoot-days/:dayId/timesheets
router.get('/shoot-days/:dayId/timesheets', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const rows = await db.all(
    'SELECT * FROM timesheets WHERE shoot_day_id = ? ORDER BY id ASC',
    [req.params.dayId]
  ) as any[]

  // Das Projekt kommt vom Drehtag. Vorher req.params.pid - den gibt es auf
  // dieser Route nicht, jede Zeile kam ohne Namen (gemessen am 25.10.2026).
  const tag = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
  const enriched = mitNamen(rows, tag ? await ladeNamen(tag.project_id) : new Map())
  return res.json({ data: tag ? await mitAuswertung(Number(tag.project_id), enriched, req) : enriched, error: null })
})

// GET /api/projects/:pid/timesheets?person_type=crew&person_id=5 - alle Tage einer Person (AP E8)
router.get('/projects/:pid/timesheets', async (req: Request, res: Response) => {
  const projectId = Number(req.params.pid)
  const { person_type, person_id } = req.query as { person_type?: string; person_id?: string }
  if (!istPersonenart(person_type) || !Number.isInteger(Number(person_id))) {
    return res.status(400).json({ data: null, error: 'person_type und person_id erforderlich' })
  }
  const rows = (await db.all(
    `SELECT t.*, sd.date, sd.day_number
       FROM timesheets t JOIN shoot_days sd ON sd.id = t.shoot_day_id
      WHERE t.project_id = ? AND t.person_type = ? AND t.person_id = ?
      ORDER BY sd.date ASC, sd.day_number ASC, t.id ASC`,
    [projectId, person_type, Number(person_id)])) as any[]
  const enriched = mitNamen(rows, await ladeNamen(projectId))
  return res.json({ data: await mitAuswertung(projectId, enriched, req), error: null })
})

// GET /api/projects/:pid/timesheets/staende - wie viele Zettel je Stand (AP E8)
router.get('/projects/:pid/timesheets/staende', async (req: Request, res: Response) => {
  const zeilen = (await db.all('SELECT status, COUNT(*) AS n FROM timesheets WHERE project_id = ? GROUP BY status', [req.params.pid])) as any[]
  const zahlen = Object.fromEntries(STAENDE.map((s) => [s, 0])) as Record<Stand, number>
  for (const z of zeilen) zahlen[istStand(z.status) ? z.status : 'erfasst'] += Number(z.n)
  return res.json({ data: { ...zahlen, nicht_freigegeben: zahlen.erfasst + zahlen.geprueft }, error: null })
})

/**
 * POST /api/projects/:pid/timesheets/stand - Sammelfreigabe (AP E8): alle
 * Zettel eines Drehtags und/oder einer Abteilung auf einen Stand, nur
 * vorwärts. Was dieses Konto nicht setzen darf, bleibt und wird gezählt.
 */
router.post('/projects/:pid/timesheets/stand', async (req: Request, res: Response) => {
  const projectId = Number(req.params.pid)
  const { status, shoot_day_id, department } = req.body ?? {}
  if (!istStand(status) || status === 'erfasst') return res.status(400).json({ data: null, error: 'Unbekannter Stand' })
  const tag = shoot_day_id === undefined || shoot_day_id === null || shoot_day_id === '' ? null : Number(shoot_day_id)
  const abteilung = typeof department === 'string' ? department.trim() : ''
  if (tag === null && !abteilung) return res.status(400).json({ data: null, error: 'Drehtag oder Abteilung angeben' })
  let drehtagNummer: number | null = null
  if (tag !== null) {
    const day = await db.get('SELECT id, day_number FROM shoot_days WHERE id = ? AND project_id = ?', [tag, projectId]) as any
    if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
    drehtagNummer = day.day_number ?? null
  }

  const [rolle, eigene, stab] = await Promise.all([
    rolleIn(req, projectId), eigeneAbteilungen(projectId, (req as any).user?.id), abteilungenDesStabs(projectId),
  ])
  const zettel = ((await db.all(
    `SELECT id, person_type, person_id, status FROM timesheets WHERE project_id = ?${tag !== null ? ' AND shoot_day_id = ?' : ''}`,
    tag !== null ? [projectId, tag] : [projectId])) as any[])
    .filter((z) => !abteilung || abteilungDes(z, stab).toLocaleLowerCase('de') === abteilung.toLocaleLowerCase('de'))

  const zuSetzen: number[] = []
  let schon = 0
  let ohneRecht = 0
  for (const z of zettel) {
    if (stufe(z.status) >= stufe(status)) { schon++; continue }
    if (darfStand(rolle, status, { status: z.status, abteilung: abteilungDes(z, stab) }, eigene)) zuSetzen.push(Number(z.id))
    else ohneRecht++
  }
  if (zuSetzen.length === 0 && ohneRecht > 0) {
    return res.status(403).json({ data: null, error: status === 'geprueft'
      ? 'Prüfen darf die Abteilungsleitung der eigenen Abteilung, dazu Regie und Produktion'
      : 'Freigeben und Abrechnen darf nur die Produktion' })
  }
  if (zuSetzen.length > 0) {
    const freigabe = stufe(status) >= stufe('freigegeben')
    await db.run(
      `UPDATE timesheets SET status = ?${freigabe ? ', approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, NOW())' : ''}
        WHERE id = ANY(?::int[])`,
      freigabe ? [status, (req as any).user?.id ?? null, zuSetzen] : [status, zuSetzen])
    // Im Protokoll lesbar: "5 Stundenzettel freigegeben (DT 1, Kamera)"
    const wo = [drehtagNummer !== null ? `DT ${drehtagNummer}` : '', abteilung].filter(Boolean).join(', ')
    logAudit(projectId, (req as any).user, `${zuSetzen.length} Stundenzettel ${STAND_NAME[status]}${wo ? ` (${wo})` : ''}`, 'Timesheet', undefined,
      undefined, { Stand: STAND_NAME[status], Anzahl: zuSetzen.length, ...(tag !== null ? { Drehtag: drehtagNummer ?? tag } : {}), ...(abteilung ? { Abteilung: abteilung } : {}) })
  }
  return res.json({ data: { geaendert: zuSetzen.length, schon, ohne_recht: ohneRecht, status }, error: null })
})

// POST /api/timesheets/:id/stand - ein Zettel (AP E8), auch zurück
router.post('/timesheets/:id/stand', async (req: Request, res: Response) => {
  const z = await db.get('SELECT * FROM timesheets WHERE id = ?', [req.params.id]) as any
  if (!z) return res.status(404).json({ data: null, error: 'Timesheet nicht gefunden' })
  const { status } = req.body ?? {}
  if (!istStand(status)) return res.status(400).json({ data: null, error: 'Unbekannter Stand' })
  const projectId = Number(z.project_id)
  const [rolle, eigene, stab] = await Promise.all([
    rolleIn(req, projectId), eigeneAbteilungen(projectId, (req as any).user?.id), abteilungenDesStabs(projectId),
  ])
  if (status !== z.status && !darfStand(rolle, status, { status: z.status, abteilung: abteilungDes(z, stab) }, eigene)) {
    return res.status(403).json({ data: null, error: gesperrt(z.status)
      ? 'Freigegebene Stundenzettel ändert nur die Produktion'
      : stufe(status) >= stufe('freigegeben')
        ? 'Freigeben und Abrechnen darf nur die Produktion'
        : 'Prüfen darf die Abteilungsleitung der eigenen Abteilung, dazu Regie und Produktion' })
  }
  if (status !== z.status) {
    if (stufe(status) >= stufe('freigegeben')) {
      await db.run('UPDATE timesheets SET status = ?, approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, NOW()) WHERE id = ?',
        [status, (req as any).user?.id ?? null, z.id])
    } else {
      // Zurück vor die Freigabe: Die alte Freigabe gilt nicht mehr
      await db.run('UPDATE timesheets SET status = ?, approved_by = NULL, approved_at = NULL WHERE id = ?', [status, z.id])
    }
    logAudit(projectId, (req as any).user, 'Stand geändert', 'Timesheet', Number(z.id),
      { Stand: STAND_NAME[istStand(z.status) ? z.status : 'erfasst'] }, { Stand: STAND_NAME[status] })
  }
  const row = await db.get('SELECT * FROM timesheets WHERE id = ?', [z.id]) as any
  const [mit] = await mitAuswertung(projectId, [await enrichWithPersonName(row)], req)
  return res.json({ data: mit, error: null })
})

// POST /api/shoot-days/:dayId/timesheets
router.post('/shoot-days/:dayId/timesheets', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const day = await db.get('SELECT * FROM shoot_days WHERE id = ?', [req.params.dayId]) as any
  if (!day) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

  const {
    person_type,
    person_id,
    call_time = null,
    wrap_time = null,
    meal_penalty = false,
    notes = '',
  } = req.body
  const break_minutes = pauseAus(req.body.break_minutes)
  if (break_minutes === null) return res.status(400).json({ data: null, error: 'Die Pause liegt zwischen 0 und 720 Minuten' })
  const travel_minutes = fahrzeitAus(req.body.travel_minutes)
  if (travel_minutes === null) return res.status(400).json({ data: null, error: 'Die Fahrzeit liegt zwischen 0 und 1440 Minuten' })

  if (!person_type || !person_id) {
    return res.status(400).json({ data: null, error: 'person_type und person_id erforderlich' })
  }

  // Vorher galt alles außer 'cast' als Stab: Eine unbekannte Art wurde mit
  // der Kennung eines Stabmitglieds gespeichert.
  if (!istPersonenart(person_type)) {
    return res.status(400).json({ data: null, error: 'Unbekannte Personenart' })
  }
  // Antwort, Liste und Gagen-Export holen den Namen über die Kennung dazu
  const personenTabelle = PERSONEN_TABELLE[person_type]
  const person = await db.get(`SELECT id FROM ${personenTabelle} WHERE id = ? AND project_id = ?`, [person_id, day.project_id])
  if (!person) return res.status(404).json({ data: null, error: 'Person nicht gefunden' })

  const overtime_hours = calcOvertimeHours(call_time, wrap_time, break_minutes, (await fahrzeitZaehlt(day.project_id)) ? travel_minutes : 0)

  const result = await db.run(
    `INSERT INTO timesheets (project_id, shoot_day_id, person_type, person_id, call_time, wrap_time, meal_penalty, overtime_hours, notes, break_minutes, travel_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [day.project_id, req.params.dayId, person_type, person_id, call_time, wrap_time, meal_penalty, overtime_hours, notes, break_minutes, travel_minutes]
  )

  const row = await db.get('SELECT * FROM timesheets WHERE id = ?', [result.id]) as any
  const [mit] = await mitAuswertung(Number(day.project_id), [await enrichWithPersonName(row)], req)
  return res.status(201).json({ data: mit, error: null })
})

// PUT /api/timesheets/:id
router.put('/timesheets/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM timesheets WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Timesheet nicht gefunden' })
  const rolle = await rolleIn(req, Number(existing.project_id))
  if (!darfAendern(rolle, existing.status)) {
    return res.status(403).json({ data: null, error: 'Freigegebene Stundenzettel ändert nur die Produktion' })
  }

  const {
    call_time = existing.call_time,
    wrap_time = existing.wrap_time,
    meal_penalty = existing.meal_penalty,
    notes = existing.notes,
  } = req.body
  const break_minutes = req.body.break_minutes === undefined ? Number(existing.break_minutes ?? 0) : pauseAus(req.body.break_minutes)
  if (break_minutes === null) return res.status(400).json({ data: null, error: 'Die Pause liegt zwischen 0 und 720 Minuten' })
  const travel_minutes = req.body.travel_minutes === undefined ? Number(existing.travel_minutes ?? 0) : fahrzeitAus(req.body.travel_minutes)
  if (travel_minutes === null) return res.status(400).json({ data: null, error: 'Die Fahrzeit liegt zwischen 0 und 1440 Minuten' })

  const overtime_hours = calcOvertimeHours(call_time, wrap_time, break_minutes, (await fahrzeitZaehlt(existing.project_id)) ? travel_minutes : 0)

  await db.run(
    'UPDATE timesheets SET call_time=?, wrap_time=?, meal_penalty=?, overtime_hours=?, notes=?, break_minutes=?, travel_minutes=? WHERE id=?',
    [call_time, wrap_time, meal_penalty, overtime_hours, notes, break_minutes, travel_minutes, req.params.id]
  )

  const row = await db.get('SELECT * FROM timesheets WHERE id = ?', [req.params.id]) as any
  // Ab "freigegeben" jede Änderung mit altem und neuem Wert ins Protokoll
  // (AP E8). Davor schreibt das allgemeine Protokoll mit.
  if (gesperrt(existing.status)) {
    const d = unterschiede(protokollFelder(existing), protokollFelder(row))
    if (d) logAudit(Number(row.project_id), (req as any).user, 'nach Freigabe geändert', 'Timesheet', Number(row.id), d.alt, d.neu)
  }
  const [mit] = await mitAuswertung(Number(row.project_id), [await enrichWithPersonName(row)], req)
  return res.json({ data: mit, error: null })
})

// DELETE /api/timesheets/:id
router.delete('/timesheets/:id', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM timesheets WHERE id = ?', [req.params.id]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Timesheet nicht gefunden' })
  if (!darfAendern(await rolleIn(req, Number(existing.project_id)), existing.status)) {
    return res.status(403).json({ data: null, error: 'Freigegebene Stundenzettel ändert nur die Produktion' })
  }

  await db.run('DELETE FROM timesheets WHERE id = ?', [req.params.id])
  if (gesperrt(existing.status)) {
    logAudit(Number(existing.project_id), (req as any).user, 'nach Freigabe gelöscht', 'Timesheet', Number(existing.id), protokollFelder(existing))
  }
  return res.json({ data: { id: parseInt(req.params.id) }, error: null })
})

// GET /api/projects/:pid/timesheets/export.csv
router.get('/projects/:pid/timesheets/export.csv', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  // Join with shoot_days to get date and day_number
  const rows = await db.all(
    `SELECT t.*, sd.date, sd.day_number
     FROM timesheets t
     JOIN shoot_days sd ON t.shoot_day_id = sd.id
     WHERE t.project_id = ?
     ORDER BY sd.date ASC, t.person_id ASC`,
    [req.params.pid]
  ) as any[]

  // Enrich with person names
  const enriched = mitNamen(rows, await ladeNamen(req.params.pid))

  // Wie jeder Export: Semikolon und Dezimalkomma (lib/tabelle.ts, Fund 92)
  const csv = schreibeCsv(
    ['Name', 'Tag', 'Datum', 'Call', 'Wrap', 'Pause (Min.)', 'Überstunden', 'Notizen', 'Fahrzeit (Min.)', 'Stand'],
    enriched.map((r: any) => [
      r.person_name || '',
      r.day_number ?? '',
      r.date ?? '',
      minutesToHHMM(r.call_time),
      minutesToHHMM(r.wrap_time),
      Number(r.break_minutes || 0),
      Number(r.overtime_hours || 0).toFixed(2).replace('.', ','),
      r.notes || '',
      Number(r.travel_minutes || 0),
      STAND_NAME[istStand(r.status) ? r.status : 'erfasst'],
    ])
  )

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="timesheets-project-${req.params.pid}.csv"`)
  return res.send(csv)
})

export default router
