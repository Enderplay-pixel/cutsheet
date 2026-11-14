import { describe, it, expect } from 'vitest'
import { ordneZu, naechsteNummer, farbeFuer, fassungsName, vergleiche } from '../lib/fassungen'

/**
 * Drehbuch-Fassungen mit gesperrten Nummern (Plan Kino-Ausbau, AP A3): die
 * reinen Rechnungen hinter "Als neue Fassung einlesen".
 */

const szene = (nummer: string, kopf: string, ...zeilen: string[]) => ({ nummer, kopf, zeilen })
const da = (id: number, nummer: string, kopf: string, ...zeilen: string[]) => ({ id, nummer, kopf, zeilen })
const nummern = (liste: Array<{ alt?: { nummer: string }; neu?: { nummer: string } }>) =>
  liste.map((x) => (x.alt ?? x.neu)!.nummer)

describe('ordneZu: alte und neue Szenen einander zuordnen', () => {
  const vorhanden = [
    da(1, '1', 'INT. KÜCHE - TAG', 'Mara kocht.'),
    da(2, '2', 'EXT. HOF - NACHT', 'Ole raucht.'),
    da(3, '3', 'INT. FLUR - TAG', 'Jemand klingelt.'),
  ]

  it('nach Nummer, wenn jede Szene der Datei eine trägt', () => {
    const z = ordneZu(vorhanden, [
      szene('1', 'INT. KÜCHE - TAG', 'Mara kocht.'),
      szene('2', 'EXT. HOF - NACHT', 'Ole raucht nicht mehr.'),
      szene('4', 'EXT. STRASSE - TAG', 'Ein Bus fährt vorbei.'),
    ])
    expect(nummern(z.unveraendert)).toEqual(['1'])
    expect(nummern(z.geaendert)).toEqual(['2'])
    expect(z.neu.map((n) => [n.neu.nummer, n.nach])).toEqual([['4', 2]])
    expect(z.fehlt.map((f) => f.nummer)).toEqual(['3'])
  })

  it('nach Überschrift und Vorkommen, wenn Nummern fehlen', () => {
    const doppelt = [
      da(1, '1', 'INT. KÜCHE - TAG', 'Erstes Frühstück.'),
      da(2, '2', 'EXT. HOF - NACHT', 'Ole raucht.'),
      da(3, '3', 'INT. KÜCHE - TAG', 'Zweites Frühstück.'),
    ]
    const z = ordneZu(doppelt, [
      szene('', 'INT. KÜCHE - TAG', 'Erstes Frühstück.'),
      szene('', 'INT. KÜCHE - TAG', 'Zweites Frühstück.'),
      szene('', 'EXT. HOF - NACHT', 'Ole raucht.'),
    ])
    expect(z.unveraendert.map((u) => u.alt.id)).toEqual([1, 3, 2])
    expect(z.geaendert).toEqual([])
    expect(z.neu).toEqual([])
    expect(z.fehlt).toEqual([])
  })

  it('eine neue Szene ohne Nummer steht hinter der zugeordneten davor', () => {
    const z = ordneZu(vorhanden, [
      szene('', 'INT. KÜCHE - TAG', 'Mara kocht.'),
      szene('', 'INT. KELLER - NACHT', 'Neu.'),
      szene('', 'EXT. HOF - NACHT', 'Ole raucht.'),
      szene('', 'INT. FLUR - TAG', 'Jemand klingelt.'),
    ])
    expect(z.neu.map((n) => [n.neu.kopf, n.nach])).toEqual([['INT. KELLER - NACHT', 1]])
    expect(z.unveraendert.length).toBe(3)
  })

  it('Leerzeichen allein sind keine Änderung', () => {
    const z = ordneZu([da(1, '1', 'INT.  KÜCHE - TAG', 'Mara  kocht. ')], [szene('1', 'INT. KÜCHE - TAG', 'Mara kocht.')])
    expect(z.unveraendert.length).toBe(1)
  })

  it('eine entfallene Szene kommt zurück, wenn die Datei sie wieder hat, und fehlt sonst nicht', () => {
    const mitEntfallen = [...vorhanden, { ...da(7, '7', 'INT. BAD - TAG', 'Weg.'), omitted: true }]
    const zurueck = ordneZu(mitEntfallen, [szene('7', 'INT. BAD - TAG', 'Weg.')])
    expect(nummern(zurueck.geaendert)).toEqual(['7'])
    const ohne = ordneZu(mitEntfallen, [szene('1', 'INT. KÜCHE - TAG', 'Mara kocht.')])
    expect(ohne.fehlt.map((f) => f.nummer)).toEqual(['2', '3'])
  })
})

describe('naechsteNummer: Szenen im gesperrten Drehbuch', () => {
  it('Nummer davor plus den nächsten freien Buchstaben', () => {
    expect(naechsteNummer('13', ['12', '13', '14'])).toBe('13A')
    expect(naechsteNummer('13', ['13', '13A', '14'])).toBe('13B')
  })
  it('hinter einer Buchstabennummer der nächste Buchstabe, sonst ein zweiter Buchstabe', () => {
    expect(naechsteNummer('13A', ['13', '13A', '14'])).toBe('13B')
    expect(naechsteNummer('13A', ['13', '13A', '13B', '14'])).toBe('13AA')
  })
  it('vor der ersten Szene: A plus deren Nummer', () => {
    expect(naechsteNummer(null, ['1', '2'], '1')).toBe('A1')
    expect(naechsteNummer(null, ['A1', '1', '2'], '1')).toBe('B1')
  })
  it('vergleicht ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    expect(naechsteNummer('13', ['13', '13a'])).toBe('13B')
  })
})

describe('Farben der Fassungen', () => {
  it('folgen der Reihe der Branche, danach "Zweite Blaue"', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(farbeFuer)).toEqual(
      ['weiss', 'blau', 'rosa', 'gelb', 'gruen', 'goldgelb', 'chamois', 'lachs', 'kirschrot'])
    expect(farbeFuer(9)).toBe('blau-2')
    // Nach Weiß acht Farben je Runde: 9 bis 16 ist die zweite
    expect(farbeFuer(16)).toBe('kirschrot-2')
    expect(farbeFuer(17)).toBe('blau-3')
  })
  it('haben einen Namen für Kopfzeile und Liste', () => {
    expect(fassungsName('weiss')).toBe('Weiße Fassung')
    expect(fassungsName('blau')).toBe('Blaue Fassung')
    expect(fassungsName('blau-2')).toBe('Zweite Blaue Fassung')
    expect(fassungsName('chamois-3')).toBe('Dritte Chamois-Fassung')
  })
})

describe('vergleiche: alt gegen neu, zeilenweise', () => {
  it('nennt gleiche, weggefallene und neue Zeilen in Reihenfolge', () => {
    expect(vergleiche(['a', 'b', 'c'], ['a', 'x', 'c']).map((z) => `${z.art}:${z.zeile}`))
      .toEqual(['gleich:a', 'weg:b', 'neu:x', 'gleich:c'])
  })
  it('merkt sich, welche alte Zeile zu welcher neuen gehört', () => {
    const z = vergleiche(['eins', 'zwei'], ['null', 'eins', 'zwei'])
    expect(z.filter((x) => x.art === 'gleich').map((x) => [x.alt, x.neu])).toEqual([[0, 1], [1, 2]])
  })
  it('kommt mit leeren Seiten zurecht', () => {
    expect(vergleiche([], ['a']).map((z) => z.art)).toEqual(['neu'])
    expect(vergleiche(['a'], []).map((z) => z.art)).toEqual(['weg'])
  })
})
