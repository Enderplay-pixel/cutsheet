import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte zu Units und parallelen Drehtagen (Plan Kino-Ausbau, AP C2). */
export const unitsT = {
  unit: { de: 'Unit', en: 'Unit', fr: 'Unité' },
  alle: { de: 'Alle Units', en: 'All units', fr: 'Toutes les unités' },
  zeigen: { de: 'Units zeigen', en: 'Show units', fr: 'Afficher les unités' },
  verwalten: { de: 'Units', en: 'Units', fr: 'Unités' },
  titel: { de: 'Units des Projekts', en: 'Units of the project', fr: 'Unités du projet' },
  erklaerung: {
    de: 'Jede Unit hat ihre eigene Folge von Drehtagen ("Tag 5", "2U Tag 3"). Tage verschiedener Units dürfen auf demselben Datum liegen; der Konfliktradar meldet, wenn dieselbe Figur oder dieselbe Person des Stabs an einem Datum in zwei Units steht.',
    en: 'Each unit has its own sequence of shoot days ("Day 5", "2U Day 3"). Days of different units may share a date; the conflict radar reports when the same character or crew member is in two units on one date.',
    fr: 'Chaque unité a sa propre suite de jours de tournage (« Jour 5 », « 2U Jour 3 »). Des jours d’unités différentes peuvent tomber à la même date ; le radar des conflits signale un même personnage ou membre de l’équipe dans deux unités le même jour.',
  },
  haupt: { de: 'Haupteinheit', en: 'Main unit', fr: 'Unité principale' },
  name: { de: 'Name', en: 'Name', fr: 'Nom' },
  kuerzel: { de: 'Kürzel', en: 'Abbreviation', fr: 'Abréviation' },
  farbe: { de: 'Farbe', en: 'Colour', fr: 'Couleur' },
  nameVon: { de: 'Name der Unit {name}', en: 'Name of unit {name}', fr: 'Nom de l’unité {name}' },
  kuerzelVon: { de: 'Kürzel der Unit {name}', en: 'Abbreviation of unit {name}', fr: 'Abréviation de l’unité {name}' },
  farbeVon: { de: 'Farbe der Unit {name}', en: 'Colour of unit {name}', fr: 'Couleur de l’unité {name}' },
  neu: { de: 'Neue Unit, z. B. 2. Unit', en: 'New unit, e.g. 2nd unit', fr: 'Nouvelle unité, p. ex. 2e unité' },
  neuKuerzel: { de: 'z. B. 2U', en: 'e.g. 2U', fr: 'p. ex. 2U' },
  anlegen: { de: 'Unit anlegen', en: 'Add unit', fr: 'Ajouter l’unité' },
  loeschen: { de: 'Unit {name} löschen', en: 'Delete unit {name}', fr: 'Supprimer l’unité {name}' },
  loeschenFrage: { de: 'Unit „{name}“ löschen?', en: 'Delete unit "{name}"?', fr: 'Supprimer l’unité « {name} » ?' },
  tageWandern: {
    de: '{meldung} Trotzdem löschen?',
    en: '{meldung} Delete anyway?',
    fr: '{meldung} Supprimer quand même ?',
  },
  zahlen: { de: '{tage} Tage, {stab} im Stab', en: '{tage} days, {stab} crew', fr: '{tage} jours, {stab} dans l’équipe' },
  gespeichert: { de: 'Unit gespeichert', en: 'Unit saved', fr: 'Unité enregistrée' },
  fehler: { de: 'Fehler', en: 'Error', fr: 'Erreur' },
  schliessen: { de: 'Schließen', en: 'Close', fr: 'Fermer' },
  // Stab je Unit
  stabUnit: { de: 'Unit', en: 'Unit', fr: 'Unité' },
  stabUnitVon: { de: 'Unit von {name}', en: 'Unit of {name}', fr: 'Unité de {name}' },
  alleUnits: { de: 'Alle Units', en: 'All units', fr: 'Toutes les unités' },
  stabHinweis: {
    de: 'Eine neue Dispo ruft den Stab ihrer Unit und alle, die zu allen Units gehören.',
    en: 'A new call sheet calls the crew of its unit and everyone assigned to all units.',
    fr: 'Une nouvelle feuille de service convoque l’équipe de son unité et tous ceux affectés à toutes les unités.',
  },
} satisfies Record<string, Text>
