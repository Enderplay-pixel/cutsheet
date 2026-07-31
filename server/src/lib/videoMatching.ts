/**
 * Zuordnung zwischen CutSheet-Videos und den Videos auf dem YouTube-Kanal.
 *
 * Ohne diese Zuordnung muesste man jeden Video-Link von Hand eintragen. Die
 * Titel liegen aber auf beiden Seiten vor, und in der Praxis heisst ein Video
 * auf YouTube fast genauso wie im Skript — nur mit Zusaetzen wie "(2026)",
 * Emojis oder einem Kanalnamen hinten dran.
 */

export interface Candidate {
  videoId: string
  title: string
  publishedAt?: string | null
}

export interface MatchResult {
  videoId: string | null
  title: string | null
  /** 0 bis 1. Ab 0.82 wird automatisch verknuepft. */
  score: number
  /** Zweitbester Treffer — bei knappem Abstand wird nicht automatisch gewaehlt. */
  runnerUpScore: number
  auto: boolean
}

/** Ab hier gilt ein Treffer als sicher genug fuer eine automatische Zuordnung. */
export const AUTO_MATCH_THRESHOLD = 0.82
/** Der beste Treffer muss den zweitbesten um diesen Abstand schlagen. */
export const AUTO_MATCH_MARGIN = 0.08

/**
 * Titel auf das Wesentliche reduzieren: Kleinschreibung, Emojis und Satzzeichen
 * raus, Mehrfach-Leerzeichen zusammen. Deutsche Umlaute werden vereinheitlicht,
 * damit "Grün" und "Gruen" zusammenfinden.
 */
export function normalizeTitle(title: string): string {
  return String(title ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    // Alles ausser Buchstaben und Ziffern faellt weg — das trifft auch Emojis
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Wortmenge eines Titels ohne Fuellwoerter. */
const STOPWORDS = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'mit', 'von', 'fuer', 'im', 'in', 'am',
  'the', 'a', 'an', 'and', 'or', 'with', 'of', 'for', 'to', 'my', 'i',
])

function contentWords(title: string): string[] {
  return normalizeTitle(title).split(' ').filter(w => w.length > 0 && !STOPWORDS.has(w))
}

/**
 * Aehnlichkeit zweier Titel zwischen 0 und 1.
 *
 * Kombiniert zwei Sichtweisen, weil beide allein danebenliegen: Die Wortmenge
 * ignoriert die Reihenfolge und erkennt Zusaetze am Ende, verliert aber bei
 * Tippfehlern. Die Zeichenaehnlichkeit faengt Tippfehler, verwechselt aber
 * Titel mit gleichen Wortstaemmen. Ein Titel, der komplett im anderen steckt,
 * gilt als sehr aehnlich — genau der Fall "Titel + Zusatz".
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const wa = contentWords(a)
  const wb = contentWords(b)
  if (wa.length === 0 || wb.length === 0) return 0

  const setA = [...new Set(wa)]
  const setB = [...new Set(wb)]
  const shared = sharedWordScore(setA, setB)

  // Anteil der gemeinsamen Woerter am kleineren Titel: erkennt "Titel + Zusatz"
  const containment = shared / Math.min(setA.length, setB.length)
  // Jaccard: bestraft, wenn ein Titel viel mehr Inhalt hat
  const jaccard = shared / (setA.length + setB.length - shared)

  const charScore = charSimilarity(na, nb)

  // Gewichtung: Wortübereinstimmung traegt am meisten, Zeichenaehnlichkeit
  // stuetzt bei Tippfehlern
  return clamp01(0.5 * containment + 0.25 * jaccard + 0.25 * charScore)
}

/** Ab dieser Aehnlichkeit gelten zwei Woerter als dasselbe Wort. */
const WORD_MATCH_THRESHOLD = 0.7

/**
 * Wie viele Woerter haben beide Titel gemeinsam — unscharf gezaehlt.
 *
 * Ein exakter Mengenvergleich wuerde "grosses" und "grosse" als voellig
 * verschiedene Woerter behandeln und einem einzigen Tippfehler oder einer
 * Pluralform die ganze Anrechnung nehmen. Deshalb wird jedes Wort mit seinem
 * aehnlichsten Gegenstueck gepaart und anteilig gewertet. Jedes Wort kann nur
 * einmal vergeben werden, sonst wuerde ein haeufiges Wort mehrfach zaehlen.
 */
function sharedWordScore(wordsA: string[], wordsB: string[]): number {
  const available = [...wordsB]
  let total = 0

  for (const word of wordsA) {
    let bestIndex = -1
    let bestScore = 0
    for (let i = 0; i < available.length; i++) {
      const score = word === available[i] ? 1 : charSimilarity(word, available[i])
      if (score > bestScore) { bestScore = score; bestIndex = i }
    }
    if (bestIndex >= 0 && bestScore >= WORD_MATCH_THRESHOLD) {
      total += bestScore
      available.splice(bestIndex, 1)
    }
  }
  return total
}

/** Aehnlichkeit auf Zeichenebene ueber gemeinsame Zeichenpaare (Dice). */
function charSimilarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const out: string[] = []
    const clean = s.replace(/\s/g, '')
    for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2))
    return out
  }
  const ba = bigrams(a)
  const bb = bigrams(b)
  if (ba.length === 0 || bb.length === 0) return a === b ? 1 : 0

  const counts = new Map<string, number>()
  for (const g of ba) counts.set(g, (counts.get(g) ?? 0) + 1)

  let hits = 0
  for (const g of bb) {
    const c = counts.get(g) ?? 0
    if (c > 0) { hits++; counts.set(g, c - 1) }
  }
  return (2 * hits) / (ba.length + bb.length)
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * Sucht zu einem Titel das passende Video auf dem Kanal.
 *
 * Automatisch zugeordnet wird nur, wenn der beste Treffer sicher genug ist UND
 * den zweitbesten deutlich schlaegt. Bei zwei aehnlich guten Kandidaten — etwa
 * "Teil 1" und "Teil 2" — waere eine Vertauschung schlimmer als gar keine
 * Zuordnung, weil sie unbemerkt falsche Zahlen ans Video haengt.
 */
export function findBestMatch(title: string, candidates: Candidate[]): MatchResult {
  const empty: MatchResult = { videoId: null, title: null, score: 0, runnerUpScore: 0, auto: false }
  if (!String(title ?? '').trim() || candidates.length === 0) return empty

  const scored = candidates
    .map(c => ({ c, score: titleSimilarity(title, c.title) }))
    .sort((x, y) => y.score - x.score)

  const best = scored[0]
  const runnerUp = scored[1]?.score ?? 0
  if (!best || best.score === 0) return empty

  return {
    videoId: best.c.videoId,
    title: best.c.title,
    score: round2(best.score),
    runnerUpScore: round2(runnerUp),
    auto: best.score >= AUTO_MATCH_THRESHOLD && best.score - runnerUp >= AUTO_MATCH_MARGIN,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface Assignment {
  id: number
  title: string
  match: MatchResult
}

/**
 * Ordnet mehrere CutSheet-Videos zu, ohne ein YouTube-Video doppelt zu vergeben.
 *
 * Die sichersten Zuordnungen kommen zuerst zum Zug: Sonst koennte ein schwacher
 * Treffer ein Video wegschnappen, das anderswo eindeutig gepasst haette.
 */
export function assignAll(
  videos: Array<{ id: number; title: string }>,
  candidates: Candidate[]
): Assignment[] {
  const scored = videos.map(v => ({ v, match: findBestMatch(v.title, candidates) }))
  scored.sort((a, b) => b.match.score - a.match.score)

  const taken = new Set<string>()
  const result: Assignment[] = []

  for (const { v, match } of scored) {
    if (match.videoId && !taken.has(match.videoId)) {
      taken.add(match.videoId)
      result.push({ id: v.id, title: v.title, match })
    } else if (match.videoId) {
      // Bereits vergeben — nächstbesten freien Kandidaten suchen
      const free = candidates.filter(c => !taken.has(c.videoId))
      const alt = findBestMatch(v.title, free)
      if (alt.videoId) taken.add(alt.videoId)
      result.push({ id: v.id, title: v.title, match: alt })
    } else {
      result.push({ id: v.id, title: v.title, match })
    }
  }

  return result
}
