/**
 * Was eine Dispo aus dem Rest des Projekts weiß.
 *
 * Grundsatz von Florian (26.10.2026): alles verknüpft, und was sich
 * automatisch übernehmen lässt, wird übernommen. Für die Dispo heißt das:
 *
 *  - Gerufen wird die Besetzung der Szenen des Tages - über die Rollen der
 *    Szenen. Vorher trug eine neue Dispo alle Darsteller des Projekts ein, und
 *    jeder bekam die Dispo-Mail auch für Tage, an denen er nicht dreht
 *    (gemessen am 26.10.2026: Demo-Tag 2 rief eine Darstellerin ohne Rolle in
 *    den Szenen des Tages).
 *  - Kommt später eine Szene in den Tag, eine Rolle an eine Szene oder ein
 *    Darsteller an eine Rolle, kommt die Besetzung in die bestehende Dispo
 *    nach. Nur ergänzend: Wer von Hand gestrichen oder dazugesetzt wurde,
 *    bleibt so - eine Szene, die den Tag verlässt, nimmt niemanden mit.
 *  - Der Drehort des Tages ist das in der Dispo gewählte Motiv, sonst das der
 *    ersten Szene. Die Tagesdispo-Seite bietet keine eigene Auswahl; vorher
 *    stand "Drehort" deshalb bei jeder neuen Dispo leer.
 */
import { db } from '../db'
import { stabDerUnit } from './units'

/** Was zum Lesen und Schreiben gebraucht wird - die Datenbank oder eine Transaktion. */
type Zugriff = {
  get: (sql: string, werte?: any[]) => Promise<any>
  all: (sql: string, werte?: any[]) => Promise<any[]>
  run: (sql: string, werte?: any[]) => Promise<{ id: number; changes: number }>
}

/**
 * Die Besetzung der Szenen in die Dispos der betroffenen Tage nachtragen -
 * für bestimmte Drehtage, für die Tage einer Szene oder für die Tage, an
 * denen eine Rolle spielt. Tage ohne Dispo bleiben unberührt: Ihre Dispo
 * bekommt die Besetzung beim Anlegen.
 */
export async function besetzungNachziehen(
  z: Zugriff,
  auswahl: { tage?: number[]; szene?: number; rolle?: number }
): Promise<number> {
  let tage = (auswahl.tage ?? []).map(Number).filter(Number.isInteger)
  if (auswahl.szene) {
    tage = tage.concat((await z.all(
      'SELECT shoot_day_id FROM shoot_day_scenes WHERE scene_id = ?', [auswahl.szene]
    )).map((t) => Number(t.shoot_day_id)))
  }
  if (auswahl.rolle) {
    tage = tage.concat((await z.all(
      `SELECT DISTINCT sds.shoot_day_id FROM shoot_day_scenes sds
         JOIN scene_characters sc ON sc.scene_id = sds.scene_id WHERE sc.character_id = ?`, [auswahl.rolle]
    )).map((t) => Number(t.shoot_day_id)))
  }
  if (tage.length === 0) return 0
  const neu = await z.run(
    `INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order)
     SELECT DISTINCT cs.id, 'cast', ca.id, cs.general_call,
            (SELECT COALESCE(MAX(e.sort_order), -1) + 1 FROM call_sheet_entries e WHERE e.call_sheet_id = cs.id)
       FROM call_sheets cs
       JOIN shoot_day_scenes sds ON sds.shoot_day_id = cs.shoot_day_id
       JOIN scene_characters sc ON sc.scene_id = sds.scene_id
       JOIN "cast" ca ON ca.character_id = sc.character_id
      WHERE cs.shoot_day_id = ANY(?::int[])
        AND NOT EXISTS (SELECT 1 FROM call_sheet_entries e
                         WHERE e.call_sheet_id = cs.id AND e.person_type = 'cast' AND e.person_id = ca.id)
     RETURNING id`,
    [[...new Set(tage)]]
  )
  return neu.changes
}

/**
 * Eine neue Dispo füllen: der Stab der Unit des Tages (und wer zu allen
 * Units gehört, AP C2), dazu die Besetzung der Szenen des Tages.
 */
export async function dispoFuellen(z: Zugriff, sheetId: number, projectId: number, dayId: number, call: number) {
  const crew = await z.all(
    `SELECT c.id FROM crew c JOIN shoot_days sd ON sd.id = ?
      WHERE c.project_id = ? AND ${stabDerUnit('c', 'sd')}
      ORDER BY c.sort_order ASC, c.id ASC`,
    [dayId, projectId])
  for (const [i, c] of crew.entries()) {
    await z.run(
      'INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, sort_order) VALUES (?, ?, ?, ?, ?)',
      [sheetId, 'crew', c.id, call, i]
    )
  }
  await besetzungNachziehen(z, { tage: [dayId] })
}

/**
 * Die Dispo eines Drehtags - angelegt, falls es noch keine gibt. Für die
 * Zuordnung von Komparsen zu Drehtagen: Wer einen Komparsen einem Tag ohne
 * Dispo zuordnet, bekommt dieselbe Dispo wie beim Anlegen von Hand.
 */
export async function dispoFuerDrehtag(dayId: number): Promise<{ id: number; general_call: number } | null> {
  const vorhanden = await db.get('SELECT id, general_call FROM call_sheets WHERE shoot_day_id = ?', [dayId]) as any
  if (vorhanden) return vorhanden
  const tag = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [dayId]) as any
  if (!tag) return null
  const settings = await db.get('SELECT default_call_time FROM project_settings WHERE project_id = ?', [tag.project_id]) as any
  const call = Number(settings?.default_call_time ?? 480)
  // Krankenhaus, Basecamp und Parken vom Motiv des Tages (AP C4)
  const m = vomMotiv(await drehortDesTages(dayId, null))
  const neu = await db.run(
    `INSERT INTO call_sheets (shoot_day_id, general_call, shooting_call, hospital_name, hospital_address, crew_parking, basecamp)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (shoot_day_id) DO NOTHING`,
    [dayId, call, call + 30, m.hospital_name, m.hospital_address, m.crew_parking, m.basecamp]
  )
  // Gleichzeitig angelegt: die andere Anfrage hat die Dispo schon gefüllt
  if (!neu.id) return await db.get('SELECT id, general_call FROM call_sheets WHERE shoot_day_id = ?', [dayId]) as any
  await dispoFuellen(db, neu.id, tag.project_id, dayId, call)
  return { id: neu.id, general_call: call }
}

export type Drehort = {
  id: number; name: string; address: string; zip: string; city: string
  hospital_name: string; hospital_address: string; parking_info: string; basecamp: string
}

/**
 * Was die Dispo vom Motiv übernimmt (AP C4): Krankenhaus, Basecamp, Parken -
 * am Motiv einmal eingetragen (AP C3). Am Tag geändert, bleibt die Änderung
 * am Tag; "vom Motiv übernehmen" holt den Stand neu.
 */
export function vomMotiv(ort: Drehort | null) {
  return {
    hospital_name: ort?.hospital_name ?? '',
    hospital_address: ort?.hospital_address ?? '',
    crew_parking: ort?.parking_info ?? '',
    basecamp: ort?.basecamp ?? '',
  }
}

const DREHORT_SPALTEN = 'l.id, l.name, l.address, l.zip, l.city, l.hospital_name, l.hospital_address, l.parking_info, l.basecamp'

/** Der Drehort eines Tages: das in der Dispo gewählte Motiv, sonst das der ersten Szene. */
export async function drehortDesTages(
  dayId: number | string,
  gewaehlt: number | null | undefined
): Promise<Drehort | null> {
  if (gewaehlt) {
    return (await db.get(`SELECT ${DREHORT_SPALTEN} FROM locations l WHERE l.id = ?`, [gewaehlt])) ?? null
  }
  return (await db.get(
    `SELECT ${DREHORT_SPALTEN}
       FROM shoot_day_scenes sds JOIN scenes s ON s.id = sds.scene_id JOIN locations l ON l.id = s.location_id
      WHERE sds.shoot_day_id = ? ORDER BY sds.sort_order ASC, sds.id ASC LIMIT 1`,
    [dayId]
  )) ?? null
}
