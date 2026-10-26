import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Beschriftungen der Symbolarten - die Schlüssel (`kind`) gehen an den Server. */
export const setplanArtenT = {
  kamera: { de: 'Kamera', en: 'Camera', fr: 'Caméra' },
  licht: { de: 'Licht', en: 'Light', fr: 'Lumière' },
  praktikable: { de: 'Praktikable', en: 'Rostrum', fr: 'Praticable' },
  ton: { de: 'Mikrofon', en: 'Microphone', fr: 'Micro' },
  darsteller: { de: 'Darsteller', en: 'Actor', fr: 'Comédien(ne)' },
  requisite: { de: 'Requisite', en: 'Prop', fr: 'Accessoire' },
  moebel: { de: 'Möbel', en: 'Furniture', fr: 'Mobilier' },
  tuer: { de: 'Tür', en: 'Door', fr: 'Porte' },
  fenster: { de: 'Fenster', en: 'Window', fr: 'Fenêtre' },
  monitor: { de: 'Monitor', en: 'Monitor', fr: 'Moniteur' },
  marker: { de: 'Markierung', en: 'Marker', fr: 'Repère' },
} satisfies Record<string, Text>

export const setplanT = {
  neuerSetPlan: { de: 'Neuer Set-Plan', en: 'New set plan', fr: 'Nouveau plan de plateau' },
  planNichtAngelegt: { de: 'Plan nicht angelegt', en: 'Plan not created', fr: 'Plan non créé' },
  nichtGespeichert: { de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
  loeschenFehlgeschlagen: { de: 'Löschen fehlgeschlagen', en: 'Delete failed', fr: 'Échec de la suppression' },
  elementNichtAngelegt: { de: 'Element nicht angelegt', en: 'Element not created', fr: 'Élément non créé' },
  bildNichtHochgeladen: { de: 'Bild nicht hochgeladen', en: 'Image not uploaded', fr: 'Image non téléversée' },
  titel: { de: 'Set-Plan', en: 'Set plan', fr: 'Plan de plateau' },
  untertitel: {
    de: 'Grundriss hochladen, dann Kamera, Licht und Ton daraufziehen',
    en: 'Upload a floor plan, then drag camera, lighting and sound onto it',
    fr: 'Téléversez un plan au sol, puis placez-y caméra, lumière et son',
  },
  neuerPlan: { de: 'Neuer Plan', en: 'New plan', fr: 'Nouveau plan' },
  nochKeiner: { de: 'Noch kein Set-Plan angelegt', en: 'No set plan created yet', fr: 'Aucun plan de plateau pour le moment' },
  nochKeinerText: {
    de: 'Lade einen Grundriss oder ein Foto des Raums hoch und stelle Kamera, Licht und Ton an ihre Position. Der Plan lässt sich als PDF drucken und zur Tagesdispo legen.',
    en: 'Upload a floor plan or a photo of the room and place camera, lighting and sound in position. The plan can be printed as a PDF and added to the call sheet.',
    fr: 'Téléversez un plan au sol ou une photo de la pièce et placez caméra, lumière et son. Le plan peut être imprimé en PDF et joint à la feuille de service.',
  },
  erstenPlanAnlegen: { de: 'Ersten Plan anlegen', en: 'Create first plan', fr: 'Créer le premier plan' },
  szene: { de: 'Szene {n} · ', en: 'Scene {n} · ', fr: 'Scène {n} · ' },
  element: { de: '{n} Element', en: '{n} element', fr: '{n} élément' },
  elemente: { de: '{n} Elemente', en: '{n} elements', fr: '{n} éléments' },
  keinGrundriss: { de: 'Noch kein Grundriss hochgeladen', en: 'No floor plan uploaded yet', fr: 'Aucun plan au sol téléversé' },
  symbolHinweis: {
    de: 'Symbol anklicken, um es hinzuzufügen - dann auf dem Plan an die richtige Stelle ziehen.',
    en: 'Click a symbol to add it - then drag it to the right spot on the plan.',
    fr: "Clique sur un symbole pour l'ajouter - puis fais-le glisser au bon endroit sur le plan.",
  },
  name: { de: 'Name', en: 'Name', fr: 'Nom' },
  grundriss: { de: 'Grundriss', en: 'Floor plan', fr: 'Plan au sol' },
  bildErsetzen: { de: 'Bild ersetzen', en: 'Replace image', fr: "Remplacer l'image" },
  bildHochladen: { de: 'Bild hochladen', en: 'Upload image', fr: 'Téléverser une image' },
  beschriftung: { de: 'Beschriftung', en: 'Label', fr: 'Libellé' },
  typ: { de: 'Typ', en: 'Type', fr: 'Type' },
  blickrichtung: { de: 'Blickrichtung: {n}°', en: 'Direction: {n}°', fr: 'Orientation : {n}°' },
  groesse: { de: 'Größe: {n} %', en: 'Size: {n} %', fr: 'Taille : {n} %' },
  elementEntfernen: { de: 'Element entfernen', en: 'Remove element', fr: "Supprimer l'élément" },
  elementHinweis: {
    de: 'Ein Element auf dem Plan anklicken, um Beschriftung, Richtung und Größe zu ändern.',
    en: 'Click an element on the plan to change its label, direction and size.',
    fr: 'Clique sur un élément du plan pour modifier son libellé, son orientation et sa taille.',
  },
  notizen: { de: 'Notizen', en: 'Notes', fr: 'Notes' },
  notizenBeispiel: {
    de: 'Fenster abkleben, Steckdose links defekt …',
    en: 'Tape up the windows, socket on the left broken …',
    fr: 'Occulter les fenêtres, prise de gauche défectueuse …',
  },
  loeschenFrage: { de: '„{name}“ löschen?', en: 'Delete "{name}"?', fr: 'Supprimer « {name} » ?' },
  planLoeschen: { de: 'Plan löschen', en: 'Delete plan', fr: 'Supprimer le plan' },
} satisfies Record<string, Text>
