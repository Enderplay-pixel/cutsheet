import { describe, it, expect } from 'vitest'
import {
  fmtCallTime, fmtEighths, sumEighths, dayNightCode, fmtSheetDate,
  groupByDepartment, balanceColumns, parseDeptNotes, renderCallSheetHtml,
  DEPARTMENT_ORDER, szenenArt,
} from '../lib/callSheetLayout'

describe('fmtCallTime', () => {
  it('schreibt die Zeit im 24-Stunden-Format wie auf einer deutschen Dispo', () => {
    expect(fmtCallTime(7 * 60)).toBe('07:00')
    expect(fmtCallTime(6 * 60 + 30)).toBe('06:30')
    expect(fmtCallTime(13 * 60)).toBe('13:00')
    expect(fmtCallTime(23 * 60 + 45)).toBe('23:45')
  })

  it('behandelt Mitternacht, Mittag und Zeiten nach Mitternacht richtig', () => {
    expect(fmtCallTime(0)).toBe('00:00')
    expect(fmtCallTime(12 * 60)).toBe('12:00')
    // Drehschluss 01:30 am Folgetag, als 25:30 gezählt
    expect(fmtCallTime(25 * 60 + 30)).toBe('01:30')
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
  it('kennzeichnet Tag, Nacht, Dämmerung und Morgen - ohne erfundene Erzähltagnummer', () => {
    expect(dayNightCode('TAG')).toBe('T')
    expect(dayNightCode('NACHT')).toBe('N')
    expect(dayNightCode('DÄMMERUNG')).toBe('D')
    expect(dayNightCode('MORGEN')).toBe('M')
  })

  it('erkennt englische Angaben', () => {
    expect(dayNightCode('NIGHT')).toBe('N')
    expect(dayNightCode('DUSK')).toBe('D')
  })

  it('fällt ohne Angabe auf Tag zurück', () => {
    expect(dayNightCode('')).toBe('T')
    expect(dayNightCode(null)).toBe('T')
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
      { scene_number: '2', eighths: 19, title: 'Wohnküche', int_ext: 'INT', day_night: 'TAG', description: 'Andi sitzt', location_name: 'Studio', location_address: 'Ruhrallee 3', location_zip: '44139', location_city: 'Dortmund', cast_ids: '1, 4' },
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
    firma: { name: 'RuhrCut', address: 'Kortumstr. 1', zip: '44787', city: 'Bochum', phone: '0234 123', email: 'post@ruhrcut.test' },
    drehschluss: 19 * 60,
    aufnahmeleitung: { name: 'Mira Set', rolle: 'Set-Aufnahmeleitung', telefon: '0170 555' },
  }

  const html = renderCallSheetHtml(data as any)

  it('enthält die Pflichtangaben einer Dispo', () => {
    // Drehort mit realer Adresse, Zeitplan bis Drehschluss, Anschrift und
    // Kontakt der Produktion, Produktionsvertretung am Set
    expect(html).toContain('Ruhrallee 3, 44139 Dortmund')
    expect(html).toContain('Drehschluss (geplant)')
    expect(html).toContain('19:00')
    expect(html).toContain('Kortumstr. 1, 44787 Bochum')
    expect(html).toContain('0234 123 · post@ruhrcut.test')
    expect(html).toContain('Mira Set, 0170 555')
  })

  it('nennt die Rollennummern der Szene in der Spalte Cast', () => {
    expect(html).toContain('>1, 4<')
  })

  it('nennt Projekt, Drehtag und Gesamtzahl', () => {
    expect(html).toContain('Sprachlos')
    expect(html).toContain('Drehtag 1 von 24')
  })

  it('zeigt den Crew-Call groß im Kopf', () => {
    expect(html).toContain('>07:00<')
  })

  it('enthaelt die Sicherheitsangaben', () => {
    expect(html).toContain('Klinikum Mitte')
    expect(html).toContain('SICHERHEIT ZUERST')
  })

  it('listet die Szenen mit Seitenzahl und Tag/Nacht', () => {
    expect(html).toContain('WOHNKÜCHE')
    expect(html).toContain('2 3/8')
    expect(html).toContain('>N<')
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

  it('färbt die Szenen wie das Stripboard der App', () => {
    // INT/TAG weiß, EXT/NACHT grün - vorher nur INT blau und EXT grün
    expect(html).toContain('class="set int-tag"')
    expect(html).toContain('class="set ext-nacht"')
    expect(szenenArt('INT', 'MORGEN')).toBe('int-tag')
    expect(szenenArt('INT', 'DÄMMERUNG')).toBe('int-nacht')
    expect(szenenArt('INT/EXT', 'TAG')).toBe('ext-tag')
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
