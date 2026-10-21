import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const vfxT = {
  aktualisiert:    { de: 'VFX-Shot aktualisiert', en: 'VFX shot updated', fr: 'Plan VFX mis à jour' },
  hinzugefuegt:    { de: 'VFX-Shot hinzugefügt', en: 'VFX shot added', fr: 'Plan VFX ajouté' },
  geloescht:       { de: 'VFX-Shot gelöscht', en: 'VFX shot deleted', fr: 'Plan VFX supprimé' },
  fehlerSpeichern: { de: 'Fehler beim Speichern', en: 'Error while saving', fr: "Erreur lors de l'enregistrement" },
  fehlerLoeschen:  { de: 'Fehler beim Löschen', en: 'Error while deleting', fr: 'Erreur lors de la suppression' },
  shotPlatzh:      { de: 'VFX-001', en: 'VFX-001', fr: 'VFX-001' },
  szenePlatzh:     { de: 'Szene #', en: 'Scene #', fr: 'Scène n°' },
  beschreibung:    { de: 'Beschreibung', en: 'Description', fr: 'Description' },
  statusAria:      { de: 'Status der Einstellung', en: 'Shot status', fr: 'Statut du plan' },
  aufwand:         { de: 'Aufwand', en: 'Effort', fr: 'Charge de travail' },
  artist:          { de: 'Artist', en: 'Artist', fr: 'Artiste' },
  notizen:         { de: 'Notizen', en: 'Notes', fr: 'Notes' },
  speichern:       { de: 'Speichern', en: 'Save', fr: 'Enregistrer' },
  abbrechen:       { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  bearbeiten:      { de: 'Bearbeiten', en: 'Edit', fr: 'Modifier' },
  loeschen:        { de: 'Löschen', en: 'Delete', fr: 'Supprimer' },
  szeneN:          { de: 'Szene {n}', en: 'Scene {n}', fr: 'Scène {n}' },
  titel:           { de: 'VFX-Tracking', en: 'VFX tracking', fr: 'Suivi VFX' },
  insgesamt:       { de: '{n} VFX-Shots insgesamt', en: '{n} VFX shots in total', fr: '{n} plans VFX au total' },
  neu:             { de: 'Neuer VFX-Shot', en: 'New VFX shot', fr: 'Nouveau plan VFX' },
  gesamt:          { de: 'Gesamt', en: 'Total', fr: 'Total' },
  inArbeit:        { de: 'In Arbeit', en: 'In progress', fr: 'En cours' },
  inReview:        { de: 'In Review', en: 'In review', fr: 'En révision' },
  finalisiert:     { de: 'Finalisiert', en: 'Finalised', fr: 'Finalisé' },
  spalteShot:      { de: 'Shot', en: 'Shot', fr: 'Plan' },
  spalteSzene:     { de: 'Szene', en: 'Scene', fr: 'Scène' },
  spalteTyp:       { de: 'Typ', en: 'Type', fr: 'Type' },
  spalteStatus:    { de: 'Status', en: 'Status', fr: 'Statut' },
  spalteKomplex:   { de: 'Komplexität', en: 'Complexity', fr: 'Complexité' },
  spalteDeadline:  { de: 'Deadline', en: 'Deadline', fr: 'Échéance' },
  leerStatus:      { de: 'Keine VFX-Shots mit Status "{status}"', en: 'No VFX shots with status "{status}"', fr: 'Aucun plan VFX avec le statut « {status} »' },
  leer:            { de: 'Noch keine VFX-Shots erfasst', en: 'No VFX shots recorded yet', fr: 'Aucun plan VFX saisi pour le moment' },
} satisfies Record<string, Text>

/** Beschriftungen der gespeicherten Werte - die Werte selbst bleiben deutsch. */
export const vfxTypT: Record<string, Text> = {
  'Compositing':     { de: 'Compositing', en: 'Compositing', fr: 'Compositing' },
  'CGI':             { de: 'CGI', en: 'CGI', fr: 'CGI' },
  'Rotoscoping':     { de: 'Rotoscoping', en: 'Rotoscoping', fr: 'Rotoscopie' },
  'Color Grading':   { de: 'Color Grading', en: 'Colour grading', fr: 'Étalonnage' },
  'Motion Graphics': { de: 'Motion Graphics', en: 'Motion graphics', fr: 'Motion design' },
  'De-aging':        { de: 'De-aging', en: 'De-ageing', fr: 'Rajeunissement numérique' },
  'Environment':     { de: 'Environment', en: 'Environment', fr: 'Environnement' },
  'Sonstiges':       { de: 'Sonstiges', en: 'Other', fr: 'Autre' },
}

export const vfxStatusT: Record<string, Text> = {
  'Alle':        { de: 'Alle', en: 'All', fr: 'Tous' },
  'Offen':       { de: 'Offen', en: 'Open', fr: 'À faire' },
  'In Arbeit':   { de: 'In Arbeit', en: 'In progress', fr: 'En cours' },
  'Review':      { de: 'Review', en: 'Review', fr: 'Révision' },
  'Finalisiert': { de: 'Finalisiert', en: 'Finalised', fr: 'Finalisé' },
  'Abgelehnt':   { de: 'Abgelehnt', en: 'Rejected', fr: 'Refusé' },
}

export const vfxAufwandT: Record<string, Text> = {
  'Niedrig':   { de: 'Niedrig', en: 'Low', fr: 'Faible' },
  'Mittel':    { de: 'Mittel', en: 'Medium', fr: 'Moyenne' },
  'Hoch':      { de: 'Hoch', en: 'High', fr: 'Élevée' },
  'Sehr hoch': { de: 'Sehr hoch', en: 'Very high', fr: 'Très élevée' },
}
