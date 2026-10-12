/**
 * Reisekosten: Verpflegungspauschalen, Fahrtkosten, Übernachtung.
 *
 * Eine Produktion, die auswärts dreht, schuldet ihren Leuten mehr als die
 * Gage. Was genau, steht im Gesetz - und zwar so, dass niemand es im Kopf
 * richtig rechnet: Der Anreisetag zählt anders als der Tag dazwischen, ein
 * gestelltes Frühstück kürzt um einen anderen Satz als ein Abendessen, und
 * bei weniger als acht Stunden gibt es gar nichts.
 *
 * ## Die Sätze
 *
 * Verpflegungsmehraufwand im Inland nach Paragraf 9 Absatz 4a EStG:
 *
 *  - mehr als 8 Stunden abwesend: 14 Euro
 *  - voller Kalendertag (24 Stunden abwesend): 28 Euro
 *  - An- und Abreisetag einer mehrtägigen Reise: je 14 Euro, unabhängig von
 *    der Stundenzahl
 *  - bis 8 Stunden: nichts
 *
 * Diese Werte gelten 2026 unverändert. Die im Wachstumschancengesetz
 * diskutierte Anhebung auf 16 und 32 Euro ist nicht Gesetz geworden.
 *
 * ## Was diese Datei nicht kann
 *
 * **Ausland.** Dort gelten Ländersätze, die das Bundesfinanzministerium
 * jährlich neu festlegt. Sie stehen hier nicht, und `pauschaleFuer` rechnet
 * für eine Auslandsreise nichts - lieber keine Zahl als eine falsche.
 *
 * **Die Übernachtungspauschale** ist absichtlich nicht voreingestellt. Sie
 * beruht auf Verwaltungsregelungen, nicht auf dem Gesetzestext, und wer
 * tatsächliche Hotelkosten hat, rechnet ohnehin mit denen. Wer eine Pauschale
 * nutzen will, trägt den Betrag ein, der im geltenden Schreiben steht.
 */

/** Alle Beträge in Cent, ganzzahlig. */
export const PAUSCHALE_8H_CENTS = 1_400
export const PAUSCHALE_24H_CENTS = 2_800
export const PAUSCHALE_ANREISE_CENTS = 1_400

/** Ab wann es überhaupt etwas gibt. */
export const MINDESTDAUER_MINUTEN = 8 * 60

/**
 * Kürzung bei gestellten Mahlzeiten, in Prozent des **Tagessatzes für den
 * vollen Tag** - nicht des Satzes, der an diesem Tag anfällt.
 *
 * Das ist der Punkt, an dem es in der Praxis schiefgeht: Am Anreisetag mit
 * 14 Euro wird trotzdem um 40 Prozent von 28 Euro gekürzt, also um 11,20. Es
 * kann sogar auf null laufen, und negativ wird es nie.
 */
export const KUERZUNG_PROZENT = { fruehstueck: 20, mittag: 40, abend: 40 } as const

export type Mahlzeiten = { fruehstueck?: boolean; mittag?: boolean; abend?: boolean }

export type Tagesart = 'einzeln' | 'anreise' | 'zwischentag' | 'abreise'

/**
 * Die Pauschale eines Tages, vor der Kürzung.
 *
 * `dauerMinuten` zählt nur beim Tagesart 'einzeln' - bei einer mehrtägigen
 * Reise steht die Art des Tages fest, egal wie lange jemand unterwegs war.
 */
export function pauschaleFuer(art: Tagesart, dauerMinuten = 0): number {
  if (art === 'zwischentag') return PAUSCHALE_24H_CENTS
  if (art === 'anreise' || art === 'abreise') return PAUSCHALE_ANREISE_CENTS
  // Einzelner Tag ohne Übernachtung: Es zählt die Abwesenheit.
  return dauerMinuten > MINDESTDAUER_MINUTEN ? PAUSCHALE_8H_CENTS : 0
}

/**
 * Was gestellte Mahlzeiten kürzen.
 *
 * Immer bezogen auf 28 Euro, auch an einem Tag mit 14. Die Kürzung kann die
 * Pauschale aufzehren; unter null geht sie nicht.
 */
export function kuerzung(mahlzeiten: Mahlzeiten): number {
  let summe = 0
  if (mahlzeiten.fruehstueck) summe += Math.round((PAUSCHALE_24H_CENTS * KUERZUNG_PROZENT.fruehstueck) / 100)
  if (mahlzeiten.mittag) summe += Math.round((PAUSCHALE_24H_CENTS * KUERZUNG_PROZENT.mittag) / 100)
  if (mahlzeiten.abend) summe += Math.round((PAUSCHALE_24H_CENTS * KUERZUNG_PROZENT.abend) / 100)
  return summe
}

/** Die Pauschale eines Tages nach Kürzung - nie unter null. */
export function tagessatz(art: Tagesart, dauerMinuten: number, mahlzeiten: Mahlzeiten = {}): number {
  return Math.max(0, pauschaleFuer(art, dauerMinuten) - kuerzung(mahlzeiten))
}

/**
 * Die Kilometerpauschale für den eigenen Wagen, in Cent je Kilometer.
 *
 * 30 Cent für ein Kraftfahrzeug, 20 Cent für andere motorbetriebene
 * Fahrzeuge - Paragraf 9 Absatz 1 Nummer 4a EStG. Wer stattdessen
 * tatsächliche Kosten abrechnet, trägt sie als Ausgabe ein; dafür ist diese
 * Rechnung nicht gedacht.
 */
export const KM_PAUSCHALE_CENTS = { pkw: 30, sonstige: 20 } as const

export function fahrtkosten(kilometer: number, art: keyof typeof KM_PAUSCHALE_CENTS = 'pkw'): number {
  if (!Number.isFinite(kilometer) || kilometer <= 0) return 0
  return Math.round(kilometer * KM_PAUSCHALE_CENTS[art])
}

export type Reisetag = {
  datum: string
  art: Tagesart
  dauerMinuten?: number
  mahlzeiten?: Mahlzeiten
}

export type Abrechnung = {
  tage: Array<{
    datum: string
    art: Tagesart
    pauschaleCents: number
    kuerzungCents: number
    satzCents: number
  }>
  verpflegungCents: number
  fahrtCents: number
  uebernachtungCents: number
  gesamtCents: number
}

/**
 * Die Abrechnung einer Reise.
 *
 * Alles getrennt ausgewiesen, nicht nur die Summe: Wer eine Reisekosten-
 * abrechnung bekommt, in der eine Zahl steht, rechnet sie nach oder glaubt
 * sie nicht.
 */
export function rechneReise(
  tage: Reisetag[],
  extras: { kilometer?: number; fahrzeugart?: keyof typeof KM_PAUSCHALE_CENTS; uebernachtungCents?: number } = {}
): Abrechnung {
  const zeilen = tage.map((t) => {
    const roh = pauschaleFuer(t.art, t.dauerMinuten ?? 0)
    const ab = kuerzung(t.mahlzeiten ?? {})
    return {
      datum: t.datum,
      art: t.art,
      pauschaleCents: roh,
      // Die Kürzung wird nur so weit ausgewiesen, wie sie wirkt - sonst stünde
      // dort ein Abzug, den es nicht gab.
      kuerzungCents: Math.min(ab, roh),
      satzCents: Math.max(0, roh - ab),
    }
  })

  const verpflegung = zeilen.reduce((s, z) => s + z.satzCents, 0)
  const fahrt = fahrtkosten(extras.kilometer ?? 0, extras.fahrzeugart ?? 'pkw')
  const uebernachtung = Math.max(0, Math.round(extras.uebernachtungCents ?? 0))

  return {
    tage: zeilen,
    verpflegungCents: verpflegung,
    fahrtCents: fahrt,
    uebernachtungCents: uebernachtung,
    gesamtCents: verpflegung + fahrt + uebernachtung,
  }
}

/**
 * Macht aus einer Datumsspanne die Tagesarten.
 *
 * Ein Tag: 'einzeln'. Zwei Tage: Anreise und Abreise, kein voller Tag
 * dazwischen. Drei und mehr: Anreise, Zwischentage, Abreise.
 */
export function tagesarten(von: string, bis: string): Array<{ datum: string; art: Tagesart }> {
  const start = Date.parse(`${String(von).slice(0, 10)}T00:00:00Z`)
  const ende = Date.parse(`${String(bis).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(ende) || ende < start) return []

  const anzahl = Math.round((ende - start) / 86_400_000) + 1
  const tage: Array<{ datum: string; art: Tagesart }> = []
  for (let i = 0; i < anzahl; i++) {
    const datum = new Date(start + i * 86_400_000).toISOString().slice(0, 10)
    const art: Tagesart = anzahl === 1
      ? 'einzeln'
      : i === 0 ? 'anreise' : i === anzahl - 1 ? 'abreise' : 'zwischentag'
    tage.push({ datum, art })
  }
  return tage
}
