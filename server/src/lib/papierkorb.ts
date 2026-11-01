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
import { db, TxClient } from '../db'

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
  equipment_items:{ bezeichnung: 'Equipment',    titelfeld: 'item' },
  project_tasks:  { bezeichnung: 'Aufgabe',      titelfeld: 'title' },
  vehicles:       { bezeichnung: 'Fahrzeug',     titelfeld: 'name' },
  extras:         { bezeichnung: 'Komparserie',  titelfeld: 'name' },
  budget_lines:   { bezeichnung: 'Budgetposten', titelfeld: 'description' },
}

/**
 * Tabellen ohne eigene project_id: das Projekt hängt an der Elternzeile.
 * Gemessen am 01.11.2026: eine gelöschte Budgetposition lag mit project_id
 * NULL im Papierkorb, die Liste des Projekts zeigte sie nie - zurückholen
 * ging nicht.
 */
const PROJEKT_UEBER: Record<string, { spalte: string; sql: string }> = {
  budget_lines:    { spalte: 'budget_version_id', sql: 'SELECT project_id FROM budget_versions WHERE id = ?' },
  equipment_items: { spalte: 'equipment_list_id', sql: 'SELECT project_id FROM equipment_lists WHERE id = ?' },
}

/** Name, wie er in der Tabelle steht - `cast` ist in Postgres reserviert. */
function tabellenname(tabelle: string): string {
  return tabelle === 'cast' ? '"cast"' : tabelle
}

/** Was beim Löschen einer Zeile mitgeht - abgelegt neben der Zeile selbst. */
interface Abhaengiges {
  /** Zeilen, die per ON DELETE CASCADE mitgelöscht werden - Eltern vor Kindern */
  zeilen: Array<{ tabelle: string; zeilen: any[] }>
  /** Verweise, die per ON DELETE SET NULL gelöst werden */
  verweise: Array<{ tabelle: string; spalte: string; wert: number; ids: number[] }>
}

/** Fremdschlüssel, die auf eine Tabelle zeigen - je Tabelle einmal gelesen. */
const verweiseCache = new Map<string, Array<{ tabelle: string; spalte: string; regel: string }>>()

async function verweiseAuf(tabelle: string) {
  let liste = verweiseCache.get(tabelle)
  if (!liste) {
    liste = (await db.all(
      `SELECT cl.relname AS tabelle, a.attname AS spalte, c.confdeltype AS regel
         FROM pg_constraint c
         JOIN pg_class cl ON cl.oid = c.conrelid
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = ?::regclass AND cardinality(c.conkey) = 1
        ORDER BY cl.relname, a.attname`,
      [tabellenname(tabelle)]
    )) as Array<{ tabelle: string; spalte: string; regel: string }>
    verweiseCache.set(tabelle, liste)
  }
  return liste
}

/**
 * Sammelt, was die Datenbank beim Löschen mitnimmt oder löst.
 *
 * Gemessen am 25.10.2026: Eine zurückgeholte Szene stand ohne Drehplaneintrag,
 * ohne Rollen und ohne ihren Drehbuchtext da, ein zurückgeholtes Motiv ohne
 * Vertrag und ohne die Szenen, die dort spielen - all das hatten CASCADE und
 * SET NULL beim Löschen erledigt.
 */
async function sammleAbhaengiges(tabelle: string, id: number, ergebnis: Abhaengiges, tiefe = 0): Promise<Abhaengiges> {
  for (const v of await verweiseAuf(tabelle)) {
    if (v.regel === 'c') {
      const zeilen = (await db.all(`SELECT * FROM ${tabellenname(v.tabelle)} WHERE "${v.spalte}" = ?`, [id])) as any[]
      if (zeilen.length === 0) continue
      ergebnis.zeilen.push({ tabelle: v.tabelle, zeilen })
      // Kinder der Kinder (Dispo → Einträge). Tiefer reicht im Schema nichts.
      if (tiefe < 2) {
        for (const z of zeilen) if (z.id != null) await sammleAbhaengiges(v.tabelle, z.id, ergebnis, tiefe + 1)
      }
    } else if (v.regel === 'n') {
      const zeilen = (await db.all(`SELECT id FROM ${tabellenname(v.tabelle)} WHERE "${v.spalte}" = ?`, [id])) as any[]
      if (zeilen.length > 0) ergebnis.verweise.push({ tabelle: v.tabelle, spalte: v.spalte, wert: id, ids: zeilen.map((z) => z.id) })
    }
  }
  return ergebnis
}

/** Eine Zeile so einfügen, wie sie abgelegt wurde - mit ihrer Kennung. */
async function fuegeEin(tx: TxClient, tabelle: string, daten: any, konfliktOk = false) {
  const spalten = Object.keys(daten)
  await tx.run(
    `INSERT INTO ${tabellenname(tabelle)} (${spalten.map((s) => `"${s}"`).join(', ')})
     VALUES (${spalten.map(() => '?').join(', ')})${konfliktOk ? ' ON CONFLICT DO NOTHING' : ''}`,
    spalten.map((s) => daten[s])
  )
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

  let projektId = angaben.projectId ?? zeile.project_id ?? null
  const ueber = PROJEKT_UEBER[tabelle]
  if (projektId == null && ueber && zeile[ueber.spalte] != null) {
    projektId = ((await db.get(ueber.sql, [zeile[ueber.spalte]])) as any)?.project_id ?? null
  }
  const titel = String(zeile[muster.titelfeld] ?? '').slice(0, 200)
  const abhaengig = await sammleAbhaengiges(tabelle, Number(id), { zeilen: [], verweise: [] })

  await db.run(
    `INSERT INTO deleted_items (table_name, row_id, project_id, label, payload, dependents, deleted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tabelle, Number(id), projektId, titel, JSON.stringify(zeile), JSON.stringify(abhaengig), angaben.userId ?? null]
  )
  return true
}

/**
 * Holt einen Eintrag zurück.
 *
 * Die ursprüngliche Kennung wird mitgeschrieben: Was ohne Fremdschlüssel auf
 * die Zeile zeigt (Dispo-Einträge über person_id), findet sie dadurch wieder.
 * Was die Datenbank beim Löschen mitgenommen oder gelöst hat, steht in
 * `dependents` und kommt mit zurück - soweit das, worauf es sonst noch zeigt,
 * noch da ist. Existiert die Kennung schon wieder, wird nichts überschrieben.
 */
export async function ausDemPapierkorb(
  eintragId: number,
  projectId: number
): Promise<{ wiederhergestellt: boolean; grund?: string; tabelle?: string; titel?: string; mit?: number; ohne?: number }> {
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
  // Einträge von vor dem 25.10.2026 haben nichts dazu abgelegt
  const abhaengig: Abhaengiges = eintrag.dependents ? JSON.parse(eintrag.dependents) : { zeilen: [], verweise: [] }
  let mit = 0
  let ohne = 0
  await db.transaction(async (tx) => {
    await fuegeEin(tx, eintrag.table_name, daten)
    for (const gruppe of abhaengig.zeilen) {
      for (const zeile of gruppe.zeilen) {
        // Je Zeile für sich: Zeigt sie auch auf etwas, das inzwischen fehlt
        // (die Rolle einer Szene ist selbst gelöscht), bleibt nur sie weg.
        await tx.run('SAVEPOINT zeile')
        try {
          await fuegeEin(tx, gruppe.tabelle, zeile, true)
          await tx.run('RELEASE SAVEPOINT zeile')
          mit++
        } catch {
          await tx.run('ROLLBACK TO SAVEPOINT zeile')
          ohne++
        }
      }
    }
    // Nur, was seitdem niemand anders verknüpft hat
    for (const v of abhaengig.verweise) {
      const r = await tx.run(
        `UPDATE ${tabellenname(v.tabelle)} SET "${v.spalte}" = ? WHERE id = ANY(?) AND "${v.spalte}" IS NULL`,
        [v.wert, v.ids]
      )
      mit += r.changes
    }
    // Die Summe der Fassung steht in der Fassung selbst - ohne das fehlte
    // die zurückgeholte Position in "Gesamtbudget", bis die nächste sich änderte.
    if (eintrag.table_name === 'budget_lines' && daten.budget_version_id) {
      await tx.run(
        `UPDATE budget_versions SET total_cents =
           (SELECT COALESCE(SUM(total_cents), 0) FROM budget_lines WHERE budget_version_id = ?)
         WHERE id = ?`,
        [daten.budget_version_id, daten.budget_version_id]
      )
    }
    await tx.run('UPDATE deleted_items SET restored_at = NOW() WHERE id = ?', [eintragId])
  })

  return { wiederhergestellt: true, tabelle: muster.bezeichnung, titel: eintrag.label, mit, ohne }
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
