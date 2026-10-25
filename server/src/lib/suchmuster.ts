/**
 * Ein Suchtext als LIKE-/ILIKE-Muster "enthält".
 *
 * Die Platzhalter `%` und `_` und das Fluchtzeichen `\` werden wörtlich
 * genommen. Gemessen am 25.10.2026: Eine Suche nach "_" oder "%" fand sonst
 * alles - in der Projektsuche, im Änderungsprotokoll und im Adressbuch.
 */
export function enthaeltMuster(text: unknown): string {
  return `%${String(text ?? '').replace(/[\\%_]/g, (z) => '\\' + z)}%`
}
