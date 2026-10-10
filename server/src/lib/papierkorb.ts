/**
 * Papierkorb für gelöschte Einträge.
 *
 * Ein Klick auf das falsche Mülleimersymbol ist der häufigste Betriebsschaden
 * in einer Produktionssoftware - und bisher war der Eintrag dann weg. Statt
 * jede Route umzubauen, wird vor dem Löschen die ganze Zeile als JSON
 * abgelegt. Wiederherstellen heisst: dieselbe Zeile mit derselben Kennung
 * wieder einfügen, damit alles, was auf sie zeigt, wieder passt.
 *
 * Nicht alles gehört hierher: Buchhaltungsdaten werden storniert, nicht
 * gelöscht, und Mails aus dem Postausgang sind Belege. Aufgenommen sind die
 * Dinge, die im Alltag versehentlich verschwinden.
 */
import { db } from '../db'

/** Wie lange ein Eintrag im Papierkorb liegt. */
export const AUFBEWAHRUNG_TAGE = 30

/**
 * Tabellen, die über den Papierkorb gehen, mit lesbarem Namen und dem Feld,
 * aus dem die Beschriftung kommt.
 */
export const BEOBACHTET: Record<string, { bezeichnung: string; titelfeld: string }> = {
  scenes:         { bezeichnung: 'Szene',        titelfeld: 'title' },
  crew:           { bezeichnung: 'Stab',         titelfeld: 'name' },
  cast:           { bezeichnung: 'Besetzung',    titelfeld: 'actor_name' },
  characters:     { bezeichnung: 'Rolle',        titelfeld: 'name' },
  locations:      { bezeichnung: 'Motiv',        titelfeld: 'name' },
  shoot_days:     { bezeichnung: 'Drehtag',      titelfeld: 'date' },
  shots:          { bezeichnung: 'Einstellung',  titelfeld: 'shot_number' },
  equipment_items:{ bezeichnung: 'Equipment',    titelfeld: 'name' },
  project_tasks:  { bezeichnung: 'Aufgabe',      titelfeld: 'title' },
  vehicles:       { bezeichnung: 'Fahrzeug',     titelfeld: 'name' },
  extras:         { bezeichnung: 'Komparserie',  titelfeld: 'name' },
  budget_lines:   { bezeichnung: 'Budgetposten', titelfeld: 'description' },
}

/** Name, wie er in der Tabelle steht - `cast` ist in Postgres reserviert. */
function tabellenname(tabelle: string): string {
  return tabelle === 'cast' ? '"cast"' : tabelle
}

/**
 * Legt eine Zeile in den Papierkorb, bevor sie gelöscht wird.
 *
 * Gibt zurück, ob etwas abgelegt wurde - eine nicht gefundene Zeile ist kein
 * Fehler, sondern heisst, dass nichts zu löschen war.
 */
export async function inDenPapierkorb(
  tabelle: string,
  id: number | string,
  angaben: { projectId?: number | null; userId?: number | null } = {}
): Promise<boolean> {
  const muster = BEOBACHTET[tabelle]
  if (!muster) return false

  const zeile = (await db.get(`SELECT * FROM ${tabellenname(tabelle)} WHERE id = ?`, [id])) as any
  if (!zeile) return false

  const projektId = angaben.projectId ?? zeile.project_id ?? null
  const titel = String(zeile[muster.titelfeld] ?? '').slice(0, 200)

  await db.run(
    `INSERT INTO deleted_items (table_name, row_id, project_id, label, payload, deleted_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tabelle, Number(id), projektId, titel, JSON.stringify(zeile), angaben.userId ?? null]
  )
  return true
}

/**
 * Holt einen Eintrag zurück.
 *
 * Die ursprüngliche Kennung wird mitgeschrieben: Alles, was auf die Zeile
 * zeigt - Dispositionen, Arbeitszeiten, Drehplaneinträge - findet sie dadurch
 * wieder. Existiert die Kennung schon wieder, wird nichts überschrieben.
 */
export async function ausDemPapierkorb(
  eintragId: number,
  projectId: number
): Promise<{ wiederhergestellt: boolean; grund?: string; tabelle?: string; titel?: string }> {
  const eintrag = (await db.get(
    'SELECT * FROM deleted_items WHERE id = ? AND project_id = ? AND restored_at IS NULL',
    [eintragId, projectId]
  )) as any
  if (!eintrag) return { wiederhergestellt: false, grund: 'Dieser Eintrag liegt nicht mehr im Papierkorb' }

  const muster = BEOBACHTET[eintrag.table_name]
  if (!muster) return { wiederhergestellt: false, grund: 'Diese Art von Eintrag lässt sich nicht zurückholen' }

  const schon = (await db.get(
    `SELECT id FROM ${tabellenname(eintrag.table_name)} WHERE id = ?`,
    [eintrag.row_id]
  )) as any
  if (schon) {
    return { wiederhergestellt: false, grund: 'Unter dieser Kennung steht schon wieder ein Eintrag' }
  }

  const daten = JSON.parse(eintrag.payload)
  const spalten = Object.keys(daten)
  const platzhalter = spalten.map(() => '?').join(', ')
  await db.run(
    `INSERT INTO ${tabellenname(eintrag.table_name)} (${spalten.map((s) => `"${s}"`).join(', ')})
     VALUES (${platzhalter})`,
    spalten.map((s) => daten[s])
  )
  await db.run('UPDATE deleted_items SET restored_at = NOW() WHERE id = ?', [eintragId])

  return { wiederhergestellt: true, tabelle: muster.bezeichnung, titel: eintrag.label }
}

/** Was im Papierkorb eines Projekts liegt. */
export async function inhalt(projectId: number): Promise<any[]> {
  const zeilen = (await db.all(
    `SELECT d.id, d.table_name, d.row_id, d.label, d.deleted_at, u.name AS geloescht_von
       FROM deleted_items d
       LEFT JOIN users u ON u.id = d.deleted_by
      WHERE d.project_id = ? AND d.restored_at IS NULL
        AND d.deleted_at > NOW() - (? || ' days')::interval
      ORDER BY d.deleted_at DESC
      LIMIT 300`,
    [projectId, String(AUFBEWAHRUNG_TAGE)]
  )) as any[]
  return zeilen.map((z) => ({
    ...z,
    bezeichnung: BEOBACHTET[z.table_name]?.bezeichnung || z.table_name,
  }))
}

/** Räumt ab, was länger als die Frist liegt. */
export async function raeumeAuf(): Promise<number> {
  const zeile = await db.run(
    `DELETE FROM deleted_items WHERE deleted_at < NOW() - (? || ' days')::interval`,
    [String(AUFBEWAHRUNG_TAGE)]
  )
  if (zeile.changes > 0) {
    console.log(`[Papierkorb] ${zeile.changes} Einträge endgültig entfernt`)
  }
  return zeile.changes
}
