import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Öffentliche Antwortseite für Agenturen - gesiezt, im Französischen mit "vous". */
export const castingAntwortT = {
  nichtGesendet: { de: 'Nicht gesendet', en: 'Not sent', fr: 'Non envoyé' },
  lade: { de: 'Lade…', en: 'Loading…', fr: 'Chargement…' },
  linkUngueltig: { de: 'Dieser Link gilt nicht mehr', en: 'This link is no longer valid', fr: "Ce lien n'est plus valable" },
  linkUngueltigText: {
    de: 'Möglicherweise ist die Anfrage zurückgezogen worden. Eine kurze Mail an die Produktion genügt, dann bekommen Sie einen neuen Link.',
    en: 'The request may have been withdrawn. A short email to the production is all it takes to get a new link.',
    fr: 'La demande a peut-être été retirée. Un court e-mail à la production suffit pour recevoir un nouveau lien.',
  },
  besetzungsanfrage: { de: 'Besetzungsanfrage', en: 'Casting request', fr: 'Demande de casting' },
  rueckmeldungBis: { de: 'Rückmeldung erbeten bis {datum}', en: 'Please reply by {datum}', fr: 'Réponse souhaitée avant le {datum}' },
  gesucht: { de: 'Gesucht', en: 'Wanted', fr: 'Recherché' },
  rolle: { de: 'Rolle', en: 'Role', fr: 'Rôle' },
  rolleNr: { de: 'Rolle {n}', en: 'Role {n}', fr: 'Rôle {n}' },
  bisDatum: { de: ' bis {datum}', en: ' to {datum}', fr: ' au {datum}' },
  drehtag: { de: 'Drehtag', en: 'shoot day', fr: 'jour de tournage' },
  drehtage: { de: 'Drehtage', en: 'shoot days', fr: 'jours de tournage' },
  proTag: { de: '{betrag} pro Tag', en: '{betrag} per day', fr: '{betrag} par jour' },
  gageNachAbsprache: { de: 'Gage nach Absprache', en: 'Fee negotiable', fr: 'Cachet à convenir' },
  angekommen: { de: 'Ihre Vorschläge sind angekommen', en: 'Your suggestions have arrived', fr: 'Vos propositions nous sont bien parvenues' },
  angekommenText: {
    de: 'Die Produktion meldet sich bei Ihnen. Über diesen Link können Sie Ihre Antwort jederzeit überarbeiten.',
    en: 'The production will get back to you. You can revise your reply at any time using this link.',
    fr: 'La production reviendra vers vous. Ce lien vous permet de modifier votre réponse à tout moment.',
  },
  antwortAendern: { de: 'Antwort ändern', en: 'Change reply', fr: 'Modifier la réponse' },
  ihreVorschlaege: { de: 'Ihre Vorschläge', en: 'Your suggestions', fr: 'Vos propositions' },
  name: { de: 'Name', en: 'Name', fr: 'Nom' },
  vorUndNachname: { de: 'Vor- und Nachname', en: 'First and last name', fr: 'Prénom et nom' },
  fuerWelcheRolle: { de: 'Für welche Rolle', en: 'For which role', fr: 'Pour quel rôle' },
  waehlen: { de: 'wählen', en: 'choose', fr: 'choisir' },
  gageTag: { de: 'Gage / Tag', en: 'Fee / day', fr: 'Cachet / jour' },
  freiwillig: { de: 'freiwillig', en: 'optional', fr: 'facultatif' },
  verfuegbar: { de: 'Im Zeitraum verfügbar', en: 'Available during the period', fr: 'Disponible sur la période' },
  ja: { de: 'Ja', en: 'Yes', fr: 'Oui' },
  nein: { de: 'Nein', en: 'No', fr: 'Non' },
  nochOffen: { de: 'Noch offen', en: 'Not yet known', fr: 'Pas encore défini' },
  linkMaterial: { de: 'Link zu Material', en: 'Link to material', fr: 'Lien vers le matériel' },
  materialBeispiel: {
    de: 'Showreel, Vita, Fotos - freiwillig',
    en: 'Showreel, CV, photos - optional',
    fr: 'Bande démo, CV, photos - facultatif',
  },
  anmerkung: { de: 'Anmerkung', en: 'Note', fr: 'Remarque' },
  vorschlagEntfernen: { de: 'Vorschlag entfernen', en: 'Remove suggestion', fr: 'Supprimer la proposition' },
  entfernen: { de: 'Entfernen', en: 'Remove', fr: 'Supprimer' },
  weitererVorschlag: { de: 'Weiterer Vorschlag', en: 'Another suggestion', fr: 'Autre proposition' },
  absenden: { de: 'Absenden', en: 'Send', fr: 'Envoyer' },
  zeilenOhneNamen: {
    de: 'Zeilen ohne Namen werden nicht übernommen. Sie können die Antwort über denselben Link später ändern.',
    en: 'Rows without a name are not included. You can change your reply later using the same link.',
    fr: 'Les lignes sans nom ne sont pas prises en compte. Vous pourrez modifier votre réponse plus tard avec le même lien.',
  },
  beiFragen: {
    de: 'Bei Fragen antworten Sie einfach auf die Mail, mit der Sie diesen Link bekommen haben.',
    en: 'If you have any questions, simply reply to the email in which you received this link.',
    fr: "Pour toute question, répondez simplement à l'e-mail par lequel vous avez reçu ce lien.",
  },
} satisfies Record<string, Text>
