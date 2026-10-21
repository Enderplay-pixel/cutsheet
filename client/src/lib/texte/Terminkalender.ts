import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Beschriftungen der Termintypen. Der Wert selbst (Schlüssel) geht so an den Server. */
export const terminTypT = {
  Drehtag:       { de: 'Drehtag', en: 'Shoot day', fr: 'Jour de tournage' },
  Casting:       { de: 'Casting', en: 'Casting', fr: 'Casting' },
  Locationscout: { de: 'Locationscout', en: 'Location scout', fr: 'Repérage' },
  Probe:         { de: 'Probe', en: 'Rehearsal', fr: 'Répétition' },
  Meeting:       { de: 'Meeting', en: 'Meeting', fr: 'Réunion' },
  Sperrtag:      { de: 'Sperrtag', en: 'Blocked day', fr: 'Jour bloqué' },
  Reise:         { de: 'Reise', en: 'Travel', fr: 'Voyage' },
  Sonstiges:     { de: 'Sonstiges', en: 'Other', fr: 'Autre' },
} satisfies Record<string, Text>

export const terminkalenderT = {
  hinzugefuegt:    { de: 'Termin hinzugefügt', en: 'Appointment added', fr: 'Rendez-vous ajouté' },
  fehler:          { de: 'Fehler', en: 'Error', fr: 'Erreur' },
  neuerTermin:     { de: 'Neuer Termin', en: 'New appointment', fr: 'Nouveau rendez-vous' },
  titel:           { de: 'Titel', en: 'Title', fr: 'Titre' },
  bezeichnung:     { de: 'Terminbezeichnung', en: 'Appointment name', fr: 'Intitulé du rendez-vous' },
  datumVon:        { de: 'Datum (von)', en: 'Date (from)', fr: 'Date (début)' },
  datumBis:        { de: 'Datum (bis, optional)', en: 'Date (to, optional)', fr: 'Date (fin, facultatif)' },
  termintyp:       { de: 'Termintyp', en: 'Appointment type', fr: 'Type de rendez-vous' },
  notizen:         { de: 'Notizen', en: 'Notes', fr: 'Notes' },
  abbrechen:       { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  hinzufuegen:     { de: 'Hinzufügen', en: 'Add', fr: 'Ajouter' },
  seitenTitel:     { de: 'Terminkalender', en: 'Calendar', fr: 'Calendrier' },
  icsTitel:        { de: 'Drehtage und Termine für Google, Apple oder Outlook Kalender', en: 'Shoot days and appointments for Google, Apple or Outlook Calendar', fr: 'Jours de tournage et rendez-vous pour les agendas Google, Apple ou Outlook' },
  icsKnopf:        { de: 'Kalender (.ics)', en: 'Calendar (.ics)', fr: 'Calendrier (.ics)' },
  termin:          { de: 'Termin', en: 'Appointment', fr: 'Rendez-vous' },
  vorherigerMonat: { de: 'Vorheriger Monat', en: 'Previous month', fr: 'Mois précédent' },
  naechsterMonat:  { de: 'Nächster Monat', en: 'Next month', fr: 'Mois suivant' },
  mo:              { de: 'Mo', en: 'Mon', fr: 'Lun' },
  di:              { de: 'Di', en: 'Tue', fr: 'Mar' },
  mi:              { de: 'Mi', en: 'Wed', fr: 'Mer' },
  do:              { de: 'Do', en: 'Thu', fr: 'Jeu' },
  fr:              { de: 'Fr', en: 'Fri', fr: 'Ven' },
  sa:              { de: 'Sa', en: 'Sat', fr: 'Sam' },
  so:              { de: 'So', en: 'Sun', fr: 'Dim' },
  drehtagKurz:     { de: 'T{n}', en: 'D{n}', fr: 'J{n}' },
  drehtagNr:       { de: 'Drehtag {n}', en: 'Shoot day {n}', fr: 'Jour de tournage {n}' },
  keinVermerk:     { de: 'Kein Vermerk', en: 'No note', fr: 'Aucune remarque' },
  terminLoeschenAria: { de: 'Termin {titel} löschen', en: 'Delete appointment {titel}', fr: 'Supprimer le rendez-vous {titel}' },
  terminLoeschen:  { de: 'Termin löschen', en: 'Delete appointment', fr: 'Supprimer le rendez-vous' },
  keineTermine:    { de: 'Keine Termine.', en: 'No appointments.', fr: 'Aucun rendez-vous.' },
  terminHinzu:     { de: 'Termin hinzufügen', en: 'Add appointment', fr: 'Ajouter un rendez-vous' },
  legende:         { de: 'Legende', en: 'Legend', fr: 'Légende' },
  drehtag:         { de: 'Drehtag', en: 'Shoot day', fr: 'Jour de tournage' },
} satisfies Record<string, Text>
