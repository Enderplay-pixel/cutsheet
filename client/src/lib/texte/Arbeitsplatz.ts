import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte des anpassbaren Arbeitsplatzes: Hauptseite, Seitenleiste, Einstellungen. */
export const arbeitsplatzT = {
  kategorieProjekt:  { de: 'Projekt', en: 'Project', fr: 'Projet' },
  titel:             { de: 'Dein Arbeitsplatz', en: 'Your workspace', fr: 'Ton espace de travail' },
  untertitel:        { de: 'Alle Bereiche in deiner Reihenfolge. Sie gilt für alle deine Projekte und für die Seitenleiste.', en: 'Every area in your order. It applies to all your projects and to the sidebar.', fr: 'Tous les espaces dans ton ordre. Il vaut pour tous tes projets et pour la barre latérale.' },
  anordnen:          { de: 'Anordnen', en: 'Arrange', fr: 'Organiser' },
  fertig:            { de: 'Fertig', en: 'Done', fr: 'Terminé' },
  standard:          { de: 'Auf Standard zurücksetzen', en: 'Reset to default', fr: 'Rétablir par défaut' },
  einrichtung:       { de: 'Einrichtung', en: 'Setup', fr: 'Configuration' },
  einrichtungTitel:  { de: 'Richte deinen Arbeitsplatz ein', en: 'Set up your workspace', fr: 'Configure ton espace de travail' },
  einrichtungText:   { de: 'Es gibt keine feste Reihenfolge. Zieh jeden Bereich dorthin, wo er für deine Arbeit hingehört, auch in eine andere Kategorie. Ganze Kategorien verschiebst du an ihrem Griff.', en: 'There is no fixed order. Drag each area to where it belongs in your work, even into another category. Move whole categories by their handle.', fr: "Il n'y a pas d'ordre imposé. Fais glisser chaque espace là où il a sa place dans ton travail, même dans une autre catégorie. Déplace des catégories entières par leur poignée." },
  einrichtungWirkung:{ de: 'Die Anordnung gilt für alle deine Projekte und für die Seitenleiste. Ändern kannst du sie jederzeit hier oder in den Einstellungen.', en: 'The arrangement applies to all your projects and to the sidebar. You can change it here or in the settings at any time.', fr: "L'organisation vaut pour tous tes projets et pour la barre latérale. Tu peux la modifier à tout moment ici ou dans les paramètres." },
  standardBehalten:  { de: 'Standard behalten', en: 'Keep the default', fr: "Garder l'ordre par défaut" },
  leer:              { de: 'Bereich hierher ziehen', en: 'Drag an area here', fr: 'Fais glisser un espace ici' },
  griff:             { de: 'Kategorie {name} verschieben', en: 'Move category {name}', fr: 'Déplacer la catégorie {name}' },
  verschiebbar:      { de: 'verschiebbar', en: 'movable', fr: 'déplaçable' },
  anleitung:         { de: 'Zum Aufnehmen Leertaste oder Eingabetaste drücken. Mit den Pfeiltasten verschieben, mit Leertaste oder Eingabetaste ablegen, mit Escape abbrechen.', en: 'Press space or enter to pick up. Use the arrow keys to move, space or enter to drop, escape to cancel.', fr: 'Appuie sur espace ou entrée pour saisir. Déplace avec les flèches, dépose avec espace ou entrée, annule avec échap.' },
  aufgenommen:       { de: '{name} aufgenommen.', en: 'Picked up {name}.', fr: '{name} saisi.' },
  ueber:             { de: '{name} liegt bei {ziel}.', en: '{name} is over {ziel}.', fr: '{name} est sur {ziel}.' },
  abgelegt:          { de: '{name} abgelegt.', en: 'Dropped {name}.', fr: '{name} déposé.' },
  abgebrochen:       { de: 'Abgebrochen. {name} liegt wieder an seinem Platz.', en: 'Cancelled. {name} is back in place.', fr: 'Annulé. {name} est revenu à sa place.' },
  speichernFehler:   { de: 'Die Anordnung ließ sich nicht speichern', en: 'The arrangement could not be saved', fr: "Impossible d'enregistrer l'organisation" },
  einstellungen:     { de: 'Arbeitsplatz', en: 'Workspace', fr: 'Espace de travail' },
  einstellungenText: { de: 'Reihenfolge der Bereiche auf der Projektseite und in der Seitenleiste, gleich für alle deine Projekte.', en: 'Order of the areas on the project page and in the sidebar, the same for all your projects.', fr: "Ordre des espaces sur la page du projet et dans la barre latérale, le même pour tous tes projets." },
  artFilm:           { de: 'Filmprojekte', en: 'Film projects', fr: 'Projets de film' },
  artCreator:        { de: 'Creator-Projekte', en: 'Creator projects', fr: 'Projets créateur' },
  seiteSchalter:     { de: 'Abschnitte dieser Seite anordnen', en: 'Arrange the sections of this page', fr: 'Organiser les sections de cette page' },
  seiteTitel:        { de: 'Seite anordnen', en: 'Arrange page', fr: 'Organiser la page' },
  seiteText:         { de: 'Zieh die Abschnitte in die Reihenfolge, in der du sie brauchst. Sie gilt für diese Seite in allen deinen Projekten.', en: 'Drag the sections into the order you need them. It applies to this page in all your projects.', fr: "Fais glisser les sections dans l'ordre dont tu as besoin. Il vaut pour cette page dans tous tes projets." },
  seiteTelefon:      { de: 'Auf dem Telefon: gedrückt halten, dann ziehen.', en: 'On a phone: press and hold, then drag.', fr: 'Sur téléphone : maintiens appuyé, puis fais glisser.' },
} satisfies Record<string, Text>

/** Namen der anordenbaren Abschnitte, je Seite. */
export const bloeckeT = {
  kennzahlen:        { de: 'Kennzahlen', en: 'Key figures', fr: 'Chiffres clés' },
  lage:              { de: 'Fortschritt, Konflikte und Schnellzugriff', en: 'Progress, conflicts and quick access', fr: 'Avancement, conflits et accès rapide' },
  arbeitsplatz:      { de: 'Dein Arbeitsplatz', en: 'Your workspace', fr: 'Ton espace de travail' },
  szenen:            { de: 'Szenen des Tages', en: "The day's scenes", fr: 'Scènes du jour' },
  dispo:             { de: 'Besetzung und Stab', en: 'Cast and crew', fr: 'Acteurs et équipe' },
  zeitenHinweise:    { de: 'Zeiten verschieben, Hinweise und Catering', en: 'Shift times, notes and catering', fr: 'Décaler les horaires, consignes et restauration' },
} satisfies Record<string, Text>
