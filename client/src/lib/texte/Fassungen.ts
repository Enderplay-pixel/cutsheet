import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Drehbuch-Fassungen mit gesperrten Nummern (Plan Kino-Ausbau, AP A3). */
export const fassungT = {
  sperren: { de: 'Drehbuch sperren', en: 'Lock script', fr: 'Verrouiller le scénario' },
  sperrenFrage: {
    de: 'Drehbuch sperren? Ab dann bleiben alle Szenennummern, eine neue Szene bekommt eine Buchstabennummer (13A), und Löschen heißt "entfällt". Der jetzige Stand wird als weiße Fassung gesichert.',
    en: 'Lock the script? From then on all scene numbers stay, a new scene gets a letter number (13A), and deleting means "omitted". The current state is saved as the white revision.',
    fr: 'Verrouiller le scénario ? Ensuite tous les numéros de scène restent, une nouvelle scène reçoit un numéro avec lettre (13A) et supprimer signifie « supprimée ». L’état actuel est enregistré comme version blanche.',
  },
  entsperren: { de: 'Entsperren', en: 'Unlock', fr: 'Déverrouiller' },
  entsperrenFrage: {
    de: 'Drehbuch entsperren? Nummern lassen sich dann wieder ändern - Dispo, Shotlist und Kontinuität am Set arbeiten aber mit den bisherigen.',
    en: 'Unlock the script? Numbers can then be changed again - but call sheets, shot lists and continuity on set work with the current ones.',
    fr: 'Déverrouiller le scénario ? Les numéros pourront à nouveau changer - mais feuilles de service, listes de plans et continuité utilisent les numéros actuels.',
  },
  gesperrtSeit: { de: 'Gesperrt seit {datum}', en: 'Locked since {datum}', fr: 'Verrouillé depuis le {datum}' },
  gesperrtTitel: {
    de: 'Szenennummern bleiben, neue Szenen bekommen einen Buchstaben, Löschen heißt "entfällt".',
    en: 'Scene numbers stay, new scenes get a letter, deleting means "omitted".',
    fr: 'Les numéros restent, les nouvelles scènes reçoivent une lettre, supprimer signifie « supprimée ».',
  },
  wurdeGesperrt: { de: 'Drehbuch gesperrt', en: 'Script locked', fr: 'Scénario verrouillé' },
  wurdeEntsperrt: { de: 'Drehbuch entsperrt', en: 'Script unlocked', fr: 'Scénario déverrouillé' },

  fassungen: { de: 'Fassungen', en: 'Revisions', fr: 'Versions' },
  fassungenTitel: { de: 'Fassungen des Drehbuchs', en: 'Script revisions', fr: 'Versions du scénario' },
  keineFassungen: {
    de: 'Noch keine Fassung. Die erste entsteht beim Sperren oder beim Einlesen einer neuen Fassung.',
    en: 'No revision yet. The first is created when locking or importing a new revision.',
    fr: 'Pas encore de version. La première est créée au verrouillage ou à l’import d’une nouvelle version.',
  },
  fassungNr: { de: 'Fassung {n}', en: 'Revision {n}', fr: 'Version {n}' },
  runde: { de: '{n}. Runde', en: 'round {n}', fr: '{n}e tour' },
  unveraendert: { de: 'unverändert', en: 'unchanged', fr: 'inchangées' },
  geaendert: { de: 'geändert', en: 'changed', fr: 'modifiées' },
  neu: { de: 'neu', en: 'new', fr: 'nouvelles' },
  fehlt: { de: 'fehlt', en: 'missing', fr: 'manquantes' },
  entfaelltZahl: { de: 'entfällt', en: 'omitted', fr: 'supprimées' },
  szeneAnsehen: { de: 'Szene {n}: alt gegen neu zeigen', en: 'Scene {n}: show old against new', fr: 'Scène {n} : comparer ancien et nouveau' },
  vergleichTitel: { de: 'Szene {n}: alt gegen neu', en: 'Scene {n}: old against new', fr: 'Scène {n} : ancien contre nouveau' },
  zeileWeg: { de: 'entfernt', en: 'removed', fr: 'retiré' },
  zeileNeu: { de: 'neu', en: 'new', fr: 'nouveau' },
  zurueck: { de: 'Zurück', en: 'Back', fr: 'Retour' },
  schliessen: { de: 'Schließen', en: 'Close', fr: 'Fermer' },

  importTitel: { de: 'Drehbuch einlesen', en: 'Import script', fr: 'Importer le scénario' },
  importText: {
    de: 'Das Projekt hat schon {n} Szenen. Wie soll „{datei}“ dazukommen?',
    en: 'The project already has {n} scenes. How should "{datei}" be added?',
    fr: 'Le projet a déjà {n} scènes. Comment ajouter « {datei} » ?',
  },
  alsFassung: { de: 'Als neue Fassung', en: 'As a new revision', fr: 'Comme nouvelle version' },
  alsFassungText: {
    de: 'Vergleicht die Datei mit dem Drehbuch. Geänderte Szenen bleiben an ihrem Drehtag, neue kommen hinter ihre Vorgängerin.',
    en: 'Compares the file with the script. Changed scenes stay on their shoot day, new ones follow their predecessor.',
    fr: 'Compare le fichier au scénario. Les scènes modifiées restent à leur jour, les nouvelles suivent leur précédente.',
  },
  anhaengen: { de: 'Anhängen', en: 'Append', fr: 'Ajouter à la fin' },
  anhaengenText: {
    de: 'Hängt alle Szenen der Datei hinten an - Szenen, die schon da sind, gibt es danach doppelt.',
    en: 'Appends all scenes of the file - scenes already here will exist twice.',
    fr: 'Ajoute toutes les scènes du fichier à la fin - celles déjà présentes existeront en double.',
  },
  abbrechen: { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  vergleicht: { de: 'Vergleiche…', en: 'Comparing…', fr: 'Comparaison…' },
  vorschauTitel: { de: 'Was die neue Fassung ändert', en: 'What the new revision changes', fr: 'Ce que change la nouvelle version' },
  farbe: { de: 'Farbe der Fassung', en: 'Revision colour', fr: 'Couleur de la version' },
  uebernehmen: { de: 'Übernehmen', en: 'Apply', fr: 'Appliquer' },
  nichts: {
    de: 'Nichts zu übernehmen: Die Datei entspricht dem Drehbuch.',
    en: 'Nothing to apply: the file matches the script.',
    fr: 'Rien à appliquer : le fichier correspond au scénario.',
  },
  fehltOffen: {
    de: 'Fehlende Szenen bleiben stehen, solange das Drehbuch nicht gesperrt ist. Löschen oder behalten entscheidest du in der Szenenübersicht.',
    en: 'Missing scenes stay while the script is not locked. You decide in the scene overview whether to delete or keep them.',
    fr: 'Les scènes manquantes restent tant que le scénario n’est pas verrouillé. Tu décides dans la vue des scènes de les supprimer ou non.',
  },
  fehltGesperrt: {
    de: 'Fehlende Szenen entfallen: Sie behalten ihre Nummer und kommen aus dem Drehplan.',
    en: 'Missing scenes are omitted: they keep their number and leave the schedule.',
    fr: 'Les scènes manquantes sont supprimées : elles gardent leur numéro et quittent le plan.',
  },
  uebernommen: {
    de: 'Fassung {nr} übernommen: {g} geändert, {neu} neu, {e} entfällt',
    en: 'Revision {nr} applied: {g} changed, {neu} new, {e} omitted',
    fr: 'Version {nr} appliquée : {g} modifiées, {neu} nouvelles, {e} supprimées',
  },
  sternTitel: { de: 'Geändert in der aktuellen Fassung', en: 'Changed in the current revision', fr: 'Modifié dans la version actuelle' },

  entfaellt: { de: 'ENTFÄLLT', en: 'OMITTED', fr: 'SUPPRIMÉE' },
  zurueckholen: { de: 'Zurückholen', en: 'Restore', fr: 'Rétablir' },
  zurueckholenName: { de: 'Szene {n} zurückholen', en: 'Restore scene {n}', fr: 'Rétablir la scène {n}' },
  entfallenLassen: { de: 'Szene {n} entfallen lassen', en: 'Omit scene {n}', fr: 'Supprimer la scène {n} (numéro conservé)' },
  nummerGesperrt: { de: 'Das Drehbuch ist gesperrt - die Nummer bleibt.', en: 'The script is locked - the number stays.', fr: 'Le scénario est verrouillé - le numéro reste.' },
  filterEntfaellt: { de: 'Entfällt', en: 'Omitted', fr: 'Supprimées' },
} satisfies Record<string, Text>

/** Farben der Fassungen nach der Folge der Branche - Schlüssel wie im Server (`lib/fassungen.ts`). */
export const FARBE: Record<string, { name: Text; hex: string }> = {
  weiss: { name: { de: 'Weiß', en: 'White', fr: 'Blanc' }, hex: '#ffffff' },
  blau: { name: { de: 'Blau', en: 'Blue', fr: 'Bleu' }, hex: '#9ec5fe' },
  rosa: { name: { de: 'Rosa', en: 'Pink', fr: 'Rose' }, hex: '#f9c6d9' },
  gelb: { name: { de: 'Gelb', en: 'Yellow', fr: 'Jaune' }, hex: '#fde68a' },
  gruen: { name: { de: 'Grün', en: 'Green', fr: 'Vert' }, hex: '#bbf7d0' },
  goldgelb: { name: { de: 'Goldgelb', en: 'Goldenrod', fr: 'Jaune d’or' }, hex: '#f6c453' },
  chamois: { name: { de: 'Chamois', en: 'Buff', fr: 'Chamois' }, hex: '#f3e5c4' },
  lachs: { name: { de: 'Lachs', en: 'Salmon', fr: 'Saumon' }, hex: '#fdba9b' },
  kirschrot: { name: { de: 'Kirschrot', en: 'Cherry', fr: 'Cerise' }, hex: '#e25563' },
}
