import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Besetzung, Sperrtage, Komparsen, Stab, Kontakte, Agenturen, Verträge. */
export const casting: Record<string, Schritt[]> = {
  besetzung: [
    {
      ziel: 'titel',
      titel: { de: 'Wer wen spielt', en: 'Who plays whom', fr: 'Qui joue qui' },
      text: {
        de: 'Die Figuren des Buchs und die Menschen, die sie spielen. Oben steht, wie viele Rollen und Darsteller es gibt und was die Gagen über alle Drehtage zusammen kosten.',
        en: 'The characters of the script and the people who play them. At the top you see how many roles and actors there are and what the fees cost across all shoot days.',
        fr: "Les personnages du scénario et les personnes qui les jouent. En haut figurent le nombre de rôles et d'acteurs et le coût des cachets sur tous les jours de tournage.",
      },
    },
    {
      ziel: 'rolle|reiter-rollen',
      reiter: 'rollen',
      titel: { de: 'Figuren', en: 'Characters', fr: 'Personnages' },
      text: {
        de: 'Jede Figur mit Altersspanne, Geschlecht und Beschreibung, dazu die Szenen, in denen sie vorkommt. Figuren entstehen auch von selbst, wenn im Drehbuch-Editor eine neue Figur spricht.',
        en: 'Each character with age range, gender and description, plus the scenes they appear in. Characters also appear by themselves when a new one speaks in the script editor.',
        fr: "Chaque personnage avec tranche d'âge, genre et description, plus les scènes où il apparaît. Les personnages naissent aussi d'eux-mêmes quand un nouveau parle dans l'éditeur.",
      },
      wirktAuf: ['screenplay-editor', 'drehbuch'],
    },
    {
      ziel: 'darsteller|reiter-darsteller',
      reiter: 'darsteller',
      titel: { de: 'Darsteller', en: 'Cast', fr: 'Acteurs' },
      text: {
        de: 'Je Darsteller die Rolle, Mail, Telefon, Agentur, Tagesgage und Geburtsdatum. Zugeklappt siehst du sofort die Drehtage und die Gage für alle Tage zusammen.',
        en: 'For each actor the role, email, phone, agency, day rate and date of birth. Collapsed, you see the shoot days and the fee for all days together at once.',
        fr: "Pour chaque acteur : rôle, e-mail, téléphone, agence, cachet journalier et date de naissance. Replié, tu vois aussitôt les jours de tournage et le cachet total.",
      },
    },
    {
      ziel: 'darsteller|reiter-darsteller',
      reiter: 'darsteller',
      titel: { de: 'Wohin ein Darsteller gehört', en: 'Where an actor belongs', fr: 'Où un acteur intervient' },
      text: {
        de: 'Hängt ein Darsteller an einer Rolle, steht er in der Dispo jedes Tages mit ihren Szenen - auch nachträglich. Seine Drehtage zählen hier, im DOOD und in der Kalkulation gleich; "Kosten übernehmen" im Budget holt die Gagen.',
        en: 'Once an actor is attached to a role, they are on the call sheet of every day with that role’s scenes - even afterwards. Their shoot days count the same here, in the DOOD and in the budget; "Import costs" in the budget pulls in the fees.',
        fr: "Dès qu'un acteur est associé à un rôle, il figure sur la feuille de service de chaque jour avec les scènes de ce rôle - même après coup. Ses jours comptent pareil ici, dans le DOOD et dans le budget ; « Importer les coûts » récupère les cachets.",
      },
      wirktAuf: ['tagesdispo', 'dood', 'budget'],
    },
    {
      ziel: 'darsteller|reiter-darsteller',
      reiter: 'darsteller',
      titel: { de: 'Kinder im Projekt', en: 'Children in the project', fr: 'Des enfants dans le projet' },
      text: {
        de: 'Mit dem Geburtsdatum prüft der Jugendschutz in den Verträgen jeden Drehtag eines Kindes gegen § 6 JArbSchG, und ein Vertrag geht an die Erziehungsberechtigten. Ohne Datum lässt sich nichts prüfen.',
        en: 'With the date of birth, youth protection in the contracts checks every shoot day of a child against the German youth labour law, and a contract goes to the guardians. Without a date nothing can be checked.',
        fr: "Avec la date de naissance, la protection des mineurs des contrats vérifie chaque jour de tournage d'un enfant selon la loi allemande, et le contrat part aux responsables légaux. Sans date, rien ne peut être vérifié.",
      },
      wirktAuf: ['vertraege'],
    },
    {
      ziel: 'export',
      titel: { de: 'Für Agenturen und das Team', en: 'For agencies and the team', fr: "Pour les agences et l'équipe" },
      text: {
        de: 'Die Besetzung als CSV für eine Tabelle oder als PDF-Besetzungsliste mit dem Kopf des Projekts. Die Kontakte stehen außerdem in der Kontaktliste.',
        en: 'The cast as CSV for a spreadsheet or as a PDF cast list with the project header. The contacts also appear in the contact list.',
        fr: "La distribution en CSV pour un tableur ou en liste PDF avec l'en-tête du projet. Les contacts figurent aussi dans la liste de contacts.",
      },
      wirktAuf: ['kontakte'],
    },
  ],

  sperrtage: [
    {
      ziel: 'titel',
      titel: { de: 'Wann wer nicht kann', en: 'Who is unavailable when', fr: "Qui n'est pas disponible quand" },
      text: {
        de: 'Sperrtage gehören vor die Drehplanung: Wer an einem Tag nicht kann, soll gar nicht erst eingeplant werden. Oben steht, wie viele Darsteller und Sperrtage es gibt.',
        en: 'Blocked days belong before scheduling: whoever can’t make a day shouldn’t be scheduled in the first place. At the top you see how many actors and blocked days there are.',
        fr: "Les jours bloqués se saisissent avant la planification : qui ne peut pas un jour ne doit pas y être prévu. En haut figure le nombre d'acteurs et de jours bloqués.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Einen Sperrtag eintragen', en: 'Add a blocked day', fr: 'Ajouter un jour bloqué' },
      text: {
        de: 'Darsteller wählen, von wann bis wann, und warum - etwa eine Premiere oder ein anderer Dreh. Ohne Ende gilt der Sperrtag nur für den ersten Tag.',
        en: 'Choose the actor, from when to when, and why - a premiere or another shoot, for instance. Without an end date the block only covers the first day.',
        fr: "Choisis l'acteur, de quand à quand, et pourquoi - une première ou un autre tournage, par exemple. Sans date de fin, le blocage ne vaut que pour le premier jour.",
      },
      wirktAuf: ['besetzung'],
    },
    {
      ziel: 'kalender',
      titel: { de: 'Die Wochen im Überblick', en: 'The weeks at a glance', fr: "Les semaines d'un coup d'œil" },
      text: {
        de: 'Je Darsteller eine Zeile, je Woche eine Spalte. Gesperrte Wochen sind markiert; wer mit der Maus darüber fährt, sieht Zeitraum und Grund. Ein Klick löscht einen Sperrtag nach einer Rückfrage.',
        en: 'One row per actor, one column per week. Blocked weeks are marked; hovering shows the period and reason. A click deletes a blocked day after confirmation.',
        fr: "Une ligne par acteur, une colonne par semaine. Les semaines bloquées sont marquées ; le survol montre la période et la raison. Un clic supprime un jour bloqué après confirmation.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Überschneidungen fallen sofort auf', en: 'Overlaps show up at once', fr: 'Les chevauchements sautent aux yeux' },
      text: {
        de: 'Steht jemand an einem gesperrten Tag auf einem Drehtag - über eine Szene seiner Rolle oder von Hand in der Dispo -, meldet das diese Seite rot über dem Kalender und der Konfliktradar als Fehler. Ausgefallene und drehfreie Tage zählen nicht.',
        en: 'If someone is scheduled on a blocked day - through a scene of their role or added by hand to the call sheet - this page reports it in red above the calendar and the conflict radar as an error. Cancelled and off days don’t count.',
        fr: "Si quelqu'un est prévu un jour bloqué - via une scène de son rôle ou ajouté à la main sur la feuille de service -, cette page le signale en rouge au-dessus du calendrier et le radar des conflits comme erreur. Les jours annulés ou sans tournage ne comptent pas.",
      },
      wirktAuf: ['konfliktradar', 'drehplan'],
    },
  ],

  komparsen: [
    {
      ziel: 'titel',
      titel: { de: 'Die Komparserie', en: 'The extras', fr: 'La figuration' },
      text: {
        de: 'Alle Komparsen des Projekts - für Massenszenen und alle, die im Bild sind, ohne eine Rolle zu spielen. Oben filterst du nach Tarifgruppe.',
        en: 'All extras of the project - for crowd scenes and everyone in shot without playing a role. Filter by rate group at the top.',
        fr: "Tous les figurants du projet - pour les scènes de foule et tous ceux à l'image sans jouer de rôle. Filtre par groupe tarifaire en haut.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Einen Komparsen anlegen', en: 'Add an extra', fr: 'Ajouter un figurant' },
      text: {
        de: 'Name, Telefon, Mail, Tarifgruppe und Notizen - direkt in einer Tabellenzeile.',
        en: 'Name, phone, email, rate group and notes - right in a table row.',
        fr: 'Nom, téléphone, e-mail, groupe tarifaire et notes - directement dans une ligne du tableau.',
      },
    },
    {
      ziel: 'liste',
      titel: { de: 'Ein Drehtag genügt', en: 'One shoot day is enough', fr: 'Un jour de tournage suffit' },
      text: {
        de: 'Ein Klick auf einen Drehtag in der Zeile trägt den Komparsen in die Dispo dieses Tages ein, mit der Call-Zeit des Tages; gibt es die Dispo noch nicht, entsteht sie dabei. Von dort kennen ihn Check-in, Verpflegung, Vertrag und Jugendschutz. Abwählen nimmt ihn wieder heraus.',
        en: 'One click on a shoot day in the row adds the extra to that day’s call sheet, with the day’s call time; if the call sheet doesn’t exist yet, it is created. From there, check-in, catering, contract and youth protection know about them. Deselecting removes them again.',
        fr: "Un clic sur un jour dans la ligne inscrit le figurant sur la feuille de service de ce jour, avec l'heure de convocation du jour ; si elle n'existe pas encore, elle est créée. De là, l'accueil, la restauration, le contrat et la protection des mineurs le connaissent. Décocher le retire.",
      },
      wirktAuf: ['tagesdispo', 'checkin', 'catering', 'vertraege'],
    },
  ],

  stabliste: [
    {
      ziel: 'titel',
      titel: { de: 'Der Stab', en: 'The crew', fr: "L'équipe" },
      text: {
        de: 'Alle hinter der Kamera, nach Abteilungen. Oben steht, wie viele es sind und was die Tagesgagen über alle Drehtage kosten.',
        en: 'Everyone behind the camera, by department. At the top you see how many there are and what the day rates cost across all shoot days.',
        fr: "Tous ceux derrière la caméra, par département. En haut figurent leur nombre et le coût des tarifs journaliers sur tous les jours.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Jemanden dazunehmen', en: 'Add someone', fr: "Ajouter quelqu'un" },
      text: {
        de: 'Abteilung wählen, "Hinzufügen" - und in der Zeile Name, Funktion, Mail, Telefon und Tagesgage eintragen. CSV und PDF geben die Liste für alle aus, die sie am Set brauchen.',
        en: 'Choose the department, "Add" - then enter name, role, email, phone and day rate in the row. CSV and PDF export the list for everyone who needs it on set.',
        fr: "Choisis le département, « Ajouter » - puis saisis nom, fonction, e-mail, téléphone et tarif journalier dans la ligne. CSV et PDF exportent la liste pour tous ceux qui en ont besoin sur le plateau.",
      },
    },
    {
      ziel: 'abteilungen|aktionen',
      titel: { de: 'Nach Abteilung', en: 'By department', fr: 'Par département' },
      text: {
        de: 'Ein Klick zeigt nur eine Abteilung. Jede Abteilung kann ihre Mailadressen auf einmal kopieren - für die Rundmail an Kamera oder Licht.',
        en: 'One click shows a single department. Each department can copy its email addresses at once - for the round mail to camera or lighting.',
        fr: "Un clic n'affiche qu'un département. Chaque département peut copier ses adresses e-mail d'un coup - pour l'envoi groupé à l'image ou à la lumière.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Der Stab steht überall mit drin', en: 'The crew is part of everything', fr: "L'équipe est partout" },
      text: {
        de: 'Jede neue Tagesdispo ruft den ganzen Stab. Tagesgage mal Drehtage holt "Kosten übernehmen" ins Budget, der Lohnexport der Timesheets rechnet damit, die Kontakte stehen in der Kontaktliste. Leute aus dem Adressbuch der Firma holst du auf der Firmenseite über "ins Projekt" hierher.',
        en: 'Every new call sheet calls the whole crew. "Import costs" brings day rate times shoot days into the budget, the timesheet payroll export uses it, and the contacts appear in the contact list. People from the company address book can be added here from the company page.',
        fr: "Chaque nouvelle feuille de service convoque toute l'équipe. « Importer les coûts » amène tarif journalier fois jours dans le budget, l'export de paie des feuilles de temps l'utilise, et les contacts figurent dans la liste de contacts. Les personnes du carnet d'adresses de la société s'ajoutent ici depuis la page de la société.",
      },
      wirktAuf: ['tagesdispo', 'budget', 'timesheets', 'kontakte'],
    },
  ],

  kontakte: [
    {
      ziel: 'titel',
      titel: { de: 'Alle Nummern an einem Ort', en: 'Every number in one place', fr: 'Tous les numéros au même endroit' },
      text: {
        de: 'Damit vor dem ersten Drehtag alle Nummern im Telefon sind. Getippt wird hier nichts: Jede Änderung in Stab, Besetzung, Komparserie oder bei einem Motiv steht sofort auch hier.',
        en: 'So every number is in the phone before the first shoot day. Nothing is typed here: every change in crew, cast, extras or a location shows up here at once.',
        fr: "Pour avoir tous les numéros dans le téléphone avant le premier jour. Rien n'est saisi ici : chaque modification de l'équipe, des acteurs, de la figuration ou d'un décor apparaît aussitôt ici.",
      },
      wirktAuf: ['stabliste', 'besetzung', 'komparsen', 'motive'],
    },
    {
      ziel: 'filter',
      titel: { de: 'Suchen und eingrenzen', en: 'Search and narrow down', fr: 'Chercher et filtrer' },
      text: {
        de: 'Das Suchfeld findet Namen, Funktionen und Nummern. Die Knöpfe daneben zeigen nur Stab, nur Besetzung, nur Komparsen oder nur die Ansprechpartner der Motive. Mailadressen und Nummern sind antippbar.',
        en: 'The search field finds names, roles and numbers. The buttons next to it show only crew, only cast, only extras or only the location contacts. Email addresses and numbers can be tapped.',
        fr: "Le champ de recherche trouve noms, fonctions et numéros. Les boutons à côté n'affichent que l'équipe, les acteurs, les figurants ou les contacts des décors. Adresses et numéros sont cliquables.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Ins Telefon und in die Mail', en: 'Into the phone and the mail', fr: 'Dans le téléphone et les e-mails' },
      text: {
        de: '"Alle E-Mails kopieren" für eine Rundmail, CSV für eine Tabelle, vCard für das Adressbuch des Telefons - eine Datei, alle Kontakte.',
        en: '"Copy all emails" for a round mail, CSV for a spreadsheet, vCard for the phone’s address book - one file, all contacts.',
        fr: "« Copier tous les e-mails » pour un envoi groupé, CSV pour un tableur, vCard pour le carnet du téléphone - un fichier, tous les contacts.",
      },
    },
  ],

  agenturen: [
    {
      ziel: 'titel',
      titel: { de: 'Rollen ausschreiben', en: 'Casting calls for roles', fr: 'Appels à candidatures pour les rôles' },
      text: {
        de: 'Agenturen führt die Firma, damit sie beim nächsten Projekt noch da sind. Hier fragst du sie für die Rollen dieses Projekts an und sammelst ihre Vorschläge ein - ohne Mailverkehr, der in Postfächern verschwindet.',
        en: 'Agencies are kept by the company so they are still there for the next project. Here you send them requests for this project’s roles and collect their proposals - without emails that disappear in inboxes.',
        fr: "Les agences sont gérées par la société pour rester disponibles au projet suivant. Ici, tu leur envoies des demandes pour les rôles de ce projet et recueilles leurs propositions - sans e-mails perdus dans les boîtes.",
      },
    },
    {
      ziel: 'neu',
      reiter: 'anfragen',
      titel: { de: 'Eine Anfrage', en: 'A request', fr: 'Une demande' },
      text: {
        de: 'Agentur, Rückmeldefrist, Betreff und Anschreiben, dazu beliebig viele Rollen - jede mit Figur aus dem Drehbuch und Gage pro Tag. Verschickt wird ein Link; die Agentur braucht kein Konto.',
        en: 'Agency, reply deadline, subject and cover letter, plus as many roles as you like - each with a character from the script and a day rate. A link is sent; the agency needs no account.',
        fr: "Agence, délai de réponse, objet et lettre, plus autant de rôles que nécessaire - chacun avec un personnage du scénario et un cachet journalier. Un lien est envoyé ; l'agence n'a pas besoin de compte.",
      },
      wirktAuf: ['besetzung'],
    },
    {
      ziel: 'neu',
      reiter: 'anfragen',
      titel: { de: 'Vom Vorschlag zur Besetzung', en: 'From proposal to cast', fr: 'De la proposition à la distribution' },
      text: {
        de: 'Die Vorschläge der Agentur erscheinen an der Anfrage. "Übernehmen" legt den Darsteller mit Rolle, Gage und Agentur in der Besetzung an - und er steht sofort in den Dispos seiner Szenen. Bleibt eine Antwort aus, schickt "Nachfassen" eine Erinnerung.',
        en: 'The agency’s proposals appear on the request. "Take over" adds the actor to the cast with role, fee and agency - and puts them on the call sheets of their scenes at once. If no answer comes, "Follow up" sends a reminder.',
        fr: "Les propositions de l'agence apparaissent sur la demande. « Reprendre » ajoute l'acteur à la distribution avec rôle, cachet et agence - et l'inscrit aussitôt sur les feuilles de service de ses scènes. Sans réponse, « Relancer » envoie un rappel.",
      },
      wirktAuf: ['besetzung', 'tagesdispo'],
    },
    {
      ziel: 'reiter-adressen',
      reiter: 'adressen',
      titel: { de: 'Das Adressbuch der Agenturen', en: 'The agency address book', fr: 'Le carnet des agences' },
      text: {
        de: 'Jede Agentur mit Ansprechpartner, Mail, Telefon, Website und Notizen, dazu wie viele Anfragen sie schon bekommen hat. Es gehört der Firma und gilt für alle ihre Projekte.',
        en: 'Each agency with contact person, email, phone, website and notes, plus how many requests it has already received. It belongs to the company and applies to all its projects.',
        fr: "Chaque agence avec contact, e-mail, téléphone, site web et notes, plus le nombre de demandes déjà reçues. Le carnet appartient à la société et vaut pour tous ses projets.",
      },
    },
  ],

  vertraege: [
    {
      ziel: 'stand',
      reiter: 'personen',
      titel: { de: 'Wer hat was unterschrieben', en: 'Who has signed what', fr: 'Qui a signé quoi' },
      text: {
        de: 'Alle aus Besetzung, Stab und Komparserie mit dem Stand ihres Vertrags: ohne Vertrag, versendet, bestätigt. "Nur offene zeigen" blendet aus, was erledigt ist.',
        en: 'Everyone in cast, crew and extras with the status of their contract: no contract, sent, confirmed. "Show only open" hides what is done.',
        fr: "Tous les membres du casting, de l'équipe et de la figuration avec l'état de leur contrat : sans contrat, envoyé, confirmé. « Afficher seulement les ouverts » masque ce qui est réglé.",
      },
      wirktAuf: ['besetzung', 'stabliste', 'komparsen'],
    },
    {
      ziel: 'person|stand',
      reiter: 'personen',
      titel: { de: 'Vertrag aus der Vorlage', en: 'Contract from a template', fr: "Contrat à partir d'un modèle" },
      text: {
        de: 'Bei einer Person wählst du eine Vorlage; Name, Rolle, Gage, Drehtage, Drehzeitraum und Drehorte setzt sie selbst ein - aus Besetzung, Drehplan und Dispo. Fehlt ein Wert, sagt die Vorschau es, bevor etwas rausgeht.',
        en: 'For a person you pick a template; it fills in name, role, fee, shoot days, shooting period and locations itself - from cast, schedule and call sheets. If a value is missing, the preview tells you before anything goes out.',
        fr: "Pour une personne, tu choisis un modèle ; il remplit lui-même nom, rôle, cachet, jours, période et lieux de tournage - depuis la distribution, le plan et les feuilles de service. S'il manque une valeur, l'aperçu le signale avant tout envoi.",
      },
      wirktAuf: ['drehplan', 'tagesdispo'],
    },
    {
      ziel: 'person|stand',
      reiter: 'personen',
      titel: { de: 'Versenden und bestätigen', en: 'Send and confirm', fr: 'Envoyer et confirmer' },
      text: {
        de: 'Verschickt wird ein Link: Die Person liest den Vertrag und bestätigt oder lehnt ab, ohne Konto. Der Stand wechselt von Entwurf über Versendet zu Bestätigt. Ein verschickter Link lässt sich zurückziehen, das PDF gibt es jederzeit.',
        en: 'A link is sent: the person reads the contract and confirms or declines, without an account. The status moves from draft to sent to confirmed. A sent link can be withdrawn, and the PDF is always available.',
        fr: "Un lien est envoyé : la personne lit le contrat et confirme ou refuse, sans compte. L'état passe de brouillon à envoyé puis confirmé. Un lien envoyé peut être retiré, et le PDF est toujours disponible.",
      },
      wirktAuf: ['email', 'abschluss'],
    },
    {
      ziel: 'jugendschutz',
      reiter: 'jugendschutz',
      titel: { de: 'Jugendschutz', en: 'Youth protection', fr: 'Protection des mineurs' },
      text: {
        de: 'Für jedes Kind prüft dieser Reiter jeden Drehtag gegen § 6 JArbSchG: erlaubte Stunden, Uhrzeiten, Bewilligung der Aufsichtsbehörde und ob sie noch gilt. Wem das Geburtsdatum fehlt, steht oben mit einem Feld zum Nachtragen; "Angaben" nimmt Erziehungsberechtigte, Bewilligung und Schulpflicht auf.',
        en: 'For every child this tab checks each shoot day against the German youth labour law: permitted hours, times of day, the authority’s permit and whether it is still valid. Anyone missing a date of birth is listed at the top with a field to add it; "Details" takes guardians, permit and schooling.',
        fr: "Pour chaque enfant, cet onglet vérifie chaque jour de tournage selon la loi allemande : heures permises, horaires, autorisation de l'administration et sa validité. Qui n'a pas de date de naissance figure en haut avec un champ pour la saisir ; « Informations » reçoit responsables légaux, autorisation et scolarité.",
      },
      wirktAuf: ['besetzung', 'komparsen', 'abschluss'],
    },
    {
      ziel: 'vorlagen',
      reiter: 'vorlagen',
      titel: { de: 'Vorlagen', en: 'Templates', fr: 'Modèles' },
      text: {
        de: 'Mitgeliefert sind Entwürfe für Darsteller, Stab und Komparsen, eine Bildrechte-Einwilligung und die Einverständniserklärung der Eltern eines Kindes - keine geprüften Verträge. Lass sie einmal prüfen und speichere das Ergebnis als eigene Vorlage - für dieses Projekt oder für alle Projekte der Firma. Platzhalter wie {{gage}} füllt CutSheet beim Anlegen.',
        en: 'The bundled texts are drafts for cast, crew and extras, an image rights consent and a parental consent form for children - not reviewed contracts. Have them checked once and save the result as your own template - for this project or all projects of the company. Placeholders like {{gage}} are filled in by CutSheet when creating a contract.',
        fr: "Les textes fournis sont des brouillons pour acteurs, équipe et figurants, un consentement de droit à l'image et une autorisation parentale pour les enfants - pas des contrats vérifiés. Fais-les vérifier une fois et enregistre le résultat comme modèle propre - pour ce projet ou tous ceux de la société. Les champs comme {{gage}} sont remplis par CutSheet à la création.",
      },
    },
  ],
}
