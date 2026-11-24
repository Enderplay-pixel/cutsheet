import { Router } from 'express'
import { db, TxClient } from '../db'
import { besetzungNachziehen } from '../lib/dispo'
import { getUserProjectRole, requireMember, ROLE_RANK } from '../middleware/projectAuth'
import { istIsoDatum } from '../lib/datum'
import { KEIN_DREHTAG } from '../lib/drehtage'
import { teileEin, wochentageAus, naechsterArbeitstag, folgetageVerschieben, plaetzeAb, arbeitstageAb, plusTage } from '../lib/board'
import { getHolidays } from '../services/holidays'
import { inDenPapierkorb } from '../lib/papierkorb'
import { hauptUnit, unitDesProjekts, effektiveUnit } from '../lib/units'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

/** Datenbank oder Transaktion - was die Helfer unten zum Lesen und Schreiben brauchen. */
type Zugriff = Pick<TxClient, 'get' | 'all' | 'run'>

/**
 * Drehtage durchnummerieren - nach Datum, nicht nach Anlegereihenfolge.
 *
 * Gemessen am 26.09.2026: wer nachträglich einen früheren Tag anlegt, bekam
 * die nächste freie Nummer. Ein Plan mit Tag 3 am 5. November und Tag 1 am
 * 10. November ist kein Plan. Nachgeschobene Tage - ein Nachdreh, ein
 * vergessenes Motiv - sind in der Produktion die Regel.
 *
 * Gleiches Datum: die zuerst angelegte Zeile bleibt vorn. Tage ohne Datum
 * ('' aus der Zeit, bevor es Pflicht war) kommen ans Ende - gemessen am
 * 25.10.2026 wurde so ein Tag "Drehtag 1" und schob den echten ersten Tag
 * auf Nummer 2.
 *
 * Gezählt wird je Unit (AP C2): "Tag 5" der Haupteinheit und "2U Tag 3"
 * können auf demselben Datum liegen.
 */
export async function nummeriereDrehtage(projectId: number | string, tx?: TxClient) {
  const zaehlen = async (z: Zugriff) => {
    await z.run(
      `UPDATE shoot_days sd SET day_number = n.nr
         FROM (SELECT d.id, ROW_NUMBER() OVER (PARTITION BY ${effektiveUnit('d')} ORDER BY (d.date = '') ASC, d.date ASC, d.id ASC) AS nr
                 FROM shoot_days d WHERE d.project_id = ?) n
        WHERE n.id = sd.id AND sd.day_number IS DISTINCT FROM n.nr`,
      [projectId]
    )
  }
  // In einer laufenden Transaktion mitzählen, sonst in einer eigenen
  if (tx) await zaehlen(tx)
  else await db.transaction(zaehlen)
}

/**
 * Die Unit, der ein neuer Tag gehört: die genannte, sonst die Haupteinheit.
 * null heißt: genannt, aber nicht in diesem Projekt.
 */
async function unitFuerNeuenTag(projectId: number | string, unitId: unknown) {
  if (unitId === undefined || unitId === null || unitId === '') return hauptUnit(db, projectId)
  return unitDesProjekts(db, projectId, unitId)
}
const UNIT_FEHLT = 'Die Unit gehört nicht zu diesem Projekt'

/**
 * Szenen und Banner eines Tages zusammenrechnen. Ein Banner ("Umzug zum
 * Hafen - 45 Min.") zählt zur Drehzeit des Tages, nicht zu den Seiten
 * (Plan Kino-Ausbau, AP A2, Soll 8).
 */
function tagMitSummen(day: any, scenes: any[], banner: any[]) {
  return {
    ...day,
    scenes,
    banner,
    total_eighths: scenes.reduce((sum: number, s: any) => sum + (s.eighths || 0), 0),
    estimated_minutes: scenes.reduce((sum: number, s: any) => sum + (s.estimated_minutes || 0), 0)
      + banner.reduce((sum: number, b: any) => sum + (Number(b.minutes) || 0), 0),
  }
}

/** Die Unit eines Tages kommt mit (AP C2): Name, Kürzel, Farbe, Haupteinheit. */
const UNIT_SPALTEN = `u.name AS unit_name, u.short AS unit_short, u.color AS unit_color, COALESCE(u.is_main, true) AS unit_is_main`
const UNIT_JOIN = (d: string) => `LEFT JOIN units u ON u.id = ${effektiveUnit(d)}`

async function getShootDayWithScenes(dayId: number | bigint) {
  const day = await db.get(`SELECT d.*, ${UNIT_SPALTEN} FROM shoot_days d ${UNIT_JOIN('d')} WHERE d.id = ?`, [dayId]) as any
  if (!day) return null
  // sds.id als zweite Ordnung: Die Spaltenansicht legt jede gezogene Szene
  // mit sort_order 0 ab - ohne zweite Ordnung war die Reihenfolge Zufall.
  const scenes = await db.all(`
    SELECT sds.*, s.scene_number, s.title, s.int_ext, s.day_night, s.eighths, s.estimated_minutes, s.description, s.notes,
           s.location_id, l.name as location_name
    FROM shoot_day_scenes sds
    JOIN scenes s ON sds.scene_id = s.id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE sds.shoot_day_id = ?
    ORDER BY sds.sort_order ASC, sds.id ASC
  `, [dayId])
  const banner = await db.all('SELECT * FROM shoot_day_banners WHERE shoot_day_id = ? ORDER BY sort_order ASC, id ASC', [dayId])
  return tagMitSummen(day, scenes as any[], banner as any[])
}

/**
 * Alle Drehtage eines Projekts mit ihren Szenen - in zwei Abfragen.
 *
 * Vorher lief je Drehtag ein eigenes `getShootDayWithScenes`, also zwei
 * Abfragen pro Tag. Gemessen an einer Produktion mit 45 Drehtagen: 1,95
 * Sekunden, während jede andere Route desselben Projekts unter 0,2 Sekunden
 * blieb. Mit zwei Abfragen und Zuordnung im Speicher sind es Millisekunden,
 * und die Dauer wächst nicht mehr mit der Zahl der Drehtage.
 */
export async function ladeDrehtageMitSzenen(projectId: number | string) {
  // Die Banner der Tage (AP A2) kommen in derselben Abfrage mit, als Liste je
  // Tag - eine dritte Abfrage hätte die Regel oben gebrochen.
  const tage = (await db.all(
    `SELECT d.*, ${UNIT_SPALTEN}, COALESCE((SELECT json_agg(b ORDER BY b.sort_order, b.id) FROM shoot_day_banners b WHERE b.shoot_day_id = d.id), '[]'::json) AS banner
       FROM shoot_days d ${UNIT_JOIN('d')} WHERE d.project_id = ? ORDER BY (d.date = '') ASC, d.date ASC, d.id ASC`,
    [projectId]
  )) as any[]
  if (tage.length === 0) return []

  const szenen = (await db.all(
    `SELECT sds.*, s.scene_number, s.title, s.int_ext, s.day_night, s.eighths,
            s.estimated_minutes, s.description, s.notes, s.location_id, l.name as location_name
       FROM shoot_day_scenes sds
       JOIN scenes s ON sds.scene_id = s.id
       LEFT JOIN locations l ON s.location_id = l.id
       JOIN shoot_days d ON d.id = sds.shoot_day_id
      WHERE d.project_id = ?
      ORDER BY sds.sort_order ASC, sds.id ASC`,
    [projectId]
  )) as any[]
  const jeTag = new Map<number, any[]>()
  for (const szene of szenen) {
    const liste = jeTag.get(szene.shoot_day_id)
    if (liste) liste.push(szene)
    else jeTag.set(szene.shoot_day_id, [szene])
  }

  return tage.map((tag) => tagMitSummen(tag, jeTag.get(tag.id) ?? [], tag.banner ?? []))
}

// GET /api/projects/:projectId/shoot-days
router.get('/projects/:projectId/shoot-days', async (req, res) => {
  res.json({ data: await ladeDrehtageMitSzenen(req.params.projectId), error: null })
})

// POST /api/projects/:projectId/shoot-days
// Ein Drehtag hat ein Datum. Die Spalte ist Text; gemessen am 25.10.2026
// nahm der Server "abc", "x" und '' an.
const DREHTAG_DATUM_FEHLER = 'Ein Drehtag braucht ein Datum (JJJJ-MM-TT)'

router.post('/projects/:projectId/shoot-days', async (req, res) => {
  const { date, status = 'Geplant', notes = '' } = req.body
  if (!istIsoDatum(date)) return res.status(400).json({ data: null, error: DREHTAG_DATUM_FEHLER })
  const unit = await unitFuerNeuenTag(req.params.projectId, req.body?.unit_id)
  if (!unit) return res.status(400).json({ data: null, error: UNIT_FEHLT })
  const result = await db.run('INSERT INTO shoot_days (project_id, day_number, date, status, unit, unit_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.params.projectId, 0, date, status, unit.name, unit.id, notes])
  await nummeriereDrehtage(req.params.projectId)
  res.status(201).json({ data: await getShootDayWithScenes(result.id), error: null })
})

// POST /api/projects/:projectId/shoot-days/batch - create multiple days from a date range
router.post('/projects/:projectId/shoot-days/batch', async (req, res) => {
  const { dates } = req.body   // string[] of 'YYYY-MM-DD'
  if (!Array.isArray(dates) || dates.length === 0)
    return res.status(400).json({ data: null, error: 'dates ist eine Liste von Daten (JJJJ-MM-TT)' })
  if (!dates.every(istIsoDatum)) return res.status(400).json({ data: null, error: DREHTAG_DATUM_FEHLER })
  const unit = await unitFuerNeuenTag(req.params.projectId, req.body?.unit_id)
  if (!unit) return res.status(400).json({ data: null, error: UNIT_FEHLT })

  const neueIds: any[] = []
  for (const date of dates) {
    const result = await db.run(
      'INSERT INTO shoot_days (project_id, day_number, date, status, unit, unit_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.projectId, 0, date, 'Geplant', unit.name, unit.id, '']
    )
    neueIds.push(result.id)
  }
  await nummeriereDrehtage(req.params.projectId)

  const created: any[] = []
  for (const id of neueIds) {
    const day = await getShootDayWithScenes(id)
    if (day) created.push(day)
  }
  res.status(201).json({ data: created, error: null })
})

// PUT /api/shoot-days/:id
router.put('/shoot-days/:id', async (req, res) => {
  // Gemessen am 25.10.2026: Ein Tag, den es nicht gibt, ergab 200 ohne Daten.
  const vorher = await db.get('SELECT id, project_id FROM shoot_days WHERE id = ?', [req.params.id]) as any
  if (!vorher) {
    return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
  }
  const { date, status, notes, catering_count } = req.body
  if (date !== undefined && date !== null && !istIsoDatum(date)) {
    return res.status(400).json({ data: null, error: DREHTAG_DATUM_FEHLER })
  }
  // Die Unit wechseln (AP C2): der Tag zählt dann in ihrer Folge
  let unit: { id: number; name: string } | null = null
  if (req.body?.unit_id !== undefined && req.body.unit_id !== null) {
    unit = await unitDesProjekts(db, vorher.project_id, req.body.unit_id)
    if (!unit) return res.status(400).json({ data: null, error: UNIT_FEHLT })
  }
  await db.run('UPDATE shoot_days SET date=COALESCE(?,date), status=COALESCE(?,status), unit=COALESCE(?,unit), unit_id=COALESCE(?,unit_id), notes=COALESCE(?,notes), catering_count=COALESCE(?,catering_count) WHERE id=?',
    [date ?? null, status ?? null, unit?.name ?? null, unit?.id ?? null, notes ?? null, catering_count ?? null, req.params.id])
  if (date || unit) {
    // Ein verschobener Tag aendert die Reihenfolge des ganzen Plans.
    const tag = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [req.params.id]) as any
    if (tag) await nummeriereDrehtage(tag.project_id)
  }
  res.json({ data: await getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// DELETE /api/shoot-days/:id
router.delete('/shoot-days/:id', async (req, res) => {
  // Re-number remaining days
  const day = await db.get('SELECT * FROM shoot_days WHERE id = ?', [req.params.id]) as any
  if (day) {
    await db.run('DELETE FROM shoot_days WHERE id = ?', [req.params.id])
    // Nicht "alle darueber minus eins": teilen sich zwei Tage eine Nummer,
    // rutschen sie damit uebereinander. Neu durchzaehlen ist eindeutig.
    await nummeriereDrehtage(day.project_id)
  }
  res.json({ data: { ok: true }, error: null })
})

// POST /api/shoot-days/:id/scenes
router.post('/shoot-days/:id/scenes', async (req, res) => {
  const { scene_id, sort_order = 0, estimated_minutes = null } = req.body
  // Der Drehtag holt die Szenen per JOIN dazu - eine Szene aus einem fremden
  // Projekt stünde sonst mit Titel und Motiv in diesem Drehplan.
  const szene = await db.get(
    'SELECT s.id, s.omitted FROM scenes s JOIN shoot_days sd ON sd.project_id = s.project_id WHERE s.id = ? AND sd.id = ?',
    [scene_id, req.params.id]
  ) as any
  if (!szene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  if (szene.omitted) return res.status(400).json({ data: null, error: 'Eine entfallene Szene lässt sich nicht einplanen' })
  try {
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order, estimated_minutes) VALUES (?, ?, ?, ?)', [req.params.id, scene_id, sort_order, estimated_minutes])
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.message?.includes('unique')) {
      return res.status(409).json({ data: null, error: 'Szene bereits in diesem Drehtag' })
    }
    throw e
  }
  // Die Besetzung der Szene kommt in die Dispo des Tages (lib/dispo.ts)
  await besetzungNachziehen(db, { tage: [Number(req.params.id)] })
  res.json({ data: await getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// DELETE /api/shoot-days/:dayId/scenes/:sceneId
router.delete('/shoot-days/:dayId/scenes/:sceneId', async (req, res) => {
  await db.run('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ? AND scene_id = ?', [req.params.dayId, req.params.sceneId])
  res.json({ data: await getShootDayWithScenes(parseInt(req.params.dayId)), error: null })
})

// PUT /api/shoot-days/:id/scenes/reorder
router.put('/shoot-days/:id/scenes/reorder', async (req, res) => {
  const { order } = req.body // array of { sceneId, sortOrder }
  // Ohne Liste vorher 500.
  if (!Array.isArray(order)) return res.status(400).json({ data: null, error: 'order muss eine Liste sein' })
  await db.transaction(async (tx) => {
    for (const item of order as { sceneId: number; sortOrder: number }[]) {
      await tx.run('UPDATE shoot_day_scenes SET sort_order = ? WHERE shoot_day_id = ? AND scene_id = ?', [item.sortOrder, req.params.id, item.sceneId])
    }
  })
  res.json({ data: await getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// POST /api/shoot-days/move-scene
/**
 * Die einzige schreibende Route ohne Ressourcen-ID im Pfad: Szene und
 * Drehtag stehen im Koerper. projectWriteGuard findet dort kein Projekt und
 * liess deshalb jeden durch - am 26.09.2026 nachgemessen: ein fremdes Konto
 * konnte Szenen im fremden Drehplan verschieben. Die Pruefung muss hier
 * selbst stehen.
 */
router.post('/shoot-days/move-scene', async (req, res) => {
  const { sceneId, fromDayId, toDayId, sortOrder = 0 } = req.body

  const nutzer = (req as any).user
  if (!nutzer) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const szene = await db.get('SELECT project_id, omitted FROM scenes WHERE id = ?', [sceneId]) as any
  if (szene?.omitted && toDayId) return res.status(400).json({ data: null, error: 'Eine entfallene Szene lässt sich nicht einplanen' })
  const ziel = toDayId
    ? await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [toDayId]) as any
    : null
  const projektId = szene?.project_id ?? ziel?.project_id
  if (!projektId) return res.status(404).json({ data: null, error: 'Szene oder Drehtag nicht gefunden' })

  // Szene und Zieltag muessen zum selben Projekt gehoeren, sonst waere die
  // Zuordnung ueber Projektgrenzen hinweg moeglich.
  if (ziel && Number(ziel.project_id) !== Number(projektId)) {
    return res.status(400).json({ data: null, error: 'Szene und Drehtag gehören zu verschiedenen Projekten.' })
  }

  // Nicht nur Mitglied, sondern mit Schreibrecht - wie projectWriteGuard, der
  // diesen Pfad nicht auflösen kann (kein Projekt, keine Kennung im Pfad).
  // Gemessen am 25.10.2026: Ein Leser schob Szenen auf andere Drehtage.
  if (nutzer.role !== 'admin') {
    const rolle = await getUserProjectRole(nutzer.id, projektId)
    if (rolle === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    if ((ROLE_RANK[rolle] ?? 0) < ROLE_RANK.dept_head) {
      return res.status(403).json({ data: null, error: 'Du hast nur Lesezugriff auf dieses Projekt.' })
    }
  }

  await db.transaction(async (tx) => {
    // Aus ALLEN Drehtagen entfernen, nicht nur aus dem, den der Client fuer
    // den aktuellen haelt. Sonst landet die Szene bei einem veralteten Stand
    // oder zwei gleichzeitigen Zuegen an mehreren Tagen - nachgemessen am
    // 23.09.2026: zwei parallele Aufrufe, danach lag die Szene an Tag 2 UND 3,
    // und jede Folgerechnung zaehlte sie doppelt.
    await tx.run('DELETE FROM shoot_day_scenes WHERE scene_id = ?', [sceneId])
    void fromDayId
    if (toDayId) {
      try {
        await tx.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?)', [toDayId, sceneId, sortOrder])
      } catch (e: any) {
        if (!e.message?.includes('UNIQUE') && !e.message?.includes('unique')) throw e
        await tx.run('UPDATE shoot_day_scenes SET sort_order = ? WHERE shoot_day_id = ? AND scene_id = ?', [sortOrder, toDayId, sceneId])
      }
      await besetzungNachziehen(tx, { tage: [Number(toDayId)] })
    }
  })

  res.json({ data: { ok: true }, error: null })
})

// ─── Board des Stäbchenplans (Plan Kino-Ausbau, AP A2) ───────────────────────
//
// Das Board zeigt je Drehtag Szenen und Banner in einer Reihe. Beide teilen
// sich `sort_order`; die Helfer hier lesen und schreiben die Reihe als
// Ganzes, damit nach jeder Änderung 0, 1, 2, ... dasteht.

type Eintrag = { art: 'szene' | 'banner'; id: number }

/** Szenen und Banner eines Tages in ihrer Reihenfolge. Bei gleicher Stelle zuerst die Szene, dann die ältere Zeile. */
async function eintraegeDesTags(z: Zugriff, tagId: number): Promise<Eintrag[]> {
  const zeilen = (await z.all(
    `SELECT 'szene' AS art, scene_id AS id, sort_order, id AS zeile, 0 AS rang FROM shoot_day_scenes WHERE shoot_day_id = ?
     UNION ALL
     SELECT 'banner', id, sort_order, id, 1 FROM shoot_day_banners WHERE shoot_day_id = ?
     ORDER BY sort_order ASC, rang ASC, zeile ASC`,
    [tagId, tagId])) as any[]
  return zeilen.map((r) => ({ art: r.art, id: Number(r.id) }))
}

/**
 * Die Einträge in dieser Reihenfolge in den Tag schreiben. Eine Szene, die
 * schon im Tag steht, behält ihre Zeile - und damit die am Set gemessenen
 * Minuten aus dem Tagesbericht.
 */
async function schreibeReihenfolge(z: Zugriff, tagId: number, eintraege: Eintrag[]) {
  for (const [i, e] of eintraege.entries()) {
    if (e.art === 'banner') {
      await z.run('UPDATE shoot_day_banners SET shoot_day_id = ?, sort_order = ? WHERE id = ?', [tagId, i, e.id])
    } else {
      const r = await z.run('UPDATE shoot_day_scenes SET sort_order = ? WHERE shoot_day_id = ? AND scene_id = ?', [i, tagId, e.id])
      if (r.changes === 0) await z.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?)', [tagId, e.id, i])
    }
  }
}

const ordneTag = async (z: Zugriff, tagId: number) => schreibeReihenfolge(z, tagId, await eintraegeDesTags(z, tagId))

/** Ganze positive Zahlen ohne Doppelte, in ihrer Reihenfolge - null bei Unsinn. */
function kennungen(wert: unknown): number[] | null {
  if (!Array.isArray(wert)) return null
  const zahlen = wert.map(Number)
  if (!zahlen.every((z) => Number.isInteger(z) && z > 0)) return null
  return [...new Set(zahlen)]
}

/** Die Stelle vor dem Eintrag `vor`, ohne `vor` das Ende. -1: Den Eintrag gibt es dort nicht. */
function stelleVor(eintraege: Eintrag[], vor: any): number {
  if (vor == null) return eintraege.length
  return eintraege.findIndex((e) => e.art === vor.art && e.id === Number(vor.id))
}

const STELLE_FEHLT = 'Die Stelle, vor der eingefügt werden soll, liegt nicht in diesem Drehtag'

/**
 * Arbeitstage und Feiertage des Projekts. Feiertage für drei Jahre ab
 * `abJahr` - ein Plan, der über Silvester läuft, kennt so auch Neujahr.
 * Ohne Bundesland zählen nur die bundesweiten Feiertage.
 */
async function kalenderDesProjekts(projectId: number, abJahr: number) {
  const s = (await db.get('SELECT work_weekdays, state FROM project_settings WHERE project_id = ?', [projectId])) as any
  const wochentage = s ? wochentageAus(s.work_weekdays) : [1, 2, 3, 4, 5]
  const feiertage = [0, 1, 2].flatMap((i) => getHolidays(abJahr + i, s?.state ?? '').map((f) => f.date))
  return { wochentage, feiertage }
}

const deDatum = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

/** Tage, die nie verschoben werden: abgedreht oder mit verschickter Dispo (Soll 5). */
async function stehenImWeg(tage: any[]): Promise<any[]> {
  if (tage.length === 0) return []
  const verschickt = new Set(((await db.all(
    `SELECT DISTINCT cs.shoot_day_id FROM call_sheets cs JOIN call_sheet_entries e ON e.call_sheet_id = cs.id
      WHERE cs.shoot_day_id = ANY(?::int[]) AND e.sent_at IS NOT NULL`,
    [tage.map((t) => Number(t.id))])) as any[]).map((r) => Number(r.shoot_day_id)))
  return tage.filter((t) => t.status === 'Abgedreht' || verschickt.has(Number(t.id)))
}

// GET /api/projects/:projectId/drehplan/arbeitstage?von=…&bis=…&wochenenden=1
// Die Arbeitstage im Zeitraum, ohne Feiertage des Bundeslands - für den
// Dialog "Zeitraum anlegen" (Nachtrag zu AP A2). Vorher legte er auch Samstag
// und Sonntag an. Mit `wochenenden=1` zählt jeder Wochentag, Feiertage
// fallen weiter weg. Dieselbe Rechnung wie beim Einteilen (lib/board.ts).
router.get('/projects/:projectId/drehplan/arbeitstage', async (req, res) => {
  const von = String(req.query.von ?? '')
  const bis = String(req.query.bis ?? '')
  if (!istIsoDatum(von) || !istIsoDatum(bis)) return res.status(400).json({ data: null, error: 'Von und bis sind ein Datum (JJJJ-MM-TT)' })
  if (bis < von) return res.status(400).json({ data: null, error: 'Das Ende liegt vor dem Beginn' })
  if (bis > plusTage(von, 365)) return res.status(400).json({ data: null, error: 'Ein Zeitraum umfasst höchstens 366 Tage' })
  const { wochentage, feiertage } = await kalenderDesProjekts(Number(req.params.projectId), Number(von.slice(0, 4)))
  const alle = req.query.wochenenden === '1' ? [1, 2, 3, 4, 5, 6, 7] : wochentage
  res.json({ data: arbeitstageAb(von, 367, alle, feiertage).filter((d) => d <= bis), error: null })
})

// POST /api/projects/:projectId/drehplan/verschieben
// { szenen, zielTag, vor }: die Szenen in ihrer Reihenfolge vor den Eintrag
// `vor` setzen, ohne `vor` ans Ende, ohne Zieltag zurück in die Ablage.
router.post('/projects/:projectId/drehplan/verschieben', async (req, res) => {
  const pid = Number(req.params.projectId)
  const szenen = kennungen(req.body?.szenen)
  if (!szenen || szenen.length === 0) return res.status(400).json({ data: null, error: 'Keine Szene zum Verschieben angegeben' })
  const zielTag = req.body?.zielTag == null ? null : Number(req.body.zielTag)
  const vor = req.body?.vor ?? null

  const eigene = (await db.all('SELECT id, omitted FROM scenes WHERE project_id = ? AND id = ANY(?::int[])', [pid, szenen])) as any[]
  if (eigene.length !== szenen.length) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  if (zielTag !== null && eigene.some((s) => s.omitted)) return res.status(400).json({ data: null, error: 'Eine entfallene Szene lässt sich nicht einplanen' })
  if (zielTag !== null) {
    const tag = Number.isInteger(zielTag)
      ? (await db.get('SELECT status FROM shoot_days WHERE id = ? AND project_id = ?', [zielTag, pid])) as any
      : null
    if (!tag) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
    if (tag.status === 'Sperrtag') return res.status(400).json({ data: null, error: 'Auf einen Sperrtag lassen sich keine Szenen legen' })
    const bleiben = (await eintraegeDesTags(db, zielTag)).filter((e) => !(e.art === 'szene' && szenen.includes(e.id)))
    if (stelleVor(bleiben, vor) < 0) return res.status(400).json({ data: null, error: STELLE_FEHLT })
  }

  await db.transaction(async (tx) => {
    const quellen = ((await tx.all('SELECT DISTINCT shoot_day_id FROM shoot_day_scenes WHERE scene_id = ANY(?::int[])', [szenen])) as any[])
      .map((r) => Number(r.shoot_day_id))
      .filter((t) => t !== zielTag)
    // Aus allen anderen Tagen lösen, nicht nur aus dem, den die Seite kennt
    // (wie bei move-scene: sonst stünde eine Szene nach zwei Zügen doppelt).
    if (zielTag === null) {
      await tx.run('DELETE FROM shoot_day_scenes WHERE scene_id = ANY(?::int[])', [szenen])
    } else {
      await tx.run('DELETE FROM shoot_day_scenes WHERE scene_id = ANY(?::int[]) AND shoot_day_id <> ?', [szenen, zielTag])
      const bleiben = (await eintraegeDesTags(tx, zielTag)).filter((e) => !(e.art === 'szene' && szenen.includes(e.id)))
      const stelle = stelleVor(bleiben, vor)
      const auswahl = szenen.map((id) => ({ art: 'szene' as const, id }))
      await schreibeReihenfolge(tx, zielTag, [...bleiben.slice(0, stelle), ...auswahl, ...bleiben.slice(stelle)])
      // Die Besetzung der Szenen in die Dispo des Zieltags (lib/dispo.ts)
      await besetzungNachziehen(tx, { tage: [zielTag] })
    }
    for (const quelle of quellen) await ordneTag(tx, quelle)
  })
  res.json({ data: { ok: true }, error: null })
})

// POST /api/projects/:projectId/drehplan/tagesgrenze
// { nachSzene, folgetageVerschieben }: Was im Tag nach der Szene steht, wird
// ein eigener Tag am nächsten Arbeitstag (Soll 5).
router.post('/projects/:projectId/drehplan/tagesgrenze', async (req, res) => {
  const pid = Number(req.params.projectId)
  const nachSzene = Number(req.body?.nachSzene)
  if (!Number.isInteger(nachSzene) || nachSzene <= 0) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  const tag = (await db.get(
    `SELECT d.id, d.date, d.unit, ${effektiveUnit('d')} AS eff_unit FROM shoot_day_scenes sds JOIN shoot_days d ON d.id = sds.shoot_day_id
      WHERE sds.scene_id = ? AND d.project_id = ? ORDER BY d.id LIMIT 1`,
    [nachSzene, pid])) as any
  if (!tag) {
    const gibtEs = await db.get('SELECT id FROM scenes WHERE id = ? AND project_id = ?', [nachSzene, pid])
    return gibtEs
      ? res.status(400).json({ data: null, error: 'Die Szene steht in keinem Drehtag' })
      : res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  }
  if (!istIsoDatum(tag.date)) return res.status(400).json({ data: null, error: 'Der Drehtag hat kein Datum' })
  const tagId = Number(tag.id)

  const { wochentage, feiertage } = await kalenderDesProjekts(pid, Number(tag.date.slice(0, 4)))
  const neuesDatum = naechsterArbeitstag(tag.date, wochentage, feiertage)
  if (!neuesDatum) return res.status(400).json({ data: null, error: 'In den Arbeitstagen des Projekts ist kein Wochentag eingestellt' })

  // Belegt und verschoben wird nur in der Folge der eigenen Unit (AP C2)
  const tage = (await db.all(
    `SELECT d.id, d.day_number, d.date, d.status FROM shoot_days d
      WHERE d.project_id = ? AND d.date <> '' AND ${effektiveUnit('d')} IS NOT DISTINCT FROM ?
      ORDER BY d.date ASC, d.id ASC`,
    [pid, tag.eff_unit])) as any[]
  const belegt = tage.find((t) => t.date === neuesDatum)
  // Verschoben werden alle Tage nach dem geteilten - nur wenn der nächste
  // Arbeitstag schon belegt ist und die Seite ausdrücklich zustimmt.
  const folgetage = belegt ? tage.filter((t) => t.date > tag.date) : []
  if (belegt) {
    const imWeg = await stehenImWeg(folgetage)
    if (imWeg.length > 0) {
      const liste = imWeg.map((t) => `Drehtag ${t.day_number} (${deDatum(t.date)})`).join(', ')
      return res.status(409).json({
        data: { belegt: true, verschiebbar: false, im_weg: imWeg.map((t) => Number(t.day_number)) },
        error: `Im Weg steht ${liste}. Abgedrehte Tage und Tage mit verschickter Dispo werden nie verschoben.`,
      })
    }
    if (req.body?.folgetageVerschieben !== true) {
      return res.status(409).json({
        data: { belegt: true, verschiebbar: true, tag: Number(belegt.day_number), datum: neuesDatum },
        error: `Der ${deDatum(neuesDatum)} ist schon Drehtag ${belegt.day_number}. Die Folgetage um einen Arbeitstag verschieben?`,
      })
    }
  }
  const neueDaten = folgetageVerschieben(folgetage.map((t) => t.date), neuesDatum, wochentage, feiertage)

  const neuerTag = await db.transaction(async (tx) => {
    for (const [i, t] of folgetage.entries()) await tx.run('UPDATE shoot_days SET date = ? WHERE id = ?', [neueDaten[i], t.id])
    const neu = (await tx.run(
      "INSERT INTO shoot_days (project_id, day_number, date, status, unit, unit_id, notes) VALUES (?, 0, ?, 'Geplant', ?, ?, '')",
      [pid, neuesDatum, tag.unit || 'Haupteinheit', tag.eff_unit ?? null])).id
    const eintraege = await eintraegeDesTags(tx, tagId)
    const rest = eintraege.slice(eintraege.findIndex((e) => e.art === 'szene' && e.id === nachSzene) + 1)
    const restSzenen = rest.filter((e) => e.art === 'szene').map((e) => e.id)
    // Die Zeilen ziehen mit um - mit ihnen die Minuten aus dem Tagesbericht
    if (restSzenen.length > 0) {
      await tx.run('UPDATE shoot_day_scenes SET shoot_day_id = ? WHERE shoot_day_id = ? AND scene_id = ANY(?::int[])', [neu, tagId, restSzenen])
    }
    await schreibeReihenfolge(tx, neu, rest)
    await ordneTag(tx, tagId)
    await nummeriereDrehtage(pid, tx)
    return neu
  })
  res.status(201).json({ data: await getShootDayWithScenes(neuerTag), error: null })
})

// DELETE /api/projects/:projectId/drehplan/tagesgrenze/:dayId
// Die Grenze unter dem Tag entfernen: Der folgende Tag geht in ihm auf. Der
// Tag behält sein Datum, der folgende verschwindet (Soll 6).
router.delete('/projects/:projectId/drehplan/tagesgrenze/:dayId', async (req, res) => {
  const pid = Number(req.params.projectId)
  const dayId = Number(req.params.dayId)
  // Der folgende Tag derselben Unit (AP C2), nicht der einer parallelen
  const tage = (await db.all(
    `SELECT d.id, d.day_number, ${effektiveUnit('d')} AS eff_unit FROM shoot_days d
      WHERE d.project_id = ? ORDER BY (d.date = '') ASC, d.date ASC, d.id ASC`,
    [pid])) as any[]
  const eigener = tage.find((t) => Number(t.id) === dayId)
  if (!eigener) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
  const folge = tage.filter((t) => t.eff_unit === eigener.eff_unit)
  const i = folge.findIndex((t) => Number(t.id) === dayId)
  const folgender = folge[i + 1]
  if (!folgender) return res.status(400).json({ data: null, error: 'Nach dem letzten Drehtag gibt es keinen Tag zum Zusammenlegen' })
  const fid = Number(folgender.id)

  // Dieselben Folgen wie beim Löschen eines Drehtags - erst nach Rückfrage
  const folgen: string[] = []
  if (await db.get('SELECT 1 FROM call_sheets WHERE shoot_day_id = ?', [fid])) folgen.push('dispo')
  if (await db.get('SELECT 1 FROM daily_reports WHERE shoot_day_id = ?', [fid])) folgen.push('tagesbericht')
  if (await db.get(
    'SELECT 1 FROM call_sheet_entries e JOIN call_sheets cs ON cs.id = e.call_sheet_id WHERE cs.shoot_day_id = ? AND e.checked_in = true',
    [fid])) folgen.push('checkins')
  if (folgen.length > 0 && req.query.bestaetigt !== '1') {
    return res.status(409).json({
      data: { folgen, tag: Number(folgender.day_number) },
      error: `Drehtag ${folgender.day_number} hat eine Dispo, einen Tagesbericht oder Check-ins - beim Zusammenlegen werden sie mit gelöscht.`,
    })
  }

  await db.transaction(async (tx) => {
    // Steht eine Szene in beiden Tagen, bleibt die Zeile des ersten
    await tx.run(
      'DELETE FROM shoot_day_scenes WHERE shoot_day_id = ? AND scene_id IN (SELECT scene_id FROM shoot_day_scenes WHERE shoot_day_id = ?)',
      [fid, dayId])
    const eigene = await eintraegeDesTags(tx, dayId)
    const dazu = await eintraegeDesTags(tx, fid)
    await tx.run('UPDATE shoot_day_scenes SET shoot_day_id = ? WHERE shoot_day_id = ?', [dayId, fid])
    await schreibeReihenfolge(tx, dayId, [...eigene, ...dazu])
  })
  // Erst jetzt in den Papierkorb, wenn Szenen und Banner schon im ersten Tag
  // stehen. Sonst brächte "Zurückholen" sie in den alten Tag zurück, und sie
  // stünden doppelt im Plan.
  try {
    await inDenPapierkorb('shoot_days', fid, { userId: (req as any).user?.id ?? null })
  } catch (fehler: any) {
    console.warn('[Papierkorb] konnte nicht sichern:', fehler?.message || fehler)
  }
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM shoot_days WHERE id = ?', [fid])
    await nummeriereDrehtage(pid, tx)
    await besetzungNachziehen(tx, { tage: [dayId] })
  })
  res.json({ data: await getShootDayWithScenes(dayId), error: null })
})

// POST /api/projects/:projectId/drehplan/einteilen
// { nach: 'achtel' | 'minuten', hoechstens, start, nurZeigen, szenen? }:
// die Ablage in ihrer Reihenfolge auf Tage verteilen (Soll 7). `szenen`
// ist die Ablage in der Reihenfolge, in der die Seite sie zeigt.
router.post('/projects/:projectId/drehplan/einteilen', async (req, res) => {
  const pid = Number(req.params.projectId)
  const { nach, start } = req.body ?? {}
  const hoechstens = Number(req.body?.hoechstens)
  if (nach !== 'achtel' && nach !== 'minuten') return res.status(400).json({ data: null, error: 'Eingeteilt wird nach Achteln oder nach Minuten' })
  if (!Number.isFinite(hoechstens) || hoechstens <= 0) return res.status(400).json({ data: null, error: 'Die Grenze je Tag muss größer als 0 sein' })
  if (!istIsoDatum(start)) return res.status(400).json({ data: null, error: 'Der Start braucht ein Datum (JJJJ-MM-TT)' })
  // Eingeteilt wird in die Tage einer Unit, ohne Angabe die Haupteinheit (AP C2)
  const unit = await unitFuerNeuenTag(pid, req.body?.unit_id)
  if (!unit) return res.status(400).json({ data: null, error: UNIT_FEHLT })

  let ablage = (await db.all(
    `SELECT s.id, s.eighths, s.estimated_minutes FROM scenes s
      WHERE s.project_id = ? AND NOT s.omitted AND NOT EXISTS (SELECT 1 FROM shoot_day_scenes sds WHERE sds.scene_id = s.id)
      ORDER BY s.sort_order ASC, s.scene_number ASC, s.id ASC`,
    [pid])) as any[]
  if (req.body?.szenen !== undefined) {
    const ids = kennungen(req.body.szenen)
    const jeId = new Map(ablage.map((s) => [Number(s.id), s]))
    if (!ids || !ids.every((id) => jeId.has(id))) return res.status(400).json({ data: null, error: 'Eine Szene der Liste liegt nicht in der Ablage' })
    ablage = ids.map((id) => jeId.get(id))
  }
  if (ablage.length === 0) return res.status(400).json({ data: null, error: 'In der Ablage liegt keine Szene' })

  const gruppen = teileEin(
    ablage.map((s) => ({ id: Number(s.id), achtel: Number(s.eighths) || 0, minuten: Number(s.estimated_minutes) || 0 })),
    hoechstens, nach)
  if (gruppen.length > 366) return res.status(400).json({ data: null, error: 'Mehr als 366 Drehtage legt das Einteilen nicht an - die Grenze je Tag ist zu klein' })

  const { wochentage, feiertage } = await kalenderDesProjekts(pid, Number(start.slice(0, 4)))
  const vorhanden = (await db.all(
    `SELECT d.id, d.date, d.status, EXISTS (SELECT 1 FROM shoot_day_scenes sds WHERE sds.shoot_day_id = d.id) AS hat_szenen
       FROM shoot_days d WHERE d.project_id = ? AND d.date >= ? AND ${effektiveUnit('d')} = ?`,
    [pid, start, unit.id])) as any[]
  // Leer und planbar: keine Szene, nicht abgedreht, kein Sperr-, Ausfall- oder Reservetag
  const nichtPlanbar: readonly string[] = [...KEIN_DREHTAG, 'Abgedreht']
  const plaetze = plaetzeAb(gruppen.length, start,
    vorhanden.map((d) => ({ id: Number(d.id), datum: d.date, frei: !d.hat_szenen && !nichtPlanbar.includes(d.status) })),
    wochentage, feiertage)
  if (plaetze.length < gruppen.length) {
    return res.status(400).json({ data: null, error: 'In den Arbeitstagen des Projekts finden sich nicht genug freie Tage' })
  }

  const verteilung = gruppen.map((g, i) => ({
    datum: plaetze[i].datum,
    tag_id: plaetze[i].tag_id,
    szenen: g.map((s) => s.id),
    achtel: g.reduce((summe, s) => summe + s.achtel, 0),
    minuten: g.reduce((summe, s) => summe + s.minuten, 0),
  }))
  const neu = verteilung.filter((v) => v.tag_id === null).length
  const ergebnis = () => ({
    tage: verteilung.length,
    neu,
    gefuellt: verteilung.length - neu,
    von: verteilung[0].datum,
    bis: verteilung[verteilung.length - 1].datum,
    verteilung,
  })
  if (req.body?.nurZeigen === true) return res.json({ data: ergebnis(), error: null })

  // Einteilen ändert viele Tage auf einmal: vorher von selbst eine Version
  const vorher = await ladeDrehtageMitSzenen(pid)
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO drehplan_versions (project_id, name, snapshot_json) VALUES (?, ?, ?)', [
      pid,
      `Vor dem automatischen Einteilen (${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })})`,
      JSON.stringify(vorher),
    ])
    for (const v of verteilung) {
      const vorhandeneEintraege = v.tag_id === null ? [] : await eintraegeDesTags(tx, v.tag_id)
      if (v.tag_id === null) {
        v.tag_id = (await tx.run(
          "INSERT INTO shoot_days (project_id, day_number, date, status, unit, unit_id, notes) VALUES (?, 0, ?, 'Geplant', ?, ?, '')",
          [pid, v.datum, unit.name, unit.id])).id
      }
      await schreibeReihenfolge(tx, Number(v.tag_id), [...vorhandeneEintraege, ...v.szenen.map((id) => ({ art: 'szene' as const, id }))])
    }
    await nummeriereDrehtage(pid, tx)
    await besetzungNachziehen(tx, { tage: verteilung.map((v) => Number(v.tag_id)) })
  })
  res.json({ data: ergebnis(), error: null })
})

/** Text und Dauer eines Banners prüfen; was nicht mitkommt, wird nicht geprüft. null heißt: in Ordnung. */
function bannerFehler(text: unknown, minuten: unknown): string | null {
  if (text !== undefined && (typeof text !== 'string' || !text.trim())) return 'Ein Banner braucht einen Text'
  if (typeof text === 'string' && text.trim().length > 200) return 'Ein Banner hat höchstens 200 Zeichen'
  if (minuten !== undefined) {
    const m = Number(minuten)
    if (!Number.isInteger(m) || m < 0 || m > 1440) return 'Die Dauer eines Banners liegt zwischen 0 und 1.440 Minuten'
  }
  return null
}

// POST /api/shoot-days/:id/banner - ans Ende des Tages
router.post('/shoot-days/:id/banner', async (req, res) => {
  const tag = (await db.get('SELECT id, project_id FROM shoot_days WHERE id = ?', [req.params.id])) as any
  if (!tag) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
  const text = req.body?.text ?? ''
  const minuten = req.body?.minutes ?? 0
  const fehler = bannerFehler(text, minuten)
  if (fehler) return res.status(400).json({ data: null, error: fehler })
  const ende = (await db.get(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM (
       SELECT sort_order FROM shoot_day_scenes WHERE shoot_day_id = ?
       UNION ALL SELECT sort_order FROM shoot_day_banners WHERE shoot_day_id = ?) x`,
    [tag.id, tag.id])) as any
  const r = await db.run(
    'INSERT INTO shoot_day_banners (project_id, shoot_day_id, text, minutes, sort_order) VALUES (?, ?, ?, ?, ?)',
    [tag.project_id, tag.id, String(text).trim(), Number(minuten), Number(ende.n)])
  res.status(201).json({ data: await db.get('SELECT * FROM shoot_day_banners WHERE id = ?', [r.id]), error: null })
})

// PUT /api/shoot-day-banners/:id - Text, Dauer und Stelle ({ shoot_day_id, vor })
router.put('/shoot-day-banners/:id', async (req, res) => {
  const banner = (await db.get('SELECT * FROM shoot_day_banners WHERE id = ?', [req.params.id])) as any
  if (!banner) return res.status(404).json({ data: null, error: 'Banner nicht gefunden' })
  const { text, minutes, shoot_day_id, vor } = req.body ?? {}
  const fehler = bannerFehler(text, minutes)
  if (fehler) return res.status(400).json({ data: null, error: fehler })

  const bisher = Number(banner.shoot_day_id)
  const zielTag = shoot_day_id === undefined ? bisher : Number(shoot_day_id)
  const umstellen = shoot_day_id !== undefined || vor !== undefined
  let neueReihe: Eintrag[] | null = null
  if (umstellen) {
    const tag = Number.isInteger(zielTag)
      ? await db.get('SELECT id FROM shoot_days WHERE id = ? AND project_id = ?', [zielTag, banner.project_id])
      : null
    if (!tag) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })
    const bleiben = (await eintraegeDesTags(db, zielTag)).filter((e) => !(e.art === 'banner' && e.id === Number(banner.id)))
    const stelle = stelleVor(bleiben, vor ?? null)
    if (stelle < 0) return res.status(400).json({ data: null, error: STELLE_FEHLT })
    neueReihe = [...bleiben.slice(0, stelle), { art: 'banner', id: Number(banner.id) }, ...bleiben.slice(stelle)]
  }

  await db.transaction(async (tx) => {
    await tx.run('UPDATE shoot_day_banners SET text = COALESCE(?, text), minutes = COALESCE(?, minutes) WHERE id = ?', [
      typeof text === 'string' ? text.trim() : null,
      minutes === undefined ? null : Number(minutes),
      banner.id,
    ])
    if (neueReihe) {
      await schreibeReihenfolge(tx, zielTag, neueReihe)
      if (zielTag !== bisher) await ordneTag(tx, bisher)
    }
  })
  res.json({ data: await db.get('SELECT * FROM shoot_day_banners WHERE id = ?', [banner.id]), error: null })
})

// DELETE /api/shoot-day-banners/:id - der Papierkorb sichert vorher (papierkorbWaechter)
router.delete('/shoot-day-banners/:id', async (req, res) => {
  const banner = await db.get('SELECT id FROM shoot_day_banners WHERE id = ?', [req.params.id])
  if (!banner) return res.status(404).json({ data: null, error: 'Banner nicht gefunden' })
  await db.run('DELETE FROM shoot_day_banners WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// GET /api/projects/:projectId/drehplan/versions
router.get('/projects/:projectId/drehplan/versions', async (req, res) => {
  const versions = await db.all('SELECT id, project_id, name, created_at FROM drehplan_versions WHERE project_id = ? ORDER BY created_at DESC', [req.params.projectId])
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/drehplan/snapshot
router.post('/projects/:projectId/drehplan/snapshot', async (req, res) => {
  const { name = `Snapshot ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}` } = req.body
  const fullDrehplan = await ladeDrehtageMitSzenen(req.params.projectId)
  const result = await db.run('INSERT INTO drehplan_versions (project_id, name, snapshot_json) VALUES (?, ?, ?)', [req.params.projectId, name, JSON.stringify(fullDrehplan)])
  res.status(201).json({ data: await db.get('SELECT id, project_id, name, created_at FROM drehplan_versions WHERE id = ?', [result.id]), error: null })
})

// POST /api/projects/:projectId/drehplan/restore/:versionId
router.post('/projects/:projectId/drehplan/restore/:versionId', async (req, res) => {
  const version = await db.get('SELECT * FROM drehplan_versions WHERE id = ? AND project_id = ?', [req.params.versionId, req.params.projectId]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })

  const roh = JSON.parse(version.snapshot_json)
  // Die KI-Optimierung sicherte bis zum 31.10.2026 als { shoot_days, scenes }
  // statt als Liste von Tagen - diese Sicherungen ergaben hier eine 500.
  const snapshot: any[] = Array.isArray(roh) ? roh : (roh?.shoot_days ?? []).map((d: any) => ({
    day_number: d.day_number,
    scenes: (roh.scenes ?? [])
      .filter((sz: any) => sz.shoot_day_id === d.id)
      .sort((x: any, y: any) => (x.day_sort_order ?? 0) - (y.day_sort_order ?? 0))
      .map((sz: any) => ({ scene_id: sz.id })),
  }))
  const pid = req.params.projectId
  const aktuell = await ladeDrehtageMitSzenen(pid)
  // Nummern zählen je Unit (AP C2): Eine Version ohne Unit gehört der Haupteinheit
  const haupt = await hauptUnit(db, pid)

  // Alles oder nichts: Vorher lief jeder Schritt einzeln - scheiterte das
  // Einlesen, waren die Zuordnungen schon gelöscht und der Plan stand leer da.
  await db.transaction(async (tx) => {
    // Den aktuellen Plan vorher als Version sichern - sonst ist ein Klick auf
    // "Wiederherstellen" nicht mehr rückgängig zu machen.
    await tx.run('INSERT INTO drehplan_versions (project_id, name, snapshot_json) VALUES (?, ?, ?)', [
      pid,
      `Vor Wiederherstellung von „${version.name}" (${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })})`,
      JSON.stringify(aktuell),
    ])

    // Gemessene Minuten hängen an der Zuordnung Drehtag-Szene (Tagesbericht).
    // Vorher gingen sie beim Zurückholen mit den Zuordnungen verloren (gemessen
    // am 31.10.2026); jetzt bleiben sie, wo Tag und Szene wieder zusammenkommen.
    const gemessen = new Map<string, number>()
    for (const z of await tx.all(
      `SELECT sds.shoot_day_id, sds.scene_id, sds.actual_minutes FROM shoot_day_scenes sds
         JOIN shoot_days sd ON sd.id = sds.shoot_day_id
        WHERE sd.project_id = ? AND sds.actual_minutes IS NOT NULL`, [pid]) as any[]) {
      gemessen.set(`${z.shoot_day_id}:${z.scene_id}`, Number(z.actual_minutes))
    }

    // Alle Zuordnungen lösen, Drehtage und Szenen bleiben
    await tx.run('DELETE FROM shoot_day_scenes WHERE shoot_day_id IN (SELECT id FROM shoot_days WHERE project_id = ?)', [pid])

    // Zuordnungen aus der Version, Tage über ihre Nummer gefunden
    for (const snapDay of snapshot) {
      const liveDay = await tx.get(
        `SELECT d.id FROM shoot_days d WHERE d.project_id = ? AND d.day_number = ? AND ${effektiveUnit('d')} = ?`,
        [pid, snapDay.day_number, Number(snapDay.unit_id ?? haupt.id)]) as any
      if (!liveDay) continue
      for (const [i, sz] of (snapDay.scenes || []).entries()) {
        const sceneId = sz.scene_id || sz.id
        const sceneExists = await tx.get('SELECT id FROM scenes WHERE id = ? AND project_id = ?', [sceneId, pid])
        if (!sceneExists) continue
        // ON CONFLICT statt try/catch: ein Fehler bräche die Transaktion ab
        await tx.run(
          `INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order, actual_minutes) VALUES (?, ?, ?, ?)
           ON CONFLICT DO NOTHING`,
          [liveDay.id, sceneId, i, gemessen.get(`${liveDay.id}:${sceneId}`) ?? null])
      }
    }

    const tage = await tx.all('SELECT id FROM shoot_days WHERE project_id = ?', [pid]) as any[]
    await besetzungNachziehen(tx, { tage: tage.map(d => Number(d.id)) })
  })

  const days = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number', [pid])
  const result = await Promise.all((days as any[]).map(d => getShootDayWithScenes(d.id)))
  res.json({ data: result, error: null })
})

// DELETE /api/drehplan-versions/:id
router.delete('/drehplan-versions/:id', async (req, res) => {
  await db.run('DELETE FROM drehplan_versions WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
