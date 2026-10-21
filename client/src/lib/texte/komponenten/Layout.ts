import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte für components/layout/Sidebar.tsx, die in navT fehlen */
export const sidebarT = {
  datenschutz:     { de: 'Datenschutz', en: 'Data protection', fr: 'Protection des données' },
  listen:          { de: 'Listen', en: 'Lists', fr: 'Listes' },
  papierkorb:      { de: 'Papierkorb', en: 'Bin', fr: 'Corbeille' },
  agenturen:       { de: 'Agenturen', en: 'Agencies', fr: 'Agences' },
  vertraege:       { de: 'Verträge', en: 'Contracts', fr: 'Contrats' },
  reise:           { de: 'Reise und Unterkunft', en: 'Travel and accommodation', fr: 'Voyage et hébergement' },
  ablage:          { de: 'Ablage', en: 'Files', fr: 'Documents' },
  abnahme:         { de: 'Abnahme', en: 'Client approval', fr: 'Validation client' },
  abschluss:       { de: 'Abschluss', en: 'Wrap-up', fr: 'Clôture' },
  zurUebersicht:   { de: 'Zur Projektübersicht', en: 'Go to project overview', fr: "Vers l'aperçu des projets" },
  hauptnavigation: { de: 'Hauptnavigation', en: 'Main navigation', fr: 'Navigation principale' },
  erweitern:       { de: 'Sidebar erweitern', en: 'Expand sidebar', fr: 'Déplier la barre latérale' },
  einklappen:      { de: 'Sidebar einklappen', en: 'Collapse sidebar', fr: 'Replier la barre latérale' },
} satisfies Record<string, Text>

/** Texte für components/layout/TopBar.tsx, die in topBarT fehlen */
export const topBarTexteT = {
  navigationOeffnen: { de: 'Navigation öffnen', en: 'Open navigation', fr: 'Ouvrir la navigation' },
} satisfies Record<string, Text>

/** Weitere Texte für components/layout/TopBar.tsx */
export const topBarDrehtagT = {
  oeffnen:  { de: 'Drehtag {n} öffnen', en: 'Open shoot day {n}', fr: 'Ouvrir le jour de tournage {n}' },
  heute:    { de: 'Drehtag {n} - HEUTE', en: 'Shoot day {n} - TODAY', fr: "Jour de tournage {n} - AUJOURD'HUI" },
  morgen:   { de: 'Drehtag {n} - morgen', en: 'Shoot day {n} - tomorrow', fr: 'Jour de tournage {n} - demain' },
  inTagen:  { de: 'Drehtag {n} in {d} Tagen', en: 'Shoot day {n} in {d} days', fr: 'Jour de tournage {n} dans {d} jours' },
} satisfies Record<string, Text>

/** Seitentitel ohne Eintrag in topBarT.pageTitles */
export const topBarExtraTitelT: Record<string, Text> = {
  aufgaben:             { de: 'Aufgaben', en: 'Tasks', fr: 'Tâches' },
  kostenstand:          { de: 'Kostenstand', en: 'Cost status', fr: 'Suivi des coûts' },
  kommentare:           { de: 'Szenen-Kommentare', en: 'Scene comments', fr: 'Commentaires de scène' },
  sperrtage:            { de: 'Sperrtage', en: 'Blocked days', fr: 'Jours bloqués' },
  checkin:              { de: 'Check-in Board', en: 'Check-in board', fr: 'Tableau de présence' },
  catering:             { de: 'Catering', en: 'Catering', fr: 'Restauration' },
  timesheets:           { de: 'Timesheets', en: 'Timesheets', fr: "Feuilles d'heures" },
  continuity:           { de: 'Continuity', en: 'Continuity', fr: 'Continuité' },
  kameraberichte:       { de: 'Kameraberichte', en: 'Camera reports', fr: 'Rapports caméra' },
  vfx:                  { de: 'VFX-Tracking', en: 'VFX tracking', fr: 'Suivi VFX' },
  postplan:             { de: 'Postplan', en: 'Post plan', fr: 'Plan de post-production' },
  musikliste:           { de: 'Musikliste', en: 'Music cues', fr: 'Liste musicale' },
  versicherungen:       { de: 'Versicherungen', en: 'Insurance', fr: 'Assurances' },
  dood:                 { de: 'Day Out of Days', en: 'Day Out of Days', fr: 'Day Out of Days' },
  moodboard:            { de: 'Moodboard', en: 'Moodboard', fr: 'Moodboard' },
  aktivitaet:           { de: 'Aktivitäten', en: 'Activity', fr: 'Activités' },
  zeitanalyse:          { de: 'Zeitanalyse', en: 'Time analysis', fr: 'Analyse du temps' },
  setplan:              { de: 'Set-Plan', en: 'Set plan', fr: 'Plan de plateau' },
  'equipment-kalender': { de: 'Equipment-Kalender', en: 'Equipment calendar', fr: 'Calendrier du matériel' },
  admin:                { de: 'Admin', en: 'Admin', fr: 'Admin' },
  stats:                { de: 'Admin-Statistiken', en: 'Admin statistics', fr: 'Statistiques admin' },
  creator:              { de: 'Videos', en: 'Videos', fr: 'Vidéos' },
  ideen:                { de: 'Ideen', en: 'Ideas', fr: 'Idées' },
  kanal:                { de: 'Kanal', en: 'Channel', fr: 'Chaîne' },
  redaktionsplan:       { de: 'Redaktionsplan', en: 'Editorial plan', fr: 'Calendrier éditorial' },
  serien:               { de: 'Serien & Formate', en: 'Series & formats', fr: 'Séries & formats' },
  sponsoren:            { de: 'Sponsoren', en: 'Sponsors', fr: 'Sponsors' },
  seo:                  { de: 'SEO & Metadaten', en: 'SEO & metadata', fr: 'SEO & métadonnées' },
  titel:                { de: 'Titel & Thumbnails', en: 'Titles & thumbnails', fr: 'Titres & miniatures' },
  rechte:               { de: 'Rechte & Lizenzen', en: 'Rights & licences', fr: 'Droits & licences' },
  clips:                { de: 'Auskopplungen', en: 'Clips', fr: 'Extraits' },
  checklisten:          { de: 'Upload-Checklisten', en: 'Upload checklists', fr: 'Listes de publication' },
  performance:          { de: 'Video-Performance', en: 'Video performance', fr: 'Performance vidéo' },
}
