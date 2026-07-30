/**
 * Drehbuch-Satz nach Industriestandard (Master Scene Format).
 *
 * Warum ein eigener Paginierer statt CSS: Der Standard ist ein Zeichenraster,
 * kein Fließtext. Courier 12pt heißt exakt 10 Zeichen pro Zoll und 6 Zeilen pro
 * Zoll, eine Seite fasst 55 Zeilen (daraus folgt die Regel "eine Seite ≈ eine
 * Minute Film"). (MORE)/(CONT'D) und die Witwen-/Waisen-Regeln hängen davon ab,
 * *wo* eine Seite bricht — das weiß CSS nicht, ein eigener Umbruch schon.
 *
 * Maße in Zoll ab linker Papierkante, gemäß WGA/Final-Draft-Konvention:
 *   Textspiegel links 1.5", Breite 6.0" (= 60 Zeichen), rechts ≥ 0.75"
 *   Szenenüberschrift/Action  1.5"   (Spalte 0 des Textspiegels, 60 Zeichen)
 *   Dialog                    2.5"   (10 Zeichen eingerückt, 35 breit)
 *   Klammerbemerkung          3.1"   (16 eingerückt, 21 breit)
 *   Figurenname               3.7"   (22 eingerückt)
 *   (MORE)                    3.5"   (20 eingerückt)
 *   Transition                rechtsbündig am rechten Textrand
 *   Szenennummern             1.0" links, gespiegelt rechts vom Textspiegel
 */

// ─── Raster ───────────────────────────────────────────────────────────────────

/** Courier 12pt: 10 Zeichen pro Zoll. */
export const CPI = 10
/** Courier 12pt einzeilig: 6 Zeilen pro Zoll. */
export const LPI = 6
/** Linke Kante des Zeichenrasters (dort stehen die Szenennummern). */
export const GRID_LEFT_IN = 1.0
/** Oberer Rand bis zur ersten Textzeile. */
export const TOP_MARGIN_IN = 1.0
/** Seitenzahl sitzt 0.5" unter der Papieroberkante. */
export const PAGE_NUM_TOP_IN = 0.5
/**
 * 55 Zeilen pro Seite — bewusst papierunabhängig, damit die Seitenzahl weiter
 * der Laufzeit entspricht (1 Seite ≈ 1 Minute), auch auf A4.
 */
export const LINES_PER_PAGE = 55

/** Spalte des Textspiegels im Raster (1.5" − 1.0" = 0.5" = 5 Zeichen). */
export const TEXT_COL = 5
/** Breite des Textspiegels in Zeichen (6.0" bei 10 cpi). */
export const TEXT_WIDTH = 60
/** Spalte der gespiegelten Szenennummer rechts neben dem Textspiegel. */
const SCENE_NUM_RIGHT_COL = TEXT_COL + TEXT_WIDTH + 1

export type PaperName = 'letter' | 'a4'

export const PAPER: Record<PaperName, { widthIn: number; heightIn: number; cssFormat: string }> = {
  letter: { widthIn: 8.5, heightIn: 11, cssFormat: 'Letter' },
  a4: { widthIn: 8.2677, heightIn: 11.6929, cssFormat: 'A4' },
}

export type ElementType =
  | 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical'
  | 'transition' | 'note' | 'super' | 'intercut' | 'annotation' | 'more' | 'blank'

/** Einrückung (Spalte im Raster) und Satzbreite je Elementtyp. */
const GEOMETRY: Record<Exclude<ElementType, 'blank'>, { col: number; width: number }> = {
  scene_heading: { col: TEXT_COL, width: TEXT_WIDTH },
  action: { col: TEXT_COL, width: TEXT_WIDTH },
  character: { col: TEXT_COL + 22, width: TEXT_WIDTH - 22 },
  dialogue: { col: TEXT_COL + 10, width: 35 },
  parenthetical: { col: TEXT_COL + 16, width: 21 },
  transition: { col: TEXT_COL, width: TEXT_WIDTH },
  more: { col: TEXT_COL + 20, width: TEXT_WIDTH - 20 },
  super: { col: TEXT_COL, width: TEXT_WIDTH },
  intercut: { col: TEXT_COL, width: TEXT_WIDTH },
  note: { col: TEXT_COL, width: TEXT_WIDTH },
  annotation: { col: TEXT_COL, width: TEXT_WIDTH },
}

/** Leerzeilen VOR einem Element (Standardabstände). */
const SPACE_BEFORE: Record<Exclude<ElementType, 'blank'>, number> = {
  scene_heading: 2,
  action: 1,
  character: 1,
  dialogue: 0,
  parenthetical: 0,
  transition: 1,
  more: 0,
  super: 1,
  intercut: 1,
  note: 1,
  annotation: 1,
}

// ─── Zeilenumbruch im Monospace-Raster ────────────────────────────────────────

/**
 * Bricht Text auf eine Zeichenbreite um. Monospace macht das exakt vorhersagbar,
 * genau wie in Final Draft. Explizite Zeilenumbrüche bleiben erhalten; Wörter,
 * die länger als die Zeile sind, werden hart getrennt statt zu überlaufen.
 */
export function wrapMono(text: string, width: number): string[] {
  const out: string[] = []
  const paragraphs = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(w => w.length > 0)
    if (words.length === 0) { out.push(''); continue }

    let line = ''
    for (const word of words) {
      if (word.length > width) {
        if (line) { out.push(line); line = '' }
        let rest = word
        while (rest.length > width) { out.push(rest.slice(0, width)); rest = rest.slice(width) }
        line = rest
        continue
      }
      const candidate = line ? `${line} ${word}` : word
      if (candidate.length <= width) { line = candidate } else { out.push(line); line = word }
    }
    if (line) out.push(line)
  }

  return out.length > 0 ? out : ['']
}

// ─── Elemente ─────────────────────────────────────────────────────────────────

export interface SourceBlock {
  id?: number
  block_type: string
  content: string
  /** Szenennummer, nur bei scene_heading gesetzt. */
  scene_number?: string | null
  annotation_color?: string | null
}

export interface LaidOutLine {
  /** Spalte im Raster, ab der der Text beginnt. */
  col: number
  text: string
  type: ElementType
  /** Nur bei scene_heading: Nummer links und rechts neben dem Spiegel. */
  sceneNumber?: string
  /** Für farbige Randnotizen im "mit Notizen"-Export. */
  color?: string
}

export interface LaidOutPage {
  /** Seitenzahl im Drehbuch; Titel-/Synopsisseiten haben keine. */
  number: number | null
  lines: LaidOutLine[]
}

interface Element {
  type: Exclude<ElementType, 'blank'>
  lines: string[]
  spaceBefore: number
  /** Darf nicht als letzte Zeile einer Seite stehen (Waise). */
  keepWithNext: boolean
  /** Figurenname, zu dem dieses Element gehört — für (MORE)/(CONT'D). */
  speaker?: string
  sceneNumber?: string
  color?: string
}

const BLANK: LaidOutLine = { col: 0, text: '', type: 'blank' }

/** Figurenname ohne Zusätze wie (V.O.) oder (CONT'D), für Vergleiche. */
function bareName(s: string): string {
  return String(s || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toUpperCase()
}

/**
 * Wandelt die Editor-Blöcke einer Szene in gesetzte Elemente um.
 *
 * Setzt (CONT'D) hinter den Figurennamen, wenn dieselbe Figur nach einer
 * Unterbrechung durch Action erneut spricht — das ist die Konvention innerhalb
 * einer Seite und unabhängig vom (CONT'D) am Seitenumbruch.
 */
function blocksToElements(blocks: SourceBlock[], includeAnnotations: boolean): Element[] {
  const els: Element[] = []
  let lastSpeaker: string | null = null

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const raw = String(b.content ?? '')
    const type = (b.block_type || 'action') as string

    if (type === 'annotation' && !includeAnnotations) continue

    switch (type) {
      case 'scene_heading': {
        lastSpeaker = null
        const text = raw.trim().toUpperCase()
        if (!text) break
        els.push({
          type: 'scene_heading',
          lines: wrapMono(text, GEOMETRY.scene_heading.width),
          spaceBefore: SPACE_BEFORE.scene_heading,
          keepWithNext: true,
          sceneNumber: b.scene_number ? String(b.scene_number) : undefined,
        })
        break
      }

      case 'character': {
        const name = raw.trim().toUpperCase()
        if (!name) break
        // (CONT'D) nur, wenn dieselbe Figur nach Action erneut ansetzt
        const isResuming = lastSpeaker !== null && bareName(name) === lastSpeaker
        const shown = isResuming && !/\(CONT'D\)\s*$/i.test(name) ? `${name} (CONT'D)` : name
        lastSpeaker = bareName(name)
        els.push({
          type: 'character',
          lines: wrapMono(shown, GEOMETRY.character.width),
          spaceBefore: SPACE_BEFORE.character,
          keepWithNext: true,
          speaker: shown,
        })
        break
      }

      case 'dialogue': {
        if (!raw.trim()) break
        els.push({
          type: 'dialogue',
          lines: wrapMono(raw, GEOMETRY.dialogue.width),
          spaceBefore: SPACE_BEFORE.dialogue,
          keepWithNext: false,
          speaker: lastSpeaker ?? undefined,
        })
        break
      }

      case 'parenthetical': {
        const t = raw.trim()
        if (!t) break
        const wrapped = t.startsWith('(') ? t : `(${t})`
        els.push({
          type: 'parenthetical',
          lines: wrapMono(wrapped, GEOMETRY.parenthetical.width),
          spaceBefore: SPACE_BEFORE.parenthetical,
          keepWithNext: true,
          speaker: lastSpeaker ?? undefined,
        })
        break
      }

      case 'transition': {
        const t = raw.trim().toUpperCase()
        if (!t) break
        lastSpeaker = null
        els.push({
          type: 'transition',
          lines: [t.slice(0, GEOMETRY.transition.width)],
          spaceBefore: SPACE_BEFORE.transition,
          keepWithNext: false,
        })
        break
      }

      case 'super':
      case 'intercut': {
        const t = raw.trim().toUpperCase()
        if (!t) break
        lastSpeaker = null
        els.push({
          type: type as 'super' | 'intercut',
          lines: wrapMono(t, GEOMETRY[type as 'super' | 'intercut'].width),
          spaceBefore: SPACE_BEFORE[type as 'super' | 'intercut'],
          keepWithNext: false,
        })
        break
      }

      case 'note':
      case 'annotation': {
        // Produktionsnotizen unterbrechen die Figurenrede nicht, lastSpeaker bleibt.
        if (!raw.trim()) break
        els.push({
          type: type as 'note' | 'annotation',
          lines: wrapMono(raw, GEOMETRY[type as 'note' | 'annotation'].width),
          spaceBefore: SPACE_BEFORE[type as 'note' | 'annotation'],
          keepWithNext: false,
          color: type === 'annotation' ? (b.annotation_color || '#f59e0b') : undefined,
        })
        break
      }

      default: {
        // action und alles Unbekannte.
        // lastSpeaker bleibt absichtlich stehen: Genau eine Unterbrechung durch
        // Action ist der Fall, für den (CONT'D) gedacht ist.
        if (!raw.trim()) break
        els.push({
          type: 'action',
          lines: wrapMono(raw, GEOMETRY.action.width),
          spaceBefore: SPACE_BEFORE.action,
          keepWithNext: false,
        })
      }
    }
  }

  return els
}

// ─── Paginierung ──────────────────────────────────────────────────────────────

/** Mindestzahl Zeilen, die beim Trennen auf jeder Seite bleiben müssen. */
const MIN_SPLIT_LINES = 2

/** Elementtypen, die über einen Seitenumbruch getrennt werden dürfen. */
function isSplittable(type: ElementType): boolean {
  return type === 'dialogue' || type === 'action' || type === 'note'
}

/**
 * Wie viele Zeilen dieses Elements müssen auf der aktuellen Seite Platz haben,
 * damit es dort überhaupt beginnen darf?
 *
 * Ein Block mit weniger als 2·MIN_SPLIT_LINES Zeilen lässt sich nicht trennen
 * (eine der beiden Hälften bliebe unter dem Minimum) und muss deshalb komplett
 * passen. Ein trennbarer Dialog braucht zusätzlich eine Zeile für (MORE).
 */
function minLinesToStart(el: { type: ElementType; lines: string[] }): number {
  const len = el.lines.length
  if (!isSplittable(el.type) || len < 2 * MIN_SPLIT_LINES) return len
  return MIN_SPLIT_LINES + (el.type === 'dialogue' ? 1 : 0)
}

function lineOf(el: Element, text: string): LaidOutLine {
  return { col: GEOMETRY[el.type].col, text, type: el.type, color: el.color }
}

/** Rechtsbündig im Textspiegel — für Transitions. */
function rightAlign(text: string): number {
  return TEXT_COL + Math.max(0, TEXT_WIDTH - text.length)
}

/** Mittig im Textspiegel — für SUPER. */
function centerCol(text: string): number {
  return TEXT_COL + Math.max(0, Math.floor((TEXT_WIDTH - text.length) / 2))
}

/**
 * Platzbedarf einer zusammenhängenden Elementkette ab Index `i`.
 *
 * Zusammenhängende Elemente (Szenenüberschrift, Figurenname, Klammerbemerkung)
 * müssen vollständig auf dieselbe Seite wie ihr Anschluss; vom ersten trennbaren
 * Element zählt nur der Mindestanfang.
 */
function chainNeed(elements: Element[], i: number): number {
  let need = elements[i].lines.length
  for (let j = i + 1; j < elements.length; j++) {
    const e = elements[j]
    need += e.spaceBefore + (e.keepWithNext ? e.lines.length : minLinesToStart(e))
    if (!e.keepWithNext) break
  }
  return need
}

export interface SceneInput {
  scene_number?: string | null
  blocks: SourceBlock[]
}

export interface LayoutOptions {
  includeAnnotations?: boolean
  linesPerPage?: number
  /** Seitenzahl der ersten Drehbuchseite (Titelseiten zählen nicht mit). */
  firstPageNumber?: number
}

/**
 * Setzt das Drehbuch in Seiten. Regeln, die hier durchgesetzt werden:
 *  - eine Szenenüberschrift steht nie als letzte Zeile einer Seite
 *  - ein Figurenname steht nie ohne mindestens zwei Dialogzeilen darunter
 *  - Dialog und Action werden nur getrennt, wenn beide Teile ≥ 2 Zeilen behalten
 *  - getrennter Dialog erhält (MORE) unten und "NAME (CONT'D)" oben auf der Folgeseite
 */
export function layoutScreenplay(scenes: SceneInput[], opts: LayoutOptions = {}): LaidOutPage[] {
  const linesPerPage = opts.linesPerPage ?? LINES_PER_PAGE
  const includeAnnotations = opts.includeAnnotations ?? false
  let pageNumber = opts.firstPageNumber ?? 1

  const elements: Element[] = []
  for (const scene of scenes) {
    const blocks = scene.blocks.map(b =>
      b.block_type === 'scene_heading' && !b.scene_number
        ? { ...b, scene_number: scene.scene_number ?? null }
        : b
    )
    elements.push(...blocksToElements(blocks, includeAnnotations))
  }

  const pages: LaidOutPage[] = []
  let current: LaidOutLine[] = []

  const remaining = () => linesPerPage - current.length

  function flushPage() {
    // Nachlaufende Leerzeilen nicht mit auf die Seite nehmen
    while (current.length > 0 && current[current.length - 1].type === 'blank') current.pop()
    if (current.length > 0) pages.push({ number: pageNumber++, lines: current })
    current = []
  }

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    const geo = GEOMETRY[el.type]

    // Sonderfall Transition/SUPER: Ausrichtung berechnen
    const renderLine = (text: string, idx: number): LaidOutLine => {
      if (el.type === 'transition') return { col: rightAlign(text), text, type: 'transition' }
      if (el.type === 'super') return { col: centerCol(text), text, type: 'super' }
      const line = lineOf(el, text)
      if (el.type === 'scene_heading' && idx === 0 && el.sceneNumber) line.sceneNumber = el.sceneNumber
      return line
    }

    const pushLead = (n: number) => { for (let s = 0; s < n; s++) current.push(BLANK) }
    const pushAll = () => el.lines.forEach((t, idx) => current.push(renderLine(t, idx)))

    // Am Seitenanfang entfallen die Leerzeilen vor dem Element
    let lead = current.length > 0 ? el.spaceBefore : 0

    if (el.keepWithNext) {
      // Überschrift und Figurenname dürfen nicht allein am Seitenfuß landen.
      // Der Platzbedarf wird VOR den Leerzeilen geprüft und läuft die Kette der
      // zusammenhängenden Elemente ab (Figur → Klammerbemerkung → Dialog),
      // sonst frisst der Abstand des Folgeelements den reservierten Platz.
      if (lead + chainNeed(elements, i) > remaining()) {
        flushPage()
        lead = 0
      }
      pushLead(lead)
      pushAll()
      continue
    }

    if (lead + el.lines.length <= remaining()) {
      pushLead(lead)
      pushAll()
      continue
    }

    const splittable = el.type === 'dialogue' || el.type === 'action' || el.type === 'note'
    const isDialogue = el.type === 'dialogue'
    // Bei Dialog kostet (MORE) eine zusätzliche Zeile auf dieser Seite
    const budget = remaining() - lead - (isDialogue ? 1 : 0)
    const tailAfterSplit = el.lines.length - budget

    // Trennen nur, wenn beide Hälften genug Zeilen behalten — sonst komplett
    // auf die nächste Seite schieben
    if (!splittable || budget < MIN_SPLIT_LINES || tailAfterSplit < MIN_SPLIT_LINES) {
      flushPage()
      pushAll()
      continue
    }

    pushLead(lead)
    el.lines.slice(0, budget).forEach((t, idx) => current.push(renderLine(t, idx)))
    if (isDialogue) current.push({ col: GEOMETRY.more.col, text: '(MORE)', type: 'more' })
    flushPage()

    if (isDialogue && el.speaker) {
      const name = /\(CONT'D\)\s*$/i.test(el.speaker) ? el.speaker : `${el.speaker} (CONT'D)`
      current.push({ col: GEOMETRY.character.col, text: name.slice(0, GEOMETRY.character.width), type: 'character' })
    }
    el.lines.slice(budget).forEach(t => current.push({ col: geo.col, text: t, type: el.type, color: el.color }))
  }

  flushPage()
  return pages
}
