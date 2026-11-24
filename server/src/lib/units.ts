/**
 * Units: 1. und 2. Unit als eigene Folge von Drehtagen (Plan Kino-Ausbau,
 * AP C2). Jedes Projekt hat eine Haupteinheit; jeder Drehtag und jedes
 * Stabmitglied gehört einer Unit.
 *
 * Leer (`unit_id IS NULL`) heißt Haupteinheit - beim Stab so vorgesehen, bei
 * Drehtagen für Zeilen, die ein älterer Weg ohne Unit anlegt. Verglichen wird
 * deshalb immer über `effektiveUnit`, nie über die Spalte allein.
 */

type Zugriff = {
  get: (sql: string, werte?: any[]) => Promise<any>
  run: (sql: string, werte?: any[]) => Promise<any>
}

export const HAUPTEINHEIT = 'Haupteinheit'

export type Unit = { id: number; project_id: number; name: string; short: string; color: string; is_main: boolean; sort_order: number }

/** Die Haupteinheit eines Projekts - angelegt, falls es sie noch nicht gibt. */
export async function hauptUnit(z: Zugriff, projectId: number | string): Promise<Unit> {
  const vorhanden = await z.get('SELECT * FROM units WHERE project_id = ? AND is_main', [projectId])
  if (vorhanden) return vorhanden
  await z.run(
    `INSERT INTO units (project_id, name, is_main, sort_order) VALUES (?, ?, true, 0)
     ON CONFLICT (project_id) WHERE is_main DO NOTHING`,
    [projectId, HAUPTEINHEIT])
  return z.get('SELECT * FROM units WHERE project_id = ? AND is_main', [projectId])
}

/** SQL: die Unit einer Zeile mit `unit_id` und `project_id` - leer heißt Haupteinheit. */
export const effektiveUnit = (alias: string) =>
  `COALESCE(${alias}.unit_id, (SELECT hu.id FROM units hu WHERE hu.project_id = ${alias}.project_id AND hu.is_main LIMIT 1))`

/**
 * SQL: Ruft eine Dispo dieses Drehtags dieses Stabmitglied? Ja, wenn es zur
 * Unit des Tages gehört oder zu allen Units.
 */
export const stabDerUnit = (crew: string, tag: string) =>
  `(${crew}.all_units OR ${effektiveUnit(crew)} IS NOT DISTINCT FROM ${effektiveUnit(tag)})`

/**
 * SQL: der Name eines Drehtags - "Drehtag 4" in der Haupteinheit, "2U Tag 3"
 * in einer anderen (Kürzel, sonst Name). `u` ist ein LEFT JOIN auf units.
 */
export const drehtagNameSql = (tag: string, u: string) =>
  `(CASE WHEN ${u}.id IS NULL OR ${u}.is_main THEN 'Drehtag ' || ${tag}.day_number
         ELSE COALESCE(NULLIF(${u}.short, ''), ${u}.name) || ' Tag ' || ${tag}.day_number END)`

/** Dasselbe in TypeScript, für Zeilen mit `unit_is_main`, `unit_short`, `unit_name`. */
export function drehtagName(tag: { day_number: number | string; unit_is_main?: boolean | null; unit_short?: string | null; unit_name?: string | null }): string {
  if (tag.unit_is_main !== false || !tag.unit_name) return `Drehtag ${tag.day_number}`
  return `${tag.unit_short || tag.unit_name} Tag ${tag.day_number}`
}

/** Eine Unit des Projekts, oder null. */
export async function unitDesProjekts(z: Zugriff, projectId: number | string, unitId: unknown): Promise<Unit | null> {
  const id = Number(unitId)
  if (!Number.isInteger(id) || id <= 0) return null
  return (await z.get('SELECT * FROM units WHERE id = ? AND project_id = ?', [id, projectId])) ?? null
}
