/**
 * Kennzahlen und Regeln rund um ein Creator-Video, die ueber das reine Skript
 * hinausgehen: Ideenbewertung, Upload-Checkliste, Shorts-Auskopplungen,
 * Rechte an verwendetem Material, Performance nach Veroeffentlichung und der
 * Veroeffentlichungsrhythmus.
 *
 * Alles hier ist bewusst reine Rechnerei ohne Datenbank — so laesst es sich
 * testen und sowohl im Server als auch im PDF verwenden.
 */

// ─── Ideen-Backlog ────────────────────────────────────────────────────────────

/**
 * Prioritaet einer Idee aus Wirkung und Aufwand (je 1–5).
 *
 * Bewusst Wirkung geteilt durch Aufwand statt Differenz: eine Idee mit
 * Wirkung 4 und Aufwand 1 soll deutlich vor einer mit 5 und 4 liegen, weil
 * Creator an Produktionszeit sterben, nicht an Ideenmangel. Skaliert auf 0–100.
 */
export function ideaScore(impact: number, effort: number): number {
  const i = clamp(Math.round(impact), 1, 5)
  const e = clamp(Math.round(effort), 1, 5)
  // i/e liegt zwischen 0.2 (1/5) und 5 (5/1)
  const ratio = i / e
  return Math.round(((ratio - 0.2) / (5 - 0.2)) * 100)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))
}

// ─── Upload-Checkliste ────────────────────────────────────────────────────────

/**
 * Die Dinge, die man beim Hochladen vergisst. Wird beim Anlegen eines Videos
 * mitgeliefert, damit die Liste da ist, bevor sie gebraucht wird.
 */
export const UPLOAD_CHECKLIST: string[] = [
  'Thumbnail hochgeladen (1280×720, unter 2 MB)',
  'Titel final, unter 60 Zeichen',
  'Beschreibung mit Links und Kapitelmarken',
  'Kapitelmarken beginnen bei 0:00',
  'Playlist zugeordnet',
  'Endcard gesetzt (letzte 20 Sekunden)',
  'Infokarten platziert',
  'Untertitel geprueft (automatische korrigiert)',
  'Sichtbarkeit und Veroeffentlichungszeit gesetzt',
  'Zielgruppe "nicht fuer Kinder" korrekt beantwortet',
  'Werbekennzeichnung gesetzt, falls bezahlt',
  'Angepinnter Kommentar vorbereitet',
  'Shorts-Auskopplung geplant',
  'Community-Post zum Release vorbereitet',
]

// ─── Shorts und Auskopplungen ─────────────────────────────────────────────────

/** Maximale Laenge eines Shorts in Sekunden. */
export const SHORTS_MAX_SECONDS = 180

export interface Clip {
  title?: string
  start_seconds?: number
  end_seconds?: number
  platform?: string
}

export interface ClipCheck {
  durationSeconds: number
  /** Beanstandungen; leer heisst brauchbar. */
  problems: string[]
  valid: boolean
}

/**
 * Prueft eine Auskopplung. Shorts sind laengenbegrenzt, und ein Clip ohne
 * sinnvolle Dauer ist im Schnitt nichts wert.
 */
export function checkClip(clip: Clip, videoSeconds?: number): ClipCheck {
  const start = Math.max(0, Math.floor(clip.start_seconds ?? 0))
  const end = Math.max(0, Math.floor(clip.end_seconds ?? 0))
  const duration = end - start
  const problems: string[] = []

  if (end <= start) {
    problems.push('Ende muss nach dem Anfang liegen.')
  } else {
    if (duration < 5) problems.push(`Mit ${duration}s zu kurz — unter 5s traegt kein Clip.`)
    const isShortFormat = /short|reel|tiktok/i.test(String(clip.platform ?? ''))
    if (isShortFormat && duration > SHORTS_MAX_SECONDS) {
      problems.push(`${duration}s ueberschreitet das Limit von ${SHORTS_MAX_SECONDS}s fuer dieses Format.`)
    }
  }

  if (videoSeconds != null && videoSeconds > 0 && end > videoSeconds) {
    problems.push('Der Clip endet nach dem Ende des Videos.')
  }

  return { durationSeconds: Math.max(0, duration), problems, valid: problems.length === 0 }
}

// ─── Rechte am verwendeten Material ───────────────────────────────────────────

export type ClaimRisk = 'keins' | 'moeglich' | 'hoch'

export interface Asset {
  kind?: string
  name?: string
  license?: string
  claim_risk?: string
}

/**
 * Bewertet das Content-ID-Risiko eines Videos. Ein einziger ungeklaerter Track
 * kann die Monetarisierung des ganzen Videos kosten, deshalb schlaegt das
 * hoechste Einzelrisiko durch und fehlende Lizenzangaben zaehlen als Risiko.
 */
export function assessRights(assets: Asset[]): {
  risk: ClaimRisk
  unlicensed: number
  problems: string[]
} {
  const problems: string[] = []
  let unlicensed = 0
  let risk: ClaimRisk = 'keins'

  const rank: Record<ClaimRisk, number> = { keins: 0, moeglich: 1, hoch: 2 }
  const bump = (r: ClaimRisk) => { if (rank[r] > rank[risk]) risk = r }

  for (const a of assets) {
    const name = String(a.name ?? '').trim() || 'Unbenannt'
    const declared = String(a.claim_risk ?? 'keins') as ClaimRisk
    if (rank[declared] !== undefined) bump(declared)

    if (!String(a.license ?? '').trim()) {
      unlicensed++
      problems.push(`"${name}": keine Lizenz hinterlegt.`)
      bump('moeglich')
    }
    if (declared === 'hoch') {
      problems.push(`"${name}": hohes Content-ID-Risiko.`)
    }
  }

  return { risk, unlicensed, problems }
}

// ─── Performance nach Veroeffentlichung ───────────────────────────────────────

export interface Performance {
  views?: number
  impressions?: number
  avg_view_seconds?: number
  likes?: number
  comments?: number
  subs_gained?: number
}

export interface PerformanceInsight {
  /** Klickrate in Prozent, null ohne Impressionen. */
  ctr: number | null
  /** Anteil der gesehenen Laufzeit in Prozent, null ohne Videolaenge. */
  retention: number | null
  /** Likes je 1000 Aufrufe. */
  engagementPer1000: number | null
  /** Aufrufe je gewonnenem Abo, null ohne Abos. */
  viewsPerSub: number | null
  /** Klartext-Einordnung, an den ueblichen YouTube-Richtwerten. */
  notes: string[]
}

/**
 * Ordnet die manuell gepflegten Zahlen ein. Richtwerte bewusst konservativ:
 * YouTube nennt 2–10 % als normale Klickrate, 50 % gesehene Laufzeit gilt als
 * gut. Die Hinweise sollen zum Nachdenken anregen, nicht Wahrheit behaupten.
 */
export function analysePerformance(p: Performance, videoSeconds?: number): PerformanceInsight {
  const views = Math.max(0, p.views ?? 0)
  const impressions = Math.max(0, p.impressions ?? 0)
  const avg = Math.max(0, p.avg_view_seconds ?? 0)

  const ctr = impressions > 0 ? round1((views / impressions) * 100) : null
  const retention = videoSeconds && videoSeconds > 0 ? round1((avg / videoSeconds) * 100) : null
  const engagementPer1000 = views > 0 ? round1(((p.likes ?? 0) / views) * 1000) : null
  const viewsPerSub = (p.subs_gained ?? 0) > 0 ? Math.round(views / (p.subs_gained as number)) : null

  const notes: string[] = []
  if (ctr !== null) {
    if (ctr < 2) notes.push(`Klickrate ${ctr} % liegt unter dem ueblichen Bereich — Titel und Thumbnail pruefen.`)
    else if (ctr > 10) notes.push(`Klickrate ${ctr} % ist ueberdurchschnittlich — Titel und Thumbnail funktionieren.`)
    else notes.push(`Klickrate ${ctr} % liegt im ueblichen Bereich von 2 bis 10 %.`)
  }
  if (retention !== null) {
    if (retention < 30) notes.push(`Im Schnitt nur ${retention} % gesehen — der Einstieg haelt nicht.`)
    else if (retention >= 50) notes.push(`${retention} % gesehen — das ist ein guter Wert.`)
    else notes.push(`${retention} % gesehen — solide, Luft nach oben im Mittelteil.`)
  }
  if (viewsPerSub !== null) {
    notes.push(`Ein neues Abo je ${viewsPerSub} Aufrufe.`)
  }

  return { ctr, retention, engagementPer1000, viewsPerSub, notes }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ─── Veroeffentlichungsrhythmus ───────────────────────────────────────────────

export interface CadenceInsight {
  /** Durchschnittlicher Abstand zwischen Veroeffentlichungen in Tagen. */
  averageDays: number | null
  /** Laengste Pause in Tagen. */
  longestGapDays: number | null
  count: number
  notes: string[]
}

/**
 * Wie regelmaessig wird veroeffentlicht? Regelmaessigkeit schlaegt Frequenz —
 * deshalb wird neben dem Schnitt auch die groesste Luecke ausgewiesen.
 */
export function analyseCadence(dates: Array<string | null | undefined>): CadenceInsight {
  const times = dates
    .map(d => (d ? new Date(d).getTime() : NaN))
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b)

  if (times.length < 2) {
    return {
      averageDays: null,
      longestGapDays: null,
      count: times.length,
      notes: times.length === 0
        ? ['Noch keine Veroeffentlichung geplant oder erfasst.']
        : ['Erst eine Veroeffentlichung — fuer einen Rhythmus braucht es mindestens zwei.'],
    }
  }

  const DAY = 86_400_000
  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY)

  const average = round1(gaps.reduce((a, b) => a + b, 0) / gaps.length)
  const longest = round1(Math.max(...gaps))
  const shortest = round1(Math.min(...gaps))

  const notes: string[] = [`Im Schnitt alle ${average} Tage, laengste Pause ${longest} Tage.`]
  // Bewusst laengste gegen kuerzeste Pause statt gegen den Schnitt: ein einzelner
  // Ausreisser zieht den Schnitt selbst mit hoch und wuerde sich so verstecken.
  if (longest >= shortest * 3 && longest - shortest > 7) {
    notes.push('Der Rhythmus schwankt stark — Regelmaessigkeit wiegt bei YouTube schwerer als Frequenz.')
  }

  return { averageDays: average, longestGapDays: longest, count: times.length, notes }
}
