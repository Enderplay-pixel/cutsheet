import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Beschriftungen der Vertragsstände - die Schlüssel sind Statuswerte vom Server. */
export const vertragStatusT = {
  entwurf: { de: 'Entwurf', en: 'Draft', fr: 'Brouillon' },
  versendet: { de: 'Versendet', en: 'Sent', fr: 'Envoyé' },
  bestaetigt: { de: 'Bestätigt', en: 'Confirmed', fr: 'Confirmé' },
  abgelehnt: { de: 'Abgelehnt', en: 'Declined', fr: 'Refusé' },
  zurueckgezogen: { de: 'Zurückgezogen', en: 'Withdrawn', fr: 'Retiré' },
} satisfies Record<string, Text>

/** Beschriftungen der Personenarten - die Schlüssel sind Werte vom Server. */
export const vertragPersonenartT = {
  cast: { de: 'Besetzung', en: 'Cast', fr: 'Casting' },
  crew: { de: 'Stab', en: 'Crew', fr: 'Équipe' },
  extra: { de: 'Komparsen', en: 'Extras', fr: 'Figurants' },
} satisfies Record<string, Text>

export const vertraegeT = {
  // Seite und Reiter
  titel: { de: 'Verträge', en: 'Contracts', fr: 'Contrats' },
  untertitel: {
    de: 'Das Papier, das vor dem ersten Drehtag da sein muss',
    en: 'The paperwork that has to be in place before the first shoot day',
    fr: 'Les documents qui doivent être prêts avant le premier jour de tournage',
  },
  werHatWas: { de: 'Wer hat was', en: 'Who has what', fr: 'Qui a quoi' },
  jugendschutz: {
    de: 'Jugendschutz',
    en: 'Protection of young workers (JArbSchG)',
    fr: 'Protection des jeunes travailleurs (JArbSchG)',
  },
  vorlagen: { de: 'Vorlagen', en: 'Templates', fr: 'Modèles' },

  // Wer hat was
  verschickt: { de: 'Verschickt', en: 'Sent', fr: 'Envoyé' },
  anEmpfaenger: { de: 'An {an}', en: 'To {an}', fr: 'À {an}' },
  nichtVerschickt: { de: 'Nicht verschickt', en: 'Not sent', fr: 'Non envoyé' },
  zurueckgezogen: { de: 'Zurückgezogen', en: 'Withdrawn', fr: 'Retiré' },
  linkGiltNichtMehr: { de: 'Der Link gilt nicht mehr.', en: 'The link is no longer valid.', fr: "Le lien n'est plus valable." },
  nichtZurueckgezogen: { de: 'Nicht zurückgezogen', en: 'Not withdrawn', fr: 'Non retiré' },
  lade: { de: 'Lade…', en: 'Loading…', fr: 'Chargement…' },
  personen: { de: 'Personen', en: 'People', fr: 'Personnes' },
  ohneVertrag: { de: 'Ohne Vertrag', en: 'Without contract', fr: 'Sans contrat' },
  wartetAufAntwort: { de: 'Wartet auf Antwort', en: 'Awaiting reply', fr: 'En attente de réponse' },
  bestaetigt: { de: 'Bestätigt', en: 'Confirmed', fr: 'Confirmé' },
  nurOffene: { de: 'Nur offene zeigen', en: 'Show open only', fr: 'Afficher uniquement les dossiers ouverts' },
  vonGesamt: { de: '{n} von {gesamt}', en: '{n} of {gesamt}', fr: '{n} sur {gesamt}' },
  alleBestaetigt: {
    de: 'Alle haben einen Vertrag und alle haben bestätigt.',
    en: 'Everyone has a contract and everyone has confirmed.',
    fr: 'Tout le monde a un contrat et tout le monde a confirmé.',
  },
  nochNiemand: {
    de: 'Noch niemand im Projekt. Besetzung und Stab anlegen, dann erscheinen sie hier.',
    en: 'Nobody in the project yet. Add cast and crew and they will appear here.',
    fr: "Personne dans le projet pour l'instant. Ajoute le casting et l'équipe, ils apparaîtront ici.",
  },
  jahre: { de: '{n} Jahre', en: '{n} years', fr: '{n} ans' },
  minderjaehrig: { de: 'minderjährig, {n}', en: 'minor, {n}', fr: 'mineur(e), {n}' },
  nochKeinVertrag: { de: 'Noch kein Vertrag', en: 'No contract yet', fr: 'Pas encore de contrat' },
  vertrag: { de: 'Vertrag', en: 'Contract', fr: 'Contrat' },
  seit: { de: 'seit {zeit}', en: 'since {zeit}', fr: 'depuis le {zeit}' },
  zurueckziehenFrage: {
    de: '„{titel}“ zurückziehen? Der Link in der Mail gilt danach nicht mehr.',
    en: 'Withdraw "{titel}"? The link in the email will no longer be valid afterwards.',
    fr: "Retirer « {titel} » ? Le lien dans l'e-mail ne sera plus valable ensuite.",
  },
  zurueckziehen: { de: 'Zurückziehen', en: 'Withdraw', fr: 'Retirer' },
  senden: { de: 'Senden', en: 'Send', fr: 'Envoyer' },

  // Vertrag anlegen
  vorschauFehlgeschlagen: { de: 'Vorschau fehlgeschlagen', en: 'Preview failed', fr: "Échec de l'aperçu" },
  entwurfAngelegt: { de: 'Entwurf angelegt', en: 'Draft created', fr: 'Brouillon créé' },
  durchlesen: { de: 'Vor dem Senden einmal durchlesen.', en: 'Read it through once before sending.', fr: "Relisez-le une fois avant l'envoi." },
  nichtAngelegt: { de: 'Nicht angelegt', en: 'Not created', fr: 'Non créé' },
  vertragFuer: { de: 'Vertrag für {name}', en: 'Contract for {name}', fr: 'Contrat pour {name}' },
  anErziehungsberechtigte: {
    de: '{n} Jahre - der Vertrag geht an die erziehungsberechtigte Person, nicht an das Kind.',
    en: '{n} years - the contract goes to the parent or guardian, not to the child.',
    fr: "{n} ans - le contrat est adressé au représentant légal, pas à l'enfant.",
  },
  vorlageGefuellt: {
    de: 'Die Vorlage wird mit den Daten aus dem Projekt gefüllt.',
    en: 'The template is filled with the data from the project.',
    fr: 'Le modèle est rempli avec les données du projet.',
  },
  vorlage: { de: 'Vorlage', en: 'Template', fr: 'Modèle' },
  waehlen: { de: 'wählen', en: 'choose', fr: 'choisir' },
  ohneWert: {
    de: 'Ohne Wert geblieben: {felder}. Diese Stellen sind im Text leer - entweder die Angabe im Projekt nachtragen oder den Text von Hand ergänzen.',
    en: 'Left without a value: {felder}. These places are empty in the text - either add the details in the project or complete the text by hand.',
    fr: 'Restés sans valeur : {felder}. Ces passages sont vides dans le texte - complétez soit les informations dans le projet, soit le texte à la main.',
  },
  titelFeld: { de: 'Titel', en: 'Title', fr: 'Titre' },
  text: { de: 'Text', en: 'Text', fr: 'Texte' },
  eingefroren: {
    de: 'Ab dem Versand ist dieser Text eingefroren. Für eine andere Fassung einen neuen Vertrag anlegen - so bleibt belegbar, wem was vorlag.',
    en: 'Once sent, this text is frozen. For a different version, create a new contract - that way it remains provable who received what.',
    fr: "Dès l'envoi, ce texte est figé. Pour une autre version, créez un nouveau contrat - ainsi, on peut toujours prouver qui a reçu quoi.",
  },
  abbrechen: { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  entwurfAnlegen: { de: 'Entwurf anlegen', en: 'Create draft', fr: 'Créer le brouillon' },

  // Jugendschutz
  jugendschutzHinweisVor: {
    de: 'Kinderarbeit ist nach § 5 JArbSchG verboten; § 6 ist die Ausnahme davon und verlangt eine Bewilligung der Aufsichtsbehörde',
    en: 'Child labour is prohibited under § 5 JArbSchG (German Youth Employment Protection Act); § 6 is the exception and requires a permit from the supervisory authority',
    fr: "Le travail des enfants est interdit selon le § 5 JArbSchG (loi allemande sur la protection des jeunes travailleurs) ; le § 6 constitue l'exception et exige une autorisation de l'autorité de contrôle",
  },
  jugendschutzHinweisVorBetont: { de: 'vor', en: 'before', fr: 'avant' },
  jugendschutzHinweisNach: {
    de: 'dem Dreh. Der Antrag braucht je nach Bundesland ein bis zwei Wochen. Diese Prüfung rechnet die gesetzlichen Grenzen nach - was der Bescheid im Einzelfall festlegt, hat Vorrang.',
    en: 'the shoot. Depending on the federal state, the application takes one to two weeks. This check recalculates the statutory limits - whatever the official decision stipulates in the individual case takes precedence.',
    fr: "le tournage. Selon le Land, la demande prend une à deux semaines. Ce contrôle recalcule les limites légales - ce que fixe la décision administrative dans le cas particulier prévaut.",
  },
  punktSteht: { de: 'Punkt steht', en: 'issue stands', fr: "point s'oppose" },
  punkteStehen: { de: 'Punkte stehen', en: 'issues stand', fr: "points s'opposent" },
  derMitwirkungEntgegen: { de: 'der Mitwirkung entgegen.', en: 'in the way of participation.', fr: 'à la participation.' },
  ohneGeburtsdatum: {
    de: 'Bei {n} Personen aus Besetzung und Komparserie fehlt das Geburtsdatum. Ohne Alter lässt sich nichts prüfen - solange könnte ein Kind dabei sein, von dem niemand weiß.',
    en: 'The date of birth is missing for {n} people from the cast and extras. Without an age nothing can be checked - until then there could be a child involved that nobody knows about.',
    fr: "La date de naissance manque pour {n} personnes du casting et des figurants. Sans âge, rien ne peut être vérifié - d'ici là, un enfant pourrait être concerné sans que personne ne le sache.",
  },
  niemandUnter18: {
    de: 'Niemand unter 18 im Projekt - jedenfalls niemand mit eingetragenem Geburtsdatum.',
    en: 'Nobody under 18 in the project - at least nobody with a date of birth entered.',
    fr: 'Personne de moins de 18 ans dans le projet - du moins personne avec une date de naissance saisie.',
  },
  bewilligungLiegtVor: { de: 'Bewilligung liegt vor', en: 'Permit granted', fr: 'Autorisation obtenue' },
  keineBewilligung: { de: 'keine Bewilligung', en: 'no permit', fr: "pas d'autorisation" },
  erziehungsberechtigt: { de: 'Erziehungsberechtigt: {name}', en: 'Parent or guardian: {name}', fr: 'Représentant légal : {name}' },
  angaben: { de: 'Angaben', en: 'Details', fr: 'Informations' },
  keineDispo: {
    de: 'Steht auf keiner Tagesdisposition. Sobald eine Dispo da ist, wird hier gerechnet.',
    en: 'Not on any call sheet. As soon as there is a call sheet, the calculation is done here.',
    fr: "Ne figure sur aucune feuille de service. Dès qu'une feuille de service existe, le calcul se fait ici.",
  },
  stundenGeplant: { de: '{n} Stunden geplant', en: '{n} hours planned', fr: '{n} heures prévues' },
  nichtsZuBeanstanden: { de: 'nichts zu beanstanden', en: 'no objections', fr: 'rien à signaler' },
  wasAntragBraucht: { de: 'Was der Antrag braucht', en: 'What the application needs', fr: 'Ce dont la demande a besoin' },
  zustaendig: {
    de: 'Zuständig ist je nach Bundesland die Bezirksregierung oder das Regierungspräsidium. Die Stellungnahmen von Schule und Jugendamt dauern am längsten - zuerst anfragen.',
    en: 'Depending on the federal state, the responsible body is the district government (Bezirksregierung) or the regional council (Regierungspräsidium). Statements from the school and the youth welfare office take longest - request them first.',
    fr: "Selon le Land, l'autorité compétente est le gouvernement de district (Bezirksregierung) ou la présidence régionale (Regierungspräsidium). Les avis de l'école et du service de protection de la jeunesse prennent le plus de temps - demandez-les en premier.",
  },
  gespeichert: { de: 'Gespeichert', en: 'Saved', fr: 'Enregistré' },
  nichtGespeichert: { de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
  jahrePrueftung: {
    de: '{n} Jahre. Diese Angaben gehen in die Prüfung ein und in den Antrag.',
    en: '{n} years. These details are used in the check and in the application.',
    fr: '{n} ans. Ces informations sont prises en compte dans le contrôle et dans la demande.',
  },
  erziehungsberechtigtePerson: { de: 'Erziehungsberechtigte Person', en: 'Parent or guardian', fr: 'Représentant légal' },
  mailadresse: { de: 'Mailadresse', en: 'Email address', fr: 'Adresse e-mail' },
  anDieseAdresse: {
    de: 'An diese Adresse gehen die Verträge - nicht an das Kind.',
    en: 'The contracts go to this address - not to the child.',
    fr: "Les contrats sont envoyés à cette adresse - pas à l'enfant.",
  },
  bewilligungNach6: {
    de: 'Bewilligung nach § 6 JArbSchG liegt vor',
    en: 'Permit under § 6 JArbSchG has been granted',
    fr: 'Autorisation selon le § 6 JArbSchG obtenue',
  },
  aktenzeichen: { de: 'Aktenzeichen', en: 'Reference number', fr: 'Numéro de dossier' },
  gueltigBis: { de: 'Gültig bis', en: 'Valid until', fr: "Valable jusqu'au" },
  speichern: { de: 'Speichern', en: 'Save', fr: 'Enregistrer' },

  // Vorlagen
  vorlageEntfernt: { de: 'Vorlage entfernt', en: 'Template removed', fr: 'Modèle supprimé' },
  nichtEntfernt: { de: 'Nicht entfernt', en: 'Not removed', fr: 'Non supprimé' },
  mitgelieferteVor: { de: 'Die mitgelieferten Texte sind', en: 'The supplied texts are', fr: 'Les textes fournis sont des' },
  mitgelieferteEntwuerfe: { de: 'Entwürfe', en: 'drafts', fr: 'brouillons' },
  mitgelieferteNach: {
    de: ', keine geprüften Verträge. Wer eine Produktion mit Sendeplatz macht, legt sie einmal einer Kanzlei vor und speichert das Ergebnis als eigene Vorlage - danach werden sie nie wieder angefasst.',
    en: ', not legally reviewed contracts. If you are making a production with a broadcast slot, have them checked once by a law firm and save the result as your own template - after that they are never touched again.',
    fr: ", pas des contrats vérifiés. Pour une production avec une case de diffusion, faites-les relire une fois par un cabinet d'avocats et enregistrez le résultat comme modèle personnel - ensuite, on n'y touche plus jamais.",
  },
  eigeneVorlage: { de: 'Eigene Vorlage', en: 'Own template', fr: 'Modèle personnel' },
  eigene: { de: 'Eigene', en: 'Own', fr: 'Personnels' },
  firmenweit: { de: 'firmenweit', en: 'company-wide', fr: "pour toute la société" },
  aendern: { de: 'Ändern', en: 'Edit', fr: 'Modifier' },
  vorlageEntfernen: { de: 'Vorlage entfernen', en: 'Remove template', fr: 'Supprimer le modèle' },
  mitgeliefert: { de: 'Mitgeliefert', en: 'Supplied', fr: 'Fournis' },
  alsEigeneUebernehmen: { de: 'Als eigene übernehmen', en: 'Use as own', fr: 'Reprendre comme modèle personnel' },
  platzhalter: { de: 'Platzhalter', en: 'Placeholders', fr: 'Variables' },
  neueVorlage: { de: 'Neue Vorlage', en: 'New template', fr: 'Nouveau modèle' },
  vorlageAendern: { de: 'Vorlage ändern', en: 'Edit template', fr: 'Modifier le modèle' },
  platzhalterHinweis: {
    de: 'Platzhalter in doppelten geschweiften Klammern werden beim Anlegen eines Vertrags ersetzt.',
    en: 'Placeholders in double curly brackets are replaced when a contract is created.',
    fr: "Les variables entre doubles accolades sont remplacées lors de la création d'un contrat.",
  },
  name: { de: 'Name', en: 'Name', fr: 'Nom' },
  art: { de: 'Art', en: 'Type', fr: 'Type' },
  fuerAlleProjekte: {
    de: 'Für alle Projekte der Firma',
    en: 'For all projects of the company',
    fr: 'Pour tous les projets de la société',
  },
} satisfies Record<string, Text>
