import { describe, it, expect } from 'vitest'
import { baueUeberschrift, leseUeberschrift, mitUeberschrift } from '../lib/szenenUeberschrift'

/**
 * Die Szenenüberschrift.
 *
 * Gemeldet am 24.10.2026: "beim Export wird nicht jede Szene mit
 * Exterior-Interior reingepackt". Nachgemessen stimmte das - und die Ursache
 * war nicht der Satz, sondern die Herkunft der Überschrift. Jede neu
 * angelegte Szene bekam einen leeren Aktionsblock mit. Damit galt sie als
 * "hat Blöcke", und die Ergänzung aus dem Datensatz, die es nur für ganz
 * leere Szenen gab, griff nicht mehr. Die Szene stand ohne INT/EXT, ohne
 * Titel und ohne Tageszeit im Drehbuch.
 */

describe('baueUeberschrift', () => {
  it('setzt die Zeile aus den Feldern der Szene', () => {
    expect(baueUeberschrift({ int_ext: 'INT', title: 'Wohnküche', day_night: 'NACHT' }))
      .toBe('INT. WOHNKÜCHE - NACHT')
  })

  it('nimmt die Szenennummer, wenn kein Titel da ist', () => {
    // "INT. - TAG" waere im gesetzten Drehbuch schlimmer als ein Platzhalter.
    expect(baueUeberschrift({ scene_number: '7', int_ext: 'EXT', day_night: 'TAG' }))
      .toBe('EXT. SZENE 7 - TAG')
  })

  it('kommt ohne Tageszeit aus', () => {
    expect(baueUeberschrift({ int_ext: 'INT/EXT', title: 'Auto', day_night: '' }))
      .toBe('INT/EXT. AUTO')
  })
})

describe('leseUeberschrift', () => {
  it('zerlegt die Standardform', () => {
    expect(leseUeberschrift('INT. WOHNKÜCHE - NACHT'))
      .toEqual({ int_ext: 'INT', title: 'WOHNKÜCHE', day_night: 'NACHT' })
  })

  it('erkennt Innen und Außen auch deutsch', () => {
    expect(leseUeberschrift('AUSSEN HINTERHOF - NACHT')?.int_ext).toBe('EXT')
    expect(leseUeberschrift('INNEN TREPPENHAUS - TAG')?.int_ext).toBe('INT')
  })

  it('erkennt die gemischte Form vor der einfachen', () => {
    // "INT/EXT" darf nicht als "INT" durchgehen - sonst faellt das EXT weg.
    expect(leseUeberschrift('INT/EXT. AUTO - TAG')?.int_ext).toBe('INT/EXT')
    expect(leseUeberschrift('I/E. AUTO - TAG')?.int_ext).toBe('INT/EXT')
  })

  it('bringt englische Tageszeiten auf die Werte der Oberfläche', () => {
    // Sonst steht in der Szene "DAY", und kein Filter im Drehplan trifft es.
    expect(leseUeberschrift('INT. HAFEN - DAY')?.day_night).toBe('TAG')
    expect(leseUeberschrift('EXT. HAFEN - NIGHT')?.day_night).toBe('NACHT')
  })

  it('nimmt den letzten Trenner, nicht den ersten', () => {
    expect(leseUeberschrift('INT. BÜRO - FLUR - NACHT'))
      .toEqual({ int_ext: 'INT', title: 'BÜRO - FLUR', day_night: 'NACHT' })
  })

  it('versteht die erzwungene Form aus Fountain', () => {
    expect(leseUeberschrift('.INT. KELLER - TAG')?.title).toBe('KELLER')
  })

  it('lässt die Finger von allem, was keine Überschrift ist', () => {
    // Lieber nichts übernehmen als die Szene mit Unsinn überschreiben.
    expect(leseUeberschrift('Lena sitzt am Tisch.')).toBeNull()
    expect(leseUeberschrift('')).toBeNull()
  })
})

describe('mitUeberschrift', () => {
  const szene = { scene_number: '3', title: 'Hinterhof', int_ext: 'EXT', day_night: 'NACHT' }

  it('lässt eine vorhandene Überschrift unangetastet', () => {
    const bloecke = [
      { block_type: 'scene_heading', content: 'EXT. HINTERHOF - NACHT' },
      { block_type: 'action', content: 'Ein Falter kreist.' },
    ]
    expect(mitUeberschrift(szene, bloecke)).toBe(bloecke)
  })

  it('ergänzt sie, wenn die Szene nur einen Aktionsblock hat', () => {
    // Genau dieser Fall liess die Szene aus dem Export fallen: Eine frisch
    // angelegte Szene bekam einen leeren Aktionsblock mit.
    const ergebnis = mitUeberschrift(szene, [{ block_type: 'action', content: '' }])
    expect(ergebnis[0]).toEqual({ block_type: 'scene_heading', content: 'EXT. HINTERHOF - NACHT' })
    expect(ergebnis).toHaveLength(2)
  })

  it('ersetzt eine leere Überschrift, statt eine zweite davorzusetzen', () => {
    const ergebnis = mitUeberschrift(szene, [
      { block_type: 'scene_heading', content: '   ' },
      { block_type: 'action', content: 'Text.' },
    ])
    expect(ergebnis).toHaveLength(2)
    expect(ergebnis[0].content).toBe('EXT. HINTERHOF - NACHT')
  })

  it('ergänzt sie auch bei einer ganz leeren Szene', () => {
    expect(mitUeberschrift(szene, [])).toEqual([
      { block_type: 'scene_heading', content: 'EXT. HINTERHOF - NACHT' },
    ])
  })
})

describe('Hin und zurück', () => {
  it('überlebt den Weg durch beide Richtungen', () => {
    // Der Editor schreibt die Zeile, der Datensatz folgt, der Export baut sie
    // wieder - dabei darf nichts verlorengehen.
    const gelesen = leseUeberschrift('EXT. HAFEN - NACHT')!
    expect(baueUeberschrift(gelesen)).toBe('EXT. HAFEN - NACHT')
  })
})
