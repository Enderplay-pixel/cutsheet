import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const onboardingT = {
  erstesProjekt:   { de: 'Dein erstes Projekt', en: 'Your first project', fr: 'Ton premier projet' },
  dreiSchritte:    { de: 'Titel, Team, Drehbuch - in drei kurzen Schritten.', en: 'Title, team, script - in three quick steps.', fr: 'Titre, équipe, scénario - en trois étapes rapides.' },
  spaeterAendern:  { de: 'Alles lässt sich später ändern.', en: 'Everything can be changed later.', fr: 'Tout peut être modifié plus tard.' },
  losGehts:        { de: "Los geht's", en: "Let's go", fr: "C'est parti" },
  ueberspringen:   { de: 'Überspringen', en: 'Skip', fr: 'Passer' },
  projektdetails:  { de: 'Projektdetails', en: 'Project details', fr: 'Détails du projet' },
  filmName:        { de: 'Wie heißt dein Film?', en: 'What is your film called?', fr: "Comment s'appelle ton film ?" },
  titelPflicht:    { de: 'Titel *', en: 'Title *', fr: 'Titre *' },
  meinFilm:        { de: 'Mein Film', en: 'My film', fr: 'Mon film' },
  genre:           { de: 'Genre', en: 'Genre', fr: 'Genre' },
  genreBeispiel:   { de: 'z. B. Drama', en: 'e.g. Drama', fr: 'ex. Drame' },
  format:          { de: 'Format', en: 'Format', fr: 'Format' },
  zurueck:         { de: 'Zurück', en: 'Back', fr: 'Retour' },
  weiter:          { de: 'Weiter', en: 'Next', fr: 'Suivant' },
  deinTeam:        { de: 'Dein Team', en: 'Your team', fr: 'Ton équipe' },
  werSteckt:       { de: 'Wer steckt hinter dem Projekt?', en: 'Who is behind the project?', fr: 'Qui est derrière le projet ?' },
  regie:           { de: 'Regisseur/in', en: 'Director', fr: 'Réalisateur/trice' },
  regieName:       { de: 'Name der Regie', en: "Director's name", fr: 'Nom du/de la réalisateur/trice' },
  produktion:      { de: 'Produzent/in', en: 'Producer', fr: 'Producteur/trice' },
  produktionName:  { de: 'Name des Produzenten', en: "Producer's name", fr: 'Nom du producteur' },
  dop:             { de: 'DOP (Director of Photography)', en: 'DOP (Director of Photography)', fr: 'Chef opérateur (DOP)' },
  dopName:         { de: 'Name des DOP', en: "DOP's name", fr: 'Nom du chef opérateur' },
  projektErstellen:{ de: 'Projekt erstellen', en: 'Create project', fr: 'Créer le projet' },
  importFehler:    { de: 'Import fehlgeschlagen', en: 'Import failed', fr: "Échec de l'importation" },
  drehbuchImport:  { de: 'Drehbuch importieren', en: 'Import script', fr: 'Importer le scénario' },
  formate:         { de: 'Final Draft, Celtx oder Fountain - Szenen entstehen automatisch.', en: 'Final Draft, Celtx or Fountain - scenes are created automatically.', fr: 'Final Draft, Celtx ou Fountain - les scènes sont créées automatiquement.' },
  analysiert:      { de: 'Drehbuch wird analysiert…', en: 'Analysing script…', fr: 'Analyse du scénario…' },
  extrahiert:      { de: 'Szenen, Motive und Figuren werden extrahiert.', en: 'Extracting scenes, locations and characters.', fr: 'Extraction des scènes, décors et personnages.' },
  dateiZiehen:     { de: 'Datei hierher ziehen oder klicken', en: 'Drag a file here or click', fr: 'Glisse un fichier ici ou clique' },
  spaeterSzenen:   { de: 'Überspringen - ich lege Szenen später an', en: "Skip - I'll add scenes later", fr: "Passer - j'ajouterai les scènes plus tard" },
  bereit:          { de: 'Dein Projekt ist bereit!', en: 'Your project is ready!', fr: 'Ton projet est prêt !' },
  angelegt:        { de: 'wurde erfolgreich angelegt.', en: 'was created successfully.', fr: 'a été créé avec succès.' },
  szenenN:         { de: '{n} Szenen', en: '{n} scenes', fr: '{n} scènes' },
  und:             { de: ' und ', en: ' and ', fr: ' et ' },
  absaetzeN:       { de: '{n} Absätze', en: '{n} paragraphs', fr: '{n} paragraphes' },
  ausDrehbuch:     { de: ' aus deinem Drehbuch importiert.', en: ' imported from your script.', fr: ' importés depuis ton scénario.' },
  loslegen:        { de: 'Du kannst jetzt loslegen und Szenen, Team und Drehtage verwalten.', en: 'You can now get started and manage scenes, team and shoot days.', fr: 'Tu peux maintenant commencer et gérer scènes, équipe et jours de tournage.' },
  zumDrehbuch:     { de: 'Zum Drehbuch', en: 'Go to script', fr: 'Vers le scénario' },
  zumDashboard:    { de: 'Zum Projekt-Dashboard', en: 'Go to project dashboard', fr: 'Vers le tableau de bord du projet' },
  einrichtung:     { de: 'Einrichtung', en: 'Setup', fr: 'Configuration' },
  wirdErstellt:    { de: 'Projekt wird erstellt…', en: 'Creating project…', fr: 'Création du projet…' },
} satisfies Record<string, Text>

/**
 * Beschriftungen der Formate (`lib/projectKind.ts`) - der Wert selbst geht
 * deutsch an den Server und entscheidet dort über Film- oder Creator-Projekt.
 */
export const onboardingFormatT: Record<string, Text> = {
  Spielfilm:     { de: 'Spielfilm', en: 'Feature film', fr: 'Long métrage' },
  Dokumentation: { de: 'Dokumentation', en: 'Documentary', fr: 'Documentaire' },
  Kurzfilm:      { de: 'Kurzfilm', en: 'Short film', fr: 'Court métrage' },
  Serie:         { de: 'Serie', en: 'Series', fr: 'Série' },
  Werbefilm:     { de: 'Werbefilm', en: 'Commercial', fr: 'Film publicitaire' },
  Imagefilm:     { de: 'Imagefilm', en: 'Corporate film', fr: "Film d'entreprise" },
  'YouTube-Video':  { de: 'YouTube-Video', en: 'YouTube video', fr: 'Vidéo YouTube' },
  'YouTube Shorts': { de: 'YouTube Shorts', en: 'YouTube Shorts', fr: 'YouTube Shorts' },
  'Reel / TikTok':  { de: 'Reel / TikTok', en: 'Reel / TikTok', fr: 'Reel / TikTok' },
  Podcast:       { de: 'Podcast', en: 'Podcast', fr: 'Podcast' },
  'Stream / Live':  { de: 'Stream / Live', en: 'Stream / live', fr: 'Stream / direct' },
}
