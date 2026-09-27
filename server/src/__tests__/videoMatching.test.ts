import { describe, it, expect } from 'vitest'
import {
  normalizeTitle, titleSimilarity, findBestMatch, assignAll,
  AUTO_MATCH_THRESHOLD, type Candidate,
} from '../lib/videoMatching'

describe('normalizeTitle', () => {
  it('macht klein und wirft Satzzeichen weg', () => {
    expect(normalizeTitle('Dear Evan Hansen: Announcement!')).toBe('dear evan hansen announcement')
  })

  it('entfernt Emojis', () => {
    expect(normalizeTitle('Mein Setup 🔥🎬 2026')).toBe('mein setup 2026')
  })

  it('vereinheitlicht Umlaute', () => {
    expect(normalizeTitle('Grün und Größe')).toBe(normalizeTitle('Gruen und Groesse'))
  })

  it('fasst Mehrfach-Leerzeichen zusammen', () => {
    expect(normalizeTitle('  a   b  ')).toBe('a b')
  })

  it('kommt mit leerer Eingabe klar', () => {
    expect(normalizeTitle('')).toBe('')
    expect(normalizeTitle(undefined as any)).toBe('')
  })
})

describe('titleSimilarity', () => {
  it('gibt identischen Titeln die volle Punktzahl', () => {
    expect(titleSimilarity('Mein Video', 'Mein Video')).toBe(1)
  })

  it('ignoriert Gross- und Kleinschreibung sowie Satzzeichen', () => {
    expect(titleSimilarity('Dear Evan Hansen announcement', 'DEAR EVAN HANSEN - ANNOUNCEMENT!')).toBe(1)
  })

  it('bewertet Titel mit Zusatz sehr hoch', () => {
    expect(titleSimilarity('Dear Evan Hansen announcement', 'Dear Evan Hansen announcement (2026) 🎭'))
      .toBeGreaterThan(AUTO_MATCH_THRESHOLD)
  })

  it('verzeiht einen Tippfehler', () => {
    expect(titleSimilarity('Mein grosses Studio Update', 'Mein grosse Studio Update')).toBeGreaterThan(0.8)
  })

  it('trennt inhaltlich verschiedene Titel', () => {
    expect(titleSimilarity('Wie ich Videos schneide', 'Meine neue Kamera')).toBeLessThan(0.3)
  })

  it('unterscheidet Folgen derselben Reihe', () => {
    // Aehnlich, aber nicht identisch - das darf nicht automatisch zugeordnet werden
    const s = titleSimilarity('Studio Tour Teil 1', 'Studio Tour Teil 2')
    expect(s).toBeGreaterThan(0.5)
    expect(s).toBeLessThan(1)
  })

  it('liefert 0 bei leerem Titel', () => {
    expect(titleSimilarity('', 'irgendwas')).toBe(0)
    expect(titleSimilarity('nur Fuellwoerter', '')).toBe(0)
  })

  it('liefert 0, wenn nur Fuellwoerter uebrig bleiben', () => {
    expect(titleSimilarity('der die das', 'the a an')).toBe(0)
  })
})

describe('findBestMatch', () => {
  const candidates: Candidate[] = [
    { videoId: 'aaa', title: 'Dear Evan Hansen announcement (2026)' },
    { videoId: 'bbb', title: 'Wie ich meine Videos schneide' },
    { videoId: 'ccc', title: 'Meine neue Kamera im Test' },
  ]

  it('findet den passenden Kandidaten', () => {
    const m = findBestMatch('Dear Evan Hansen announcement', candidates)
    expect(m.videoId).toBe('aaa')
    expect(m.auto).toBe(true)
  })

  it('weist den Zweitbesten mit aus', () => {
    const m = findBestMatch('Dear Evan Hansen announcement', candidates)
    expect(m.runnerUpScore).toBeLessThan(m.score)
  })

  it('ordnet bei zwei aehnlich guten Kandidaten nicht automatisch zu', () => {
    const folgen: Candidate[] = [
      { videoId: 'x1', title: 'Studio Tour Teil 1' },
      { videoId: 'x2', title: 'Studio Tour Teil 2' },
    ]
    const m = findBestMatch('Studio Tour', folgen)
    // Ein Treffer wird vorgeschlagen, aber nicht automatisch gesetzt
    expect(m.videoId).not.toBeNull()
    expect(m.auto).toBe(false)
  })

  it('liefert nichts bei leerer Kandidatenliste', () => {
    expect(findBestMatch('Titel', [])).toMatchObject({ videoId: null, auto: false })
  })

  it('liefert nichts bei leerem Titel', () => {
    expect(findBestMatch('', candidates)).toMatchObject({ videoId: null, auto: false })
  })

  it('ordnet einen voellig fremden Titel nicht automatisch zu', () => {
    expect(findBestMatch('Rezept fuer Kaesekuchen', candidates).auto).toBe(false)
  })
})

describe('assignAll', () => {
  const candidates: Candidate[] = [
    { videoId: 'aaa', title: 'Dear Evan Hansen announcement (2026)' },
    { videoId: 'bbb', title: 'Wie ich meine Videos schneide' },
    { videoId: 'ccc', title: 'Meine neue Kamera im Test' },
  ]

  it('ordnet mehrere Videos zu', () => {
    const r = assignAll([
      { id: 1, title: 'Dear Evan Hansen announcement' },
      { id: 2, title: 'Meine neue Kamera im Test' },
    ], candidates)
    expect(r.find(x => x.id === 1)?.match.videoId).toBe('aaa')
    expect(r.find(x => x.id === 2)?.match.videoId).toBe('ccc')
  })

  it('vergibt kein YouTube-Video doppelt', () => {
    const r = assignAll([
      { id: 1, title: 'Meine neue Kamera im Test' },
      { id: 2, title: 'Meine neue Kamera im Test' },
    ], candidates)
    const ids = r.map(x => x.match.videoId).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gibt dem sichereren Treffer den Vorrang', () => {
    // Video 2 passt exakt, Video 1 nur vage - Video 2 muss den Kandidaten bekommen
    const r = assignAll([
      { id: 1, title: 'Kamera' },
      { id: 2, title: 'Meine neue Kamera im Test' },
    ], candidates)
    expect(r.find(x => x.id === 2)?.match.videoId).toBe('ccc')
  })

  it('laesst Videos ohne Treffer leer', () => {
    const r = assignAll([{ id: 1, title: 'Voellig anderes Thema xyz' }], candidates)
    expect(r[0].match.auto).toBe(false)
  })

  it('kommt mit leeren Listen klar', () => {
    expect(assignAll([], candidates)).toEqual([])
    expect(assignAll([{ id: 1, title: 'x' }], [])).toHaveLength(1)
  })
})
