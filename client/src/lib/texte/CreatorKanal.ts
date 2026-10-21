import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorKanalT = {
  titel:          { de: 'Kanal', en: 'Channel', fr: 'Chaîne' },
  untertitel:     {
    de: '{n} Videos · {p} veröffentlicht · {g} geplant',
    en: '{n} videos · {p} published · {g} planned',
    fr: '{n} vidéos · {p} publiées · {g} prévues',
  },
  aufrufe:        { de: 'Aufrufe gesamt', en: 'Total views', fr: 'Vues totales' },
  likes:          { de: 'Likes gesamt', en: 'Total likes', fr: "Total des j'aime" },
  abos:           { de: 'Abos gewonnen', en: 'Subscribers gained', fr: 'Abonnés gagnés' },
  sponsoring:     { de: 'Sponsoring', en: 'Sponsorship', fr: 'Sponsoring' },
  rhythmus:       { de: 'Veröffentlichungsrhythmus', en: 'Publishing rhythm', fr: 'Rythme de publication' },
  muster:         { de: 'Muster über den Kanal', en: 'Patterns across the channel', fr: 'Tendances de la chaîne' },
  vorherigerMonat:{ de: 'Vorheriger Monat', en: 'Previous month', fr: 'Mois précédent' },
  heute:          { de: 'Heute', en: 'Today', fr: "Aujourd'hui" },
  naechsterMonat: { de: 'Nächster Monat', en: 'Next month', fr: 'Mois suivant' },
  veroeffentlicht:{ de: ' (veröffentlicht)', en: ' (published)', fr: ' (publiée)' },
  unbenannt:      { de: 'Unbenannt', en: 'Untitled', fr: 'Sans titre' },
  fusszeile:      {
    de: 'Termine kommen aus dem geplanten bzw. tatsächlichen Veröffentlichungsdatum der Videos. Beides lässt sich im jeweiligen Video unter „Zahlen“ setzen.',
    en: 'Dates come from the planned or actual publication date of the videos. Both can be set in each video under "Numbers".',
    fr: 'Les dates proviennent de la date de publication prévue ou réelle des vidéos. Les deux se règlent dans chaque vidéo sous « Chiffres ».',
  },
} satisfies Record<string, Text>

export const WOCHENTAGE: Text[] = [
  { de: 'Mo', en: 'Mon', fr: 'Lun' },
  { de: 'Di', en: 'Tue', fr: 'Mar' },
  { de: 'Mi', en: 'Wed', fr: 'Mer' },
  { de: 'Do', en: 'Thu', fr: 'Jeu' },
  { de: 'Fr', en: 'Fri', fr: 'Ven' },
  { de: 'Sa', en: 'Sat', fr: 'Sam' },
  { de: 'So', en: 'Sun', fr: 'Dim' },
]

/** Beschriftung der Video-Status; die Schlüssel kommen vom Server. */
export const STATUS_TEXT: Record<string, Text> = {
  'Idee':           { de: 'Idee', en: 'Idea', fr: 'Idée' },
  'Skript':         { de: 'Skript', en: 'Script', fr: 'Script' },
  'Dreh':           { de: 'Dreh', en: 'Shoot', fr: 'Tournage' },
  'Schnitt':        { de: 'Schnitt', en: 'Edit', fr: 'Montage' },
  'Thumbnail':      { de: 'Thumbnail', en: 'Thumbnail', fr: 'Miniature' },
  'Upload':         { de: 'Upload', en: 'Upload', fr: 'Mise en ligne' },
  'Veröffentlicht': { de: 'Veröffentlicht', en: 'Published', fr: 'Publiée' },
}
