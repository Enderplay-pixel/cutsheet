import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorClipsT = {
  titel:          { de: 'Auskopplungen', en: 'Clips', fr: 'Extraits' },
  untertitel:     { de: 'Shorts, Reels und Clips aus den Langvideos - über den ganzen Kanal', en: 'Shorts, reels and clips from the long-form videos - across the whole channel', fr: 'Shorts, reels et extraits des vidéos longues - sur toute la chaîne' },
  auskopplungen:  { de: 'Auskopplungen', en: 'Clips', fr: 'Extraits' },
  mitBeanstandung:{ de: 'Mit Beanstandung', en: 'With issues', fr: 'Avec problèmes' },
  laengeGesamt:   { de: 'Länge gesamt', en: 'Total length', fr: 'Durée totale' },
  leerTitel:      { de: 'Noch keine Auskopplungen', en: 'No clips yet', fr: "Pas encore d'extraits" },
  leerText:       { de: 'Clips werden beim jeweiligen Langvideo markiert. Hier stehen sie zusammen - mit Prüfung auf Länge und sinnvolle Grenzen.', en: 'Clips are marked on the respective long-form video. Here they are gathered together - checked for length and sensible boundaries.', fr: 'Les extraits sont marqués dans la vidéo longue correspondante. Ils sont regroupés ici - avec une vérification de la durée et de limites cohérentes.' },
  spalteClip:     { de: 'Clip', en: 'Clip', fr: 'Extrait' },
  spalteAusVideo: { de: 'aus Video', en: 'from video', fr: 'de la vidéo' },
  spaltePlattform:{ de: 'Plattform', en: 'Platform', fr: 'Plateforme' },
  spalteStart:    { de: 'Start', en: 'Start', fr: 'Début' },
  spalteDauer:    { de: 'Dauer', en: 'Duration', fr: 'Durée' },
  spalteStatus:   { de: 'Status', en: 'Status', fr: 'Statut' },
  spalteBeanst:   { de: 'Beanstandung', en: 'Issue', fr: 'Problème' },
} satisfies Record<string, Text>
