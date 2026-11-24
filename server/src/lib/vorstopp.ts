/**
 * Erzähltag und Vorstopp einer Szene (Plan Kino-Ausbau, AP E5).
 *
 * Der Vorstopp ist die Länge der Szene im Film. Solange niemand gestoppt
 * hat, gilt ein Schätzwert aus der Seitenlänge: ein Achtel 7,5 Sekunden, die
 * Faustregel "eine Seite, eine Minute". Ein eingetragener Wert ersetzt ihn.
 * Alle Stellen lesen von hier - Drehplan, Dispo, Tagesbericht.
 */

export const SEKUNDEN_JE_ACHTEL = 7.5
/** Obergrenze eines Vorstopps: zehn Stunden. */
export const VORSTOPP_MAX = 36_000

type Szene = { pretimed_seconds?: number | string | null; eighths?: number | string | null }

/** Vorstopp der Szene in Sekunden, eingetragen oder geschätzt. */
export function vorstopp(szene: Szene): { sekunden: number; geschaetzt: boolean } {
  const eingetragen = szene.pretimed_seconds
  if (eingetragen !== null && eingetragen !== undefined && eingetragen !== '' && Number.isFinite(Number(eingetragen))) {
    return { sekunden: Math.round(Number(eingetragen)), geschaetzt: false }
  }
  return { sekunden: Math.round((Number(szene.eighths) || 0) * SEKUNDEN_JE_ACHTEL), geschaetzt: true }
}

/** Summe mehrerer Szenen; `geschaetzt_sekunden` ist der Anteil aus Schätzwerten. */
export function vorstoppSumme(szenen: Szene[]): { sekunden: number; geschaetzt_sekunden: number } {
  let sekunden = 0
  let geschaetzt = 0
  for (const s of szenen) {
    const v = vorstopp(s)
    sekunden += v.sekunden
    if (v.geschaetzt) geschaetzt += v.sekunden
  }
  return { sekunden, geschaetzt_sekunden: geschaetzt }
}

/** "3:50", ab einer Stunde "1:02:05". */
export function zeitText(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`
}

/**
 * Ein Vorstopp aus der Anfrage: null, leer oder eine ganze Zahl Sekunden von
 * 0 bis zehn Stunden. `undefined` heißt ungültig.
 */
export function sekundenAus(wert: unknown): number | null | undefined {
  if (wert === null || wert === '') return null
  const n = Number(wert)
  return Number.isInteger(n) && n >= 0 && n <= VORSTOPP_MAX ? n : undefined
}

/** Der Erzähltag nach Standard hinter dem Kürzel der Tageszeit: "T3", "N3". Ohne Erzähltag nur das Kürzel. */
export function mitErzaehltag(kuerzel: string, erzaehltag: unknown): string {
  const tag = String(erzaehltag ?? '').trim()
  if (!tag) return kuerzel
  return kuerzel.includes('/') ? `${kuerzel} ${tag}` : `${kuerzel}${tag}`
}
