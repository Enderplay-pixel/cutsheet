import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorSerienT = {
  titel:            { de: 'Serien & Formate', en: 'Series & formats', fr: 'Séries et formats' },
  untertitel:       { de: 'Welches wiederkehrende Format trägt den Kanal', en: 'Which recurring format carries the channel', fr: 'Quel format récurrent porte la chaîne' },
  serien:           { de: 'Serien', en: 'Series', fr: 'Séries' },
  ohneSerie:        { de: 'Ohne Serie', en: 'No series', fr: 'Sans série' },
  ohneSerieHinweis: { de: 'Einzelstücke ohne Format', en: 'One-offs without a format', fr: 'Vidéos uniques sans format' },
  staerksteSerie:   { de: 'Stärkste Serie', en: 'Strongest series', fr: 'Série la plus forte' },
  nachAufrufen:     { de: 'nach Aufrufen im Schnitt', en: 'by average views', fr: 'selon la moyenne de vues' },
  keineVideos:      { de: 'Noch keine Videos', en: 'No videos yet', fr: "Aucune vidéo pour l'instant" },
  keineVideosText: {
    de: 'Sobald Videos angelegt sind, lassen sie sich einer Serie zuordnen. Diese Seite zeigt dann, welches Format im Schnitt am besten läuft.',
    en: 'Once videos have been created, they can be assigned to a series. This page then shows which format performs best on average.',
    fr: 'Dès que des vidéos sont créées, elles peuvent être rattachées à une série. Cette page montre alors quel format marche le mieux en moyenne.',
  },
  serie:          { de: 'Serie', en: 'Series', fr: 'Série' },
  videos:         { de: 'Videos', en: 'Videos', fr: 'Vidéos' },
  davonRaus:      { de: 'davon raus', en: 'published', fr: 'dont publiées' },
  geplant:        { de: 'geplant', en: 'scheduled', fr: 'prévues' },
  aufrufeSchnitt: { de: 'Aufrufe im Schnitt', en: 'Average views', fr: 'Vues en moyenne' },
  staerksteFolge: { de: 'Stärkste Folge', en: 'Strongest episode', fr: 'Meilleur épisode' },
} satisfies Record<string, Text>
