/**
 * Mahnwesen: Stufen, Fristen, Gebühren, Verzugszinsen.
 *
 * Eine überfällige Rechnung ist kein Zustand, sondern ein Ablauf: Erinnerung,
 * erste Mahnung, zweite Mahnung, letzte Frist. Jede Stufe hat eine eigene
 * Frist, einen eigenen Ton und möglicherweise eigene Kosten.
 *
 * Alle Beträge sind Cent und ganzzahlig. Das ist keine Vorliebe: In
 * Fließkommazahlen ist `Math.round(1.005 * 100)` gleich 100, nicht 101 - bei
 * Zinsen auf fünfstellige Beträge wird daraus ein Betrag, den niemand
 * nachrechnen kann.
 *
 * Was hier **nicht** entschieden wird: ob gemahnt werden soll. Das Mahnwesen
 * rechnet und schlägt vor, abgeschickt wird auf Knopfdruck. Eine Software,
 * die eigenmächtig Mahnungen an Auftraggeber schickt, ruiniert Verhältnisse,
 * die über Jahre gewachsen sind.
 */

/** Die Stufen, in der Reihenfolge, in der sie durchlaufen werden. */
export type Mahnstufe = 1 | 2 | 3 | 4

export type StufenRegel = {
  stufe: Mahnstufe
  /** Was in der Oberfläche und im Betreff steht. */
  name: string
  /**
   * Tage nach Fälligkeit (Stufe 1) bzw. nach der letzten Mahnung, ab denen
   * diese Stufe vorgeschlagen wird.
   */
  nachTagen: number
  /** Neue Zahlungsfrist in Tagen, gerechnet vom Mahndatum. */
  fristTage: number
  /** Mahngebühr in Cent. */
  gebuehrCents: number
  /** Ob ab dieser Stufe Verzugszinsen aufgeschlagen werden. */
  mitZinsen: boolean
  /** Der Ton, in dem die Mail formuliert ist. */
  ton: string
}

/**
 * Die Voreinstellung.
 *
 * Stufe 1 ist bewusst kostenlos und freundlich: Die häufigste Ursache einer
 * überfälligen Rechnung ist, dass sie untergegangen ist. Eine Gebühr auf eine
 * vergessene Rechnung ist teurer als die Gebühr.
 *
 * Die Gebühren sind Erfahrungswerte, keine gesetzlichen Beträge - sie müssen
 * den tatsächlichen Aufwand abbilden, sonst sind sie nicht durchsetzbar. Die
 * 40-Euro-Pauschale nach Paragraf 288 Absatz 5 BGB ist etwas anderes und
 * steht separat (`PAUSCHALE_CENTS`).
 */
export const STUFEN: StufenRegel[] = [
  {
    stufe: 1,
    name: 'Zahlungserinnerung',
    nachTagen: 7,
    fristTage: 10,
    gebuehrCents: 0,
    mitZinsen: false,
    ton: 'freundlich, ohne Vorwurf - die Rechnung ist wahrscheinlich untergegangen',
  },
  {
    stufe: 2,
    name: '1. Mahnung',
    nachTagen: 14,
    fristTage: 10,
    gebuehrCents: 500,
    mitZinsen: true,
    ton: 'sachlich, mit Frist und Hinweis auf Verzug',
  },
  {
    stufe: 3,
    name: '2. Mahnung',
    nachTagen: 14,
    fristTage: 7,
    gebuehrCents: 1000,
    mitZinsen: true,
    ton: 'deutlich, letzte Frist vor weiteren Schritten',
  },
  {
    stufe: 4,
    name: 'Letzte Mahnung',
    nachTagen: 10,
    fristTage: 7,
    gebuehrCents: 1500,
    mitZinsen: true,
    ton: 'abschließend, mit Ankündigung des gerichtlichen Mahnverfahrens',
  },
]

/** Die Pauschale nach Paragraf 288 Absatz 5 BGB - nur gegenüber Unternehmern. */
export const PAUSCHALE_CENTS = 4000

/**
 * Der Basiszinssatz nach Paragraf 247 BGB, in Basispunkten.
 *
 * Stand: 1,52 Prozent, gültig seit dem 1. Juli 2026. Quelle ist die
 * Bekanntgabe der Deutschen Bundesbank im Bundesanzeiger.
 *
 * ACHTUNG: Dieser Wert veraltet planmäßig. Die Bundesbank überprüft ihn zum
 * 1. Januar und zum 1. Juli jedes Jahres. Er steht hier als Rückfallwert für
 * Firmen ohne eigene Eintragung - die Firmeneinstellung hat Vorrang. Wer
 * mahnt, sieht den geltenden Satz nach; ein veralteter Satz macht die
 * Zinsforderung angreifbar.
 *
 * Deshalb trägt der Wert sein Stichdatum mit: `zinsSatzVeraltet` meldet,
 * sobald ein Halbjahreswechsel darüber hinweggegangen ist, und die Oberfläche
 * schreibt das an die Mahnung.
 *
 * Basispunkte statt Prozent, damit nichts gerundet wird: 1 Prozent sind
 * 100 Basispunkte, ein negativer Basiszins ist zulässig.
 */
export const BASISZINS_RUECKFALL_BP = 152

/** Seit wann der Rückfallwert gilt. */
export const BASISZINS_STAND = '2026-07-01'

/**
 * Ist der Satz womöglich veraltet?
 *
 * Wahr, sobald seit dem Stichdatum ein 1. Januar oder 1. Juli vergangen ist.
 * Das ist keine Aussage darüber, dass der Satz sich geändert **hat** - die
 * Bundesbank lässt ihn oft stehen. Es ist der Hinweis, dass niemand mehr
 * nachgesehen hat.
 */
export function zinsSatzVeraltet(stand: string, heute: string): boolean {
  const naechsterTermin = (seit: string) => {
    const jahr = Number(seit.slice(0, 4))
    const monat = Number(seit.slice(5, 7))
    return monat < 7 ? `${jahr}-07-01` : `${jahr + 1}-01-01`
  }
  return tageZwischen(naechsterTermin(String(stand).slice(0, 10)), heute) >= 0
}

/**
 * Der Verzugszinssatz nach Paragraf 288 BGB, in Basispunkten.
 *
 * Fünf Prozentpunkte über dem Basiszinssatz, bei Entgeltforderungen zwischen
 * Unternehmern neun. Der Unterschied ist erheblich, deshalb entscheidet nicht
 * die Software darüber, sondern die Angabe am Auftraggeber.
 */
export function verzugssatzBp(basiszinsBp: number, gegenUnternehmer: boolean): number {
  return basiszinsBp + (gegenUnternehmer ? 900 : 500)
}

/**
 * Verzugszinsen in Cent.
 *
 * Kaufmännische Zinsrechnung mit 365 Tagen. Gerechnet wird ganzzahlig: erst
 * multiplizieren, dann teilen, dann runden - sonst verschwinden bei kleinen
 * Beträgen die Cent und bei großen entstehen welche.
 *
 * Ein negativer Satz (möglich bei negativem Basiszins und Verbrauchern) ergibt
 * keine Gutschrift, sondern null: Zinsen zugunsten des Schuldners kennt
 * Paragraf 288 BGB nicht.
 */
export function verzugszinsen(betragCents: number, tage: number, satzBp: number): number {
  if (betragCents <= 0 || tage <= 0 || satzBp <= 0) return 0
  return Math.round((betragCents * satzBp * tage) / (10_000 * 365))
}

/** Tage zwischen zwei Datumsangaben (ISO), negativ wenn b vor a liegt. */
export function tageZwischen(a: string, b: string): number {
  const eins = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`)
  const zwei = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(eins) || Number.isNaN(zwei)) return 0
  return Math.round((zwei - eins) / 86_400_000)
}

/** Datum plus Tage, als ISO-Datum ohne Zeit. */
export function plusTage(datum: string, tage: number): string {
  const ms = Date.parse(`${String(datum).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(ms)) return String(datum).slice(0, 10)
  return new Date(ms + tage * 86_400_000).toISOString().slice(0, 10)
}

export type Forderung = {
  /** Bruttobetrag der Rechnung. */
  bruttoCents: number
  /** Was davon bezahlt ist. */
  bezahltCents: number
  /** Fälligkeitsdatum der Rechnung. */
  faellig: string | null | undefined
  /** Die bisher höchste gemahnte Stufe, 0 wenn noch nicht gemahnt. */
  letzteStufe: number
  /** Datum der letzten Mahnung, leer wenn noch nicht gemahnt. */
  letzteMahnung: string | null | undefined
  /** Frist aus der letzten Mahnung - solange sie läuft, wird nicht erneut gemahnt. */
  letzteFrist?: string | null | undefined
}

export type Vorschlag = {
  /** Die Stufe, die jetzt fällig wäre. */
  stufe: Mahnstufe
  regel: StufenRegel
  /** Offener Betrag, auf den gemahnt wird. */
  offenCents: number
  /** Tage in Verzug, gerechnet ab Fälligkeit. */
  tageVerzug: number
  /** Zinsen auf den offenen Betrag für die Verzugstage. */
  zinsenCents: number
  /** Mahngebühr dieser Stufe. */
  gebuehrCents: number
  /** Die 40-Euro-Pauschale, sofern sie greift. */
  pauschaleCents: number
  /** Was insgesamt angemahnt wird. */
  gesamtCents: number
  /** Die neue Zahlungsfrist. */
  neueFrist: string
}

/**
 * Was bei dieser Forderung jetzt zu tun wäre - oder nichts.
 *
 * `null` heißt: nichts zu tun. Das ist der häufigste Fall und kein Fehler.
 * Gründe: bezahlt, noch nicht fällig, Frist der letzten Mahnung läuft noch,
 * oder die letzte Stufe ist erreicht.
 *
 * Eine laufende Frist ist eine harte Sperre. Wer am dritten Tag einer
 * zehntägigen Frist die nächste Mahnung schickt, hat die Frist nie gemeint -
 * und verliert vor Gericht genau damit.
 */
export function naechsterSchritt(
  f: Forderung,
  heute: string,
  einstellungen: { basiszinsBp?: number; gegenUnternehmer?: boolean; mitPauschale?: boolean } = {}
): Vorschlag | null {
  const offen = Math.max(0, Number(f.bruttoCents || 0) - Number(f.bezahltCents || 0))
  if (offen <= 0) return null
  if (!f.faellig) return null

  const tageVerzug = tageZwischen(String(f.faellig), heute)
  if (tageVerzug <= 0) return null

  const letzte = Number(f.letzteStufe || 0)
  if (letzte >= STUFEN.length) return null

  // Läuft die Frist der letzten Mahnung noch, wird nicht gemahnt.
  if (f.letzteFrist && tageZwischen(String(f.letzteFrist), heute) <= 0) return null

  const regel = STUFEN[letzte]
  // Stufe 1 zählt ab Fälligkeit, jede weitere ab der letzten Mahnung.
  const bezug = letzte === 0 ? String(f.faellig) : String(f.letzteMahnung || f.faellig)
  if (tageZwischen(bezug, heute) < regel.nachTagen) return null

  const basis = einstellungen.basiszinsBp ?? BASISZINS_RUECKFALL_BP
  const satz = verzugssatzBp(basis, einstellungen.gegenUnternehmer !== false)
  const zinsen = regel.mitZinsen ? verzugszinsen(offen, tageVerzug, satz) : 0
  // Die Pauschale wird einmal fällig, nicht je Mahnung.
  const pauschale = regel.mitZinsen && einstellungen.mitPauschale && letzte === 1 ? PAUSCHALE_CENTS : 0

  return {
    stufe: regel.stufe,
    regel,
    offenCents: offen,
    tageVerzug,
    zinsenCents: zinsen,
    gebuehrCents: regel.gebuehrCents,
    pauschaleCents: pauschale,
    gesamtCents: offen + zinsen + regel.gebuehrCents + pauschale,
    neueFrist: plusTage(heute, regel.fristTage),
  }
}

/**
 * Die Altersstruktur einer offenen Forderung.
 *
 * Die Einteilung ist die übliche in der Buchhaltung: Was unter 30 Tagen alt
 * ist, läuft noch; ab 90 Tagen ist ein Ausfall wahrscheinlich und gehört in
 * die Betrachtung der Liquidität.
 */
export type Altersklasse = 'nicht fällig' | 'bis 30 Tage' | '31 bis 60 Tage' | '61 bis 90 Tage' | 'über 90 Tage'

export function altersklasse(faellig: string | null | undefined, heute: string): Altersklasse {
  if (!faellig) return 'nicht fällig'
  const tage = tageZwischen(String(faellig), heute)
  if (tage <= 0) return 'nicht fällig'
  if (tage <= 30) return 'bis 30 Tage'
  if (tage <= 60) return '31 bis 60 Tage'
  if (tage <= 90) return '61 bis 90 Tage'
  return 'über 90 Tage'
}

export const ALTERSKLASSEN: Altersklasse[] = [
  'nicht fällig', 'bis 30 Tage', '31 bis 60 Tage', '61 bis 90 Tage', 'über 90 Tage',
]
