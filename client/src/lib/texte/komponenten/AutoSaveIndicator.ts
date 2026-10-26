import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const autoSaveT = {
  speichern:   { de: 'Speichern…', en: 'Saving…', fr: 'Enregistrement…' },
  gespeichert: { de: 'Gespeichert', en: 'Saved', fr: 'Enregistré' },
} satisfies Record<string, Text>
