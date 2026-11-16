import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte zu Sets, Drehort-Angaben, Genehmigungen und Sonnenstand am Motiv (Plan Kino-Ausbau, AP C3). */
export const drehortT = {
  // Drehort
  drehort: { de: 'Drehort', en: 'Shooting location', fr: 'Lieu de tournage' },
  drehortHilfe: { de: 'Einmal eintragen, überall benutzt.', en: 'Enter once, used everywhere.', fr: 'Saisi une fois, utilisé partout.' },
  krankenhaus: { de: 'Nächstes Krankenhaus', en: 'Nearest hospital', fr: 'Hôpital le plus proche' },
  krankenhausAdresse: { de: 'Adresse des Krankenhauses', en: 'Hospital address', fr: 'Adresse de l’hôpital' },
  krankenhausTelefon: { de: 'Telefon des Krankenhauses', en: 'Hospital phone', fr: 'Téléphone de l’hôpital' },
  basecamp: { de: 'Basecamp', en: 'Base camp', fr: 'Camp de base' },
  parken: { de: 'Crew-Parken', en: 'Crew parking', fr: 'Parking équipe' },
  anfahrt: { de: 'Anfahrt', en: 'Directions', fr: 'Accès' },
  genehmigungNoetig: { de: 'Genehmigung nötig', en: 'Permit required', fr: 'Autorisation nécessaire' },
  // Sets
  sets: { de: 'Sets', en: 'Sets', fr: 'Décors' },
  setsHilfe: { de: 'Räume oder Bereiche im Motiv. Die Szenenüberschrift legt sie an: "WOHNUNG ANDI - KÜCHE" ist das Set "Küche".', en: 'Rooms or areas within the location. The scene heading creates them: "ANDI’S FLAT - KITCHEN" is the set "Kitchen".', fr: 'Pièces ou zones du lieu. L’en-tête de scène les crée : « APPART ANDI - CUISINE » est le décor « Cuisine ».' },
  keineSets: { de: 'Noch kein Set.', en: 'No set yet.', fr: 'Pas encore de décor.' },
  neuesSet: { de: 'Neues Set', en: 'New set', fr: 'Nouveau décor' },
  setName: { de: 'Name des Sets {name}', en: 'Name of set {name}', fr: 'Nom du décor {name}' },
  setNotiz: { de: 'Notiz zu {name}', en: 'Note on {name}', fr: 'Note sur {name}' },
  setLoeschen: { de: 'Set {name} löschen', en: 'Delete set {name}', fr: 'Supprimer le décor {name}' },
  setSzenen: { de: '{n} Szenen', en: '{n} scenes', fr: '{n} scènes' },
  anlegen: { de: 'Anlegen', en: 'Add', fr: 'Ajouter' },
  // Genehmigungen
  genehmigungen: { de: 'Genehmigungen', en: 'Permits', fr: 'Autorisations' },
  genehmigungenHilfe: { de: 'Ein Drehtag an diesem Motiv braucht eine Genehmigung mit Status "liegt vor", die das Datum abdeckt - sonst meldet sich der Konfliktradar.', en: 'A shoot day at this location needs a permit with status "granted" covering the date - otherwise the conflict radar reports it.', fr: 'Un jour de tournage sur ce lieu nécessite une autorisation au statut « accordée » couvrant la date - sinon le radar des conflits le signale.' },
  keineGenehmigungen: { de: 'Noch keine Genehmigung.', en: 'No permit yet.', fr: 'Pas encore d’autorisation.' },
  neueGenehmigung: { de: 'Genehmigung', en: 'Permit', fr: 'Autorisation' },
  titel: { de: 'Titel', en: 'Title', fr: 'Titre' },
  titelPh: { de: 'z. B. Sondernutzung', en: 'e.g. special use', fr: 'p. ex. occupation spéciale' },
  behoerde: { de: 'Behörde', en: 'Authority', fr: 'Autorité' },
  status: { de: 'Status', en: 'Status', fr: 'Statut' },
  gueltigVon: { de: 'Gültig von', en: 'Valid from', fr: 'Valable du' },
  gueltigBis: { de: 'Gültig bis', en: 'Valid until', fr: 'Valable jusqu’au' },
  auflagen: { de: 'Auflagen', en: 'Conditions', fr: 'Conditions' },
  datei: { de: 'Datei aus der Ablage', en: 'File from the documents', fr: 'Fichier des documents' },
  keineDatei: { de: 'keine', en: 'none', fr: 'aucun' },
  genehmigungLoeschen: { de: 'Genehmigung {name} löschen', en: 'Delete permit {name}', fr: 'Supprimer l’autorisation {name}' },
  // Sonnenstand
  sonne: { de: 'Sonnenstand', en: 'Sun', fr: 'Soleil' },
  sonneDatum: { de: 'Datum für den Sonnenstand', en: 'Date for the sun times', fr: 'Date pour le soleil' },
  aufgang: { de: 'Aufgang {zeit}', en: 'Sunrise {zeit}', fr: 'Lever {zeit}' },
  untergang: { de: 'Untergang {zeit}', en: 'Sunset {zeit}', fr: 'Coucher {zeit}' },
  goldenHour: { de: 'Golden Hour ab {zeit}', en: 'Golden hour from {zeit}', fr: 'Heure dorée dès {zeit}' },
  sonneOhneKoordinaten: { de: 'Mit Breiten- und Längengrad am Motiv stehen hier Sonnenauf- und -untergang.', en: 'With latitude and longitude at the location, sunrise and sunset appear here.', fr: 'Avec latitude et longitude du lieu, lever et coucher du soleil s’affichent ici.' },
  sonneErsterDrehtag: { de: 'vorbelegt mit dem ersten Drehtag hier', en: 'preset to the first shoot day here', fr: 'prérempli avec le premier jour de tournage ici' },
  // Liste
  vertrag: { de: 'Vertrag: {status}', en: 'Contract: {status}', fr: 'Contrat : {status}' },
  genehmigungFehlt: { de: 'Genehmigung fehlt', en: 'Permit missing', fr: 'Autorisation manquante' },
  genehmigungLiegtVor: { de: 'Genehmigung liegt vor', en: 'Permit granted', fr: 'Autorisation accordée' },
  szenenKurz: { de: '{n} Szenen', en: '{n} scenes', fr: '{n} scènes' },
  szeneEins: { de: '1 Szene', en: '1 scene', fr: '1 scène' },
  setsKurz: { de: '{n} Sets', en: '{n} sets', fr: '{n} décors' },
  setEins: { de: '1 Set', en: '1 set', fr: '1 décor' },
  fehler: { de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
} satisfies Record<string, Text>

export const GENEHMIGUNG_STATUS = ['offen', 'beantragt', 'liegt vor', 'abgelehnt'] as const
export const GENEHMIGUNG_STATUS_TEXT: Record<string, Text> = {
  offen: { de: 'offen', en: 'open', fr: 'ouverte' },
  beantragt: { de: 'beantragt', en: 'applied for', fr: 'demandée' },
  'liegt vor': { de: 'liegt vor', en: 'granted', fr: 'accordée' },
  abgelehnt: { de: 'abgelehnt', en: 'refused', fr: 'refusée' },
}
