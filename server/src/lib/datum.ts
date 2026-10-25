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
