import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const aufgabenT = {
  statusOffen:    { de: 'Offen', en: 'Open', fr: 'Ouverte' },
  statusInArbeit: { de: 'In Arbeit', en: 'In progress', fr: 'En cours' },
  statusAbnahme:  { de: 'Abnahme', en: 'Client approval', fr: 'Validation client' },
  statusErledigt: { de: 'Erledigt', en: 'Done', fr: 'Terminée' },

  titel:             { de: 'Aufgaben', en: 'Tasks', fr: 'Tâches' },
  offenErledigt:     { de: '{offen} offen · {erledigt} erledigt', en: '{offen} open · {erledigt} done', fr: '{offen} ouvertes · {erledigt} terminées' },
  neuPlatzhalter:    { de: 'Neue Aufgabe - z. B. „Drehgenehmigung Stadtpark einholen“', en: 'New task - e.g. "Get the filming permit for the city park"', fr: "Nouvelle tâche - p. ex. « Obtenir l'autorisation de tournage au parc municipal »" },
  neueAufgabe:       { de: 'Neue Aufgabe', en: 'New task', fr: 'Nouvelle tâche' },
  zustaendig:        { de: 'Zuständig', en: 'Assignee', fr: 'Responsable' },
  zustaendigePerson: { de: 'Zuständige Person', en: 'Person responsible', fr: 'Personne responsable' },
  faelligAm:         { de: 'Fällig am', en: 'Due on', fr: 'Échéance le' },
  keineAufgaben:     { de: 'Noch keine Aufgaben', en: 'No tasks yet', fr: "Aucune tâche pour l'instant" },
  ersteAufgabe:      { de: 'Lege oben die erste Aufgabe für dein Team an.', en: "Create your team's first task above.", fr: 'Crée ci-dessus la première tâche de ton équipe.' },
  statusTitel:       { de: 'Status: {status} - klicken für nächsten Schritt', en: 'Status: {status} - click for the next step', fr: "Statut : {status} - clique pour passer à l'étape suivante" },
  ueberfaellig:      { de: 'überfällig', en: 'overdue', fr: 'en retard' },
  aufgabeLoeschen:   { de: 'Aufgabe löschen', en: 'Delete task', fr: 'Supprimer la tâche' },
} satisfies Record<string, Text>
