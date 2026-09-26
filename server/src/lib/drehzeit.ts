/**
 * Dauern aus Drehzeiten.
 *
 * Call, First Shot, Pause und Drehschluss stehen in der Datenbank als Minuten
 * seit Mitternacht. Das ist eine Uhrzeit, kein Zeitpunkt - wer daraus eine
 * Dauer rechnet, muss den Tageswechsel selbst bedenken.
 *
 * Gemessen am 26.09.2026 an einem Nachtdreh von 18:00 bis 02:00:
 * `120 - 1080 = -960` Minuten, auf 0 geklemmt. Acht Stunden Drehzeit
 * verschwanden - aus der Zeitanalyse, aus dem Tagesbericht und aus dem PDF.
 * Die Turnaround-Prüfung rechnete im selben Fall 32 Stunden Ruhezeit statt
 * acht und meldete die Verletzung deshalb nicht.
 *
 * Nachtdrehs sind im Film keine Ausnahme. Die Rechnung muss sie tragen.
 */

/** Minuten eines Tages. */
const TAG = 24 * 60

/**
 * Warum nicht Number(): Number(null) ist 0 und Number('') auch. Eine nie
 * gefüllte Zeitspalte wäre damit "00:00" und würde eine Dauer erfinden.
 */
function uhrzeit(wert: unknown): number | null {
  if (wert === null || wert === undefined || wert === '') return null
  const n = Number(wert)
  return Number.isFinite(n) ? n : null
}

/**
 * Minuten von `von` bis `bis`. Liegt `bis` vor `von`, ging es über
 * Mitternacht - dann zählt der nächste Tag mit.
 *
 * Gleiche Uhrzeit heißt null Minuten, nicht 24 Stunden: ein Drehschluss zur
 * Call-Zeit ist ein abgesagter Tag, kein Tagesdreh.
 */
export function dauer(von: unknown, bis: unknown): number | null {
  const a = uhrzeit(von)
  const b = uhrzeit(bis)
  if (a === null || b === null) return null
  const d = b - a
  return d < 0 ? d + TAG : d
}

/**
 * Drehzeit ohne Pause. Fehlt eine der beiden Zeiten, gibt es keine Dauer -
 * nicht null Minuten, denn "nicht erfasst" ist etwas anderes als "gar nicht
 * gedreht".
 *
 * Eine Pause, die länger dauert als der Dreh, ist ein Tippfehler. Statt einer
 * negativen Drehzeit bleibt dann die Bruttozeit stehen: sie ist gemessen, die
 * Pause nicht plausibel.
 */
export function nettoDrehzeit(
  von: unknown, bis: unknown, pauseVon?: unknown, pauseBis?: unknown,
): number | null {
  const brutto = dauer(von, bis)
  if (brutto === null) return null
  const pause = dauer(pauseVon, pauseBis)
  if (pause === null || pause > brutto) return brutto
  return brutto - pause
}

/**
 * Ruhezeit zwischen Drehschluss und dem Call am Folgetag.
 *
 * `callHeute` wird gebraucht, um zu erkennen, ob der Drehschluss noch am
 * Drehtag lag oder schon nach Mitternacht: ein Wrap um 02:00 steht als 120 in
 * der Datenbank und gehört trotzdem zum Vortag.
 */
export function ruhezeit(
  wrapHeute: unknown, callHeute: unknown, callMorgen: unknown,
): number | null {
  const wrap = uhrzeit(wrapHeute)
  const call = uhrzeit(callMorgen)
  if (wrap === null || call === null) return null

  // Ging der Dreh über Mitternacht, endete er bereits am Kalendertag des
  // nächsten Calls - dann ist die Ruhezeit nur die Lücke bis zu diesem Call.
  const heute = uhrzeit(callHeute)
  if (heute !== null && wrap < heute) return Math.max(0, call - wrap)

  return (TAG - wrap) + call
}
