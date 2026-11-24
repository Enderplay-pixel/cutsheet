import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte zu Cover-Sets und Tag-für-Nacht (Plan Kino-Ausbau, AP C5). */
export const coverT = {
  coverSet: { de: 'Cover-Set', en: 'Cover set', fr: 'Décor de repli' },
  coverSetHilfe: {
    de: 'Wetterunabhängige Ausweichszene: Die Dispo eines Tages mit Außenszenen nennt sie unter "Bei Schlechtwetter".',
    en: 'Weather-independent fallback scene: the call sheet of a day with exterior scenes lists it under "Bad weather".',
    fr: 'Scène de repli indépendante de la météo : la feuille de service d’un jour avec extérieurs la cite sous « Mauvais temps ».',
  },
  tagFuerNacht: { de: 'Tag für Nacht', en: 'Day for night', fr: 'Nuit américaine' },
  tagFuerNachtHilfe: {
    de: 'Die Nachtszene wird am Tag gedreht. Der Streifen behält die Nachtfarbe und trägt T/N; Prüfungen nach Tageszeit zählen den Tag.',
    en: 'The night scene is shot during the day. The strip keeps the night colour and shows T/N; time-of-day checks count it as day.',
    fr: 'La scène de nuit est tournée de jour. La bande garde la couleur de nuit et porte T/N ; les contrôles selon l’heure la comptent comme jour.',
  },
  tn: { de: 'T/N', en: 'D/N', fr: 'J/N' },
  schlechtwetter: { de: 'Bei Schlechtwetter', en: 'Bad weather', fr: 'Mauvais temps' },
  schlechtwetterHilfe: {
    de: 'Cover-Sets, die noch nicht gedreht sind - am selben Motiv oder ohne Außenanteil. Stehen auch im PDF.',
    en: 'Cover sets not yet shot - at the same location or without an exterior part. Also printed in the PDF.',
    fr: 'Décors de repli pas encore tournés - au même décor ou sans partie extérieure. Figurent aussi dans le PDF.',
  },
} satisfies Record<string, Text>
