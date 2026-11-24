/**
 * Cover-Sets: wetterunabhängige Ausweichszenen (Plan Kino-Ausbau, AP C5).
 *
 * Eine Szene, meist innen, ist als Cover-Set markiert. An einem Drehtag mit
 * Außenszenen nennt die Dispo unter "Bei Schlechtwetter" die markierten,
 * noch nicht gedrehten Szenen am selben Motiv oder ohne Außenanteil.
 *
 * `coverSetsFuer` ist rein und wird mit Tabellen getestet (coverSets.test.ts).
 */

type Lesen = { all: (sql: string, werte?: any[]) => Promise<any[]> }

/** Hat die Szene einen Außenanteil? "EXT" und "INT/EXT" ja, "INT" nein. */
export const istAussen = (intExt: unknown) => /EXT/i.test(String(intExt ?? ''))

export type CoverSet = {
  id: number
  scene_number: string
  title: string
  int_ext: string
  day_night: string
  location_id: number | null
  location_name: string | null
  eighths: number
}

export type TagSzene = { scene_id: number; int_ext: string; location_id: number | null }

/** Die Ausweichszenen für einen Tag - leer, wenn er keine Außenszene hat. */
export function coverSetsFuer(tagSzenen: TagSzene[], offene: CoverSet[]): CoverSet[] {
  if (!tagSzenen.some((s) => istAussen(s.int_ext))) return []
  const motive = new Set(tagSzenen.map((s) => s.location_id).filter((m): m is number => m != null).map(Number))
  const imTag = new Set(tagSzenen.map((s) => Number(s.scene_id)))
  return offene.filter((k) => !imTag.has(Number(k.id))
    && ((k.location_id != null && motive.has(Number(k.location_id))) || !istAussen(k.int_ext)))
}

const OFFEN = `FROM scenes s LEFT JOIN locations l ON l.id = s.location_id
  WHERE s.project_id = ? AND s.cover_set AND NOT s.omitted AND s.shot_status <> 'abgedreht'`

/** Markierte Cover-Sets des Projekts, die nicht entfallen und noch nicht gedreht sind. */
export async function offeneCoverSets(z: Lesen, projectId: number | string): Promise<CoverSet[]> {
  return z.all(
    `SELECT s.id, s.scene_number, s.title, s.int_ext, s.day_night, s.location_id, l.name AS location_name, s.eighths
       ${OFFEN} ORDER BY s.sort_order ASC, s.scene_number ASC, s.id ASC`,
    [projectId])
}

/**
 * Dieselbe Liste als JSON-Spalte, für eine Abfrage, die sie mitnimmt: Der
 * Drehplan lädt mit zwei Abfragen, egal wie viele Tage (datenbank.test.ts).
 * Erwartet die Projektkennung als Wert.
 */
export const OFFENE_COVER_SETS_JSON = `(SELECT COALESCE(json_agg(json_build_object(
    'id', s.id, 'scene_number', s.scene_number, 'title', s.title, 'int_ext', s.int_ext, 'day_night', s.day_night,
    'location_id', s.location_id, 'location_name', l.name, 'eighths', s.eighths
  ) ORDER BY s.sort_order, s.scene_number, s.id), '[]'::json) ${OFFEN})`
