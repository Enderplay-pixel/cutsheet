/**
 * Die Szenenüberschrift - gebaut und gelesen.
 *
 * Eine Szene trägt ihre Eckdaten doppelt: einmal als Datensatz (`int_ext`,
 * `title`, `day_night`), einmal als Textzeile im Drehbuch ("INT. WOHNKÜCHE -
 * NACHT"). Der Datensatz speist Drehplan, Stäbchenplan und jede Statistik,
 * die Zeile speist das gesetzte Drehbuch.
 *
 * Gemessen am 24.10.2026 liefen beide auseinander: Eine im Editor angelegte
 * Szene hiess im Datensatz "New Scene / INT / DAY" und in der Zeile "EXT.
 * HAFEN - NACHT". Zwei Wahrheiten über dieselbe Szene, und die Auswertungen
 * nahmen die falsche. Schlimmer noch: Szenen ohne Überschriftenblock fielen
 * aus jedem Export heraus - kein INT, kein EXT, kein Titel.
 *
 * Deshalb eine Stelle für beide Richtungen:
 *  - `baueUeberschrift` macht aus dem Datensatz eine Zeile. Fehlt der Block,
 *    wird die Zeile daraus ergänzt, statt die Szene stumm wegzulassen.
 *  - `leseUeberschrift` macht aus der getippten Zeile wieder Felder, damit der
 *    Datensatz der Schrift folgt und nicht auf dem Gründungsstand stehenbleibt.
 */

export type SzenenKopf = {
  int_ext: string
  title: string
  day_night: string
}

/** Die Werte, die die Oberfläche zur Auswahl stellt - andere erzeugen wir nicht. */
const INT_EXT_WERTE = ['INT', 'EXT', 'INT/EXT'] as const

/**
 * Was am Zeilenanfang stehen darf, und worauf es abgebildet wird.
 * Deutsch und englisch, weil FDX-Dateien englisch hereinkommen.
 * Die längeren Formen stehen zuerst: "INT/EXT" muss vor "INT" greifen.
 */
const ORT_FORMEN: Array<[RegExp, string]> = [
  [/^(?:INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\s*\/\s*E)\.?/i, 'INT/EXT'],
  [/^(?:INT|INNEN)\.?/i, 'INT'],
  [/^(?:EXT|AUSSEN|AUßEN|AUẞEN)\.?/i, 'EXT'],
]

/** Tageszeiten aus Importen auf die Werte der Oberfläche bringen. */
const TAGESZEITEN: Record<string, string> = {
  DAY: 'TAG',
  NIGHT: 'NACHT',
  DUSK: 'DÄMMERUNG',
  DAWN: 'DÄMMERUNG',
  TWILIGHT: 'DÄMMERUNG',
  EVENING: 'DÄMMERUNG',
  MORNING: 'MORGEN',
}

/** Eine Szene, so wie sie aus der Datenbank kommt - nur die vier Felder zählen. */
type SzenenZeile = {
  scene_number?: string | number | null
  title?: string | null
  int_ext?: string | null
  day_night?: string | null
}

/**
 * Die Überschriftenzeile aus den Feldern der Szene.
 *
 * Ohne Titel wird die Szenennummer eingesetzt - eine Zeile "INT. - TAG" wäre
 * im gesetzten Drehbuch schlimmer als "INT. SZENE 7 - TAG".
 */
export function baueUeberschrift(szene: SzenenZeile): string {
  const ortRoh = String(szene.int_ext ?? '').trim().toUpperCase() || 'INT'
  const ort = ortRoh.endsWith('.') ? ortRoh : `${ortRoh}.`
  const titel = String(szene.title ?? '').trim()
    || `SZENE ${String(szene.scene_number ?? '').trim()}`.trim()
  const zeit = String(szene.day_night ?? '').trim().toUpperCase()
  return [ort, titel.toUpperCase(), zeit ? `- ${zeit}` : ''].filter(Boolean).join(' ')
}

/**
 * Die getippte Zeile zurück in Felder.
 *
 * Gibt `null` zurück, wenn die Zeile nicht mit INT/EXT (oder einer deutschen
 * oder englischen Entsprechung) anfängt. Dann ist es keine Überschrift im
 * Sinne des Formats, und der Datensatz bleibt unangetastet - lieber nichts
 * übernehmen als etwas Falsches.
 */
export function leseUeberschrift(text: string): SzenenKopf | null {
  // Fountain erzwingt Überschriften mit einem führenden Punkt.
  let rest = String(text ?? '').trim().replace(/^\.(?=\S)/, '')
  if (!rest) return null

  let ort = ''
  for (const [muster, wert] of ORT_FORMEN) {
    const treffer = muster.exec(rest)
    if (treffer) {
      ort = wert
      rest = rest.slice(treffer[0].length)
      break
    }
  }
  if (!ort) return null

  rest = rest.replace(/^[\s.:-]+/, '').trim()

  // Die Tageszeit steht hinter dem letzten Trenner. Der Gedankenstrich kommt
  // aus fremden Dateien; geschrieben wird hier nur der Bindestrich.
  let titel = rest
  let zeit = ''
  const trenner = /\s[-–—]\s/g
  let letzter = -1
  let m: RegExpExecArray | null
  while ((m = trenner.exec(rest)) !== null) letzter = m.index
  if (letzter >= 0) {
    titel = rest.slice(0, letzter).trim()
    zeit = rest.slice(letzter).replace(/^\s[-–—]\s/, '').trim()
  }

  const zeitOben = zeit.toUpperCase()
  return {
    int_ext: INT_EXT_WERTE.includes(ort as any) ? ort : 'INT',
    title: titel,
    day_night: TAGESZEITEN[zeitOben] ?? zeitOben,
  }
}

/**
 * Blöcke einer Szene so ausliefern, dass die Überschrift nie fehlt.
 *
 * Der Editor zeigt Szenen ohne Überschriftenblock trotzdem mit Kopfzeile an -
 * er baut sie aus dem Datensatz. Die Exporte taten das nicht und liessen die
 * Szene kopflos im Drehbuch stehen. Diese Funktion gleicht das an: Fehlt ein
 * Überschriftenblock mit Inhalt, wird einer vorangestellt.
 */
export function mitUeberschrift<T extends { block_type: string; content?: string | null }>(
  szene: SzenenZeile,
  bloecke: T[],
): Array<T | { block_type: 'scene_heading'; content: string }> {
  const hatKopf = bloecke.some(
    b => b.block_type === 'scene_heading' && String(b.content ?? '').trim() !== ''
  )
  if (hatKopf) return bloecke
  // Ein leerer Überschriftenblock wird ersetzt, nicht ergänzt - sonst stünde
  // eine Leerzeile vor der Überschrift.
  const ohneLeere = bloecke.filter(b => b.block_type !== 'scene_heading')
  return [{ block_type: 'scene_heading' as const, content: baueUeberschrift(szene) }, ...ohneLeere]
}
