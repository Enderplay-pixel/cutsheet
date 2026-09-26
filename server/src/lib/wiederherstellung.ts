import { db } from '../db'

/**
 * Eine Sicherung zurückspielen.
 *
 * Die Sicherung nimmt seit dem 23.09.2026 ALLE Tabellen mit, die ein
 * `project_id` tragen - der Import kannte aber weiterhin nur 25 Tabellen von
 * Hand. Gemessen am 26.09.2026 an einem Langfilm: 300 Drehbuchblöcke in der
 * Datei, 0 nach dem Zurückspielen. Der gesamte Drehbuchtext war weg, dazu
 * Tagesberichte, Arbeitszeiten, Ausgaben, Versicherungen, Musikliste, VFX,
 * Anschlussnotizen, Moodboard, Grundrisse und die komplette Creator-Seite.
 *
 * Eine Sicherung, die sich nicht vollständig zurückspielen lässt, ist keine
 * Sicherung. Deshalb läuft der Import jetzt über das Schema statt über eine
 * Liste: was in der Datei steht und in der Datenbank eine Tabelle hat, kommt
 * zurück.
 */

/**
 * Spalten, die auf eine andere Tabelle zeigen.
 *
 * Bewusst eine Liste und keine Regel "alles auf _id": `youtube_video_id` und
 * `channel_id` sind Kennungen von YouTube, keine Fremdschlüssel. Eine Regel
 * hätte sie umgeschrieben und die Videos vom Kanal getrennt.
 */
const FREMDSCHLUESSEL: Record<string, string> = {
  location_id: 'locations',
  character_id: 'characters',
  cast_id: 'cast',
  crew_id: 'crew',
  scene_id: 'scenes',
  shoot_day_id: 'shoot_days',
  call_sheet_id: 'call_sheets',
  daily_report_id: 'daily_reports',
  budget_version_id: 'budget_versions',
  budget_line_id: 'budget_lines',
  financing_version_id: 'financing_plan_versions',
  equipment_list_id: 'equipment_lists',
  equipment_item_id: 'equipment_items',
  shot_id: 'shots',
  camera_report_id: 'camera_reports',
  video_id: 'creator_videos',
  floorplan_id: 'floorplans',
}

/** `person_type` entscheidet, worauf `person_id` zeigt. */
const PERSONEN: Record<string, string> = { cast: 'cast', crew: 'crew' }

/** `entity_type` entscheidet, worauf `entity_id` zeigt. */
const ENTITAETEN: Record<string, string> = {
  scene: 'scenes', shoot_day: 'shoot_days', location: 'locations',
  shot: 'shots', cast: 'cast', crew: 'crew',
}

/**
 * Tabellen, die bewusst NICHT mitkommen.
 *
 * Zugangsdaten und Verläufe gehören dem alten Projekt, nicht der Kopie: wer
 * eine Sicherung zurückspielt, soll keine fremden Einladungen, Gastlinks
 * oder YouTube-Zugänge erben. Das Protokoll beschreibt Ereignisse, die in der
 * Kopie nie stattgefunden haben.
 */
const NICHT_IMPORTIEREN = new Set([
  'projects',                  // wird vom Aufrufer selbst angelegt
  'project_members',           // Mitglieder sind Sache des neuen Eigentümers
  'project_invites', 'guest_tokens', 'push_subscriptions',
  'password_reset_tokens', 'feedback',
  'audit_log', 'email_log',
  // Der Schnappschuss ist ein JSON-Abzug des alten Drehplans mit dessen
  // Kennungen. Zurueckgespielt wuerde er auf Szenen zeigen, die es in der
  // Kopie nicht gibt - eine Wiederherstellung, die den Plan zerstoert, waere
  // schlimmer als eine fehlende Fassung.
  'drehplan_versions',
  'creator_youtube_accounts', 'creator_youtube_ignored',
])

/**
 * Spalten, die Kennungen als JSON-Liste tragen statt als Fremdschlüssel.
 *
 * `daily_reports.scenes_completed` ist Text: ["12","13"]. Ohne Umschreiben
 * zeigt die Kopie auf Szenen des Originals - die Zeitanalyse rechnete dann
 * mit fremden Nummern. Gemessen am 26.09.2026 an der Kopie von Projekt 1.
 */
const JSON_KENNUNGEN: Record<string, Record<string, string>> = {
  daily_reports: { scenes_completed: 'scenes', scenes_partial: 'scenes' },
  scheduling_suggestions: { scene_ids: 'scenes' },
}

/** Spalten, die nie übernommen werden. */
const NICHT_UEBERNEHMEN = new Set(['id', 'created_at', 'updated_at'])

/** Alles, was nach einem Geheimnis aussieht, bleibt draußen. */
function istGeheimnis(spalte: string): boolean {
  return /token|password|secret/i.test(spalte)
}

type Spalte = { name: string; pflicht: boolean }

async function schemaLesen(): Promise<Map<string, Spalte[]>> {
  const zeilen = await db.all(
    `SELECT table_name, column_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`
  ) as Array<{ table_name: string; column_name: string; is_nullable: string; column_default: string | null }>

  const schema = new Map<string, Spalte[]>()
  for (const z of zeilen) {
    const liste = schema.get(z.table_name) ?? []
    liste.push({
      name: z.column_name,
      // Eine Spalte mit Vorgabewert ist nicht wirklich Pflicht - sie füllt
      // sich selbst.
      pflicht: z.is_nullable === 'NO' && z.column_default === null,
    })
    schema.set(z.table_name, liste)
  }
  return schema
}

/**
 * Eltern vor Kindern. Die Reihenfolge ergibt sich aus den Fremdschlüsseln
 * selbst, damit eine neue Tabelle nicht von Hand einsortiert werden muss.
 */
function reihenfolge(tabellen: string[], schema: Map<string, Spalte[]>): string[] {
  const offen = new Set(tabellen)
  const fertig: string[] = []
  const erledigt = new Set<string>()

  const haengtAn = (tabelle: string): string[] => {
    const spalten = schema.get(tabelle) ?? []
    const ziele = new Set<string>()
    for (const s of spalten) {
      const ziel = FREMDSCHLUESSEL[s.name]
      if (ziel && ziel !== tabelle && offen.has(ziel)) ziele.add(ziel)
      if (s.name === 'person_id') for (const t of Object.values(PERSONEN)) if (offen.has(t)) ziele.add(t)
      if (s.name === 'entity_id') for (const t of Object.values(ENTITAETEN)) if (offen.has(t)) ziele.add(t)
    }
    return [...ziele]
  }

  // Einfache Tiefensuche. Ein Kreis (zwei Tabellen, die sich gegenseitig
  // brauchen) wird abgebrochen statt zu hängen - dann fehlt eine Zuordnung,
  // aber der Import läuft durch.
  const besuche = (tabelle: string, pfad: Set<string>) => {
    if (erledigt.has(tabelle) || pfad.has(tabelle)) return
    pfad.add(tabelle)
    for (const eltern of haengtAn(tabelle)) besuche(eltern, pfad)
    pfad.delete(tabelle)
    if (!erledigt.has(tabelle)) { erledigt.add(tabelle); fertig.push(tabelle) }
  }

  for (const t of tabellen) besuche(t, new Set())
  return fertig
}

/**
 * Eine JSON-Liste von Kennungen auf die neuen Kennungen umschreiben. Was sich
 * nicht auflösen lässt, fällt heraus: eine Nummer, die auf nichts zeigt, ist
 * schlimmer als eine fehlende.
 */
function kennungslisteUmschreiben(
  wert: unknown, ziel: string, abbilden: (tabelle: string, alt: unknown) => number | null,
): string {
  let liste: unknown[]
  try {
    liste = JSON.parse(String(wert ?? '[]'))
  } catch {
    return '[]'
  }
  if (!Array.isArray(liste)) return '[]'
  const neu = liste.map(x => abbilden(ziel, x)).filter((x): x is number => x !== null)
  return JSON.stringify(neu)
}

export type Bericht = {
  /** Wie viele Zeilen je Tabelle angelegt wurden. */
  uebernommen: Record<string, number>
  /** Zeilen, deren Bezug nicht aufzulösen war - mit Grund. */
  ausgelassen: Array<{ tabelle: string; grund: string; anzahl: number }>
}

/**
 * Spielt den Inhalt einer Sicherung in ein bereits angelegtes Projekt.
 *
 * @param daten      Tabellenname -> Zeilen, so wie die Sicherung sie enthält
 * @param projektId  das neue, leere Projekt
 * @param nutzerId   wer importiert - ersetzt Verweise auf nicht mehr
 *                   vorhandene Konten
 */
export async function importiereInhalt(
  daten: Record<string, unknown[]>, projektId: number, nutzerId: number,
): Promise<Bericht> {
  const schema = await schemaLesen()

  const vorhandeneNutzer = new Set(
    ((await db.all('SELECT id FROM users')) as Array<{ id: number }>).map(u => Number(u.id))
  )

  const tabellen = Object.keys(daten).filter(t =>
    Array.isArray(daten[t]) && (daten[t] as unknown[]).length > 0
    && schema.has(t) && !NICHT_IMPORTIEREN.has(t)
  )

  const karten = new Map<string, Map<number, number>>()
  const uebernommen: Record<string, number> = {}
  const ausgelassenZaehler = new Map<string, number>()

  const abbilden = (tabelle: string, alteId: unknown): number | null => {
    if (alteId === null || alteId === undefined) return null
    return karten.get(tabelle)?.get(Number(alteId)) ?? null
  }

  for (const tabelle of reihenfolge(tabellen, schema)) {
    const spalten = schema.get(tabelle)!
    const namen = spalten.map(s => s.name)
    const karte = new Map<number, number>()
    let anzahl = 0

    for (const roh of daten[tabelle] as Record<string, unknown>[]) {
      if (!roh || typeof roh !== 'object') continue

      const einfuegen: Record<string, unknown> = {}
      let ueberspringen: string | null = null

      for (const spalte of spalten) {
        const name = spalte.name
        if (NICHT_UEBERNEHMEN.has(name) || istGeheimnis(name)) continue

        if (name === 'project_id') { einfuegen[name] = projektId; continue }

        // Verweise auf Konten: das ursprüngliche behalten, solange es das
        // Konto noch gibt - sonst gehört die Zeile dem Importierenden.
        if (name === 'user_id' || name === 'created_by' || name === 'owner_id') {
          const alt = Number(roh[name])
          einfuegen[name] = vorhandeneNutzer.has(alt) ? alt : (spalte.pflicht ? nutzerId : null)
          continue
        }

        let ziel = FREMDSCHLUESSEL[name]
        if (name === 'person_id') ziel = PERSONEN[String(roh['person_type'] ?? '')]
        if (name === 'entity_id') ziel = ENTITAETEN[String(roh['entity_type'] ?? '')]

        if (ziel) {
          const neu = abbilden(ziel, roh[name])
          if (neu === null && roh[name] !== null && roh[name] !== undefined && spalte.pflicht) {
            // Ein Pflichtbezug, den es nicht mehr gibt: die Zeile hätte keinen
            // Sinn und würde an der Datenbank scheitern.
            ueberspringen = `${name} nicht auflösbar`
            break
          }
          einfuegen[name] = neu
          continue
        }

        const jsonZiel = JSON_KENNUNGEN[tabelle]?.[name]
        if (jsonZiel) {
          einfuegen[name] = kennungslisteUmschreiben(roh[name], jsonZiel, abbilden)
          continue
        }

        if (name in roh) einfuegen[name] = roh[name]
      }

      if (ueberspringen) {
        const schluessel = `${tabelle}|${ueberspringen}`
        ausgelassenZaehler.set(schluessel, (ausgelassenZaehler.get(schluessel) ?? 0) + 1)
        continue
      }

      const felder = Object.keys(einfuegen)
      if (felder.length === 0) continue

      const platzhalter = felder.map(() => '?').join(', ')
      const ergebnis = await db.run(
        `INSERT INTO ${tabelle} (${felder.join(', ')}) VALUES (${platzhalter})`,
        felder.map(f => einfuegen[f])
      )
      anzahl++
      if (namen.includes('id') && roh['id'] !== undefined && ergebnis.id) {
        karte.set(Number(roh['id']), Number(ergebnis.id))
      }
    }

    karten.set(tabelle, karte)
    if (anzahl > 0) uebernommen[tabelle] = anzahl
  }

  return {
    uebernommen,
    ausgelassen: [...ausgelassenZaehler.entries()].map(([k, anzahl]) => {
      const [tabelle, grund] = k.split('|')
      return { tabelle, grund, anzahl }
    }),
  }
}
