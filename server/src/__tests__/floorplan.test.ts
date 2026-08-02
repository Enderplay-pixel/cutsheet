import { describe, it, expect } from 'vitest'
import {
  ITEM_TYPES, itemType, clampPosition, normalizeRotation, clampSize,
  summarise, nextLabel, renderFloorplanHtml,
} from '../lib/floorplan'

describe('ITEM_TYPES', () => {
  it('enthaelt die Gewerke, die auf einem Set-Plan stehen', () => {
    const kinds = ITEM_TYPES.map(t => t.kind)
    for (const k of ['kamera', 'licht', 'ton', 'darsteller', 'tuer']) {
      expect(kinds).toContain(k)
    }
  })

  it('kennzeichnet nur Symbole mit Blickrichtung als gerichtet', () => {
    expect(itemType('kamera').directional).toBe(true)
    expect(itemType('licht').directional).toBe(true)
    expect(itemType('moebel').directional).toBe(false)
  })

  it('vergibt keine doppelten Kuerzel', () => {
    const kinds = ITEM_TYPES.map(t => t.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
  })
})

describe('itemType', () => {
  it('findet einen bekannten Typ', () => {
    expect(itemType('licht').label).toBe('Licht')
  })

  it('faellt bei Unbekanntem auf die Markierung zurueck statt zu scheitern', () => {
    expect(itemType('einhorn').kind).toBe('marker')
    expect(itemType(null).kind).toBe('marker')
  })
})

describe('clampPosition', () => {
  it('laesst Werte im Bereich unveraendert', () => {
    expect(clampPosition(0.25, 0.75)).toEqual({ x: 0.25, y: 0.75 })
  })

  it('begrenzt auf die Flaeche', () => {
    expect(clampPosition(-2, 5)).toEqual({ x: 0, y: 1 })
  })

  it('setzt unbrauchbare Werte in die Mitte', () => {
    expect(clampPosition(NaN, 'x' as any)).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('normalizeRotation', () => {
  it('laesst Winkel im Bereich unveraendert', () => {
    expect(normalizeRotation(90)).toBe(90)
  })

  it('rechnet ueber 360 hinaus zurueck', () => {
    expect(normalizeRotation(450)).toBe(90)
  })

  it('rechnet negative Winkel um — Drehen gegen den Uhrzeigersinn ist normal', () => {
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(-450)).toBe(270)
  })

  it('faengt unbrauchbare Werte ab', () => {
    expect(normalizeRotation(NaN)).toBe(0)
    expect(normalizeRotation(null)).toBe(0)
    expect(normalizeRotation(undefined)).toBe(0)
    expect(normalizeRotation('quatsch' as any)).toBe(0)
  })
})

describe('clampSize', () => {
  it('begrenzt nach unten und oben', () => {
    expect(clampSize(10)).toBe(40)
    expect(clampSize(9999)).toBe(300)
  })

  it('nimmt die Standardgroesse bei fehlendem Wert', () => {
    // Number(null) ist 0 und nicht NaN — ohne eigene Pruefung landete das
    // fehlende Feld auf dem Minimum statt auf dem Standardwert
    expect(clampSize(null)).toBe(100)
    expect(clampSize(undefined)).toBe(100)
    expect(clampSize('' as any)).toBe(100)
  })

  it('unterscheidet eine echte 0 von einer fehlenden Angabe', () => {
    expect(clampSize(0)).toBe(40)
  })
})

describe('summarise', () => {
  const items = [
    { kind: 'kamera' }, { kind: 'kamera' }, { kind: 'licht' },
    { kind: 'licht' }, { kind: 'licht' }, { kind: 'darsteller' },
  ]

  it('zaehlt je Typ', () => {
    const s = summarise(items)
    expect(s.find(x => x.kind === 'licht')?.count).toBe(3)
    expect(s.find(x => x.kind === 'kamera')?.count).toBe(2)
  })

  it('nennt nur, was tatsaechlich auf dem Plan steht', () => {
    expect(summarise(items).map(x => x.kind)).not.toContain('tuer')
  })

  it('haelt die Reihenfolge der Symbolliste ein', () => {
    const s = summarise(items).map(x => x.kind)
    expect(s.indexOf('kamera')).toBeLessThan(s.indexOf('licht'))
  })

  it('kommt mit leerem Plan klar', () => {
    expect(summarise([])).toEqual([])
  })
})

describe('nextLabel', () => {
  it('beschriftet Kameras mit Buchstaben', () => {
    expect(nextLabel('kamera', [])).toBe('A')
    expect(nextLabel('kamera', [{ kind: 'kamera' }])).toBe('B')
  })

  it('zaehlt nach Z zweistellig weiter', () => {
    const vorhanden = Array.from({ length: 26 }, () => ({ kind: 'kamera' }))
    expect(nextLabel('kamera', vorhanden)).toBe('AA')
  })

  it('beschriftet alles andere mit Zahlen', () => {
    expect(nextLabel('licht', [])).toBe('1')
    expect(nextLabel('licht', [{ kind: 'licht' }, { kind: 'licht' }])).toBe('3')
  })

  it('zaehlt je Typ getrennt', () => {
    const plan = [{ kind: 'kamera' }, { kind: 'licht' }, { kind: 'licht' }]
    expect(nextLabel('kamera', plan)).toBe('B')
    expect(nextLabel('licht', plan)).toBe('3')
  })
})

describe('renderFloorplanHtml', () => {
  const plan = { name: 'Wohnküche', project_title: 'Sprachlos', scene_number: '2', notes: 'Fenster abkleben' }
  const items = [
    { kind: 'kamera', label: 'A', x: 0.2, y: 0.8, rotation: 45, size: 100 },
    { kind: 'licht', label: '1', x: 0.7, y: 0.3, rotation: 200, size: 120 },
    { kind: 'darsteller', label: 'ANDI', x: 0.5, y: 0.5 },
  ]
  const html = renderFloorplanHtml(plan, items, 'data:image/png;base64,AAAA')

  it('nennt Plan, Projekt und Szene', () => {
    expect(html).toContain('Wohnküche')
    expect(html).toContain('Sprachlos')
    expect(html).toContain('Szene 2')
  })

  it('bettet das Bild als Daten-URI ein statt es zu verlinken', () => {
    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).not.toContain('/uploads/')
  })

  it('setzt die Symbole an ihre relative Position', () => {
    expect(html).toContain('left:20.00%')
    expect(html).toContain('top:80.00%')
  })

  it('dreht nur gerichtete Symbole', () => {
    expect(html).toContain('rotate(45deg)')
    expect(html).toContain('rotate(200deg)')
    // Der Darsteller hat keinen Kegel
    expect((html.match(/class="cone"/g) || []).length).toBe(2)
  })

  it('enthaelt die Legende mit Anzahl je Typ', () => {
    expect(html).toContain('Kamera: 1')
    expect(html).toContain('Licht: 1')
  })

  it('uebernimmt die Notizen', () => {
    expect(html).toContain('Fenster abkleben')
  })

  it('kommt ohne Hintergrundbild klar', () => {
    const ohne = renderFloorplanHtml(plan, items, null)
    expect(ohne).toContain('stage empty')
    expect(ohne).not.toContain('<img')
  })

  it('kommt mit leerem Plan klar', () => {
    const leer = renderFloorplanHtml({ name: 'Leer' }, [], null)
    expect(leer).toContain('0 Elemente')
  })

  it('maskiert HTML aus Nutzereingaben', () => {
    const evil = renderFloorplanHtml({ name: '<script>x</script>' }, [], null)
    expect(evil).not.toContain('<script>x</script>')
    expect(evil).toContain('&lt;script&gt;')
  })
})
