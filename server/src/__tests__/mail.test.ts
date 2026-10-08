import { describe, it, expect } from 'vitest'
import {
  platzhalterIn,
  fehlendeWerte,
  fuelleVorlage,
  textZuHtml,
  saeubereHtml,
  maskiere,
  STANDARDVORLAGEN,
  PLATZHALTER,
} from '../lib/mailvorlagen'
import { wartezeitMinuten, istAdresse, MAX_VERSUCHE } from '../lib/mailversand'

describe('Platzhalter in Vorlagen', () => {
  it('findet jeden Platzhalter genau einmal', () => {
    const text = 'Hallo {{vorname}}, dein Call ist {{call}}. Bis dann, {{vorname}}.'
    expect(platzhalterIn(text)).toEqual(['vorname', 'call'])
  })

  it('verträgt Leerzeichen in den Klammern', () => {
    expect(platzhalterIn('{{ call }}')).toEqual(['call'])
    expect(fuelleVorlage('{{ call }}', { call: '06:30' })).toBe('06:30')
  })

  it('setzt Werte ein und lässt fehlende leer, statt die Klammern zu zeigen', () => {
    const text = 'Hallo {{vorname}}, Motiv {{motiv}}.'
    expect(fuelleVorlage(text, { vorname: 'Sarah' })).toBe('Hallo Sarah, Motiv .')
  })

  it('meldet fehlende Werte, damit vor dem Versand gewarnt werden kann', () => {
    const text = 'Hallo {{vorname}}, Call {{call}}, Motiv {{motiv}}.'
    expect(fehlendeWerte(text, { vorname: 'Sarah', call: '' })).toEqual(['call', 'motiv'])
  })

  it('kennt zu jedem Platzhalter der Standardvorlagen einen Eintrag in der Liste', () => {
    const bekannt = new Set(PLATZHALTER.map(p => p.schluessel))
    for (const vorlage of STANDARDVORLAGEN) {
      for (const schluessel of platzhalterIn(`${vorlage.betreff} ${vorlage.text}`)) {
        expect(bekannt.has(schluessel), `${vorlage.name}: {{${schluessel}}}`).toBe(true)
      }
    }
  })

  it('hält die Regel ein: Bindestrich, kein Gedankenstrich', () => {
    for (const vorlage of STANDARDVORLAGEN) {
      expect(`${vorlage.betreff} ${vorlage.text}`).not.toMatch(/[–—]/)
    }
  })
})

describe('Text zu Mail-HTML', () => {
  it('macht aus Leerzeilen Absätze und aus Umbrüchen Zeilenumbrüche', () => {
    const html = textZuHtml('Zeile eins\nZeile zwei\n\nNeuer Absatz')
    expect(html).toContain('Zeile eins<br>Zeile zwei')
    expect((html.match(/<p /g) || []).length).toBe(2)
  })

  it('maskiert spitze Klammern aus dem Eingabefeld', () => {
    expect(textZuHtml('<b>fett</b>')).toContain('&lt;b&gt;fett&lt;/b&gt;')
  })

  it('maskiert Anführungszeichen und kaufmännisches Und', () => {
    expect(maskiere('Kamera & "Ton"')).toBe('Kamera &amp; &quot;Ton&quot;')
  })
})

describe('HTML säubern', () => {
  it('wirft Skripte raus', () => {
    expect(saeubereHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>')
  })

  it('entfernt Ereignis-Attribute in jeder Schreibweise', () => {
    expect(saeubereHtml('<img src="x" onerror="boom()">')).not.toContain('onerror')
    expect(saeubereHtml("<img src='x' ONLOAD='boom()'>")).not.toContain('ONLOAD')
    expect(saeubereHtml('<img src=x onerror=boom()>')).not.toContain('onerror')
  })

  it('entschärft javascript:-Verweise', () => {
    expect(saeubereHtml('<a href="javascript:boom()">klick</a>')).not.toContain('javascript:')
  })

  it('lässt normales Mail-HTML in Ruhe', () => {
    const html = '<p style="color:#111">Hallo <strong>Welt</strong></p>'
    expect(saeubereHtml(html)).toBe(html)
  })
})

describe('Warteschlange', () => {
  it('wartet nach jedem Fehlversuch länger', () => {
    const folge = [1, 2, 3, 4, 5].map(wartezeitMinuten)
    expect(folge).toEqual([1, 5, 15, 60, 60])
    for (let i = 1; i < folge.length; i++) {
      expect(folge[i]).toBeGreaterThanOrEqual(folge[i - 1])
    }
  })

  it('gibt nach einer endlichen Zahl von Versuchen auf', () => {
    expect(MAX_VERSUCHE).toBeGreaterThan(1)
    expect(MAX_VERSUCHE).toBeLessThanOrEqual(10)
  })

  it('erkennt brauchbare Adressen', () => {
    expect(istAdresse('sarah@beispiel.de')).toBe(true)
    expect(istAdresse('a.b-c+d@sub.beispiel.co.uk')).toBe(true)
  })

  it('weist alles zurück, was keine einzelne Adresse ist', () => {
    for (const wert of ['', 'sarah', 'sarah@', '@beispiel.de', 'a@b', 'a@b.de, c@d.de', 'a@b.de;c@d.de', 'Sarah <a@b.de>']) {
      expect(istAdresse(wert), wert).toBe(false)
    }
  })
})
