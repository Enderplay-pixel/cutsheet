import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const errorBoundaryT = {
  titel:          { de: 'Etwas ist schiefgelaufen', en: 'Something went wrong', fr: "Une erreur s'est produite" },
  erneut:         { de: 'Erneut versuchen',         en: 'Try again',            fr: 'Réessayer' },
} satisfies Record<string, Text>
