import { describe, it, expect } from 'vitest'
import {
  fmtCallTime, fmtEighths, sumEighths, dayNightCode, fmtSheetDate,
  groupByDepartment, balanceColumns, parseDeptNotes, renderCallSheetHtml,
  DEPARTMENT_ORDER,
} from '../lib/callSheetLayout'

describe('fmtCallTime', () => {
  it('formatiert Vormittagszeiten', () => {
    expect(fmtCallTime(7 * 60)).toBe('7:00 AM')
    expect(fmtCallTime(6 * 60 + 30)).toBe('6:30 AM')
  })

  it('formatiert Nachmittagszeiten', () => {
    expect(fmtCallTime(13 * 60)).toBe('1:00 PM')
    expect(fmtCallTime(23 * 60 + 45)).toBe('11:45 PM')
  })

  it('behandelt Mitternacht und Mittag richtig', () => {
    // 12 statt 0 - "0:00 AM" gibt es auf keinem Call Sheet
    expect(fmtCallTime(0)).toBe('12:00 AM')
    expect(fmtCallTime(12 * 60)).toBe('12:00 PM')
  })

  it('liefert bei fehlender Zeit nichts statt eines Platzhalters', () => {
    for (const v of [null, undefined, NaN as any, 'quatsch' as any]) {
      expect(fmtCallTime(v)).toBe('')
    }
  })
})

describe('fmtEighths', () => {
  it('schreibt weniger als eine Seite als Bruch', () => {
    expect(fmtEighths(3)).toBe('3/8')
  })

  it('schreibt volle Seiten ohne Bruch', () => {
    expect(fmtEighths(16)).toBe('2')
  })

  it('kombiniert Seiten und Achtel', () => {
    expect(fmtEighths(19)).toBe('2 3/8')
  })

  it('liefert bei null nichts', () => {
    expect(fmtEighths(0)).toBe('')
    expect(fmtEighths(null)).toBe('')
  })
})

describe('sumEighths', () => {
  it('summiert und formatiert', () => {
    // 19 + 2 + 5 + 12 + 11 = 49 Achtel = 6 volle Seiten und 1/8
    expect(sumEighths([19, 2, 5, 12, 11])).toBe('6 1/8')
  })

  it('ignoriert fehlende Werte', () => {
    expect(sumEighths([8, null, undefined, 4])).toBe('1 4/8')
  })

  it('kommt mit leerer Liste klar', () => {
    expect(sumEighths([])).toBe('')
  })
})

describe('dayNightCode', () => {
  it('kennzeichnet Tag und Nacht', () => {
    expect(dayNightCode('INT', 'TAG', 1)).toBe('D1')
    expect(dayNightCode('EXT', 'NACHT', 3)).toBe('N3')
  })

  it('erkennt englische Angaben', () => {
    expect(dayNightCode('INT', 'NIGHT', 2)).toBe('N2')
  })

  it('kennzeichnet Daemmerung eigenstaendig', () => {
    expect(dayNightCode('EXT', 'DÄMMERUNG', 1)).toBe('X1')
  })

  it('faellt ohne Angabe auf Tag zurueck', () => {
    expect(dayNightCode('INT', '', 4)).toBe('D4')
    expect(dayNightCode(null, null, 1)).toBe('D1')
  })
})

describe('fmtSheetDate', () => {
  it('schreibt Wochentag und Datum aus', () => {
    const s = fmtSheetDate('2026-07-03')
    expect(s).toContain('Juli')
    expect(s).toContain('2026')
  })

  it('gibt unbrauchbare Eingaben unveraendert zurueck', () => {
    expect(fmtSheetDate('kein Datum')).toBe('kein Datum')
    expect(fmtSheetDate(null)).toBe('')
  })
})

describe('groupByDepartment', () => {
  const crew = [
    { name: 'A', department: 'Kamera' },
    { name: 'B', department: 'Produktion' },
    { name: 'C', department: 'Kamera' },
    { name: 'D', department: 'Zauberei' },
    { name: 'E' },
  ]

  it('fasst gleiche Departments zusammen', () => {
    const g = groupByDepartment(crew)
    expect(g.find(x => x.department === 'Kamera')?.members).toHaveLength(2)
  })

  it('haelt die uebliche Reihenfolge ein', () => {
    const g = groupByDepartment(crew).map(x => x.department)
    expect(g.indexOf('Produktion')).toBeLessThan(g.indexOf('Kamera'))
  })

  it('haengt unbekannte Departments hinten an, statt sie zu verlieren', () => {
    const g = groupByDepartment(crew).map(x => x.department)
    expect(g).toContain('Zauberei')
    expect(g.indexOf('Zauberei')).toBeGreaterThan(g.indexOf('Kamera'))
  })

  it('sammelt Leute ohne Department unter Sonstige', () => {
    expect(groupByDepartment(crew).find(x => x.department === 'Sonstige')?.members).toHaveLength(1)
  })

  it('kommt mit leerer Crew klar', () => {
    expect(groupByDepartment([])).toEqual([])
  })
})

describe('balanceColumns', () => {
  it('verteilt auf drei Spalten', () => {
    const groups = DEPARTMENT_ORDER.slice(0, 6).map(d => ({ department: d, members: [{ name: 'x' }] }))
    const cols = balanceColumns(groups)
    expect(cols).toHaveLength(3)
    expect(cols.flat()).toHaveLength(6)
  })

  it('gleicht nach Zeilenzahl aus, nicht nach Anzahl der Departments', () => {
    const groups = [
      { department: 'Gross', members: Array.from({ length: 20 }, () => ({ name: 'x' })) },
      { department: 'Klein1', members: [{ name: 'x' }] },
      { department: 'Klein2', members: [{ name: 'x' }] },
      { department: 'Klein3', members: [{ name: 'x' }] },
    ]
    const cols = balanceColumns(groups)
    // Das grosse Department darf nicht mit den kleinen in derselben Spalte landen
    const grosseSpalte = cols.find(c => c.some(g => g.department === 'Gross'))!
    expect(grosseSpalte).toHaveLength(1)
  })

  it('zerreisst kein Department', () => {
    const groups = [{ department: 'Kamera', members: Array.from({ length: 9 }, () => ({ name: 'x' })) }]
    const cols = balanceColumns(groups)
    expect(cols.flat().filter(g => g.department === 'Kamera')).toHaveLength(1)
  })

  it('kommt mit leerer Liste klar', () => {
    expect(balanceColumns([]).every(c => c.length === 0)).toBe(true)
  })
})

describe('parseDeptNotes', () => {
  it('liest Zeilen mit Doppelpunkt', () => {
    expect(parseDeptNotes('PROPS: Whiskyflasche\nKAMERA: 35mm')).toMatchObject({
      PROPS: 'Whiskyflasche', KAMERA: '35mm',
    })
  })

  it('haengt Folgezeilen an die letzte Ueberschrift', () => {
    expect(parseDeptNotes('PROPS: Flasche\nund Glas').PROPS).toBe('Flasche und Glas')
  })

  it('vereinheitlicht die Schreibweise der Ueberschrift', () => {
    expect(parseDeptNotes('props: Flasche').PROPS).toBe('Flasche')
  })

  it('kommt mit leerer Eingabe klar', () => {
    expect(parseDeptNotes('')).toEqual({})
    expect(parseDeptNotes(null)).toEqual({})
  })
})

describe('renderCallSheetHtml', () => {
  const data = {
    project: { title: 'Sprachlos', director: 'Sarah Müller', producer: 'Lars Weber', production_company: 'RuhrCut' },
    day: { day_number: 1, date: '2026-07-03' },
    sheet: {
      general_call: 7 * 60, shooting_call: 9 * 60, lunch_call: 13 * 60,
      hospital_name: 'Klinikum Mitte', hospital_address: 'Hauptstr. 1',
      crew_parking: 'Parkhaus Nord', weather_forecast: 'Heiter',
      weather_high: '25°', weather_low: '14°', sunrise: '5:23', sunset: '21:41',
      dept_notes: 'PROPS: Whiskyflasche\nKAMERA: 35mm',
      walkie_channels: '1 Produktion · 2 Kamera',
    },
    scenes: [
      { scene_number: '2', eighths: 19, title: 'Wohnküche', int_ext: 'INT', day_night: 'TAG', description: 'Andi sitzt', location_name: 'Studio', cast_ids: '1, 4' },
      { scene_number: '8', eighths: 2, title: 'Straße', int_ext: 'EXT', day_night: 'NACHT', location_name: 'Hauptstr.' },
    ],
    cast: [
      { cast_no: 1, role: 'ANDI', name: 'Devin Fairbank', cast_status: 'W', call_time: 9 * 60, on_set: 10 * 60 },
    ],
    background: [{ qty: 5, name: 'Passanten', call_time: 13 * 60 }],
    crew: [
      { name: 'Rosita Freitag', role: 'Kamera', department: 'Kamera', call_time: 7 * 60 },
      { name: 'Lori Kornreich', role: 'Tonmeister', department: 'Ton', call_time: 7 * 60 + 30 },
    ],
    advance: [{ day: { day_number: 2, date: '2026-07-04' }, scenes: [{ scene_number: '20A', eighths: 2, title: 'Turnhalle', int_ext: 'INT' }] }],
    totalDays: 24,
  }

  const html = renderCallSheetHtml(data as any)

  it('nennt Projekt, Drehtag und Gesamtzahl', () => {
    expect(html).toContain('Sprachlos')
    expect(html).toContain('Drehtag 1 von 24')
  })

  it('zeigt den Crew-Call gross im Kopf', () => {
    expect(html).toContain('7:00 AM')
  })

  it('enthaelt die Sicherheitsangaben', () => {
    expect(html).toContain('Klinikum Mitte')
    expect(html).toContain('SICHERHEIT ZUERST')
  })

  it('listet die Szenen mit Seitenzahl und Tag/Nacht', () => {
    expect(html).toContain('WOHNKÜCHE')
    expect(html).toContain('2 3/8')
    expect(html).toContain('N2')
  })

  it('summiert die Seiten des Tages', () => {
    // 19 + 2 Achtel = 21/8 = 2 5/8
    expect(html).toContain('2 5/8')
  })

  it('enthaelt Cast mit Status und Zeiten', () => {
    expect(html).toContain('Devin Fairbank')
    expect(html).toContain('>W<')
  })

  it('enthaelt Komparserie', () => {
    expect(html).toContain('Passanten')
  })

  it('uebernimmt die Departmentnotizen', () => {
    expect(html).toContain('Whiskyflasche')
  })

  it('enthaelt die Vorschau auf den naechsten Drehtag', () => {
    expect(html).toContain('Drehtag 2')
    expect(html).toContain('TURNHALLE')
  })

  it('setzt die Crew auf eine zweite Seite', () => {
    expect(html).toContain('page2')
    expect(html).toContain('Rosita Freitag')
    expect(html).toContain('KAMERA')
  })

  it('enthaelt die Funkkanaele', () => {
    expect(html).toContain('Funkkanäle')
  })

  it('maskiert HTML aus Nutzereingaben', () => {
    const evil = renderCallSheetHtml({ ...data, project: { ...data.project, title: '<script>x</script>' } } as any)
    expect(evil).not.toContain('<script>x</script>')
    expect(evil).toContain('&lt;script&gt;')
  })

  it('kommt mit einem leeren Drehtag klar', () => {
    const leer = renderCallSheetHtml({
      project: { title: 'X' }, day: { day_number: 1, date: '2026-07-03' }, sheet: null,
      scenes: [], cast: [], background: [], crew: [], advance: [], totalDays: 1,
    } as any)
    expect(leer).toContain('noch keine Szenen')
    expect(leer).toContain('Keine Darsteller')
  })
})
