import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte zu Erzähltag und Vorstopp (Plan Kino-Ausbau, AP E5). */
export const vorstoppT = {
  erzaehltag: { de: 'Erzähltag', en: 'Story day', fr: 'Jour de récit' },
  erzaehltagHilfe: {
    de: 'Der Tag in der Geschichte, z. B. 3, 3A oder RB 1. Die Dispo druckt ihn hinter T/N (T3, N3).',
    en: 'The day in the story, e.g. 3, 3A or FB 1. The call sheet prints it after D/N (D3, N3).',
    fr: 'Le jour dans l’histoire, p. ex. 3, 3A ou FB 1. La feuille de service l’imprime après J/N (J3, N3).',
  },
  vorstopp: { de: 'Vorstopp', en: 'Pre-timing', fr: 'Pré-minutage' },
  vorstoppHilfe: {
    de: 'Länge der Szene im Film, z. B. 1:35. Leer: geschätzt aus der Seitenlänge, eine Seite eine Minute.',
    en: 'Length of the scene in the film, e.g. 1:35. Empty: estimated from the page count, one page one minute.',
    fr: 'Durée de la scène dans le film, p. ex. 1:35. Vide : estimée à partir des pages, une page une minute.',
  },
  geschaetzt: { de: 'geschätzt {zeit}', en: 'estimated {zeit}', fr: 'estimé {zeit}' },
  unlesbar: { de: 'Vorstopp als m:ss eingeben, z. B. 1:35', en: 'Enter pre-timing as m:ss, e.g. 1:35', fr: 'Saisir le pré-minutage en m:ss, p. ex. 1:35' },
  summe: { de: 'Vorstopp {zeit}', en: 'Pre-timing {zeit}', fr: 'Pré-minutage {zeit}' },
  summeGeschaetzt: { de: 'Vorstopp {zeit}, davon {geschaetzt} geschätzt', en: 'Pre-timing {zeit}, {geschaetzt} of it estimated', fr: 'Pré-minutage {zeit}, dont {geschaetzt} estimé' },
  // Tagesbericht
  filmzeit: { de: 'Gedrehte Filmzeit', en: 'Screen time shot', fr: 'Durée tournée' },
  filmzeitHilfe: { de: 'Länge des heute Gedrehten im Film, m:ss', en: 'Length in the film of what was shot today, m:ss', fr: 'Durée dans le film de ce qui a été tourné, m:ss' },
  heuteVorstopp: { de: 'Vorstopp der abgedrehten Szenen: {zeit}', en: 'Pre-timing of completed scenes: {zeit}', fr: 'Pré-minutage des scènes tournées : {zeit}' },
  aufgelaufen: { de: 'Aufgelaufen', en: 'Running total', fr: 'Cumul' },
  gesamt: { de: 'Vorstopp gesamt', en: 'Total pre-timing', fr: 'Pré-minutage total' },
  davonAbgedreht: { de: 'davon abgedreht', en: 'of which shot', fr: 'dont tourné' },
  rest: { de: 'Rest des Films', en: 'Rest of the film', fr: 'Reste du film' },
  gedrehtGesamt: { de: 'gedrehte Filmzeit gesamt', en: 'total screen time shot', fr: 'durée tournée totale' },
  // Listen
  listen: { de: 'Listen', en: 'Lists', fr: 'Listes' },
  requisitenliste: { de: 'Requisitenliste nach Erzähltag', en: 'Props list by story day', fr: 'Liste des accessoires par jour de récit' },
  kostuemliste: { de: 'Kostümliste nach Erzähltag', en: 'Costume list by story day', fr: 'Liste des costumes par jour de récit' },
  maskenliste: { de: 'Maskenliste nach Erzähltag', en: 'Make-up list by story day', fr: 'Liste maquillage par jour de récit' },
} satisfies Record<string, Text>
