/**
 * Rechnungen des Stäbchenplan-Boards (Plan Kino-Ausbau, AP A2).
 *
 * Reine Funktionen ohne Datenbank: Strips auf Tage verteilen, Arbeitstage
 * finden, Folgetage verschieben. Die Routen in `routes/drehplan.ts` schreiben
 * nur, was hier herauskommt - so lässt sich die Verteilung prüfen, ohne
 * einen Plan anzulegen.
 *
 * Datumsrechnung in UTC auf "JJJJ-MM-TT": Ein Drehtag ist ein Kalendertag,
 * keine Uhrzeit. So verschiebt weder die Zeitzone des Servers noch die
 * Umstellung auf Winterzeit ein Datum.
 */

export type Mass = 'achtel' | 'minuten'

export interface BoardStrip {
  achtel: number
  minuten: number
}

/** Ein Datum plus n Tage, als "JJJJ-MM-TT". */
export function plusTage(datum: string, tage: number): string {
  const [j, m, t] = datum.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10)
}

/** Wochentag nach ISO: Montag 1 bis Sonntag 7. */
function isoWochentag(datum: string): number {
  const [j, m, t] = datum.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, t)).getUTCDay() || 7
}

/**
 * Die Strips in ihrer Reihenfolge auf Tage verteilen: Ein Tag nimmt Strips,
 * bis der nächste die Grenze überschreiten würde. Ein Strip, der allein
 * schon größer ist als die Grenze, bekommt einen eigenen Tag - sonst bliebe
 * er liegen oder die Verteilung liefe endlos.
 */
export function teileEin<T extends BoardStrip>(strips: T[], hoechstens: number, nach: Mass): T[][] {
  const tage: T[][] = []
  let tag: T[] = []
  let summe = 0
  for (const strip of strips) {
    const wert = Math.max(0, Number(nach === 'achtel' ? strip.achtel : strip.minuten) || 0)
    if (tag.length > 0 && summe + wert > hoechstens) {
      tage.push(tag)
      tag = []
      summe = 0
    }
    tag.push(strip)
    summe += wert
  }
  if (tag.length > 0) tage.push(tag)
  return tage
}

/** Die Arbeitstage aus der Einstellung `work_weekdays` ("1,2,3,4,5"), sortiert, ohne Unsinn. */
export function wochentageAus(text: string | null | undefined): number[] {
  const tage = String(text ?? '').split(',').map((t) => Number(t.trim()))
  return [...new Set(tage.filter((t) => Number.isInteger(t) && t >= 1 && t <= 7))].sort((a, b) => a - b)
}

/**
 * Die ersten `anzahl` Arbeitstage ab `start` (eingeschlossen): nur an den
 * genannten Wochentagen, nie an einem Feiertag. Ohne Wochentage gibt es
 * keinen Arbeitstag - die Schleife hätte sonst nie ein Ende gefunden.
 */
export function arbeitstageAb(start: string, anzahl: number, wochentage: number[], feiertage: Iterable<string>): string[] {
  if (wochentage.length === 0 || anzahl <= 0) return []
  const frei = new Set(feiertage)
  const erlaubt = new Set(wochentage)
  const tage: string[] = []
  // Jede Woche hat mindestens einen Arbeitstag; mehr als ein Feiertag je
  // Arbeitstag kommt nicht vor. Die Grenze schützt nur vor Unsinn.
  for (let d = start, schritte = 0; tage.length < anzahl && schritte < anzahl * 14 + 60; d = plusTage(d, 1), schritte++) {
    if (erlaubt.has(isoWochentag(d)) && !frei.has(d)) tage.push(d)
  }
  return tage
}

/** Der nächste Arbeitstag nach einem Datum (das Datum selbst zählt nicht). */
export function naechsterArbeitstag(nach: string, wochentage: number[], feiertage: Iterable<string>): string | null {
  return arbeitstageAb(plusTage(nach, 1), 1, wochentage, feiertage)[0] ?? null
}

/**
 * Wohin die Tage des automatischen Einteilens kommen (Soll 7 von AP A2):
 * ab dem Start in vorhandene leere Tage und an freie Arbeitstage, nach Datum
 * geordnet, damit der Plan der Reihenfolge der Ablage folgt. An einem Datum,
 * an dem schon ein Tag steht, der nicht frei ist (mit Szenen, Sperrtag,
 * Reserve, abgedreht), entsteht kein neuer Tag. Ein vorhandener leerer Tag
 * zählt auch am Wochenende - wer ihn angelegt hat, dreht an dem Tag.
 */
export function plaetzeAb(
  anzahl: number,
  start: string,
  vorhanden: Array<{ id: number; datum: string; frei: boolean }>,
  wochentage: number[],
  feiertage: Iterable<string>,
): Array<{ tag_id: number | null; datum: string }> {
  const frei = new Set(feiertage)
  const erlaubt = new Set(wochentage)
  const plaetze: Array<{ tag_id: number | null; datum: string }> = []
  const letzterVorhandener = vorhanden.reduce((m, v) => (v.datum > m ? v.datum : m), start)
  for (let d = start, schritte = 0; plaetze.length < anzahl && (schritte < anzahl * 14 + 60 || d <= letzterVorhandener); d = plusTage(d, 1), schritte++) {
    const an = vorhanden.filter((v) => v.datum === d).sort((a, b) => a.id - b.id)
    if (an.length > 0) {
      for (const v of an) if (v.frei) plaetze.push({ tag_id: v.id, datum: d })
    } else if (erlaubt.has(isoWochentag(d)) && !frei.has(d)) {
      plaetze.push({ tag_id: null, datum: d })
    }
  }
  return plaetze.slice(0, anzahl)
}

/**
 * Jeder Folgetag rückt auf seinen nächsten Arbeitstag (Soll 5 von AP A2).
 * `neuerTag` ist das Datum des eingefügten Tags: Kein Folgetag landet
 * davor oder darauf, und zwei Folgetage nie auf demselben Datum - zwei
 * Wochenendtage hätten sonst beide den Montag bekommen.
 */
export function folgetageVerschieben(daten: string[], neuerTag: string, wochentage: number[], feiertage: Iterable<string>): string[] {
  const frei = [...feiertage]
  const neu: string[] = []
  let zuletzt = neuerTag
  for (const datum of daten) {
    const eigen = naechsterArbeitstag(datum, wochentage, frei) ?? plusTage(datum, 1)
    const nachDemVorigen = naechsterArbeitstag(zuletzt, wochentage, frei) ?? plusTage(zuletzt, 1)
    zuletzt = eigen > nachDemVorigen ? eigen : nachDemVorigen
    neu.push(zuletzt)
  }
  return neu
}

// ─── Geteilte Szenen und Tagesarten (AP E6) ──────────────────────────────────

/**
 * SQL: Seiten, Drehzeit und Vorstopp des Teils einer Szene an einem Tag.
 * `sds` ist die Zeile in shoot_day_scenes, `s` die Szene. Ein leerer
 * Anteil (`sds.eighths IS NULL`) heißt: die ganze Szene. Drehzeit und
 * gestoppter Vorstopp gehen im Verhältnis der Seiten mit. Steht nach
 * `sds.*`, damit die Spalten des Teils gelten.
 */
export const TEIL_SPALTEN = `COALESCE(sds.eighths, s.eighths) AS eighths, s.eighths AS szene_achtel, sds.eighths AS teil_achtel,
  CASE WHEN sds.eighths IS NULL OR COALESCE(s.eighths, 0) = 0 THEN s.estimated_minutes
       ELSE ROUND(s.estimated_minutes * sds.eighths::numeric / s.eighths)::int END AS estimated_minutes,
  CASE WHEN sds.eighths IS NULL OR s.pretimed_seconds IS NULL OR COALESCE(s.eighths, 0) = 0 THEN s.pretimed_seconds
       ELSE ROUND(s.pretimed_seconds * sds.eighths::numeric / s.eighths)::int END AS pretimed_seconds`

/** Seiten eines Teils in Achteln: sein Anteil, sonst die ganze Szene. */
export function seitenAmTag(teilAchtel: number | null | undefined, szeneAchtel: number): number {
  return teilAchtel === null || teilAchtel === undefined ? szeneAchtel : teilAchtel
}

/** Ergeben die Teile einer Szene die ganze Szene? Mit der Summe in Achteln. */
export function teileGanz(teile: Array<number | null | undefined>, szeneAchtel: number): { summe: number; ganz: boolean } {
  const summe = teile.reduce((n: number, t) => n + seitenAmTag(t, szeneAchtel), 0)
  return { summe, ganz: summe === szeneAchtel }
}

export type Tagesart = { wochenende: boolean; feiertag: boolean; nacht: boolean }

/**
 * Was ein Drehtag ist, abgeleitet und nur angezeigt (Soll 3): Wochenende
 * (Samstag oder Sonntag), Feiertag (aus der Liste des Bundeslands) und
 * Nachtdreh - mehr als die Hälfte der Drehzeit in Nachtszenen, Tag für
 * Nacht (AP C5) ausgenommen.
 */
export function tagesart(
  datum: string,
  feiertage: Iterable<string>,
  szenen: Array<{ day_night?: string | null; day_for_night?: boolean | null; estimated_minutes?: number | null }>,
): Tagesart {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(datum)
  const wochentag = iso ? new Date(`${datum}T12:00:00Z`).getUTCDay() : -1
  const gesamt = szenen.reduce((n, s) => n + (Number(s.estimated_minutes) || 0), 0)
  const nachts = szenen
    .filter((s) => /nacht|night/i.test(String(s.day_night ?? '')) && !s.day_for_night)
    .reduce((n, s) => n + (Number(s.estimated_minutes) || 0), 0)
  return {
    wochenende: wochentag === 0 || wochentag === 6,
    feiertag: iso && new Set(feiertage).has(datum),
    nacht: gesamt > 0 && nachts * 2 > gesamt,
  }
}
