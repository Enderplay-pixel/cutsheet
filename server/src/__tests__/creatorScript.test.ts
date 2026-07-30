import { describe, it, expect } from 'vitest'
import {
  countWords,
  estimateSeconds,
  formatTimecode,
  buildTimeline,
  buildChapters,
  renderCreatorScriptHtml,
  DEFAULT_WPM,
  type ScriptSection,
} from '../lib/creatorScript'

const words = (n: number) => Array.from({ length: n }, (_, i) => `wort${i}`).join(' ')

describe('countWords', () => {
  it('zaehlt normale Woerter', () => {
    expect(countWords('hallo liebe leute')).toBe(3)
  })

  it('ignoriert Regieanweisungen in eckigen Klammern', () => {
    expect(countWords('hallo [Schnitt auf Nahaufnahme] leute')).toBe(2)
  })

  it('zaehlt Satzzeichen nicht als Wort', () => {
    expect(countWords('hallo , . leute')).toBe(2)
  })

  it('kommt mit leerem Text klar', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords(undefined as any)).toBe(0)
  })

  it('zaehlt Zahlen mit', () => {
    expect(countWords('in 2026 kommt')).toBe(3)
  })
})

describe('estimateSeconds', () => {
  it('rechnet mit dem Standard-Sprechtempo', () => {
    // 150 Woerter bei 150 W/min = 60s
    expect(estimateSeconds(words(150))).toBe(60)
  })

  it('beruecksichtigt ein abweichendes Tempo', () => {
    expect(estimateSeconds(words(100), 100)).toBe(60)
  })

  it('rundet auf ganze Sekunden auf', () => {
    expect(estimateSeconds(words(1))).toBe(1)
  })

  it('faellt bei unsinnigem Tempo auf den Standard zurueck', () => {
    expect(estimateSeconds(words(DEFAULT_WPM), 0)).toBe(60)
  })
})

describe('formatTimecode', () => {
  it('formatiert unter einer Stunde als m:ss', () => {
    expect(formatTimecode(0)).toBe('0:00')
    expect(formatTimecode(65)).toBe('1:05')
    expect(formatTimecode(600)).toBe('10:00')
  })

  it('formatiert ab einer Stunde als h:mm:ss', () => {
    expect(formatTimecode(3661)).toBe('1:01:01')
  })

  it('behandelt negative Werte als 0', () => {
    expect(formatTimecode(-5)).toBe('0:00')
  })
})

describe('buildTimeline', () => {
  const sections: ScriptSection[] = [
    { kind: 'hook', heading: 'Hook', spoken: words(75), target_seconds: 30 },
    { kind: 'segment', heading: 'Teil 1', spoken: words(150), target_seconds: 60 },
    { kind: 'outro', heading: 'Outro', spoken: words(75) },
  ]

  it('summiert Start- und Gesamtzeiten', () => {
    const t = buildTimeline(sections)
    expect(t.sections.map(s => s.startSeconds)).toEqual([0, 30, 90])
    expect(t.totalSeconds).toBe(120)
  })

  it('setzt Timecodes passend zum Start', () => {
    const t = buildTimeline(sections)
    expect(t.sections.map(s => s.timecode)).toEqual(['0:00', '0:30', '1:30'])
  })

  it('summiert die Wortzahl', () => {
    expect(buildTimeline(sections).totalWords).toBe(300)
  })

  it('berechnet die Abweichung zur Soll-Laenge', () => {
    const t = buildTimeline(sections)
    expect(t.sections[0].deltaSeconds).toBe(0)   // 30s Ziel, 30s geschaetzt
    expect(t.sections[1].deltaSeconds).toBe(0)   // 60s Ziel, 60s geschaetzt
    expect(t.sections[2].deltaSeconds).toBeNull() // kein Ziel gesetzt
  })

  it('meldet eine Ueberlaenge als positive Abweichung', () => {
    const t = buildTimeline([{ kind: 'hook', spoken: words(150), target_seconds: 30 }])
    expect(t.sections[0].deltaSeconds).toBe(30)
  })

  it('belegt B-Roll mit der Soll-Laenge statt mit Sprechzeit', () => {
    const t = buildTimeline([
      { kind: 'broll', heading: 'Drohne', visuals: 'Luftaufnahme', target_seconds: 12 },
      { kind: 'segment', spoken: words(150) },
    ])
    expect(t.sections[0].estimatedSeconds).toBe(12)
    expect(t.sections[0].words).toBe(0)
    expect(t.sections[1].startSeconds).toBe(12)
  })

  it('behandelt unbekannte Abschnittstypen als Segment', () => {
    const t = buildTimeline([{ kind: 'quatsch', spoken: words(150) }])
    expect(t.sections[0].kind).toBe('segment')
  })

  it('liefert fuer eine leere Liste eine leere Timeline', () => {
    const t = buildTimeline([])
    expect(t).toMatchObject({ totalSeconds: 0, totalWords: 0, targetSeconds: 0 })
    expect(t.sections).toEqual([])
  })
})

describe('buildChapters', () => {
  const good: ScriptSection[] = [
    { kind: 'hook', heading: 'Warum das wichtig ist', spoken: words(75) },
    { kind: 'segment', heading: 'Der erste Schritt', spoken: words(150) },
    { kind: 'segment', heading: 'Der zweite Schritt', spoken: words(150) },
    { kind: 'outro', heading: 'Fazit', spoken: words(75) },
  ]

  it('baut Kapitelzeilen mit Timecode und Titel', () => {
    expect(buildChapters(good).lines).toEqual([
      '0:00 Warum das wichtig ist',
      '0:30 Der erste Schritt',
      '1:30 Der zweite Schritt',
      '2:30 Fazit',
    ])
  })

  it('akzeptiert regelkonforme Kapitel', () => {
    const c = buildChapters(good)
    expect(c.problems).toEqual([])
    expect(c.valid).toBe(true)
  })

  it('beanstandet weniger als drei Kapitel', () => {
    const c = buildChapters(good.slice(0, 2))
    expect(c.valid).toBe(false)
    expect(c.problems.some(p => p.includes('drei Kapitel'))).toBe(true)
  })

  it('beanstandet Kapitel unter zehn Sekunden', () => {
    const c = buildChapters([
      { kind: 'hook', heading: 'Kurz', spoken: words(5) },   // 2s
      { kind: 'segment', heading: 'Mitte', spoken: words(150) },
      { kind: 'outro', heading: 'Ende', spoken: words(150) },
    ])
    expect(c.valid).toBe(false)
    expect(c.problems.some(p => p.includes('10s'))).toBe(true)
  })

  it('beanstandet ein erstes Kapitel, das nicht bei 0:00 liegt', () => {
    const c = buildChapters([
      { kind: 'broll', visuals: 'Intro-Clip ohne Ueberschrift', target_seconds: 15 },
      { kind: 'segment', heading: 'Erst hier', spoken: words(150) },
      { kind: 'segment', heading: 'Dann hier', spoken: words(150) },
      { kind: 'outro', heading: 'Ende', spoken: words(150) },
    ])
    expect(c.problems.some(p => p.includes('0:00'))).toBe(true)
  })

  it('meldet fehlende Ueberschriften', () => {
    const c = buildChapters([{ kind: 'segment', spoken: words(150) }])
    expect(c.valid).toBe(false)
    expect(c.lines).toEqual([])
  })
})

describe('renderCreatorScriptHtml', () => {
  const video = {
    title: 'So schneide ich meine Videos',
    platform: 'YouTube',
    hook: 'Das haette ich vor drei Jahren wissen sollen.',
    title_variants: 'Variante A\nVariante B',
    thumbnail_ideas: 'Grosses Gesicht links\nPfeil auf Timeline',
    description: 'In diesem Video zeige ich meinen Workflow.',
    tags: 'schnitt, workflow, premiere',
  }
  const sections: ScriptSection[] = [
    { kind: 'hook', heading: 'Hook', spoken: words(75), visuals: 'Schnelle Schnittfolge' },
    { kind: 'segment', heading: 'Schritt 1', spoken: words(150), visuals: 'Screencast' },
    { kind: 'outro', heading: 'Outro', spoken: words(75), visuals: 'Abo-Animation' },
  ]

  const html = renderCreatorScriptHtml(video, sections, { projectTitle: 'Mein Kanal' })

  it('enthaelt Titel, Hook und Laufzeit', () => {
    expect(html).toContain('So schneide ich meine Videos')
    expect(html).toContain('Das haette ich vor drei Jahren wissen sollen.')
    expect(html).toContain('2:00')
  })

  it('setzt drei Spalten fuer Zeit, Text und Bild', () => {
    expect(html).toContain('Gesprochener Text')
    expect(html).toContain('Bild / B-Roll / Einblendung')
  })

  it('enthaelt das Upload-Paket mit Kapitelmarken', () => {
    expect(html).toContain('Upload-Paket')
    expect(html).toContain('Titel-Varianten')
    expect(html).toContain('Thumbnail-Ideen')
    expect(html).toContain('0:00 Hook')
    expect(html).toContain('schnitt')
  })

  it('maskiert HTML aus Nutzereingaben', () => {
    const evil = renderCreatorScriptHtml(
      { ...video, title: '<script>alert(1)</script>' },
      sections
    )
    expect(evil).not.toContain('<script>alert(1)</script>')
    expect(evil).toContain('&lt;script&gt;')
  })

  it('kommt ohne Abschnitte klar', () => {
    const empty = renderCreatorScriptHtml({ title: 'Leer' }, [])
    expect(empty).toContain('Noch keine Abschnitte angelegt.')
  })
})
