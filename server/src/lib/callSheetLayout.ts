/**
 * Call Sheet im Branchenstandard - zwei Seiten.
 *
 * Seite 1 ist das Blatt, das am Set in der Hand liegt: Zeiten, Sicherheit,
 * Szenen, Cast, Departmentnotizen, Vorschau auf die naechsten Tage.
 * Seite 2 ist die Crewliste nach Departments in drei Spalten.
 *
 * Die Anordnung folgt der ueblichen Vorlage, weil jeder am Set weiss, wo er
 * schauen muss - die Position einer Angabe ist hier Teil der Information.
 */

// ─── Formatierung ─────────────────────────────────────────────────────────────

/** Minuten seit Mitternacht als 12-Stunden-Zeit, wie im Standard ueblich. */
export function fmtCallTime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(Number(minutes))) return ''
  const total = Math.max(0, Math.floor(Number(minutes)))
  const h24 = Math.floor(total / 60) % 24
  const m = total % 60
  const suffix = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/**
 * Achtel als Seitenangabe: 8 Achtel sind eine Seite.
 * Die Branche schreibt "2 3/8", nicht "19/8" - so laesst sich der Tag im Kopf
 * ueberschlagen.
 */
export function fmtEighths(eighths: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(eighths) || 0))
  if (total === 0) return ''
  const pages = Math.floor(total / 8)
  const rest = total % 8
  if (pages === 0) return `${rest}/8`
  if (rest === 0) return String(pages)
  return `${pages} ${rest}/8`
}

/** Summe mehrerer Achtel-Angaben als Seitenzahl. */
export function sumEighths(values: Array<number | null | undefined>): string {
  return fmtEighths(values.reduce((n: number, v) => n + (Number(v) || 0), 0))
}

/** INT/EXT und Tag/Nacht zum Kuerzel der Vorlage: D1, N3, … */
export function dayNightCode(intExt: string | null | undefined, dayNight: string | null | undefined, index = 1): string {
  const night = /nacht|night|nite/i.test(String(dayNight ?? ''))
  const dusk = /dämmer|daemmer|dusk|dawn/i.test(String(dayNight ?? ''))
  const letter = night ? 'N' : dusk ? 'X' : 'D'
  return `${letter}${index}`
}

/** Deutsches Datum mit Wochentag, wie es oben rechts auf dem Blatt steht. */
export function fmtSheetDate(date: string | null | undefined): string {
  const d = new Date(String(date ?? ''))
  if (Number.isNaN(d.getTime())) return String(date ?? '')
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Crew nach Departments ────────────────────────────────────────────────────

/**
 * Reihenfolge der Departments auf Seite 2. Bewusst fest verdrahtet: Am Set
 * sucht man an der gewohnten Stelle, eine alphabetische Sortierung waere zwar
 * ordentlich, aber unbrauchbar.
 */
export const DEPARTMENT_ORDER = [
  'Produktion', 'Regie', 'Aufnahmeleitung', 'Script', 'Kamera', 'Ton', 'Licht', 'Bühne',
  'Szenenbild', 'Ausstattung', 'Kostüm', 'Maske', 'SFX', 'VFX', 'Stunt',
  'Postproduktion', 'Catering', 'Fahrdienst', 'Sicherheit', 'Sonstige',
]

export interface CrewMember {
  name?: string
  role?: string
  department?: string
  call_time?: number | null
}

/**
 * Gruppiert die Crew nach Department in der Reihenfolge oben; unbekannte
 * Departments hängen hinten dran, statt still zu verschwinden.
 */
export function groupByDepartment(crew: CrewMember[]): Array<{ department: string; members: CrewMember[] }> {
  const buckets = new Map<string, CrewMember[]>()
  for (const c of crew) {
    const dept = String(c.department ?? '').trim() || 'Sonstige'
    const list = buckets.get(dept)
    if (list) list.push(c)
    else buckets.set(dept, [c])
  }

  const known = DEPARTMENT_ORDER.filter(d => buckets.has(d)).map(d => ({ department: d, members: buckets.get(d)! }))
  const rest = [...buckets.keys()]
    .filter(d => !DEPARTMENT_ORDER.includes(d))
    .sort()
    .map(d => ({ department: d, members: buckets.get(d)! }))

  return [...known, ...rest]
}

/**
 * Verteilt die Departments auf drei Spalten, ohne eines zu zerreissen.
 * Es wird nach Zeilenzahl ausgeglichen, nicht nach Anzahl der Departments -
 * sonst steht eine Spalte voll und zwei sind leer.
 */
export function balanceColumns(
  groups: Array<{ department: string; members: CrewMember[] }>,
  columns = 3
): Array<Array<{ department: string; members: CrewMember[] }>> {
  const result: Array<Array<{ department: string; members: CrewMember[] }>> = Array.from({ length: columns }, () => [])
  const heights = new Array(columns).fill(0)

  for (const g of groups) {
    // Ueberschrift plus Zeilen
    const cost = g.members.length + 2
    let target = 0
    for (let i = 1; i < columns; i++) if (heights[i] < heights[target]) target = i
    result[target].push(g)
    heights[target] += cost
  }
  return result
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

export interface CallSheetData {
  project: any
  day: any
  sheet: any
  /** Szenen des Tages inklusive Motiv und Figuren. */
  scenes: Array<any>
  /** Cast-Zeilen mit Rollen-ID, Status und Zeiten. */
  cast: Array<any>
  /** Komparsen und Stand-Ins. */
  background: Array<any>
  crew: CrewMember[]
  /** Die naechsten Drehtage fuer die Vorschau. */
  advance: Array<{ day: any; scenes: any[] }>
  totalDays: number
}

/** Ein Abschnitt der Departmentnotizen auf Seite 1. */
const DEPT_NOTE_ROWS = [
  'PROPS', 'MASKE/HAARE', 'KOSTÜM', 'SET DRESS', 'SFX', 'WAFFEN',
  'KAMERA', 'TON', 'BÜHNE/LICHT', 'STUNTS', 'MOTIV', 'FAHRDIENST',
]

export function renderCallSheetHtml(data: CallSheetData): string {
  const { project, day, sheet, scenes, cast, background, crew, advance, totalDays } = data
  const s = sheet ?? {}

  const sceneRows = scenes.map((sc, i) => `<tr>
    <td class="c b">${esc(sc.scene_number)}</td>
    <td class="c">${esc(fmtEighths(sc.eighths))}</td>
    <td class="set ${sc.int_ext === 'EXT' ? 'ext' : 'int'}">
      <b>${esc(String(sc.int_ext || 'INT').toUpperCase())}. ${esc(String(sc.title || '').toUpperCase())}</b>
      ${sc.description ? `<div class="desc">${esc(sc.description)}</div>` : ''}
    </td>
    <td class="c">${esc(dayNightCode(sc.int_ext, sc.day_night, i + 1))}</td>
    <td class="c">${esc(sc.cast_ids || '')}</td>
    <td>${esc(sc.notes || '')}</td>
    <td>${esc(sc.location_name || '')}</td>
  </tr>`).join('')

  const castRows = cast.map(c => `<tr>
    <td class="c">${esc(c.cast_no ?? '')}</td>
    <td>${esc(c.role || '')}</td>
    <td>${esc(c.name || '')}</td>
    <td class="c b">${esc(c.cast_status || '')}</td>
    <td class="c">${esc(c.pickup_location || '')}</td>
    <td class="c b">${esc(fmtCallTime(c.call_time))}</td>
    <td class="c">${esc(fmtCallTime(c.blk_reh))}</td>
    <td class="c">${esc(fmtCallTime(c.on_set))}</td>
    <td class="c">${esc(fmtCallTime(c.lose_at))}</td>
    <td>${esc(c.notes || '')}</td>
  </tr>`).join('')

  const bgRows = background.map(b => `<tr>
    <td class="c">${esc(b.qty ?? 1)}</td>
    <td>${esc(b.name || b.role || '')}</td>
    <td class="c b">${esc(fmtCallTime(b.call_time))}</td>
  </tr>`).join('')

  const deptNotes = parseDeptNotes(s.dept_notes)
  const deptRows = DEPT_NOTE_ROWS.map(label => `<tr>
    <td class="dept">${esc(label)}</td>
    <td>${esc(deptNotes[label] || '')}</td>
  </tr>`).join('')

  const advanceBlocks = advance.map(a => `
    <tr class="advhead"><td colspan="7">
      Drehtag ${esc(a.day.day_number)} - ${esc(fmtSheetDate(a.day.date))}
    </td></tr>
    ${a.scenes.map((sc, i) => `<tr>
      <td class="c b">${esc(sc.scene_number)}</td>
      <td class="c">${esc(fmtEighths(sc.eighths))}</td>
      <td class="set ${sc.int_ext === 'EXT' ? 'ext' : 'int'}">
        <b>${esc(String(sc.int_ext || 'INT').toUpperCase())}. ${esc(String(sc.title || '').toUpperCase())}</b>
        ${sc.description ? `<div class="desc">${esc(sc.description)}</div>` : ''}
      </td>
      <td class="c">${esc(dayNightCode(sc.int_ext, sc.day_night, i + 1))}</td>
      <td class="c">${esc(sc.cast_ids || '')}</td>
      <td>${esc(sc.notes || '')}</td>
      <td>${esc(sc.location_name || '')}</td>
    </tr>`).join('')}
    <tr class="sum"><td colspan="2" class="r">Seiten gesamt</td><td colspan="5">${esc(sumEighths(a.scenes.map(x => x.eighths)))}</td></tr>
  `).join('')

  const columns = balanceColumns(groupByDepartment(crew))
  const crewColumns = columns.map(col => `<td class="crewcol">
    ${col.map(g => `
      <table class="crewtab">
        <tr class="dept2"><td colspan="4">${esc(g.department.toUpperCase())}</td></tr>
        ${g.members.map((m, i) => `<tr>
          <td class="c num">${i + 1}</td>
          <td class="ttl">${esc(m.role || '')}</td>
          <td>${esc(m.name || '')}</td>
          <td class="c b">${esc(fmtCallTime(m.call_time))}</td>
        </tr>`).join('')}
      </table>`).join('')}
  </td>`).join('')

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Call Sheet - ${esc(project?.title)} - Drehtag ${esc(day?.day_number)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 7.4pt; color: #000; }

  table { width: 100%; border-collapse: collapse; }
  td, th { border: 0.5pt solid #444; padding: 1.4pt 3pt; vertical-align: top;
           overflow-wrap: anywhere; word-break: break-word; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: bold; }
  .nb td { border: none; }

  /* Kopf */
  .top td { border: 0.5pt solid #000; }
  .prod { width: 22%; font-size: 7pt; line-height: 1.35; }
  .titlebox { text-align: center; vertical-align: middle; }
  .titlebox .name { font-size: 17pt; font-weight: bold; letter-spacing: -0.02em; }
  .titlebox .sub { font-size: 8.5pt; margin-top: 1pt; }
  .titlebox .call { font-size: 22pt; font-weight: bold; background: #1d4ed8; color: #fff;
                    display: inline-block; padding: 2pt 16pt; margin-top: 3pt; border-radius: 2pt; }
  .datebox { width: 24%; text-align: center; }
  .datebox .d { font-weight: bold; font-size: 8.5pt; }
  .datebox .n { font-weight: bold; margin-top: 2pt; }
  .times td { font-size: 7.2pt; }
  .times .lbl { background: #eef2f7; }

  .safety { background: #000; color: #fff; text-align: center; font-weight: bold;
            font-size: 7.2pt; letter-spacing: 0.03em; padding: 2.5pt; }

  /* Szenen */
  thead th { background: #dbe3ee; font-size: 6.8pt; text-transform: uppercase; letter-spacing: 0.03em; }
  .set { font-size: 7.2pt; }
  .set.int { border-left: 3pt solid #1d4ed8; }
  .set.ext { border-left: 3pt solid #15803d; }
  .desc { font-weight: normal; color: #333; font-size: 6.9pt; }
  .sum td { background: #f1f5f9; font-weight: bold; }
  .advhead td { background: #e2e8f0; font-weight: bold; font-size: 7.2pt; }

  .section { background: #cbd5e1; font-weight: bold; font-size: 7pt;
             text-transform: uppercase; letter-spacing: 0.04em; padding: 2pt 3pt; }
  .dept { width: 88pt; background: #f1f5f9; font-weight: bold; font-size: 6.9pt; }

  .sign td { border: none; padding-top: 14pt; text-align: center; font-size: 7pt; }
  .sign .line { border-top: 0.5pt solid #000; padding-top: 2pt; font-weight: bold; }

  /* Seite 2 */
  .page2 { page-break-before: always; }
  .crewcol { width: 33.33%; vertical-align: top; border: none; padding: 0 2pt; }
  .crewtab { margin-bottom: 5pt; }
  .crewtab td { font-size: 6.8pt; padding: 1pt 2.5pt; }
  .dept2 td, td.dept2 { background: #cbd5e1; font-weight: bold; text-align: center;
                        font-size: 6.9pt; letter-spacing: 0.03em; }
  .num { width: 12pt; color: #666; }
  .ttl { width: 38%; }
  .walkie { background: #000; color: #fff; font-size: 6.8pt; padding: 3pt; margin-top: 4pt; }
</style>
</head>
<body>

<!-- ── Kopf ── -->
<table class="top">
  <tr>
    <td class="prod">
      <b>${esc(project?.production_company || project?.title)}</b><br>
      ${project?.producer ? `${esc(project.producer)}<br>` : ''}
      ${s.basecamp ? `${esc(s.basecamp)}<br>` : ''}
    </td>
    <td class="titlebox">
      <div class="name">${esc(project?.title)}</div>
      <div class="sub">CALL SHEET · ALLGEMEINER CREW-CALL</div>
      <div class="call">${esc(fmtCallTime(s.general_call) || '—')}</div>
    </td>
    <td class="datebox">
      <div class="d">${esc(fmtSheetDate(day?.date))}</div>
      <div class="n">Drehtag ${esc(day?.day_number)} von ${esc(totalDays)}</div>
      <table class="times" style="margin-top:3pt">
        ${s.breakfast_call ? `<tr><td class="lbl">Frühstück</td><td class="c b">${esc(fmtCallTime(s.breakfast_call))}</td></tr>` : ''}
        <tr><td class="lbl">Drehbeginn</td><td class="c b">${esc(fmtCallTime(s.shooting_call))}</td></tr>
        ${s.lunch_call ? `<tr><td class="lbl">Mittag</td><td class="c b">${esc(fmtCallTime(s.lunch_call))}</td></tr>` : ''}
      </table>
    </td>
  </tr>
</table>

<table>
  <tr>
    <td style="width:22%"><b>Regie</b><br>${esc(project?.director || '')}</td>
    <td style="width:26%"><b>Nächstes Krankenhaus</b><br>${esc(s.hospital_name || '')}<br>${esc(s.hospital_address || '')}</td>
    <td style="width:26%"><b>Crew-Parken</b><br>${esc(s.crew_parking || '')}</td>
    <td><b>Wetter</b><br>${esc(s.weather_forecast || '')}
      ${(s.weather_high || s.weather_low) ? `<br>Max ${esc(s.weather_high || '—')} · Min ${esc(s.weather_low || '—')}` : ''}
      ${(s.sunrise || s.sunset) ? `<br>SA ${esc(s.sunrise || '—')} · SU ${esc(s.sunset || '—')}` : ''}
    </td>
  </tr>
</table>

<div class="safety">SICHERHEIT ZUERST · KEINE ÜBERSTUNDEN OHNE FREIGABE DER PRODUKTION · KEINE BESUCHER OHNE ANMELDUNG</div>

<!-- ── Szenen ── -->
<table>
  <thead><tr>
    <th style="width:6%">Szene</th><th style="width:6%">Seiten</th><th>Set &amp; Beschreibung</th>
    <th style="width:5%">T/N</th><th style="width:9%">Cast</th><th style="width:16%">Notizen</th><th style="width:16%">Motiv</th>
  </tr></thead>
  <tbody>
    ${sceneRows || '<tr><td colspan="7" class="c">Für diesen Tag sind noch keine Szenen eingeplant.</td></tr>'}
    <tr class="sum"><td colspan="2" class="r">Seiten gesamt</td><td colspan="5">${esc(sumEighths(scenes.map(x => x.eighths)))}</td></tr>
  </tbody>
</table>

<!-- ── Cast ── -->
<table style="margin-top:4pt">
  <thead><tr>
    <th style="width:4%">ID</th><th style="width:16%">Rolle</th><th style="width:16%">Darsteller</th>
    <th style="width:6%">Status</th><th style="width:9%">Abholung</th><th style="width:8%">Call</th>
    <th style="width:8%">Probe</th><th style="width:8%">Set</th><th style="width:8%">Ende</th><th>Hinweise</th>
  </tr></thead>
  <tbody>${castRows || '<tr><td colspan="10" class="c">Keine Darsteller disponiert.</td></tr>'}</tbody>
</table>

${bgRows ? `<table style="margin-top:4pt">
  <thead><tr><th style="width:6%">Anz.</th><th>Komparserie / Stand-Ins</th><th style="width:10%">Call</th></tr></thead>
  <tbody>${bgRows}</tbody>
</table>` : ''}

<!-- ── Departmentnotizen ── -->
<table style="margin-top:4pt">
  <tr><td colspan="2" class="section">Anweisungen der Departments</td></tr>
  ${deptRows}
</table>

<!-- ── Vorschau ── -->
${advanceBlocks ? `<table style="margin-top:4pt">
  <tr><td colspan="7" class="section">Vorschau</td></tr>
  ${advanceBlocks}
</table>` : ''}

<table class="sign">
  <tr>
    <td><div class="line">1. Aufnahmeleitung</div></td>
    <td><div class="line">Produktionsleitung</div></td>
    <td><div class="line">Herstellungsleitung</div></td>
  </tr>
</table>

<!-- ── Seite 2: Crew ── -->
<div class="page2">
  <table class="top">
    <tr>
      <td class="prod"><b>${esc(project?.title)}</b></td>
      <td class="c b">${esc(fmtSheetDate(day?.date))}</td>
      <td class="datebox"><div class="n">Drehtag ${esc(day?.day_number)} von ${esc(totalDays)}</div></td>
    </tr>
  </table>

  <table style="margin-top:4pt"><tr class="nb">${crewColumns}</tr></table>

  ${s.walkie_channels ? `<div class="walkie"><b>Funkkanäle:</b> ${esc(s.walkie_channels)}</div>` : ''}
</div>

</body>
</html>`
}

/**
 * Departmentnotizen aus einem Textfeld lesen.
 * Format je Zeile: "PROPS: Sc 12 Whiskyflasche". Alles ohne Doppelpunkt landet
 * unter der zuletzt genannten Ueberschrift, damit mehrzeilige Notizen gehen.
 */
export function parseDeptNotes(raw: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  let current = ''
  for (const line of String(raw ?? '').split('\n')) {
    const m = /^\s*([A-Za-zÄÖÜäöü/ .-]{2,20}?)\s*:\s*(.*)$/.exec(line)
    if (m) {
      current = m[1].trim().toUpperCase()
      out[current] = (out[current] ? out[current] + ' ' : '') + m[2].trim()
    } else if (current && line.trim()) {
      out[current] += ' ' + line.trim()
    }
  }
  return out
}
