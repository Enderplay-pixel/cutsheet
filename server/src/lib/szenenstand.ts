/**
 * Was der Tagesbericht als abgedreht führt, gilt auch für die Szene selbst.
 *
 * Fund 264 (08.11.2026): Der Tagesbericht führt abgedrehte Szenen als eigene
 * Liste (`daily_reports.scenes_completed`). Hauptseite ("Szenen abgedreht"),
 * Szenenliste (Filter "abgedreht") und der Haken an der Szene lesen dagegen
 * `scenes.shot_status`. Wer am Set im Tagesbericht abhakte - dort, wo man es
 * tut -, sah den Fortschritt des Projekts nicht wachsen.
 *
 * Abgleich nur in diese Richtung und nur für das, was sich im Bericht
 * geändert hat: Neu abgedreht setzt den Haken. Zurückgenommen nimmt ihn
 * weg, außer ein anderer Tagesbericht führt die Szene noch als abgedreht.
 */

type Schreiben = {
  all: (sql: string, werte?: any[]) => Promise<any[]>
  run: (sql: string, werte?: any[]) => Promise<unknown>
}

function idListe(roh: unknown): number[] {
  if (Array.isArray(roh)) return roh.map(Number).filter(Number.isFinite)
  try {
    const liste = JSON.parse(String(roh || '[]'))
    return Array.isArray(liste) ? liste.map(Number).filter(Number.isFinite) : []
  } catch {
    return []
  }
}

export async function abgedrehtAbgleichen(
  z: Schreiben,
  projectId: number,
  berichtId: number,
  vorher: unknown,
  nachher: unknown,
): Promise<void> {
  const alt = idListe(vorher)
  const neu = idListe(nachher)
  const dazu = neu.filter(id => !alt.includes(id))
  const weg = alt.filter(id => !neu.includes(id))

  if (dazu.length > 0) {
    await z.run(
      `UPDATE scenes SET shot_status = 'abgedreht' WHERE project_id = ? AND id = ANY(?::int[])`,
      [projectId, dazu],
    )
  }
  if (weg.length > 0) {
    const andere = await z.all(
      `SELECT dr.scenes_completed FROM daily_reports dr
         JOIN shoot_days sd ON sd.id = dr.shoot_day_id
        WHERE sd.project_id = ? AND dr.id <> ?`,
      [projectId, berichtId],
    )
    const nochAbgedreht = new Set(andere.flatMap(r => idListe(r.scenes_completed)))
    const zurueck = weg.filter(id => !nochAbgedreht.has(id))
    if (zurueck.length > 0) {
      await z.run(
        `UPDATE scenes SET shot_status = 'offen' WHERE project_id = ? AND id = ANY(?::int[]) AND shot_status = 'abgedreht'`,
        [projectId, zurueck],
      )
    }
  }
}
