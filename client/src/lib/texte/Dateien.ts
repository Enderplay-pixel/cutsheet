import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const dateienT = {
  geloescht:       { de: 'Gelöscht', en: 'Deleted', fr: 'Supprimé' },
  nichtGeloescht:  { de: 'Nicht gelöscht', en: 'Not deleted', fr: 'Non supprimé' },
  titel:           { de: 'Ablage', en: 'Files', fr: 'Documents' },
  untertitel:      { de: 'Genehmigungen, Nachweise, Verträge und Belege', en: 'Permits, certificates, contracts and receipts', fr: 'Autorisations, attestations, contrats et justificatifs' },
  hinweis:         {
    de: 'Die Dateien liegen in der Datenbank, nicht auf der Platte des Servers - dort überleben sie keinen Deploy. Bilder und PDF bis 20 MB.',
    en: "The files are stored in the database, not on the server's disk - they would not survive a deploy there. Images and PDFs up to 20 MB.",
    fr: "Les fichiers sont stockés dans la base de données, pas sur le disque du serveur - ils n'y survivraient pas à un déploiement. Images et PDF jusqu'à 20 Mo.",
  },
  datei:           { de: 'Datei', en: 'File', fr: 'Fichier' },
  dateien:         { de: 'Dateien', en: 'files', fr: 'fichiers' },
  dateiEinzahl:    { de: 'Datei', en: 'file', fr: 'fichier' },
  hochladen:       { de: 'Hochladen', en: 'Upload', fr: 'Téléverser' },
  alle:            { de: 'Alle', en: 'All', fr: 'Tous' },
  lade:            { de: 'Lade…', en: 'Loading…', fr: 'Chargement…' },
  nichtsInArt:     { de: 'Nichts in dieser Art.', en: 'Nothing of this type.', fr: 'Rien de ce type.' },
  nochNichts:      { de: 'Noch nichts abgelegt.', en: 'Nothing filed yet.', fr: 'Rien de classé pour le moment.' },
  ablaufHinweis:   {
    de: 'Drehgenehmigungen und Versicherungsnachweise bekommen ein Ablaufdatum und melden sich dreißig Tage vorher.',
    en: 'Filming permits and insurance certificates get an expiry date and send a reminder thirty days beforehand.',
    fr: "Les autorisations de tournage et attestations d'assurance reçoivent une date d'expiration et préviennent trente jours avant.",
  },
  art:             { de: 'Art', en: 'Type', fr: 'Type' },
  groesse:         { de: 'Größe', en: 'Size', fr: 'Taille' },
  gueltigBis:      { de: 'Gültig bis', en: 'Valid until', fr: "Valable jusqu'au" },
  gehoertZu:       { de: 'gehört zu {typ} #{id}', en: 'belongs to {typ} #{id}', fr: 'appartient à {typ} #{id}' },
  ansehen:         { de: '{name} ansehen', en: 'View {name}', fr: 'Afficher {name}' },
  herunterladen:   { de: '{name} herunterladen', en: 'Download {name}', fr: 'Télécharger {name}' },
  aendern:         { de: 'Ändern', en: 'Edit', fr: 'Modifier' },
  loeschenAria:    { de: '{name} löschen', en: 'Delete {name}', fr: 'Supprimer {name}' },
  gespeichert:     { de: 'Gespeichert', en: 'Saved', fr: 'Enregistré' },
  nichtGespeichert:{ de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
  dateiAblegen:    { de: 'Datei ablegen', en: 'File document', fr: 'Classer un fichier' },
  dateiBleibt:     {
    de: 'Die Datei selbst bleibt, wie sie ist - nur die Angaben ändern sich.',
    en: 'The file itself stays as it is - only the details change.',
    fr: 'Le fichier lui-même reste inchangé - seules les informations changent.',
  },
  bezeichnung:     { de: 'Bezeichnung', en: 'Title', fr: 'Intitulé' },
  bezeichnungPlatz:{ de: 'freiwillig - sonst steht der Dateiname da', en: 'optional - otherwise the file name is shown', fr: 'facultatif - sinon le nom du fichier est affiché' },
  fristHinweis:    {
    de: 'Meldet sich dreißig Tage vorher. Eine Genehmigung zu verlängern dauert.',
    en: 'Sends a reminder thirty days beforehand. Renewing a permit takes time.',
    fr: 'Prévient trente jours avant. Renouveler une autorisation prend du temps.',
  },
  notizen:         { de: 'Notizen', en: 'Notes', fr: 'Notes' },
  abbrechen:       { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  speichern:       { de: 'Speichern', en: 'Save', fr: 'Enregistrer' },
} satisfies Record<string, Text>

/** Beschriftung des Fristzustands; die Schlüssel kommen vom Server. */
export const FRIST_TEXT: Record<string, Text> = {
  gueltig:    { de: 'gültig', en: 'valid', fr: 'valide' },
  laeuft_ab:  { de: 'läuft ab', en: 'expiring', fr: 'expire bientôt' },
  abgelaufen: { de: 'abgelaufen', en: 'expired', fr: 'expiré' },
}
