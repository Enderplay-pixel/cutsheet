/**
 * Fahrdispo, alle Zeiten verschieben, Zeitplan der Szenen, Übersicht der
 * Dispos (Plan Kino-Ausbau, AP E7). Die Rechnungen stehen in
 * lib/fahrdispo.ts.
 */
import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { fahrtenAusAbholungen, verschiebeZeiten, fahrtHinweise, szenenZeitplan, EINTRAG_ZEITEN, KOPF_ZEITEN, uhr } from '../lib/fahrdispo'
import { TEIL_SPALTEN } from '../lib/board'
import { vorstoppSumme } from '../lib/vorstopp'
import { personAngaben } from '../lib/person'

const router = Router()
router.use('/projects/:projectId', requireMember)

type Lesen = { all: (sql: string, werte?: any[]) => Promise<any[]> }

/** Die Fahrten einer Dispo mit Fahrzeug, Mitfahrenden und Hinweisen. */
export async function fahrtenDerDispo(z: Lesen, sheetId: number) {
  const fahrten = await z.all(
    `SELECT r.*, v.name AS vehicle_name, v.license_plate, v.capacity, c.name AS driver_crew_name
       FROM call_sheet_rides r
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       LEFT JOIN crew c ON c.id = r.driver_crew_id
      WHERE r.call_sheet_id = ? ORDER BY r.depart_time NULLS LAST, r.sort_order, r.id`, [sheetId])
  const leute = fahrten.length
    ? await z.all('SELECT ride_id, entry_id FROM call_sheet_ride_people WHERE ride_id = ANY(?::int[])', [fahrten.map((f) => f.id)])
    : []
  const plaetze = new Map(fahrten.filter((f) => f.vehicle_id != null).map((f) => [Number(f.vehicle_id), Number(f.capacity) || 0]))
  const mit = fahrten.map((f) => ({ ...f, entry_ids: leute.filter((l) => l.ride_id === f.id).map((l) => Number(l.entry_id)) }))
  const hinweise = fahrtHinweise(mit.map((f) => ({ id: f.id, vehicle_id: f.vehicle_id, depart_time: f.depart_time, mitfahrende: f.entry_ids.length })), plaetze)
  return mit.map((f) => ({ ...f, driver: f.driver_crew_name || f.driver_name || '', hinweise: hinweise.get(f.id) ?? [] }))
}

/**
 * Zeitplan der Szenen eines Drehtags: ab Shooting Call, Banner mit ihrer
 * Dauer, von Hand gesetzte Zeiten gelten.
 */
export async function zeitplanDesTages(z: Lesen, dayId: number, shootingCall: number, mittag: number | null) {
  const szenen = await z.all(
    `SELECT 'szene' AS art, sds.scene_id AS id, sds.sort_order, sds.id AS zeile, sds.planned_start, s.scene_number, ${TEIL_SPALTEN}
       FROM shoot_day_scenes sds JOIN scenes s ON s.id = sds.scene_id WHERE sds.shoot_day_id = ?`, [dayId])
  const banner = await z.all(
    `SELECT 'banner' AS art, id, sort_order, id AS zeile, NULL AS planned_start, minutes AS estimated_minutes, text
       FROM shoot_day_banners WHERE shoot_day_id = ?`, [dayId])
  const reihe = [...szenen.map((s) => ({ ...s, rang: 0 })), ...banner.map((b) => ({ ...b, rang: 1 }))]
    .sort((a, b) => (a.sort_order - b.sort_order) || (a.rang - b.rang) || (a.zeile - b.zeile))
  return szenenZeitplan(shootingCall, reihe.map((e) => ({ art: e.art, id: Number(e.id), minuten: Number(e.estimated_minutes) || 0, von_hand: e.planned_start })), mittag)
}

async function dispo(id: number) {
  return db.get('SELECT cs.*, sd.project_id FROM call_sheets cs JOIN shoot_days sd ON sd.id = cs.shoot_day_id WHERE cs.id = ?', [id]) as Promise<any>
}

/** Angaben einer Fahrt; was nicht mitkommt, bleibt. */
async function fahrtAngaben(body: any, vorher: any, sheet: any) {
  const zeit = (w: unknown, alt: unknown) => {
    if (w === undefined) return alt ?? null
    if (w === null || w === '') return null
    const n = Number(w)
    return Number.isInteger(n) && n >= 0 && n <= 1440 ? n : undefined
  }
  const depart = zeit(body?.depart_time, vorher?.depart_time)
  if (depart === undefined) return { fehler: 'Die Abfahrt ist eine Uhrzeit zwischen 00:00 und 24:00' }
  let vehicleId = vorher?.vehicle_id ?? null
  if (body?.vehicle_id !== undefined) {
    vehicleId = body.vehicle_id === null || body.vehicle_id === '' ? null : Number(body.vehicle_id)
    if (vehicleId !== null && !(await db.get('SELECT id FROM vehicles WHERE id = ? AND project_id = ?', [vehicleId, sheet.project_id]))) {
      return { fehler: 'Fahrzeug nicht gefunden' }
    }
  }
  let fahrer = vorher?.driver_crew_id ?? null
  if (body?.driver_crew_id !== undefined) {
    fahrer = body.driver_crew_id === null || body.driver_crew_id === '' ? null : Number(body.driver_crew_id)
    if (fahrer !== null && !(await db.get('SELECT id FROM crew WHERE id = ? AND project_id = ?', [fahrer, sheet.project_id]))) {
      return { fehler: 'Person des Stabs nicht gefunden' }
    }
  }
  let eintraege: number[] | null = null
  if (body?.entry_ids !== undefined) {
    if (!Array.isArray(body.entry_ids)) return { fehler: 'Mitfahrende sind eine Liste' }
    eintraege = [...new Set(body.entry_ids.map(Number))] as number[]
    const da = await db.all('SELECT id FROM call_sheet_entries WHERE call_sheet_id = ? AND id = ANY(?::int[])', [sheet.id, eintraege]) as any[]
    if (da.length !== eintraege.length) return { fehler: 'Mitfahrende stehen auf dieser Dispo' }
  }
  const text = (k: string) => (body?.[k] === undefined ? String(vorher?.[k] ?? '') : String(body[k] ?? '').trim().slice(0, 200))
  return { werte: { vehicle_id: vehicleId, driver_crew_id: fahrer, driver_name: text('driver_name'), depart_time: depart, from_place: text('from_place'), to_place: text('to_place') }, eintraege }
}

async function mitfahrendeSetzen(tx: { run: (s: string, w?: any[]) => Promise<any> }, rideId: number, eintraege: number[]) {
  await tx.run('DELETE FROM call_sheet_ride_people WHERE ride_id = ?', [rideId])
  for (const e of eintraege) await tx.run('INSERT INTO call_sheet_ride_people (ride_id, entry_id) VALUES (?, ?)', [rideId, e])
}

// POST /api/call-sheets/:id/rides
router.post('/call-sheets/:id/rides', async (req, res) => {
  const sheet = await dispo(Number(req.params.id))
  if (!sheet) return res.status(404).json({ data: null, error: 'Dispo nicht gefunden' })
  const a = await fahrtAngaben(req.body, null, sheet)
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  const w = a.werte
  const neu = await db.transaction(async (tx) => {
    const id = (await tx.run(
      `INSERT INTO call_sheet_rides (call_sheet_id, vehicle_id, driver_crew_id, driver_name, depart_time, from_place, to_place, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM call_sheet_rides WHERE call_sheet_id = ?))`,
      [sheet.id, w.vehicle_id, w.driver_crew_id, w.driver_name, w.depart_time, w.from_place, w.to_place, sheet.id])).id
    if (a.eintraege) await mitfahrendeSetzen(tx, id, a.eintraege)
    return id
  })
  res.status(201).json({ data: (await fahrtenDerDispo(db, sheet.id)).find((f) => f.id === neu), error: null })
})

// PUT /api/call-sheet-rides/:id
router.put('/call-sheet-rides/:id', async (req, res) => {
  const vorher = await db.get('SELECT * FROM call_sheet_rides WHERE id = ?', [req.params.id]) as any
  if (!vorher) return res.status(404).json({ data: null, error: 'Fahrt nicht gefunden' })
  const sheet = await dispo(Number(vorher.call_sheet_id))
  const a = await fahrtAngaben(req.body, vorher, sheet)
  if ('fehler' in a) return res.status(400).json({ data: null, error: a.fehler })
  const w = a.werte
  await db.transaction(async (tx) => {
    await tx.run(
      'UPDATE call_sheet_rides SET vehicle_id = ?, driver_crew_id = ?, driver_name = ?, depart_time = ?, from_place = ?, to_place = ? WHERE id = ?',
      [w.vehicle_id, w.driver_crew_id, w.driver_name, w.depart_time, w.from_place, w.to_place, vorher.id])
    if (a.eintraege) await mitfahrendeSetzen(tx, vorher.id, a.eintraege)
  })
  res.json({ data: (await fahrtenDerDispo(db, sheet.id)).find((f) => f.id === vorher.id), error: null })
})

// DELETE /api/call-sheet-rides/:id
router.delete('/call-sheet-rides/:id', async (req, res) => {
  await db.run('DELETE FROM call_sheet_rides WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/call-sheets/:id/rides/vorschlag
// Aus den Abholungen: je Zeit und Ort eine Fahrt, ohne die Personen, die
// schon in einer Fahrt sitzen (Soll 2)
router.post('/call-sheets/:id/rides/vorschlag', async (req, res) => {
  const sheet = await dispo(Number(req.params.id))
  if (!sheet) return res.status(404).json({ data: null, error: 'Dispo nicht gefunden' })
  const eintraege = await db.all(
    `SELECT e.id, e.pickup_time, e.pickup_location FROM call_sheet_entries e
      WHERE e.call_sheet_id = ? AND NOT EXISTS (SELECT 1 FROM call_sheet_ride_people p WHERE p.entry_id = e.id)
      ORDER BY e.sort_order, e.id`, [sheet.id]) as any[]
  const vorschlag = fahrtenAusAbholungen(eintraege)
  // Ziel ist der Drehort des Tages, soweit bekannt
  const ort = await db.get('SELECT l.name FROM locations l WHERE l.id = ?', [sheet.location_id]) as any
  await db.transaction(async (tx) => {
    for (const f of vorschlag) {
      const id = (await tx.run(
        `INSERT INTO call_sheet_rides (call_sheet_id, depart_time, from_place, to_place, sort_order)
         VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM call_sheet_rides WHERE call_sheet_id = ?))`,
        [sheet.id, f.depart_time, f.from_place, ort?.name ?? '', sheet.id])).id
      await mitfahrendeSetzen(tx, id, f.eintraege)
    }
  })
  res.status(201).json({ data: { neu: vorschlag.length, fahrten: await fahrtenDerDispo(db, sheet.id) }, error: null })
})

/** Die Zeiten einer Dispo für `verschiebeZeiten`. */
async function zeitenDerDispo(sheet: any) {
  const entries = await db.all(`SELECT id, ${EINTRAG_ZEITEN.join(', ')} FROM call_sheet_entries WHERE call_sheet_id = ?`, [sheet.id]) as any[]
  const rides = await db.all('SELECT id, depart_time FROM call_sheet_rides WHERE call_sheet_id = ?', [sheet.id]) as any[]
  return { ...Object.fromEntries(KOPF_ZEITEN.map((k) => [k, sheet[k]])), entries, rides }
}

// POST /api/call-sheets/:id/zeiten-verschieben { minuten, nurZeigen }
// Alle Zeiten der Dispo früher oder später (Soll 4). Mit `nurZeigen` nur
// die Vorschau; rückgängig ist dasselbe mit der Gegenzahl.
router.post('/call-sheets/:id/zeiten-verschieben', async (req, res) => {
  const sheet = await dispo(Number(req.params.id))
  if (!sheet) return res.status(404).json({ data: null, error: 'Dispo nicht gefunden' })
  const minuten = Number(req.body?.minuten)
  if (!Number.isInteger(minuten) || minuten === 0 || Math.abs(minuten) > 720) {
    return res.status(400).json({ data: null, error: 'Verschoben wird um 1 bis 720 Minuten früher oder später' })
  }
  const { aenderungen, fehler } = verschiebeZeiten(await zeitenDerDispo(sheet), minuten)
  if (fehler) return res.status(400).json({ data: null, error: fehler })
  const gc = aenderungen.find((a) => a.feld === 'general_call')
  const vorschau = { anzahl: aenderungen.length, general_call: gc ? { alt: gc.alt, neu: gc.neu } : null, minuten }
  if (req.body?.nurZeigen === true) return res.json({ data: vorschau, error: null })
  await db.transaction(async (tx) => {
    for (const a of aenderungen) {
      if (a.wo === 'kopf') await tx.run(`UPDATE call_sheets SET ${a.feld} = ?, updated_at = NOW() WHERE id = ?`, [a.neu, sheet.id])
      else if (a.wo === 'eintrag') await tx.run(`UPDATE call_sheet_entries SET ${a.feld} = ? WHERE id = ?`, [a.neu, a.id])
      else await tx.run('UPDATE call_sheet_rides SET depart_time = ? WHERE id = ?', [a.neu, a.id])
    }
  })
  res.json({ data: vorschau, error: null })
})

// PUT /api/shoot-days/:dayId/zeitplan { scene_id, beginn }: geplanter
// Beginn einer Szene von Hand, null nimmt die Rechnung (Soll 5)
router.put('/shoot-days/:dayId/zeitplan', async (req, res) => {
  const beginn = req.body?.beginn === null || req.body?.beginn === '' ? null : Number(req.body?.beginn)
  if (beginn !== null && (!Number.isInteger(beginn) || beginn < 0 || beginn > 1440)) {
    return res.status(400).json({ data: null, error: 'Der Beginn ist eine Uhrzeit zwischen 00:00 und 24:00' })
  }
  const r = await db.run('UPDATE shoot_day_scenes SET planned_start = ? WHERE shoot_day_id = ? AND scene_id = ?', [beginn, req.params.dayId, req.body?.scene_id])
  if (!r.changes) return res.status(404).json({ data: null, error: 'Die Szene steht nicht an diesem Drehtag' })
  res.json({ data: { ok: true }, error: null })
})

// GET /api/projects/:projectId/dispos - Übersicht aller Dispos (Soll 6)
router.get('/projects/:projectId/dispos', async (req, res) => {
  const tage = await db.all(
    `SELECT sd.id, sd.day_number, sd.date, sd.status, cs.id AS dispo_id, cs.general_call, cs.shooting_call, cs.planned_wrap,
            (SELECT COUNT(*)::int FROM call_sheet_entries e WHERE e.call_sheet_id = cs.id) AS personen,
            (SELECT COUNT(*)::int FROM call_sheet_entries e WHERE e.call_sheet_id = cs.id AND e.sent_at IS NOT NULL) AS verschickt,
            (SELECT COUNT(*)::int FROM call_sheet_entries e WHERE e.call_sheet_id = cs.id AND e.confirmed_at IS NOT NULL) AS bestaetigt
       FROM shoot_days sd LEFT JOIN call_sheets cs ON cs.shoot_day_id = sd.id
      WHERE sd.project_id = ? ORDER BY (sd.date = '') ASC, sd.date ASC, sd.day_number ASC`, [req.params.projectId]) as any[]
  const szenen = tage.length
    ? await db.all(
      `SELECT sds.shoot_day_id, s.scene_number, ${TEIL_SPALTEN} FROM shoot_day_scenes sds JOIN scenes s ON s.id = sds.scene_id
        WHERE sds.shoot_day_id = ANY(?::int[]) ORDER BY sds.sort_order, sds.id`, [tage.map((t) => t.id)]) as any[]
    : []
  const einstellung = await db.get('SELECT default_wrap_time FROM project_settings WHERE project_id = ?', [req.params.projectId]) as any
  res.json({
    data: tage.map((t) => {
      const eigene = szenen.filter((s) => s.shoot_day_id === t.id)
      return {
        ...t,
        planned_wrap: t.planned_wrap ?? (t.dispo_id ? einstellung?.default_wrap_time ?? null : null),
        szenen: eigene.map((s) => s.scene_number),
        achtel: eigene.reduce((n, s) => n + (Number(s.eighths) || 0), 0),
        vorstopp: vorstoppSumme(eigene),
      }
    }),
    error: null,
  })
})

/** Zeiten und Fahrt einer Person für ihre persönliche Dispo-Seite. */
export async function meineFahrt(entryId: number, sheetId: number) {
  const fahrt = (await fahrtenDerDispo(db, sheetId)).find((f) => f.entry_ids.includes(entryId))
  if (!fahrt) return null
  return {
    depart_time: fahrt.depart_time, from_place: fahrt.from_place, to_place: fahrt.to_place,
    fahrzeug: [fahrt.vehicle_name, fahrt.license_plate].filter(Boolean).join(' · '), fahrer: fahrt.driver,
    abfahrt: fahrt.depart_time != null ? uhr(fahrt.depart_time) : '',
  }
}

/** Namen der Mitfahrenden für das PDF. */
export async function mitfahrendeNamen(entryIds: number[]) {
  if (entryIds.length === 0) return []
  const zeilen = await db.all('SELECT person_type, person_id FROM call_sheet_entries WHERE id = ANY(?::int[]) ORDER BY sort_order, id', [entryIds]) as any[]
  return Promise.all(zeilen.map(async (z) => (await personAngaben(z.person_type, z.person_id))?.name ?? ''))
}

export default router
