import { describe, it, expect } from 'vitest'
import {
  groupShots, summarise, sceneContext, legend, totalMinutes, renderShotlistHtml,
  type Shot, type Scene, type ShootDay,
} from '../lib/shotlist'

function shot(over: Partial<Shot> = {}): Shot {
  return {
    id: 1, scene_id: 1, shoot_day_id: 1, shot_number: '1A', size: 'MS',
    movement: 'Statisch', lens_mm: '35', description: 'Anna geht durchs Bild',
    notes: null, best_take: null, duration_seconds: 30, done: 0, sort_order: 0, ...over,
  }
}

const scenes: Scene[] = [
  { id: 1, scene_number: '1', title: 'Am Fluss', int_ext: 'EXT', day_night: 'TAG', eighths: 12, location_name: 'Uferweg', sort_order: 0 },
  { id: 2, scene_number: '2', title: 'Küche', int_ext: 'INT', day_night: 'NACHT', eighths: 5, location_name: null, sort_order: 1 },
  { id: 3, scene_number: '3', title: 'Flur', int_ext: 'INT', day_night: 'TAG', eighths: 3, location_name: null, sort_order: 2 },
]

const days: ShootDay[] = [
  { id: 1, day_number: 1, date: '2026-08-05' },
  { id: 2, day_number: 2, date: '2026-08-06' },
]

describe('groupShots nach Szene', () => {
  it('buendelt in der Reihenfolge der Szenen, nicht der Einstellungen', () => {
    const groups = groupShots(
      [shot({ id: 1, scene_id: 2 }), shot({ id: 2, scene_id: 1 })],
      scenes, days, 'szene'
    )
    expect(groups.map(g => g.key)).toEqual(['szene-1', 'szene-2'])
  })

  it('laesst nicht aufgeloeste Szenen weg statt leere Tabellen zu drucken', () => {
    const groups = groupShots([shot({ scene_id: 1 })], scenes, days, 'szene')
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('szene-1')
  })

  it('nennt Nummer und Titel der Szene', () => {
    const groups = groupShots([shot({ scene_id: 1 })], scenes, days, 'szene')
    expect(groups[0].title).toBe('Szene 1: Am Fluss')
    expect(groups[0].context).toContain('EXT · TAG · Uferweg')
    expect(groups[0].context).toContain('1 4/8 Seiten')
  })

  it('sammelt Einstellungen ohne Szene am Ende', () => {
    const groups = groupShots(
      [shot({ id: 1, scene_id: null }), shot({ id: 2, scene_id: 1 })],
      scenes, days, 'szene'
    )
    expect(groups.map(g => g.key)).toEqual(['szene-1', 'ohne'])
    expect(groups[1].title).toBe('Ohne Szene')
  })

  it('verliert Einstellungen einer geloeschten Szene nicht', () => {
    // scene_id zeigt ins Leere — uebersehen waere schlimmer als unsortiert
    const groups = groupShots([shot({ scene_id: 99 })], scenes, days, 'szene')
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('ohne')
    expect(groups[0].shots).toHaveLength(1)
  })
})

describe('groupShots nach Drehtag', () => {
  it('buendelt nach Drehtag', () => {
    const groups = groupShots(
      [shot({ id: 1, shoot_day_id: 2 }), shot({ id: 2, shoot_day_id: 1 })],
      scenes, days, 'drehtag'
    )
    expect(groups.map(g => g.title)).toEqual(['Drehtag 1', 'Drehtag 2'])
    expect(groups[0].context).toBe('05.08.2026')
  })

  it('weist unverplante Einstellungen aus', () => {
    const groups = groupShots([shot({ shoot_day_id: null })], scenes, days, 'drehtag')
    expect(groups[0].title).toBe('Noch keinem Drehtag zugeordnet')
  })
})

describe('summarise', () => {
  it('zaehlt Einstellungen und Material', () => {
    expect(summarise([shot({ duration_seconds: 30 }), shot({ duration_seconds: 90 })]))
      .toBe('2 Einstellungen · 2min Material')
  })

  it('beugt bei einer Einstellung', () => {
    expect(summarise([shot({ duration_seconds: null })])).toBe('1 Einstellung')
  })

  it('nennt Erledigtes nur, wenn es welches gibt', () => {
    expect(summarise([shot({ done: 1, duration_seconds: null })])).toContain('1 erledigt')
    expect(summarise([shot({ done: 0, duration_seconds: null })])).not.toContain('erledigt')
  })

  it('rechnet fehlende Dauern als 0 statt NaN', () => {
    expect(totalMinutes([shot({ duration_seconds: null }), shot({ duration_seconds: 120 })])).toBe(2)
  })
})

describe('sceneContext', () => {
  it('laesst fehlende Angaben weg statt Trenner zu haeufen', () => {
    expect(sceneContext(scenes[1])).toBe('INT · NACHT')
  })
})

describe('legend', () => {
  it('erklaert nur die tatsaechlich verwendeten Abkuerzungen', () => {
    const l = legend([shot({ size: 'CU' }), shot({ size: 'MS' })])
    expect(l.map(e => e.code)).toEqual(['CU', 'MS'])
  })

  it('bleibt bei ausgeschriebenen Groessen leer', () => {
    expect(legend([shot({ size: 'Totale' })])).toHaveLength(0)
  })
})

describe('renderShotlistHtml', () => {
  const basis = {
    projectTitle: 'Sprachlos', director: 'Sarah Müller', dop: 'Rosita Ø',
    mode: 'szene' as const, scenes, days,
  }

  it('zeigt die Storyboard-Spalte nur, wenn es Bilder gibt', () => {
    // Auf die Spaltenueberschrift pruefen, nicht auf das Wort — das steht auch
    // im CSS-Kommentar
    const ohne = renderShotlistHtml({ ...basis, allShots: [shot()], groups: groupShots([shot()], scenes, days, 'szene') })
    expect(ohne).not.toContain('>Storyboard</th>')

    const mit = [shot({ storyboard: 'data:image/png;base64,AAA' })]
    const html = renderShotlistHtml({ ...basis, allShots: mit, groups: groupShots(mit, scenes, days, 'szene') })
    expect(html).toContain('>Storyboard</th>')
    expect(html).toContain('data:image/png;base64,AAA')
  })

  it('setzt ein Kaestchen zum Abhaken', () => {
    const offen = [shot({ done: 0 })]
    const html = renderShotlistHtml({ ...basis, allShots: offen, groups: groupShots(offen, scenes, days, 'szene') })
    expect(html).toContain('class="kasten"')

    const fertig = [shot({ done: 1 })]
    const html2 = renderShotlistHtml({ ...basis, allShots: fertig, groups: groupShots(fertig, scenes, days, 'szene') })
    expect(html2).toContain('kasten voll')
  })

  it('setzt die Notiz unter die Beschreibung', () => {
    const mitNotiz = [shot({ notes: 'Achtung: Glasbruch, Sicherheitsabstand' })]
    const html = renderShotlistHtml({ ...basis, allShots: mitNotiz, groups: groupShots(mitNotiz, scenes, days, 'szene') })
    expect(html).toContain('shot-note')
    expect(html).toContain('Glasbruch')
  })

  it('maskiert Beschreibung und Notiz', () => {
    const boese = [shot({ description: '<script>x</script>', notes: 'A & B' })]
    const html = renderShotlistHtml({ ...basis, allShots: boese, groups: groupShots(boese, scenes, days, 'szene') })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('A &amp; B')
  })

  it('zaehlt den Fortschritt', () => {
    const gemischt = [shot({ id: 1, done: 1 }), shot({ id: 2, done: 0 })]
    const html = renderShotlistHtml({ ...basis, allShots: gemischt, groups: groupShots(gemischt, scenes, days, 'szene') })
    expect(html).toContain('1 / 2')
    expect(html).toContain('50 %')
  })

  it('sagt es, wenn nichts erfasst ist', () => {
    const html = renderShotlistHtml({ ...basis, allShots: [], groups: [] })
    expect(html).toContain('Noch keine Einstellungen erfasst.')
  })

  it('nennt nach Drehtag gebuendelt die Szene jeder Einstellung', () => {
    // Am Set steht man sonst vor "3C" und weiss nicht, wohin das gehoert
    const s1 = [shot({ scene_id: 1, shoot_day_id: 1 })]
    const html = renderShotlistHtml({
      ...basis, mode: 'drehtag', allShots: s1, groups: groupShots(s1, scenes, days, 'drehtag'),
    })
    expect(html).toContain('>Szene</th>')
    expect(html).toContain('1 (EXT/TAG)')
  })

  it('nennt nach Szene gebuendelt den Drehtag', () => {
    const s1 = [shot({ scene_id: 1, shoot_day_id: 2 })]
    const html = renderShotlistHtml({ ...basis, allShots: s1, groups: groupShots(s1, scenes, days, 'szene') })
    expect(html).toContain('>Tag</th>')
  })

  it('laesst die Tag-Spalte weg, wenn nichts verplant ist', () => {
    const s1 = [shot({ shoot_day_id: null })]
    const html = renderShotlistHtml({ ...basis, allShots: s1, groups: groupShots(s1, scenes, days, 'szene') })
    expect(html).not.toContain('>Tag</th>')
  })

  it('zeigt den besten Take, sobald einer erfasst ist', () => {
    const mit = [shot({ best_take: '3, 5' })]
    const html = renderShotlistHtml({ ...basis, allShots: mit, groups: groupShots(mit, scenes, days, 'szene') })
    expect(html).toContain('>Bester Take</th>')
    expect(html).toContain('3, 5')
  })

  it('laesst die Spalte nach Szene weg, solange nichts erfasst ist', () => {
    const html = renderShotlistHtml({ ...basis, allShots: [shot()], groups: groupShots([shot()], scenes, days, 'szene') })
    expect(html).not.toContain('>Bester Take</th>')
  })

  it('haelt die Spalte nach Drehtag zum Eintragen frei', () => {
    // Am Set wird sie mit der Hand gefuellt — ein Strich waere da im Weg
    const s1 = [shot({ best_take: null })]
    const html = renderShotlistHtml({
      ...basis, mode: 'drehtag', allShots: s1, groups: groupShots(s1, scenes, days, 'drehtag'),
    })
    expect(html).toContain('>Bester Take</th>')
    expect(html).toContain('&nbsp;')
  })

  it('laeuft quer — sechs Spalten passen nicht ins Hochformat', () => {
    const html = renderShotlistHtml({ ...basis, allShots: [shot()], groups: groupShots([shot()], scenes, days, 'szene') })
    expect(html).toContain('A4 landscape')
  })
})
