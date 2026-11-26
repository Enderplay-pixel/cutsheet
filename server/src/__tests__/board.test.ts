import { describe, it, expect } from 'vitest'
import { teileEin, arbeitstageAb, wochentageAus, folgetageVerschieben, seitenAmTag, teileGanz, tagesart } from '../lib/board'
import { getHolidays } from '../services/holidays'

/**
 * Das Board des Stäbchenplans (Plan Kino-Ausbau, AP A2): Strips auf Tage
 * verteilen und Arbeitstage finden. Beides ist reine Rechnung - die Route
 * schreibt nur, was hier herauskommt.
 */

const strip = (id: number, achtel: number, minuten = 0) => ({ id, achtel, minuten })
const ids = (tage: { id: number }[][]) => tage.map((t) => t.map((s) => s.id))

describe('teileEin: Strips der Ablage auf Tage', () => {
  it('füllt einen Tag bis zur Grenze in Achteln, dann den nächsten', () => {
    // fünf Szenen zu je einer Seite, höchstens vier Seiten je Tag
    const tage = teileEin([1, 2, 3, 4, 5].map((i) => strip(i, 8)), 32, 'achtel')
    expect(ids(tage)).toEqual([[1, 2, 3, 4], [5]])
  })

  it('rechnet nach Minuten, wenn danach gefragt ist', () => {
    const tage = teileEin([strip(1, 8, 60), strip(2, 8, 90), strip(3, 8, 30), strip(4, 8, 120)], 180, 'minuten')
    expect(ids(tage)).toEqual([[1, 2, 3], [4]])
  })

  it('gibt einem Strip, der größer ist als die Grenze, einen eigenen Tag', () => {
    const tage = teileEin([strip(1, 8), strip(2, 40), strip(3, 8)], 32, 'achtel')
    expect(ids(tage)).toEqual([[1], [2], [3]])
  })

  it('behält die Reihenfolge der Ablage', () => {
    const tage = teileEin([strip(9, 16), strip(3, 16), strip(7, 16)], 32, 'achtel')
    expect(ids(tage)).toEqual([[9, 3], [7]])
  })

  it('ergibt bei leerer Ablage keinen Tag', () => {
    expect(teileEin([], 32, 'achtel')).toEqual([])
  })
})

describe('arbeitstageAb: nur Arbeitstage des Projekts, ohne Feiertage', () => {
  const moBisFr = [1, 2, 3, 4, 5]

  it('überspringt das Wochenende', () => {
    // 20.11.2026 ist ein Freitag
    expect(arbeitstageAb('2026-11-20', 3, moBisFr, [])).toEqual(['2026-11-20', '2026-11-23', '2026-11-24'])
  })

  it('beginnt am nächsten Arbeitstag, wenn der Start keiner ist', () => {
    expect(arbeitstageAb('2026-11-21', 1, moBisFr, [])).toEqual(['2026-11-23'])
  })

  it('überspringt Feiertage des Bundeslands', () => {
    const feiertage = getHolidays(2026, 'NW').map((f) => f.date)
    // 25. und 26.12. sind Feiertage, dann kommt das Wochenende
    expect(arbeitstageAb('2026-12-24', 3, moBisFr, feiertage)).toEqual(['2026-12-24', '2026-12-28', '2026-12-29'])
  })

  it('nimmt eigene Wochentage, etwa Montag bis Samstag', () => {
    expect(arbeitstageAb('2026-11-20', 3, [1, 2, 3, 4, 5, 6], [])).toEqual(['2026-11-20', '2026-11-21', '2026-11-23'])
  })

  it('läuft ohne Wochentage nicht endlos, sondern ergibt nichts', () => {
    expect(arbeitstageAb('2026-11-20', 3, [], [])).toEqual([])
  })
})

describe('wochentageAus: die Einstellung work_weekdays lesen', () => {
  it('liest die Liste und sortiert sie', () => {
    expect(wochentageAus('5,1,3')).toEqual([1, 3, 5])
  })
  it('lässt Unsinn und Doppeltes weg', () => {
    expect(wochentageAus('1,1,8,x,0,7')).toEqual([1, 7])
  })
})

describe('folgetageVerschieben: jeder Folgetag rückt um einen Arbeitstag', () => {
  const moBisFr = [1, 2, 3, 4, 5]

  it('schiebt jeden Tag auf den nächsten Arbeitstag', () => {
    // Di 17., Mi 18., Fr 20. - der neue Tag kommt auf den 17.
    expect(folgetageVerschieben(['2026-11-17', '2026-11-18', '2026-11-20'], '2026-11-17', moBisFr, []))
      .toEqual(['2026-11-18', '2026-11-19', '2026-11-23'])
  })

  it('legt zwei Wochenendtage nicht auf denselben Montag', () => {
    // Sa 21. und So 22. hätten beide den Montag als nächsten Arbeitstag
    expect(folgetageVerschieben(['2026-11-21', '2026-11-22'], '2026-11-20', moBisFr, []))
      .toEqual(['2026-11-23', '2026-11-24'])
  })
})

describe('Geteilte Szenen und Tagesarten (AP E6)', () => {
  it('ein Teil trägt seinen Anteil, leer heißt die ganze Szene', () => {
    expect([seitenAmTag(9, 16), seitenAmTag(null, 16), seitenAmTag(undefined, 16)]).toEqual([9, 16, 16])
  })

  it('erkennt, ob die Teile die ganze Szene ergeben', () => {
    expect(teileGanz([9, 7], 16)).toEqual({ summe: 16, ganz: true })
    expect(teileGanz([8, 7], 16)).toEqual({ summe: 15, ganz: false })
    // Ein Teil ohne Anteil zählt ganz - zwei solche sind doppelt
    expect(teileGanz([null, null], 16)).toEqual({ summe: 32, ganz: false })
  })

  it('Wochenende und Feiertag aus dem Datum, Nacht aus der Drehzeit der Szenen', () => {
    const feiertage = getHolidays(2026, 'NW').map((f) => f.date)
    expect(tagesart('2026-11-28', feiertage, [])).toEqual({ wochenende: true, feiertag: false, nacht: false })
    expect(tagesart('2026-12-25', feiertage, []).feiertag).toBe(true)
    expect(tagesart('2026-11-24', feiertage, [
      { day_night: 'NACHT', estimated_minutes: 120 }, { day_night: 'TAG', estimated_minutes: 60 },
    ]).nacht).toBe(true)
    // Genau die Hälfte ist kein Nachtdreh; Tag für Nacht zählt als Tag
    expect(tagesart('2026-11-24', feiertage, [
      { day_night: 'NACHT', estimated_minutes: 60 }, { day_night: 'TAG', estimated_minutes: 60 },
    ]).nacht).toBe(false)
    expect(tagesart('2026-11-24', feiertage, [
      { day_night: 'NACHT', day_for_night: true, estimated_minutes: 120 }, { day_night: 'TAG', estimated_minutes: 60 },
    ]).nacht).toBe(false)
  })
})
