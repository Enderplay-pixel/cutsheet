import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const sucheT = {
  szenen:       { de: 'Szenen', en: 'Scenes', fr: 'Scènes' },
  figuren:      { de: 'Figuren', en: 'Characters', fr: 'Personnages' },
  drehtage:     { de: 'Drehtage', en: 'Shoot days', fr: 'Jours de tournage' },
  drehbuch:     { de: 'Drehbuch', en: 'Script', fr: 'Scénario' },
  darsteller:   { de: 'Darsteller', en: 'Actors', fr: 'Comédiens' },
  crew:         { de: 'Crew', en: 'Crew', fr: 'Équipe' },
  motive:       { de: 'Motive', en: 'Locations', fr: 'Décors' },
  titel:        { de: 'Suche', en: 'Search', fr: 'Recherche' },
  platzhalter:  { de: 'Szenen, Figuren, Darsteller, Crew, Motive…', en: 'Scenes, characters, actors, crew, locations…', fr: 'Scènes, personnages, comédiens, équipe, décors…' },
  volltext:     { de: 'Volltext-Suche', en: 'Full-text search', fr: 'Recherche plein texte' },
  eingeben:     { de: 'Suchbegriff eingeben…', en: 'Enter a search term…', fr: 'Saisir un terme de recherche…' },
  keineTreffer: { de: 'Keine Ergebnisse für „{q}“', en: 'No results for "{q}"', fr: 'Aucun résultat pour « {q} »' },
} satisfies Record<string, Text>
