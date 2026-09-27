/**
 * Set-Plan: Grundriss mit Kamera, Licht, Ton und Darstellern.
 *
 * Positionen liegen relativ zwischen 0 und 1, nicht in Pixeln. Nur so stimmt
 * derselbe Plan auf jedem Bildschirm und im PDF, unabhaengig davon, wie gross
 * das hochgeladene Bild ist oder wie breit der Browser gerade steht.
 */
import { pdfFontFaces, PDF_SANS } from './pdfFonts'

export interface ItemType {
  kind: string
  label: string
  /** Hat eine Blickrichtung — Kamera und Licht zeigen irgendwohin, ein Tisch nicht. */
  directional: boolean
  color: string
  /** Kurzzeichen fuer die Darstellung im Plan. */
  glyph: string
}

/**
 * Die Symbole des Set-Plans. Die Auswahl folgt dem, was auf einem echten
 * Grundriss steht — nicht jedem denkbaren Gegenstand, sondern dem, worueber am
 * Set gesprochen wird.
 */
export const ITEM_TYPES: ItemType[] = [
  { kind: 'kamera',      label: 'Kamera',        directional: true,  color: '#2563eb', glyph: 'CAM' },
  { kind: 'licht',       label: 'Licht',         directional: true,  color: '#f59e0b', glyph: 'LI' },
  { kind: 'praktikable',  label: 'Praktikable',   directional: false, color: '#eab308', glyph: 'PR' },
  { kind: 'ton',         label: 'Mikrofon',      directional: true,  color: '#10b981', glyph: 'MIC' },
  { kind: 'darsteller',  label: 'Darsteller',    directional: false, color: '#ef4444', glyph: 'D' },
  { kind: 'requisite',   label: 'Requisite',     directional: false, color: '#8b5cf6', glyph: 'RQ' },
  { kind: 'moebel',      label: 'Möbel',         directional: false, color: '#78716c', glyph: 'MB' },
  { kind: 'tuer',        label: 'Tür',           directional: false, color: '#0891b2', glyph: 'TÜR' },
  { kind: 'fenster',     label: 'Fenster',       directional: false, color: '#06b6d4', glyph: 'FEN' },
  { kind: 'monitor',     label: 'Monitor / Video', directional: false, color: '#64748b', glyph: 'MON' },
  { kind: 'marker',      label: 'Markierung',    directional: false, color: '#db2777', glyph: '×' },
]

const BY_KIND = new Map(ITEM_TYPES.map(t => [t.kind, t]))

/** Symboltyp nachschlagen; unbekannte Typen werden zur Markierung. */
export function itemType(kind: string | null | undefined): ItemType {
  return BY_KIND.get(String(kind ?? '')) ?? BY_KIND.get('marker')!
}

/** Position auf die Flaeche begrenzen; unbrauchbare Werte landen in der Mitte. */
export function clampPosition(x: number, y: number): { x: number; y: number } {
  const fix = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5)
  return { x: fix(Number(x)), y: fix(Number(y)) }
}

/**
 * Fehlende Angabe von einer echten 0 unterscheiden.
 *
 * `Number(null)` ergibt 0 und nicht NaN — anders als bei `undefined`. Ohne
 * diese Pruefung wuerde ein fehlender Wert als Null durchgehen und in der
 * Begrenzung auf dem Minimum landen statt auf dem Standardwert.
 */
function givenNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Winkel auf 0 bis 359 Grad bringen, auch bei negativen Werten. */
export function normalizeRotation(deg: number | null | undefined): number {
  const n = givenNumber(deg)
  if (n === null) return 0
  return ((Math.round(n) % 360) + 360) % 360
}

/** Groesse in Prozent, damit ein Symbol nicht den halben Plan einnimmt. */
export function clampSize(size: number | null | undefined): number {
  const n = givenNumber(size)
  if (n === null) return 100
  return Math.min(300, Math.max(40, Math.round(n)))
}

export interface PlanItem {
  kind?: string
  label?: string
  x?: number
  y?: number
  rotation?: number
  size?: number
  notes?: string
}

/**
 * Zusammenfassung fuer die Legende: was steht wie oft auf dem Plan.
 * Am Set fragt jemand "wie viele Lampen brauchen wir?" — die Antwort steht
 * dann unter dem Bild statt im Kopf des Oberbeleuchters.
 */
export function summarise(items: PlanItem[]): Array<{ kind: string; label: string; count: number; color: string }> {
  const counts = new Map<string, number>()
  for (const i of items) {
    const t = itemType(i.kind)
    counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1)
  }
  return ITEM_TYPES
    .filter(t => counts.has(t.kind))
    .map(t => ({ kind: t.kind, label: t.label, count: counts.get(t.kind)!, color: t.color }))
}

/**
 * Automatische Beschriftung fuer ein neues Symbol: Kamera A, Kamera B, …
 * Buchstaben fuer Kameras (Branchenkonvention), Zahlen fuer alles andere.
 */
export function nextLabel(kind: string, existing: PlanItem[]): string {
  const sameKind = existing.filter(i => String(i.kind) === kind)
  const n = sameKind.length

  if (kind === 'kamera') {
    // A–Z, danach AA, AB … damit auch der 27. Aufbau einen Namen bekommt
    let label = ''
    let rest = n
    do {
      label = String.fromCharCode(65 + (rest % 26)) + label
      rest = Math.floor(rest / 26) - 1
    } while (rest >= 0)
    return label
  }
  return String(n + 1)
}

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Set-Plan als druckbares HTML.
 *
 * Das Hintergrundbild wird als Daten-URI eingebettet statt verlinkt: Der
 * Druck laeuft in einem eigenen Browser ohne Sitzung und ohne Basis-URL, ein
 * Link auf /uploads/... waere dort schlicht leer.
 */
export function renderFloorplanHtml(plan: any, items: PlanItem[], imageDataUri: string | null): string {
  const legend = summarise(items)

  const symbols = items.map(i => {
    const t = itemType(i.kind)
    const { x, y } = clampPosition(i.x ?? 0.5, i.y ?? 0.5)
    const rot = normalizeRotation(i.rotation)
    const size = clampSize(i.size)

    return `<div class="sym" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%;--c:${esc(t.color)};--s:${size / 100}">
      ${t.directional ? `<div class="cone" style="transform:translate(-50%,-100%) rotate(${rot}deg)"></div>` : ''}
      <div class="dot">${esc(t.glyph)}</div>
      ${i.label ? `<div class="lbl">${esc(i.label)}</div>` : ''}
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Set-Plan — ${esc(plan?.name)}</title>
<style>
  ${pdfFontFaces()}
  @page { size: A4 landscape; margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: ${PDF_SANS}; font-size: 10px; color: #1d1d1f; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.028em; }
  .meta { color: #6e6e73; font-size: 10px; margin-top: 2px; }
  .head { border-bottom: 0.5pt solid #d2d2d7; padding-bottom: 8px; margin-bottom: 10px; }

  /* Die Buehne umschliesst das Bild genau, damit die relativen Positionen der
     Symbole zum Bild passen und nicht zu einem Rahmen daneben. Begrenzt wird
     in beide Richtungen: Ein hochformatiges Bild wuerde sonst auf volle Breite
     gezogen und ueber mehrere Seiten laufen. */
  .stagewrap { text-align: center; }
  .stage { position: relative; display: inline-block; max-width: 100%; border: 0.5pt solid #d2d2d7; border-radius: 10px; overflow: hidden; background: #f5f5f7; }
  .stage img { display: block; max-width: 100%; max-height: 148mm; width: auto; height: auto; }
  .stage.empty { width: 100%; height: 120mm; }

  .sym { position: absolute; transform: translate(-50%, -50%); }
  /* Blickrichtung als Kegel — bei Kamera und Licht die eigentliche Information */
  .cone {
    position: absolute; left: 50%; top: 50%;
    width: calc(30px * var(--s)); height: calc(46px * var(--s));
    background: linear-gradient(to top, color-mix(in srgb, var(--c) 45%, transparent), transparent);
    clip-path: polygon(50% 100%, 0 0, 100% 0);
    transform-origin: 50% 100%;
  }
  .dot {
    position: relative;
    width: calc(22px * var(--s)); height: calc(22px * var(--s));
    border-radius: 50%; background: var(--c); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: calc(8px * var(--s)); font-weight: bold;
    border: 1.5px solid #fff; box-shadow: 0 0 0 1px var(--c);
  }
  .lbl {
    position: absolute; left: 50%; top: 100%; transform: translateX(-50%);
    margin-top: 2px; white-space: nowrap;
    font-size: calc(8px * var(--s)); font-weight: bold;
    background: #fff; border: 1px solid var(--c); border-radius: 6px; padding: 0 4px;
  }

  .legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
  .legend div { display: flex; align-items: center; gap: 4px; }
  .legend .sw { width: 10px; height: 10px; border-radius: 50%; }
  .notes { margin-top: 8px; white-space: pre-wrap; font-size: 9px; color: #333; }
</style>
</head>
<body>
  <div class="head">
    <h1>${esc(plan?.name || 'Set-Plan')}</h1>
    <div class="meta">
      ${esc(plan?.project_title || '')}
      ${plan?.scene_number ? ` · Szene ${esc(plan.scene_number)}` : ''}
      ${plan?.location_name ? ` · ${esc(plan.location_name)}` : ''}
      · ${items.length} Element${items.length === 1 ? '' : 'e'}
    </div>
  </div>

  <div class="stagewrap"><div class="stage${imageDataUri ? '' : ' empty'}">
    ${imageDataUri ? `<img src="${imageDataUri}" alt="">` : ''}
    ${symbols}
  </div></div>

  ${legend.length ? `<div class="legend">
    ${legend.map(l => `<div><span class="sw" style="background:${esc(l.color)}"></span>${esc(l.label)}: ${l.count}</div>`).join('')}
  </div>` : ''}

  ${plan?.notes ? `<div class="notes">${esc(plan.notes)}</div>` : ''}
</body>
</html>`
}
