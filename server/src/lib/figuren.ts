/**
 * Figuren aus dem Drehbuch.
 *
 * Grundsatz von Florian (26.10.2026): In CutSheet ist alles verknüpft. Eine
 * Figur, die im Drehbuch auftritt, ist Rolle des Projekts und gehört zu ihrer
 * Szene - ohne dass jemand sie in der Rollenliste noch einmal anlegt. Von dort
 * kommt sie in Besetzung, Szenenliste, Tagesdispo und Drehplan-Übersicht.
 *
 * Gemessen am 25.10.2026: "JANA (O.S.)" im Drehbuch legte keine Rolle an und
 * verknüpfte nichts.
 *
 * Verknüpft wird nur ergänzend. Eine von Hand zugeordnete Rolle (eine stumme
 * Figur ohne Dialog) bleibt, auch wenn sie im Text nicht vorkommt.
 */

import { besetzungNachziehen } from './dispo'

/** Was zum Lesen und Schreiben gebraucht wird - die Datenbank oder eine Transaktion. */
type Zugriff = {
  get: (sql: string, werte?: any[]) => Promise<any>
  all: (sql: string, werte?: any[]) => Promise<any[]>
  run: (sql: string, werte?: any[]) => Promise<{ id: number; changes: number }>
}

/**
 * Der Name aus einer Figurenzeile: ohne Zusätze wie (O.S.), (V.O.), (CONT'D),
 * ohne Fountain-Zeichen (@ vorn erzwingt eine Figur, ^ hinten ist Doppeldialog).
 */
export function figurName(zeile: string | null | undefined): string {
  return String(zeile ?? '')
    .replace(/^\s*@/, '')
    .replace(/\^\s*$/, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "DR. MÜLLER-LÜDENSCHEIDT" wird "Dr. Müller-Lüdenscheidt" - so steht sie in der Rollenliste. */
export function alsRollenname(name: string): string {
  return name
    .toLocaleLowerCase('de-DE')
    .replace(/(^|[\s-])(\p{L})/gu, (_t, vor: string, b: string) => vor + b.toLocaleUpperCase('de-DE'))
}

/**
 * Die Rolle zu einer Figurenzeile finden oder anlegen und mit der Szene
 * verknüpfen. Gibt die Rolle zurück, oder null, wenn die Zeile keinen Namen trägt.
 *
 * Verglichen wird ohne Groß- und Kleinschreibung: Im Drehbuch steht "JANA", in
 * der Rollenliste "Jana" - das ist dieselbe Figur.
 */
export async function figurVerknuepfen(
  z: Zugriff,
  projectId: number,
  sceneId: number,
  zeile: string | null | undefined
): Promise<{ id: number; name: string; neu: boolean } | null> {
  const name = figurName(zeile)
  if (!name) return null
  const schluessel = name.toLocaleLowerCase('de-DE')
  const rollen = await z.all('SELECT id, name FROM characters WHERE project_id = ?', [projectId])
  const vorhanden = rollen.find((r) => String(r.name ?? '').trim().toLocaleLowerCase('de-DE') === schluessel)

  let rolle = vorhanden ? { id: Number(vorhanden.id), name: String(vorhanden.name), neu: false } : null
  if (!rolle) {
    const max = await z.get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM characters WHERE project_id = ?', [projectId])
    const neuerName = alsRollenname(name)
    const zeileNeu = await z.run(
      'INSERT INTO characters (project_id, name, sort_order) VALUES (?, ?, ?)',
      [projectId, neuerName, Number(max?.m ?? 0) + 1]
    )
    rolle = { id: zeileNeu.id, name: neuerName, neu: true }
  }
  await z.run(
    'INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
    [sceneId, rolle.id]
  )
  // Ist die Rolle schon besetzt, kommt der Darsteller in die Dispos der Szene
  await besetzungNachziehen(z, { szene: sceneId })
  return rolle
}
