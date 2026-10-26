/**
 * Motive aus dem Drehbuch.
 *
 * Grundsatz von Florian (26.10.2026): In CutSheet ist alles verknüpft, und die
 * Szenenüberschrift legt auch ein Motiv an. Im Drehbuch steht der Spielort
 * ("INT. HAFEN - NACHT"), ein Motiv ist der reale Drehort mit Adresse - beides
 * kann verschieden sein. Daraus folgen die Regeln:
 *
 *  - Das Motiv heißt wie der Ort vor dem ersten Bindestrich: "WOHNUNG ANDI -
 *    KÜCHE" ist das Motiv "Wohnung Andi", die Küche ein Set darin.
 *  - Gefunden wird ohne Groß- und Kleinschreibung, sonst angelegt. Von dort
 *    kommt es in Motivliste, Drehplan, Dispo, Motivvertrag und Sonnenstand.
 *  - Ein Motiv, das die Szene schon hat und das jemand ausgefüllt hat
 *    (Adresse, Kontakt, Notiz, Miete, Vertrag), bleibt: Dort steht ein realer
 *    Drehort, bewusst gewählt - "HAFEN" wird vielleicht in einer Halle gedreht.
 *    Nur eine leere Hülle, die allein an dieser Szene hängt, folgt der
 *    Überschrift. So heilt ein Tippfehler ("HAFFEN") von selbst: Die Hülle
 *    wird umbenannt - oder, wenn es das richtige Motiv schon gibt, wechselt
 *    die Szene dorthin, und die Hülle geht. An ihr hängt dann nichts mehr.
 */

/** Was zum Lesen und Schreiben gebraucht wird - die Datenbank oder eine Transaktion. */
type Zugriff = {
  get: (sql: string, werte?: any[]) => Promise<any>
  all: (sql: string, werte?: any[]) => Promise<any[]>
  run: (sql: string, werte?: any[]) => Promise<{ id: number; changes: number }>
}

/**
 * Der Ort aus dem Titel einer Szenenüberschrift: der Teil vor dem ersten
 * Bindestrich. Leer bei den Platzhaltern, die CutSheet selbst einsetzt:
 * "SZENE 7" für eine Szene ohne Titel (lib/szenenUeberschrift.ts) und "NEUE
 * SZENE" für eine im Editor angelegte - wer die Zeile unverändert verlässt,
 * hat keinen Spielort genannt.
 */
export function motivAusTitel(titel: string | null | undefined): string {
  const ort = String(titel ?? '').split(/\s[-–—]\s/)[0].replace(/\s+/g, ' ').trim()
  if (/^(szene|scene)\s+\S+$/i.test(ort) || /^(neue szene|new scene|nouvelle scène)$/i.test(ort)) return ''
  return ort
}

/** Kleine Wörter, die im Namen klein bleiben: "Büro von Dr. Müller", "House of Cards". */
const KLEINWOERTER = new Set([
  'der', 'die', 'das', 'des', 'dem', 'den', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'im', 'in', 'am', 'an', 'auf', 'aus', 'bei', 'mit', 'nach', 'von', 'vom', 'vor', 'zu', 'zum', 'zur',
  'und', 'oder', 'über', 'unter', 'hinter', 'neben', 'zwischen',
  'of', 'the', 'and', 'at', 'on',
])

/**
 * Der Name, wie er in der Motivliste steht. In Großbuchstaben getippt
 * ("BÜRO VON DR. MÜLLER") wird er zu "Büro von Dr. Müller"; wer schon gemischt
 * schreibt, bekommt seinen Namen so, wie er ihn geschrieben hat.
 */
export function alsMotivname(ort: string): string {
  if (ort !== ort.toLocaleUpperCase('de-DE')) return ort
  return ort
    .toLocaleLowerCase('de-DE')
    .split(' ')
    .map((wort, i) => (i > 0 && KLEINWOERTER.has(wort)
      ? wort
      : wort.replace(/(^|[-/(])(\p{L})/gu, (_t, vor: string, b: string) => vor + b.toLocaleUpperCase('de-DE'))))
    .join(' ')
}

const schluessel = (name: unknown) => String(name ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')

/**
 * Das Motiv zur Überschrift einer Szene finden oder anlegen und der Szene
 * zuordnen - nach den Regeln oben. Gibt das Motiv zurück, oder null, wenn
 * nichts zugeordnet wurde.
 */
export async function motivVerknuepfen(
  z: Zugriff,
  projectId: number,
  sceneId: number,
  titel: string | null | undefined
): Promise<{ id: number; name: string; neu: boolean } | null> {
  const ort = motivAusTitel(titel)
  if (!ort) return null
  const gesucht = schluessel(ort)
  const szene = await z.get('SELECT location_id FROM scenes WHERE id = ? AND project_id = ?', [sceneId, projectId])
  if (!szene) return null
  const motive = await z.all('SELECT id, name FROM locations WHERE project_id = ? ORDER BY id ASC', [projectId])
  const gleich = motive.find((m) => schluessel(m.name) === gesucht)
  const jetzt = szene.location_id ? motive.find((m) => Number(m.id) === Number(szene.location_id)) : null

  if (jetzt && schluessel(jetzt.name) === gesucht) return { id: Number(jetzt.id), name: String(jetzt.name), neu: false }

  if (jetzt) {
    // Nur eine leere Hülle, an der sonst nichts hängt, folgt der Überschrift
    const huelle = await z.get(
      `SELECT l.id FROM locations l
        WHERE l.id = ? AND l.address = '' AND l.city = '' AND l.zip = '' AND l.notes = ''
          AND l.contact_name = '' AND l.contact_phone = '' AND l.contact_email = ''
          AND l.rental_fee = 0 AND l.lat IS NULL AND COALESCE(l.photos, '[]') IN ('[]', '')
          AND NOT EXISTS (SELECT 1 FROM scenes s WHERE s.location_id = l.id AND s.id <> ?)
          AND NOT EXISTS (SELECT 1 FROM call_sheets c WHERE c.location_id = l.id)
          AND NOT EXISTS (SELECT 1 FROM location_releases r WHERE r.location_id = l.id)
          AND NOT EXISTS (SELECT 1 FROM floorplans f WHERE f.location_id = l.id)
          AND NOT EXISTS (SELECT 1 FROM project_files d WHERE d.entity_id = l.id
                            AND (d.entity_type ILIKE 'location%' OR d.entity_type ILIKE 'motiv%'))`,
      [jetzt.id, sceneId]
    )
    if (!huelle) return null
    if (!gleich) {
      const name = alsMotivname(ort)
      await z.run('UPDATE locations SET name = ? WHERE id = ?', [name, jetzt.id])
      return { id: Number(jetzt.id), name, neu: false }
    }
    // Gemessen am 26.10.2026: "HAFFEN" zu "HAFEN" korrigiert, "Hafen" gab es
    // schon - die Hülle "Haffen" blieb verwaist in der Motivliste stehen.
    await z.run('UPDATE scenes SET location_id = ?, updated_at = NOW() WHERE id = ?', [gleich.id, sceneId])
    await z.run('DELETE FROM locations WHERE id = ?', [jetzt.id])
    return { id: Number(gleich.id), name: String(gleich.name), neu: false }
  }

  let motiv = gleich ? { id: Number(gleich.id), name: String(gleich.name), neu: false } : null
  if (!motiv) {
    const name = alsMotivname(ort)
    const neu = await z.run('INSERT INTO locations (project_id, name) VALUES (?, ?)', [projectId, name])
    motiv = { id: neu.id, name, neu: true }
  }
  await z.run('UPDATE scenes SET location_id = ?, updated_at = NOW() WHERE id = ?', [motiv.id, sceneId])
  return motiv
}
