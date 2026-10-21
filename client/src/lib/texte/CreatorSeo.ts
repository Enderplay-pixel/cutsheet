import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorSeoT = {
  titel:          { de: 'SEO & Metadaten', en: 'SEO & metadata', fr: 'SEO et métadonnées' },
  untertitel:     { de: 'Zielbegriff, Schlagworte, Beschreibung und Titellänge je Video', en: 'Target keyword, tags, description and title length per video', fr: 'Mot-clé cible, tags, description et longueur du titre par vidéo' },
  videos:         { de: 'Videos', en: 'Videos', fr: 'Vidéos' },
  vollstaendig:   { de: 'Vollständig', en: 'Complete', fr: 'Complètes' },
  mitMaengeln:    { de: 'Mit Mängeln', en: 'With issues', fr: 'Avec lacunes' },
  leerTitel:      { de: 'Noch keine Videos', en: 'No videos yet', fr: 'Pas encore de vidéos' },
  leerText:       { de: 'Diese Seite prüft für jedes Video Zielbegriff, Schlagworte, Beschreibung und Titellänge - und sagt, was konkret fehlt.', en: 'This page checks the target keyword, tags, description and title length for every video - and tells you exactly what is missing.', fr: "Cette page vérifie pour chaque vidéo le mot-clé cible, les tags, la description et la longueur du titre - et indique précisément ce qui manque." },
  spalteVideo:    { de: 'Video', en: 'Video', fr: 'Vidéo' },
  spalteTitel:    { de: 'Titel', en: 'Title', fr: 'Titre' },
  spalteZiel:     { de: 'Zielbegriff', en: 'Target keyword', fr: 'Mot-clé cible' },
  spalteTags:     { de: 'Schlagworte', en: 'Tags', fr: 'Tags' },
  spalteBeschr:   { de: 'Beschreibung', en: 'Description', fr: 'Description' },
  spalteFehlt:    { de: 'Fehlt', en: 'Missing', fr: 'Manque' },
  markeVoll:      { de: 'vollständig', en: 'complete', fr: 'complet' },
  richtwerte:     { de: 'Richtwerte: Titel bis {n} Zeichen, sonst schneidet die Suche ab. Mindestens drei Schlagworte und eine Beschreibung ab 100 Zeichen. Das sind Erfahrungswerte, keine Vorgaben von YouTube.', en: 'Guidelines: titles up to {n} characters, otherwise search cuts them off. At least three tags and a description of 100 characters or more. These are rules of thumb, not YouTube requirements.', fr: "Repères : titre jusqu'à {n} caractères, sinon la recherche le coupe. Au moins trois tags et une description d'au moins 100 caractères. Ce sont des valeurs empiriques, pas des exigences de YouTube." },
} satisfies Record<string, Text>
