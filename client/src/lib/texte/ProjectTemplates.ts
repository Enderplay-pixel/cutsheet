import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const vorlagenT = {
  titel: { de: 'Projektvorlage wählen', en: 'Choose a project template', fr: 'Choisir un modèle de projet' },
  untertitel: {
    de: 'Wähle eine Vorlage, um das neue Projekt vorzubefüllen',
    en: 'Choose a template to pre-fill the new project',
    fr: 'Choisissez un modèle pour pré-remplir le nouveau projet',
  },
} satisfies Record<string, Text>

/** Anzeige je Vorlage, Schlüssel ist das `format` der Vorlage. */
export const vorlagenListeT = {
  Kurzfilm: {
    name: { de: 'Kurzfilm', en: 'Short film', fr: 'Court métrage' },
    beschreibung: {
      de: 'Eigenständiges kurzes Werk für Festivals, Wettbewerbe oder als Visitenkarte.',
      en: 'A self-contained short work for festivals, competitions or as a calling card.',
      fr: 'Œuvre courte autonome pour les festivals, les concours ou comme carte de visite.',
    },
    dauer: { de: '5-30 Min.', en: '5-30 min', fr: '5-30 min' },
    crew: { de: '5-20 Personen', en: '5-20 people', fr: '5-20 personnes' },
  },
  Spielfilm: {
    name: { de: 'Spielfilm', en: 'Feature film', fr: 'Long métrage' },
    beschreibung: {
      de: 'Abendfüllender Kinospielfilm mit vollständiger Produktion.',
      en: 'A full-length cinema feature with a complete production.',
      fr: 'Long métrage de cinéma avec une production complète.',
    },
    dauer: { de: '80-120 Min.', en: '80-120 min', fr: '80-120 min' },
    crew: { de: '30-100+ Personen', en: '30-100+ people', fr: '30-100+ personnes' },
  },
  Werbefilm: {
    name: { de: 'Werbespot', en: 'Commercial', fr: 'Spot publicitaire' },
    beschreibung: {
      de: 'Werblicher Kurzfilm für TV, Online oder Kino.',
      en: 'A short advertising film for TV, online or cinema.',
      fr: 'Court film publicitaire pour la télévision, le web ou le cinéma.',
    },
    dauer: { de: '15-60 Sek.', en: '15-60 sec', fr: '15-60 s' },
    crew: { de: '10-30 Personen', en: '10-30 people', fr: '10-30 personnes' },
  },
  Dokumentarfilm: {
    name: { de: 'Dokumentarfilm', en: 'Documentary', fr: 'Documentaire' },
    beschreibung: {
      de: 'Dokumentarische Arbeit über reale Ereignisse, Menschen oder Themen.',
      en: 'A documentary work about real events, people or subjects.',
      fr: 'Œuvre documentaire sur des événements, des personnes ou des sujets réels.',
    },
    dauer: { de: '30-90 Min.', en: '30-90 min', fr: '30-90 min' },
    crew: { de: '3-15 Personen', en: '3-15 people', fr: '3-15 personnes' },
  },
  Serie: {
    name: { de: 'Serie / Episode', en: 'Series / episode', fr: 'Série / épisode' },
    beschreibung: {
      de: 'Eine Episode einer fortlaufenden Serie für TV oder Streaming.',
      en: 'One episode of an ongoing series for TV or streaming.',
      fr: "Un épisode d'une série en cours pour la télévision ou le streaming.",
    },
    dauer: { de: '20-60 Min.', en: '20-60 min', fr: '20-60 min' },
    crew: { de: '20-60 Personen', en: '20-60 people', fr: '20-60 personnes' },
  },
  Musikvideo: {
    name: { de: 'Musikvideo', en: 'Music video', fr: 'Clip musical' },
    beschreibung: {
      de: 'Visueller Begleiter zu einem Musikstück für Künstler oder Labels.',
      en: 'A visual companion to a piece of music for artists or labels.',
      fr: "Accompagnement visuel d'un morceau de musique pour des artistes ou des labels.",
    },
    dauer: { de: '3-6 Min.', en: '3-6 min', fr: '3-6 min' },
    crew: { de: '5-20 Personen', en: '5-20 people', fr: '5-20 personnes' },
  },
} satisfies Record<string, Record<'name' | 'beschreibung' | 'dauer' | 'crew', Text>>
