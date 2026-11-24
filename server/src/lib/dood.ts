/**
 * Day out of Days: wer an welchem Tag arbeitet, hält, reist, probt.
 *
 * Kürzel und Regeln wie in der Branchensoftware (Movie Magic Scheduling, DOOD
 * Rules; R1 im Plan "CutSheet Kino-Ausbau", AP A1). Bis zum 13.11.2026 bekam
 * jeder Tag zwischen erstem und letztem Arbeitstag ein H, auch ein Sperrtag,
 * der letzte Arbeitstag hieß F statt WF, und Haltetage kosteten nichts.
 *
 * `berechneDood` ist rein und wird mit Tabellen getestet (dood.test.ts).
 * `ladeDood` holt die Daten und ruft es für jede Person der Besetzung.
 */
import { drehtageBesetzung, KEIN_DREHTAG } from './drehtage'
import { effektiveUnit } from './units'

/** Eine Spalte des Berichts: ein Kalendertag, oder ein Drehtag ohne Datum. */
export type DoodTag = {
  datum: string
  /** Die Drehtage an diesem Datum, ohne Sperr-, Ausfall- und Reservetage. */
  drehtagIds: number[]
  /** Kein Drehtag an diesem Tag: kein Halt, keine Zählung. */
  frei: boolean
}

export type DoodEinsatz = {
  /** Drehtage, an denen die Person arbeitet (lib/drehtage.ts). */
  arbeit: Set<number>
  /** Daten der Reise-, Probe- und Anprobetage. */
  reise: Set<string>
  probe: Set<string>
  anprobe: Set<string>
}

export type DoodRegeln = {
  /** Tage ohne Arbeit zwischen erstem und letztem Arbeitstag als Halt zählen. */
  haltetage: boolean
  /** Eine lange Lücke als Drop und Pickup statt als Halt. */
  drop: boolean
  /** Ab so vielen Kalendertagen ist eine Lücke lang genug für den Drop. */
  dropMinTage: number
}

export type DoodErgebnis = {
  codes: string[]
  summen: {
    /** Gedrehte Tage - dieselbe Zahl wie in Kalkulation, Vertrag und Lohnexport. */
    drehtage: number
    /** Drehtage plus Reise, Probe, Anprobe: was die Person insgesamt arbeitet. */
    arbeit: number
    halt: number
    reise: number
    probe: number
    anprobe: number
  }
  start: string | null
  ende: string | null
}

const ARBEIT = new Set(['SW', 'W', 'WF', 'SWF', 'SWD', 'WD', 'PW', 'PWF'])

export function berechneDood(tage: DoodTag[], einsatz: DoodEinsatz, regeln: DoodRegeln): DoodErgebnis {
  const codes = tage.map(() => '')
  const arbeitet = tage.map(t => t.drehtagIds.some(id => einsatz.arbeit.has(id)))
  const nebenbei = tage.map(t =>
    einsatz.reise.has(t.datum) ? 'TR' : einsatz.probe.has(t.datum) ? 'R' : einsatz.anprobe.has(t.datum) ? 'FT' : '')

  const arbeitstage = arbeitet.flatMap((a, i) => (a ? [i] : []))
  if (arbeitstage.length > 0) {
    const erster = arbeitstage[0]
    const letzter = arbeitstage[arbeitstage.length - 1]
    for (const i of arbeitstage) codes[i] = 'W'

    // Drop: die erste Lücke zwischen zwei Arbeitstagen, die lang genug ist
    // und in der weder gereist noch geprobt wird. Höchstens einer je Person.
    let drop: { vor: number; nach: number } | null = null
    if (regeln.haltetage && regeln.drop && regeln.dropMinTage > 0) {
      for (let k = 0; k + 1 < arbeitstage.length && !drop; k++) {
        const vor = arbeitstage[k], nach = arbeitstage[k + 1]
        const luecke = nach - vor - 1
        const belegt = nebenbei.slice(vor + 1, nach).some(n => n !== '')
        if (luecke >= regeln.dropMinTage && !belegt) drop = { vor, nach }
      }
    }

    if (regeln.haltetage) {
      for (let i = erster + 1; i < letzter; i++) {
        const imDrop = drop !== null && i > drop.vor && i < drop.nach
        if (!arbeitet[i] && !tage[i].frei && !nebenbei[i] && !imDrop) codes[i] = 'H'
      }
    }

    if (erster === letzter) codes[erster] = 'SWF'
    else {
      codes[erster] = 'SW'
      codes[letzter] = 'WF'
    }
    if (drop) {
      codes[drop.vor] = drop.vor === erster ? 'SWD' : 'WD'
      codes[drop.nach] = drop.nach === letzter ? 'PWF' : 'PW'
    }
  }

  // Reise, Probe, Anprobe zeigen sich immer, an einem Arbeitstag gilt die Arbeit
  for (let i = 0; i < tage.length; i++) if (!codes[i] && nebenbei[i]) codes[i] = nebenbei[i]

  const zaehle = (code: string) => codes.filter(c => c === code).length
  const drehtage = codes.filter(c => ARBEIT.has(c)).length
  const reise = zaehle('TR'), probe = zaehle('R'), anprobe = zaehle('FT')
  const belegt = codes.flatMap((c, i) => (c && tage[i].datum ? [tage[i].datum] : []))
  return {
    codes,
    summen: { drehtage, arbeit: drehtage + reise + probe + anprobe, halt: zaehle('H'), reise, probe, anprobe },
    start: belegt[0] ?? null,
    ende: belegt[belegt.length - 1] ?? null,
  }
}

// ─── Laden ───────────────────────────────────────────────────────────────────

type Lesen = { all: (sql: string, werte?: any[]) => Promise<any[]> }

/**
 * `bezeichnung`: die Drehtage der Spalte, "4" in der Haupteinheit, "2U 1" in
 * einer anderen - an einem Datum mit parallelen Units beide (AP C2).
 */
export type DoodSpalte = { datum: string; day_number: number | null; frei: boolean; status: string; bezeichnung: string }

export type DoodZeile = {
  id: number
  actor_name: string
  character_name: string
  fee_per_day: number | null
  hold_fee_per_day: number | null
  hold_allowed: boolean
  drop_allowed: boolean
  drop_min_days: number
  days: Array<{ date: string; day_number: number | null; code: string; frei: boolean; bezeichnung: string }>
  total_work_days: number
  total_worked_days: number
  total_hold_days: number
  total_travel_days: number
  total_rehearsal_days: number
  total_fitting_days: number
  start: string | null
  ende: string | null
  total_hold_cost_cents: number
  total_cost_cents: number
}

const tagNach = (datum: string) => {
  const d = new Date(`${datum}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const istDatum = (w: unknown): w is string => typeof w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w)

/** Alle Daten von `von` bis `bis` einschließlich. */
function zeitraum(von: string, bis: string): string[] {
  const out: string[] = []
  for (let d = von; d <= bis && out.length < 3700; d = tagNach(d)) out.push(d)
  return out
}

/**
 * Den Bericht für alle Darsteller eines Projekts laden.
 *
 * Spalten sind die Kalendertage vom ersten bis zum letzten Drehtag - erweitert
 * um Reise-, Probe- und Anprobetage davor oder danach. Drehtage ohne Datum
 * stehen am Ende, nach Nummer.
 */
export async function ladeDood(z: Lesen, projectId: number): Promise<{ spalten: DoodSpalte[]; cast: DoodZeile[] }> {
  const [besetzung, drehtage, arbeitJePerson, reisen, termine] = await Promise.all([
    z.all(
      `SELECT c.id, c.actor_name, c.fee_per_day, c.hold_allowed, c.hold_fee_per_day, c.drop_allowed, c.drop_min_days,
              ch.name AS character_name
         FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id
        WHERE c.project_id = ?
        ORDER BY ch.sort_order ASC, c.id ASC`, [projectId]),
    // Alle Units (AP C2): Arbeitet eine Figur an einem Datum in irgendeiner
    // Unit, ist das ein Arbeitstag - die Spalte ist das Datum, nicht der Tag
    z.all(
      `SELECT d.id, d.date, d.day_number, d.status, COALESCE(u.is_main, true) AS unit_is_main, u.short AS unit_short, u.name AS unit_name
         FROM shoot_days d LEFT JOIN units u ON u.id = ${effektiveUnit('d')}
        WHERE d.project_id = ?
        ORDER BY (d.date = '') ASC, d.date ASC, COALESCE(u.is_main, true) DESC, u.sort_order ASC, d.day_number ASC`, [projectId]),
    drehtageBesetzung(z, projectId),
    // Reisetage: An- und Abreise, bei einer eintägigen Reise der Tag selbst
    z.all(
      `SELECT t.person_id, td.day_date AS datum
         FROM trip_days td JOIN trips t ON t.id = td.trip_id
        WHERE t.project_id = ? AND t.person_type = 'cast' AND td.kind IN ('anreise', 'abreise', 'einzeln')`,
      [projectId]),
    z.all(
      `SELECT ep.person_id, e.type, e.start_date, e.end_date
         FROM event_people ep JOIN project_events e ON e.id = ep.event_id
        WHERE e.project_id = ? AND ep.person_type = 'cast' AND e.type IN ('Probe', 'Kostümprobe')`,
      [projectId]),
  ])

  const einsatz = new Map<number, DoodEinsatz>()
  const fuer = (id: number) => {
    if (!einsatz.has(id)) einsatz.set(id, { arbeit: arbeitJePerson.get(id) ?? new Set(), reise: new Set(), probe: new Set(), anprobe: new Set() })
    return einsatz.get(id)!
  }
  for (const c of besetzung) fuer(Number(c.id))
  for (const r of reisen) if (istDatum(r.datum) && einsatz.has(Number(r.person_id))) fuer(Number(r.person_id)).reise.add(r.datum)
  for (const t of termine) {
    if (!istDatum(t.start_date) || !einsatz.has(Number(t.person_id))) continue
    const bis = istDatum(t.end_date) && t.end_date >= t.start_date ? t.end_date : t.start_date
    const ziel = t.type === 'Probe' ? fuer(Number(t.person_id)).probe : fuer(Number(t.person_id)).anprobe
    for (const d of zeitraum(t.start_date, bis)) ziel.add(d)
  }

  // Kalendertage: vom frühesten bis zum spätesten belegten Datum
  const datiert = drehtage.filter(d => istDatum(d.date))
  const alleDaten = [...datiert.map(d => d.date as string)]
  for (const e of einsatz.values()) alleDaten.push(...e.reise, ...e.probe, ...e.anprobe)
  alleDaten.sort()
  const kalendertage = alleDaten.length ? zeitraum(alleDaten[0], alleDaten[alleDaten.length - 1]) : []

  const zaehlt = (status: string) => !(KEIN_DREHTAG as readonly string[]).includes(status)
  const kurz = (d: any) => (d.unit_is_main === false ? `${d.unit_short || d.unit_name || ''} ${d.day_number}`.trim() : String(d.day_number))
  const spalten: DoodSpalte[] = []
  const tage: DoodTag[] = []
  for (const datum of kalendertage) {
    const amTag = datiert.filter(d => d.date === datum)
    const aktiv = amTag.filter(d => zaehlt(d.status))
    spalten.push({ datum, day_number: (aktiv[0] ?? amTag[0])?.day_number ?? null, frei: aktiv.length === 0, status: (aktiv[0] ?? amTag[0])?.status ?? '',
      bezeichnung: (aktiv.length ? aktiv : amTag).map(kurz).join(' · ') })
    tage.push({ datum, drehtagIds: aktiv.map(d => Number(d.id)), frei: aktiv.length === 0 })
  }
  for (const d of drehtage.filter(x => !istDatum(x.date))) {
    spalten.push({ datum: '', day_number: d.day_number, frei: !zaehlt(d.status), status: d.status, bezeichnung: kurz(d) })
    tage.push({ datum: '', drehtagIds: zaehlt(d.status) ? [Number(d.id)] : [], frei: !zaehlt(d.status) })
  }

  const cast = besetzung.map((c): DoodZeile => {
    const regeln: DoodRegeln = {
      haltetage: Boolean(c.hold_allowed),
      drop: Boolean(c.hold_allowed) && Boolean(c.drop_allowed),
      dropMinTage: Number(c.drop_min_days) || 0,
    }
    const r = berechneDood(tage, einsatz.get(Number(c.id))!, regeln)
    const gage = c.fee_per_day == null ? null : Number(c.fee_per_day)
    const haltegage = c.hold_fee_per_day == null ? null : Number(c.hold_fee_per_day)
    // Gezahlt werden Drehtage und Haltetage. Reisetage nicht - die stehen in
    // der Reise mit ihren Pauschalen (Nicht-Ziel im Plan, AP A1).
    const haltekosten = r.summen.halt * (haltegage ?? 0)
    return {
      id: Number(c.id),
      actor_name: c.actor_name,
      character_name: c.character_name || '',
      fee_per_day: gage,
      hold_fee_per_day: haltegage,
      hold_allowed: regeln.haltetage,
      drop_allowed: Boolean(c.drop_allowed),
      drop_min_days: regeln.dropMinTage,
      days: spalten.map((s, i) => ({ date: s.datum, day_number: s.day_number, code: r.codes[i], frei: s.frei, bezeichnung: s.bezeichnung })),
      total_work_days: r.summen.drehtage,
      total_worked_days: r.summen.arbeit,
      total_hold_days: r.summen.halt,
      total_travel_days: r.summen.reise,
      total_rehearsal_days: r.summen.probe,
      total_fitting_days: r.summen.anprobe,
      start: r.start,
      ende: r.ende,
      total_hold_cost_cents: haltekosten,
      total_cost_cents: r.summen.drehtage * (gage ?? 0) + haltekosten,
    }
  })

  return { spalten, cast }
}
