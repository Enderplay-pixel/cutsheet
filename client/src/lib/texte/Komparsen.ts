import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const komparsenT = {
  geloescht:      { de: 'Komparse gelöscht', en: 'Extra deleted', fr: 'Figurant supprimé' },
  fehlerLoeschen: { de: 'Fehler beim Löschen', en: 'Error while deleting', fr: 'Erreur lors de la suppression' },
  bearbeiten:     { de: 'Bearbeiten', en: 'Edit', fr: 'Modifier' },
  loeschen:       { de: 'Löschen', en: 'Delete', fr: 'Supprimer' },
  aktualisiert:   { de: 'Komparse aktualisiert', en: 'Extra updated', fr: 'Figurant mis à jour' },
  hinzugefuegt:   { de: 'Komparse hinzugefügt', en: 'Extra added', fr: 'Figurant ajouté' },
  fehlerSpeichern:{ de: 'Fehler beim Speichern', en: 'Error while saving', fr: "Erreur lors de l'enregistrement" },
  name:           { de: 'Name', en: 'Name', fr: 'Nom' },
  mailPlatzh:     { de: 'email@…', en: 'email@…', fr: 'e-mail@…' },
  notizenPlatzh:  { de: 'Notizen…', en: 'Notes…', fr: 'Notes…' },
  speichern:      { de: 'Speichern', en: 'Save', fr: 'Enregistrer' },
  abbrechen:      { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  titel:          { de: 'Komparsen', en: 'Extras', fr: 'Figurants' },
  eintraege:      { de: '{n} Einträge', en: '{n} entries', fr: '{n} entrées' },
  tarifgruppe:    { de: 'Tarifgruppe', en: 'Pay grade', fr: 'Catégorie tarifaire' },
  alleGruppen:    { de: 'Alle Gruppen', en: 'All grades', fr: 'Toutes les catégories' },
  sonstige:       { de: 'Sonstige', en: 'Other', fr: 'Autre' },
  hinzufuegen:    { de: 'Komparse hinzufügen', en: 'Add extra', fr: 'Ajouter un figurant' },
  telefon:        { de: 'Telefon', en: 'Phone', fr: 'Téléphone' },
  email:          { de: 'E-Mail', en: 'Email', fr: 'E-mail' },
  notizen:        { de: 'Notizen', en: 'Notes', fr: 'Notes' },
  leer:           { de: 'Keine Komparsen vorhanden. Füge den ersten hinzu.', en: 'No extras yet. Add the first one.', fr: 'Aucun figurant pour le moment. Ajoute le premier.' },
  leerGruppe:     { de: 'Keine Komparsen in Tarifgruppe {gruppe}.', en: 'No extras in pay grade {gruppe}.', fr: 'Aucun figurant dans la catégorie tarifaire {gruppe}.' },
} satisfies Record<string, Text>
