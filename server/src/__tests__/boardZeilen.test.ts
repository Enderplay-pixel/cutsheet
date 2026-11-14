import { describe, it, expect } from 'vitest'
import {
  zeilenAus, zielAusStelle, zielBeimAblegen, zielEinenSchritt, verschobeneTage, eintraegeDesTags,
} from '../../../client/src/lib/boardZeilen'

/**
 * Das Board des Stäbchenplans im Client (Plan Kino-Ausbau, AP A2): Wohin
 * eine Auswahl kommt, wenn sie abgelegt oder mit Alt und Pfeil verschoben
 * wird. Die Logik liegt in `client/src/lib/boardZeilen.ts` ohne Abhängigkeiten
 * und wird hier geprüft, wie `beschriftungen.test.ts` Client-Dateien prüft.
 *
 * Plan für alle Fälle: Tag 1 mit Szenen 11, 12 und Banner 5, Tag 2 mit
 * Szene 21, Tag 3 leer, Ablage mit 31 und 32.
 */
const tage = [
  { id: 1, scenes: [{ scene_id: 11, sort_order: 0 }, { scene_id: 12, sort_order: 1 }], banner: [{ id: 5, sort_order: 2 }] },
  { id: 2, scenes: [{ scene_id: 21, sort_order: 0 }], banner: [] },
  { id: 3, scenes: [], banner: [] },
]
const zeilen = zeilenAus(tage, [31, 32])
const schluessel = (z: { key: string }[]) => z.map((x) => x.key)

describe('Zeilen des Boards', () => {
  it('stellt je Tag Szenen und Banner vor die Tagesgrenze, die Ablage ans Ende', () => {
    expect(schluessel(zeilen)).toEqual(['s-11', 's-12', 'b-5', 'g-1', 's-21', 'g-2', 'g-3', 'ablage', 's-31', 's-32'])
  })

  it('ordnet Szenen und Banner nach sort_order, bei Gleichstand die Szene zuerst', () => {
    const reihe = eintraegeDesTags({ id: 9, scenes: [{ scene_id: 1, sort_order: 1 }, { scene_id: 2, sort_order: 0 }], banner: [{ id: 7, sort_order: 0 }] })
    expect(reihe).toEqual([{ art: 'szene', id: 2 }, { art: 'banner', id: 7 }, { art: 'szene', id: 1 }])
  })
})

describe('zielAusStelle', () => {
  it('vor einer Szene oder einem Banner: in deren Tag davor', () => {
    expect(zielAusStelle(zeilen, 1)).toEqual({ zielTag: 1, vor: { art: 'szene', id: 12 } })
    expect(zielAusStelle(zeilen, 2)).toEqual({ zielTag: 1, vor: { art: 'banner', id: 5 } })
  })
  it('vor einer Tagesgrenze: ans Ende dieses Tags', () => {
    expect(zielAusStelle(zeilen, 3)).toEqual({ zielTag: 1, vor: null })
    expect(zielAusStelle(zeilen, 6)).toEqual({ zielTag: 3, vor: null })
  })
  it('vor dem Kopf der Ablage, in der Ablage und am Ende: Ablage', () => {
    for (const i of [7, 8, 10]) expect(zielAusStelle(zeilen, i), String(i)).toEqual({ zielTag: null, vor: null })
  })
})

describe('zielBeimAblegen', () => {
  const auswahl = new Set(['s-31'])
  it('obere Hälfte einer Szene: davor, untere Hälfte: dahinter', () => {
    expect(zielBeimAblegen(zeilen, auswahl, 's-12', false)).toEqual({ zielTag: 1, vor: { art: 'szene', id: 12 } })
    expect(zielBeimAblegen(zeilen, auswahl, 's-12', true)).toEqual({ zielTag: 1, vor: { art: 'banner', id: 5 } })
  })
  it('über eine Tagesgrenze gezogen wechselt die Szene den Tag', () => {
    // obere Hälfte der Grenze von Tag 1: ans Ende von Tag 1
    expect(zielBeimAblegen(zeilen, auswahl, 'g-1', false)).toEqual({ zielTag: 1, vor: null })
    // untere Hälfte: an den Anfang von Tag 2
    expect(zielBeimAblegen(zeilen, auswahl, 'g-1', true)).toEqual({ zielTag: 2, vor: { art: 'szene', id: 21 } })
    // unter der Grenze von Tag 2 liegt der leere Tag 3
    expect(zielBeimAblegen(zeilen, auswahl, 'g-2', true)).toEqual({ zielTag: 3, vor: null })
  })
  it('auf die eigene Auswahl abgelegt: nichts', () => {
    expect(zielBeimAblegen(zeilen, auswahl, 's-31', true)).toBeNull()
  })
})

describe('zielEinenSchritt: Alt und Pfeil', () => {
  it('hoch über eine Tagesgrenze: ans Ende des Tags davor', () => {
    expect(zielEinenSchritt(zeilen, new Set(['s-21']), -1)).toEqual({ zielTag: 1, vor: null })
  })
  it('runter über eine Tagesgrenze: an den Anfang des nächsten Tags', () => {
    expect(zielEinenSchritt(zeilen, new Set(['s-21']), 1)).toEqual({ zielTag: 3, vor: null })
  })
  it('innerhalb eines Tags eine Stelle weiter', () => {
    expect(zielEinenSchritt(zeilen, new Set(['s-11']), 1)).toEqual({ zielTag: 1, vor: { art: 'banner', id: 5 } })
    expect(zielEinenSchritt(zeilen, new Set(['s-12']), -1)).toEqual({ zielTag: 1, vor: { art: 'szene', id: 11 } })
  })
  it('aus der Ablage hoch: ans Ende des letzten Tags; ganz oben geht es nicht weiter', () => {
    expect(zielEinenSchritt(zeilen, new Set(['s-31']), -1)).toEqual({ zielTag: 3, vor: null })
    expect(zielEinenSchritt(zeilen, new Set(['s-11']), -1)).toBeNull()
  })
  it('vom letzten Tag runter: in die Ablage', () => {
    const mitLetztem = zeilenAus([{ id: 1, scenes: [{ scene_id: 11, sort_order: 0 }], banner: [] }], [31])
    expect(zielEinenSchritt(mitLetztem, new Set(['s-11']), 1)).toEqual({ zielTag: null, vor: null })
  })
})

describe('verschobeneTage: der Plan, bevor der Server antwortet', () => {
  it('setzt die Auswahl in ihrer Reihenfolge an die Stelle und zählt sort_order beider Tage neu', () => {
    const neu = verschobeneTage(tage, [31, 11], { zielTag: 2, vor: { art: 'szene', id: 21 } }, (id) => ({ scene_id: id, sort_order: 0 }))
    expect(eintraegeDesTags(neu[1])).toEqual([{ art: 'szene', id: 31 }, { art: 'szene', id: 11 }, { art: 'szene', id: 21 }])
    expect(neu[1].scenes.map((s: any) => s.sort_order)).toEqual([0, 1, 2])
    expect(eintraegeDesTags(neu[0])).toEqual([{ art: 'szene', id: 12 }, { art: 'banner', id: 5 }])
  })
  it('in die Ablage: aus allen Tagen heraus', () => {
    const neu = verschobeneTage(tage, [12, 21], { zielTag: null, vor: null }, (id) => ({ scene_id: id, sort_order: 0 }))
    expect(neu.flatMap((t: any) => t.scenes.map((s: any) => s.scene_id))).toEqual([11])
  })
})
