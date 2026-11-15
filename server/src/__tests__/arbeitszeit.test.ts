import { describe, it, expect } from 'vitest'
import { pruefeTag, pruefeRuhezeit, pruefeWoche, sonnFeiertag, zuschlaege, betrag, saetzeAus, wochenbeginn, freierTag } from '../lib/arbeitszeit'
import { getHolidays } from '../services/holidays'

/**
 * Arbeitszeit-Prüfung und Überstunden in Euro (Plan Kino-Ausbau, AP B3).
 * Minuten seit Mitternacht wie überall im Projekt.
 */

/** Ein Tag ab 07:00 mit `netto` Stunden Arbeit und 45 Minuten Pause. */
const tag = (netto: number, pause = 45) => ({ call: 420, wrap: (420 + Math.round(netto * 60) + pause) % 1440, pause })
const arten = (b: Array<{ art: string; quelle: string }>) => b.map((x) => `${x.art}:${x.quelle}`)

describe('pruefeTag: Arbeitszeit am Tag', () => {
  it('Gesetz: bis 10 Stunden nichts, darüber ein Verstoß gegen § 3', () => {
    expect(pruefeTag(tag(9), 'gesetz')).toEqual([])
    expect(pruefeTag(tag(10), 'gesetz')).toEqual([])
    expect(arten(pruefeTag(tag(10.5), 'gesetz'))).toEqual(['verstoss:§ 3 ArbZG'])
  })
  it('Tarifvertrag: über 10 Stunden zuschlagspflichtig, über 12 ein Verstoß', () => {
    expect(arten(pruefeTag(tag(10.5), 'tarif'))).toEqual(['zuschlag:TV FFS'])
    expect(arten(pruefeTag(tag(12), 'tarif'))).toEqual(['zuschlag:TV FFS'])
    expect(arten(pruefeTag(tag(12.5), 'tarif'))).toEqual(['verstoss:TV FFS'])
  })
  it('Pause: 20 Minuten bei 7 Stunden ist zu wenig (§ 4)', () => {
    const b = pruefeTag({ call: 420, wrap: 840, pause: 20 }, 'gesetz')
    expect(arten(b)).toEqual(['verstoss:§ 4 ArbZG'])
    expect(b[0].text).toMatch(/30 Minuten/)
  })
  it('die Meldung sagt "nach eingestellter Regel", nicht "rechtswidrig"', () => {
    const [b] = pruefeTag(tag(11), 'gesetz')
    expect(b.text).toMatch(/nach eingestellter Regel/)
    expect(b.text).not.toMatch(/rechtswidrig/i)
  })
})

describe('pruefeRuhezeit', () => {
  it('meldet 10,5 Stunden Ruhezeit als Verstoß gegen § 5', () => {
    // Drehschluss 22:30, nächster Call 09:00
    const b = pruefeRuhezeit(1350, 480, 540)
    expect(arten(b)).toEqual(['verstoss:§ 5 ArbZG'])
    expect(b[0].text).toMatch(/10,5 Stunden/)
  })
  it('11 Stunden sind genug', () => {
    expect(pruefeRuhezeit(1320, 480, 540)).toEqual([])
  })
})

describe('pruefeWoche', () => {
  const stunden = (h: number[]) => h.map((x) => x * 60)
  it('Tarifvertrag: über 50 Stunden zuschlagspflichtig, über 60 ein Verstoß', () => {
    expect(arten(pruefeWoche(stunden([11, 11, 10, 10, 10]), 'tarif'))).toEqual(['zuschlag:TV FFS'])
    expect(arten(pruefeWoche(stunden([12, 12, 12, 12, 13]), 'tarif'))).toEqual(['verstoss:TV FFS'])
  })
  it('Gesetz: keine Wochenprüfung', () => {
    expect(pruefeWoche(stunden([12, 12, 12, 12, 13]), 'gesetz')).toEqual([])
  })
  it('die Woche beginnt am Montag, auch vom Sonntag aus gesehen', () => {
    expect(wochenbeginn('2026-11-23')).toBe('2026-11-23')
    expect(wochenbeginn('2026-11-25')).toBe('2026-11-23')
    expect(wochenbeginn('2026-11-29')).toBe('2026-11-23')
    expect(wochenbeginn('2026-11-30')).toBe('2026-11-30')
    expect(wochenbeginn('kein Datum')).toBeNull()
  })
})

describe('freierTag: je 20 Drehtage ein bezahlter freier Tag', () => {
  it('Tarifvertrag: Hinweis mit Zählerstand am 20. und 40. Drehtag, sonst nichts', () => {
    expect(freierTag(19, 'tarif')).toEqual([])
    expect(arten(freierTag(20, 'tarif'))).toEqual(['hinweis:TV FFS'])
    expect(freierTag(20, 'tarif')[0].text).toMatch(/^20\. Drehtag dieser Person: .*damit einer/)
    expect(freierTag(21, 'tarif')).toEqual([])
    expect(freierTag(40, 'tarif')[0].text).toMatch(/damit 2 /)
  })
  it('Gesetz: kein Hinweis', () => {
    expect(freierTag(20, 'gesetz')).toEqual([])
  })
})

describe('Sonn- und Feiertage', () => {
  const feiertage = getHolidays(2026, 'NW').map((f) => f.date)
  it('Sonntag: Ersatzruhetag binnen zwei Wochen, unter Tarif zusätzlich zuschlagspflichtig', () => {
    expect(arten(sonnFeiertag('2026-11-15', feiertage, 'gesetz'))).toEqual(['hinweis:§ 11 Abs. 3 ArbZG'])
    expect(arten(sonnFeiertag('2026-11-15', feiertage, 'tarif'))).toEqual(['hinweis:§ 11 Abs. 3 ArbZG', 'zuschlag:TV FFS'])
    expect(sonnFeiertag('2026-11-15', feiertage, 'gesetz')[0].text).toMatch(/zwei Wochen/)
  })
  it('Feiertag aus dem Bundesland: Ersatzruhetag binnen acht Wochen', () => {
    const b = sonnFeiertag('2026-12-25', feiertage, 'gesetz')
    expect(b[0].text).toMatch(/acht Wochen/)
  })
  it('ein Werktag ohne Feiertag: nichts', () => {
    expect(sonnFeiertag('2026-11-17', feiertage, 'tarif')).toEqual([])
  })
})

describe('zuschlaege und betrag: Überstunden in Euro', () => {
  const opt = { stundenJeTagesgage: 10, nachtVon: 1380, nachtBis: 360 }
  it('zählt die Nachtstunden eines Drehs über Mitternacht (22 bis 6 Uhr, Nacht ab 23 Uhr)', () => {
    const m = zuschlaege({ call: 1320, wrap: 360, pause: 30, datum: '2026-11-17', feiertage: [] }, opt)
    expect(m.nacht).toBe(420)
  })
  it('12 Stunden unter Tarif bei 400 € Tagesgage: 40 € mal 1,25 plus 40 € mal 1,5', () => {
    const m = zuschlaege({ ...tag(12), datum: '2026-11-17', feiertage: [] }, opt)
    expect([m.elfte, m.ab_zwoelfte]).toEqual([60, 60])
    expect(betrag(m, 40000, 10, { elfte: 25, ab_zwoelfte: 50, nacht: 0, sonntag: 0, feiertag: 0 })).toBe(11000)
  })
  it('07:00 bis 19:00 mit 45 Minuten Pause: 75 Minuten über zehn Stunden', () => {
    const m = zuschlaege({ call: 420, wrap: 1140, pause: 45, datum: '2026-11-17', feiertage: [] }, opt)
    expect([m.elfte, m.ab_zwoelfte]).toEqual([60, 15])
    expect(betrag(m, 40000, 10, { elfte: 25, ab_zwoelfte: 50, nacht: 0, sonntag: 0, feiertag: 0 })).toBe(6500)
  })
  it('Sonntag und Feiertag zählen die ganze Arbeitszeit', () => {
    expect(zuschlaege({ ...tag(8), datum: '2026-11-15', feiertage: [] }, opt).sonntag).toBe(480)
    expect(zuschlaege({ ...tag(8), datum: '2026-12-25', feiertage: ['2026-12-25'] }, opt).feiertag).toBe(480)
  })
  it('ohne eingetragene Sätze zahlt die Überstunde den Stundensatz, Zuschläge 0', () => {
    const m = zuschlaege({ ...tag(12), datum: '2026-11-15', feiertage: [] }, opt)
    expect(betrag(m, 40000, 10, saetzeAus(''))).toBe(8000)
  })
})

describe('saetzeAus', () => {
  it('liest die fünf Sätze, Fehlendes und Unsinn ist 0', () => {
    expect(saetzeAus('{"elfte":25,"nacht":"x"}')).toEqual({ elfte: 25, ab_zwoelfte: 0, nacht: 0, sonntag: 0, feiertag: 0 })
    expect(saetzeAus('kein json')).toEqual({ elfte: 0, ab_zwoelfte: 0, nacht: 0, sonntag: 0, feiertag: 0 })
  })
})
