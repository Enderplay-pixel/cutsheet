/**
 * Jugendarbeitsschutz am Set.
 *
 * Wer ein Kind vor der Kamera hat, braucht vorher eine Bewilligung der
 * Aufsichtsbehörde - Kinderarbeit ist nach Paragraf 5 JArbSchG verboten, und
 * Paragraf 6 ist die Ausnahme davon. Die Bewilligung kommt nicht von selbst,
 * sie dauert, und ohne sie darf nicht gedreht werden.
 *
 * Diese Datei rechnet aus, was das für einen konkreten Drehtag heißt: ob das
 * Kind überhaupt mitwirken darf, wie lange, und in welchem Zeitfenster. Sie
 * ersetzt keine Behörde. Was die Bewilligung im Einzelfall festlegt - Pausen,
 * Höchstdauer des Aufenthalts am Set - steht im Bescheid und hat Vorrang.
 *
 * ## Die Grenzen aus Paragraf 6 Absatz 1 Nummer 2 JArbSchG
 *
 *  - unter 3 Jahren: keine Mitwirkung
 *  - über 3 bis 6 Jahre: höchstens 2 Stunden täglich, zwischen 8 und 17 Uhr
 *  - über 6 Jahre: höchstens 3 Stunden täglich, zwischen 8 und 22 Uhr
 *
 * Für Theatervorstellungen gelten andere Werte (über 6 Jahre: vier Stunden
 * zwischen 10 und 23 Uhr, Nummer 1); die stehen hier mit, weil eine
 * Produktion auch eine Vorstellung abfilmt. Musik- und andere Aufführungen
 * fallen unter Nummer 2 wie Film (am Gesetzestext nachgesehen am 25.10.2026).
 *
 * Quelle: Gesetzestext auf gesetze-im-internet.de. Maßgeblich ist er, nicht
 * diese Zusammenfassung - und die Fristen für den Antrag setzt jedes Land
 * selbst (NRW nennt zwei Wochen, Hessen eine).
 */

export type Einsatzart = 'film' | 'theater'

export type Grenze = {
  /** Ob eine Mitwirkung überhaupt möglich ist. */
  erlaubt: boolean
  /** Höchstdauer der Mitwirkung in Minuten. */
  maxMinuten: number
  /** Frühester Beginn, Stunde im Tag. */
  vonStunde: number
  /** Spätestes Ende, Stunde im Tag. */
  bisStunde: number
  /** Ob eine Bewilligung nach Paragraf 6 JArbSchG nötig ist. */
  bewilligungNoetig: boolean
  /** Welche Regel greift - für die Anzeige. */
  grund: string
}

/** Ab diesem Alter gilt jemand nicht mehr als Kind im Sinne des Gesetzes. */
export const KIND_BIS_ALTER = 15

/**
 * Was für ein Kind dieses Alters gilt.
 *
 * `alter` ist das Alter am Drehtag in vollen Jahren. Das Gesetz sagt "über
 * drei Jahre" und "über sechs Jahre": Ein Kind, das am Drehtag genau sechs
 * ist, fällt in die untere Stufe, erst ab dem siebten Geburtstag in die obere.
 */
export function grenzeFuer(alter: number, art: Einsatzart = 'film', schulpflichtig: boolean | null = null): Grenze {
  if (!Number.isFinite(alter) || alter < 0) {
    return {
      erlaubt: false, maxMinuten: 0, vonStunde: 0, bisStunde: 0, bewilligungNoetig: true,
      grund: 'Ohne Geburtsdatum lässt sich nichts entscheiden',
    }
  }
  if (alter < 3) {
    return {
      erlaubt: false, maxMinuten: 0, vonStunde: 0, bisStunde: 0, bewilligungNoetig: true,
      grund: 'Unter drei Jahren ist eine Mitwirkung nicht möglich (§ 6 Abs. 1 Nr. 2 JArbSchG)',
    }
  }
  if (alter <= 6) {
    return {
      erlaubt: true, maxMinuten: 120, vonStunde: 8, bisStunde: 17, bewilligungNoetig: true,
      grund: 'Über 3 bis 6 Jahre: höchstens 2 Stunden zwischen 8 und 17 Uhr (§ 6 Abs. 1 Nr. 2 JArbSchG)',
    }
  }
  // Vollzeitschulpflichtige Jugendliche zählen als Kinder (§ 2 Abs. 3 JArbSchG)
  if (alter < KIND_BIS_ALTER || (alter < 18 && schulpflichtig === true)) {
    const wer = alter < KIND_BIS_ALTER ? 'Über 6 Jahre' : 'Vollzeitschulpflichtig, darum wie ein Kind (§ 2 Abs. 3 JArbSchG)'
    return art === 'theater'
      ? {
          erlaubt: true, maxMinuten: 240, vonStunde: 10, bisStunde: 23, bewilligungNoetig: true,
          grund: `${wer}, Theatervorstellung: höchstens 4 Stunden zwischen 10 und 23 Uhr (§ 6 Abs. 1 Nr. 1 JArbSchG)`,
        }
      : {
          erlaubt: true, maxMinuten: 180, vonStunde: 8, bisStunde: 22, bewilligungNoetig: true,
          grund: `${wer}: höchstens 3 Stunden zwischen 8 und 22 Uhr (§ 6 Abs. 1 Nr. 2 JArbSchG)`,
        }
  }
  // Ab 15 Jahren ist jemand Jugendlicher, nicht mehr Kind. Dann gelten die
  // allgemeinen Vorschriften (Paragraf 8 ff. JArbSchG), nicht die Ausnahme
  // des Paragrafen 6 - und keine Einzelbewilligung.
  //
  // Bei Film- und Fotoaufnahmen und bei Aufführungen dürfen Jugendliche nach
  // Paragraf 14 Absatz 7 bis 23 Uhr gestaltend mitwirken, nicht nur bis 20 -
  // am Gesetzestext nachgesehen am 25.10.2026. Vorher meldete die Prüfung
  // eine 16-Jährige bis 22 Uhr als Verstoß.
  return {
    erlaubt: true, maxMinuten: 8 * 60, vonStunde: 6, bisStunde: 23, bewilligungNoetig: false,
    grund: 'Jugendlicher ab 15: 8 Stunden täglich, zwischen 6 und 23 Uhr bei Film- und Fotoaufnahmen '
      + 'und Aufführungen, danach 14 Stunden Freizeit (§§ 8, 14 Abs. 7 JArbSchG)',
  }
}

/**
 * Alter in vollen Jahren an einem Stichtag.
 *
 * Gerechnet wird über die Datumsteile, nicht über Millisekunden: Wer durch
 * 365,25 teilt, liegt rund um Geburtstage und Schaltjahre daneben, und beim
 * Jugendarbeitsschutz entscheidet ein Tag über zwei Stunden Drehzeit.
 */
export function alterAm(geburtstag: string, stichtag: string): number {
  const g = String(geburtstag).slice(0, 10).split('-').map(Number)
  const s = String(stichtag).slice(0, 10).split('-').map(Number)
  if (g.length !== 3 || s.length !== 3 || g.some(Number.isNaN) || s.some(Number.isNaN)) return NaN
  let jahre = s[0] - g[0]
  if (s[1] < g[1] || (s[1] === g[1] && s[2] < g[2])) jahre -= 1
  return jahre
}

/** Minuten seit Mitternacht aus "HH:MM". */
export function minuten(uhrzeit: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(uhrzeit || ''))
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

export type Einsatz = {
  name: string
  geburtstag: string | null | undefined
  /** Drehtag, ISO-Datum. */
  datum: string
  /** Wann die Person am Set sein soll. */
  von: string | null | undefined
  bis: string | null | undefined
  art?: Einsatzart
  /** Ob eine Bewilligung der Aufsichtsbehörde vorliegt. */
  bewilligung?: boolean
  /** Ob das Einverständnis der Erziehungsberechtigten vorliegt. */
  einverstaendnis?: boolean
  /** Vollzeitschulpflichtig? `null` heißt: nicht erfasst. */
  schulpflichtig?: boolean | null
}

export type Befund = {
  /** 'verstoss' heißt: so darf nicht gedreht werden. 'hinweis' ist zu klären. */
  art: 'verstoss' | 'hinweis'
  text: string
}

export type Pruefung = {
  name: string
  alter: number
  istKind: boolean
  grenze: Grenze
  dauerMinuten: number
  befunde: Befund[]
}

/**
 * Prüft einen Einsatz gegen die Grenzen.
 *
 * Gibt zurück, was dagegen spricht - nicht, ob es "passt". Eine leere Liste
 * heißt: An diesen Punkten ist nichts zu beanstanden. Sie heißt nicht, dass
 * die Bewilligung vorliegt oder dass der Bescheid nichts Weiteres verlangt.
 */
export function pruefeEinsatz(e: Einsatz): Pruefung {
  const befunde: Befund[] = []

  if (!e.geburtstag) {
    return {
      name: e.name, alter: NaN, istKind: false,
      grenze: grenzeFuer(NaN), dauerMinuten: 0,
      befunde: [{
        art: 'hinweis',
        text: 'Kein Geburtsdatum hinterlegt. Ohne Alter lässt sich der Jugendarbeitsschutz nicht prüfen.',
      }],
    }
  }

  const alter = alterAm(e.geburtstag, e.datum)
  const schulpflichtig = e.schulpflichtig ?? null
  const istKind = alter < KIND_BIS_ALTER || (alter < 18 && schulpflichtig === true)
  const grenze = grenzeFuer(alter, e.art ?? 'film', schulpflichtig)

  // Volljährige kommen gar nicht erst in die Prüfung.
  if (alter >= 18) {
    return { name: e.name, alter, istKind: false, grenze, dauerMinuten: 0, befunde: [] }
  }

  if (!grenze.erlaubt) {
    befunde.push({ art: 'verstoss', text: grenze.grund })
  }

  const beginn = minuten(String(e.von || ''))
  // Ein Ende vor dem Beginn liegt nach Mitternacht. Gemessen am 25.10.2026:
  // 14 Jahre, 17:00 bis 01:00 - Dauer 0 und "01:00" vor der Zeitgrenze, also
  // kein einziger Verstoß. 17:00 bis 23:30 ergab zwei.
  const endeRoh = minuten(String(e.bis || ''))
  const ende = Number.isFinite(beginn) && endeRoh < beginn ? endeRoh + 24 * 60 : endeRoh
  const dauer = Number.isFinite(beginn) && Number.isFinite(ende) ? ende - beginn : 0

  if (!Number.isFinite(beginn) || !Number.isFinite(ende)) {
    befunde.push({ art: 'hinweis', text: 'Keine Zeiten eingetragen - Dauer und Zeitfenster sind nicht prüfbar.' })
  } else if (grenze.erlaubt) {
    if (dauer > grenze.maxMinuten) {
      befunde.push({
        art: 'verstoss',
        text: `${String(Math.round(dauer / 6) / 10).replace('.', ',')} Stunden geplant, erlaubt sind ${String(grenze.maxMinuten / 60).replace('.', ',')}. ${grenze.grund}`,
      })
    }
    if (beginn < grenze.vonStunde * 60) {
      befunde.push({
        art: 'verstoss',
        text: `Beginn um ${e.von} liegt vor ${grenze.vonStunde} Uhr. ${grenze.grund}`,
      })
    }
    if (ende > grenze.bisStunde * 60) {
      befunde.push({
        art: 'verstoss',
        text: `Ende um ${e.bis} liegt nach ${grenze.bisStunde} Uhr. ${grenze.grund}`,
      })
    }
  }

  if (grenze.bewilligungNoetig && !e.bewilligung) {
    befunde.push({
      art: 'verstoss',
      text: 'Die Bewilligung der Aufsichtsbehörde fehlt. Ohne sie darf das Kind nicht mitwirken '
        + '(§ 6 Abs. 4 JArbSchG) - der Antrag braucht je nach Land ein bis zwei Wochen.',
    })
  }
  if (istKind && !e.einverstaendnis) {
    befunde.push({
      art: 'hinweis',
      text: 'Das Einverständnis der Erziehungsberechtigten ist nicht vermerkt. Es gehört zum Antrag.',
    })
  }
  // Ist der Schulstatus nicht erfasst, erinnert die Prüfung daran. Bis zum
  // 03.11.2026 stand hier für eine 15-jährige Schülerin nichts - also acht
  // Stunden bis 23 Uhr ohne Bewilligung, obwohl für sie die Grenzen für
  // Kinder gelten. Seitdem lässt sich der Status je Person eintragen.
  if (!istKind && schulpflichtig === null) {
    befunde.push({
      art: 'hinweis',
      text: 'Schulstatus nicht eingetragen. Wer noch vollzeitschulpflichtig ist, gilt als Kind (§ 2 Abs. 3 JArbSchG): '
        + 'dann höchstens 3 Stunden zwischen 8 und 22 Uhr, und die Bewilligung der Aufsichtsbehörde ist nötig.',
    })
  }

  return { name: e.name, alter, istKind, grenze, dauerMinuten: dauer, befunde }
}

/**
 * Die Unterlagen, die ein Antrag nach Paragraf 6 JArbSchG braucht.
 *
 * Keine Rechtsauskunft, sondern eine Merkliste: Was die Behörden
 * übereinstimmend verlangen. Welche Behörde zuständig ist und welche Frist
 * gilt, hängt vom Bundesland ab und steht deshalb nicht hier.
 */
export const ANTRAGSUNTERLAGEN = [
  'Angaben zur Produktion: Art, Drehorte, Drehtage, Umfang und Rolle des Kindes',
  'Einverständniserklärung beider Erziehungsberechtigten',
  'Ärztliche Bescheinigung (Kinderarztpraxis)',
  'Stellungnahme der Schule',
  'Stellungnahme des Jugendamts',
  'Angaben zur Betreuung am Set',
]
