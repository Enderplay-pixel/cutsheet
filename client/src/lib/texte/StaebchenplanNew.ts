import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/**
 * Texte des Stäbchenplans. Seit dem 14.11.2026 ein Board zum Planen (Plan
 * Kino-Ausbau, AP A2): eine Liste der Drehtage mit Tagesgrenzen, darunter
 * die Ablage.
 */
export const staebchenT = {
  intTag: { de: 'INT / Tag', en: 'INT / Day', fr: 'INT / Jour' },
  extTag: { de: 'EXT / Tag', en: 'EXT / Day', fr: 'EXT / Jour' },
  intNacht: { de: 'INT / Nacht', en: 'INT / Night', fr: 'INT / Nuit' },
  extNacht: { de: 'EXT / Nacht', en: 'EXT / Night', fr: 'EXT / Nuit' },
  titel: { de: 'Stäbchenplan', en: 'Stripboard', fr: 'Tableau de bandes' },
  untertitel: {
    de: 'Drehtage als Streifen planen - ziehen, teilen, automatisch einteilen',
    en: 'Plan shoot days as strips - drag, split, schedule automatically',
    fr: 'Planifier les jours de tournage en bandes - glisser, scinder, répartir automatiquement',
  },
  totalSzenen: { de: 'Szenen gesamt', en: 'Total scenes', fr: 'Total des scènes' },
  verplanteSzenen: { de: 'Verplante Szenen', en: 'Scheduled scenes', fr: 'Scènes planifiées' },
  seitenGesamt: { de: 'Seiten gesamt', en: 'Total pages', fr: 'Pages au total' },
  drehtage: { de: 'Drehtage', en: 'Shoot days', fr: 'Jours de tournage' },
  keinDrehplan: { de: 'Noch keine Szenen', en: 'No scenes yet', fr: 'Pas encore de scènes' },
  keinDrehplanText: {
    de: 'Lege Szenen an oder lies ein Drehbuch ein. Dann liegen sie hier in der Ablage und lassen sich auf Drehtage verteilen.',
    en: 'Create scenes or import a screenplay. They then sit here in the unscheduled pool and can be spread across shoot days.',
    fr: 'Crée des scènes ou importe un scénario. Elles apparaissent alors ici, non planifiées, et peuvent être réparties sur les jours de tournage.',
  },

  // Spalten eines Streifens
  spalteNummer: { de: 'Nr.', en: 'No.', fr: 'N°' },
  spalteIE: { de: 'I/E', en: 'I/E', fr: 'I/E' },
  spalteTN: { de: 'T/N', en: 'D/N', fr: 'J/N' },
  spalteSchauplatz: { de: 'Schauplatz', en: 'Set', fr: 'Décor' },
  spalteBeschreibung: { de: 'Kurzbeschreibung', en: 'Synopsis', fr: 'Résumé' },
  spalteMotiv: { de: 'Motiv', en: 'Location', fr: 'Lieu' },
  spalteSeiten: { de: 'Seiten', en: 'Pages', fr: 'Pages' },
  spalteZeit: { de: 'Zeit', en: 'Time', fr: 'Durée' },
  spalteFiguren: { de: 'Figuren', en: 'Cast', fr: 'Rôles' },
  stripName: { de: 'Szene {n}: {titel}', en: 'Scene {n}: {titel}', fr: 'Scène {n} : {titel}' },
  markiertZusatz: { de: 'markiert', en: 'selected', fr: 'sélectionnée' },

  // Tagesgrenze
  tag: { de: 'Tag {n}', en: 'Day {n}', fr: 'Jour {n}' },
  seiten: { de: '{s} Seiten', en: '{s} pages', fr: '{s} pages' },
  stunden: { de: '{d} Std.', en: '{d} h', fr: '{d} h' },
  ohneDatum: { de: 'ohne Datum', en: 'no date', fr: 'sans date' },
  ueberTageslaenge: {
    de: 'Drehzeit über der Tageslänge von {d} Std.',
    en: 'Shooting time exceeds the day length of {d} h',
    fr: 'Durée de tournage supérieure à la durée de journée de {d} h',
  },
  sonne: { de: 'Sonne {auf} - {unter}', en: 'Sun {auf} - {unter}', fr: 'Soleil {auf} - {unter}' },
  sonneTitel: {
    de: 'Sonnenauf- und -untergang am Motiv der ersten Szene',
    en: 'Sunrise and sunset at the location of the first scene',
    fr: 'Lever et coucher du soleil au lieu de la première scène',
  },
  bannerNeu: { de: 'Banner', en: 'Banner', fr: 'Bandeau' },
  bannerNeuName: { de: 'Banner in Tag {n} einfügen', en: 'Add banner to day {n}', fr: 'Ajouter un bandeau au jour {n}' },
  grenzeEntfernen: { de: 'Grenze entfernen', en: 'Remove break', fr: 'Retirer la séparation' },
  grenzeEntfernenName: {
    de: 'Tagesgrenze unter Tag {n} entfernen: Tag {m} geht in Tag {n} auf',
    en: 'Remove the break below day {n}: day {m} merges into day {n}',
    fr: 'Retirer la séparation sous le jour {n} : le jour {m} rejoint le jour {n}',
  },
  grenzeEntfernt: { de: 'Tag {m} ist jetzt Teil von Tag {n}', en: 'Day {m} is now part of day {n}', fr: 'Le jour {m} fait maintenant partie du jour {n}' },
  tagesgrenzeName: { de: 'Ende von Tag {n}', en: 'End of day {n}', fr: 'Fin du jour {n}' },

  // Banner
  bannerName: { de: 'Banner: {text}', en: 'Banner: {text}', fr: 'Bandeau : {text}' },
  minuten: { de: '{m} Min.', en: '{m} min', fr: '{m} min' },
  bannerBearbeiten: { de: 'Banner „{text}“ bearbeiten', en: 'Edit banner "{text}"', fr: 'Modifier le bandeau « {text} »' },
  bannerLoeschen: { de: 'Banner „{text}“ löschen', en: 'Delete banner "{text}"', fr: 'Supprimer le bandeau « {text} »' },
  bannerDialogNeu: { de: 'Banner in Tag {n}', en: 'Banner in day {n}', fr: 'Bandeau du jour {n}' },
  bannerDialogBearbeiten: { de: 'Banner bearbeiten', en: 'Edit banner', fr: 'Modifier le bandeau' },
  bannerText: { de: 'Text', en: 'Text', fr: 'Texte' },
  bannerTextBeispiel: { de: 'Umzug zum Hafen', en: 'Move to the harbour', fr: 'Déplacement au port' },
  bannerDauer: { de: 'Dauer in Minuten (zählt zur Drehzeit)', en: 'Duration in minutes (counts towards shooting time)', fr: 'Durée en minutes (compte dans la durée de tournage)' },
  bannerAblageNein: { de: 'Ein Banner gehört zu einem Drehtag, nicht in die Ablage', en: 'A banner belongs to a shoot day, not to the unscheduled pool', fr: 'Un bandeau appartient à un jour de tournage, pas aux scènes non planifiées' },

  // Ablage
  ablage: { de: 'Ablage', en: 'Unscheduled', fr: 'Non planifiées' },
  ablageZahl: { de: '{n} Szenen ohne Drehtag', en: '{n} scenes without a shoot day', fr: '{n} scènes sans jour de tournage' },
  alleVerplant: { de: 'Alle Szenen verplant', en: 'All scenes scheduled', fr: 'Toutes les scènes sont planifiées' },
  sortieren: { de: 'Sortieren nach', en: 'Sort by', fr: 'Trier par' },
  sortFeld: { de: 'Sortierfeld {n}', en: 'Sort field {n}', fr: 'Critère de tri {n}' },
  sortKeins: { de: '-', en: '-', fr: '-' },
  sortMotiv: { de: 'Motiv', en: 'Location', fr: 'Lieu' },
  sortIE: { de: 'I/E', en: 'I/E', fr: 'I/E' },
  sortTN: { de: 'T/N', en: 'D/N', fr: 'J/N' },
  sortNummer: { de: 'Nummer', en: 'Number', fr: 'Numéro' },

  // Werkzeugleiste
  markiert: { de: '{n} markiert', en: '{n} selected', fr: '{n} sélectionnée(s)' },
  markierungAufheben: { de: 'Markierung aufheben', en: 'Clear selection', fr: 'Désélectionner' },
  verschiebenNach: { de: 'Verschieben nach…', en: 'Move to…', fr: 'Déplacer vers…' },
  menuTag: { de: 'Tag {n} · {datum}', en: 'Day {n} · {datum}', fr: 'Jour {n} · {datum}' },
  grenzeEinfuegen: { de: 'Tagesgrenze darunter', en: 'Day break below', fr: 'Séparation dessous' },
  grenzeEinfuegenTitel: {
    de: 'Teilt den Tag unter der markierten Szene. Was darunter steht, wird ein eigener Tag am nächsten freien Arbeitstag.',
    en: 'Splits the day below the selected scene. Everything below becomes its own day on the next free working day.',
    fr: 'Scinde le jour sous la scène sélectionnée. Ce qui suit devient un jour à part, au prochain jour ouvré libre.',
  },
  grenzeEingefuegt: { de: 'Neuer Drehtag am {datum}', en: 'New shoot day on {datum}', fr: 'Nouveau jour de tournage le {datum}' },
  einteilen: { de: 'Automatisch einteilen', en: 'Schedule automatically', fr: 'Répartir automatiquement' },
  hilfeTastatur: {
    de: 'Klick markiert, Strg-Klick schaltet um, Umschalt-Klick wählt einen Bereich. Mit der Tastatur: Leertaste markiert, Alt und Pfeil verschiebt.',
    en: 'Click selects, Ctrl-click toggles, Shift-click selects a range. Keyboard: Space selects, Alt plus arrow moves.',
    fr: 'Clic sélectionne, Ctrl-clic bascule, Maj-clic sélectionne une plage. Clavier : Espace sélectionne, Alt et flèche déplace.',
  },
  nurLesen: { de: 'Nur lesen: Umplanen dürfen Abteilungsleitung, Regie und Produktion.', en: 'Read only: heads of department, directors and producers can reschedule.', fr: 'Lecture seule : chefs de poste, réalisation et production peuvent replanifier.' },

  // Ansagen nach dem Verschieben (aria-live)
  ansageTag: { de: '{was} jetzt in Tag {n}, Stelle {stelle}', en: '{was} now in day {n}, position {stelle}', fr: '{was} maintenant au jour {n}, position {stelle}' },
  ansageAblage: { de: '{was} jetzt in der Ablage', en: '{was} now unscheduled', fr: '{was} maintenant non planifiée(s)' },
  ansageSzene: { de: 'Szene {n}', en: 'Scene {n}', fr: 'Scène {n}' },
  ansageSzenen: { de: '{n} Szenen', en: '{n} scenes', fr: '{n} scènes' },
  zieheSzenen: { de: '{n} Szenen', en: '{n} scenes', fr: '{n} scènes' },

  // Automatisch einteilen
  einteilenTitel: { de: 'Ablage automatisch einteilen', en: 'Schedule the unscheduled scenes', fr: 'Répartir les scènes non planifiées' },
  einteilenText: {
    de: 'Verteilt die {n} Szenen der Ablage in ihrer Reihenfolge auf Drehtage. Erst kommen leere vorhandene Tage dran, dann neue an den Arbeitstagen des Projekts, ohne Feiertage. Vorher sichert sich der Plan als Version.',
    en: 'Spreads the {n} unscheduled scenes across shoot days in their order. Empty existing days come first, then new ones on the project working days, without public holidays. The plan is saved as a version first.',
    fr: 'Répartit les {n} scènes non planifiées sur des jours de tournage, dans leur ordre. Les jours existants vides d’abord, puis de nouveaux aux jours ouvrés du projet, sans jours fériés. Le plan est d’abord enregistré comme version.',
  },
  nachSeiten: { de: 'höchstens Seiten je Tag', en: 'at most pages per day', fr: 'au maximum pages par jour' },
  nachMinuten: { de: 'höchstens Minuten Drehzeit je Tag', en: 'at most minutes of shooting per day', fr: 'au maximum minutes de tournage par jour' },
  grenze: { de: 'Grenze', en: 'Limit', fr: 'Limite' },
  grenzeArt: { de: 'Grenze nach', en: 'Limit by', fr: 'Limite selon' },
  start: { de: 'Ab dem', en: 'Starting', fr: 'À partir du' },
  vorschau: { de: 'Vorschau', en: 'Preview', fr: 'Aperçu' },
  ergibt: {
    de: 'ergibt {n} Drehtage vom {von} bis {bis}',
    en: 'gives {n} shoot days from {von} to {bis}',
    fr: 'donne {n} jours de tournage du {von} au {bis}',
  },
  ergibtDavon: {
    de: '{neu} neu angelegt, {gefuellt} vorhandene leere Tage gefüllt',
    en: '{neu} newly created, {gefuellt} existing empty days filled',
    fr: '{neu} créés, {gefuellt} jours vides existants remplis',
  },
  uebernehmen: { de: 'Übernehmen', en: 'Apply', fr: 'Appliquer' },
  abbrechen: { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  speichern: { de: 'Speichern', en: 'Save', fr: 'Enregistrer' },
  eingeteilt: {
    de: '{n} Drehtage eingeteilt. Den Stand von vorher hält eine Version im Drehplan fest.',
    en: '{n} shoot days scheduled. A version in the shooting schedule keeps the previous state.',
    fr: '{n} jours de tournage répartis. Une version dans le plan de tournage conserve l’état précédent.',
  },
  fehler: { de: 'Das hat nicht geklappt', en: 'That did not work', fr: 'Cela n’a pas fonctionné' },
} satisfies Record<string, Text>
