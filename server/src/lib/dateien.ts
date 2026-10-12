/**
 * Dateien, die einen Deploy überstehen.
 *
 * ## Warum das nötig war
 *
 * Grundrisse, Motivfotos und Storyboards wurden als Dateien auf die Platte
 * geschrieben - `uploads/floorplans`, `uploads/locations`,
 * `uploads/storyboard`. Beim Hoster ist das Dateisystem flüchtig: Jeder Deploy
 * startet einen neuen Container, und was dort zur Laufzeit geschrieben wurde,
 * ist weg. Ein dauerhafter Datenträger ist in `render.yaml` nicht
 * konfiguriert.
 *
 * Das fällt nicht auf. Das Bild verschwindet, die Zeile in der Datenbank
 * bleibt, und im Browser steht ein kaputtes Bild ohne Erklärung - zumal die
 * Anwendung für `/uploads/fehlt.png` die HTML-Seite auslieferte statt 404.
 *
 * ## Wie es jetzt läuft
 *
 * Die Dateien liegen in der Datenbank, als `BYTEA`. Das macht die
 * Mailanhänge seit Runde 1 genauso, und es überlebt jeden Deploy.
 *
 * Das ist nicht die Lösung für beliebig große Mengen - ein Datenbankfeld ist
 * kein Objektspeicher. Für Grundrisse, Fotos, Nachweise und Scans einer
 * Produktion reicht es; die Obergrenze steht unten und wird durchgesetzt.
 */

/** Was eine einzelne Datei höchstens wiegen darf. */
export const MAX_BYTES = 20 * 1024 * 1024

/**
 * Welche Arten es gibt.
 *
 * Die Art entscheidet, wo die Datei auftaucht und ob ihr Ablaufdatum
 * überwacht wird. 'sonstiges' ist kein Mangel - manches ist einfach ein Blatt,
 * das man aufheben will.
 */
export const ARTEN = [
  { art: 'genehmigung', name: 'Drehgenehmigung', mitFrist: true },
  { art: 'versicherung', name: 'Versicherungsnachweis', mitFrist: true },
  { art: 'vertrag', name: 'Vertrag (Scan)', mitFrist: false },
  { art: 'rechnung', name: 'Eingangsrechnung', mitFrist: false },
  { art: 'grundriss', name: 'Grundriss', mitFrist: false },
  { art: 'foto', name: 'Foto', mitFrist: false },
  { art: 'storyboard', name: 'Storyboard', mitFrist: false },
  { art: 'sonstiges', name: 'Sonstiges', mitFrist: false },
] as const

export type Dateiart = typeof ARTEN[number]['art']

export function istArt(wert: string): wert is Dateiart {
  return ARTEN.some((a) => a.art === wert)
}

/** Arten, bei denen ein Ablaufdatum überwacht wird. */
export function mitFrist(art: string): boolean {
  return ARTEN.find((a) => a.art === art)?.mitFrist === true
}

/**
 * Ein Dateiname, der auf jedem Rechner funktioniert.
 *
 * Entfernt Pfadanteile und Zeichen, die Windows nicht mag. Umlaute bleiben -
 * sie sind der Grund, warum jemand die Datei wiedererkennt.
 */
export function sichererName(name: string): string {
  const ohnePfad = String(name || '').split(/[\\/]/).pop() || 'datei'
  const sauber = ohnePfad
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return (sauber || 'datei').slice(0, 200)
}

/**
 * Lesbare Größe: 1536 Bytes werden zu "1,5 KB".
 *
 * Tausenderschritte, nicht 1024er - so steht es auf jedem Produktblatt, und
 * die Zahl soll der entsprechen, die der Nutzer woanders sieht.
 */
export function groesse(bytes: number): string {
  const b = Number(bytes || 0)
  if (b < 1000) return `${b} B`
  const einheiten = ['KB', 'MB', 'GB']
  let wert = b / 1000
  let i = 0
  while (wert >= 1000 && i < einheiten.length - 1) { wert /= 1000; i++ }
  return `${wert.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${einheiten[i]}`
}

/**
 * Ob der angegebene Medientyp zur Art passt.
 *
 * Großzügig: Ein Grundriss als PDF ist genauso brauchbar wie als Bild, und
 * wer einen Nachweis als Foto abfotografiert hat, soll ihn ablegen können.
 * Abgewiesen wird nur, was offensichtlich nicht hingehört.
 */
export function typPasst(art: string, mime: string): boolean {
  const typ = String(mime || '').toLowerCase()
  const istBild = typ.startsWith('image/')
  const istPdf = typ === 'application/pdf'
  if (art === 'foto' || art === 'storyboard' || art === 'grundriss') return istBild || istPdf
  // Nachweise und Verträge kommen als PDF oder als abfotografiertes Blatt.
  return istBild || istPdf
}

/**
 * Eine hochgeladene Datei in der Ablage speichern und ihre Adresse liefern.
 *
 * Der Umweg über `db` als Parameter statt als Import hält diese Datei frei von
 * der Datenbank - sie ist sonst reine Rechnerei und als solche prüfbar.
 */
export async function speichereDatei(
  zugriff: { run: (sql: string, params?: any[]) => Promise<{ id: number; changes: number }> },
  opts: {
    projectId: number
    art: Dateiart
    datei: { originalname: string; mimetype: string; size: number; buffer: Buffer }
    bezugTyp?: string
    bezugId?: number | null
    nutzerId?: number | null
  }
): Promise<{ id: number; url: string }> {
  const zeile = await zugriff.run(
    `INSERT INTO project_files
       (project_id, kind, filename, mime, bytes, content, entity_type, entity_id, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      opts.projectId, opts.art,
      sichererName(opts.datei.originalname),
      opts.datei.mimetype, opts.datei.size, opts.datei.buffer,
      opts.bezugTyp || '', opts.bezugId ?? null, opts.nutzerId ?? null,
    ]
  )
  return { id: zeile.id, url: dateiUrl(opts.projectId, zeile.id) }
}

/** Die Adresse, unter der eine abgelegte Datei ausgeliefert wird. */
export function dateiUrl(projectId: number, dateiId: number): string {
  return `/api/projects/${projectId}/dateien/${dateiId}/inhalt`
}

/** Erkennt die Kennung in einer Adresse aus `dateiUrl` - null bei alten Pfaden. */
export function dateiIdAus(url: string): number | null {
  const treffer = /\/api\/projects\/\d+\/dateien\/(\d+)\/inhalt/.exec(String(url || ''))
  return treffer ? Number(treffer[1]) : null
}

/** Status eines Ablaufdatums. */
export type Fristart = 'ohne' | 'gueltig' | 'laeuft_ab' | 'abgelaufen'

/**
 * Wie es um die Frist steht.
 *
 * `laeuft_ab` ab 30 Tagen vorher: Eine Drehgenehmigung zu verlängern dauert,
 * und eine Woche vorher ist es zu spät.
 */
export function fristStand(gueltigBis: string | null | undefined, heute: string): Fristart {
  if (!gueltigBis) return 'ohne'
  const bis = String(gueltigBis).slice(0, 10)
  const jetzt = String(heute).slice(0, 10)
  if (bis < jetzt) return 'abgelaufen'
  const grenze = new Date(Date.parse(`${jetzt}T00:00:00Z`) + 30 * 86_400_000)
    .toISOString().slice(0, 10)
  return bis <= grenze ? 'laeuft_ab' : 'gueltig'
}
