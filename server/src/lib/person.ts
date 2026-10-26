import { db } from '../db'

/** Wer in einer Dispo stehen kann: Stab, Besetzung, Komparserie. */
export type Personenart = 'crew' | 'cast' | 'extra'

/**
 * Die Tabelle je Personenart. `person_type`/`person_id` zeigen auf drei
 * Tabellen, deshalb gibt es dort keinen Fremdschlüssel.
 */
export const PERSONEN_TABELLE: Record<Personenart, string> = {
  crew: 'crew',
  cast: '"cast"',
  extra: 'extras',
}

export function istPersonenart(wert: unknown): wert is Personenart {
  return wert === 'crew' || wert === 'cast' || wert === 'extra'
}

export type Personangaben = { name: string; rolle: string; email: string; telefon: string }

/**
 * Name, Funktion und Kontakt einer Person aus der Dispo - eine Stelle für
 * Dispo, Versand, Bestätigung, Check-in, Verpflegung und Morning Brief.
 *
 * Vorher stand an jeder dieser Stellen "Besetzung, sonst Stab". Seit
 * Komparsen in der Dispo stehen (26.10.2026), wäre ein Komparse dort mit
 * Namen und Adresse des Stabmitglieds gleicher Kennung erschienen.
 */
export async function personAngaben(art: string, personId: number | string): Promise<Personangaben | null> {
  const sql =
    art === 'cast'
      ? `SELECT c.actor_name AS name, ch.name AS rolle, c.email, c.phone AS telefon
           FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?`
      : art === 'crew'
        ? 'SELECT name, role AS rolle, email, phone AS telefon FROM crew WHERE id = ?'
        : art === 'extra'
          ? 'SELECT name, tariff_group AS rolle, email, phone AS telefon FROM extras WHERE id = ?'
          : null
  if (!sql) return null
  const p = (await db.get(sql, [personId])) as any
  return p ? { name: p.name || '', rolle: p.rolle || '', email: p.email || '', telefon: p.telefon || '' } : null
}

/**
 * Alles entfernen, was an einer Person hängt.
 *
 * Stab, Besetzung und Komparserie werden an drei Stellen über
 * `person_type`/`person_id` referenziert - Dispositionen, Arbeitszeiten,
 * Verpflegung. Die Datenbank räumt dort nicht mit auf (siehe oben).
 *
 * Gemessen am 26.09.2026: nach dem Löschen eines Stabmitglieds meldete der
 * Konfliktradar "Turnaround-Verletzung: Unbekannt" - der Dispo-Eintrag lag
 * noch da und wäre auf dem gedruckten Call Sheet als namenlose Zeile
 * mitgefahren.
 */
export async function loeschePersonenspuren(art: Personenart, personId: number | string) {
  for (const tabelle of ['call_sheet_entries', 'timesheets', 'catering_preferences']) {
    await db.run(`DELETE FROM ${tabelle} WHERE person_type = ? AND person_id = ?`, [art, personId])
  }
}
