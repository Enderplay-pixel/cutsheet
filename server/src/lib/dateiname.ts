/**
 * Dateinamen aus Titeln: "Nordlicht (Großproduktion)" → "nordlicht-grossproduktion".
 *
 * Vorher gab es sechs eigene Varianten. Sie warfen Umlaute und ß weg -
 * aus "Großproduktion" wurde "groproduktion", aus "Müller" "mller" - und
 * mehrere ließen doppelte oder angehängte Bindestriche stehen.
 */
const ERSATZ: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss', ẞ: 'SS' }

export function dateiname(titel: unknown, ersatz = 'dokument'): string {
  const out = String(titel ?? '')
    .replace(/[äöüÄÖÜßẞ]/g, z => ERSATZ[z])
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return out || ersatz
}
