import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const activityFeedT = {
  titel:        { de: 'Aktivitäten', en: 'Activity', fr: 'Activités' },
  untertitel:   { de: 'Projektverlauf - aktualisiert alle 30 Sekunden', en: 'Project history - updated every 30 seconds', fr: 'Historique du projet - mis à jour toutes les 30 secondes' },
  leer:         { de: 'Noch keine Aktivitäten vorhanden', en: 'No activity yet', fr: "Pas encore d'activité" },
  system:       { de: 'System', en: 'System', fr: 'Système' },
  geradeEben:   { de: 'gerade eben', en: 'just now', fr: "à l'instant" },
  vorMin:       { de: 'vor {n} Min.', en: '{n} min ago', fr: 'il y a {n} min' },
  vorStd:       { de: 'vor {n} Std.', en: '{n} hr ago', fr: 'il y a {n} h' },
  gesternKlein: { de: 'gestern', en: 'yesterday', fr: 'hier' },
  vorTagen:     { de: 'vor {n} Tagen', en: '{n} days ago', fr: 'il y a {n} jours' },
  heute:        { de: 'Heute', en: 'Today', fr: "Aujourd'hui" },
  gestern:      { de: 'Gestern', en: 'Yesterday', fr: 'Hier' },
  alle:         { de: 'Alle', en: 'All', fr: 'Tout' },
  szenen:       { de: 'Szenen', en: 'Scenes', fr: 'Scènes' },
  cast:         { de: 'Cast', en: 'Cast', fr: 'Casting' },
  stab:         { de: 'Stab', en: 'Crew', fr: 'Équipe' },
  budget:       { de: 'Budget', en: 'Budget', fr: 'Budget' },
  drehtage:     { de: 'Drehtage', en: 'Shoot days', fr: 'Jours de tournage' },
  motive:       { de: 'Motive', en: 'Locations', fr: 'Décors' },
  equipment:    { de: 'Equipment', en: 'Equipment', fr: 'Matériel' },
  musik:        { de: 'Musik', en: 'Music', fr: 'Musique' },
  shotlist:     { de: 'Shotlist', en: 'Shot list', fr: 'Liste des plans' },
} satisfies Record<string, Text>
