/**
 * Dauern aus Drehzeiten.
 *
 * Anlass: am 26.09.2026 ergab ein Nachtdreh von 18:00 bis 02:00 in der
 * Zeitanalyse 0 Minuten Drehzeit - acht Stunden verschwanden. Die
 * Turnaround-Prüfung rechnete im selben Fall 32 Stunden Ruhezeit statt acht
 * und meldete die Verletzung deshalb nicht.
 */
import { describe, it, expect } from 'vitest'
import { dauer, nettoDrehzeit, ruhezeit } from '../lib/drehzeit'

const uhr = (h: number, m = 0) => h * 60 + m

describe('dauer', () => {
  it('rechnet einen normalen Drehtag', () => {
    expect(dauer(uhr(8), uhr(20))).toBe(720)
  })

  it('trägt den Tageswechsel - der eigentliche Befund', () => {
    // 18:00 bis 02:00 sind acht Stunden, nicht minus sechzehn
    expect(dauer(uhr(18), uhr(2))).toBe(480)
  })

  it('zählt gleiche Uhrzeit als null, nicht als 24 Stunden', () => {
    // Ein Drehschluss zur Call-Zeit ist ein abgesagter Tag, kein Tagesdreh
    expect(dauer(uhr(8), uhr(8))).toBe(0)
  })

  it('gibt ohne Zeit keine Dauer, statt null Minuten zu behaupten', () => {
    expect(dauer(null, uhr(20))).toBeNull()
    expect(dauer(uhr(8), undefined)).toBeNull()
    expect(dauer('', uhr(20))).toBeNull()      // Number('') wäre 0
    expect(dauer('quatsch', uhr(20))).toBeNull()
  })

  it('nimmt Zahlen als Text an, wie sie aus der Datenbank kommen', () => {
    expect(dauer('1080', '120')).toBe(480)
  })
})

describe('nettoDrehzeit', () => {
  it('zieht die Pause ab', () => {
    expect(nettoDrehzeit(uhr(8), uhr(20), uhr(13), uhr(14))).toBe(660)
  })

  it('zieht eine Pause ab, die selbst über Mitternacht geht', () => {
    // Nachtdreh 18:00-02:00, Pause 23:30-00:15
    expect(nettoDrehzeit(uhr(18), uhr(2), uhr(23, 30), uhr(0, 15))).toBe(480 - 45)
  })

  it('ohne Pause bleibt die Bruttozeit', () => {
    expect(nettoDrehzeit(uhr(18), uhr(2))).toBe(480)
    expect(nettoDrehzeit(uhr(18), uhr(2), null, null)).toBe(480)
  })

  it('ignoriert eine Pause, die länger dauert als der Dreh', () => {
    // Tippfehler in den Pausenzeiten darf keine negative Drehzeit ergeben
    expect(nettoDrehzeit(uhr(8), uhr(12), uhr(13), uhr(20))).toBe(240)
  })

  it('ohne Zeiten keine Drehzeit', () => {
    expect(nettoDrehzeit(null, uhr(20))).toBeNull()
  })
})

describe('ruhezeit', () => {
  it('rechnet über die Nacht bis zum Call am Folgetag', () => {
    // Wrap 22:00, Call am nächsten Tag 08:00 = 10 Stunden
    expect(ruhezeit(uhr(22), uhr(8), uhr(8))).toBe(600)
  })

  it('erkennt einen Wrap nach Mitternacht - der zweite Befund', () => {
    // Nachtdreh: Call 18:00, Wrap 02:00, nächster Call 10:00 = 8 Stunden.
    // Die alte Rechnung (24h - 02:00) + 10:00 ergab 32 Stunden.
    expect(ruhezeit(uhr(2), uhr(18), uhr(10))).toBe(480)
  })

  it('meldet keine Ruhezeit, wenn eine Zeit fehlt', () => {
    expect(ruhezeit(null, uhr(8), uhr(8))).toBeNull()
    expect(ruhezeit(uhr(22), uhr(8), null)).toBeNull()
  })

  it('kommt ohne den Call des Drehtags aus', () => {
    // Fällt der Tagesbericht weg, bleibt die Rechnung über die Nacht
    expect(ruhezeit(uhr(22), null, uhr(8))).toBe(600)
  })
})
