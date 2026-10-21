import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const skipLinkT = {
  hauptinhalt:    { de: 'Zum Hauptinhalt springen', en: 'Skip to main content', fr: 'Aller au contenu principal' },
} satisfies Record<string, Text>
