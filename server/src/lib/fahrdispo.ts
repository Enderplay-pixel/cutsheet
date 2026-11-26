/**
 * Dispo: Fahrten, alle Zeiten verschieben, Zeitplan der Szenen (Plan
 * Kino-Ausbau, AP E7). Reine Funktionen ohne Datenbank, geprüft in
 * fahrdispo.test.ts. Zeiten sind Minuten seit Mitternacht, wie überall in
 * der Dispo.
 */

/** Uhrzeit "06:30" für Meldungen. */
export function uhr(minuten: number): string {
  const m = Math.round(minuten)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`
}

/**
 * Fahrten aus den Abholungen: je Person mit Abholzeit eine Fahrt, gleiche
 * Zeit und gleicher Ort (ohne Groß- und Kleinschreibung, ohne Leerzeichen
 * am Rand) werden eine Fahrt. Nach Abfahrt sortiert.
 */
export function fahrtenAusAbholungen(
  eintraege: Array<{ id: number; pickup_time?: number | null; pickup_location?: string | null }>,
): Array<{ depart_time: number; from_place: string; eintraege: number[] }> {
  const fahrten = new Map<string, { depart_time: number; from_place: string; eintraege: number[] }>()
  for (const e of eintraege) {
    if (e.pickup_time === null || e.pickup_time === undefined) continue
    const ort = String(e.pickup_location ?? '').trim()
    const key = `${e.pickup_time}|${ort.toLowerCase()}`
    const f = fahrten.get(key) ?? { depart_time: Number(e.pickup_time), from_place: ort, eintraege: [] }
    f.eintraege.push(Number(e.id))
    fahrten.set(key, f)
  }
  return [...fahrten.values()].sort((a, b) => a.depart_time - b.depart_time || a.from_place.localeCompare(b.from_place, 'de'))
}

/** Die Zeitfelder einer Person auf der Dispo. */
export const EINTRAG_ZEITEN = ['call_time', 'pickup_time', 'makeup_time', 'wardrobe_time', 'blk_reh', 'on_set', 'lose_at'] as const
/** Die Zeitfelder des Dispo-Kopfs; Frühstück und Mittag 0 heißt: keine Angabe. */
export const KOPF_ZEITEN = ['general_call', 'shooting_call', 'breakfast_call', 'lunch_call', 'planned_wrap'] as const

const KOPF_NAMEN: Record<string, string> = {
  general_call: 'General Call', shooting_call: 'Shooting Call', breakfast_call: 'Frühstück', lunch_call: 'Mittag', planned_wrap: 'Drehschluss',
}

export type Dispo = {
  [k in (typeof KOPF_ZEITEN)[number]]?: number | null
} & {
  entries: Array<{ id: number } & { [k in (typeof EINTRAG_ZEITEN)[number]]?: number | null }>
  rides: Array<{ id: number; depart_time?: number | null }>
}

export type Aenderung = { wo: string; id: number | null; feld: string; alt: number; neu: number }

/**
 * Alle Zeiten der Dispo um `minuten` früher oder später (Soll 4). Leere
 * Zeiten bleiben leer, Frühstück und Mittag mit 0 auch. Rutscht eine Zeit
 * unter 00:00 oder über 24:00, wird nichts verschoben - mit Grund.
 */
export function verschiebeZeiten(dispo: Dispo, minuten: number): { aenderungen: Aenderung[]; fehler: string | null } {
  const aenderungen: Aenderung[] = []
  const nimm = (wo: string, id: number | null, feld: string, wert: number | null | undefined, nullIstLeer = false) => {
    if (wert === null || wert === undefined || (nullIstLeer && Number(wert) === 0)) return
    aenderungen.push({ wo, id, feld, alt: Number(wert), neu: Number(wert) + minuten })
  }
  for (const f of KOPF_ZEITEN) nimm('kopf', null, f, dispo[f], f === 'breakfast_call' || f === 'lunch_call')
  for (const e of dispo.entries) for (const f of EINTRAG_ZEITEN) nimm('eintrag', e.id, f, e[f])
  for (const r of dispo.rides) nimm('fahrt', r.id, 'depart_time', r.depart_time)
  const draussen = aenderungen.find((a) => a.neu < 0 || a.neu > 1440)
  if (draussen) {
    const name = KOPF_NAMEN[draussen.feld] ?? (draussen.wo === 'fahrt' ? 'Eine Abfahrt' : 'Eine Zeit der Personen')
    return {
      aenderungen: [],
      fehler: `${name} ${uhr(draussen.alt)} läge ${draussen.neu < 0 ? 'vor 00:00' : 'nach 24:00'} - nichts verschoben`,
    }
  }
  return { aenderungen: minuten === 0 ? [] : aenderungen, fehler: null }
}

/**
 * Hinweise an den Fahrten (Soll 3): dasselbe Fahrzeug in zwei Fahrten zur
 * selben Abfahrt, mehr Mitfahrende als Plätze.
 */
export function fahrtHinweise(
  fahrten: Array<{ id: number; vehicle_id?: number | null; depart_time?: number | null; mitfahrende: number }>,
  plaetze: Map<number, number>,
): Map<number, string[]> {
  const hinweise = new Map<number, string[]>()
  const dazu = (id: number, text: string) => hinweise.set(id, [...(hinweise.get(id) ?? []), text])
  for (const f of fahrten) {
    if (f.vehicle_id == null) continue
    const doppelt = fahrten.some((g) => g.id !== f.id && g.vehicle_id === f.vehicle_id && g.depart_time != null && g.depart_time === f.depart_time)
    if (doppelt) dazu(f.id, `Das Fahrzeug fährt um ${uhr(Number(f.depart_time))} schon eine andere Fahrt`)
    const p = plaetze.get(Number(f.vehicle_id))
    if (p !== undefined && f.mitfahrende > p) dazu(f.id, `${f.mitfahrende} Mitfahrende, das Fahrzeug hat ${p} Plätze`)
  }
  return hinweise
}

/**
 * Zeitplan der Szenen (Soll 5): ab Shooting Call nacheinander, Banner
 * (AP A2) mit ihrer Dauer eingerechnet. Eine von Hand gesetzte Zeit gilt
 * und die folgenden rechnen von ihr weiter. Mittag: CutSheet kennt nur
 * seinen Beginn, keine Dauer - wer ihn einrechnen will, setzt ein Banner
 * "Mittag"; hier wird nur markiert, vor welcher Szene der Mittag beginnt.
 */
export function szenenZeitplan(
  shootingCall: number,
  eintraege: Array<{ art: 'szene' | 'banner'; id: number; minuten: number; von_hand?: number | null }>,
  mittag?: number | null,
): Array<{ art: 'szene' | 'banner'; id: number; beginn: number; von_hand: boolean; mittag_davor: boolean }> {
  let zeit = shootingCall
  let mittagGesetzt = !mittag
  return eintraege.map((e) => {
    const beginn = e.von_hand ?? zeit
    let mittagDavor = false
    if (!mittagGesetzt && e.art === 'szene' && beginn >= Number(mittag)) { mittagDavor = true; mittagGesetzt = true }
    zeit = beginn + (Number(e.minuten) || 0)
    return { art: e.art, id: e.id, beginn, von_hand: e.von_hand != null, mittag_davor: mittagDavor }
  })
}
