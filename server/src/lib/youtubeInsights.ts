/**
 * Auswertungen, die YouTube Studio nicht liefern kann.
 *
 * Studio kennt die Retention-Kurve, aber nicht das Skript. CutSheet kennt das
 * Skript mit Timecodes. Erst die Verbindung beider Seiten beantwortet die
 * Frage, die zaehlt: *an welcher Stelle des Skripts* springen die Leute ab -
 * beim Sponsor, nach dem Hook, im zweiten Hauptteil?
 *
 * Reine Rechnerei ohne Netzwerk und Datenbank, damit es testbar bleibt.
 */

// ─── Retention-Kurve ──────────────────────────────────────────────────────────

/**
 * Ein Punkt der Kurve, wie ihn die YouTube Analytics API liefert:
 * `elapsedVideoTimeRatio` (0–1) und `audienceWatchRatio` (1 = alle schauen noch).
 */
export interface RetentionPoint {
  ratio: number
  watch: number
}

/** Rohantwort der Analytics API in Punkte umwandeln. */
export function parseRetentionRows(rows: Array<Array<number>> | null | undefined): RetentionPoint[] {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(r => Array.isArray(r) && r.length >= 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]))
    .map(r => ({ ratio: clamp01(r[0]), watch: Math.max(0, r[1]) }))
    .sort((a, b) => a.ratio - b.ratio)
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Zuschaueranteil an einer bestimmten Sekunde, linear zwischen den Punkten. */
export function watchAtSecond(curve: RetentionPoint[], second: number, videoSeconds: number): number | null {
  if (curve.length === 0 || !videoSeconds || videoSeconds <= 0) return null
  const ratio = clamp01(second / videoSeconds)

  if (ratio <= curve[0].ratio) return curve[0].watch
  const last = curve[curve.length - 1]
  if (ratio >= last.ratio) return last.watch

  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]
    const b = curve[i]
    if (ratio <= b.ratio) {
      const span = b.ratio - a.ratio
      if (span <= 0) return b.watch
      const t = (ratio - a.ratio) / span
      return a.watch + (b.watch - a.watch) * t
    }
  }
  return last.watch
}

// ─── Skript gegen Kurve ───────────────────────────────────────────────────────

export interface TimedSection {
  id?: number
  kind: string
  heading?: string
  startSeconds: number
  estimatedSeconds: number
}

export interface SectionRetention extends TimedSection {
  endSeconds: number
  /** Zuschaueranteil zu Beginn des Abschnitts, in Prozent. */
  watchStart: number | null
  watchEnd: number | null
  /** Verlust ueber den Abschnitt in Prozentpunkten; positiv heisst Abwanderung. */
  dropPercentPoints: number | null
  /** Verlust je Minute - macht unterschiedlich lange Abschnitte vergleichbar. */
  dropPerMinute: number | null
}

export interface ScriptRetentionAnalysis {
  sections: SectionRetention[]
  /** Abschnitt mit dem staerksten Verlust je Minute. */
  worst: SectionRetention | null
  /** Zuschaueranteil nach 30 Sekunden - der Hook-Test. */
  hookRetention: number | null
  /** Abwanderung waehrend der Sponsorstrecke, falls es eine gibt. */
  sponsorDrop: number | null
  notes: string[]
}

/**
 * Legt die Retention-Kurve ueber die Skript-Abschnitte.
 *
 * Der Verlust wird je Minute normiert, weil ein zehnminuetiger Hauptteil
 * natuerlich mehr Zuschauer verliert als ein zwanzigsekuendiger Call to Action -
 * ohne Normierung waere der laengste Abschnitt immer der vermeintlich schlechteste.
 */
export function analyseScriptRetention(
  sections: TimedSection[],
  curve: RetentionPoint[],
  videoSeconds: number
): ScriptRetentionAnalysis {
  const notes: string[] = []

  if (curve.length === 0) {
    return { sections: [], worst: null, hookRetention: null, sponsorDrop: null, notes: ['Keine Retention-Daten vorhanden.'] }
  }
  if (!videoSeconds || videoSeconds <= 0) {
    return { sections: [], worst: null, hookRetention: null, sponsorDrop: null, notes: ['Videolänge unbekannt.'] }
  }

  const analysed: SectionRetention[] = sections.map(s => {
    const endSeconds = s.startSeconds + Math.max(0, s.estimatedSeconds)
    const startWatch = watchAtSecond(curve, s.startSeconds, videoSeconds)
    const endWatch = watchAtSecond(curve, endSeconds, videoSeconds)

    const watchStart = startWatch === null ? null : round1(startWatch * 100)
    const watchEnd = endWatch === null ? null : round1(endWatch * 100)
    const drop = watchStart !== null && watchEnd !== null ? round1(watchStart - watchEnd) : null

    const minutes = Math.max(0, s.estimatedSeconds) / 60
    const dropPerMinute = drop !== null && minutes > 0 ? round1(drop / minutes) : null

    return { ...s, endSeconds, watchStart, watchEnd, dropPercentPoints: drop, dropPerMinute }
  })

  const withDrop = analysed.filter(s => s.dropPerMinute !== null)
  const worst = withDrop.length > 0
    ? withDrop.reduce((a, b) => ((b.dropPerMinute as number) > (a.dropPerMinute as number) ? b : a))
    : null

  const hookWatch = watchAtSecond(curve, 30, videoSeconds)
  const hookRetention = hookWatch === null ? null : round1(hookWatch * 100)

  const sponsorSections = analysed.filter(s => s.kind === 'sponsor' && s.dropPercentPoints !== null)
  const sponsorDrop = sponsorSections.length > 0
    ? round1(sponsorSections.reduce((n, s) => n + (s.dropPercentPoints as number), 0))
    : null

  if (hookRetention !== null) {
    if (hookRetention < 60) notes.push(`Nach 30 Sekunden sind noch ${hookRetention} % dabei - der Einstieg verliert zu früh.`)
    else if (hookRetention >= 75) notes.push(`Nach 30 Sekunden noch ${hookRetention} % - der Hook trägt.`)
    else notes.push(`Nach 30 Sekunden noch ${hookRetention} % - brauchbar, aber ausbaufähig.`)
  }
  if (worst && (worst.dropPerMinute as number) > 0) {
    notes.push(`Stärkster Verlust in „${worst.heading || worst.kind}“: ${worst.dropPerMinute} Prozentpunkte je Minute.`)
  }
  if (sponsorDrop !== null) {
    notes.push(sponsorDrop > 10
      ? `Die Sponsorstrecke kostet ${sponsorDrop} Prozentpunkte - kürzer oder später platzieren.`
      : `Die Sponsorstrecke kostet ${sponsorDrop} Prozentpunkte, das ist unauffällig.`)
  }

  return { sections: analysed, worst, hookRetention, sponsorDrop, notes }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ─── Vergleich ueber mehrere Videos ───────────────────────────────────────────

export interface VideoSummary {
  id?: number
  title?: string
  /** Laenge in Sekunden. */
  seconds?: number
  views?: number
  impressions?: number
  avg_view_seconds?: number
  published_at?: string | null
  /** Aus dem Skript: Art des ersten Abschnitts, Wortzahl des Hooks. */
  hook_words?: number
}

export interface ChannelPatterns {
  /** Klickrate im Mittel ueber alle Videos mit Impressionen. */
  averageCtr: number | null
  /** Gesehener Anteil im Mittel. */
  averageRetention: number | null
  /**
   * Zusammenhang zwischen Videolaenge und gesehenem Anteil, als Korrelation
   * zwischen -1 und 1. Negativ heisst: laengere Videos werden anteilig
   * schlechter zu Ende geschaut.
   */
  lengthVsRetention: number | null
  /** Wochentag mit dem besten Schnitt an Aufrufen. */
  bestWeekday: string | null
  notes: string[]
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

/**
 * Sucht Muster ueber den ganzen Kanal. Studio zeigt die Zahlen je Video;
 * interessant wird es erst im Vergleich - welche Laenge, welcher Wochentag,
 * welcher Hook funktioniert bei *diesem* Kanal.
 */
export function findChannelPatterns(videos: VideoSummary[]): ChannelPatterns {
  const notes: string[] = []

  const withCtr = videos.filter(v => (v.impressions ?? 0) > 0 && (v.views ?? 0) >= 0)
  const averageCtr = withCtr.length
    ? round1(withCtr.reduce((n, v) => n + ((v.views as number) / (v.impressions as number)) * 100, 0) / withCtr.length)
    : null

  const withRet = videos.filter(v => (v.seconds ?? 0) > 0 && (v.avg_view_seconds ?? 0) > 0)
  const averageRetention = withRet.length
    ? round1(withRet.reduce((n, v) => n + ((v.avg_view_seconds as number) / (v.seconds as number)) * 100, 0) / withRet.length)
    : null

  const lengthVsRetention = withRet.length >= 3
    ? round2(correlation(
        withRet.map(v => v.seconds as number),
        withRet.map(v => (v.avg_view_seconds as number) / (v.seconds as number))
      ))
    : null

  // Wochentag mit dem besten Aufruf-Schnitt
  const byWeekday = new Map<number, number[]>()
  for (const v of videos) {
    if (!v.published_at || !Number.isFinite(v.views ?? NaN)) continue
    const t = new Date(v.published_at)
    if (Number.isNaN(t.getTime())) continue
    const day = t.getDay()
    const list = byWeekday.get(day)
    if (list) list.push(v.views as number)
    else byWeekday.set(day, [v.views as number])
  }
  let bestWeekday: string | null = null
  let bestAverage = -1
  for (const [day, views] of byWeekday) {
    const avg = views.reduce((a, b) => a + b, 0) / views.length
    if (avg > bestAverage) { bestAverage = avg; bestWeekday = WEEKDAYS[day] }
  }

  if (averageCtr !== null) notes.push(`Klickrate im Schnitt ${averageCtr} % über ${withCtr.length} Videos.`)
  if (averageRetention !== null) notes.push(`Im Schnitt werden ${averageRetention} % der Laufzeit gesehen.`)
  if (lengthVsRetention !== null) {
    if (lengthVsRetention < -0.4) notes.push('Längere Videos werden anteilig deutlich schlechter zu Ende gesehen - kürzer schneiden lohnt.')
    else if (lengthVsRetention > 0.4) notes.push('Längere Videos halten hier besser - das Publikum bleibt bei mehr Tiefe dran.')
    else notes.push('Zwischen Länge und gesehenem Anteil zeigt sich kein klarer Zusammenhang.')
  }
  if (bestWeekday && byWeekday.size > 1) {
    notes.push(`Bester Wochentag nach Aufrufen: ${bestWeekday}.`)
  }

  return { averageCtr, averageRetention, lengthVsRetention, bestWeekday, notes }
}

/** Pearson-Korrelation; 0 wenn eine Seite keine Streuung hat. */
function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? 0 : num / den
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
