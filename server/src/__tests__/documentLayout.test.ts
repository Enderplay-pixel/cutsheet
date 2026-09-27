import { describe, it, expect } from 'vitest'
import {
  fmtMoney, fmtTime, fmtDate, fmtDateLong, fmtEighths,
  fmtDuration, table, stats, section, definitions, badge, paragraph, hint, renderDocument,
} from '../lib/documentLayout'

describe('Formatierung', () => {
  it('schreibt Cent als Betrag', () => {
    expect(fmtMoney(123456)).toContain('1.234,56')
    expect(fmtMoney(0)).toContain('0,00')
  })

  it('markiert fehlende Betraege statt 0 zu behaupten', () => {
    // Number(null) ist 0 — auf einem Kalkulationsblatt waere "0,00 €" eine
    // Behauptung, wo in Wahrheit nichts erfasst ist
    expect(fmtMoney(null)).toBe('—')
    expect(fmtMoney(undefined)).toBe('—')
    expect(fmtMoney('' as any)).toBe('—')
  })

  it('unterscheidet eine echte 0 von einer fehlenden Angabe', () => {
    expect(fmtMoney(0)).toContain('0,00')
    expect(fmtTime(0)).toBe('00:00')
  })

  it('schreibt Minuten als Uhrzeit', () => {
    expect(fmtTime(480)).toBe('08:00')
    expect(fmtTime(1290)).toBe('21:30')
    expect(fmtTime(0)).toBe('00:00')
  })

  it('markiert fehlende Zeiten', () => {
    expect(fmtTime(null)).toBe('—')
    expect(fmtTime(undefined)).toBe('—')
  })

  it('schreibt Minuten als Dauer', () => {
    expect(fmtDuration(405)).toBe('6h 45min')
    expect(fmtDuration(120)).toBe('2h')
    expect(fmtDuration(45)).toBe('45min')
    expect(fmtDuration(0)).toBe('—')
    expect(fmtDuration(null)).toBe('—')
  })

  it('formatiert Datumsangaben', () => {
    expect(fmtDate('2026-08-03')).toBe('03.08.2026')
    expect(fmtDateLong('2026-08-03')).toContain('August')
  })

  it('gibt unbrauchbare Datumsangaben unveraendert zurueck', () => {
    expect(fmtDate('kein datum')).toBe('kein datum')
    expect(fmtDate(null)).toBe('—')
  })

  it('schreibt Achtel als Seitenangabe', () => {
    expect(fmtEighths(19)).toBe('2 3/8')
    expect(fmtEighths(8)).toBe('1')
    expect(fmtEighths(3)).toBe('3/8')
    expect(fmtEighths(0)).toBe('—')
  })
})

describe('table', () => {
  const rows = [{ name: 'Anna', fee: 12000 }, { name: 'Bert', fee: 8000 }]
  const columns = [
    { header: 'Name', value: (r: any) => r.name },
    { header: 'Gage', value: (r: any) => fmtMoney(r.fee), align: 'right' as const },
  ]

  it('setzt Kopf und Zeilen', () => {
    const html = table({ columns, rows })
    expect(html).toContain('<th')
    expect(html).toContain('Anna')
    expect(html).toContain('Bert')
  })

  it('richtet Zahlenspalten rechts aus', () => {
    expect(table({ columns, rows })).toContain('class="r"')
  })

  it('zeigt einen Hinweis statt einer leeren Tabelle', () => {
    const html = table({ columns, rows: [], empty: 'Noch keine Crew erfasst.' })
    expect(html).toContain('Noch keine Crew erfasst.')
    expect(html).toContain('colspan="2"')
  })

  it('ersetzt leere Zellen durch einen Strich', () => {
    const html = table({ columns: [{ header: 'X', value: () => '' }], rows: [{}] })
    expect(html).toContain('>—<')
  })

  it('setzt eine Summenzeile', () => {
    const html = table({ columns, rows, footer: [{ label: 'Gesamt', value: '200,00 €' }] })
    expect(html).toContain('<tfoot>')
    expect(html).toContain('200,00 €')
  })

  it('maskiert Inhalte', () => {
    const html = table({ columns: [{ header: 'X', value: () => '<script>x</script>' }], rows: [{}] })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('laesst selbst erzeugtes Markup durch, wenn ausdruecklich erlaubt', () => {
    const html = table({ columns: [{ header: 'X', value: () => badge('OK', 'ok'), html: true }], rows: [{}] })
    expect(html).toContain('class="badge ok"')
  })

  it('maskiert auch bei erlaubtem Markup den Text des Badges', () => {
    expect(badge('<b>x</b>')).toContain('&lt;b&gt;')
  })
})

describe('stats', () => {
  it('setzt Kennzahlen', () => {
    const html = stats([{ label: 'Drehtage', value: 24 }, { label: 'Seiten', value: '58 3/8' }])
    expect(html).toContain('Drehtage')
    expect(html).toContain('58 3/8')
  })

  it('liefert bei leerer Liste nichts', () => {
    expect(stats([])).toBe('')
  })
})

describe('definitions', () => {
  it('laesst leere Werte weg statt Striche zu zeigen', () => {
    const html = definitions([
      { label: 'Regie', value: 'Sarah Müller' },
      { label: 'Kamera', value: '' },
      { label: 'Ton', value: null },
    ])
    expect(html).toContain('Sarah Müller')
    expect(html).not.toContain('Kamera')
  })

  it('erhaelt Zeilenumbrueche aus Freitext', () => {
    expect(definitions([{ label: 'Notiz', value: 'Zeile 1\nZeile 2' }])).toContain('<br>')
  })

  it('liefert nichts, wenn alles leer ist', () => {
    expect(definitions([{ label: 'X', value: '' }])).toBe('')
  })
})

describe('paragraph', () => {
  it('erhaelt Absaetze', () => {
    expect(paragraph('Zeile 1\nZeile 2')).toContain('<br>')
  })

  it('maskiert Freitext', () => {
    expect(paragraph('<script>x</script>')).not.toContain('<script>x</script>')
  })

  it('liefert bei leerem Text nichts', () => {
    expect(paragraph('')).toBe('')
    expect(paragraph(null)).toBe('')
    expect(paragraph('   ')).toBe('')
  })

  it('kann gedaempft setzen', () => {
    expect(paragraph('x', true)).toContain('text muted')
  })

  it('maskiert auch Hinweise', () => {
    expect(hint('<b>x</b>')).toContain('&lt;b&gt;')
  })
})

describe('renderDocument', () => {
  const html = renderDocument({
    kind: 'Stabliste',
    title: 'Crew',
    project: 'Sprachlos',
    subtitle: '12 Personen',
    meta: [{ label: 'Stand', value: '03.08.2026' }, { label: 'Leer', value: '' }],
    body: section('Kamera', table({ columns: [{ header: 'Name', value: (r: any) => r.n }], rows: [{ n: 'Rosita' }] })),
  })

  it('nennt Art, Titel und Projekt', () => {
    expect(html).toContain('Stabliste')
    expect(html).toContain('Sprachlos')
    expect(html).toContain('12 Personen')
  })

  it('laesst leere Eckdaten weg', () => {
    expect(html).not.toContain('Leer:')
  })

  it('wiederholt den Tabellenkopf auf Folgeseiten', () => {
    expect(html).toContain('display: table-header-group')
  })

  it('bricht Zeilen nicht mitten durch', () => {
    expect(html).toContain('page-break-inside: avoid')
  })

  it('nennt das Projekt in der Fusszeile nur einmal', () => {
    // Bei Listen sind Titel und Projekt dasselbe
    const doppelt = renderDocument({ kind: 'Drehplan', title: 'Sprachlos', project: 'Sprachlos', body: '' })
    expect(doppelt).toContain('Sprachlos · Drehplan')
    expect(doppelt).not.toContain('Sprachlos · Sprachlos')
  })

  it('nennt Projekt, Titel und Art, wenn sie sich unterscheiden', () => {
    const drei = renderDocument({ kind: 'Tagesbericht', title: 'Drehtag 1', project: 'Sprachlos', body: '' })
    expect(drei).toContain('Sprachlos · Drehtag 1 · Tagesbericht')
  })

  it('gibt die Fusszeile als Meta-Angabe an den PDF-Druck weiter', () => {
    expect(html).toContain('<meta name="cutsheet-foot-left"')
    expect(html).toContain('<meta name="cutsheet-foot-right" content="Erstellt mit CutSheet')
  })

  it('kann quer', () => {
    expect(renderDocument({ kind: 'k', title: 't', landscape: true, body: '' }))
      .toContain('A4 landscape')
    expect(html).toContain('A4 portrait')
  })

  it('uebernimmt die Akzentfarbe des Projekts', () => {
    expect(renderDocument({ kind: 'k', title: 't', accent: '#ff0055', body: '' })).toContain('#ff0055')
  })

  it('maskiert Titel aus Nutzereingaben', () => {
    const evil = renderDocument({ kind: 'k', title: '<script>x</script>', body: '' })
    expect(evil).not.toContain('<script>x</script>')
    expect(evil).toContain('&lt;script&gt;')
  })
})
