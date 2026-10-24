/**
 * Webadressen aus fremder Hand.
 *
 * Zwei Stellen nehmen Links von Leuten entgegen und zeigen sie anderen als
 * klickbaren Link: der Sichtungslink einer Fassung (Mitglied → Auftraggeber)
 * und das Showreel in einer Agenturantwort (Agentur ohne Konto → angemeldete
 * Produktion). Gemessen am 24.10.2026: Beide nahmen "javascript:..." an, und
 * der Agenturlink stand danach als href auf der angemeldeten Seite.
 *
 * Erlaubt ist nur http und https.
 */

/** Genau eine Webadresse mit http oder https. */
export function istWebadresse(wert: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(String(wert ?? '').trim())
}

/**
 * Für öffentliche Formulare: bereinigen statt ablehnen.
 *
 * Wer "vimeo.com/123" tippt, meint eine Webadresse - davor kommt https://.
 * Jedes andere Schema (javascript:, data:, file: ...) fällt ganz weg. Eine
 * Agentur soll ihre Antwort nicht wegen eines Links verlieren.
 */
export function bereinigeWebadresse(wert: unknown): string {
  const roh = String(wert ?? '').trim()
  if (!roh) return ''
  if (istWebadresse(roh)) return roh
  if (/^[a-z][a-z0-9+.-]*:/i.test(roh)) return ''
  const ergaenzt = `https://${roh}`
  return istWebadresse(ergaenzt) ? ergaenzt : ''
}
