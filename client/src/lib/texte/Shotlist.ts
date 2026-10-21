import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const shotlistT = {
  groesseAria:     { de: 'Einstellungsgröße', en: 'Shot size', fr: 'Valeur de plan' },
  bewegungAria:    { de: 'Kamerabewegung', en: 'Camera movement', fr: 'Mouvement de caméra' },
  brennweiteAria:  { de: 'Brennweite in Millimetern', en: 'Focal length in millimetres', fr: 'Focale en millimètres' },
  sek:             { de: 'Sek', en: 'Sec', fr: 's' },
  dauerAria:       { de: 'Dauer in Sekunden', en: 'Duration in seconds', fr: 'Durée en secondes' },
  besterTakeTitel: { de: 'Bester Take (Circle Take)', en: 'Best take (circle take)', fr: 'Meilleure prise (prise cerclée)' },
  take:            { de: 'Take', en: 'Take', fr: 'Prise' },
  besterTake:      { de: 'Bester Take', en: 'Best take', fr: 'Meilleure prise' },
  alsOffen:        { de: 'Als offen markieren', en: 'Mark as open', fr: 'Marquer comme à faire' },
  alsErledigt:     { de: 'Als erledigt markieren', en: 'Mark as done', fr: 'Marquer comme fait' },
  duplizieren:     { de: 'Einstellung duplizieren', en: 'Duplicate shot', fr: 'Dupliquer le plan' },
  loeschen:        { de: 'Einstellung löschen', en: 'Delete shot', fr: 'Supprimer le plan' },
  beschreibungPlatzh: { de: 'Beschreibung / Inhalt', en: 'Description / content', fr: 'Description / contenu' },
  beschreibungAria:   { de: 'Beschreibung der Einstellung', en: 'Shot description', fr: 'Description du plan' },
  notizPlatzh:     { de: 'Notiz (VFX, Requisite, Sicherheit) - erscheint im PDF', en: 'Note (VFX, props, safety) - appears in the PDF', fr: 'Remarque (VFX, accessoires, sécurité) - figure dans le PDF' },
  notizAria:       { de: 'Notiz zur Einstellung, erscheint im PDF', en: 'Note on the shot, appears in the PDF', fr: 'Remarque sur le plan, figure dans le PDF' },
  kopie:           { de: '{text} (Kopie)', en: '{text} (copy)', fr: '{text} (copie)' },
  titel:           { de: 'Auflösung & Shotlist', en: 'Shot breakdown & shot list', fr: 'Découpage & liste des plans' },
  untertitel:      { de: '{n} Einstellungen · {d} erledigt · {m} Min.', en: '{n} shots · {d} done · {m} min', fr: '{n} plans · {d} faits · {m} min' },
  pdfSzenen:       { de: 'PDF nach Szenen', en: 'PDF by scene', fr: 'PDF par scène' },
  pdfDrehtage:     { de: 'PDF nach Drehtagen', en: 'PDF by shoot day', fr: 'PDF par jour de tournage' },
  ohneEinstellungen: { de: '{n} Szene(n) ohne Einstellungen: {liste}', en: '{n} scene(s) without shots: {liste}', fr: '{n} scène(s) sans plans : {liste}' },
  szKurz:          { de: 'Sz. {n}', en: 'Sc. {n}', fr: 'Sc. {n}' },
  suchen:          { de: 'Szene suchen (Nummer oder Titel)', en: 'Search scene (number or title)', fr: 'Rechercher une scène (numéro ou titre)' },
  suchenAria:      { de: 'Szene suchen', en: 'Search scene', fr: 'Rechercher une scène' },
  aufklappen:      { de: 'Alle aufklappen', en: 'Expand all', fr: 'Tout déplier' },
  zuklappen:       { de: 'Alle zuklappen', en: 'Collapse all', fr: 'Tout replier' },
  szenenN:         { de: '{n} Szenen', en: '{n} scenes', fr: '{n} scènes' },
  spalteNr:        { de: 'Nr.', en: 'No.', fr: 'N°' },
  spalteGroesse:   { de: 'Größe', en: 'Size', fr: 'Valeur' },
  spalteBewegung:  { de: 'Bewegung', en: 'Movement', fr: 'Mouvement' },
  spalteObjektiv:  { de: 'Objektiv', en: 'Lens', fr: 'Objectif' },
  spalteDauer:     { de: 'Dauer', en: 'Duration', fr: 'Durée' },
  hinzufuegen:     { de: 'Einstellung hinzufügen', en: 'Add shot', fr: 'Ajouter un plan' },
} satisfies Record<string, Text>

/** Beschriftungen gespeicherter Werte - die Werte selbst bleiben, wie sie sind. */
export const shotGroesseT: Record<string, Text> = {
  'Totale':            { de: 'Totale', en: 'Full shot', fr: "Plan d'ensemble" },
  'Vogelperspektive':  { de: 'Vogelperspektive', en: "Bird's-eye view", fr: 'Plongée totale' },
  'Froschperspektive': { de: 'Froschperspektive', en: "Worm's-eye view", fr: 'Contre-plongée totale' },
}

export const shotBewegungT: Record<string, Text> = {
  'Statisch': { de: 'Statisch', en: 'Static', fr: 'Fixe' },
  'Pan':      { de: 'Pan', en: 'Pan', fr: 'Panoramique' },
  'Tilt':     { de: 'Tilt', en: 'Tilt', fr: 'Panoramique vertical' },
  'Pan + Tilt': { de: 'Pan + Tilt', en: 'Pan + tilt', fr: 'Pano + pano vertical' },
  'Dolly':    { de: 'Dolly', en: 'Dolly', fr: 'Dolly' },
  'Fahrt':    { de: 'Fahrt', en: 'Tracking shot', fr: 'Travelling' },
  'Gimbal':   { de: 'Gimbal', en: 'Gimbal', fr: 'Gimbal' },
  'Handheld': { de: 'Handheld', en: 'Handheld', fr: "Caméra à l'épaule" },
  'Kran':     { de: 'Kran', en: 'Crane', fr: 'Grue' },
  'Drohne':   { de: 'Drohne', en: 'Drone', fr: 'Drone' },
  'Zoom':     { de: 'Zoom', en: 'Zoom', fr: 'Zoom' },
}

export const tagNachtT: Record<string, Text> = {
  'TAG':   { de: 'TAG', en: 'DAY', fr: 'JOUR' },
  'NACHT': { de: 'NACHT', en: 'NIGHT', fr: 'NUIT' },
}
