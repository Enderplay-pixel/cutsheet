/**
 * Künstlersozialabgabe.
 *
 * Wer künstlerische oder publizistische Leistungen verwertet - und eine
 * Filmproduktion tut genau das -, zahlt auf die Honorare an selbständige
 * Künstlerinnen und Publizisten eine Abgabe an die Künstlersozialkasse. Das
 * ist keine Steuer und steht in keiner Rechnung: Die Produktion schuldet sie
 * zusätzlich, aus eigener Tasche.
 *
 * Gemeldet wird einmal im Jahr, bis zum 31. März für das Vorjahr. Wer nicht
 * meldet, wird geschätzt - und Schätzungen fallen nicht zugunsten der
 * Produktion aus.
 *
 * ## Was diese Datei kann und was nicht
 *
 * Sie rechnet: Summe der Honorare mal Abgabesatz. Sie entscheidet **nicht**,
 * wer künstlerisch tätig ist - das ist eine Einzelfallfrage, und sie geht im
 * Zweifel anders aus, als man denkt. Eine Kamerafrau ist in der Regel
 * künstlerisch tätig, eine Aufnahmeleitung in der Regel nicht, und zwischen
 * beidem liegt viel. Deshalb wird jede Person ausdrücklich gekennzeichnet,
 * und die Voreinstellung ist "nicht gekennzeichnet", nicht "ja".
 */

/**
 * Die Abgabesätze, in Hundertstel Prozent.
 *
 * 490 heißt 4,90 Prozent. Ganzzahlig, weil mit diesen Sätzen gerechnet wird
 * und 4.9 in Fließkomma nicht 4,9 ist.
 *
 * Quelle: Künstlersozialabgabe-Verordnung. Der Satz für 2026 (4,9 Prozent)
 * steht in der Verordnung vom 22. September 2025.
 *
 * ACHTUNG: Die Liste veraltet. Für ein Jahr, das hier nicht steht, gibt
 * `satzFuer` nichts zurück statt zu raten - eine erfundene Abgabe wäre
 * schlimmer als eine fehlende.
 */
export const ABGABESAETZE: Record<number, number> = {
  2021: 420,
  2022: 420,
  2023: 500,
  2024: 500,
  2025: 500,
  2026: 490,
}

/** Bis wann für das Vorjahr gemeldet wird. */
export const MELDEFRIST_TAG = '03-31'

/**
 * Die Bagatellgrenze für Eigenwerber, in Cent.
 *
 * Gilt **nicht** für Unternehmen, die Werke typischerweise verwerten - und
 * eine Produktionsfirma gehört dazu. Für sie gibt es keine Untergrenze. Die
 * Zahl steht hier für den Fall, dass eine Firma sich als Eigenwerber einstuft.
 */
export const BAGATELLGRENZE_CENTS = 100_000

export type Abgabepflicht = 'verwerter' | 'eigenwerber'

/** Der Satz eines Jahres, oder null wenn er nicht eingetragen ist. */
export function satzFuer(jahr: number): number | null {
  return ABGABESAETZE[jahr] ?? null
}

/** Der Satz als lesbarer Prozentwert: 490 wird zu "4,90". */
export function satzText(hundertstel: number): string {
  return (hundertstel / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

/**
 * Die Abgabe auf eine Bemessungsgrundlage.
 *
 * Ganzzahlig: erst multiplizieren, dann teilen, dann runden. Bei
 * sechsstelligen Honorarsummen entscheidet die Reihenfolge über Euro, nicht
 * über Cent.
 */
export function abgabe(grundlageCents: number, satzHundertstel: number): number {
  if (grundlageCents <= 0 || satzHundertstel <= 0) return 0
  return Math.round((grundlageCents * satzHundertstel) / 10_000)
}

export type Meldung = {
  jahr: number
  /** Summe der Honorare an gekennzeichnete Personen. */
  grundlageCents: number
  satzHundertstel: number | null
  abgabeCents: number
  /** Ob überhaupt eine Abgabe anfällt. */
  pflichtig: boolean
  /** Warum nicht, falls nicht. */
  hinweis: string
  /** Bis wann gemeldet werden muss. */
  frist: string
  /** Ob die Frist schon vorbei ist. */
  ueberfaellig: boolean
}

/**
 * Die Jahresmeldung rechnen.
 *
 * `heute` wird übergeben statt gelesen, damit die Rechnung prüfbar bleibt -
 * eine Funktion, die die Uhr liest, lässt sich nicht gegen einen festen Wert
 * testen.
 */
export function jahresmeldung(
  jahr: number,
  grundlageCents: number,
  art: Abgabepflicht,
  heute: string
): Meldung {
  const satz = satzFuer(jahr)
  const frist = `${jahr + 1}-${MELDEFRIST_TAG}`
  const ueberfaellig = String(heute).slice(0, 10) > frist

  if (satz === null) {
    return {
      jahr, grundlageCents, satzHundertstel: null, abgabeCents: 0, pflichtig: false,
      hinweis: `Für ${jahr} ist kein Abgabesatz hinterlegt. Der Satz steht in der `
        + 'Künstlersozialabgabe-Verordnung und muss nachgetragen werden.',
      frist, ueberfaellig,
    }
  }

  // Die Bagatellgrenze gilt nur für Eigenwerber. Eine Produktionsfirma
  // verwertet künstlerische Leistungen von Berufs wegen - für sie gibt es
  // keine Untergrenze, auch nicht bei 200 Euro Honorar im Jahr.
  if (art === 'eigenwerber' && grundlageCents <= BAGATELLGRENZE_CENTS) {
    return {
      jahr, grundlageCents, satzHundertstel: satz, abgabeCents: 0, pflichtig: false,
      hinweis: `Als Eigenwerber unter der Bagatellgrenze von `
        + `${BAGATELLGRENZE_CENTS / 100} Euro - keine Abgabe für ${jahr}.`,
      frist, ueberfaellig,
    }
  }

  if (grundlageCents <= 0) {
    return {
      jahr, grundlageCents: 0, satzHundertstel: satz, abgabeCents: 0, pflichtig: false,
      hinweis: `Keine Honorare an gekennzeichnete Personen in ${jahr}. `
        + 'Eine Meldung mit Null ist trotzdem abzugeben.',
      frist, ueberfaellig,
    }
  }

  return {
    jahr, grundlageCents, satzHundertstel: satz,
    abgabeCents: abgabe(grundlageCents, satz),
    pflichtig: true,
    hinweis: '',
    frist, ueberfaellig,
  }
}

/**
 * Gewerke, die erfahrungsgemäß künstlerisch tätig sind.
 *
 * Ein **Vorschlag** für die Kennzeichnung, keine Entscheidung. Die
 * Künstlersozialkasse entscheidet im Einzelfall, und sie sieht auf die
 * tatsächliche Tätigkeit, nicht auf die Bezeichnung im Abspann. Wer die
 * Vorschläge ungeprüft übernimmt, meldet falsch.
 */
export const KUENSTLERISCHE_GEWERKE = [
  'Regie', 'Drehbuch', 'Kamera', 'Bildgestaltung', 'Schnitt', 'Montage',
  'Szenenbild', 'Kostümbild', 'Maske', 'Musik', 'Komposition', 'Sounddesign',
  'Ton', 'Fotografie', 'Grafik', 'Animation', 'Choreografie', 'Dramaturgie',
]

/**
 * Wortstämme, auf die der Vorschlag anspringt.
 *
 * Stämme statt ganzer Wörter, weil "Regie" nicht in "Regisseurin" steckt
 * (R-e-g-i-s-s...) - gegen echte Stammdaten gemessen und genau daran
 * gescheitert. Die englischen Bezeichnungen stehen mit, weil in deutschen
 * Stablisten "Director of Photography" und "Editor" ganz normal vorkommen.
 *
 * Großzügig gewählt: Der Vorschlag soll auffallen, entschieden wird von Hand.
 * Ein Fehlalarm kostet einen Klick, ein übersehener Fall eine Nachforderung.
 */
const STAEMME = [
  'regi', 'drehbuch', 'autor', 'script', 'buch',
  'kamera', 'bildgestalt', 'photograph', 'fotograf', 'dop', 'd.o.p',
  'schnitt', 'montage', 'editor', 'edit',
  'szenenbild', 'ausstatt', 'production design', 'set design',
  'kostüm', 'kostuem', 'costume', 'maske', 'make-up', 'makeup',
  'musik', 'komposit', 'kompon', 'composer', 'score',
  'ton', 'sound', 'mischung', 'mixing',
  'grafik', 'graphic', 'animation', 'vfx', 'compositing',
  'choreograf', 'dramaturg', 'illustrat', 'gestalt',
]

/**
 * Ein Vorschlag anhand der Funktionsbezeichnung.
 *
 * Vergleicht ohne Rücksicht auf Groß- und Kleinschreibung und auf Zusätze:
 * "1. Kameraassistenz" trifft, "Regisseurin" trifft, "Director of Photography"
 * trifft. "Produktionsleitung" und "Aufnahmeleitung" treffen nicht.
 */
export function gewerkVorschlag(funktion: string): boolean {
  const text = String(funktion || '').toLowerCase()
  if (!text.trim()) return false
  return STAEMME.some((stamm) => text.includes(stamm))
}
