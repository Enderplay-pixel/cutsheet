import { describe, it, expect } from 'vitest'
import {
  ARTEN, STANDARDVORLAGEN, VERTRAGS_PLATZHALTER,
  platzhalterIn, fehlendeWerte, fuelleVorlage, euroText, datumText,
} from '../lib/vertraege'

/**
 * Verträge und ihre Platzhalter.
 *
 * Der Fehler, der hier wehtut, ist leise: ein Platzhalter, der nicht ersetzt
 * wird. Dann steht im verschickten Vertrag "Gage: {{gage}}" oder, schlimmer,
 * "Gage: " - und das Blatt ist raus, bevor es jemand liest.
 */

describe('Platzhalter', () => {
  it('findet jeden Platzhalter einmal', () => {
    const text = 'Hallo {{name}}, du spielst {{rolle}} in {{projekt}}. Bis bald, {{name}}.'
    expect(platzhalterIn(text)).toEqual(['name', 'rolle', 'projekt'])
  })

  it('erträgt Leerzeichen in den Klammern', () => {
    expect(platzhalterIn('{{ name }} und {{rolle}}')).toEqual(['name', 'rolle'])
  })

  it('hält einfache Klammern für Text, nicht für Platzhalter', () => {
    expect(platzhalterIn('{name} ist kein Platzhalter')).toEqual([])
  })

  it('ersetzt und lässt nichts stehen', () => {
    const text = 'Hallo {{ name }}, Gage {{gage}}.'
    expect(fuelleVorlage(text, { name: 'Mila', gage: '450,00 €' }))
      .toBe('Hallo Mila, Gage 450,00 €.')
    // Was keinen Wert hat, wird leer - nicht die Klammern. Ein verschickter
    // Vertrag mit sichtbaren Klammern ist peinlich, einer mit einer Luecke
    // ist nur unvollstaendig. Deshalb prueft `fehlendeWerte` vorher.
    expect(fuelleVorlage(text, { name: 'Mila' })).toBe('Hallo Mila, Gage .')
  })

  it('nennt die Platzhalter ohne Wert', () => {
    const text = '{{name}} spielt {{rolle}} für {{gage}}.'
    expect(fehlendeWerte(text, { name: 'Mila', rolle: '', gage: '450,00 €' }))
      .toEqual(['rolle'])
    expect(fehlendeWerte(text, { name: 'Mila' })).toEqual(['rolle', 'gage'])
    expect(fehlendeWerte(text, { name: 'M', rolle: 'R', gage: 'G' })).toEqual([])
  })
})

describe('Mitgelieferte Vorlagen', () => {
  it('deckt jede Vertragsart ab', () => {
    for (const art of ARTEN) {
      expect(
        STANDARDVORLAGEN.some((v) => v.kind === art.art),
        `Keine Vorlage für ${art.name}`
      ).toBe(true)
    }
  })

  it('benutzt nur Platzhalter, die es wirklich gibt', () => {
    // Ein Tippfehler im Vorlagentext - {{gagen}} statt {{gage}} - bliebe sonst
    // unbemerkt, bis der erste Vertrag mit einer Luecke rausgeht.
    const bekannt = VERTRAGS_PLATZHALTER.map((p) => p.schluessel)
    for (const vorlage of STANDARDVORLAGEN) {
      for (const schluessel of platzhalterIn(vorlage.body)) {
        expect(bekannt, `${vorlage.name} nutzt {{${schluessel}}}`).toContain(schluessel)
      }
    }
  })

  it('kennzeichnet sich als Entwurf', () => {
    // Niemand soll glauben, hier liege ein geprüfter Vertrag. Der Hinweis
    // steht an der Vorlage und wird in der Oberfläche angezeigt.
    for (const vorlage of STANDARDVORLAGEN) {
      expect(vorlage.hinweis, vorlage.name).toContain('keine Rechtsberatung')
      expect(vorlage.name).toContain('Entwurf')
    }
  })

  it('nennt im Einverständnis für Kinder die gesetzlichen Grenzen', () => {
    const v = STANDARDVORLAGEN.find((x) => x.kind === 'einverstaendnis_kind')!
    // Die Zahlen aus § 6 Abs. 1 Nr. 2 JArbSchG müssen im Formular stehen -
    // sonst unterschreibt jemand, ohne zu wissen, worauf.
    expect(v.body).toContain('§ 6')
    expect(v.body).toContain('zwei Stunden')
    expect(v.body).toContain('drei Stunden')
    expect(v.body).toContain('8 und 17 Uhr')
    expect(v.body).toContain('8 und 22 Uhr')
  })

  it('regelt in jedem Vertrag die Nutzungsrechte', () => {
    // Der eine Punkt, dessen Fehlen eine Produktion später unverwertbar macht.
    for (const vorlage of STANDARDVORLAGEN) {
      const text = vorlage.body.toLowerCase()
      expect(
        text.includes('nutzungsrecht') || text.includes('einwillig') || text.includes('genutzt'),
        `${vorlage.name} sagt nichts zur Verwertung`
      ).toBe(true)
    }
  })

  it('lässt sich mit vollständigen Werten lückenlos füllen', () => {
    const werte = Object.fromEntries(
      VERTRAGS_PLATZHALTER.map((p) => [p.schluessel, p.beispiel])
    ) as Record<string, string>
    for (const vorlage of STANDARDVORLAGEN) {
      expect(fehlendeWerte(vorlage.body, werte), vorlage.name).toEqual([])
      const gefuellt = fuelleVorlage(vorlage.body, werte)
      expect(gefuellt, vorlage.name).not.toContain('{{')
    }
  })
})

describe('Darstellung von Beträgen und Daten', () => {
  it('schreibt Euro deutsch', () => {
    // Intl setzt ein geschuetztes Leerzeichen (U+00A0) vor das Eurozeichen.
    // Welches genau, haengt von der ICU-Fassung ab - der Test soll die
    // Formatierung pruefen, nicht die Node-Version.
    const ohneNbsp = (t: string) => t.replace(/ /g, ' ')
    expect(ohneNbsp(euroText(45_000))).toBe('450,00 €')
    expect(ohneNbsp(euroText(0))).toBe('0,00 €')
    expect(ohneNbsp(euroText(270_000))).toBe('2.700,00 €')
  })

  it('schreibt Datum deutsch und verschiebt den Tag nicht', () => {
    // Der Klassiker: Ein Datum ohne Zeit wird als Mitternacht UTC gelesen und
    // rutscht in Deutschland auf den Vortag. Deshalb wird mittags gerechnet.
    expect(datumText('2026-10-12')).toBe('12.10.2026')
    expect(datumText('2026-01-01')).toBe('01.01.2026')
    expect(datumText('2026-12-31')).toBe('31.12.2026')
    expect(datumText(null)).toBe('')
  })
})
