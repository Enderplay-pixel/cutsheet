/**
 * Heutiges Datum als YYYY-MM-DD in deutscher Zeit.
 *
 * `new Date().toISOString().slice(0, 10)` liefert das Datum in UTC. Der
 * Server läuft auf Render in UTC, das Publikum sitzt in Deutschland: zwischen
 * Mitternacht und 02:00 deutscher Zeit ist in UTC noch der Vortag. Ein Video,
 * dessen Veröffentlichungstag gerade abgelaufen ist, gälte dann noch eine
 * Nacht lang als pünktlich.
 *
 * Intl mit 'sv-SE' ist der kurze Weg zu YYYY-MM-DD: das schwedische Format
 * ist das ISO-Format.
 */
export function heuteISO(zeitpunkt: Date = new Date(), zone = 'Europe/Berlin'): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(zeitpunkt)
}

/**
 * Ob ein Wert ein echtes Kalenderdatum im Format JJJJ-MM-TT ist.
 *
 * Für Textspalten, die ein Datum tragen (Sperrtage, Drehtage): Postgres prüft
 * dort nichts. "2026-02-30" ist keins - `new Date` machte daraus still den
 * 2. März.
 */
export function istIsoDatum(wert: unknown): boolean {
  const text = String(wert ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const zeit = Date.parse(`${text}T00:00:00Z`)
  return !Number.isNaN(zeit) && new Date(zeit).toISOString().slice(0, 10) === text
}

/**
 * Ein Zeitpunkt aus Datum und Uhrzeit in deutscher Zeit.
 *
 * `minuten` zählt ab Mitternacht des Tages, auch über 24 Uhr hinaus (ein
 * Drehschluss um 01:30 ist 1530). Unabhängig von der Zeitzone des Servers:
 * Gemessen am 25.10.2026 stand eine Call-Zeit 07:00 im Kalenderexport des
 * Hosters (UTC) als 07:00 UTC, also 08:00 Uhr deutscher Zeit.
 */
export function berlinZeitpunkt(datum: string, minuten: number, zone = 'Europe/Berlin'): Date {
  const [jahr, monat, tag] = String(datum).slice(0, 10).split('-').map(Number)
  const alsUtc = Date.UTC(jahr, monat - 1, tag, 0, minuten)
  const versatz = (zeit: number) => {
    const teile = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(zeit))
    const w = Object.fromEntries(teile.map((t) => [t.type, Number(t.value)]))
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - zeit
  }
  // Zweimal: An den Umstellungstagen hängt der Versatz vom Ergebnis selbst ab.
  const erster = alsUtc - versatz(alsUtc)
  return new Date(alsUtc - versatz(erster))
}
