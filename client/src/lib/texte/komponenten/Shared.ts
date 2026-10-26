import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte für components/shared/FeedbackWidget.tsx */
export const feedbackT = {
  fehler:        { de: 'Fehler', en: 'Bug', fr: 'Bug' },
  idee:          { de: 'Idee', en: 'Idea', fr: 'Idée' },
  allgemein:     { de: 'Allgemein', en: 'General', fr: 'Général' },
  danke:         { de: 'Danke für dein Feedback!', en: 'Thanks for your feedback!', fr: 'Merci pour ton retour !' },
  wirLesen:      { de: 'Wir lesen jede Nachricht.', en: 'We read every message.', fr: 'Nous lisons chaque message.' },
  fehlerToast:   { de: 'Fehler', en: 'Error', fr: 'Erreur' },
  geben:         { de: 'Feedback geben', en: 'Give feedback', fr: 'Donner un retour' },
  feedback:      { de: 'Feedback', en: 'Feedback', fr: 'Retour' },
  beschreibung:  { de: 'Was funktioniert gut, was fehlt dir? Dein Feedback fließt direkt in die Entwicklung ein.', en: 'What works well, what are you missing? Your feedback goes straight into development.', fr: 'Qu\'est-ce qui fonctionne bien, que te manque-t-il ? Ton retour alimente directement le développement.' },
  wasPassiert:   { de: 'Was ist passiert? Was hättest du erwartet?', en: 'What happened? What did you expect?', fr: 'Que s\'est-il passé ? Qu\'attendais-tu ?' },
  erzaehl:       { de: 'Erzähl uns davon…', en: 'Tell us about it…', fr: 'Raconte-nous…' },
  wirdGesendet:  { de: 'Wird gesendet…', en: 'Sending…', fr: 'Envoi…' },
  senden:        { de: 'Feedback senden', en: 'Send feedback', fr: 'Envoyer le retour' },
} satisfies Record<string, Text>

/** Texte für components/shared/GlobalSearch.tsx */
export const globalSearchT = {
  platzhalter:   { de: 'Szenen, Darsteller, Motive suchen…', en: 'Search scenes, actors, locations…', fr: 'Rechercher scènes, comédiens, décors…' },
  laeuft:        { de: 'Suche läuft…', en: 'Searching…', fr: 'Recherche en cours…' },
  keineFuer:     { de: 'Keine Ergebnisse für „{q}“', en: 'No results for "{q}"', fr: 'Aucun résultat pour « {q} »' },
  ergebnisse:    { de: 'Ergebnisse', en: 'Results', fr: 'Résultats' },
  schnellzugriff:{ de: 'Schnellzugriff', en: 'Quick access', fr: 'Accès rapide' },
  drehplan:      { de: 'Drehplan öffnen', en: 'Open shooting schedule', fr: 'Ouvrir le plan de tournage' },
  besetzung:     { de: 'Besetzung', en: 'Cast', fr: 'Casting' },
  budget:        { de: 'Budget', en: 'Budget', fr: 'Budget' },
} satisfies Record<string, Text>

/** Texte für components/shared/PDFPreviewModal.tsx */
export const pdfPreviewT = {
  oeffnen:       { de: 'Öffnen', en: 'Open', fr: 'Ouvrir' },
  download:      { de: 'Download', en: 'Download', fr: 'Télécharger' },
} satisfies Record<string, Text>

/** Texte für components/shared/TestversionBadge.tsx */
export const testversionT = {
  hinweis:       { de: 'Testversion vor dem Launch - Daten können zurückgesetzt werden', en: 'Pre-launch test version - data may be reset', fr: 'Version de test avant le lancement - les données peuvent être réinitialisées' },
  test:          { de: 'Test', en: 'Test', fr: 'Test' },
} satisfies Record<string, Text>

/** Texte für components/shared/TutorialModal.tsx */
export const tutorialModalT = {
  rundgang:      { de: 'Rundgang', en: 'Tour', fr: 'Visite guidée' },
} satisfies Record<string, Text>
