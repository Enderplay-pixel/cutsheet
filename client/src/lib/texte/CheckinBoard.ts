import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const checkinBoardT = {
  erfolgreich:      { de: 'Erfolgreich eingecheckt', en: 'Checked in successfully', fr: 'Arrivée enregistrée' },
  fehlerEinchecken: { de: 'Fehler beim Einchecken', en: 'Check-in failed', fr: "Échec de l'enregistrement de l'arrivée" },
  titel:            { de: 'Check-in Board', en: 'Check-in board', fr: 'Tableau des arrivées' },
  untertitel:       { de: 'Anwesenheit live verfolgen und bestätigen', en: 'Track and confirm attendance live', fr: 'Suivre et confirmer les présences en direct' },
  eingechecktZahl:  { de: 'Eingecheckt', en: 'Checked in', fr: 'Arrivés' },
  anwesend:         { de: '{pct}% anwesend', en: '{pct}% present', fr: '{pct} % présents' },
  vonPersonen:      { de: '{n} von {total} Personen', en: '{n} of {total} people', fr: '{n} sur {total} personnes' },
  drehtag:          { de: 'Drehtag', en: 'Shoot day', fr: 'Jour de tournage' },
  drehtagWaehlen:   { de: 'Drehtag auswählen…', en: 'Select shoot day…', fr: 'Choisir un jour de tournage…' },
  drehtagKurz:      { de: 'DT {n}', en: 'Day {n}', fr: 'Jour {n}' },
  gastlink:         { de: 'Gastlink:', en: 'Guest link:', fr: 'Lien invité :' },
  bitteDrehtag:     { de: 'Bitte einen Drehtag auswählen.', en: 'Please select a shoot day.', fr: 'Choisis un jour de tournage.' },
  keineDispo:       { de: 'Keine Tagesdispo für diesen Drehtag.', en: 'No call sheet for this shoot day.', fr: 'Aucune feuille de service pour ce jour de tournage.' },
  keineEintraege:   { de: 'Keine Einträge in dieser Tagesdispo.', en: 'No entries on this call sheet.', fr: 'Aucune entrée dans cette feuille de service.' },
  darsteller:       { de: 'Darsteller', en: 'Actor', fr: 'Comédien(ne)' },
  crew:             { de: 'Crew', en: 'Crew', fr: 'Équipe' },
  call:             { de: 'Call:', en: 'Call:', fr: 'Convocation :' },
  eingechecktUm:    { de: 'Eingecheckt um {zeit}', en: 'Checked in at {zeit}', fr: 'Arrivé(e) à {zeit}' },
  eingecheckt:      { de: 'Eingecheckt', en: 'Checked in', fr: 'Arrivé(e)' },
  ausstehend:       { de: 'Ausstehend', en: 'Pending', fr: 'En attente' },
  einchecken:       { de: 'Einchecken', en: 'Check in', fr: "Enregistrer l'arrivée" },
} satisfies Record<string, Text>
