/**
 * Gemeinsames Layout für alle Dokumente, die CutSheet ausgibt.
 *
 * Vorher brachte jede Route ihr eigenes HTML mit: mal fett, mal nicht, mal mit
 * Kopfzeile, mal ohne, Zahlen linksbündig neben Text. Ein Stapel Ausdrucke sah
 * nach einem Stapel verschiedener Programme aus. Hier steht das Gerüst einmal,
 * die Routen liefern nur noch Inhalt.
 *
 * Grundsätze, die sich aus dem Drucken selbst ergeben:
 *  - Zahlen rechtsbündig, damit sie untereinander vergleichbar sind
 *  - Tabellenköpfe wiederholen sich auf jeder Seite (thead + display:table-header-group)
 *  - Zeilen brechen nicht mitten durch (page-break-inside: avoid)
 *  - Seitenzahl und Dokumentname in der Fußzeile, damit lose Blätter zuzuordnen sind
 */

import { pdfFontFaces, PDF_SANS, resolveAccent } from './pdfFonts'

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Zeilenumbrüche aus Freitextfeldern erhalten. */
function multiline(s: any): string {
  return esc(s).replace(/\n/g, '<br>')
}

// ─── Werte formatieren ────────────────────────────────────────────────────────

/**
 * Fehlende Angabe von einer echten 0 unterscheiden.
 *
 * `Number(null)` ergibt 0 und nicht NaN. Ohne diese Pruefung stuende auf einem
 * Kalkulationsblatt "0,00 €", wo in Wahrheit nichts erfasst ist — eine
 * Tatsachenbehauptung statt einer Leerstelle.
 */
function givenNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function fmtMoney(cents: number | null | undefined, currency = 'EUR'): string {
  const n = givenNumber(cents)
  if (n === null) return '—'
  return (n / 100).toLocaleString('de-DE', { style: 'currency', currency })
}

export function fmtTime(minutes: number | null | undefined): string {
  const n = givenNumber(minutes)
  if (n === null) return '—'
  const total = Math.max(0, Math.floor(n))
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Minuten als Dauer: 405 → "6h 45min". */
export function fmtDuration(minutes: number | null | undefined): string {
  const n = givenNumber(minutes)
  if (n === null || n <= 0) return '—'
  const total = Math.round(n)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export function fmtDate(value: string | null | undefined): string {
  const d = new Date(String(value ?? ''))
  if (Number.isNaN(d.getTime())) return String(value ?? '') || '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateLong(value: string | null | undefined): string {
  const d = new Date(String(value ?? ''))
  if (Number.isNaN(d.getTime())) return String(value ?? '') || '—'
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Achtel als Seitenangabe der Branche: 19 → "2 3/8". */
export function fmtEighths(eighths: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(eighths) || 0))
  if (total === 0) return '—'
  const pages = Math.floor(total / 8)
  const rest = total % 8
  if (pages === 0) return `${rest}/8`
  if (rest === 0) return String(pages)
  return `${pages} ${rest}/8`
}

// ─── Bausteine ────────────────────────────────────────────────────────────────

export type Align = 'left' | 'right' | 'center'

export interface Column<T = any> {
  /** Spaltenüberschrift. */
  header: string
  /** Wert der Zelle; darf bereits HTML enthalten, wenn `html` gesetzt ist. */
  value: (row: T, index: number) => string | number | null | undefined
  align?: Align
  /** Breite als CSS-Angabe, z. B. '12%'. */
  width?: string
  /** Wert nicht maskieren — nur für selbst erzeugtes Markup verwenden. */
  html?: boolean
  /** Kleiner und blasser setzen, für Nebeninformationen. */
  muted?: boolean
}

export interface TableOptions<T = any> {
  columns: Column<T>[]
  rows: T[]
  /** Text, wenn keine Zeilen vorhanden sind. */
  empty?: string
  /** Fußzeile der Tabelle, etwa für Summen. */
  footer?: Array<{ label: string; value: string; span?: number }>
  /** Zeilen abwechselnd hinterlegen — bei breiten Tabellen eine Lesehilfe. */
  zebra?: boolean
}

export function table<T>(opts: TableOptions<T>): string {
  const { columns, rows, empty = 'Keine Einträge vorhanden.', footer, zebra = true } = opts

  const head = columns.map(c =>
    `<th style="text-align:${c.align ?? 'left'}${c.width ? `;width:${c.width}` : ''}">${esc(c.header)}</th>`
  ).join('')

  const body = rows.length === 0
    ? `<tr><td colspan="${columns.length}" class="empty">${esc(empty)}</td></tr>`
    : rows.map((row, i) => `<tr>${columns.map(c => {
        const raw = c.value(row, i)
        const content = raw === null || raw === undefined || raw === '' ? '—' : (c.html ? String(raw) : esc(raw))
        const cls = [c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : '', c.muted ? 'muted' : '']
          .filter(Boolean).join(' ')
        return `<td${cls ? ` class="${cls}"` : ''}>${content}</td>`
      }).join('')}</tr>`).join('')

  const foot = footer?.length
    ? `<tfoot>${footer.map(f => {
        const span = f.span ?? Math.max(1, columns.length - 1)
        return `<tr><td colspan="${span}" class="r sumlabel">${esc(f.label)}</td><td class="r sumvalue">${esc(f.value)}</td></tr>`
      }).join('')}</tfoot>`
    : ''

  return `<table class="${zebra ? 'zebra' : ''}">
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
    ${foot}
  </table>`
}

/** Kennzahlenreihe unter dem Kopf — die Antwort auf "wie viel ist das insgesamt?". */
export function stats(items: Array<{ label: string; value: string | number; hint?: string }>): string {
  if (items.length === 0) return ''
  return `<div class="stats">${items.map(s => `
    <div class="stat">
      <div class="k">${esc(s.label)}</div>
      <div class="v">${esc(s.value)}</div>
      ${s.hint ? `<div class="h">${esc(s.hint)}</div>` : ''}
    </div>`).join('')}</div>`
}

/** Abschnittsüberschrift innerhalb eines Dokuments. */
export function section(title: string, content: string, note?: string): string {
  return `<section class="sect">
    <h2>${esc(title)}${note ? `<span class="note">${esc(note)}</span>` : ''}</h2>
    ${content}
  </section>`
}

/** Zweispaltige Auflistung von Eckdaten, etwa im Kopf eines Berichts. */
export function definitions(items: Array<{ label: string; value: any; wide?: boolean }>): string {
  const shown = items.filter(i => i.value !== null && i.value !== undefined && String(i.value) !== '')
  if (shown.length === 0) return ''
  return `<div class="defs">${shown.map(i => `
    <div class="def${i.wide ? ' wide' : ''}">
      <div class="k">${esc(i.label)}</div>
      <div class="v">${multiline(i.value)}</div>
    </div>`).join('')}</div>`
}

/**
 * Fließtext aus einem Freitextfeld.
 *
 * Maskiert den Inhalt und erhält Absätze — Drehberichte werden mit Umbrüchen
 * getippt, und die sind Teil der Aussage.
 */
export function paragraph(text: any, muted = false): string {
  const value = String(text ?? '').trim()
  if (!value) return ''
  return `<p class="text${muted ? ' muted' : ''}">${multiline(value)}</p>`
}

/** Hinweis, wenn ein Abschnitt bewusst leer bleibt. */
export function hint(text: string): string {
  return `<p class="hint">${esc(text)}</p>`
}

/** Farbige Markierung, etwa für Status. */
export function badge(text: string, tone: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' = 'neutral'): string {
  return `<span class="badge ${tone}">${esc(text)}</span>`
}

// ─── Dokumenthülle ────────────────────────────────────────────────────────────

export interface DocumentOptions {
  /** Art des Dokuments, steht klein über dem Titel. */
  kind: string
  title: string
  /** Projektname — steht im Kopf und in der Fußzeile. */
  project?: string
  subtitle?: string
  /** Eckdaten rechts im Kopf. */
  meta?: Array<{ label: string; value: any }>
  accent?: string
  landscape?: boolean
  /** Hinweis unten, etwa zur Vertraulichkeit. */
  footnote?: string
  /** Zusaetzliches CSS fuer Bausteine, die nur ein Dokument braucht. */
  extraCss?: string
  body: string
}

/**
 * Kennung fuer die Fusszeile.
 *
 * Bei den meisten Listen sind Titel und Projekt dasselbe — ungefiltert stuende
 * der Name dort zweimal. Doppelte Teile fallen weg, die Dokumentart kommt dazu,
 * damit ein einzelnes verlorenes Blatt zuzuordnen ist.
 */
function footIdentity(opts: DocumentOptions): string {
  const parts: string[] = []
  for (const part of [opts.project, opts.title, opts.kind]) {
    const value = String(part ?? '').trim()
    if (value && !parts.includes(value)) parts.push(value)
  }
  return parts.join(' · ')
}

/** Namen der Meta-Angaben, aus denen generatePdf die Fußzeile baut. */
export const FOOT_LEFT = 'cutsheet-foot-left'
export const FOOT_RIGHT = 'cutsheet-foot-right'

/**
 * Baut das fertige Dokument.
 *
 * Die Fußzeile steht als Meta-Angabe im Kopf und wird von generatePdf in die
 * Druckerfußzeile übernommen — samt Projektname und „Seite x / y“, damit lose
 * Blätter zuzuordnen sind. Ein position:fixed-Element im Seitenrand erzeugte
 * dagegen eine leere Folgeseite, auf der die Fußzeile dann allein stand.
 */
export function renderDocument(opts: DocumentOptions): string {
  const accent = resolveAccent(opts.accent)
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${esc(opts.title)}${opts.project ? ` — ${esc(opts.project)}` : ''}</title>
<meta name="${FOOT_LEFT}" content="${esc(footIdentity(opts))}">
<meta name="${FOOT_RIGHT}" content="${esc(opts.footnote || `Erstellt mit CutSheet am ${today}`)}">
<style>
  ${pdfFontFaces()}
  @page { size: A4 ${opts.landscape ? 'landscape' : 'portrait'}; margin: 14mm 13mm 17mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --accent: ${accent}; --ink: #1d1d1f; --ink2: #424245; --gray: #6e6e73; --faint: #86868b;
          --line: #d2d2d7; --hair: #e8e8ed; --fill: #f5f5f7; }
  body {
    font-family: ${PDF_SANS};
    font-size: 9pt; line-height: 1.45; color: var(--ink); letter-spacing: -0.003em;
    font-feature-settings: 'tnum' 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  /* ── Kopf ── */
  .doc-brand { display: flex; align-items: center; gap: 5pt; margin-bottom: 12pt; }
  .doc-brand .icon { width: 14pt; height: 14pt; border-radius: 3.6pt; background: linear-gradient(#3a3a3c, #1d1d1f);
                     display: flex; align-items: center; justify-content: center; }
  .doc-brand .name { font-size: 8.5pt; font-weight: 600; letter-spacing: -0.01em; }
  .doc-brand .kind { margin-left: auto; font-size: 7.5pt; font-weight: 600; color: var(--accent);
                     background: color-mix(in srgb, var(--accent) 10%, white); padding: 1.5pt 6pt; border-radius: 10pt; }
  .doc-head { display: flex; align-items: flex-end; gap: 16pt; padding-bottom: 12pt; margin-bottom: 14pt;
              border-bottom: 0.5pt solid var(--line); }
  .doc-head .left { flex: 1; min-width: 0; }
  .doc-title { font-size: 22pt; font-weight: 700; letter-spacing: -0.028em; line-height: 1.08; }
  .doc-sub { font-size: 10pt; color: var(--gray); margin-top: 3pt; }
  .doc-meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5pt 14pt; max-width: 60%; }
  .doc-meta div { font-size: 7pt; color: var(--gray); }
  .doc-meta b { display: block; font-size: 9pt; font-weight: 600; color: var(--ink); margin-top: 0.5pt; }

  /* ── Kennzahlen ── */
  .stats { display: flex; flex-wrap: wrap; gap: 6pt; margin-bottom: 16pt; }
  .stat { flex: 1; min-width: 90pt; border-radius: 8pt; padding: 7pt 10pt 8pt; background: var(--fill); }
  .stat .k { font-size: 7.5pt; color: var(--gray); }
  .stat .v { font-size: 15pt; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; margin-top: 1pt;
             font-variant-numeric: tabular-nums; }
  .stat .h { font-size: 7.5pt; color: var(--faint); }
  .stat:first-child .v { color: var(--accent); }

  /* ── Abschnitte ── */
  .sect { margin-bottom: 16pt; page-break-inside: auto; }
  .sect h2 { font-size: 11.5pt; font-weight: 600; letter-spacing: -0.015em; margin-bottom: 6pt; }
  /* Überschrift nie allein am Seitenende — sie gehört zur Tabelle darunter */
  .sect h2 { break-after: avoid; page-break-after: avoid; }
  .sect h2 + table thead, .sect h2 + .defs { break-before: avoid; }
  /* Kurze Abschnitte (bis 8 Zeilen) bleiben zusammen, statt eine einzelne
     Zeile samt Summe auf die nächste Seite zu schieben */
  .sect:has(tbody tr:last-child:nth-child(-n+8)) { break-inside: avoid; page-break-inside: avoid; }
  .sect h2 .note { float: right; font-size: 8pt; font-weight: 400; color: var(--gray); letter-spacing: 0; margin-top: 2pt; }

  /* ── Tabellen ── */
  table { width: 100%; border-collapse: collapse; }
  /* Kopf auf jeder Folgeseite wiederholen — ohne das steht man auf Seite 3
     vor Zahlenspalten ohne Beschriftung */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { font-size: 7pt; font-weight: 600; color: var(--gray); text-transform: uppercase; letter-spacing: 0.03em;
       border-bottom: 0.6pt solid var(--line); padding: 4pt 6pt 4pt; text-align: left; }
  td { padding: 4.5pt 6pt; border-bottom: 0.5pt solid var(--hair); vertical-align: top; }
  th:first-child, td:first-child { padding-left: 2pt; }
  th:last-child, td:last-child { padding-right: 2pt; }
  table.zebra tbody tr:nth-child(even) td { background: #fafafc; }
  td.r, th[style*="right"] { text-align: right; }
  td.c { text-align: center; }
  /* Zahlen mit gleicher Ziffernbreite: nur so stehen sie untereinander */
  td.r { font-variant-numeric: tabular-nums; }
  td.muted { color: var(--gray); font-size: 8pt; }
  td.empty { text-align: center; color: var(--faint); padding: 14pt; }
  tfoot td { border-top: 0.8pt solid var(--ink); border-bottom: none; padding-top: 6pt; font-weight: 600; }
  tfoot .sumlabel { color: var(--gray); font-weight: 500; }
  tfoot .sumvalue { font-size: 11pt; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }

  /* ── Eckdaten ── */
  .defs { display: flex; flex-wrap: wrap; gap: 8pt 18pt; margin-bottom: 12pt; }
  .def { min-width: 110pt; }
  .def.wide { width: 100%; }
  .def .k { font-size: 7.5pt; color: var(--gray); }
  .def .v { font-size: 9.5pt; font-weight: 500; margin-top: 0.5pt; }

  /* Unterschriftenfeld — bewusst grosszuegig, es wird mit der Hand ausgefuellt */
  .sigs { display: flex; gap: 20pt; margin-top: 28pt; }
  .sig { flex: 1; }
  .sig .line { border-bottom: 0.6pt solid var(--ink2); height: 30pt; }
  .sig .cap { font-size: 7.5pt; color: var(--gray); margin-top: 3pt; }

  .text { font-size: 9.5pt; line-height: 1.6; max-width: 165mm; }
  .text.muted { color: var(--ink2); }
  .hint { font-size: 8.5pt; color: var(--faint); }

  .badge { display: inline-block; font-size: 7.5pt; font-weight: 600; padding: 1pt 6pt; border-radius: 10pt; }
  .badge.neutral { color: #424245; background: #ececf0; }
  .badge.ok   { color: #1a7f37; background: #e3f5e8; }
  .badge.warn { color: #a05a00; background: #fff1dc; }
  .badge.bad  { color: #c9251c; background: #fde8e7; }
  .badge.info { color: #0062c4; background: #e5f0fd; }

  /* ── Fußzeile auf jeder Seite ── */
${opts.extraCss || ''}
</style>
</head>
<body>

  <div class="doc-brand">
    <span class="icon">${BRAND_SVG}</span>
    <span class="name">CutSheet</span>
    <span class="kind">${esc(opts.kind)}</span>
  </div>

  <div class="doc-head">
    <div class="left">
      <div class="doc-title">${esc(opts.title)}</div>
      ${opts.subtitle ? `<div class="doc-sub">${esc(opts.subtitle)}</div>` : ''}
    </div>
    ${opts.meta?.length ? `<div class="doc-meta">
      ${opts.meta.filter(m => m.value !== null && m.value !== undefined && String(m.value) !== '')
        .map(m => `<div>${esc(m.label)}<b>${esc(m.value)}</b></div>`).join('')}
    </div>` : ''}
  </div>

  ${opts.body}
</body>
</html>`
}

/** Die Klappe aus dem App-Symbol, weiß für das dunkle Kästchen im Kopf. */
export const BRAND_SVG = `<svg viewBox="0 0 24 24" width="9pt" height="9pt" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="9.5" width="18" height="11.5" rx="1.75"/><path d="M3.6 8 20.4 5.1M8.2 7.2 9.6 9.5M13 6.4l1.4 2.3M17.8 5.6l1.4 2.3"/></svg>`
