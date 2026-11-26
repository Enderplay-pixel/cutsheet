import { describe, it, expect } from 'vitest'
import { fahrtenAusAbholungen, verschiebeZeiten, fahrtHinweise, szenenZeitplan } from '../lib/fahrdispo'

describe('Fahrdispo und Zeiten der Dispo (AP E7)', () => {
  it('Fahrten aus den Abholungen: gleiche Zeit und gleicher Ort werden eine Fahrt', () => {
    const f = fahrtenAusAbholungen([
      { id: 1, pickup_time: 345, pickup_location: 'Hotel Friesenhof' },
      { id: 2, pickup_time: 345, pickup_location: ' hotel friesenhof ' },
      { id: 3, pickup_time: 375, pickup_location: 'Hotel Friesenhof' },
      { id: 4, pickup_time: null, pickup_location: 'Bahnhof' },
    ])
    expect(f.map((x) => [x.depart_time, x.eintraege])).toEqual([[345, [1, 2]], [375, [3]]])
  })

  it('verschiebt alle Zeiten, leere bleiben leer, Frühstück und Mittag mit 0 auch', () => {
    const { aenderungen, fehler } = verschiebeZeiten({
      general_call: 390, shooting_call: 420, breakfast_call: 0, lunch_call: 780, planned_wrap: null,
      entries: [{ id: 1, call_time: 390, pickup_time: 345, makeup_time: null }], rides: [{ id: 9, depart_time: 345 }],
    }, 30)
    expect(fehler).toBeNull()
    expect(aenderungen.map((a) => `${a.feld}:${a.alt}>${a.neu}`)).toEqual([
      'general_call:390>420', 'shooting_call:420>450', 'lunch_call:780>810', 'call_time:390>420', 'pickup_time:345>375', 'depart_time:345>375',
    ])
  })

  it('lehnt ab, wenn eine Zeit vor 00:00 oder nach 24:00 rutschen würde', () => {
    const vorne = verschiebeZeiten({ general_call: 20, shooting_call: 60, entries: [], rides: [] }, -30)
    expect(vorne).toEqual({ aenderungen: [], fehler: 'General Call 00:20 läge vor 00:00 - nichts verschoben' })
    const hinten = verschiebeZeiten({ general_call: 600, entries: [{ id: 1, lose_at: 1430 }], rides: [] }, 30)
    expect(hinten.fehler).toBe('Eine Zeit der Personen 23:50 läge nach 24:00 - nichts verschoben')
  })

  it('Hinweise: dasselbe Fahrzeug zweimal zur selben Abfahrt, mehr Mitfahrende als Plätze', () => {
    const h = fahrtHinweise([
      { id: 1, vehicle_id: 5, depart_time: 345, mitfahrende: 3 },
      { id: 2, vehicle_id: 5, depart_time: 345, mitfahrende: 1 },
      { id: 3, vehicle_id: 6, depart_time: 345, mitfahrende: 2 },
    ], new Map([[5, 2], [6, 4]]))
    expect(h.get(1)).toEqual(['Das Fahrzeug fährt um 05:45 schon eine andere Fahrt', '3 Mitfahrende, das Fahrzeug hat 2 Plätze'])
    expect(h.get(2)).toEqual(['Das Fahrzeug fährt um 05:45 schon eine andere Fahrt'])
    expect(h.has(3)).toBe(false)
  })

  it('Zeitplan der Szenen ab Shooting Call, Banner zählen, eine Zeit von Hand gilt weiter', () => {
    const plan = szenenZeitplan(480, [
      { art: 'szene', id: 1, minuten: 90 },
      { art: 'banner', id: 7, minuten: 30 },
      { art: 'szene', id: 2, minuten: 60 },
      { art: 'szene', id: 3, minuten: 45, von_hand: 840 },
      { art: 'szene', id: 4, minuten: 30 },
    ], 780)
    expect(plan.map((p) => [p.id, p.beginn, p.von_hand, p.mittag_davor])).toEqual([
      [1, 480, false, false], [7, 570, false, false], [2, 600, false, false], [3, 840, true, true], [4, 885, false, false],
    ])
  })
})
