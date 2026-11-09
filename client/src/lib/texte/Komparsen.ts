import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const komparsenT = {
  geloescht:      { de: 'Komparse gelöscht', en: 'Extra deleted', fr: 'Figurant supprimé' },
  imPapierkorb:   { de: '30 Tage lang im Papierkorb wiederherstellbar', en: 'Can be restored from the trash for 30 days', fr: 'Récupérable dans la corbeille pendant 30 jours' },
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
  drehtage:       { de: 'Drehtage', en: 'Shoot days', fr: 'Jours de tournage' },
  tagKurz:        { de: 'Tag {n}', en: 'Day {n}', fr: 'Jour {n}' },
  keineDrehtage:  { de: 'Noch keine Drehtage geplant.', en: 'No shoot days planned yet.', fr: 'Aucun jour de tournage planifié.' },
  drehtageHinweis:{ de: 'Ein Drehtag trägt den Komparsen in die Dispo dieses Tages ein - mit Call-Zeit, für Vertrag, Verpflegung, Check-in und Jugendschutz.', en: 'A shoot day adds the extra to that day’s call sheet - with call time, for contract, catering, check-in and youth protection.', fr: 'Un jour de tournage inscrit le figurant sur la feuille de service de ce jour - avec heure de convocation, pour le contrat, la restauration, le pointage et la protection des mineurs.' },
  hinzufuegen:    { de: 'Komparse hinzufügen', en: 'Add extra', fr: 'Ajouter un figurant' },
  telefon:        { de: 'Telefon', en: 'Phone', fr: 'Téléphone' },
  email:          { de: 'E-Mail', en: 'Email', fr: 'E-mail' },
  notizen:        { de: 'Notizen', en: 'Notes', fr: 'Notes' },
  leer:           { de: 'Keine Komparsen vorhanden. Füge den ersten hinzu.', en: 'No extras yet. Add the first one.', fr: 'Aucun figurant pour le moment. Ajoute le premier.' },
  leerGruppe:     { de: 'Keine Komparsen in Tarifgruppe {gruppe}.', en: 'No extras in pay grade {gruppe}.', fr: 'Aucun figurant dans la catégorie tarifaire {gruppe}.' },
} satisfies Record<string, Text>
