/**
 * Auflösung & Shotlist.
 *
 * Die Liste hat zwei Leser mit verschiedenen Fragen. In der Vorbereitung fragt
 * die Regie "wie löse ich diese Szene auf?" - dafür wird nach Szene gruppiert.
 * Am Drehtag fragt die Kamera "was steht heute an?" - dafür nach Drehtag. Beides
 * ist dieselbe Liste, nur anders gebündelt.
 *
 * Was frueher fehlte und auf jeder Shotlist der Branche steht: das Storyboard,
 * die Notiz zur Einstellung (VFX, Requisite, Sicherheit) und ein Kaestchen zum
 * Abhaken.
 */
import {
  renderDocument, table, stats, section, hint,
  fmtDuration, fmtDate, fmtEighths,
  type Column,
} from './documentLayout'

export type GroupMode = 'szene' | 'drehtag'

export interface Shot {
  id: number
  scene_id: number | null
  shoot_day_id: number | null
  shot_number: string
  size: string | null
  movement: string | null
  lens_mm: string | null
  description: string | null
  notes: string | null
  duration_seconds: number | null
  done: number | boolean | null
  /** Circle Take - Freitext, in der Praxis steht auch "3, 5" darin. */
  best_take?: string | null
  sort_order: number
  /** Als Daten-URI eingebettet - ein Link auf /uploads/… bliebe im Druck leer. */
  storyboard?: string | null
}

export interface Scene {
  id: number
  scene_number: string
  title: string | null
  int_ext: string | null
  day_night: string | null
  eighths: number | null
  location_name?: string | null
  sort_order: number
}

export interface ShootDay {
  id: number
  day_number: number
  date: string | null
}

export interface ShotGroup {
  key: string
  title: string
  /** Einordnung der Gruppe, etwa "INT · TAG · Altbauwohnung". */
  context: string
  /** Zusammenfassung rechts neben der Überschrift. */
  note: string
  shots: Shot[]
}

const seconds = (shot: Shot) => Number(shot.duration_seconds) || 0
const isDone = (shot: Shot) => Boolean(shot.done)

/** Materiallänge einer Gruppe in Minuten - die Tabelle rechnet in Sekunden. */
export function totalMinutes(shots: Shot[]): number {
  return Math.round(shots.reduce((sum, s) => sum + seconds(s), 0) / 60)
}

export function summarise(shots: Shot[]): string {
  const done = shots.filter(isDone).length
  const parts = [`${shots.length} ${shots.length === 1 ? 'Einstellung' : 'Einstellungen'}`]
  const mins = totalMinutes(shots)
  if (mins > 0) parts.push(`${fmtDuration(mins)} Material`)
  if (done > 0) parts.push(`${done} erledigt`)
  return parts.join(' · ')
}

/** Einordnung einer Szene: INT/EXT, Tag/Nacht, Motiv - jeweils nur wenn erfasst. */
export function sceneContext(scene: Scene): string {
  return [scene.int_ext, scene.day_night, scene.location_name]
    .map(v => String(v ?? '').trim())
    .filter(Boolean)
    .join(' · ')
}

/**
 * Einstellungen bündeln.
 *
 * Gruppen ohne Einstellungen fallen weg - eine Szene, die noch nicht aufgelöst
 * ist, braucht keine leere Tabelle. Was keiner Gruppe zugeordnet ist, kommt
 * ans Ende: übersehen wäre schlimmer als unsortiert.
 */
export function groupShots(shots: Shot[], scenes: Scene[], days: ShootDay[], mode: GroupMode): ShotGroup[] {
  const groups: ShotGroup[] = []
  const byKey = new Map<number, Shot[]>()
  const lose: Shot[] = []

  for (const shot of shots) {
    const key = mode === 'szene' ? shot.scene_id : shot.shoot_day_id
    if (key === null || key === undefined) { lose.push(shot); continue }
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(shot)
  }

  if (mode === 'szene') {
    for (const scene of scenes) {
      const list = byKey.get(scene.id)
      if (!list?.length) continue
      byKey.delete(scene.id)
      groups.push({
        key: `szene-${scene.id}`,
        title: `Szene ${scene.scene_number}${scene.title ? `: ${scene.title}` : ''}`,
        context: [sceneContext(scene), scene.eighths ? `${fmtEighths(scene.eighths)} Seiten` : '']
          .filter(Boolean).join(' · '),
        note: summarise(list),
        shots: list,
      })
    }
  } else {
    for (const day of days) {
      const list = byKey.get(day.id)
      if (!list?.length) continue
      byKey.delete(day.id)
      groups.push({
        key: `tag-${day.id}`,
        title: `Drehtag ${day.day_number}`,
        context: day.date ? fmtDate(day.date) : '',
        note: summarise(list),
        shots: list,
      })
    }
  }

  // Verweise, die ins Leere zeigen (geloeschte Szene, geloeschter Drehtag)
  for (const list of byKey.values()) lose.push(...list)

  if (lose.length > 0) {
    groups.push({
      key: 'ohne',
      title: mode === 'szene' ? 'Ohne Szene' : 'Noch keinem Drehtag zugeordnet',
      context: '',
      note: summarise(lose),
      shots: lose,
    })
  }

  return groups
}

/** Nur die tatsächlich verwendeten Abkürzungen erklären. */
export function legend(shots: Shot[]): Array<{ code: string; text: string }> {
  const bedeutung: Record<string, string> = {
    ECU: 'Extreme Close-Up - Detail',
    CU: 'Close-Up - Nah',
    MCU: 'Medium Close-Up - Groß',
    MS: 'Medium Shot - Halbnah',
    MWS: 'Medium Wide Shot - Halbtotale',
    WS: 'Wide Shot - Totale',
    EWS: 'Extreme Wide Shot - Weite Totale',
  }
  const used = new Set(shots.map(s => String(s.size ?? '').trim()).filter(Boolean))
  return Object.entries(bedeutung)
    .filter(([code]) => used.has(code))
    .map(([code, text]) => ({ code, text }))
}

function esc(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Beschreibung und Notiz in einer Zelle - die Notiz gehört zur Einstellung. */
function shotCell(shot: Shot): string {
  const beschreibung = String(shot.description ?? '').trim()
  const notiz = String(shot.notes ?? '').trim()
  if (!beschreibung && !notiz) return '—'
  return [
    beschreibung ? `<div>${esc(beschreibung).replace(/\n/g, '<br>')}</div>` : '',
    notiz ? `<div class="shot-note">${esc(notiz).replace(/\n/g, '<br>')}</div>` : '',
  ].join('')
}

export interface ShotlistOptions {
  projectTitle: string
  director?: string | null
  dop?: string | null
  accent?: string
  mode: GroupMode
  groups: ShotGroup[]
  allShots: Shot[]
  /** Fuer den Querverweis: nach Drehtag gruppiert fehlt sonst die Szene. */
  scenes: Scene[]
  days: ShootDay[]
}

const EXTRA_CSS = `
  /* Storyboard: feste Hoehe, damit die Zeilen gleich hoch bleiben */
  .sb { width: 100%; max-height: 18mm; object-fit: contain; display: block; }
  .sb-leer { height: 18mm; border: 0.5pt dashed #d4d4d8; border-radius: 2pt; }
  .shot-note { font-size: 7.5pt; color: #71717a; margin-top: 1.5pt; }
  /* Kaestchen zum Abhaken am Set */
  .kasten { display: inline-block; width: 8pt; height: 8pt; border: 0.8pt solid #a1a1aa; border-radius: 1.5pt; }
  .kasten.voll { border-color: #15803d; background: #15803d; position: relative; }
  .kasten.voll::after { content: '✓'; color: #fff; font-size: 7pt; position: absolute; top: -1.5pt; left: 1pt; }
  .legende { display: flex; flex-wrap: wrap; gap: 4pt 14pt; font-size: 7.5pt; color: #52525b; }
  .legende b { color: #18181b; }
`

export function renderShotlistHtml(opts: ShotlistOptions): string {
  const { allShots, groups, mode, scenes, days } = opts
  const mitBild = allShots.some(s => s.storyboard)
  const erledigt = allShots.filter(isDone).length
  const aufgeloest = new Set(allShots.map(s => s.scene_id).filter(v => v !== null)).size

  const szeneNach = new Map(scenes.map(sc => [sc.id, sc]))
  const tagNach = new Map(days.map(d => [d.id, d]))
  // Quer zur Gruppierung: nach Drehtag gebuendelt braucht jede Zeile die Szene,
  // nach Szene gebuendelt den Drehtag. Ohne das steht man am Set vor "3C" und
  // weiss nicht, wo das hingehoert.
  const mitTag = mode === 'szene' && allShots.some(s => s.shoot_day_id != null)

  const columns: Column<Shot>[] = []
  if (mitBild) {
    columns.push({
      header: 'Storyboard',
      value: s => (s.storyboard ? `<img class="sb" src="${s.storyboard}" alt="">` : '<div class="sb-leer"></div>'),
      html: true,
      width: '14%',
    })
  }
  columns.push({ header: 'Nr.', value: s => s.shot_number, width: '5%' })
  if (mode === 'drehtag') {
    columns.push({
      header: 'Szene',
      value: s => {
        const sc = s.scene_id != null ? szeneNach.get(s.scene_id) : undefined
        if (!sc) return null
        const zusatz = [sc.int_ext, sc.day_night].filter(Boolean).join('/')
        return zusatz ? `${sc.scene_number} (${zusatz})` : sc.scene_number
      },
      width: '10%',
    })
  }
  if (mitTag) {
    columns.push({
      header: 'Tag',
      value: s => {
        const d = s.shoot_day_id != null ? tagNach.get(s.shoot_day_id) : undefined
        return d ? String(d.day_number) : null
      },
      align: 'center',
      width: '5%',
    })
  }
  columns.push(
    { header: 'Größe', value: s => s.size, width: '7%' },
    { header: 'Bewegung', value: s => s.movement, width: '10%' },
    { header: 'Objektiv', value: s => (s.lens_mm ? `${s.lens_mm} mm` : null), align: 'right', width: '8%' },
    { header: 'Einstellung', value: s => shotCell(s), html: true },
    { header: 'Dauer', value: s => (seconds(s) > 0 ? `${seconds(s)} s` : null), align: 'right', width: '7%' },
  )

  // Bester Take: nach Drehtag gebuendelt immer, denn dort wird er am Set von
  // Hand eingetragen - ein Strich waere da im Weg. Sonst nur, wenn es ihn gibt.
  if (mode === 'drehtag' || allShots.some(s => String(s.best_take ?? '').trim())) {
    columns.push({
      header: 'Bester Take',
      value: s => {
        const take = String(s.best_take ?? '').trim()
        return take ? `<b>${esc(take)}</b>` : '&nbsp;'
      },
      html: true,
      align: 'center',
      width: '8%',
    })
  }

  columns.push(
    { header: '✓', value: s => `<span class="kasten${isDone(s) ? ' voll' : ''}"></span>`, html: true, align: 'center', width: '4%' },
  )

  const body = groups.map(g => section(
    g.title,
    (g.context ? `<div class="shot-kontext">${esc(g.context)}</div>` : '') +
    table({ columns, rows: g.shots }),
    g.note
  )).join('')

  const abk = legend(allShots)

  return renderDocument({
    kind: 'Auflösung & Shotlist',
    title: opts.projectTitle,
    project: opts.projectTitle,
    accent: opts.accent,
    landscape: true,
    subtitle: mode === 'drehtag'
      ? `${allShots.length} Einstellungen · nach Drehtag`
      : `${allShots.length} Einstellungen in ${aufgeloest} Szenen`,
    meta: [
      { label: 'Regie', value: opts.director },
      { label: 'Kamera', value: opts.dop },
      { label: 'Stand', value: fmtDate(new Date().toISOString()) },
    ],
    extraCss: EXTRA_CSS + '\n  .shot-kontext { font-size: 8pt; color: #52525b; margin-bottom: 4pt; }',
    body:
      stats([
        { label: 'Einstellungen', value: allShots.length },
        { label: 'Aufgelöste Szenen', value: `${aufgeloest} / ${scenes.length}` },
        { label: 'Geplante Materiallänge', value: fmtDuration(totalMinutes(allShots)) },
        { label: 'Erledigt', value: `${erledigt} / ${allShots.length}`, hint: allShots.length > 0 ? `${Math.round((erledigt / allShots.length) * 100)} %` : undefined },
      ]) +
      (body || hint('Noch keine Einstellungen erfasst.')) +
      (abk.length > 0
        ? section('Abkürzungen', `<div class="legende">${abk.map(a => `<span><b>${esc(a.code)}</b> ${esc(a.text)}</span>`).join('')}</div>`)
        : ''),
  })
}
