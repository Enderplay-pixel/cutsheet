import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const vertragBestaetigenT = {
  nichtGespeichert:   { de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
  lade:               { de: 'Lade…', en: 'Loading…', fr: 'Chargement…' },
  linkUngueltig:      { de: 'Dieser Link gilt nicht mehr', en: 'This link is no longer valid', fr: "Ce lien n'est plus valable" },
  linkUngueltigText:  { de: 'Möglicherweise wurde der Vertrag zurückgezogen. Melden Sie sich bei der Produktion, dann bekommen Sie einen neuen Link.', en: 'The contract may have been withdrawn. Please contact the production and you will receive a new link.', fr: 'Le contrat a peut-être été retiré. Contactez la production, vous recevrez alors un nouveau lien.' },
  alsPdf:             { de: 'Als PDF öffnen', en: 'Open as PDF', fr: 'Ouvrir en PDF' },
  zustimmungDa:       { de: 'Zustimmung ist eingegangen', en: 'Consent received', fr: 'Consentement reçu' },
  seiteSchliessen:    { de: 'Sie können diese Seite schließen. Eine Kopie liegt bei der Produktion.', en: 'You can close this page. The production has a copy.', fr: 'Vous pouvez fermer cette page. La production en conserve une copie.' },
  nichtZugestimmt:    { de: 'Sie haben nicht zugestimmt', en: 'You did not consent', fr: "Vous n'avez pas donné votre consentement" },
  benachrichtigt:     { de: 'Die Produktion ist benachrichtigt und meldet sich bei Ihnen.', en: 'The production has been notified and will get in touch with you.', fr: 'La production a été prévenue et vous recontactera.' },
  erklaerung:         { de: 'Mit Ihrem Namen erklären Sie Ihre Zustimmung zu dem oben stehenden Text. Zeitpunkt und Name werden festgehalten.', en: 'By entering your name you declare your consent to the text above. The time and your name will be recorded.', fr: "En indiquant votre nom, vous donnez votre consentement au texte ci-dessus. La date, l'heure et le nom sont enregistrés." },
  ihrName:            { de: 'Ihr Name', en: 'Your name', fr: 'Votre nom' },
  vorNachname:        { de: 'Vor- und Nachname', en: 'First and last name', fr: 'Prénom et nom' },
  zustimmen:          { de: 'Zustimmen', en: 'Consent', fr: 'Je consens' },
  ichStimmeNichtZu:   { de: 'Ich stimme nicht zu', en: 'I do not consent', fr: 'Je ne consens pas' },
  grund:              { de: 'Grund (freiwillig)', en: 'Reason (optional)', fr: 'Motif (facultatif)' },
  wasSprichtDagegen:  { de: 'Was spricht dagegen?', en: 'What are your concerns?', fr: "Qu'est-ce qui vous en empêche ?" },
  nichtZustimmen:     { de: 'Nicht zustimmen', en: 'Do not consent', fr: 'Ne pas consentir' },
  fragen:             { de: 'Bei Fragen antworten Sie einfach auf die Mail, mit der Sie diesen Link bekommen haben.', en: 'If you have any questions, simply reply to the email that contained this link.', fr: "Pour toute question, répondez simplement à l'e-mail par lequel vous avez reçu ce lien." },
} satisfies Record<string, Text>
