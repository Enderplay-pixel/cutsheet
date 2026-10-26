import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const cateringListeT = {
  // Beschriftungen der Ernährungsformen in der Auswahl (der Wert geht so an den Server)
  keine:          { de: 'Keine', en: 'None', fr: 'Aucune' },
  vegetarisch:    { de: 'Vegetarisch', en: 'Vegetarian', fr: 'Végétarien' },
  vegan:          { de: 'Vegan', en: 'Vegan', fr: 'Végan' },
  glutenfrei:     { de: 'Glutenfrei', en: 'Gluten-free', fr: 'Sans gluten' },
  laktosefrei:    { de: 'Laktosefrei', en: 'Lactose-free', fr: 'Sans lactose' },
  halal:          { de: 'Halal', en: 'Halal', fr: 'Halal' },
  koscher:        { de: 'Koscher', en: 'Kosher', fr: 'Casher' },
  // dieselben klein, wie sie in der Tagesliste stehen
  kVegetarisch:   { de: 'vegetarisch', en: 'vegetarian', fr: 'végétarien' },
  kVegan:         { de: 'vegan', en: 'vegan', fr: 'végan' },
  kGlutenfrei:    { de: 'glutenfrei', en: 'gluten-free', fr: 'sans gluten' },
  kLaktosefrei:   { de: 'laktosefrei', en: 'lactose-free', fr: 'sans lactose' },
  kHalal:         { de: 'halal', en: 'halal', fr: 'halal' },
  kKoscher:       { de: 'koscher', en: 'kosher', fr: 'casher' },

  fehlerSpeichern:{ de: 'Fehler beim Speichern', en: 'Error while saving', fr: "Erreur lors de l'enregistrement" },
  darsteller:     { de: 'Darsteller', en: 'Actor', fr: 'Comédien(ne)' },
  crew:           { de: 'Crew', en: 'Crew', fr: 'Équipe' },
  komparse:       { de: 'Komparserie', en: 'Background', fr: 'Figuration' },
  allergienPh:    { de: 'Allergien…', en: 'Allergies…', fr: 'Allergies…' },
  notizenPh:      { de: 'Notizen…', en: 'Notes…', fr: 'Notes…' },
  titel:          { de: 'Catering', en: 'Catering', fr: 'Restauration' },
  untertitel:     { de: 'Ernährungspräferenzen und Tageslisten verwalten', en: 'Manage dietary preferences and daily lists', fr: 'Gérer les préférences alimentaires et les listes journalières' },
  personen:       { de: 'Personen', en: 'People', fr: 'Personnes' },
  praeferenzen:   { de: 'Präferenzen', en: 'Preferences', fr: 'Préférences' },
  tagesliste:     { de: 'Tagesliste', en: 'Daily list', fr: 'Liste du jour' },
  allePersonen:   { de: 'Alle Personen', en: 'Everyone', fr: 'Toutes les personnes' },
  keinePersonen:  { de: 'Keine Personen gefunden.', en: 'No people found.', fr: 'Aucune personne trouvée.' },
  name:           { de: 'Name', en: 'Name', fr: 'Nom' },
  typ:            { de: 'Typ', en: 'Type', fr: 'Type' },
  diaet:          { de: 'Diät', en: 'Diet', fr: 'Régime' },
  allergien:      { de: 'Allergien', en: 'Allergies', fr: 'Allergies' },
  notizen:        { de: 'Notizen', en: 'Notes', fr: 'Notes' },
  drehtagWaehlen: { de: 'Drehtag auswählen', en: 'Select shoot day', fr: 'Choisir le jour de tournage' },
  drehtagWaehlenPh:{ de: 'Drehtag auswählen…', en: 'Select shoot day…', fr: 'Choisir le jour de tournage…' },
  dtOption:       { de: 'DT {n} - {datum}', en: 'Day {n} - {datum}', fr: 'Jour {n} - {datum}' },
  pdfExportieren: { de: 'PDF exportieren', en: 'Export PDF', fr: 'Exporter en PDF' },
  bitteDrehtag:   { de: 'Bitte einen Drehtag auswählen.', en: 'Please select a shoot day.', fr: 'Choisis un jour de tournage.' },
  diaetSumme:     { de: 'Ernährungsübersicht', en: 'Dietary overview', fr: 'Aperçu des régimes' },
  keinePersonenTag:{ de: 'Keine Personen für diesen Drehtag.', en: 'No people for this shoot day.', fr: 'Aucune personne pour ce jour de tournage.' },
  anzahlPersonen: { de: '{n} Personen', en: '{n} people', fr: '{n} personnes' },
} satisfies Record<string, Text>
