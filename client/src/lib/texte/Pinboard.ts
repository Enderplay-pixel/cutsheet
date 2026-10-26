import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const pinboardT = {
  gelb:            { de: 'Gelb', en: 'Yellow', fr: 'Jaune' },
  pink:            { de: 'Pink', en: 'Pink', fr: 'Rose' },
  gruen:           { de: 'Grün', en: 'Green', fr: 'Vert' },
  blau:            { de: 'Blau', en: 'Blue', fr: 'Bleu' },
  fehlerSpeichern: { de: 'Fehler beim Speichern', en: 'Error while saving', fr: "Erreur lors de l'enregistrement" },
  notizGeloescht:  { de: 'Notiz gelöscht', en: 'Note deleted', fr: 'Note supprimée' },
  fehlerLoeschen:  { de: 'Fehler beim Löschen', en: 'Error while deleting', fr: 'Erreur lors de la suppression' },
  notizLoeschen:   { de: 'Notiz löschen', en: 'Delete note', fr: 'Supprimer la note' },
  notizEingeben:   { de: 'Notiz eingeben…', en: 'Enter note…', fr: 'Saisir une note…' },
  fehlerErstellen: { de: 'Fehler beim Erstellen der Notiz', en: 'Error while creating the note', fr: 'Erreur lors de la création de la note' },
  titel:           { de: 'Pinboard', en: 'Pinboard', fr: 'Tableau de notes' },
  anzahlEins:      { de: '{n} Notiz', en: '{n} note', fr: '{n} note' },
  anzahlMehr:      { de: '{n} Notizen', en: '{n} notes', fr: '{n} notes' },
  neueNotiz:       { de: 'Neue Notiz', en: 'New note', fr: 'Nouvelle note' },
  leer:            { de: 'Noch keine Notizen', en: 'No notes yet', fr: 'Pas encore de notes' },
  leerHinweis:     { de: 'Klicke auf "Neue Notiz" um zu starten', en: 'Click "New note" to get started', fr: 'Clique sur « Nouvelle note » pour commencer' },
} satisfies Record<string, Text>
