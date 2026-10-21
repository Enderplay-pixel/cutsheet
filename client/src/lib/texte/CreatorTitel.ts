import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorTitelT = {
  titel:          { de: 'Titel & Thumbnails', en: 'Titles & thumbnails', fr: 'Titres et miniatures' },
  untertitel:     { de: 'Alle Varianten nebeneinander - Titel und Thumbnail entscheiden über die Klickrate', en: 'All variants side by side - title and thumbnail decide the click-through rate', fr: 'Toutes les variantes côte à côte - le titre et la miniature décident du taux de clics' },
  videos:         { de: 'Videos', en: 'Videos', fr: 'Vidéos' },
  titelvarianten: { de: 'Titelvarianten', en: 'Title variants', fr: 'Variantes de titre' },
  ohneVergleich:  { de: 'Ohne Vergleich', en: 'No comparison', fr: 'Sans comparaison' },
  ohneVergleichHinweis: { de: 'weniger als zwei Varianten', en: 'fewer than two variants', fr: 'moins de deux variantes' },
  leerTitel:      { de: 'Noch keine Videos', en: 'No videos yet', fr: 'Pas encore de vidéos' },
  leerText:       { de: 'Titelvarianten und Thumbnail-Ideen werden beim Video gepflegt. Hier stehen sie über den ganzen Kanal nebeneinander.', en: 'Title variants and thumbnail ideas are maintained on each video. Here they sit side by side across the whole channel.', fr: "Les variantes de titre et les idées de miniatures sont gérées dans chaque vidéo. Ici, elles sont côte à côte pour toute la chaîne." },
  keinVergleich:  { de: 'kein Vergleich möglich', en: 'no comparison possible', fr: 'aucune comparaison possible' },
  anzahl:         { de: '{t} Titel · {n} Thumbnails', en: '{t} titles · {n} thumbnails', fr: '{t} titres · {n} miniatures' },
  thumbnailIdeen: { de: 'Thumbnail-Ideen', en: 'Thumbnail ideas', fr: 'Idées de miniatures' },
  nochKeine:      { de: 'noch keine', en: 'none yet', fr: 'aucune pour le moment' },
} satisfies Record<string, Text>
