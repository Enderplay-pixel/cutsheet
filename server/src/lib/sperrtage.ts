/**
 * Drehtage, an denen jemand aus der Besetzung gesperrt ist - eine Prüfung für
 * die Sperrtage-Seite und den Konfliktradar.
 *
 * Bis 03.11.2026 sah das nur die Sperrtage-Seite. Der Konfliktradar, und mit
 * ihm die Zahl in der Seitenleiste und auf der Hauptseite, prüfte Sperrtage
 * gar nicht, obwohl docs/SEITEN.md es versprach. Und die Seite zählte nur
 * Tage mit einer Szene der Rolle: Wer von Hand auf der Dispo stand, fiel
 * durch. Jetzt gilt die gemeinsame Zählung aus lib/drehtage.ts.
 */
import { drehtageBesetzung } from './drehtage'
import { istIsoDatum } from './datum'

type Lesen = { all: (sql: string, werte?: any[]) => Promise<any[]> }

export type SperrtagKonflikt = { shoot_day: any; cast_name: string; blackout: any }

export async function sperrtagKonflikte(z: Lesen, projectId: number): Promise<SperrtagKonflikt[]> {
  const [tage, sperren, tageJePerson] = await Promise.all([
    // Ausgefallene und drehfreie Tage brauchen niemanden
    z.all(
      `SELECT * FROM shoot_days
        WHERE project_id = ? AND date IS NOT NULL AND date <> ''
          AND status NOT IN ('Sperrtag', 'Drehfrei', 'Ausgefallen')
        ORDER BY date ASC`,
      [projectId]
    ),
    z.all(
      `SELECT cbd.*, c.actor_name AS cast_name
         FROM cast_blackout_dates cbd
         LEFT JOIN "cast" c ON cbd.cast_id = c.id
        WHERE cbd.project_id = ?`,
      [projectId]
    ),
    drehtageBesetzung(z, projectId),
  ])

  const konflikte: SperrtagKonflikt[] = []
  for (const tag of tage) {
    const datum = String(tag.date)
    if (!istIsoDatum(datum)) continue
    for (const sperre of sperren) {
      if (!tageJePerson.get(Number(sperre.cast_id))?.has(Number(tag.id))) continue
      // ISO-Daten vergleichen sich als Text richtig, ohne Zeitzone. Ohne Ende
      // gilt der Sperrtag nur am ersten Tag.
      const ende = sperre.end_date || sperre.start_date
      if (datum >= sperre.start_date && datum <= ende) {
        konflikte.push({ shoot_day: tag, cast_name: sperre.cast_name || 'Unbekannt', blackout: sperre })
      }
    }
  }
  return konflikte
}
