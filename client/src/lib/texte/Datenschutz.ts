import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const datenschutzT = {
  titel: { de: 'Datenschutzerklärung', en: 'Privacy policy', fr: 'Politique de confidentialité' },
  // Auf Deutsch leer: Der Hinweis erscheint nur in den Übersetzungen.
  verbindlich: {
    de: '',
    en: 'This translation is provided for convenience only. The German version of this privacy policy is legally binding.',
    fr: "Cette traduction est fournie à titre indicatif. Seule la version allemande de la présente politique de confidentialité fait foi.",
  },

  h1: { de: '1. Verantwortlicher', en: '1. Controller', fr: '1. Responsable du traitement' },
  p1: {
    de: '[VOR- UND NACHNAME], [ANSCHRIFT], E-Mail: [KONTAKT-E-MAIL] - verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO).',
    en: '[VOR- UND NACHNAME], [ANSCHRIFT], email: [KONTAKT-E-MAIL] - controller within the meaning of the General Data Protection Regulation (GDPR, German: DSGVO).',
    fr: '[VOR- UND NACHNAME], [ANSCHRIFT], e-mail : [KONTAKT-E-MAIL] - responsable du traitement au sens du Règlement général sur la protection des données (RGPD, en allemand : DSGVO).',
  },

  h2: { de: '2. Welche Daten wir verarbeiten', en: '2. What data we process', fr: '2. Quelles données nous traitons' },
  kontoTitel: { de: 'Konto-Daten', en: 'Account data', fr: 'Données de compte' },
  kontoText: {
    de: 'Bei der Registrierung speichern wir E-Mail-Adresse, Name und ein verschlüsseltes Passwort (bcrypt-Hash). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).',
    en: 'When you register, we store your email address, name and an encrypted password (bcrypt hash). Legal basis: Art. 6(1)(b) GDPR (performance of a contract).',
    fr: "Lors de l'inscription, nous enregistrons l'adresse e-mail, le nom et un mot de passe chiffré (hachage bcrypt). Base juridique : art. 6, par. 1, point b) du RGPD (exécution du contrat).",
  },
  produktionTitel: { de: 'Produktionsdaten', en: 'Production data', fr: 'Données de production' },
  produktionText: {
    de: 'Inhalte, die du in Projekten anlegst (Drehpläne, Kontaktdaten von Cast und Crew, Dispositionen etc.), werden ausschließlich zur Bereitstellung des Dienstes verarbeitet. Als Projektverantwortliche*r bist du dafür verantwortlich, dass du die Kontaktdaten deines Teams einpflegen darfst.',
    en: 'Content you create in projects (shooting schedules, contact details of cast and crew, call sheets etc.) is processed solely to provide the service. As the person responsible for a project, you are responsible for ensuring that you are permitted to enter your team\'s contact details.',
    fr: "Les contenus que tu crées dans les projets (plans de tournage, coordonnées du casting et de l'équipe, feuilles de service, etc.) sont traités exclusivement pour fournir le service. En tant que responsable du projet, il t'appartient de t'assurer que tu as le droit d'enregistrer les coordonnées de ton équipe.",
  },
  mailTitel: { de: 'E-Mail-Versand', en: 'Sending emails', fr: "Envoi d'e-mails" },
  mailText: {
    de: 'CutSheet versendet in deinem Auftrag E-Mails (z. B. Tagesdispositionen, Einladungen, Passwort-Resets). Dispo-E-Mails enthalten einen persönlichen Link. Öffnet die empfangende Person ihn oder bestätigt sie die Dispo, sieht die Produktion das (gesehen, bestätigt). Auf Wunsch enthält eine Mail einen Link, mit dem der Empfang bestätigt wird. Ein Zählpixel gibt es nicht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO.',
    en: 'CutSheet sends emails on your behalf (e.g. call sheets, invitations, password resets). Call sheet emails contain a personal link. If the recipient opens it or confirms the call sheet, the production can see this (seen, confirmed). On request, an email contains a link to confirm receipt. There is no tracking pixel. Legal basis: Art. 6(1)(b) and (f) GDPR.',
    fr: "CutSheet envoie des e-mails en ton nom (p. ex. feuilles de service, invitations, réinitialisations de mot de passe). Les e-mails de feuille de service contiennent un lien personnel. Si la personne destinataire l'ouvre ou confirme la feuille de service, la production le voit (vue, confirmée). Sur demande, un e-mail contient un lien permettant de confirmer la réception. Il n'y a pas de pixel de suivi. Base juridique : art. 6, par. 1, points b) et f) du RGPD.",
  },
  pushTitel: { de: 'Push-Benachrichtigungen', en: 'Push notifications', fr: 'Notifications push' },
  pushText: {
    de: 'Optional und nur nach ausdrücklicher Einwilligung im Browser (Art. 6 Abs. 1 lit. a DSGVO). Die Einwilligung kann jederzeit in den Einstellungen widerrufen werden.',
    en: 'Optional and only after explicit consent in the browser (Art. 6(1)(a) GDPR). Consent can be withdrawn at any time in the settings.',
    fr: 'Facultatives et uniquement après consentement explicite dans le navigateur (art. 6, par. 1, point a) du RGPD). Le consentement peut être retiré à tout moment dans les paramètres.',
  },
  analyseTitel: { de: 'Nutzungsanalyse (PostHog)', en: 'Usage analytics (PostHog)', fr: "Analyse d'utilisation (PostHog)" },
  analyseText: {
    de: 'Sofern aktiviert, nutzen wir PostHog (PostHog EU, Hosting in der EU) zur pseudonymisierten Analyse der Funktionsnutzung, um das Produkt zu verbessern. Übermittelt wird nur eine Kennnummer des Kontos, kein Name und keine E-Mail-Adresse. Es werden keine Daten an Server außerhalb der EU übertragen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.',
    en: 'Where enabled, we use PostHog (PostHog EU, hosted in the EU) for pseudonymised analysis of feature usage in order to improve the product. Only an account number is transmitted, no name and no email address. No data is transferred to servers outside the EU. Legal basis: Art. 6(1)(f) GDPR.',
    fr: "Lorsque cette fonction est activée, nous utilisons PostHog (PostHog EU, hébergement dans l'UE) pour une analyse pseudonymisée de l'utilisation des fonctions, afin d'améliorer le produit. Seul un numéro de compte est transmis, ni nom ni adresse e-mail. Aucune donnée n'est transférée vers des serveurs situés hors de l'UE. Base juridique : art. 6, par. 1, point f) du RGPD.",
  },
  lokalTitel: { de: 'Lokale Speicherung', en: 'Local storage', fr: 'Stockage local' },
  lokalText: {
    de: 'CutSheet speichert technisch notwendige Daten im localStorage deines Browsers (Login-Token, UI-Einstellungen). Es werden keine Werbe-Cookies gesetzt.',
    en: 'CutSheet stores technically necessary data in your browser\'s localStorage (login token, UI settings). No advertising cookies are set.',
    fr: "CutSheet enregistre les données techniquement nécessaires dans le localStorage de ton navigateur (jeton de connexion, paramètres de l'interface). Aucun cookie publicitaire n'est déposé.",
  },

  h3: { de: '3. Hosting', en: '3. Hosting', fr: '3. Hébergement' },
  p3: {
    de: 'Die Anwendung wird gehostet bei [HOSTING-ANBIETER, z. B. Render.com / Railway], Serverstandort [STANDORT]. Mit dem Anbieter besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.',
    en: 'The application is hosted by [HOSTING-ANBIETER, z. B. Render.com / Railway], server location [STANDORT]. A data processing agreement pursuant to Art. 28 GDPR has been concluded with the provider.',
    fr: "L'application est hébergée par [HOSTING-ANBIETER, z. B. Render.com / Railway], emplacement du serveur [STANDORT]. Un contrat de sous-traitance conforme à l'art. 28 du RGPD a été conclu avec le prestataire.",
  },

  h4: { de: '4. Deine Rechte', en: '4. Your rights', fr: '4. Tes droits' },
  auskunftTitel: { de: 'Auskunft & Datenübertragbarkeit', en: 'Access & data portability', fr: 'Accès et portabilité des données' },
  auskunftText: {
    de: ' (Art. 15, 20 DSGVO): In den Einstellungen kannst du jederzeit alle deine Daten als JSON exportieren.',
    en: ' (Art. 15, 20 GDPR): You can export all your data as JSON in the settings at any time.',
    fr: ' (art. 15 et 20 du RGPD) : dans les paramètres, tu peux exporter à tout moment toutes tes données au format JSON.',
  },
  loeschungTitel: { de: 'Löschung', en: 'Erasure', fr: 'Effacement' },
  loeschungText: {
    de: ' (Art. 17 DSGVO): Du kannst dein Konto in den Einstellungen selbst löschen.',
    en: ' (Art. 17 GDPR): You can delete your account yourself in the settings.',
    fr: ' (art. 17 du RGPD) : tu peux supprimer toi-même ton compte dans les paramètres.',
  },
  berichtigungTitel: { de: 'Berichtigung', en: 'Rectification', fr: 'Rectification' },
  berichtigungText: {
    de: ' (Art. 16 DSGVO): Name und E-Mail kannst du selbst ändern.',
    en: ' (Art. 16 GDPR): You can change your name and email yourself.',
    fr: ' (art. 16 du RGPD) : tu peux modifier toi-même ton nom et ton e-mail.',
  },
  widerspruchTitel: { de: 'Widerspruch & Einschränkung', en: 'Objection & restriction', fr: 'Opposition et limitation' },
  widerspruchText: {
    de: ' (Art. 18, 21 DSGVO): Wende dich an [KONTAKT-E-MAIL].',
    en: ' (Art. 18, 21 GDPR): Please contact [KONTAKT-E-MAIL].',
    fr: ' (art. 18 et 21 du RGPD) : adresse-toi à [KONTAKT-E-MAIL].',
  },
  beschwerdeTitel: { de: 'Beschwerde', en: 'Complaint', fr: 'Réclamation' },
  beschwerdeText: {
    de: ': Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.',
    en: ': You have the right to lodge a complaint with a data protection supervisory authority.',
    fr: " : tu as le droit d'introduire une réclamation auprès d'une autorité de contrôle de la protection des données.",
  },

  h5: { de: '5. Speicherdauer', en: '5. Retention period', fr: '5. Durée de conservation' },
  p5: {
    de: 'Konto- und Projektdaten werden gespeichert, solange dein Konto besteht. Löschst du dein Konto oder wird es gelöscht, entfernen wir deine Kontodaten sofort. Projekte, an denen weitere Personen mitarbeiten, gehen an das Mitglied mit der höchsten Rolle. Projekte ohne weitere Mitglieder bleiben 30 Tage erhalten: Meldest du dich in dieser Zeit mit derselben E-Mail-Adresse wieder an, bekommst du sie zurück, danach werden sie gelöscht. Mahnungen, Verträge und Rechnungen, die über CutSheet verschickt wurden, bewahren wir samt Anhang sechs Jahre ab Ende des Kalenderjahres auf (§ 257 HGB); übrige Einträge des Mailversands löschen wir nach 365 Tagen, Anhänge nach 60 Tagen.',
    en: 'Account and project data are stored for as long as your account exists. If your account is deleted, we remove your account data immediately. Projects that other people work on pass to the member with the highest role. Projects without other members are kept for 30 days: if you sign up again with the same email address during that time, you get them back; after that they are deleted. Payment reminders, contracts and invoices sent via CutSheet are kept with their attachments for six years from the end of the calendar year (§ 257 HGB); other mail log entries are deleted after 365 days, attachments after 60 days.',
    fr: "Les données de compte et de projet sont conservées tant que ton compte existe. Si ton compte est supprimé, nous effaçons immédiatement tes données de compte. Les projets auxquels d'autres personnes participent sont transmis au membre ayant le rôle le plus élevé. Les projets sans autres membres sont conservés 30 jours : si tu te réinscris pendant ce délai avec la même adresse e-mail, tu les récupères, ensuite ils sont supprimés. Les relances, contrats et factures envoyés via CutSheet sont conservés avec leurs pièces jointes pendant six ans à compter de la fin de l'année civile (§ 257 HGB) ; les autres entrées d'envoi sont supprimées après 365 jours, les pièces jointes après 60 jours.",
  },
} satisfies Record<string, Text>
