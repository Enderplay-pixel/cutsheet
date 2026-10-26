import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const listenT = {
  titel: { de: 'Listen', en: 'Lists', fr: 'Listes' },
  untertitel: {
    de: 'Tabellen aus Excel einlesen und Listen ausgeben',
    en: 'Import spreadsheets from Excel and export lists',
    fr: 'Importer des tableaux depuis Excel et exporter des listes',
  },
  // Beschriftungen der Listenarten - die Werte (crew, cast ...) gehen an den Server
  stab: { de: 'Stab', en: 'Crew', fr: 'Équipe' },
  besetzung: { de: 'Besetzung', en: 'Cast', fr: 'Casting' },
  komparserie: { de: 'Komparserie', en: 'Extras', fr: 'Figurants' },
  szenen: { de: 'Szenen', en: 'Scenes', fr: 'Scènes' },
  drehplan: { de: 'Drehplan', en: 'Shooting schedule', fr: 'Plan de tournage' },
  // Was mit einer Zeile passiert
  neu: { de: 'neu', en: 'new', fr: 'nouveau' },
  ergaenzt: { de: 'ergänzt', en: 'updated', fr: 'complété' },
  uebersprungen: { de: 'übersprungen', en: 'skipped', fr: 'ignoré' },

  nichtLesbar: { de: 'Die Datei ließ sich nicht lesen', en: 'The file could not be read', fr: "Le fichier n'a pas pu être lu" },
  angelegtErgaenzt: { de: '{neu} angelegt, {ergaenzt} ergänzt', en: '{neu} created, {ergaenzt} updated', fr: '{neu} créé(s), {ergaenzt} complété(s)' },
  zeilenUebersprungen: { de: '{n} Zeilen übersprungen.', en: '{n} rows skipped.', fr: '{n} lignes ignorées.' },
  nichtUebernommen: { de: 'Nicht übernommen', en: 'Not imported', fr: 'Non importé' },
  einlesen: { de: 'Einlesen', en: 'Import', fr: 'Importer' },
  ausgeben: { de: 'Ausgeben', en: 'Export', fr: 'Exporter' },
  datei: { de: 'Datei', en: 'File', fr: 'Fichier' },
  wasEingelesen: { de: 'Was wird eingelesen', en: 'What is being imported', fr: 'Que faut-il importer' },
  vorlageHerunterladen: { de: 'Vorlage herunterladen', en: 'Download template', fr: 'Télécharger le modèle' },
  csvWaehlen: { de: 'CSV-Datei wählen', en: 'Choose CSV file', fr: 'Choisir un fichier CSV' },
  ausExcel: {
    de: 'Aus Excel: Datei - Speichern unter - CSV. Semikolon, Umlaute und Beträge mit Komma werden erkannt.',
    en: 'From Excel: File - Save As - CSV. Semicolons, umlauts and amounts with a decimal comma are recognised.',
    fr: 'Depuis Excel : Fichier - Enregistrer sous - CSV. Les points-virgules, les accents et les montants avec virgule sont reconnus.',
  },
  inhaltEinfuegen: { de: 'oder Inhalt einfügen', en: 'or paste the content', fr: 'ou coller le contenu' },
  vorschau: { de: 'Vorschau', en: 'Preview', fr: 'Aperçu' },
  uebernehmen: { de: '{n} übernehmen', en: 'Import {n}', fr: 'Importer {n}' },
  anzahlNeu: { de: '{n} neu', en: '{n} new', fr: '{n} nouveau(x)' },
  anzahlErgaenzt: { de: '{n} ergänzt', en: '{n} updated', fr: '{n} complété(s)' },
  anzahlUebersprungen: { de: '{n} übersprungen', en: '{n} skipped', fr: '{n} ignoré(s)' },
  nichtsGespeichert: {
    de: 'Nichts ist gespeichert. Erst „“ schreibt - und dann entweder alles oder nichts.',
    en: 'Nothing has been saved yet. Only "Import" writes - and then either everything or nothing.',
    fr: "Rien n'est encore enregistré. Seul « Importer » écrit - et alors tout ou rien.",
  },
  zeile: { de: 'Z{n}', en: 'R{n}', fr: 'L{n}' },
  ohneNamen: { de: 'ohne Namen', en: 'no name', fr: 'sans nom' },
  alsCsv: { de: 'Als CSV ausgeben', en: 'Export as CSV', fr: 'Exporter en CSV' },
  oeffnetSich: {
    de: 'Öffnet sich in Excel, Numbers und LibreOffice. Semikolon getrennt, Beträge mit Komma.',
    en: 'Opens in Excel, Numbers and LibreOffice. Semicolon-separated, amounts with a decimal comma.',
    fr: 'Compatible avec Excel, Numbers et LibreOffice. Séparateur point-virgule, montants avec virgule.',
  },
} satisfies Record<string, Text>
