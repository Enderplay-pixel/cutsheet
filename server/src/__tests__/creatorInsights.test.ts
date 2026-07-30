import { describe, it, expect } from 'vitest'
import {
  ideaScore,
  checkClip,
  assessRights,
  analysePerformance,
  analyseCadence,
  UPLOAD_CHECKLIST,
  SHORTS_MAX_SECONDS,
} from '../lib/creatorInsights'

describe('ideaScore', () => {
  it('bewertet hohe Wirkung bei kleinem Aufwand am besten', () => {
    expect(ideaScore(5, 1)).toBe(100)
  })

  it('bewertet kleine Wirkung bei hohem Aufwand am schlechtesten', () => {
    expect(ideaScore(1, 5)).toBe(0)
  })

  it('stellt guenstiges Verhaeltnis ueber hohe Einzelwerte', () => {
    // 4 Wirkung bei 1 Aufwand schlaegt 5 Wirkung bei 4 Aufwand
    expect(ideaScore(4, 1)).toBeGreaterThan(ideaScore(5, 4))
  })

  it('liefert fuer gleiche Werte immer dasselbe Ergebnis', () => {
    expect(ideaScore(3, 3)).toBe(ideaScore(5, 5))
  })

  it('begrenzt Werte ausserhalb von 1 bis 5', () => {
    expect(ideaScore(99, 0)).toBe(100)
    expect(ideaScore(-3, 99)).toBe(0)
  })

  it('faengt unsinnige Eingaben ab', () => {
    expect(Number.isFinite(ideaScore(NaN as any, NaN as any))).toBe(true)
  })
})

describe('UPLOAD_CHECKLIST', () => {
  it('deckt die klassischen Vergessenheiten ab', () => {
    const joined = UPLOAD_CHECKLIST.join(' | ').toLowerCase()
    for (const stichwort of ['thumbnail', 'endcard', 'untertitel', 'kapitelmarken', 'playlist', 'kennzeichnung']) {
      expect(joined).toContain(stichwort)
    }
  })

  it('enthaelt keine Dubletten', () => {
    expect(new Set(UPLOAD_CHECKLIST).size).toBe(UPLOAD_CHECKLIST.length)
  })
})

describe('checkClip', () => {
  it('rechnet die Dauer aus Anfang und Ende', () => {
    expect(checkClip({ start_seconds: 30, end_seconds: 75 }).durationSeconds).toBe(45)
  })

  it('akzeptiert einen brauchbaren Clip', () => {
    const c = checkClip({ start_seconds: 10, end_seconds: 40, platform: 'YouTube Shorts' })
    expect(c.valid).toBe(true)
    expect(c.problems).toEqual([])
  })

  it('beanstandet ein Ende vor dem Anfang', () => {
    const c = checkClip({ start_seconds: 60, end_seconds: 30 })
    expect(c.valid).toBe(false)
    expect(c.problems[0]).toContain('Ende muss nach dem Anfang')
  })

  it('beanstandet zu kurze Clips', () => {
    expect(checkClip({ start_seconds: 0, end_seconds: 3 }).problems.some(p => p.includes('zu kurz'))).toBe(true)
  })

  it('beanstandet zu lange Shorts', () => {
    const c = checkClip({ start_seconds: 0, end_seconds: SHORTS_MAX_SECONDS + 1, platform: 'Shorts' })
    expect(c.valid).toBe(false)
    expect(c.problems.some(p => p.includes(String(SHORTS_MAX_SECONDS)))).toBe(true)
  })

  it('laesst dieselbe Laenge auf normalem YouTube durchgehen', () => {
    const c = checkClip({ start_seconds: 0, end_seconds: SHORTS_MAX_SECONDS + 1, platform: 'YouTube' })
    expect(c.valid).toBe(true)
  })

  it('erkennt TikTok und Reels ebenfalls als Kurzformat', () => {
    for (const p of ['TikTok', 'Instagram Reel']) {
      const c = checkClip({ start_seconds: 0, end_seconds: 300, platform: p })
      expect(c.valid).toBe(false)
    }
  })

  it('beanstandet einen Clip hinter dem Videoende', () => {
    const c = checkClip({ start_seconds: 10, end_seconds: 60 }, 45)
    expect(c.problems.some(p => p.includes('nach dem Ende'))).toBe(true)
  })
})

describe('assessRights', () => {
  it('meldet kein Risiko bei sauber lizenziertem Material', () => {
    const r = assessRights([{ name: 'Track A', license: 'Epidemic Sound', claim_risk: 'keins' }])
    expect(r.risk).toBe('keins')
    expect(r.unlicensed).toBe(0)
    expect(r.problems).toEqual([])
  })

  it('zaehlt fehlende Lizenzen und hebt das Risiko an', () => {
    const r = assessRights([{ name: 'Track B' }])
    expect(r.unlicensed).toBe(1)
    expect(r.risk).toBe('moeglich')
    expect(r.problems[0]).toContain('keine Lizenz')
  })

  it('laesst das hoechste Einzelrisiko durchschlagen', () => {
    const r = assessRights([
      { name: 'A', license: 'CC0', claim_risk: 'keins' },
      { name: 'B', license: 'Label', claim_risk: 'hoch' },
    ])
    expect(r.risk).toBe('hoch')
  })

  it('nennt riskante Titel beim Namen', () => {
    const r = assessRights([{ name: 'Chartsong', license: 'keine', claim_risk: 'hoch' }])
    expect(r.problems.some(p => p.includes('Chartsong'))).toBe(true)
  })

  it('kommt mit leerer Liste klar', () => {
    expect(assessRights([])).toMatchObject({ risk: 'keins', unlicensed: 0 })
  })
})

describe('analysePerformance', () => {
  it('rechnet die Klickrate aus Aufrufen und Impressionen', () => {
    expect(analysePerformance({ views: 500, impressions: 10000 }).ctr).toBe(5)
  })

  it('liefert ohne Impressionen keine Klickrate', () => {
    expect(analysePerformance({ views: 500 }).ctr).toBeNull()
  })

  it('rechnet die gesehene Laufzeit gegen die Videolaenge', () => {
    expect(analysePerformance({ avg_view_seconds: 120 }, 480).retention).toBe(25)
  })

  it('warnt bei schwacher Klickrate', () => {
    const r = analysePerformance({ views: 100, impressions: 10000 })
    expect(r.notes.some(n => n.includes('unter dem ueblichen'))).toBe(true)
  })

  it('lobt eine starke Klickrate', () => {
    const r = analysePerformance({ views: 1500, impressions: 10000 })
    expect(r.notes.some(n => n.includes('ueberdurchschnittlich'))).toBe(true)
  })

  it('warnt bei schwacher gesehener Laufzeit', () => {
    const r = analysePerformance({ avg_view_seconds: 30 }, 600)
    expect(r.notes.some(n => n.includes('haelt nicht'))).toBe(true)
  })

  it('rechnet Likes je 1000 Aufrufe', () => {
    expect(analysePerformance({ views: 2000, likes: 100 }).engagementPer1000).toBe(50)
  })

  it('rechnet Aufrufe je gewonnenem Abo', () => {
    expect(analysePerformance({ views: 1000, subs_gained: 20 }).viewsPerSub).toBe(50)
  })

  it('teilt nicht durch null', () => {
    const r = analysePerformance({})
    expect(r).toMatchObject({ ctr: null, retention: null, engagementPer1000: null, viewsPerSub: null })
  })
})

describe('analyseCadence', () => {
  it('rechnet den durchschnittlichen Abstand', () => {
    const r = analyseCadence(['2026-07-01', '2026-07-08', '2026-07-15'])
    expect(r.averageDays).toBe(7)
    expect(r.count).toBe(3)
  })

  it('weist die laengste Pause aus', () => {
    const r = analyseCadence(['2026-07-01', '2026-07-08', '2026-08-08'])
    expect(r.longestGapDays).toBe(31)
  })

  it('warnt bei stark schwankendem Rhythmus', () => {
    const r = analyseCadence(['2026-07-01', '2026-07-02', '2026-09-01'])
    expect(r.notes.some(n => n.includes('schwankt stark'))).toBe(true)
  })

  it('sortiert unsortierte Daten', () => {
    const r = analyseCadence(['2026-07-15', '2026-07-01', '2026-07-08'])
    expect(r.averageDays).toBe(7)
  })

  it('ignoriert leere und kaputte Daten', () => {
    const r = analyseCadence([null, undefined, 'quatsch', '2026-07-01', '2026-07-08'])
    expect(r.count).toBe(2)
    expect(r.averageDays).toBe(7)
  })

  it('braucht mindestens zwei Termine fuer einen Rhythmus', () => {
    expect(analyseCadence(['2026-07-01']).averageDays).toBeNull()
    expect(analyseCadence([]).notes[0]).toContain('Noch keine')
  })
})
