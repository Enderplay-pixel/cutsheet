import { describe, it, expect } from 'vitest'
import {
  parseRetentionRows,
  watchAtSecond,
  analyseScriptRetention,
  findChannelPatterns,
  type RetentionPoint,
  type TimedSection,
} from '../lib/youtubeInsights'

/** Gleichmaessig abfallende Kurve von 100 % auf 40 %. */
const linearCurve: RetentionPoint[] = Array.from({ length: 11 }, (_, i) => ({
  ratio: i / 10,
  watch: 1 - (i / 10) * 0.6,
}))

describe('parseRetentionRows', () => {
  it('wandelt Rohzeilen der API in Punkte', () => {
    expect(parseRetentionRows([[0, 1], [0.5, 0.7]])).toEqual([
      { ratio: 0, watch: 1 },
      { ratio: 0.5, watch: 0.7 },
    ])
  })

  it('sortiert nach Position im Video', () => {
    expect(parseRetentionRows([[0.8, 0.3], [0.1, 0.9]]).map(p => p.ratio)).toEqual([0.1, 0.8])
  })

  it('wirft kaputte Zeilen weg', () => {
    expect(parseRetentionRows([[0, 1], ['x' as any, 2], [1] as any, null as any])).toHaveLength(1)
  })

  it('begrenzt die Position auf 0 bis 1', () => {
    expect(parseRetentionRows([[-0.5, 1], [2, 0.5]]).map(p => p.ratio)).toEqual([0, 1])
  })

  it('kommt mit fehlenden Daten klar', () => {
    expect(parseRetentionRows(null)).toEqual([])
    expect(parseRetentionRows(undefined)).toEqual([])
  })
})

describe('watchAtSecond', () => {
  it('liefert den Startwert am Anfang', () => {
    expect(watchAtSecond(linearCurve, 0, 100)).toBe(1)
  })

  it('interpoliert zwischen zwei Punkten', () => {
    // Bei 50 % der Laufzeit: 1 - 0.5*0.6 = 0.7
    expect(watchAtSecond(linearCurve, 50, 100)).toBeCloseTo(0.7, 5)
  })

  it('interpoliert auch zwischen den Stuetzstellen', () => {
    expect(watchAtSecond(linearCurve, 55, 100)).toBeCloseTo(0.67, 5)
  })

  it('haelt den Endwert hinter dem Videoende', () => {
    expect(watchAtSecond(linearCurve, 500, 100)).toBeCloseTo(0.4, 5)
  })

  it('liefert null ohne Kurve oder Laenge', () => {
    expect(watchAtSecond([], 10, 100)).toBeNull()
    expect(watchAtSecond(linearCurve, 10, 0)).toBeNull()
  })
})

describe('analyseScriptRetention', () => {
  const sections: TimedSection[] = [
    { id: 1, kind: 'hook', heading: 'Hook', startSeconds: 0, estimatedSeconds: 30 },
    { id: 2, kind: 'sponsor', heading: 'Sponsor', startSeconds: 30, estimatedSeconds: 60 },
    { id: 3, kind: 'segment', heading: 'Hauptteil', startSeconds: 90, estimatedSeconds: 210 },
  ]
  const analysis = analyseScriptRetention(sections, linearCurve, 300)

  it('rechnet Anfangs- und Endwert je Abschnitt', () => {
    const hook = analysis.sections[0]
    expect(hook.watchStart).toBe(100)
    expect(hook.watchEnd).toBe(94) // 30/300 = 10 % der Laufzeit -> 1 - 0.06
  })

  it('weist den Verlust je Abschnitt aus', () => {
    expect(analysis.sections[0].dropPercentPoints).toBe(6)
  })

  it('normiert den Verlust auf eine Minute', () => {
    // Hook verliert 6 Punkte in 30s -> 12 Punkte je Minute
    expect(analysis.sections[0].dropPerMinute).toBe(12)
  })

  it('macht unterschiedlich lange Abschnitte vergleichbar', () => {
    // Bei gleichmaessigem Abfall ist der Verlust je Minute ueberall gleich,
    // obwohl der Hauptteil absolut am meisten verliert
    const perMinute = analysis.sections.map(s => s.dropPerMinute)
    expect(new Set(perMinute).size).toBe(1)
    const absolut = analysis.sections.map(s => s.dropPercentPoints as number)
    expect(absolut[2]).toBeGreaterThan(absolut[0])
  })

  it('findet den Abschnitt mit dem staerksten Verlust je Minute', () => {
    const steil: RetentionPoint[] = [
      { ratio: 0, watch: 1 },
      { ratio: 0.1, watch: 0.95 },
      { ratio: 0.3, watch: 0.4 }, // Sponsorstrecke faellt steil
      { ratio: 1, watch: 0.35 },
    ]
    const a = analyseScriptRetention(sections, steil, 300)
    expect(a.worst?.heading).toBe('Sponsor')
  })

  it('misst den Zuschaueranteil nach 30 Sekunden als Hook-Test', () => {
    expect(analysis.hookRetention).toBe(94)
  })

  it('weist die Abwanderung waehrend der Sponsorstrecke aus', () => {
    expect(analysis.sponsorDrop).toBe(12)
  })

  it('warnt bei schwachem Einstieg', () => {
    const schwach: RetentionPoint[] = [{ ratio: 0, watch: 1 }, { ratio: 0.1, watch: 0.5 }, { ratio: 1, watch: 0.3 }]
    const a = analyseScriptRetention(sections, schwach, 300)
    expect(a.notes.some(n => n.includes('verliert zu früh'))).toBe(true)
  })

  it('lobt einen tragenden Hook', () => {
    expect(analysis.notes.some(n => n.includes('Hook trägt'))).toBe(true)
  })

  it('meldet eine teure Sponsorstrecke', () => {
    const steil: RetentionPoint[] = [
      { ratio: 0, watch: 1 }, { ratio: 0.1, watch: 0.95 }, { ratio: 0.3, watch: 0.4 }, { ratio: 1, watch: 0.35 },
    ]
    const a = analyseScriptRetention(sections, steil, 300)
    expect(a.notes.some(n => n.includes('Sponsorstrecke kostet'))).toBe(true)
  })

  it('kommt ohne Retention-Daten klar', () => {
    const a = analyseScriptRetention(sections, [], 300)
    expect(a.sections).toEqual([])
    expect(a.notes[0]).toContain('Keine Retention-Daten')
  })

  it('kommt ohne Videolaenge klar', () => {
    expect(analyseScriptRetention(sections, linearCurve, 0).notes[0]).toContain('Videolänge unbekannt')
  })
})

describe('findChannelPatterns', () => {
  it('rechnet die mittlere Klickrate', () => {
    const p = findChannelPatterns([
      { views: 100, impressions: 1000 },
      { views: 300, impressions: 1000 },
    ])
    expect(p.averageCtr).toBe(20)
  })

  it('rechnet den mittleren gesehenen Anteil', () => {
    const p = findChannelPatterns([
      { seconds: 100, avg_view_seconds: 50 },
      { seconds: 200, avg_view_seconds: 100 },
    ])
    expect(p.averageRetention).toBe(50)
  })

  it('erkennt, dass laengere Videos schlechter gesehen werden', () => {
    const p = findChannelPatterns([
      { seconds: 60, avg_view_seconds: 48 },   // 80 %
      { seconds: 300, avg_view_seconds: 150 }, // 50 %
      { seconds: 900, avg_view_seconds: 180 }, // 20 %
    ])
    expect(p.lengthVsRetention).toBeLessThan(-0.4)
    expect(p.notes.some(n => n.includes('kürzer schneiden'))).toBe(true)
  })

  it('erkennt den umgekehrten Fall', () => {
    const p = findChannelPatterns([
      { seconds: 60, avg_view_seconds: 12 },
      { seconds: 300, avg_view_seconds: 150 },
      { seconds: 900, avg_view_seconds: 720 },
    ])
    expect(p.lengthVsRetention).toBeGreaterThan(0.4)
  })

  it('findet den besten Wochentag nach Aufrufen', () => {
    const p = findChannelPatterns([
      { published_at: '2026-07-01', views: 100 },  // Mittwoch
      { published_at: '2026-07-04', views: 900 },  // Samstag
      { published_at: '2026-07-11', views: 800 },  // Samstag
    ])
    expect(p.bestWeekday).toBe('Samstag')
  })

  it('ignoriert Videos ohne Datum oder Zahlen', () => {
    const p = findChannelPatterns([
      { published_at: null, views: 5000 },
      { published_at: 'quatsch', views: 5000 },
      { published_at: '2026-07-04', views: 10 },
    ])
    expect(p.bestWeekday).toBe('Samstag')
  })

  it('braucht mindestens drei Videos fuer den Laengen-Zusammenhang', () => {
    const p = findChannelPatterns([{ seconds: 100, avg_view_seconds: 50 }])
    expect(p.lengthVsRetention).toBeNull()
  })

  it('kommt mit leerer Liste klar', () => {
    const p = findChannelPatterns([])
    expect(p).toMatchObject({ averageCtr: null, averageRetention: null, lengthVsRetention: null, bestWeekday: null })
  })

  it('teilt nicht durch null bei fehlenden Impressionen', () => {
    expect(findChannelPatterns([{ views: 100, impressions: 0 }]).averageCtr).toBeNull()
  })
})
