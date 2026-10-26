import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Beschriftung der Pipeline-Stufen - der Wert selbst bleibt deutsch, der Server kennt ihn so. */
export const creatorVideosStatusT = {
  'Idee':           { de: 'Idee', en: 'Idea', fr: 'Idée' },
  'Skript':         { de: 'Skript', en: 'Script', fr: 'Script' },
  'Dreh':           { de: 'Dreh', en: 'Shoot', fr: 'Tournage' },
  'Schnitt':        { de: 'Schnitt', en: 'Edit', fr: 'Montage' },
  'Thumbnail':      { de: 'Thumbnail', en: 'Thumbnail', fr: 'Miniature' },
  'Upload':         { de: 'Upload', en: 'Upload', fr: 'Mise en ligne' },
  'Veröffentlicht': { de: 'Veröffentlicht', en: 'Published', fr: 'Publiée' },
} satisfies Record<string, Text>

export const creatorVideosT = {
  neuesVideo:        { de: 'Neues Video', en: 'New video', fr: 'Nouvelle vidéo' },
  anlegenFehler:     { de: 'Video konnte nicht angelegt werden', en: 'Video could not be created', fr: "La vidéo n'a pas pu être créée" },
  arbeitstitel:      { de: 'Arbeitstitel', en: 'Working title', fr: 'Titre provisoire' },
  titelPlatzhalter:  { de: 'Wie ich in 30 Tagen …', en: 'How I … in 30 days', fr: "Comment j'ai … en 30 jours" },
  plattform:         { de: 'Plattform', en: 'Platform', fr: 'Plateforme' },
  zielLaufzeit:      { de: 'Ziel-Laufzeit (Minuten)', en: 'Target running time (minutes)', fr: 'Durée visée (minutes)' },
  hook:              { de: 'Hook - die ersten Sekunden entscheiden', en: 'Hook - the first seconds decide', fr: 'Accroche - les premières secondes sont décisives' },
  hookPlatzhalter:   { de: 'Womit hältst du die Leute in den ersten fünf Sekunden?', en: 'How do you keep people watching in the first five seconds?', fr: 'Comment retiens-tu les gens pendant les cinq premières secondes ?' },
  gliederung:        { de: 'Das Skript wird mit der üblichen Gliederung angelegt: Hook, Intro, zwei Hauptteile, Call to Action, Outro.', en: 'The script is created with the usual structure: hook, intro, two main parts, call to action, outro.', fr: "Le script est créé avec la structure habituelle : accroche, intro, deux parties principales, appel à l'action, outro." },
  abbrechen:         { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  wirdAngelegt:      { de: 'Wird angelegt…', en: 'Creating…', fr: 'Création…' },
  anlegen:           { de: 'Anlegen', en: 'Create', fr: 'Créer' },
  statusFehler:      { de: 'Status nicht gespeichert', en: 'Status not saved', fr: 'Statut non enregistré' },
  videoGeloescht:    { de: 'Video gelöscht', en: 'Video deleted', fr: 'Vidéo supprimée' },
  loeschenFehler:    { de: 'Löschen fehlgeschlagen', en: 'Deletion failed', fr: 'Échec de la suppression' },
  titel:             { de: 'Videos', en: 'Videos', fr: 'Vidéos' },
  nochKeine:         { de: 'Noch keine Videos angelegt', en: 'No videos created yet', fr: "Aucune vidéo créée pour l'instant" },
  untertitelEins:    { de: '{n} Video · {pub} veröffentlicht · {zeit} Material geskriptet', en: '{n} video · {pub} published · {zeit} of material scripted', fr: '{n} vidéo · {pub} publiée(s) · {zeit} de contenu scénarisé' },
  untertitelMehr:    { de: '{n} Videos · {pub} veröffentlicht · {zeit} Material geskriptet', en: '{n} videos · {pub} published · {zeit} of material scripted', fr: '{n} vidéos · {pub} publiée(s) · {zeit} de contenu scénarisé' },
  erstesVideo:       { de: 'Leg dein erstes Video an', en: 'Create your first video', fr: 'Crée ta première vidéo' },
  erstesVideoText:   {
    de: 'Jedes Video bekommt ein Skript in Abschnitten, eine geschätzte Laufzeit aus dem Sprechtext und ein Upload-Paket mit Titeln, Thumbnail-Ideen und Kapitelmarken.',
    en: 'Every video gets a script in sections, an estimated running time based on the spoken text and an upload package with titles, thumbnail ideas and chapter markers.',
    fr: 'Chaque vidéo reçoit un script en sections, une durée estimée à partir du texte parlé et un kit de mise en ligne avec titres, idées de miniatures et chapitres.',
  },
  unbenannt:         { de: 'Unbenanntes Video', en: 'Untitled video', fr: 'Vidéo sans titre' },
  laufzeitTitel:     { de: 'Geschätzte Laufzeit aus dem Sprechtext', en: 'Estimated running time based on the spoken text', fr: 'Durée estimée à partir du texte parlé' },
  woerterTitel:      { de: 'Wörter im Sprechtext', en: 'Words in the spoken text', fr: 'Mots dans le texte parlé' },
  videoErsatz:       { de: 'Video', en: 'Video', fr: 'Vidéo' },
  loeschenFrage:     { de: '„{titel}“ mit allen Skript-Abschnitten löschen?', en: 'Delete "{titel}" with all script sections?', fr: 'Supprimer « {titel} » avec toutes les sections du script ?' },
} satisfies Record<string, Text>
