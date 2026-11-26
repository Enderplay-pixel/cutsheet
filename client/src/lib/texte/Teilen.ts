import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte zu Szene teilen, Tage tauschen und Tagesarten (Plan Kino-Ausbau, AP E6). */
export const teilenT = {
  teilen: { de: 'Szene teilen', en: 'Split scene', fr: 'Diviser la scène' },
  teilenTitel: {
    de: 'Einen Teil der markierten Szene an einem weiteren Tag drehen',
    en: 'Shoot part of the selected scene on another day',
    fr: 'Tourner une partie de la scène sélectionnée un autre jour',
  },
  dialogTitel: { de: 'Szene {n} teilen', en: 'Split scene {n}', fr: 'Diviser la scène {n}' },
  zielTag: { de: 'Zweiter Teil an', en: 'Second part on', fr: 'Deuxième partie le' },
  seitenNeu: { de: 'Seiten des neuen Teils', en: 'Pages of the new part', fr: 'Pages de la nouvelle partie' },
  seitenHier: { de: 'Seiten dieses Teils', en: 'Pages of this part', fr: 'Pages de cette partie' },
  seitenHilfe: { de: 'z. B. 7/8, 1 oder 1 1/8 - an diesem Tag stehen {s}', en: 'e.g. 7/8, 1 or 1 1/8 - this day holds {s}', fr: 'p. ex. 7/8, 1 ou 1 1/8 - ce jour en compte {s}' },
  seitenUnlesbar: { de: 'Seiten als 7/8, 1 oder 1 1/8 eingeben', en: 'Enter pages as 7/8, 1 or 1 1/8', fr: 'Saisir les pages en 7/8, 1 ou 1 1/8' },
  teilenKnopf: { de: 'Teilen', en: 'Split', fr: 'Diviser' },
  anteilKnopf: { de: 'Anteil speichern', en: 'Save share', fr: 'Enregistrer la part' },
  abbrechen: { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  geteilt: { de: 'Szene {n} geteilt', en: 'Scene {n} split', fr: 'Scène {n} divisée' },
  teilNr: { de: '({nr}/{von})', en: '({nr}/{von})', fr: '({nr}/{von})' },
  nichtGanz: {
    de: 'Die Teile ergeben {summe} von {ganz} Seiten',
    en: 'The parts add up to {summe} of {ganz} pages',
    fr: 'Les parties font {summe} sur {ganz} pages',
  },
  nichtGanzKurz: { de: 'Die Teile ergeben nicht die ganze Szene', en: 'The parts do not add up to the whole scene', fr: 'Les parties ne font pas toute la scène' },
  weitererTeil: { de: 'Weiterer Teil von Szene {n}', en: 'Further part of scene {n}', fr: 'Autre partie de la scène {n}' },
  // Tage
  tagMenue: { de: 'Tag {n}: tauschen oder verschieben', en: 'Day {n}: swap or move', fr: 'Jour {n} : échanger ou déplacer' },
  tauschenMit: { de: 'Tag tauschen mit …', en: 'Swap day with …', fr: 'Échanger le jour avec …' },
  verschiebenAuf: { de: 'Tag verschieben auf …', en: 'Move day to …', fr: 'Déplacer le jour au …' },
  neuesDatum: { de: 'Neues Datum für Tag {n}', en: 'New date for day {n}', fr: 'Nouvelle date pour le jour {n}' },
  verschieben: { de: 'Verschieben', en: 'Move', fr: 'Déplacer' },
  getauscht: { de: 'Tag {a} und Tag {b} getauscht', en: 'Day {a} and day {b} swapped', fr: 'Jour {a} et jour {b} échangés' },
  // Tagesarten
  wochenende: { de: 'Wochenende', en: 'Weekend', fr: 'Week-end' },
  feiertag: { de: 'Feiertag', en: 'Public holiday', fr: 'Jour férié' },
  nacht: { de: 'Nachtdreh', en: 'Night shoot', fr: 'Tournage de nuit' },
  summe: {
    de: '{drehtage} Drehtage, davon {wochenende} am Wochenende, {feiertag} an Feiertagen, {nacht} Nachtdrehs · {drehfrei} drehfrei, {reisetag} Reisetage, {reserve} Reserve',
    en: '{drehtage} shoot days, of which {wochenende} at weekends, {feiertag} on holidays, {nacht} night shoots · {drehfrei} days off, {reisetag} travel days, {reserve} standby',
    fr: '{drehtage} jours de tournage, dont {wochenende} le week-end, {feiertag} fériés, {nacht} de nuit · {drehfrei} jours off, {reisetag} jours de voyage, {reserve} en réserve',
  },
} satisfies Record<string, Text>
