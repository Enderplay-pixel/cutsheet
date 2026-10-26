import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const szenenKommentareT = {
  geradeEben:     { de: 'gerade eben', en: 'just now', fr: "à l'instant" },
  vorMin:         { de: 'vor {n} Min.', en: '{n} min ago', fr: 'il y a {n} min' },
  vorStd:         { de: 'vor {n} Std.', en: '{n} h ago', fr: 'il y a {n} h' },
  vorTagen:       { de: 'vor {n} Tagen', en: '{n} days ago', fr: 'il y a {n} jours' },
  unbekannt:      { de: 'Unbekannt', en: 'Unknown', fr: 'Inconnu' },
  geloest:        { de: 'Gelöst', en: 'Resolved', fr: 'Résolu' },
  alsGeloest:     { de: 'Als gelöst markieren', en: 'Mark as resolved', fr: 'Marquer comme résolu' },
  loeschen:       { de: 'Kommentar löschen', en: 'Delete comment', fr: 'Supprimer le commentaire' },
  titel:          { de: 'Szenen-Kommentare', en: 'Scene comments', fr: 'Commentaires de scène' },
  untertitel:     { de: 'Projektweite Übersicht aller Kommentare', en: 'Project-wide overview of all comments', fr: "Vue d'ensemble de tous les commentaires du projet" },
  ungeloest:      { de: 'Ungelöst', en: 'Unresolved', fr: 'Non résolus' },
  szenen:         { de: 'Szenen', en: 'Scenes', fr: 'Scènes' },
  gesamt:         { de: '{n} gesamt', en: '{n} in total', fr: '{n} au total' },
  szeneN:         { de: 'Szene {n}', en: 'Scene {n}', fr: 'Scène {n}' },
  keineSzenen:    { de: 'Keine Szenen', en: 'No scenes', fr: 'Aucune scène' },
  auswaehlen:     { de: 'Szene auswählen, um Kommentare anzuzeigen', en: 'Select a scene to view comments', fr: 'Sélectionne une scène pour afficher les commentaires' },
  offenN:         { de: '{n} offen', en: '{n} open', fr: '{n} ouvert(s)' },
  keineKommentare:{ de: 'Noch keine Kommentare für diese Szene', en: 'No comments for this scene yet', fr: 'Aucun commentaire pour cette scène' },
  offenListe:     { de: 'Offen ({n})', en: 'Open ({n})', fr: 'Ouverts ({n})' },
  geloestListe:   { de: 'Gelöst ({n})', en: 'Resolved ({n})', fr: 'Résolus ({n})' },
  neuerKommentar: { de: 'Neuer Kommentar', en: 'New comment', fr: 'Nouveau commentaire' },
  schreiben:      { de: 'Kommentar schreiben…', en: 'Write a comment…', fr: 'Écrire un commentaire…' },
  hinzufuegen:    { de: 'Kommentar hinzufügen', en: 'Add comment', fr: 'Ajouter un commentaire' },
} satisfies Record<string, Text>
