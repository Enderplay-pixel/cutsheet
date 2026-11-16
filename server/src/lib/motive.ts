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

/**
 * Das Set aus dem Titel: der Teil hinter dem ersten Bindestrich mit
 * Leerzeichen (AP C3). "WOHNUNG ANDI - KÜCHE" ist das Set "KÜCHE"; ohne
 * Motiv kein Set.
 */
export function setAusTitel(titel: string | null | undefined): string {
  if (!motivAusTitel(titel)) return ''
  const teile = String(titel ?? '').split(/\s[-–—]\s/)
  return teile.slice(1).join(' - ').replace(/\s+/g, ' ').trim()
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
/**
 * Ein Motiv, das nur aus seinem Namen besteht und an dem außer `ausserSzene`
 * nichts hängt: keine Adresse, kein Kontakt, keine Notiz, keine Miete, kein
 * Foto, keine andere Szene, keine Dispo, kein Vertrag, kein Set-Plan, keine Datei.
 */
async function istLeereHuelle(z: Zugriff, locationId: number, ausserSzene: number): Promise<boolean> {
  const huelle = await z.get(
    `SELECT l.id FROM locations l
      WHERE l.id = ? AND l.address = '' AND l.city = '' AND l.zip = '' AND l.notes = ''
        AND l.contact_name = '' AND l.contact_phone = '' AND l.contact_email = ''
        AND l.rental_fee = 0 AND l.lat IS NULL AND COALESCE(l.photos, '[]') IN ('[]', '')
        -- Drehort-Angaben und Genehmigungen (AP C3): wer sie einträgt, meint diesen Ort
        AND l.hospital_name = '' AND l.hospital_address = '' AND l.hospital_phone = ''
        AND l.basecamp = '' AND l.directions = '' AND l.permit_required = false
        AND NOT EXISTS (SELECT 1 FROM permits g WHERE g.location_id = l.id)
        -- Ein Set, das nicht allein das leere Set dieser Szene ist
        AND NOT EXISTS (SELECT 1 FROM location_sets st WHERE st.location_id = l.id
                          AND (st.notes <> '' OR st.id IS DISTINCT FROM (SELECT set_id FROM scenes WHERE id = ?)))
        AND NOT EXISTS (SELECT 1 FROM scenes s WHERE s.location_id = l.id AND s.id <> ?)
        AND NOT EXISTS (SELECT 1 FROM call_sheets c WHERE c.location_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM location_releases r WHERE r.location_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM floorplans f WHERE f.location_id = l.id)
        AND NOT EXISTS (SELECT 1 FROM project_files d WHERE d.entity_id = l.id
                          AND (d.entity_type ILIKE 'location%' OR d.entity_type ILIKE 'motiv%'))`,
    [locationId, ausserSzene, ausserSzene]
  )
  return !!huelle
}

/** Ein Set ohne Notiz, das außer `ausserSzene` keine Szene benutzt. */
async function istLeeresSet(z: Zugriff, setId: number, ausserSzene: number): Promise<boolean> {
  return !!(await z.get(
    `SELECT st.id FROM location_sets st
      WHERE st.id = ? AND st.notes = ''
        AND NOT EXISTS (SELECT 1 FROM scenes s WHERE s.set_id = st.id AND s.id <> ?)`,
    [setId, ausserSzene]))
}

/**
 * Das Set zur Überschrift einer Szene unter ihrem Motiv finden oder anlegen
 * (AP C3) - nach denselben Regeln wie das Motiv: gefunden ohne Groß- und
 * Kleinschreibung, ein ausgefülltes Set (mit Notiz oder von anderen Szenen
 * benutzt) bleibt, ein leeres folgt der Überschrift und geht, wenn es nicht
 * mehr gebraucht wird. Ein Set gehört immer zum Motiv der Szene.
 */
export async function setVerknuepfen(z: Zugriff, sceneId: number, titel: string | null | undefined): Promise<{ id: number; name: string } | null> {
  const szene = await z.get('SELECT location_id, set_id FROM scenes WHERE id = ?', [sceneId])
  if (!szene) return null
  const ort = Number(szene.location_id) || 0
  const jetzt = szene.set_id ? await z.get('SELECT id, location_id, name FROM location_sets WHERE id = ?', [szene.set_id]) : null
  const jetztLeer = jetzt ? await istLeeresSet(z, Number(jetzt.id), sceneId) : false
  const loesen = async () => {
    await z.run('UPDATE scenes SET set_id = NULL WHERE id = ?', [sceneId])
    if (jetzt && jetztLeer) await z.run('DELETE FROM location_sets WHERE id = ?', [jetzt.id])
  }
  const name = setAusTitel(titel)
  if (!name || !ort) {
    // Ohne Set im Titel bleibt ein bewusst gewähltes Set desselben Motivs
    if (jetzt && (Number(jetzt.location_id) !== ort || jetztLeer)) await loesen()
    return null
  }
  const gesucht = schluessel(name)
  const sets = await z.all('SELECT id, name FROM location_sets WHERE location_id = ? ORDER BY id ASC', [ort])
  const gleich = sets.find((s) => schluessel(s.name) === gesucht)
  if (jetzt && Number(jetzt.location_id) === ort) {
    if (schluessel(jetzt.name) === gesucht) return { id: Number(jetzt.id), name: String(jetzt.name) }
    if (!jetztLeer) return null
    if (!gleich) {
      const neuerName = alsMotivname(name)
      await z.run('UPDATE location_sets SET name = ? WHERE id = ?', [neuerName, jetzt.id])
      return { id: Number(jetzt.id), name: neuerName }
    }
  }
  let ziel = gleich ? { id: Number(gleich.id), name: String(gleich.name) } : null
  if (!ziel) {
    const neuerName = alsMotivname(name)
    const sort = Number((await z.get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM location_sets WHERE location_id = ?', [ort]))?.m ?? 0) + 1
    const neu = await z.run('INSERT INTO location_sets (location_id, name, sort_order) VALUES (?, ?, ?)', [ort, neuerName, sort])
    ziel = { id: neu.id, name: neuerName }
  }
  await z.run('UPDATE scenes SET set_id = ? WHERE id = ?', [ziel.id, sceneId])
  if (jetzt && jetztLeer && Number(jetzt.id) !== ziel.id) await z.run('DELETE FROM location_sets WHERE id = ?', [jetzt.id])
  return ziel
}

/**
 * Nach dem Löschen einer Szene: ihr Set geht mit, wenn es leer war und nur
 * an ihr hing. Aufzurufen, solange die Szene noch da ist.
 */
export async function verwaistesSetEntfernen(z: Zugriff, sceneId: number): Promise<number | null> {
  const szene = await z.get('SELECT set_id FROM scenes WHERE id = ?', [sceneId])
  const setId = Number(szene?.set_id)
  if (!setId || !(await istLeeresSet(z, setId, sceneId))) return null
  return setId
}

/**
 * Nach dem Löschen einer Szene: Ihr Motiv geht mit, wenn es eine leere Hülle
 * war, die nur für diese Szene aus der Überschrift entstand. Gemessen im
 * Testbericht SALZWIND (09.11.2026): Szenen gelöscht, ihre Motive blieben als
 * Waisen in der Motivliste. Ein ausgefülltes Motiv bleibt - dort steht ein
 * realer Drehort. Aufzurufen, solange die Szene noch da ist.
 */
export async function verwaistesMotivEntfernen(z: Zugriff, sceneId: number): Promise<number | null> {
  const szene = await z.get('SELECT location_id FROM scenes WHERE id = ?', [sceneId])
  const locationId = Number(szene?.location_id)
  if (!locationId) return null
  if (!(await istLeereHuelle(z, locationId, sceneId))) return null
  return locationId
}

/** Motiv und Set zur Überschrift einer Szene (AP C3: das Set kommt nach dem Motiv). */
export async function motivVerknuepfen(
  z: Zugriff,
  projectId: number,
  sceneId: number,
  titel: string | null | undefined
): Promise<{ id: number; name: string; neu: boolean } | null> {
  const motiv = await motivZuordnen(z, projectId, sceneId, titel)
  await setVerknuepfen(z, sceneId, titel)
  return motiv
}

async function motivZuordnen(
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
    if (!(await istLeereHuelle(z, Number(jetzt.id), sceneId))) return null
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
