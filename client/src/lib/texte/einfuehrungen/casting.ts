import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Besetzung, Sperrtage, Komparsen, Stab, Kontakte, Agenturen, Verträge. */
export const casting: Record<string, Schritt[]> = {
  besetzung: [
    {
      ziel: 'reiter',
      titel: { de: 'Rollen und Darsteller', en: 'Roles and cast', fr: 'Rôles et acteurs' },
      text: {
        de: 'Unter Rollen stehen die Figuren des Buchs - auch die, die beim Schreiben im Drehbuch-Editor entstehen. Unter Darsteller hängst du an jede Rolle einen Menschen, mit Gage, Agentur, Kontakt und Geburtsdatum.',
        en: 'Roles lists the characters of the script - including those created while writing in the script editor. Under Cast you attach a person to each role, with fee, agency, contact and date of birth.',
        fr: "Rôles liste les personnages du scénario - y compris ceux créés en écrivant dans l'éditeur. Sous Acteurs, tu associes une personne à chaque rôle, avec cachet, agence, contact et date de naissance.",
      },
      wirktAuf: ['screenplay-editor'],
    },
    {
      ziel: 'titel',
      titel: { de: 'Wohin ein Darsteller überall gehört', en: 'Where an actor shows up', fr: 'Où un acteur apparaît' },
      text: {
        de: 'Ein Darsteller an einer Rolle steht in der Dispo jedes Tages mit ihren Szenen. Seine Drehtage zählen hier, im DOOD und in der Kalkulation gleich; "Kosten übernehmen" im Budget holt die Gagen. Wer unter 18 ist, prüft der Jugendschutz in den Verträgen.',
        en: 'An actor attached to a role is on the call sheet of every day with that role’s scenes. Their shoot days count the same here, in the DOOD and in the budget; "Import costs" in the budget pulls in the fees. Anyone under 18 is checked by youth protection in the contracts.',
        fr: "Un acteur associé à un rôle figure sur la feuille de service de chaque jour avec les scènes de ce rôle. Ses jours de tournage comptent pareil ici, dans le DOOD et dans le budget ; « Importer les coûts » dans le budget récupère les cachets. Toute personne de moins de 18 ans est vérifiée par la protection des mineurs dans les contrats.",
      },
      wirktAuf: ['tagesdispo', 'dood', 'budget', 'vertraege'],
    },
  ],

  sperrtage: [
    {
      ziel: 'neu',
      titel: { de: 'Wann jemand nicht kann', en: 'When someone is unavailable', fr: "Quand quelqu'un n'est pas disponible" },
      text: {
        de: 'Trag für jeden Darsteller ein, von wann bis wann er nicht zur Verfügung steht, und warum - etwa eine Premiere oder ein anderer Dreh.',
        en: 'Enter for each actor from when to when they are unavailable, and why - a premiere or another shoot, for instance.',
        fr: "Indique pour chaque acteur de quand à quand il n'est pas disponible, et pourquoi - une première ou un autre tournage, par exemple.",
      },
    },
    {
      ziel: 'kalender',
      titel: { de: 'Die Wochen im Überblick', en: 'The weeks at a glance', fr: "Les semaines d'un coup d'œil" },
      text: {
        de: 'Je Darsteller eine Zeile, je Woche eine Spalte. Gesperrte Wochen sind markiert, damit man beim Planen sieht, wo es eng wird.',
        en: 'One row per actor, one column per week. Blocked weeks are marked so you can see where it gets tight while planning.',
        fr: 'Une ligne par acteur, une colonne par semaine. Les semaines bloquées sont marquées pour voir où ça coince en planifiant.',
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Überschneidungen fallen sofort auf', en: 'Overlaps show up at once', fr: 'Les chevauchements sautent aux yeux' },
      text: {
        de: 'Steht jemand an einem gesperrten Tag auf einem Drehtag - über eine Szene seiner Rolle oder von Hand in der Dispo -, meldet das diese Seite und der Konfliktradar als Fehler.',
        en: 'If someone is scheduled on a blocked day - through a scene of their role or added by hand to the call sheet - this page and the conflict radar report it as an error.',
        fr: "Si quelqu'un est prévu un jour bloqué - via une scène de son rôle ou ajouté à la main sur la feuille de service -, cette page et le radar des conflits le signalent comme erreur.",
      },
      wirktAuf: ['konfliktradar', 'drehplan'],
    },
  ],

  komparsen: [
    {
      ziel: 'titel',
      titel: { de: 'Die Komparserie', en: 'The extras', fr: 'La figuration' },
      text: {
        de: 'Name, Kontakt und Tarifgruppe je Komparse. Oben filterst du nach Tarifgruppe.',
        en: 'Name, contact and rate group for each extra. Filter by rate group at the top.',
        fr: 'Nom, contact et groupe tarifaire pour chaque figurant. Filtre par groupe tarifaire en haut.',
      },
    },
    {
      ziel: 'liste',
      titel: { de: 'Ein Drehtag genügt', en: 'One shoot day is enough', fr: 'Un jour de tournage suffit' },
      text: {
        de: 'Ein Klick auf einen Drehtag trägt den Komparsen in die Dispo dieses Tages ein, mit Call-Zeit. Von dort kennen ihn Check-in, Verpflegung, Vertrag und Jugendschutz.',
        en: 'One click on a shoot day adds the extra to that day’s call sheet, with call time. From there, check-in, catering, contract and youth protection know about them.',
        fr: "Un clic sur un jour de tournage inscrit le figurant sur la feuille de service de ce jour, avec heure de convocation. De là, l'accueil, la restauration, le contrat et la protection des mineurs le connaissent.",
      },
      wirktAuf: ['tagesdispo', 'checkin', 'catering', 'vertraege'],
    },
  ],

  stabliste: [
    {
      ziel: 'aktionen',
      titel: { de: 'Der Stab nach Abteilungen', en: 'The crew by department', fr: "L'équipe par département" },
      text: {
        de: 'Neue Personen legst du gleich in ihrer Abteilung an. Als CSV und PDF geht die Liste an alle, die sie am Set brauchen.',
        en: 'Add new people straight into their department. As CSV and PDF, the list goes to everyone who needs it on set.',
        fr: "Ajoute les nouvelles personnes directement dans leur département. En CSV et PDF, la liste va à tous ceux qui en ont besoin sur le plateau.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Der Stab steht überall mit drin', en: 'The crew is part of everything', fr: "L'équipe est partout" },
      text: {
        de: 'Jede neue Tagesdispo ruft den ganzen Stab. Tagesgage mal Drehtage holt "Kosten übernehmen" ins Budget, die Kontakte stehen in der Kontaktliste. Leute aus dem Adressbuch der Firma holst du auf der Firmenseite über "ins Projekt" hierher.',
        en: 'Every new call sheet calls the whole crew. "Import costs" brings day rate times shoot days into the budget, and the contacts appear in the contact list. People from the company address book can be added here from the company page.',
        fr: "Chaque nouvelle feuille de service convoque toute l'équipe. « Importer les coûts » amène tarif journalier fois jours de tournage dans le budget, et les contacts figurent dans la liste de contacts. Les personnes du carnet d'adresses de la société s'ajoutent ici depuis la page de la société.",
      },
      wirktAuf: ['tagesdispo', 'budget', 'kontakte'],
    },
  ],

  kontakte: [
    {
      ziel: 'filter',
      titel: { de: 'Alle an einem Ort', en: 'Everyone in one place', fr: 'Tout le monde au même endroit' },
      text: {
        de: 'Stab, Besetzung, Komparsen und die Ansprechpartner der Motive. Getippt wird hier nichts: Jede Änderung dort steht sofort auch hier.',
        en: 'Crew, cast, extras and the contacts of the locations. Nothing is typed here: every change there shows up here at once.',
        fr: "Équipe, acteurs, figurants et les contacts des décors. Rien n'est saisi ici : chaque modification là-bas apparaît aussitôt ici.",
      },
      wirktAuf: ['stabliste', 'besetzung', 'komparsen', 'motive'],
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Ins Telefon und in die Mail', en: 'Into the phone and the mail', fr: 'Dans le téléphone et les e-mails' },
      text: {
        de: 'Alle Mailadressen auf einmal kopieren, als CSV ausgeben oder als vCard ins Telefon - damit vor dem ersten Drehtag alle Nummern da sind.',
        en: 'Copy all email addresses at once, export as CSV or as vCard for the phone - so every number is there before the first shoot day.',
        fr: "Copie toutes les adresses e-mail d'un coup, exporte en CSV ou en vCard pour le téléphone - pour avoir tous les numéros avant le premier jour de tournage.",
      },
    },
  ],

  agenturen: [
    {
      ziel: 'titel',
      titel: { de: 'Rollen ausschreiben', en: 'Casting calls for roles', fr: 'Appels à candidatures pour les rôles' },
      text: {
        de: 'Agenturen führt die Firma, damit sie beim nächsten Projekt noch da sind. Hier fragst du sie für die Rollen dieses Projekts an - mehrere Rollen in einem Schreiben.',
        en: 'Agencies are kept by the company so they are still there for the next project. Here you send them requests for this project’s roles - several roles in one message.',
        fr: "Les agences sont gérées par la société pour rester disponibles au projet suivant. Ici, tu leur envoies des demandes pour les rôles de ce projet - plusieurs rôles en un seul envoi.",
      },
    },
    {
      ziel: 'reiter',
      titel: { de: 'Vom Vorschlag zur Besetzung', en: 'From proposal to cast', fr: 'De la proposition à la distribution' },
      text: {
        de: 'Die Agentur antwortet über ihren Link mit Vorschlägen. "Übernehmen" legt den Darsteller mit Rolle, Gage und Agentur in der Besetzung an - und er steht in den Dispos seiner Szenen.',
        en: 'The agency replies through its link with proposals. "Take over" adds the actor to the cast with role, fee and agency - and puts them on the call sheets of their scenes.',
        fr: "L'agence répond via son lien avec des propositions. « Reprendre » ajoute l'acteur à la distribution avec rôle, cachet et agence - et l'inscrit sur les feuilles de service de ses scènes.",
      },
      wirktAuf: ['besetzung', 'tagesdispo'],
    },
  ],

  vertraege: [
    {
      ziel: 'reiter',
      titel: { de: 'Drei Blicke auf das Papier', en: 'Three views of the paperwork', fr: 'Trois regards sur les papiers' },
      text: {
        de: 'Wer hat was: für alle aus Besetzung, Stab und Komparserie der Stand ihres Vertrags. Jugendschutz: jeder Drehtag jedes Kindes gegen § 6 JArbSchG. Vorlagen: eigene Vertragstexte.',
        en: 'Who has what: the contract status of everyone in cast, crew and extras. Youth protection: every shoot day of every child against the German youth labour law. Templates: your own contract texts.',
        fr: "Qui a quoi : l'état du contrat de chaque personne du casting, de l'équipe et de la figuration. Protection des mineurs : chaque jour de tournage de chaque enfant selon la loi allemande. Modèles : tes propres textes de contrat.",
      },
      wirktAuf: ['besetzung', 'stabliste', 'komparsen'],
    },
    {
      ziel: 'person',
      titel: { de: 'Vertrag aus der Vorlage', en: 'Contract from a template', fr: "Contrat à partir d'un modèle" },
      text: {
        de: 'Name, Rolle, Gage, Drehtage und Drehorte setzt die Vorlage selbst ein - aus Besetzung, Drehplan und Dispo. Verschickt wird ein Link zum Bestätigen; der Stand geht von Entwurf über Versendet zu Bestätigt.',
        en: 'The template fills in name, role, fee, shoot days and locations itself - from cast, schedule and call sheets. A link to confirm is sent; the status moves from draft to sent to confirmed.',
        fr: "Le modèle remplit lui-même nom, rôle, cachet, jours et lieux de tournage - depuis la distribution, le plan et les feuilles de service. Un lien de confirmation est envoyé ; l'état passe de brouillon à envoyé puis confirmé.",
      },
      wirktAuf: ['drehplan', 'tagesdispo'],
    },
  ],
}
