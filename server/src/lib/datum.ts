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
