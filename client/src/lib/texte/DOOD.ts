import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const doodT = {
  arbeit:             { de: 'Arbeit', en: 'Work', fr: 'Travail' },
  haltetag:           { de: 'Haltetag', en: 'Hold day', fr: 'Jour de réserve' },
  ersterArbeitstag:   { de: 'Erster Arbeitstag', en: 'First work day', fr: 'Premier jour de travail' },
  letzterArbeitstag:  { de: 'Letzter Arbeitstag', en: 'Last work day', fr: 'Dernier jour de travail' },
  einzigerArbeitstag: { de: 'Einziger Arbeitstag', en: 'Only work day', fr: 'Unique jour de travail' },
  name:               { de: 'Name', en: 'Name', fr: 'Nom' },
  figur:              { de: 'Figur', en: 'Character', fr: 'Personnage' },
  dt:                 { de: 'DT{n}', en: 'D{n}', fr: 'J{n}' },
  arbeitstage:        { de: 'Arbeitstage', en: 'Work days', fr: 'Jours de travail' },
  haltetage:          { de: 'Haltetage', en: 'Hold days', fr: 'Jours de réserve' },
  kosten:             { de: 'Kosten (geschätzt)', en: 'Cost (est.)', fr: 'Coût (estimé)' },
  dateiname:          { de: 'dood-projekt-{n}.csv', en: 'dood-project-{n}.csv', fr: 'dood-projet-{n}.csv' },
  fehlerLaden:        { de: 'Fehler beim Laden', en: 'Error while loading', fr: 'Erreur lors du chargement' },
  nichtBesetzt:       { de: 'Noch nicht besetzt', en: 'Not cast yet', fr: 'Pas encore distribué' },
  titel:              { de: 'Day Out of Days', en: 'Day Out of Days', fr: 'Day Out of Days' },
  fehlerBericht:      { de: 'Fehler beim Laden des Berichts.', en: 'Error loading the report.', fr: 'Erreur lors du chargement du rapport.' },
  untertitel:         { de: 'Übersicht der Drehtage nach Darsteller', en: 'Shoot days by actor', fr: 'Aperçu des jours de tournage par comédien' },
  darsteller:         { de: 'Darsteller', en: 'Actors', fr: 'Comédiens' },
  drehtage:           { de: 'Drehtage', en: 'Shoot days', fr: 'Jours de tournage' },
  csvExportieren:     { de: 'CSV exportieren', en: 'Export CSV', fr: 'Exporter en CSV' },
  legende:            { de: 'Legende', en: 'Legend', fr: 'Légende' },
  keineDarsteller:    { de: 'Keine Darsteller gefunden.', en: 'No actors found.', fr: 'Aucun comédien trouvé.' },
  zusammenfassung:    { de: 'Zusammenfassung', en: 'Summary', fr: 'Récapitulatif' },
  gesamt:             { de: 'Gesamt', en: 'Total', fr: 'Total' },
} satisfies Record<string, Text>
