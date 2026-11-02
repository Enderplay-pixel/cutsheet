import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const emailCenterT = {
  // Zustand einer Mail im Postausgang
  statusWartet:         { de: 'wartet', en: 'waiting', fr: 'en attente' },
  statusGesendet:       { de: 'gesendet', en: 'sent', fr: 'envoyé' },
  statusFehlgeschlagen: { de: 'fehlgeschlagen', en: 'failed', fr: 'échec' },
  statusOhneVersand:    { de: 'nicht versendet', en: 'not sent', fr: 'non envoyé' },

  // Regeln für Verteiler
  regelManuell:       { de: 'feste Liste', en: 'fixed list', fr: 'liste fixe' },
  regelCrewAlle:      { de: 'ganzer Stab', en: 'entire crew', fr: "toute l'équipe" },
  regelCrewAbteilung: { de: 'eine Abteilung', en: 'one department', fr: 'un département' },
  regelCastAlle:      { de: 'ganze Besetzung', en: 'entire cast', fr: 'tout le casting' },
  regelKomparsen:     { de: 'Komparsen', en: 'Extras', fr: 'Figurants' },
  regelMitglieder:    { de: 'Projektmitglieder', en: 'Project members', fr: 'Membres du projet' },
  regelDrehtag:       { de: 'Beteiligte eines Drehtags', en: 'People on a shoot day', fr: "Participants d'un jour de tournage" },

  gruppeStab:      { de: 'Stab', en: 'Crew', fr: 'Équipe' },
  gruppeBesetzung: { de: 'Besetzung', en: 'Cast', fr: 'Casting' },

  // Meldungen
  eingeplant:          { de: '{n} Mails eingeplant', en: '{n} emails scheduled', fr: '{n} e-mails programmés' },
  versandAm:           { de: 'Versand am {zeit}', en: 'Sending on {zeit}', fr: 'Envoi le {zeit}' },
  versendet:           { de: '{n} versendet', en: '{n} sent', fr: '{n} envoyés' },
  warteschlange:       { de: '{n} in der Warteschlange', en: '{n} in the queue', fr: "{n} dans la file d'attente" },
  ohneMailserver:      { de: '{n} ohne Mailserver', en: '{n} without a mail server', fr: '{n} sans serveur de messagerie' },
  versandAbgelehnt:    { de: 'Versand abgelehnt', en: 'Sending refused', fr: 'Envoi refusé' },
  testRaus:            { de: 'Test-Mail ist raus', en: 'Test email sent', fr: "L'e-mail de test est parti" },
  nichtsVersendet:     { de: 'Nichts versendet', en: 'Nothing sent', fr: 'Rien envoyé' },
  schauPostfach:       { de: 'Schau in dein Postfach.', en: 'Check your inbox.', fr: 'Regarde dans ta boîte de réception.' },
  keinServerSatz:      { de: 'Es ist kein Mailserver eingerichtet.', en: 'No mail server is set up.', fr: "Aucun serveur de messagerie n'est configuré." },
  erneutWarteschlange: { de: 'Erneut in die Warteschlange gelegt', en: 'Put back in the queue', fr: "Remis dans la file d'attente" },
  zurueckgezogen:      { de: 'Mail zurückgezogen', en: 'Email withdrawn', fr: 'E-mail retiré' },
  vorlageUebernommen:  { de: 'Vorlage „{name}“ übernommen', en: 'Template "{name}" applied', fr: 'Modèle « {name} » appliqué' },
  platzhalterGefuellt: { de: 'Platzhalter werden beim Senden gefüllt.', en: 'Placeholders are filled in when sending.', fr: "Les variables sont remplies à l'envoi." },

  // Kopf
  titel:      { de: 'E-Mail', en: 'Email', fr: 'E-mail' },
  untertitel: { de: 'Vorlagen, Verteiler und Versand - mit Protokoll', en: 'Templates, mailing lists and sending - with a log', fr: 'Modèles, listes de diffusion et envoi - avec historique' },
  keinMailserver: { de: 'Kein Mailserver eingerichtet', en: 'No mail server set up', fr: 'Aucun serveur de messagerie configuré' },
  keinMailserverText: {
    de: 'Ohne SMTP-Zugang geht nichts raus. Du kannst trotzdem Vorlagen und Verteiler anlegen - sie liegen bereit, sobald der Zugang steht. Die Zugangsdaten setzt der Betreiber in den Umgebungsvariablen SMTP_HOST, SMTP_USER und SMTP_PASS.',
    en: 'Without SMTP access nothing goes out. You can still create templates and mailing lists - they will be ready as soon as access is set up. The operator sets the credentials in the environment variables SMTP_HOST, SMTP_USER and SMTP_PASS.',
    fr: "Sans accès SMTP, rien ne part. Tu peux tout de même créer des modèles et des listes de diffusion - ils seront prêts dès que l'accès sera en place. L'exploitant définit les identifiants dans les variables d'environnement SMTP_HOST, SMTP_USER et SMTP_PASS.",
  },

  // Reiter
  tabVerfassen:   { de: 'Verfassen', en: 'Compose', fr: 'Rédiger' },
  tabVorlagen:    { de: 'Vorlagen', en: 'Templates', fr: 'Modèles' },
  tabVerteiler:   { de: 'Verteiler', en: 'Mailing lists', fr: 'Listes de diffusion' },
  tabPostausgang: { de: 'Postausgang', en: 'Outbox', fr: "Boîte d'envoi" },
  tabAbsender:    { de: 'Absender', en: 'Sender', fr: 'Expéditeur' },

  // Verfassen
  empfaenger:         { de: 'Empfänger', en: 'Recipients', fr: 'Destinataires' },
  verteiler:          { de: 'Verteiler', en: 'Mailing list', fr: 'Liste de diffusion' },
  einzelnAuswaehlen:  { de: 'Einzeln auswählen', en: 'Select individually', fr: 'Sélectionner individuellement' },
  niemandAdresse:     { de: 'Niemand im Stab oder in der Besetzung hat eine E-Mail-Adresse hinterlegt.', en: 'No one in the crew or cast has an email address on file.', fr: "Personne dans l'équipe ou le casting n'a renseigné d'adresse e-mail." },
  letzteStunde:       { de: 'In der letzten Stunde: {n} von {max} Mails', en: 'In the last hour: {n} of {max} emails', fr: 'Dans la dernière heure : {n} e-mails sur {max}' },
  wartenVersand:      { de: '{n} warten auf den Versand', en: '{n} waiting to be sent', fr: "{n} en attente d'envoi" },
  vorlageUebernehmen: { de: 'Vorlage übernehmen', en: 'Use a template', fr: 'Utiliser un modèle' },
  nachricht:          { de: 'Nachricht', en: 'Message', fr: 'Message' },
  betreff:            { de: 'Betreff', en: 'Subject', fr: 'Objet' },
  text:               { de: 'Text', en: 'Text', fr: 'Texte' },
  textPlatzhalter:    { de: 'Hallo {{vorname}}, …', en: 'Hello {{vorname}}, …', fr: 'Bonjour {{vorname}}, …' },
  platzhalterHinweis: { de: 'Platzhalter in doppelten geschweiften Klammern werden je Empfänger gefüllt:', en: 'Placeholders in double curly brackets are filled in for each recipient:', fr: 'Les variables entre doubles accolades sont remplies pour chaque destinataire :' },
  spaeterSenden:      { de: 'Später senden', en: 'Send later', fr: 'Envoyer plus tard' },
  empfangBestaetigen: { de: 'Empfang bestätigen lassen', en: 'Request read receipt', fr: 'Demander un accusé de réception' },
  einplanen:          { de: 'Einplanen', en: 'Schedule', fr: 'Programmer' },
  anSenden:           { de: 'An {n} senden', en: 'Send to {n}', fr: 'Envoyer à {n}' },
  testAnMich:         { de: 'Test an mich', en: 'Test to me', fr: "M'envoyer un test" },

  // Postausgang
  postausgangLeer:   { de: 'Noch keine Mail aus diesem Projekt.', en: 'No emails from this project yet.', fr: "Aucun e-mail envoyé depuis ce projet pour l'instant." },
  geplant:           { de: 'geplant {zeit}', en: 'scheduled {zeit}', fr: 'prévu {zeit}' },
  empfangBestaetigt: { de: 'Empfang bestätigt', en: 'Receipt confirmed', fr: 'Réception confirmée' },
  erneut:            { de: 'Erneut', en: 'Retry', fr: 'Réessayer' },

  // Vorlagen
  vorlageGespeichert: { de: 'Vorlage gespeichert', en: 'Template saved', fr: 'Modèle enregistré' },
  vorlageGeloescht:   { de: 'Vorlage gelöscht', en: 'Template deleted', fr: 'Modèle supprimé' },
  neu:                { de: 'Neu', en: 'New', fr: 'Nouveau' },
  keineVorlage:       { de: 'Noch keine Vorlage.', en: 'No template yet.', fr: "Aucun modèle pour l'instant." },
  vorlageBearbeiten:  { de: 'Vorlage bearbeiten', en: 'Edit template', fr: 'Modifier le modèle' },
  vorschau:           { de: 'Vorschau', en: 'Preview', fr: 'Aperçu' },
  beispielwerte:      { de: 'Beispielwerte. Beim Versand stehen hier die echten Namen und Zeiten.', en: 'Sample values. When sent, the real names and times appear here.', fr: "Valeurs d'exemple. À l'envoi, les vrais noms et horaires apparaissent ici." },
  waehleVorlage:      { de: 'Wähle eine Vorlage aus, um sie als fertige Mail zu sehen.', en: 'Select a template to see it as a finished email.', fr: 'Choisis un modèle pour le voir sous forme de mail finalisé.' },

  // Verteiler
  verteilerAngelegt:  { de: 'Verteiler angelegt', en: 'Mailing list created', fr: 'Liste de diffusion créée' },
  verteilerGeloescht: { de: 'Verteiler gelöscht', en: 'Mailing list deleted', fr: 'Liste de diffusion supprimée' },
  adressen:           { de: '{n} Adressen', en: '{n} addresses', fr: '{n} adresses' },
  keinVerteiler:      { de: 'Noch kein Verteiler. Ein Verteiler nach Regel bleibt von allein aktuell.', en: 'No mailing list yet. A rule-based mailing list keeps itself up to date.', fr: "Aucune liste de diffusion pour l'instant. Une liste basée sur une règle se met à jour toute seule." },
  neuerVerteiler:     { de: 'Neuer Verteiler', en: 'New mailing list', fr: 'Nouvelle liste de diffusion' },
  teamPlatzhalter:    { de: 'Kamera-Team', en: 'Camera team', fr: 'Équipe caméra' },
  werGehoert:         { de: 'Wer gehört dazu', en: 'Who is included', fr: 'Qui en fait partie' },
  abteilung:          { de: 'Abteilung', en: 'Department', fr: 'Département' },
  abteilungWaehlen:   { de: 'Abteilung wählen', en: 'Choose department', fr: 'Choisir un département' },
  anlegen:            { de: 'Anlegen', en: 'Create', fr: 'Créer' },

  // Absender
  absenderGespeichert: { de: 'Absender gespeichert', en: 'Sender saved', fr: 'Expéditeur enregistré' },
  nichtGespeichert:    { de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
  absenderSignatur:    { de: 'Absender und Signatur', en: 'Sender and signature', fr: 'Expéditeur et signature' },
  absendername:        { de: 'Absendername', en: 'Sender name', fr: "Nom de l'expéditeur" },
  absenderPlatzhalter: { de: 'Produktion Sprachlos', en: 'Sprachlos Production', fr: 'Production Sprachlos' },
  absendernameHinweis: { de: 'Steht als Name vor der Absenderadresse des Servers.', en: "Shown as the name in front of the server's sender address.", fr: "Apparaît comme nom devant l'adresse d'expédition du serveur." },
  antwortadresse:      { de: 'Antwortadresse', en: 'Reply-to address', fr: 'Adresse de réponse' },
  antwortPlatzhalter:  { de: 'produktion@beispiel.de', en: 'production@example.com', fr: 'production@exemple.fr' },
  antwortHinweis:      { de: 'Hierhin geht die Antwort, wenn jemand auf „Antworten“ drückt.', en: 'Replies go here when someone clicks "Reply".', fr: "Les réponses arrivent ici quand quelqu'un clique sur « Répondre »." },
  signatur:            { de: 'Signatur', en: 'Signature', fr: 'Signature' },
  signaturPlatzhalter: { de: 'Produktion Sprachlos\nTelefon 0123 456789', en: 'Sprachlos Production\nPhone 0123 456789', fr: 'Production Sprachlos\nTéléphone 0123 456789' },
  hinweisFuss:         { de: 'Hinweis im Fuß', en: 'Footer note', fr: 'Mention en pied de page' },
  fussPlatzhalter:     { de: 'Diese Mail enthält Drehunterlagen und ist nicht für Dritte bestimmt.', en: 'This email contains production documents and is not intended for third parties.', fr: "Cet e-mail contient des documents de tournage et n'est pas destiné à des tiers." },
  vorschauVon:         { de: 'Vorschau von {name}', en: 'Preview {name}', fr: 'Aperçu de {name}' },
  bearbeitenVon:       { de: '{name} bearbeiten', en: 'Edit {name}', fr: 'Modifier {name}' },
  loeschenVon:         { de: '{name} löschen', en: 'Delete {name}', fr: 'Supprimer {name}' },
  loeschenFrage:       { de: '„{name}“ löschen? Das lässt sich nicht rückgängig machen.', en: 'Delete "{name}"? This cannot be undone.', fr: 'Supprimer « {name} » ? Cette action est irréversible.' },
  zurueckziehenAn:     { de: 'Mail an {name} zurückziehen', en: 'Withdraw email to {name}', fr: "Retirer l'e-mail à {name}" },
  gruppeAuswaehlen:    { de: 'Alle aus {gruppe} auswählen', en: 'Select everyone in {gruppe}', fr: 'Sélectionner tout {gruppe}' },
} satisfies Record<string, Text>
