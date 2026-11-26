/**
 * An welchen Drehtagen jemand gebraucht wird - eine Zählung für Kalkulation,
 * DOOD und Besetzung.
 *
 * Florian (03.11.2026): Dispo und Drehplan werden live zueinander geschickt,
 * also muss die Zahl überall gleich sein. Bis dahin zählte die Kalkulation
 * Dispo-Einträge, DOOD die Szenen der Rolle und die Besetzungsseite gar
 * nichts. Gemessen im Demo-Projekt: 2, 3 und 0 Tage für dieselbe Person -
 * Drehtag 3 hatte noch keine Dispo, und die Besetzung las Rollen, die die
 * Drehtag-Liste nicht mitschickt.
 *
 * Besetzung: Tage mit einer Szene der Rolle, dazu Tage, an denen die Person
 * auf einer Dispo steht (von Hand dazugesetzt, oder die Szene ist inzwischen
 * verschoben - die Dispo nimmt dann niemanden mit, siehe lib/dispo.ts).
 *
 * Stab: Tage, an denen die Person auf einer Dispo steht, dazu jeder Tag ihrer
 * Unit, der noch keine Dispo hat - eine neue Dispo ruft den Stab ihrer Unit
 * (AP C2; wer zu allen Units gehört, zählt jeden solchen Tag).
 *
 * Ein Sperrtag ist kein Drehtag: An ihm wird nicht gedreht und niemand
 * bezahlt. Gemessen im Testbericht SALZWIND (09.11.2026): Die Kalkulation
 * rechnete die Stabgagen auch für den Sperrtag.
 */

import { stabDerUnit } from './units'

/**
 * Status, an denen nicht gedreht wird - kein Drehtag für niemanden.
 *
 * Sperrtag (seit 09.11.2026). Ausgefallen und Reserve seit dem 13.11.2026
 * (Plan "CutSheet Kino-Ausbau", AP A1): Ein Reservetag liegt bereit, falls
 * Wetter oder Ausfall ihn brauchen. Bis dahin rechnete die Kalkulation jedem
 * Stabmitglied jeden leeren Tag als Drehtag an.
 *
 * Drehfrei und Reisetag seit dem 24.11.2026 (AP E6): wählbar im Drehplan,
 * ein Tag im Zeitraum, an dem nicht gedreht wird. "Feiertag" ist kein
 * Status, sondern ergibt sich aus dem Datum (`tagesart` in lib/board.ts).
 */
export const KEIN_DREHTAG = ['Sperrtag', 'Ausgefallen', 'Reserve', 'Drehfrei', 'Reisetag'] as const

/** Dieselbe Liste für SQL: `sd.status NOT IN ${KEIN_DREHTAG_SQL}`. */
export const KEIN_DREHTAG_SQL = `(${KEIN_DREHTAG.map(s => `'${s}'`).join(', ')})`

type Lesen = { all: (sql: string, werte?: any[]) => Promise<any[]> }

function sammle(zeilen: any[]): Map<number, Set<number>> {
  const tage = new Map<number, Set<number>>()
  for (const z of zeilen) {
    const person = Number(z.person_id)
    if (!tage.has(person)) tage.set(person, new Set())
    tage.get(person)!.add(Number(z.tag))
  }
  return tage
}

export async function drehtageBesetzung(z: Lesen, projectId: number): Promise<Map<number, Set<number>>> {
  return sammle(await z.all(
    `SELECT ca.id AS person_id, sds.shoot_day_id AS tag
       FROM "cast" ca
       JOIN scene_characters sc ON sc.character_id = ca.character_id
       JOIN shoot_day_scenes sds ON sds.scene_id = sc.scene_id
       JOIN shoot_days sd ON sd.id = sds.shoot_day_id
      WHERE ca.project_id = ? AND sd.project_id = ? AND sd.status NOT IN ${KEIN_DREHTAG_SQL}
     UNION
     SELECT cse.person_id, cs.shoot_day_id
       FROM call_sheet_entries cse
       JOIN call_sheets cs ON cs.id = cse.call_sheet_id
       JOIN shoot_days sd ON sd.id = cs.shoot_day_id
      WHERE cse.person_type = 'cast' AND sd.project_id = ? AND sd.status NOT IN ${KEIN_DREHTAG_SQL}`,
    [projectId, projectId, projectId]
  ))
}

export async function drehtageStab(z: Lesen, projectId: number): Promise<Map<number, Set<number>>> {
  return sammle(await z.all(
    `SELECT cse.person_id, cs.shoot_day_id AS tag
       FROM call_sheet_entries cse
       JOIN call_sheets cs ON cs.id = cse.call_sheet_id
       JOIN shoot_days sd ON sd.id = cs.shoot_day_id
      WHERE cse.person_type = 'crew' AND sd.project_id = ? AND sd.status NOT IN ${KEIN_DREHTAG_SQL}
     UNION
     SELECT c.id, sd.id
       FROM crew c
       JOIN shoot_days sd ON sd.project_id = c.project_id
      WHERE c.project_id = ? AND sd.status NOT IN ${KEIN_DREHTAG_SQL}
        AND ${stabDerUnit('c', 'sd')}
        AND NOT EXISTS (SELECT 1 FROM call_sheets cs WHERE cs.shoot_day_id = sd.id)`,
    [projectId, projectId]
  ))
}

/** Aus den Tagen je Person die Anzahl je Person. */
export function anzahl(tage: Map<number, Set<number>>): Map<number, number> {
  return new Map([...tage].map(([person, s]) => [person, s.size]))
}
