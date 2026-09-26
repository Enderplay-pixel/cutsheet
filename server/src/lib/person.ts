import { db } from '../db'

/**
 * Alles entfernen, was an einer Person hängt.
 *
 * Besetzung und Stab werden an drei Stellen über `person_type`/`person_id`
 * referenziert - Dispositionen, Arbeitszeiten, Verpflegung. Eine echte
 * Fremdschlüsselbeziehung gibt es dort nicht, weil die Spalte auf zwei
 * Tabellen zeigen kann; die Datenbank räumt also nicht mit auf.
 *
 * Gemessen am 26.09.2026: nach dem Löschen eines Stabmitglieds meldete der
 * Konfliktradar "Turnaround-Verletzung: Unbekannt" - der Dispo-Eintrag lag
 * noch da und wäre auf dem gedruckten Call Sheet als namenlose Zeile
 * mitgefahren.
 */
export async function loeschePersonenspuren(art: 'crew' | 'cast', personId: number | string) {
  for (const tabelle of ['call_sheet_entries', 'timesheets', 'catering_preferences']) {
    await db.run(`DELETE FROM ${tabelle} WHERE person_type = ? AND person_id = ?`, [art, personId])
  }
}
