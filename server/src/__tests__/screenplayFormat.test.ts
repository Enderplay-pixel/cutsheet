import { describe, it, expect } from 'vitest'
import {
  wrapMono,
  layoutScreenplay,
  LINES_PER_PAGE,
  type SceneInput,
  type SourceBlock,
} from '../lib/screenplayFormat'

// Spaltenwerte gemäß Standard: Raster beginnt 1.0", Textspiegel bei 1.5" (Spalte 5).
const COL_ACTION = 5
const COL_DIALOGUE = 15      // 2.5" ab Papierkante
const COL_PARENTHETICAL = 21 // 3.1"
const COL_MORE = 25          // 3.5"
const COL_CHARACTER = 27     // 3.7"

function scene(blocks: Array<[string, string]>, sceneNumber = '1'): SceneInput {
  return {
    scene_number: sceneNumber,
    blocks: blocks.map(([block_type, content], i) => ({ id: i + 1, block_type, content } as SourceBlock)),
  }
}

const flat = (pages: ReturnType<typeof layoutScreenplay>) => pages.flatMap(p => p.lines)
const textAt = (pages: ReturnType<typeof layoutScreenplay>, type: string) =>
  flat(pages).filter(l => l.type === type).map(l => l.text)

describe('wrapMono', () => {
  it('bricht auf die vorgegebene Zeichenbreite um', () => {
    const lines = wrapMono('a'.repeat(10) + ' ' + 'b'.repeat(10), 12)
    expect(lines).toEqual(['aaaaaaaaaa', 'bbbbbbbbbb'])
    expect(lines.every(l => l.length <= 12)).toBe(true)
  })

  it('haelt Woerter zusammen und fuellt die Zeile aus', () => {
    expect(wrapMono('der schnelle braune fuchs', 12)).toEqual(['der schnelle', 'braune fuchs'])
  })

  it('trennt Woerter hart, die laenger als die Zeile sind', () => {
    expect(wrapMono('x'.repeat(25), 10)).toEqual(['xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxx'])
  })

  it('behaelt explizite Zeilenumbrueche', () => {
    expect(wrapMono('eins\nzwei', 40)).toEqual(['eins', 'zwei'])
  })

  it('ueberschreitet die Dialogbreite von 35 Zeichen nie', () => {
    const long = 'Ich dachte vielleicht waere das etwas fuer dich weil du doch immer sagst dass du sowas magst.'
    expect(wrapMono(long, 35).every(l => l.length <= 35)).toBe(true)
  })
})

describe('Einrueckungen nach Standard', () => {
  const pages = layoutScreenplay([scene([
    ['scene_heading', 'INT. KUECHE - TAG'],
    ['action', 'Andi sitzt am Tisch.'],
    ['character', 'andi'],
    ['parenthetical', 'leise'],
    ['dialogue', 'Guten Morgen.'],
    ['transition', 'cut to:'],
  ])])

  const byType = (t: string) => flat(pages).find(l => l.type === t)!

  it('setzt Szenenueberschrift und Action an den Textspiegel', () => {
    expect(byType('scene_heading').col).toBe(COL_ACTION)
    expect(byType('action').col).toBe(COL_ACTION)
  })

  it('setzt Dialog auf 2.5 Zoll', () => {
    expect(byType('dialogue').col).toBe(COL_DIALOGUE)
  })

  it('setzt Klammerbemerkung auf 3.1 Zoll', () => {
    expect(byType('parenthetical').col).toBe(COL_PARENTHETICAL)
  })

  it('setzt den Figurennamen auf 3.7 Zoll', () => {
    expect(byType('character').col).toBe(COL_CHARACTER)
  })

  it('schreibt Ueberschrift, Figur und Transition in Grossbuchstaben', () => {
    expect(byType('scene_heading').text).toBe('INT. KUECHE - TAG')
    expect(byType('character').text).toBe('ANDI')
    expect(byType('transition').text).toBe('CUT TO:')
  })

  it('klammert die Klammerbemerkung automatisch', () => {
    expect(byType('parenthetical').text).toBe('(leise)')
  })

  it('richtet Transitions rechtsbuendig am rechten Textrand aus', () => {
    const t = byType('transition')
    expect(t.col + t.text.length).toBe(COL_ACTION + 60)
  })

  it('haengt die Szenennummer an die Ueberschrift', () => {
    expect(byType('scene_heading').sceneNumber).toBe('1')
  })
})

describe('Abstaende', () => {
  it('setzt zwei Leerzeilen vor eine Szenenueberschrift, eine vor Action', () => {
    const pages = layoutScreenplay([scene([
      ['action', 'Erste Action.'],
      ['scene_heading', 'INT. FLUR - TAG'],
      ['action', 'Zweite Action.'],
    ])])
    const types = pages[0].lines.map(l => l.type)
    // action, blank, blank, scene_heading, blank, action
    expect(types).toEqual(['action', 'blank', 'blank', 'scene_heading', 'blank', 'action'])
  })

  it('setzt Dialog direkt unter den Figurennamen', () => {
    const pages = layoutScreenplay([scene([
      ['character', 'ANDI'],
      ['dialogue', 'Hallo.'],
    ])])
    expect(pages[0].lines.map(l => l.type)).toEqual(['character', 'dialogue'])
  })

  it('beginnt die Seite ohne fuehrende Leerzeilen', () => {
    const pages = layoutScreenplay([scene([['scene_heading', 'INT. FLUR - TAG'], ['action', 'Text.']])])
    expect(pages[0].lines[0].type).toBe('scene_heading')
  })
})

describe('CONT\'D bei Unterbrechung durch Action', () => {
  it('markiert dieselbe Figur, die nach Action erneut spricht', () => {
    const pages = layoutScreenplay([scene([
      ['character', 'ANDI'],
      ['dialogue', 'Erst so.'],
      ['action', 'Er zoegert.'],
      ['character', 'ANDI'],
      ['dialogue', 'Dann so.'],
    ])])
    expect(textAt(pages, 'character')).toEqual(['ANDI', "ANDI (CONT'D)"])
  })

  it('markiert eine andere Figur nicht', () => {
    const pages = layoutScreenplay([scene([
      ['character', 'ANDI'],
      ['dialogue', 'Erst so.'],
      ['action', 'Mia schaut.'],
      ['character', 'MIA'],
      ['dialogue', 'Dann so.'],
    ])])
    expect(textAt(pages, 'character')).toEqual(['ANDI', 'MIA'])
  })

  it('verdoppelt ein bereits vorhandenes CONT\'D nicht', () => {
    const pages = layoutScreenplay([scene([
      ['character', 'ANDI'],
      ['dialogue', 'Erst so.'],
      ['action', 'Pause.'],
      ['character', "ANDI (CONT'D)"],
      ['dialogue', 'Dann so.'],
    ])])
    expect(textAt(pages, 'character')).toEqual(['ANDI', "ANDI (CONT'D)"])
  })

  it('ignoriert Namenszusaetze wie (V.O.) beim Vergleich', () => {
    const pages = layoutScreenplay([scene([
      ['character', 'ANDI (V.O.)'],
      ['dialogue', 'Erst so.'],
      ['action', 'Schnitt im Kopf.'],
      ['character', 'ANDI'],
      ['dialogue', 'Dann so.'],
    ])])
    expect(textAt(pages, 'character')).toEqual(['ANDI (V.O.)', "ANDI (CONT'D)"])
  })
})

describe('Seitenumbruch', () => {
  it('haelt die Zeilenzahl pro Seite ein', () => {
    const blocks: Array<[string, string]> = []
    for (let i = 0; i < 80; i++) blocks.push(['action', `Action Nummer ${i}.`])
    const pages = layoutScreenplay([scene(blocks)])
    expect(pages.length).toBeGreaterThan(1)
    for (const p of pages) expect(p.lines.length).toBeLessThanOrEqual(LINES_PER_PAGE)
  })

  it('numeriert Seiten fortlaufend ab 1', () => {
    const blocks: Array<[string, string]> = []
    for (let i = 0; i < 80; i++) blocks.push(['action', `Action ${i}.`])
    const pages = layoutScreenplay([scene(blocks)])
    expect(pages.map(p => p.number)).toEqual(pages.map((_, i) => i + 1))
  })

  it('respektiert firstPageNumber', () => {
    const pages = layoutScreenplay([scene([['action', 'Kurz.']])], { firstPageNumber: 7 })
    expect(pages[0].number).toBe(7)
  })

  it('laesst eine Szenenueberschrift nie als letzte Zeile einer Seite stehen', () => {
    // Seite mit Action fuellen, dann Ueberschrift: sie muss auf die naechste Seite
    const blocks: Array<[string, string]> = []
    for (let i = 0; i < 26; i++) blocks.push(['action', `Zeile ${i}.`])
    blocks.push(['scene_heading', 'INT. NEUE SZENE - NACHT'])
    blocks.push(['action', 'Es geht weiter.'])
    const pages = layoutScreenplay([scene(blocks)])

    for (const p of pages) {
      const last = p.lines[p.lines.length - 1]
      expect(last.type).not.toBe('scene_heading')
    }
  })

  it('laesst einen Figurennamen nie ohne Dialog am Seitenende stehen', () => {
    const blocks: Array<[string, string]> = []
    for (let i = 0; i < 26; i++) blocks.push(['action', `Zeile ${i}.`])
    blocks.push(['character', 'ANDI'])
    blocks.push(['dialogue', 'Ein Satz, der ueber mehrere Zeilen laeuft und deshalb umgebrochen wird.'])
    const pages = layoutScreenplay([scene(blocks)])

    for (const p of pages) {
      const last = p.lines[p.lines.length - 1]
      expect(last.type).not.toBe('character')
    }
  })
})

describe('(MORE) und (CONT\'D) am Seitenumbruch', () => {
  // Dialog so lang, dass er zwangsweise ueber den Umbruch laeuft
  function longDialogueLayout() {
    const blocks: Array<[string, string]> = []
    for (let i = 0; i < 24; i++) blocks.push(['action', `Vorlauf ${i}.`])
    blocks.push(['character', 'ANDI'])
    blocks.push(['dialogue', Array.from({ length: 60 }, (_, i) => `Satzteil ${i}`).join(' ')])
    return layoutScreenplay([scene(blocks)])
  }

  it('setzt (MORE) als letzte Zeile der gebrochenen Seite', () => {
    const pages = longDialogueLayout()
    const withMore = pages.filter(p => p.lines.some(l => l.type === 'more'))
    expect(withMore.length).toBeGreaterThan(0)
    for (const p of withMore) {
      expect(p.lines[p.lines.length - 1].type).toBe('more')
      expect(p.lines[p.lines.length - 1].text).toBe('(MORE)')
    }
  })

  it('setzt (MORE) auf 3.5 Zoll', () => {
    const pages = longDialogueLayout()
    const more = flat(pages).find(l => l.type === 'more')!
    expect(more.col).toBe(COL_MORE)
  })

  it('wiederholt den Figurennamen mit (CONT\'D) oben auf der Folgeseite', () => {
    const pages = longDialogueLayout()
    const breakIdx = pages.findIndex(p => p.lines.some(l => l.type === 'more'))
    const next = pages[breakIdx + 1]
    expect(next).toBeDefined()
    expect(next.lines[0].type).toBe('character')
    expect(next.lines[0].text).toBe("ANDI (CONT'D)")
    expect(next.lines[0].col).toBe(COL_CHARACTER)
    expect(next.lines[1].type).toBe('dialogue')
  })

  it('laesst nach dem Umbruch mindestens zwei Dialogzeilen stehen', () => {
    const pages = longDialogueLayout()
    const breakIdx = pages.findIndex(p => p.lines.some(l => l.type === 'more'))
    const before = pages[breakIdx].lines.filter(l => l.type === 'dialogue').length
    const after = pages[breakIdx + 1].lines.filter(l => l.type === 'dialogue').length
    expect(before).toBeGreaterThanOrEqual(2)
    expect(after).toBeGreaterThanOrEqual(2)
  })

  it('trennt kurzen Dialog nicht, sondern schiebt ihn komplett weiter', () => {
    const blocks: Array<[string, string]> = []
    for (let i = 0; i < 26; i++) blocks.push(['action', `Zeile ${i}.`])
    blocks.push(['character', 'MIA'])
    blocks.push(['dialogue', 'Nur zwei kurze Zeilen Text hier drin, mehr nicht.'])
    const pages = layoutScreenplay([scene(blocks)])
    expect(flat(pages).some(l => l.type === 'more')).toBe(false)
  })
})

describe('Notizen', () => {
  const blocks: Array<[string, string]> = [
    ['action', 'Sichtbar.'],
    ['annotation', 'Nur mit Notizen.'],
  ]

  it('blendet Annotationen ohne Notizen-Option aus', () => {
    const pages = layoutScreenplay([scene(blocks)], { includeAnnotations: false })
    expect(flat(pages).some(l => l.type === 'annotation')).toBe(false)
  })

  it('nimmt Annotationen mit Notizen-Option auf', () => {
    const pages = layoutScreenplay([scene(blocks)], { includeAnnotations: true })
    expect(textAt(pages, 'annotation')).toEqual(['Nur mit Notizen.'])
  })
})

describe('Robustheit', () => {
  it('liefert fuer ein leeres Drehbuch keine Seiten', () => {
    expect(layoutScreenplay([])).toEqual([])
  })

  it('ueberspringt leere Bloecke', () => {
    const pages = layoutScreenplay([scene([['action', '   '], ['dialogue', '']])])
    expect(pages).toEqual([])
  })

  it('kommt mit fehlendem Inhalt klar', () => {
    const pages = layoutScreenplay([{ scene_number: '1', blocks: [{ block_type: 'action' } as SourceBlock] }])
    expect(pages).toEqual([])
  })

  it('keine Zeile ueberschreitet den rechten Textrand', () => {
    const pages = layoutScreenplay([scene([
      ['action', 'x'.repeat(300)],
      ['dialogue', 'y'.repeat(300)],
      ['character', 'z'.repeat(300)],
      ['parenthetical', 'w'.repeat(300)],
    ])])
    for (const l of flat(pages)) {
      expect(l.col + l.text.length).toBeLessThanOrEqual(COL_ACTION + 60)
    }
  })
})
