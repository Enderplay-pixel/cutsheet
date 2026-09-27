/**
 * Creator-Modus: Logik für YouTube-/Content-Videos.
 *
 * Ein Video ist kein Drehbuch. Es gibt keine Szenen mit INT./EXT. und keine
 * "eine Seite ≈ eine Minute"-Regel — die Länge ergibt sich aus dem gesprochenen
 * Text. Deshalb rechnet dieses Modul in Wörtern und Sekunden statt in Seiten,
 * und die Gliederung folgt der YouTube-Dramaturgie statt dem Master Scene
 * Format.
 */
import { pdfFontFaces, PDF_SANS, PDF_MONO } from './pdfFonts'

/** Sprechgeschwindigkeit für die Laufzeitschätzung (Wörter pro Minute). */
export const DEFAULT_WPM = 150

export type SectionKind = 'hook' | 'intro' | 'sponsor' | 'segment' | 'broll' | 'cta' | 'outro'

export const SECTION_LABELS: Record<SectionKind, string> = {
  hook: 'Hook',
  intro: 'Intro',
  sponsor: 'Sponsor',
  segment: 'Segment',
  broll: 'B-Roll',
  cta: 'Call to Action',
  outro: 'Outro',
}

/** Vorlage für ein neues Video — die übliche Abfolge. */
export const DEFAULT_SECTIONS: Array<{ kind: SectionKind; heading: string; target_seconds: number }> = [
  { kind: 'hook', heading: 'Hook', target_seconds: 15 },
  { kind: 'intro', heading: 'Intro', target_seconds: 30 },
  { kind: 'segment', heading: 'Hauptteil 1', target_seconds: 120 },
  { kind: 'segment', heading: 'Hauptteil 2', target_seconds: 120 },
  { kind: 'cta', heading: 'Call to Action', target_seconds: 20 },
  { kind: 'outro', heading: 'Outro', target_seconds: 15 },
]

/** Abschnitte, die keinen gesprochenen Text haben und deshalb nicht mitzählen. */
const SILENT_KINDS: SectionKind[] = ['broll']

// ─── Wörter und Dauer ─────────────────────────────────────────────────────────

/**
 * Zählt Wörter im gesprochenen Text. Regieanweisungen in eckigen Klammern
 * ([Schnitt], [Einblendung: …]) werden nicht mitgesprochen und fallen raus.
 */
export function countWords(text: string): number {
  const spoken = String(text ?? '').replace(/\[[^\]]*\]/g, ' ')
  const words = spoken.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w))
  return words.length
}

/** Geschätzte Sprechdauer in Sekunden, aufgerundet auf ganze Sekunden. */
export function estimateSeconds(text: string, wpm: number = DEFAULT_WPM): number {
  const rate = wpm > 0 ? wpm : DEFAULT_WPM
  return Math.ceil((countWords(text) / rate) * 60)
}

/** Sekunden als Timecode: m:ss, ab einer Stunde h:mm:ss. */
export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export interface ScriptSection {
  id?: number
  kind: SectionKind | string
  heading?: string
  spoken?: string
  visuals?: string
  /** Soll-Länge in Sekunden; 0 = kein Ziel gesetzt. */
  target_seconds?: number
}

export interface TimedSection extends ScriptSection {
  kind: SectionKind
  words: number
  estimatedSeconds: number
  /** Startzeit im Video, aus den vorherigen Abschnitten summiert. */
  startSeconds: number
  timecode: string
  /** Abweichung von der Soll-Länge in Sekunden; null ohne Ziel. */
  deltaSeconds: number | null
}

export interface Timeline {
  sections: TimedSection[]
  totalSeconds: number
  totalWords: number
  targetSeconds: number
}

/**
 * Rechnet die Abschnitte auf eine Zeitachse. B-Roll-Abschnitte belegen ihre
 * Soll-Länge, weil dort nichts gesprochen wird.
 */
export function buildTimeline(sections: ScriptSection[], wpm: number = DEFAULT_WPM): Timeline {
  let cursor = 0
  let totalWords = 0
  let targetSeconds = 0

  const timed = sections.map(s => {
    const kind = (SECTION_LABELS[s.kind as SectionKind] ? s.kind : 'segment') as SectionKind
    const target = Math.max(0, Math.floor(s.target_seconds ?? 0))
    const words = SILENT_KINDS.includes(kind) ? 0 : countWords(s.spoken ?? '')
    const spokenSeconds = SILENT_KINDS.includes(kind)
      ? target
      : estimateSeconds(s.spoken ?? '', wpm)

    const startSeconds = cursor
    cursor += spokenSeconds
    totalWords += words
    targetSeconds += target

    return {
      ...s,
      kind,
      words,
      estimatedSeconds: spokenSeconds,
      startSeconds,
      timecode: formatTimecode(startSeconds),
      deltaSeconds: target > 0 ? spokenSeconds - target : null,
    }
  })

  return { sections: timed, totalSeconds: cursor, totalWords, targetSeconds }
}

// ─── YouTube-Kapitelmarken ────────────────────────────────────────────────────

export interface ChapterCheck {
  lines: string[]
  /** Verstöße gegen die YouTube-Regeln für Kapitel. */
  problems: string[]
  valid: boolean
}

/**
 * Baut Kapitelmarken für die Videobeschreibung und prüft sie gegen die Regeln,
 * die YouTube dafür verlangt: erstes Kapitel bei 0:00, mindestens drei Kapitel,
 * jedes mindestens zehn Sekunden lang.
 */
export function buildChapters(sections: ScriptSection[], wpm: number = DEFAULT_WPM): ChapterCheck {
  const { sections: timed, totalSeconds } = buildTimeline(sections, wpm)
  const usable = timed.filter(s => (s.heading ?? '').trim().length > 0)

  const lines = usable.map(s => `${formatTimecode(s.startSeconds)} ${String(s.heading).trim()}`)
  const problems: string[] = []

  if (usable.length === 0) {
    problems.push('Keine Abschnitte mit Überschrift vorhanden.')
    return { lines, problems, valid: false }
  }
  if (usable[0].startSeconds !== 0) {
    problems.push('Das erste Kapitel muss bei 0:00 beginnen.')
  }
  if (usable.length < 3) {
    problems.push('YouTube verlangt mindestens drei Kapitel.')
  }

  for (let i = 0; i < usable.length; i++) {
    const end = i + 1 < usable.length ? usable[i + 1].startSeconds : totalSeconds
    const len = end - usable[i].startSeconds
    if (len < 10) {
      problems.push(`"${usable[i].heading}" ist mit ${len}s kürzer als die geforderten 10s.`)
    }
  }

  return { lines, problems, valid: problems.length === 0 }
}

// ─── PDF-Vorlage ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Absätze zu HTML, Zeilenumbrüche bleiben erhalten. */
function paragraphs(text: string): string {
  const t = String(text ?? '').trim()
  if (!t) return '<span class="empty">—</span>'
  return esc(t).replace(/\n/g, '<br>')
}

export interface CreatorVideoInfo {
  title: string
  platform?: string
  hook?: string
  publish_at?: string | null
  status?: string
  title_variants?: string
  thumbnail_ideas?: string
  description?: string
  tags?: string
  // Sponsoring wird bei Creators je Video verhandelt
  sponsor_brand?: string
  sponsor_fee_cents?: number
  sponsor_deliverables?: string
  sponsor_deadline?: string | null
  sponsor_disclosed?: boolean
}

/**
 * Zweispaltiges Creator-Skript: links der gesprochene Text, rechts B-Roll und
 * Einblendungen — das Layout, mit dem Creator tatsächlich drehen und schneiden.
 * Dahinter das Upload-Paket auf einer eigenen Seite.
 */
export function renderCreatorScriptHtml(
  video: CreatorVideoInfo,
  sections: ScriptSection[],
  opts: {
    wpm?: number
    projectTitle?: string
    /** Verwendetes Material mit Lizenz — fuer die Rechteseite. */
    assets?: Array<{ kind?: string; name?: string; source?: string; license?: string; claim_risk?: string }>
    /** Geplante Auskopplungen fuer Shorts und Reels. */
    clips?: Array<{ title?: string; start_seconds?: number; end_seconds?: number; platform?: string; status?: string }>
    /** Upload-Checkliste zum Abhaken auf Papier. */
    checklist?: Array<{ label?: string; done?: boolean }>
  } = {}
): string {
  const wpm = opts.wpm ?? DEFAULT_WPM
  const { sections: timed, totalSeconds, totalWords, targetSeconds } = buildTimeline(sections, wpm)
  const chapters = buildChapters(sections, wpm)

  const rows = timed.map(s => {
    const delta = s.deltaSeconds
    const deltaHtml = delta === null
      ? ''
      : `<div class="delta ${delta > 0 ? 'over' : delta < 0 ? 'under' : 'ok'}">${delta > 0 ? '+' : ''}${delta}s ggü. Ziel</div>`
    return `<tr>
      <td class="tc">
        <div class="time">${esc(s.timecode)}</div>
        <div class="kind">${esc(SECTION_LABELS[s.kind])}</div>
        <div class="dur">${s.estimatedSeconds}s</div>
        ${s.words > 0 ? `<div class="dur">${s.words} W.</div>` : ''}
        ${deltaHtml}
      </td>
      <td class="spoken">
        ${s.heading ? `<div class="heading">${esc(s.heading)}</div>` : ''}
        <div class="text">${paragraphs(s.spoken ?? '')}</div>
      </td>
      <td class="visuals">${paragraphs(s.visuals ?? '')}</td>
    </tr>`
  }).join('\n')

  const list = (text: string) => {
    const items = String(text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
    if (items.length === 0) return '<span class="empty">—</span>'
    return `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
  }

  const targetNote = targetSeconds > 0
    ? ` · Ziel ${formatTimecode(targetSeconds)} (${totalSeconds - targetSeconds > 0 ? '+' : ''}${totalSeconds - targetSeconds}s)`
    : ''

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${esc(video.title)} – Videoskript</title>
<style>
  ${pdfFontFaces()}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${PDF_SANS}; font-size: 10.5px; color: #1d1d1f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .head { border-bottom: 0.5pt solid #d2d2d7; padding-bottom: 10px; margin-bottom: 14px; }
  .head h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
  .head .meta { color: #6e6e73; font-size: 11px; margin-top: 3px; }
  .head .hook { margin-top: 10px; padding: 8px 12px; background: #fff1f0; border-radius: 10px; font-size: 11px; }
  .head .hook b { display: block; font-size: 9px; font-weight: 600; color: #d70015; margin-bottom: 2px; }

  .stats { display: flex; gap: 22px; margin-bottom: 16px; padding: 10px 14px; background: #f5f5f7; border-radius: 12px; }
  .stats div span { display: block; font-size: 9px; color: #6e6e73; }
  .stats div b { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .07em;
       color: #6e6e73; font-weight: 600; border-bottom: 0.6pt solid #d2d2d7; padding: 0 8px 4px; }
  td { vertical-align: top; padding: 9px 8px; border-bottom: 0.5pt solid #e8e8ed; }
  tr { page-break-inside: avoid; }

  .tc { width: 74px; }
  .tc .time { font-family: ${PDF_MONO}; font-weight: 600; font-size: 12px; }
  .tc .kind { font-size: 8.5px; font-weight: 600; color: #d70015; margin-top: 1px; }
  .tc .dur { font-size: 8.5px; color: #777; }
  .tc .delta { font-size: 8px; margin-top: 2px; }
  .tc .over { color: #b45309; }
  .tc .under { color: #0369a1; }
  .tc .ok { color: #15803d; }

  .spoken { width: 56%; }
  .spoken .heading { font-weight: bold; font-size: 11.5px; margin-bottom: 3px; }
  .spoken .text { line-height: 1.5; }
  .visuals { color: #424245; font-size: 9.5px; line-height: 1.45; background: #fafafc; }
  .empty { color: #bbb; }

  .upload { page-break-before: always; }
  .upload h2 { font-size: 18px; font-weight: 700; letter-spacing: -0.025em; padding-bottom: 6px; margin-bottom: 12px; border-bottom: 0.5pt solid #d2d2d7; }
  .block { margin-bottom: 14px; }
  .block h3 { font-size: 10px; font-weight: 600; color: #6e6e73; margin-bottom: 4px; }
  .block ul { margin-left: 15px; }
  .block li { margin-bottom: 2px; line-height: 1.45; }
  .desc { white-space: pre-wrap; line-height: 1.5; background: #f5f5f7; padding: 10px 12px; border-radius: 10px; }
  .chapters { font-family: ${PDF_MONO}; font-size: 10px; line-height: 1.6;
              background: #f5f5f7; padding: 10px 12px; border-radius: 10px; }
  .warn { margin-top: 5px; font-size: 9px; color: #b45309; }
  .warn li { margin-left: 14px; }
  .check { padding: 2px 0; font-size: 10px; }
</style>
</head>
<body>

<div class="head">
  <h1>${esc(video.title || 'Unbenanntes Video')}</h1>
  <div class="meta">
    ${esc(video.platform || 'YouTube')}
    ${video.status ? ` · ${esc(video.status)}` : ''}
    ${video.publish_at ? ` · geplant für ${esc(new Date(video.publish_at).toLocaleDateString('de-DE'))}` : ''}
    ${opts.projectTitle ? ` · ${esc(opts.projectTitle)}` : ''}
  </div>
  ${video.hook ? `<div class="hook"><b>Hook</b>${esc(video.hook)}</div>` : ''}
</div>

<div class="stats">
  <div><span>Laufzeit (geschätzt)</span><b>${formatTimecode(totalSeconds)}</b></div>
  <div><span>Wörter</span><b>${totalWords}</b></div>
  <div><span>Abschnitte</span><b>${timed.length}</b></div>
  <div><span>Sprechtempo</span><b>${wpm} W/min</b></div>
</div>
${targetSeconds > 0 ? `<div class="meta" style="margin:-8px 0 12px;color:#555;font-size:9.5px;">Soll-Laufzeit${targetNote}</div>` : ''}

<table>
  <thead><tr><th>Zeit</th><th>Gesprochener Text</th><th>Bild / B-Roll / Einblendung</th></tr></thead>
  <tbody>
${rows || '<tr><td colspan="3" class="empty">Noch keine Abschnitte angelegt.</td></tr>'}
  </tbody>
</table>

<div class="upload">
  <h2>Upload-Paket</h2>

  <div class="block">
    <h3>Titel-Varianten</h3>
    ${list(video.title_variants ?? '')}
  </div>

  <div class="block">
    <h3>Thumbnail-Ideen</h3>
    ${list(video.thumbnail_ideas ?? '')}
  </div>

  <div class="block">
    <h3>Kapitelmarken für die Beschreibung</h3>
    <div class="chapters">${chapters.lines.length ? esc(chapters.lines.join('\n')).replace(/\n/g, '<br>') : '<span class="empty">—</span>'}</div>
    ${chapters.problems.length ? `<ul class="warn">${chapters.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
  </div>

  <div class="block">
    <h3>Videobeschreibung</h3>
    <div class="desc">${video.description ? esc(video.description) : '<span class="empty">—</span>'}</div>
  </div>

  <div class="block">
    <h3>Tags</h3>
    ${list((video.tags ?? '').split(',').join('\n'))}
  </div>

  ${video.sponsor_brand ? `
  <div class="block">
    <h3>Sponsoring</h3>
    <div><b>${esc(video.sponsor_brand)}</b>${
      video.sponsor_fee_cents ? ` · ${(video.sponsor_fee_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` : ''
    }${video.sponsor_deadline ? ` · Deadline ${esc(new Date(video.sponsor_deadline).toLocaleDateString('de-DE'))}` : ''}</div>
    ${video.sponsor_deliverables ? `<div style="margin-top:3px;">${paragraphs(video.sponsor_deliverables)}</div>` : ''}
    <div style="margin-top:3px;" class="${video.sponsor_disclosed ? '' : 'warn'}">
      ${video.sponsor_disclosed ? 'Werbung gekennzeichnet.' : 'Achtung: Werbekennzeichnung noch nicht gesetzt.'}
    </div>
  </div>` : ''}
</div>

${(opts.assets?.length || opts.clips?.length || opts.checklist?.length) ? `
<div class="upload">
  <h2>Produktion</h2>

  ${opts.assets?.length ? `
  <div class="block">
    <h3>Material und Rechte</h3>
    <table>
      <thead><tr><th>Art</th><th>Titel</th><th>Quelle</th><th>Lizenz</th><th>Risiko</th></tr></thead>
      <tbody>
        ${opts.assets.map(a => `<tr>
          <td>${esc(a.kind ?? '')}</td>
          <td>${esc(a.name ?? '')}</td>
          <td>${esc(a.source ?? '')}</td>
          <td>${a.license ? esc(a.license) : '<span class="warn">fehlt</span>'}</td>
          <td>${esc(a.claim_risk ?? 'keins')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${opts.clips?.length ? `
  <div class="block">
    <h3>Auskopplungen</h3>
    <table>
      <thead><tr><th>Von–bis</th><th>Titel</th><th>Plattform</th><th>Status</th></tr></thead>
      <tbody>
        ${opts.clips.map(c => `<tr>
          <td>${formatTimecode(c.start_seconds ?? 0)}–${formatTimecode(c.end_seconds ?? 0)}</td>
          <td>${esc(c.title ?? '')}</td>
          <td>${esc(c.platform ?? '')}</td>
          <td>${esc(c.status ?? '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${opts.checklist?.length ? `
  <div class="block">
    <h3>Upload-Checkliste</h3>
    ${opts.checklist.map(c => `<div class="check">${c.done ? '☑' : '☐'} ${esc(c.label ?? '')}</div>`).join('')}
  </div>` : ''}
</div>` : ''}

</body>
</html>`
}
