import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const auditLogT = {
  titel:          { de: 'Protokoll', en: 'Audit log', fr: "Journal d'activité" },
  lade:           { de: 'Lade…', en: 'Loading…', fr: 'Chargement…' },
  treffer:        { de: '{n} Treffer', en: '{n} matches', fr: '{n} résultats' },
  eintraege:      { de: '{n} Einträge', en: '{n} entries', fr: '{n} entrées' },
  seit:           { de: 'seit {d}', en: 'since {d}', fr: 'depuis le {d}' },
  trefferCsv:     { de: 'Treffer als CSV', en: 'Matches as CSV', fr: 'Résultats en CSV' },
  alsCsv:         { de: 'Als CSV', en: 'As CSV', fr: 'En CSV' },
  volltext:       { de: 'Volltext', en: 'Full text', fr: 'Texte intégral' },
  volltextPlatz:  { de: 'Name, Aktion, Inhalt…', en: 'Name, action, content…', fr: 'Nom, action, contenu…' },
  benutzer:       { de: 'Benutzer', en: 'User', fr: 'Utilisateur' },
  alle:           { de: 'alle', en: 'all', fr: 'tous' },
  aktion:         { de: 'Aktion', en: 'Action', fr: 'Action' },
  bereich:        { de: 'Bereich', en: 'Area', fr: 'Domaine' },
  von:            { de: 'Von', en: 'From', fr: 'Du' },
  bis:            { de: 'Bis', en: 'To', fr: 'Au' },
  suchen:         { de: 'Suchen', en: 'Search', fr: 'Rechercher' },
  filterLoeschen: { de: 'Filter löschen', en: 'Clear filters', fr: 'Effacer les filtres' },
  zeitzone:       { de: 'Tage werden in deutscher Zeit abgegrenzt', en: 'Days are delimited in German time', fr: "Les jours sont délimités selon l'heure allemande" },
  zeitpunkt:      { de: 'Zeitpunkt', en: 'Time', fr: 'Horodatage' },
  details:        { de: 'Details', en: 'Details', fr: 'Détails' },
  keineTreffer:   {
    de: 'Keine Einträge zu dieser Suche. Weniger Filter setzen oder den Zeitraum weiten.',
    en: 'No entries for this search. Set fewer filters or widen the time range.',
    fr: 'Aucune entrée pour cette recherche. Utilise moins de filtres ou élargis la période.',
  },
  leer:           {
    de: 'Noch keine Einträge. Hier erscheint jede Änderung mit Zeitpunkt und Benutzer.',
    en: 'No entries yet. Every change appears here with its time and user.',
    fr: 'Aucune entrée pour le moment. Chaque modification apparaît ici avec son horodatage et son utilisateur.',
  },
  bereichVon:     { de: '{a}-{b} von {n}', en: '{a}-{b} of {n}', fr: '{a}-{b} sur {n}' },
  zurueck:        { de: 'Zurück', en: 'Previous', fr: 'Précédent' },
  weiter:         { de: 'Weiter', en: 'Next', fr: 'Suivant' },
} satisfies Record<string, Text>
