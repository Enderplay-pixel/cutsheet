// Easter calculation using the Gauss algorithm
function easterDate(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function add(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000)
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface HolidayDef {
  date: string
  name: string
  states: string[]
}

// Returns array of { date: string (YYYY-MM-DD), name: string }
export function getHolidays(year: number, state: string = 'NRW'): Array<{ date: string; name: string }> {
  const easter = easterDate(year)

  const holidays: HolidayDef[] = [
    { date: `${year}-01-01`, name: 'Neujahr', states: ['ALL'] },
    { date: fmt(add(easter, -2)), name: 'Karfreitag', states: ['ALL'] },
    { date: fmt(easter), name: 'Ostersonntag', states: ['BB', 'HE', 'NW'] },
    { date: fmt(add(easter, 1)), name: 'Ostermontag', states: ['ALL'] },
    { date: `${year}-05-01`, name: 'Tag der Arbeit', states: ['ALL'] },
    { date: fmt(add(easter, 39)), name: 'Christi Himmelfahrt', states: ['ALL'] },
    { date: fmt(add(easter, 49)), name: 'Pfingstsonntag', states: ['BB', 'HE', 'NW'] },
    { date: fmt(add(easter, 50)), name: 'Pfingstmontag', states: ['ALL'] },
    { date: fmt(add(easter, 60)), name: 'Fronleichnam', states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'] },
    { date: `${year}-10-03`, name: 'Tag der Deutschen Einheit', states: ['ALL'] },
    { date: `${year}-10-31`, name: 'Reformationstag', states: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'] },
    { date: `${year}-11-01`, name: 'Allerheiligen', states: ['BW', 'BY', 'NW', 'RP', 'SL'] },
    { date: `${year}-12-25`, name: '1. Weihnachtstag', states: ['ALL'] },
    { date: `${year}-12-26`, name: '2. Weihnachtstag', states: ['ALL'] },
  ]

  return holidays
    .filter(h => h.states.includes('ALL') || h.states.includes(state))
    .map(({ date, name }) => ({ date, name }))
}
