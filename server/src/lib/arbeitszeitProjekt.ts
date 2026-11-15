/**
 * Arbeitszeit-Prüfung je Projekt (Plan Kino-Ausbau, AP B3): Einstellungen
 * laden und einen Stundenzettel oder eine Dispo-Zeile auswerten. Stundenzettel,
 * Lohnexport, Konfliktradar und Dispo rechnen hier, nicht jeder für sich.
 */
import { getHolidays } from '../services/holidays'
import { saetzeAus, pruefeTag, pruefeRuhezeit, pruefeWoche, sonnFeiertag, freierTag, wochenbeginn, zuschlaege, betrag, arbeitszeit, type Regel, type Saetze, type Befund } from './arbeitszeit'

type Lesen = { get: (sql: string, werte?: any[]) => Promise<any>; all: (sql: string, werte?: any[]) => Promise<any[]> }

export interface ArbeitszeitEinstellung {
  regel: Regel
  stundenJeTagesgage: number
  saetze: Saetze
  nachtVon: number
  nachtBis: number
  /** Bundesland; '' heißt nicht gesetzt - dann nur bundesweite Feiertage */
  land: string
  /** Mindestruhezeit in Minuten (Stammdaten "Ruhezeit") */
  ruhezeit: number
  defaultCall: number
  defaultWrap: number
}

export async function arbeitszeitEinstellung(z: Lesen, projectId: number | string): Promise<ArbeitszeitEinstellung> {
  const s = (await z.get('SELECT * FROM project_settings WHERE project_id = ?', [projectId])) ?? {}
  return {
    regel: s.worktime_rule === 'tarif' ? 'tarif' : 'gesetz',
    stundenJeTagesgage: Number(s.hours_per_day_rate) > 0 ? Number(s.hours_per_day_rate) : 10,
    saetze: saetzeAus(s.surcharges),
    nachtVon: Number.isInteger(Number(s.night_from)) && s.night_from !== null && s.night_from !== undefined ? Number(s.night_from) : 1380,
    nachtBis: Number.isInteger(Number(s.night_to)) && s.night_to !== null && s.night_to !== undefined ? Number(s.night_to) : 360,
    land: String(s.state ?? ''),
    ruhezeit: (Number(s.turnaround_hours) || 11) * 60,
    defaultCall: s.default_call_time ?? 480,
    defaultWrap: s.default_wrap_time ?? 1200,
  }
}

/** Feiertage im Bundesland des Projekts für die Jahre der Daten. */
export function feiertageFuer(land: string, daten: string[]): string[] {
  const jahre = new Set(daten.filter((d) => /^\d{4}-/.test(d)).map((d) => Number(d.slice(0, 4))))
  return [...jahre].flatMap((j) => getHolidays(j, land).map((f) => f.date))
}

/** Was ein Stundenzettel ergibt: Befunde, Minuten je Zuschlagsart, Betrag in Cent. */
export function zettelAuswerten(
  zettel: { call_time: unknown; wrap_time: unknown; break_minutes?: number | null; datum: string },
  vortag: { call_time: unknown; wrap_time: unknown } | null,
  e: ArbeitszeitEinstellung,
  feiertage: string[],
  tagesgageCent: number,
): { befunde: Befund[]; zuschlag_minuten: Saetze; surcharge_cents: number; arbeitszeit_minuten: number | null } {
  const pause = Math.max(0, Number(zettel.break_minutes) || 0)
  const befunde: Befund[] = [
    ...pruefeTag({ call: zettel.call_time, wrap: zettel.wrap_time, pause }, e.regel),
    ...(vortag ? pruefeRuhezeit(vortag.wrap_time, vortag.call_time, zettel.call_time, e.regel, e.ruhezeit) : []),
    ...sonnFeiertag(zettel.datum, feiertage, e.regel),
  ]
  const minuten = zuschlaege(
    { call: zettel.call_time, wrap: zettel.wrap_time, pause, datum: zettel.datum, feiertage },
    { stundenJeTagesgage: e.stundenJeTagesgage, nachtVon: e.nachtVon, nachtBis: e.nachtBis },
  )
  return {
    befunde,
    zuschlag_minuten: minuten,
    surcharge_cents: betrag(minuten, tagesgageCent, e.stundenJeTagesgage, e.saetze),
    arbeitszeit_minuten: arbeitszeit(zettel.call_time, zettel.wrap_time, pause),
  }
}

/** Ist der Vortag (Datum) genau einen Kalendertag vor `datum`? */
export function istVortag(vorher: string, datum: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vorher) || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return false
  return Math.round((Date.parse(`${datum}T12:00:00Z`) - Date.parse(`${vorher}T12:00:00Z`)) / 86400000) === 1
}

/**
 * Alle Stundenzettel eines Projekts ausgewertet, je Zeile mit dem Zettel
 * des Vortags derselben Person für die Ruhezeit.
 */
export async function zettelDesProjekts(z: Lesen, projectId: number | string, bedingung = '', werte: any[] = []) {
  const e = await arbeitszeitEinstellung(z, projectId)
  const zeilen = await z.all(
    `SELECT t.*, sd.date AS datum,
            CASE WHEN t.person_type = 'cast' THEN c.fee_per_day ELSE cr.fee_per_day END AS tagesgage
       FROM timesheets t
       JOIN shoot_days sd ON sd.id = t.shoot_day_id
       LEFT JOIN "cast" c ON t.person_type = 'cast' AND c.id = t.person_id
       LEFT JOIN crew cr ON t.person_type = 'crew' AND cr.id = t.person_id
      WHERE t.project_id = ? ${bedingung}
      ORDER BY t.person_type, t.person_id, sd.date, t.id`,
    [projectId, ...werte])
  const feiertage = feiertageFuer(e.land, zeilen.map((r) => String(r.datum ?? '')))
  const ergebnis = new Map<number, ReturnType<typeof zettelAuswerten>>()
  // Je Person: Drehtage zählen (freier Tag) und Arbeitszeit je Kalenderwoche
  // sammeln - der Wochenbefund steht am letzten Zettel der Woche
  const drehtage = new Map<string, Set<string>>()
  const wochen = new Map<string, { minuten: number[]; letzter: number }>()
  for (const [i, r] of zeilen.entries()) {
    const vor = i > 0 ? zeilen[i - 1] : null
    const vortag = vor && vor.person_type === r.person_type && Number(vor.person_id) === Number(r.person_id) && istVortag(String(vor.datum), String(r.datum))
      ? vor : null
    const datum = String(r.datum ?? '')
    const a = zettelAuswerten({ ...r, datum }, vortag, e, feiertage, Number(r.tagesgage) || 0)
    ergebnis.set(Number(r.id), a)

    const person = `${r.person_type}:${r.person_id}`
    const tage = drehtage.get(person) ?? new Set<string>()
    if (datum && !tage.has(datum)) {
      tage.add(datum)
      a.befunde.push(...freierTag(tage.size, e.regel))
    }
    drehtage.set(person, tage)
    const woche = wochenbeginn(datum)
    if (woche) {
      const w = wochen.get(`${person}|${woche}`) ?? { minuten: [], letzter: 0 }
      w.minuten.push(a.arbeitszeit_minuten ?? 0)
      w.letzter = Number(r.id)
      wochen.set(`${person}|${woche}`, w)
    }
  }
  for (const w of wochen.values()) ergebnis.get(w.letzter)?.befunde.push(...pruefeWoche(w.minuten, e.regel))
  return { einstellung: e, zeilen, ergebnis }
}
