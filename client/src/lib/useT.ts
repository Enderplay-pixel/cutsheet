import { useProjectStore } from '@/store/useProjectStore'
import { t, type Lang } from '@/lib/i18n'

/** Returns a translation helper bound to the current language. */
export function useT() {
  const lang = useProjectStore(s => s.language) as Lang
  return (map: Record<Lang, string>) => t(map, lang)
}

/** Gebietsschema der gewählten Sprache - für Datum, Uhrzeit, Zahlen und Beträge. */
const GEBIETSSCHEMA: Record<Lang, string> = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR' }

/**
 * Gebietsschema für toLocaleDateString, toLocaleString und Intl.
 *
 * Statt fest 'de-DE': Eine englische Oberfläche mit "19.10.2026" und
 * "1.234,56 €" sieht halb übersetzt aus. Beträge bleiben in Euro.
 */
export function useGebietsschema(): string {
  const lang = useProjectStore(s => s.language) as Lang
  return GEBIETSSCHEMA[lang] ?? 'de-DE'
}

/** Dasselbe außerhalb von Hooks (lib/utils.ts) - liest die Sprache beim Aufruf. */
export function aktuellesGebietsschema(): string {
  return GEBIETSSCHEMA[useProjectStore.getState().language as Lang] ?? 'de-DE'
}
