import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const abnahmeAnsichtT = {
  anmerkungGespeichert: { de: 'Anmerkung gespeichert', en: 'Note saved', fr: 'Remarque enregistrée' },
  nichtGespeichert:     { de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
  lade:                 { de: 'Lade…', en: 'Loading…', fr: 'Chargement…' },
  linkUngueltig:        { de: 'Dieser Link gilt nicht mehr', en: 'This link is no longer valid', fr: "Ce lien n'est plus valable" },
  linkUngueltigText:    { de: 'Möglicherweise ist eine neuere Fassung unterwegs. Eine kurze Mail an die Produktion genügt, dann bekommen Sie einen neuen Link.', en: 'A newer cut may be on its way. A short email to the production is enough and you will receive a new link.', fr: "Une version plus récente est peut-être en route. Un court e-mail à la production suffit pour recevoir un nouveau lien." },
  laenge:               { de: 'Länge {n}', en: 'Length {n}', fr: 'Durée {n}' },
  rueckmeldungBis:      { de: ' · Rückmeldung erbeten bis {datum}', en: ' · Feedback requested by {datum}', fr: ' · Retour souhaité avant le {datum}' },
  fassungAnsehen:       { de: 'Fassung ansehen', en: 'Watch cut', fr: 'Voir la version' },
  abgenommen:           { de: 'Abgenommen', en: 'Approved', fr: 'Validée' },
  seiteSchliessen:      { de: 'Sie können diese Seite schließen. Das Protokoll liegt bei der Produktion.', en: 'You can close this page. The record is kept by the production.', fr: 'Vous pouvez fermer cette page. Le procès-verbal est conservé par la production.' },
  anmerkung:            { de: 'Anmerkung', en: 'Note', fr: 'Remarque' },
  stelle:               { de: 'Stelle', en: 'Timecode', fr: 'Moment' },
  ihrName:              { de: 'Ihr Name', en: 'Your name', fr: 'Votre nom' },
  wasFaelltAuf:         { de: 'Was fällt auf?', en: 'What stands out?', fr: "Qu'avez-vous remarqué ?" },
  beispiel:             { de: 'Bei 2:14 ist der Ton zu laut.', en: 'At 2:14 the sound is too loud.', fr: 'À 2:14, le son est trop fort.' },
  hinzufuegen:          { de: 'Anmerkung hinzufügen', en: 'Add note', fr: 'Ajouter une remarque' },
  stelleFreiwillig:     { de: 'Die Stelle ist freiwillig, hilft aber sehr. Sie können so viele Anmerkungen hinterlassen, wie Sie möchten.', en: 'The timecode is optional but helps a lot. You can leave as many notes as you like.', fr: 'Le moment est facultatif, mais aide beaucoup. Vous pouvez laisser autant de remarques que vous le souhaitez.' },
  bisher:               { de: 'Bisher ({n})', en: 'So far ({n})', fr: "Jusqu'ici ({n})" },
  entscheidenText:      { de: 'Wenn Sie durch sind: Nehmen Sie die Fassung ab oder sagen Sie, dass eine Runde fehlt. Beides wird mit Ihrem Namen und dem Zeitpunkt festgehalten.', en: 'When you are done: approve the cut or let us know that another round is needed. Either way, your name and the time are recorded.', fr: "Quand vous avez terminé : validez la version ou indiquez qu'il manque une session. Dans les deux cas, votre nom et l'heure sont consignés." },
  nameEintragen:        { de: 'Bitte oben den Namen eintragen.', en: 'Please enter your name above.', fr: 'Veuillez saisir votre nom ci-dessus.' },
  anmerkungEntscheidung:{ de: 'Anmerkung zur Entscheidung', en: 'Note on the decision', fr: 'Remarque sur la décision' },
  freiwillig:           { de: 'freiwillig', en: 'optional', fr: 'facultatif' },
  abnehmen:             { de: 'Abnehmen', en: 'Approve', fr: 'Valider' },
  nochEineRunde:        { de: 'Noch eine Runde', en: 'Another round', fr: 'Encore une session' },
  nachbesserung:        { de: 'Sie haben eine Nachbesserung verlangt. Sobald eine neue Fassung vorliegt, bekommen Sie einen neuen Link.', en: 'You have requested changes. As soon as a new cut is ready, you will receive a new link.', fr: "Vous avez demandé des corrections. Dès qu'une nouvelle version sera prête, vous recevrez un nouveau lien." },
  fragen:               { de: 'Bei Fragen antworten Sie einfach auf die Mail, mit der Sie diesen Link bekommen haben.', en: 'If you have any questions, simply reply to the email that brought you this link.', fr: "Pour toute question, répondez simplement à l'e-mail par lequel vous avez reçu ce lien." },
} satisfies Record<string, Text>
