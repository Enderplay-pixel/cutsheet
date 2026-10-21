import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const retentionChartT = {
  bei:      { de: 'Bei {t} schauen noch {p} %', en: 'At {t}, {p} % are still watching', fr: 'À {t}, encore {p} % regardent' },
  hinweis:  { de: 'Mit der Maus über die Kurve fahren für Werte', en: 'Hover over the curve to see values', fr: 'Survole la courbe pour voir les valeurs' },
  sponsor:  { de: 'Sponsor', en: 'Sponsor', fr: 'Sponsor' },
  hook:     { de: 'Hook', en: 'Hook', fr: 'Accroche' },
} satisfies Record<string, Text>
