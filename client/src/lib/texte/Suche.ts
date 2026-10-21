import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const sucheT = {
  szenen:       { de: 'Szenen', en: 'Scenes', fr: 'Scènes' },
  drehbuch:     { de: 'Drehbuch', en: 'Script', fr: 'Scénario' },
  darsteller:   { de: 'Darsteller', en: 'Actors', fr: 'Comédiens' },
  crew:         { de: 'Crew', en: 'Crew', fr: 'Équipe' },
  motive:       { de: 'Motive', en: 'Locations', fr: 'Décors' },
  titel:        { de: 'Suche', en: 'Search', fr: 'Recherche' },
  platzhalter:  { de: 'Szenen, Darsteller, Crew, Motive…', en: 'Scenes, actors, crew, locations…', fr: 'Scènes, comédiens, équipe, décors…' },
  volltext:     { de: 'Volltext-Suche', en: 'Full-text search', fr: 'Recherche plein texte' },
  eingeben:     { de: 'Suchbegriff eingeben…', en: 'Enter a search term…', fr: 'Saisir un terme de recherche…' },
  keineTreffer: { de: 'Keine Ergebnisse für ‘{q}’', en: 'No results for ‘{q}’', fr: 'Aucun résultat pour « {q} »' },
} satisfies Record<string, Text>
