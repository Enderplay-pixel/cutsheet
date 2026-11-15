/**
 * Arbeitszeit-Prüfung und Überstunden in Euro (Plan Kino-Ausbau, AP B3).
 *
 * Reine Rechnungen. Jede Meldung trägt ihre Fundstelle. Filmarbeit
 * überschreitet zehn Stunden regelmäßig - die Prüfung meldet "nach
 * eingestellter Regel", sie sperrt nichts und urteilt nicht.
 *
 * Gesetz: Arbeitszeitgesetz (§ 3 zehn Stunden, § 4 Pausen, § 5 elf Stunden
 * Ruhezeit, § 11 Ersatzruhetag). Tarifvertrag: TV FFS laut ver.di vom
 * 12.10.2024 (zwölf Stunden am Tag, Woche über 50 Stunden zuschlagspflichtig).
 * Die Zuschlagssätze des Tarifvertrags liegen CutSheet nicht im Wortlaut
 * vor (offener Punkt F3) - deshalb gibt es für sie keine Vorgabe, die
 * Produktion trägt sie ein.
 *
 * Arbeitszeit ist die Zeit von Call bis Drehschluss ohne Pause (§ 2 ArbZG).
 */
import { dauer, ruhezeit } from './drehzeit'

export type Regel = 'gesetz' | 'tarif'
export type Befund = { art: 'verstoss' | 'zuschlag' | 'hinweis'; text: string; quelle: string }

export const SATZ_ARTEN = ['elfte', 'ab_zwoelfte', 'nacht', 'sonntag', 'feiertag'] as const
export type SatzArt = (typeof SATZ_ARTEN)[number]
export type Saetze = Record<SatzArt, number>

const GESETZ = 'nach eingestellter Regel (Gesetz)'
const TARIF = 'nach eingestellter Regel (Tarifvertrag)'

/** "10,5" aus 630 Minuten */
const stundenText = (minuten: number) => (Math.round(minuten / 6) / 10).toLocaleString('de-DE')

/** Die fünf Sätze in Prozent aus der Einstellung `surcharges`. Fehlendes und Unsinn ist 0. */
export function saetzeAus(text: string | null | undefined): Saetze {
  let roh: any = {}
  try { roh = JSON.parse(String(text ?? '')) ?? {} } catch { roh = {} }
  const s = {} as Saetze
  for (const art of SATZ_ARTEN) {
    const n = Number(roh?.[art])
    s[art] = Number.isFinite(n) && n >= 0 ? n : 0
  }
  return s
}

/** Arbeitszeit ohne Pause; null, wenn Call oder Drehschluss fehlt. */
export function arbeitszeit(call: unknown, wrap: unknown, pause: unknown): number | null {
  const brutto = dauer(call, wrap)
  if (brutto === null) return null
  const p = Math.max(0, Number(pause) || 0)
  return Math.max(0, brutto - (p > brutto ? 0 : p))
}

/**
 * Ein Tag: Höchstarbeitszeit und Pause. `pause` undefined heißt geplant -
 * dann zählt die Mindestpause nach § 4 als genommen, statt eine fehlende
 * Pause zu melden, die niemand eingetragen haben kann.
 */
export function pruefeTag(t: { call: unknown; wrap: unknown; pause?: number | null }, regel: Regel): Befund[] {
  const brutto = dauer(t.call, t.wrap)
  if (brutto === null) return []
  const geplant = t.pause === undefined || t.pause === null
  const mindest = brutto - 30 > 540 ? 45 : brutto - 0 > 360 ? 30 : 0
  const pause = geplant ? mindest : Math.max(0, Number(t.pause) || 0)
  const netto = Math.max(0, brutto - pause)
  const befunde: Befund[] = []
  const zusatz = geplant ? ' (geplant, abzüglich der Mindestpause)' : ''

  if (regel === 'gesetz' && netto > 600) {
    befunde.push({ art: 'verstoss', quelle: '§ 3 ArbZG', text: `Arbeitszeit ${stundenText(netto)} Stunden${zusatz}, mehr als 10 Stunden - ${GESETZ}` })
  }
  if (regel === 'tarif') {
    if (netto > 720) befunde.push({ art: 'verstoss', quelle: 'TV FFS', text: `Arbeitszeit ${stundenText(netto)} Stunden${zusatz}, mehr als 12 Stunden - ${TARIF}` })
    else if (netto > 600) befunde.push({ art: 'zuschlag', quelle: 'TV FFS', text: `Arbeitszeit ${stundenText(netto)} Stunden${zusatz}, über 10 Stunden zuschlagspflichtig - ${TARIF}` })
  }
  if (!geplant) {
    const noetig = netto > 540 ? 45 : netto > 360 ? 30 : 0
    if (pause < noetig) {
      befunde.push({ art: 'verstoss', quelle: '§ 4 ArbZG', text: `Pause ${pause} Minuten, bei ${stundenText(netto)} Stunden Arbeit mindestens ${noetig} Minuten - ${regel === 'tarif' ? TARIF : GESETZ}` })
    }
  }
  return befunde
}

/**
 * Ruhezeit zwischen Drehschluss und dem nächsten Call - unter elf Stunden ein
 * Verstoß (§ 5, beide Regeln). `mindest` ist die Ruhezeit aus den
 * Stammdaten; steht dort mehr als elf Stunden, prüft die Meldung danach.
 */
export function pruefeRuhezeit(wrapVortag: unknown, callVortag: unknown, callHeute: unknown, regel: Regel = 'gesetz', mindest = 660): Befund[] {
  const minuten = ruhezeit(wrapVortag, callVortag, callHeute)
  if (minuten === null || minuten >= mindest) return []
  return [{
    art: 'verstoss',
    quelle: mindest === 660 ? '§ 5 ArbZG' : 'Ruhezeit laut Stammdaten',
    text: `Ruhezeit ${stundenText(minuten)} Stunden, weniger als ${stundenText(mindest)} Stunden - ${regel === 'tarif' ? TARIF : GESETZ}`,
  }]
}

/** Eine Woche (Arbeitsminuten je Tag): nur unter Tarifvertrag - über 50 Stunden zuschlagspflichtig, über 60 ein Verstoß. */
export function pruefeWoche(minutenJeTag: number[], regel: Regel): Befund[] {
  if (regel !== 'tarif') return []
  const summe = minutenJeTag.reduce((s, m) => s + (Number(m) || 0), 0)
  if (summe > 3600) return [{ art: 'verstoss', quelle: 'TV FFS', text: `Woche mit ${stundenText(summe)} Stunden, mehr als 60 - ${TARIF}` }]
  if (summe > 3000) return [{ art: 'zuschlag', quelle: 'TV FFS', text: `Woche mit ${stundenText(summe)} Stunden, über 50 zuschlagspflichtig - ${TARIF}` }]
  return []
}

/** Montag der Kalenderwoche eines Datums ("2026-11-23" für den 25.11.2026); null bei Unsinn. */
export function wochenbeginn(datum: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null
  const d = new Date(`${datum}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/**
 * Freier Tag nach Tarifvertrag: je 20 Drehtage einer Person ein bezahlter
 * freier Tag. Nur der Hinweis mit Zählerstand am 20., 40., … Drehtag - kein
 * Zeitkonto, keine Abrechnung (Nicht-Ziel des Plans).
 */
export function freierTag(drehtag: number, regel: Regel): Befund[] {
  if (regel !== 'tarif' || !Number.isInteger(drehtag) || drehtag < 20 || drehtag % 20 !== 0) return []
  const anzahl = drehtag / 20
  return [{
    art: 'hinweis', quelle: 'TV FFS',
    text: `${drehtag}. Drehtag dieser Person: je 20 Drehtage ein bezahlter freier Tag, damit ${anzahl === 1 ? 'einer' : anzahl} - ${TARIF}`,
  }]
}

const istSonntag = (datum: string) => /^\d{4}-\d{2}-\d{2}$/.test(datum) && new Date(`${datum}T12:00:00Z`).getUTCDay() === 0

/** Sonn- und Feiertag: Hinweis auf den Ersatzruhetag (§ 11 Abs. 3), unter Tarif zusätzlich zuschlagspflichtig. */
export function sonnFeiertag(datum: string, feiertage: Iterable<string>, regel: Regel): Befund[] {
  const feiertag = new Set(feiertage).has(datum)
  if (!feiertag && !istSonntag(datum)) return []
  const befunde: Befund[] = [{
    art: 'hinweis', quelle: '§ 11 Abs. 3 ArbZG',
    text: feiertag
      ? 'Arbeit an einem Feiertag: Ersatzruhetag binnen acht Wochen'
      : 'Arbeit an einem Sonntag: Ersatzruhetag binnen zwei Wochen',
  }]
  if (regel === 'tarif') befunde.push({ art: 'zuschlag', quelle: 'TV FFS', text: `${feiertag ? 'Feiertag' : 'Sonntag'} zuschlagspflichtig - ${TARIF}` })
  return befunde
}

/** Überschneidung zweier Zeitspannen in Minuten. */
const ueberschneidung = (a1: number, a2: number, b1: number, b2: number) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1))

/**
 * Minuten je Zuschlagsart an einem Tag. `elfte` ist die erste Stunde über
 * den Stunden je Tagesgage, `ab_zwoelfte` alles danach - bei der Vorgabe
 * von zehn Stunden die elfte und ab der zwölften Stunde. Die Nachtzeit
 * zählt vom Call bis zum Drehschluss, Sonntag und Feiertag die ganze
 * Arbeitszeit.
 */
export function zuschlaege(
  t: { call: unknown; wrap: unknown; pause?: number | null; datum: string; feiertage: Iterable<string> },
  opt: { stundenJeTagesgage: number; nachtVon: number; nachtBis: number },
): Saetze {
  const m: Saetze = { elfte: 0, ab_zwoelfte: 0, nacht: 0, sonntag: 0, feiertag: 0 }
  const netto = arbeitszeit(t.call, t.wrap, t.pause)
  const brutto = dauer(t.call, t.wrap)
  if (netto === null || brutto === null) return m
  const ueber = Math.max(0, netto - opt.stundenJeTagesgage * 60)
  m.elfte = Math.min(60, ueber)
  m.ab_zwoelfte = Math.max(0, ueber - 60)

  const start = Number(t.call)
  const ende = start + brutto
  const von = opt.nachtVon
  const bis = opt.nachtBis <= von ? opt.nachtBis + 1440 : opt.nachtBis
  for (const versatz of [-1440, 0, 1440]) m.nacht += ueberschneidung(start, ende, von + versatz, bis + versatz)

  if (new Set(t.feiertage).has(t.datum)) m.feiertag = netto
  else if (istSonntag(t.datum)) m.sonntag = netto
  return m
}

/**
 * Überstunden und Zuschläge in Cent. Stundensatz = Tagesgage geteilt durch
 * die Stunden je Tagesgage. Die Stunden über der Tagesgage werden bezahlt
 * und tragen ihren Zuschlag (40 € mal 1,25); Nacht, Sonntag und Feiertag
 * sind schon mit der Tagesgage bezahlt und bringen nur den Zuschlag.
 */
export function betrag(minuten: Saetze, tagesgageCent: number, stundenJeTagesgage: number, saetze: Saetze): number {
  if (!(stundenJeTagesgage > 0) || !(tagesgageCent > 0)) return 0
  const proMinute = tagesgageCent / stundenJeTagesgage / 60
  const summe = proMinute * (
    minuten.elfte * (1 + saetze.elfte / 100)
    + minuten.ab_zwoelfte * (1 + saetze.ab_zwoelfte / 100)
    + minuten.nacht * saetze.nacht / 100
    + minuten.sonntag * saetze.sonntag / 100
    + minuten.feiertag * saetze.feiertag / 100
  )
  return Math.round(summe)
}
