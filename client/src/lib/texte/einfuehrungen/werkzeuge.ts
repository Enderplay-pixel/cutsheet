import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Post-Produktion und Werkzeuge. */
export const werkzeuge: Record<string, Schritt[]> = {
  dood: [
    {
      ziel: 'titel',
      titel: { de: 'Day out of Days', en: 'Day out of Days', fr: 'Day out of Days' },
      text: {
        de: "Wer an welchem Drehtag gebraucht wird, als Raster - für Verträge, Gagen und Verfügbarkeitsanfragen. Oben steht, wie viele Darsteller und Drehtage es sind.",
        en: "Who is needed on which shoot day, as a grid - for contracts, fees and availability requests. At the top you see how many actors and shoot days there are.",
        fr: "Qui est nécessaire quel jour, sous forme de grille - pour les contrats, cachets et demandes de disponibilité. En haut figurent le nombre d'acteurs et de jours.",
      },
    },
    {
      ziel: 'legende',
      titel: { de: 'Die Zeichen', en: 'The symbols', fr: 'Les symboles' },
      text: {
        de: "Erster und letzter Arbeitstag, Arbeit dazwischen, der einzige Arbeitstag und Haltetage - Tage dazwischen, an denen jemand nicht dreht.",
        en: "First and last working day, work in between, a single working day and hold days - days in between when someone doesn’t shoot.",
        fr: "Premier et dernier jour, travail entre les deux, jour unique et jours de maintien - jours intermédiaires sans tournage.",
      },
    },
    {
      ziel: 'raster',
      titel: { de: 'Das Raster', en: 'The grid', fr: 'La grille' },
      text: {
        de: "Je Darsteller eine Zeile, je Drehtag eine Spalte, am Ende Arbeits- und Haltetage zusammengezählt. Die Tage kommen aus den Szenen der Rolle und aus der Dispo - dieselbe Zählung wie in Besetzung und Kalkulation. Die CSV nimmt das Raster mit in eine Tabelle.",
        en: "One row per actor, one column per shoot day, with working and hold days totalled at the end. The days come from the role’s scenes and from the call sheets - the same count as in cast and budget. The CSV takes the grid into a spreadsheet.",
        fr: "Une ligne par acteur, une colonne par jour, avec à la fin le total des jours de travail et de maintien. Les jours viennent des scènes du rôle et des feuilles de service - le même décompte que la distribution et le budget. Le CSV emporte la grille dans un tableur.",
      },
      wirktAuf: ['besetzung', 'budget', 'tagesdispo'],
    },
  ],

  postplan: [
    {
      ziel: 'titel',
      titel: { de: 'Nach dem letzten Drehtag', en: 'After the last shoot day', fr: 'Après le dernier jour' },
      text: {
        de: "Die Phasen der Post-Produktion mit Terminen und Verantwortlichen, als Zeitleiste.",
        en: "The post-production phases with dates and people responsible, as a timeline.",
        fr: "Les phases de post-production avec dates et responsables, sous forme de frise.",
      },
    },
    {
      ziel: 'phasen',
      titel: { de: 'Phasen mit einem Klick', en: 'Phases with one click', fr: 'Des phases en un clic' },
      text: {
        de: "Rohschnitt, Feinschnitt, VFX-Abnahme, Color Grading, Sounddesign, Tonmischung, DCP und Master, Ablieferung - je ein Klick legt die Phase an. Eigene Phasen über \"Neue Phase\".",
        en: "Rough cut, fine cut, VFX approval, colour grading, sound design, mix, DCP and master, delivery - one click adds each phase. Your own phases via \"New phase\".",
        fr: "Premier montage, montage fin, validation VFX, étalonnage, design sonore, mixage, DCP et master, livraison - un clic ajoute chaque phase. Tes propres phases via « Nouvelle phase ».",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Eine Phase', en: 'A phase', fr: 'Une phase' },
      text: {
        de: "Von wann bis wann, wer verantwortlich ist, Notizen und der Stand: ausstehend, in Arbeit, abgeschlossen. Der Balken zeigt, wie die Phasen aufeinander folgen und wo sie sich überschneiden.",
        en: "From when to when, who is responsible, notes and the status: pending, in progress, completed. The bar shows how the phases follow one another and where they overlap.",
        fr: "De quand à quand, qui est responsable, notes et état : en attente, en cours, terminé. La barre montre comment les phases s'enchaînent et où elles se chevauchent.",
      },
    },
  ],

  musikliste: [
    {
      ziel: 'titel',
      titel: { de: 'Jede Musik im Film', en: 'Every piece of music in the film', fr: 'Chaque musique du film' },
      text: {
        de: "Die Cue-Liste: Was läuft wo, wie lange, und wem gehören die Rechte. Gebraucht vor jeder Veröffentlichung - und für die GEMA.",
        en: "The cue sheet: what plays where, for how long, and who owns the rights. Needed before every release - and for the collecting society.",
        fr: "La cue sheet : quoi joue où, combien de temps, et à qui appartiennent les droits. Nécessaire avant chaque diffusion - et pour la société de gestion.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Ein Cue', en: 'A cue', fr: 'Un morceau' },
      text: {
        de: "Titel, Komponist, Textdichter, Verlag, Szene und Dauer in Minuten:Sekunden, dazu die Art der Nutzung - unterlegt, aus einer Quelle im Bild, Thema, Jingle - und die Art der Rechte: Lizenz, eigene Komposition, gemeinfrei, GEMA-frei.",
        en: "Title, composer, lyricist, publisher, scene and duration in minutes:seconds, plus the type of use - underscore, source in shot, theme, jingle - and the type of rights: licence, original composition, public domain, royalty-free.",
        fr: "Titre, compositeur, parolier, éditeur, scène et durée en minutes:secondes, plus le type d'utilisation - fond, source à l'image, thème, jingle - et le type de droits : licence, composition originale, domaine public, libre de droits.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Für die Meldung', en: 'For reporting', fr: 'Pour la déclaration' },
      text: {
        de: "Die CSV enthält alle Angaben je Cue und ist die Grundlage für die Musikmeldung.",
        en: "The CSV contains all details per cue and is the basis for the music report.",
        fr: "Le CSV contient toutes les infos par morceau et sert de base à la déclaration musicale.",
      },
    },
  ],

  email: [
    {
      ziel: 'titel',
      titel: { de: 'Alles, was das Projekt verschickt', en: 'Everything the project sends', fr: 'Tout ce que le projet envoie' },
      text: {
        de: "Vorlagen, Verteiler und Versand, mit Protokoll. Ist noch kein Mailserver eingerichtet, sagt die Seite es oben.",
        en: "Templates, mailing lists and sending, with a log. If no mail server is set up yet, the page says so at the top.",
        fr: "Modèles, listes de diffusion et envoi, avec historique. Si aucun serveur mail n'est configuré, la page le signale en haut.",
      },
    },
    {
      ziel: 'reiter-verfassen',
      reiter: 'verfassen',
      titel: { de: 'Verfassen', en: 'Compose', fr: 'Rédiger' },
      text: {
        de: "Empfänger aus einem Verteiler oder einzeln aus Stab und Besetzung, dann Betreff und Text - auf Wunsch aus einer Vorlage. Platzhalter wie {{vorname}} füllt CutSheet je Empfänger. \"Test an mich\" zeigt die Mail vorher, \"Später senden\" plant sie ein, \"Empfang bestätigen lassen\" bittet um eine Bestätigung.",
        en: "Recipients from a mailing list or individually from crew and cast, then subject and text - from a template if you like. Placeholders like {{vorname}} are filled in per recipient. \"Test to me\" shows the email first, \"Send later\" schedules it, \"Request confirmation\" asks for a receipt.",
        fr: "Destinataires depuis une liste ou un par un dans l'équipe et le casting, puis objet et texte - depuis un modèle si tu veux. Les champs comme {{vorname}} sont remplis par destinataire. « Test à moi » montre l'e-mail d'abord, « Envoyer plus tard » le programme, « Demander une confirmation » sollicite un accusé.",
      },
      wirktAuf: ['stabliste', 'besetzung'],
    },
    {
      ziel: 'reiter-vorlagen',
      reiter: 'vorlagen',
      titel: { de: 'Vorlagen', en: 'Templates', fr: 'Modèles' },
      text: {
        de: "Texte, die immer wieder rausgehen, mit Platzhaltern. Die Vorschau zeigt die fertige Mail mit Beispielwerten; beim Versand stehen dort die echten Namen und Zeiten.",
        en: "Texts that go out again and again, with placeholders. The preview shows the finished email with sample values; when sending, the real names and times appear.",
        fr: "Les textes envoyés régulièrement, avec champs. L'aperçu montre l'e-mail final avec des valeurs d'exemple ; à l'envoi, les vrais noms et horaires y figurent.",
      },
    },
    {
      ziel: 'reiter-verteiler',
      reiter: 'verteiler',
      titel: { de: 'Verteiler', en: 'Mailing lists', fr: 'Listes de diffusion' },
      text: {
        de: "Gruppen wie \"Kamera-Team\". Ein Verteiler nach Regel - etwa eine Abteilung - bleibt von allein aktuell, wenn jemand dazukommt oder geht.",
        en: "Groups like \"Camera team\". A rule-based list - a department, say - stays up to date by itself when someone joins or leaves.",
        fr: "Des groupes comme « Équipe image ». Une liste par règle - un département, par exemple - reste à jour seule quand quelqu'un arrive ou part.",
      },
      wirktAuf: ['stabliste'],
    },
    {
      ziel: 'reiter-postausgang',
      reiter: 'postausgang',
      titel: { de: 'Postausgang', en: 'Outbox', fr: "Boîte d'envoi" },
      text: {
        de: "Jede Mail des Projekts - Dispos, Verträge, Abnahmen, Agenturanfragen und eigene - mit ihrem Stand: wartet, geplant, gesendet, Empfang bestätigt oder fehlgeschlagen. Was hängen blieb, schickst du mit \"Erneut\" noch einmal; eine wartende Mail lässt sich zurückziehen.",
        en: "Every email of the project - call sheets, contracts, reviews, agency requests and your own - with its status: waiting, scheduled, sent, receipt confirmed or failed. Resend what got stuck with \"Retry\"; a waiting email can be withdrawn.",
        fr: "Chaque e-mail du projet - feuilles de service, contrats, validations, demandes d'agence et les tiens - avec son état : en attente, programmé, envoyé, réception confirmée ou échoué. Renvoie ce qui est bloqué avec « Réessayer » ; un e-mail en attente peut être retiré.",
      },
      wirktAuf: ['tagesdispo', 'vertraege', 'abnahme', 'agenturen'],
    },
    {
      ziel: 'reiter-absender',
      reiter: 'absender',
      titel: { de: 'Absender', en: 'Sender', fr: 'Expéditeur' },
      text: {
        de: "Der Name vor der Absenderadresse, die Antwortadresse - dorthin geht es, wenn jemand auf \"Antworten\" drückt - und die Signatur unter jeder Mail des Projekts.",
        en: "The name in front of the sender address, the reply address - where it goes when someone hits \"Reply\" - and the signature under every email of the project.",
        fr: "Le nom devant l'adresse d'envoi, l'adresse de réponse - là où va la réponse quand quelqu'un clique « Répondre » - et la signature sous chaque e-mail du projet.",
      },
    },
  ],

  pinboard: [
    {
      ziel: 'titel',
      titel: { de: 'Für alles, was in keine Liste passt', en: 'For everything that fits no list', fr: "Pour tout ce qui n'entre dans aucune liste" },
      text: {
        de: "Gedanken, Erinnerungen, Absprachen - als Zettel, die jeder im Projekt sieht.",
        en: "Thoughts, reminders, agreements - as notes everyone in the project sees.",
        fr: 'Idées, rappels, accords - sous forme de notes visibles par tout le projet.',
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Ein neuer Zettel', en: 'A new note', fr: 'Une nouvelle note' },
      text: {
        de: "Legt einen leeren Zettel an, in den du gleich schreibst.",
        en: "Adds an empty note you can write in right away.",
        fr: "Crée une note vide où tu écris aussitôt.",
      },
    },
    {
      ziel: 'zettel',
      titel: { de: 'Schreiben, färben, wegwerfen', en: 'Write, colour, discard', fr: 'Écrire, colorer, jeter' },
      text: {
        de: "In einen Zettel tippst du direkt, gespeichert wird von selbst. Die Punkte unten geben ihm eine Farbe - etwa eine je Abteilung -, das Kreuz wirft ihn weg.",
        en: "Type straight into a note; it saves by itself. The dots at the bottom give it a colour - one per department, say - and the cross throws it away.",
        fr: "Tape directement dans une note ; elle s'enregistre seule. Les points en bas lui donnent une couleur - une par département, par exemple - et la croix la jette.",
      },
    },
  ],

  aktivitaet: [
    {
      ziel: 'titel',
      titel: { de: 'Was zuletzt passiert ist', en: 'What happened recently', fr: "Ce qui s'est passé récemment" },
      text: {
        de: "Die letzten Änderungen im Projekt, neueste zuerst: wer was angelegt, geändert oder gelöscht hat. Gut für den Montag nach einem Wochenende.",
        en: "The latest changes in the project, newest first: who created, changed or deleted what. Good for the Monday after a weekend.",
        fr: "Les dernières modifications du projet, les plus récentes d'abord : qui a créé, modifié ou supprimé quoi. Pratique le lundi après un week-end.",
      },
    },
    {
      ziel: 'filter',
      titel: { de: 'Nur eine Art', en: 'Only one kind', fr: 'Un seul type' },
      text: {
        de: "Zeigt nur Änderungen an einer Art von Daten, etwa nur Szenen oder nur Personen. Die vollständige Liste mit Inhalten vorher und nachher steht im Audit-Log.",
        en: "Shows only changes to one kind of data, such as only scenes or only people. The complete list with contents before and after is in the audit log.",
        fr: "N'affiche que les modifications d'un type de données, par exemple seulement les scènes ou les personnes. La liste complète avec contenus avant et après figure dans le journal d'audit.",
      },
      wirktAuf: ['audit'],
    },
  ],

  suche: [
    {
      ziel: 'suche',
      titel: { de: 'Wenn du weißt, wie es heißt', en: 'When you know what it’s called', fr: "Quand tu sais comment ça s'appelle" },
      text: {
        de: "Sucht über Szenen, Rollen, Besetzung, Stab und Motive, schon beim Tippen. Strg+K öffnet die Suche von jeder Seite aus.",
        en: "Searches scenes, roles, cast, crew and locations as you type. Ctrl+K opens search from any page.",
        fr: "Cherche parmi scènes, rôles, acteurs, équipe et décors pendant la saisie. Ctrl+K ouvre la recherche depuis n'importe quelle page.",
      },
    },
    {
      ziel: 'suche',
      titel: { de: 'Alles zu einer Figur', en: 'Everything about a character', fr: "Tout sur un personnage" },
      text: {
        de: "Eine Figur oder ihre Darstellerin bringt alles mit: wer sie spielt, ihre Szenen und ihre Drehtage - mit Sprung in die Dispo genau dieses Tages.",
        en: "A character or their actor brings everything along: who plays them, their scenes and their shoot days - with a jump to that exact day’s call sheet.",
        fr: "Un personnage ou son interprète amène tout : qui le joue, ses scènes et ses jours - avec accès direct à la feuille de service de ce jour précis.",
      },
      wirktAuf: ['besetzung', 'drehbuch', 'tagesdispo'],
    },
  ],

  audit: [
    {
      ziel: 'titel',
      titel: { de: 'Wer hat das geändert', en: 'Who changed that', fr: "Qui a modifié ça" },
      text: {
        de: "Jede Änderung im Projekt mit Zeitpunkt, Person und Inhalt vorher und nachher - für die Frage, wer was wann geändert hat.",
        en: "Every change in the project with time, person and content before and after - for the question of who changed what and when.",
        fr: "Chaque modification du projet avec date, personne et contenu avant et après - pour savoir qui a modifié quoi et quand.",
      },
    },
    {
      ziel: 'filter',
      titel: { de: 'Eingrenzen', en: 'Narrow down', fr: 'Filtrer' },
      text: {
        de: "Nach Person, Aktion, Bereich, Zeitraum und Text. Das Ergebnis lässt sich seitenweise durchblättern und als CSV ausgeben.",
        en: "By person, action, area, period and text. The result can be paged through and exported as CSV.",
        fr: "Par personne, action, domaine, période et texte. Le résultat se parcourt page par page et s'exporte en CSV.",
      },
    },
  ],

  datenschutz: [
    {
      ziel: 'titel',
      titel: { de: 'Wenn jemand nach seinen Daten fragt', en: 'When someone asks about their data', fr: "Quand quelqu'un demande ses données" },
      text: {
        de: "Werkzeuge für die Rechte nach der DSGVO, bezogen auf dieses Projekt.",
        en: "Tools for the rights under the GDPR, for this project.",
        fr: "Des outils pour les droits issus du RGPD, pour ce projet.",
      },
    },
    {
      ziel: 'reiter-auskunft',
      reiter: 'auskunft',
      titel: { de: 'Auskunft', en: 'Subject access', fr: "Droit d'accès" },
      text: {
        de: "Person aus Stab, Besetzung oder Komparserie wählen: Alles, was dieses Projekt über sie gespeichert hat, steht an einer Stelle - als Datei zum Weitergeben.",
        en: "Choose a person from crew, cast or extras: everything this project has stored about them appears in one place - as a file to hand over.",
        fr: "Choisis une personne de l'équipe, du casting ou de la figuration : tout ce que ce projet a stocké sur elle apparaît au même endroit - en fichier à transmettre.",
      },
    },
    {
      ziel: 'reiter-loeschen',
      reiter: 'loeschen',
      titel: { de: 'Daten entfernen', en: 'Remove data', fr: 'Supprimer des données' },
      text: {
        de: "Entfernt den Bezug zur Person: Name, Kontakt, Notizen, Geburtsdatum und Erziehungsberechtigte werden geleert, der Name durch die Funktion ersetzt. Dispositionen und Arbeitszeiten bleiben ohne Namen als Produktionsunterlage. Der Grund kommt ins Protokoll; rückgängig machen lässt sich das nicht.",
        en: "Removes the link to the person: name, contact, notes, date of birth and guardians are cleared and the name is replaced by the role. Call sheets and working hours remain without names as production records. The reason goes into the log; this cannot be undone.",
        fr: "Supprime le lien avec la personne : nom, contact, notes, date de naissance et responsables légaux sont effacés, le nom remplacé par la fonction. Feuilles de service et heures de travail restent sans nom comme documents de production. Le motif va dans le journal ; impossible d'annuler.",
      },
      wirktAuf: ['audit'],
    },
    {
      ziel: 'reiter-zugriff',
      reiter: 'zugriff',
      titel: { de: 'Wer sieht was', en: 'Who sees what', fr: 'Qui voit quoi' },
      text: {
        de: "Alle Mitglieder des Projekts mit ihrer Rolle und was diese Rolle sehen und ändern darf. Rollen vergibst du in den Stammdaten.",
        en: "All project members with their role and what that role can see and change. You assign roles in the project details.",
        fr: "Tous les membres du projet avec leur rôle et ce que ce rôle peut voir et modifier. Les rôles s'attribuent dans les données du projet.",
      },
      wirktAuf: ['stammdaten'],
    },
  ],

  listen: [
    {
      ziel: 'titel',
      titel: { de: 'Aus Tabellen und in Tabellen', en: 'From spreadsheets and into them', fr: 'Depuis et vers des tableurs' },
      text: {
        de: "Wenn Daten schon in einer Tabelle stehen oder dorthin sollen.",
        en: "When data is already in a spreadsheet or needs to go there.",
        fr: "Quand les données sont déjà dans un tableur ou doivent y aller.",
      },
    },
    {
      ziel: 'reiter-einlesen',
      reiter: 'einlesen',
      titel: { de: 'Einlesen', en: 'Import', fr: 'Importer' },
      text: {
        de: "Stab, Besetzung oder Komparserie aus einer CSV - Datei wählen oder Text einfügen. Erst kommt eine Vorschau: was neu ist, was ergänzt und was übersprungen wird. Übernommen wird erst auf deinen Klick.",
        en: "Crew, cast or extras from a CSV - choose a file or paste text. First comes a preview: what is new, what gets added to and what is skipped. Nothing is taken over until you click.",
        fr: "Équipe, acteurs ou figurants depuis un CSV - choisis un fichier ou colle du texte. D'abord un aperçu : ce qui est nouveau, complété ou ignoré. Rien n'est repris avant ton clic.",
      },
      wirktAuf: ['stabliste', 'besetzung', 'komparsen'],
    },
    {
      ziel: 'reiter-ausgeben',
      reiter: 'ausgeben',
      titel: { de: 'Ausgeben', en: 'Export', fr: 'Exporter' },
      text: {
        de: "Stab, Besetzung, Szenen und Drehplan als CSV - für Tabellen, Buchhaltung oder andere Programme.",
        en: "Crew, cast, scenes and schedule as CSV - for spreadsheets, accounting or other programs.",
        fr: "Équipe, acteurs, scènes et plan en CSV - pour tableurs, comptabilité ou autres logiciels.",
      },
    },
  ],

  papierkorb: [
    {
      ziel: 'titel',
      titel: { de: 'Nach einem Fehlklick', en: 'After a misclick', fr: 'Après un mauvais clic' },
      text: {
        de: "Was gelöscht wurde, bleibt hier 30 Tage liegen und lässt sich zurückholen.",
        en: "Whatever was deleted stays here for 30 days and can be restored.",
        fr: "Ce qui a été supprimé reste ici 30 jours et peut être restauré.",
      },
    },
    {
      ziel: 'liste',
      titel: { de: 'Zurückholen', en: 'Restore', fr: 'Restaurer' },
      text: {
        de: "Szenen, Rollen, Darsteller, Stab, Komparsen, Motive, Drehtage, Einstellungen, Equipment, Aufgaben, Fahrzeuge und Budgetposten - jeweils mit Zeitpunkt und wer gelöscht hat. Zurückholen darf, wer auch löschen darf; Verbindungen wie die Figuren einer Szene kommen mit.",
        en: "Scenes, roles, actors, crew, extras, locations, shoot days, shots, equipment, tasks, vehicles and budget lines - each with the time and who deleted it. Anyone allowed to delete may restore; links such as a scene’s characters come back too.",
        fr: "Scènes, rôles, acteurs, équipe, figurants, décors, jours, plans, matériel, tâches, véhicules et lignes de budget - chacun avec la date et qui l'a supprimé. Qui peut supprimer peut restaurer ; les liens comme les personnages d'une scène reviennent aussi.",
      },
    },
  ],
}
