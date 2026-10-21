import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorPerformanceT = {
  titel:             { de: 'Video-Performance', en: 'Video performance', fr: 'Performance des vidéos' },
  untertitel:        { de: 'Aufrufe, Klickrate und Haltequote der veröffentlichten Videos', en: 'Views, click-through rate and retention of published videos', fr: 'Vues, taux de clics et taux de rétention des vidéos publiées' },
  veroeffentlicht:   { de: 'Veröffentlicht', en: 'Published', fr: 'Publiées' },
  aufrufeGesamt:     { de: 'Aufrufe gesamt', en: 'Total views', fr: 'Vues totales' },
  klickrateSchnitt:  { de: 'Klickrate im Schnitt', en: 'Average click-through rate', fr: 'Taux de clics moyen' },
  klickrateHinweis:  { de: 'üblich sind 2 bis 10 %', en: '2 to 10 % is typical', fr: '2 à 10 % est courant' },
  haltequoteSchnitt: { de: 'Haltequote im Schnitt', en: 'Average retention', fr: 'Rétention moyenne' },
  haltequoteHinweis: { de: 'ab 50 % gilt als gut', en: '50 % or more counts as good', fr: "à partir de 50 %, c'est bon" },
  nichtsVeroeffentlicht: { de: 'Noch nichts veröffentlicht', en: 'Nothing published yet', fr: "Rien de publié pour l'instant" },
  nichtsVeroeffentlichtText: {
    de: 'Sobald ein Video ein Veröffentlichungsdatum und Zahlen hat, wird es hier ausgewertet - Klickrate, Haltequote und Abos je Video.',
    en: 'As soon as a video has a release date and figures, it is analysed here - click-through rate, retention and subscribers per video.',
    fr: "Dès qu'une vidéo a une date de publication et des chiffres, elle est analysée ici - taux de clics, rétention et abonnés par vidéo.",
  },
  video:      { de: 'Video', en: 'Video', fr: 'Vidéo' },
  serie:      { de: 'Serie', en: 'Series', fr: 'Série' },
  datum:      { de: 'Datum', en: 'Date', fr: 'Date' },
  aufrufe:    { de: 'Aufrufe', en: 'Views', fr: 'Vues' },
  klickrate:  { de: 'Klickrate', en: 'Click-through rate', fr: 'Taux de clics' },
  haltequote: { de: 'Haltequote', en: 'Retention', fr: 'Rétention' },
  abos:       { de: 'Abos', en: 'Subscribers', fr: 'Abonnés' },
  einordnung: { de: 'Einordnung', en: 'Assessment', fr: 'Analyse' },
} satisfies Record<string, Text>
