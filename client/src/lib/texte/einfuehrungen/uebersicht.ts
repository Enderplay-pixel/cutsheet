import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Hauptseite, Stammdaten, Aufgaben. */
export const uebersicht: Record<string, Schritt[]> = {
  '': [
    {
      ziel: 'titel',
      titel: { de: 'Die Hauptseite deines Projekts', en: 'Your project’s main page', fr: 'La page principale de ton projet' },
      text: {
        de: 'Hier landest du, wenn du ein Projekt öffnest. Titel, Format, Genre, Laufzeit, Status und Kurzinhalt kommen aus den Stammdaten - ändern sie sich dort, stehen sie sofort auch hier.',
        en: 'This is where you land when you open a project. Title, format, genre, runtime, status and synopsis come from the project details - change them there and they show here at once.',
        fr: "C'est ici que tu arrives en ouvrant un projet. Titre, format, genre, durée, statut et synopsis viennent des données du projet - modifiés là-bas, ils apparaissent aussitôt ici.",
      },
      wirktAuf: ['stammdaten'],
    },
    {
      ziel: 'naechstes',
      titel: { de: 'Was als Nächstes ansteht', en: 'What comes next', fr: 'Ce qui vient ensuite' },
      text: {
        de: 'Der nächste Drehtag aus dem Drehplan, mit Datum und den Tagen bis dahin. "Tagesdispo öffnen" springt direkt in die Dispo genau dieses Tages. Dieselbe Angabe steht oben in der Kopfleiste und führt von jeder Seite aus dorthin.',
        en: 'The next shoot day from the schedule, with its date and the days left. "Open call sheet" jumps straight to that day’s call sheet. The same information sits in the header and leads there from every page.',
        fr: "Le prochain jour de tournage du plan, avec sa date et les jours restants. « Ouvrir la feuille de service » mène directement à celle de ce jour. La même info figure dans l'en-tête et y mène depuis chaque page.",
      },
      wirktAuf: ['drehplan', 'tagesdispo'],
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Die Zahlen des Projekts', en: 'The project’s figures', fr: 'Les chiffres du projet' },
      text: {
        de: 'Szenen mit der Zahl der eingeplanten, Drehtage mit der Zahl der abgedrehten, Darsteller und Stab. Jede Kachel ist ein Sprung auf die Seite, aus der ihre Zahl kommt.',
        en: 'Scenes with how many are scheduled, shoot days with how many are shot, cast and crew. Each tile jumps to the page its number comes from.',
        fr: "Les scènes avec le nombre de planifiées, les jours avec le nombre de tournés, les acteurs et l'équipe. Chaque tuile mène à la page d'où vient son chiffre.",
      },
      wirktAuf: ['drehbuch', 'drehplan', 'besetzung', 'stabliste'],
    },
    {
      ziel: 'fortschritt',
      titel: { de: 'Wie weit ihr seid', en: 'How far along you are', fr: 'Où vous en êtes' },
      text: {
        de: 'Drei Balken: wie viele Szenen schon einen Drehtag haben, wie viele Drehtage als abgedreht markiert sind und wie viele Szenen abgedreht sind - im Tagesbericht oder an der Szene abgehakt. Darunter Budget gegen Finanzierung, mit der Lücke, falls Geld fehlt.',
        en: 'Three bars: how many scenes already have a shoot day, how many shoot days are marked as shot and how many scenes are shot - ticked in the daily report or on the scene. Below, budget against financing, with the gap if money is missing.',
        fr: "Trois barres : combien de scènes ont déjà un jour de tournage, combien de jours sont marqués tournés et combien de scènes sont tournées - cochées dans le rapport journalier ou sur la scène. En dessous, le budget face au financement, avec l'écart s'il manque de l'argent.",
      },
      wirktAuf: ['tagesbericht', 'budget'],
    },
    {
      ziel: 'konflikte',
      titel: { de: 'Der Konfliktradar', en: 'The conflict radar', fr: 'Le radar des conflits' },
      text: {
        de: 'Er prüft laufend das ganze Projekt: Szenen doppelt oder gar nicht eingeplant, leere Drehtage, zu kurze Ruhezeiten, Besetzung an ihren Sperrtagen, Szenen ohne Motiv und mehr. Fehler sind rot, Warnungen gelb; beide zählt auch die Seitenleiste. "Details anzeigen" öffnet die ganze Liste.',
        en: 'It keeps checking the whole project: scenes scheduled twice or not at all, empty shoot days, rest periods too short, cast on blocked days, scenes without a location and more. Errors are red, warnings yellow; the sidebar counts both. "Show details" opens the full list.',
        fr: "Il vérifie en continu tout le projet : scènes planifiées deux fois ou pas du tout, jours vides, repos trop courts, acteurs pendant leurs jours bloqués, scènes sans décor, etc. Les erreurs sont rouges, les avertissements jaunes ; la barre latérale compte les deux. « Afficher les détails » ouvre la liste complète.",
      },
      wirktAuf: ['konfliktradar'],
    },
    {
      ziel: 'schnellzugriff',
      titel: { de: 'Schnell dorthin, wo die Arbeit ist', en: 'Quickly to where the work is', fr: 'Vite là où est le travail' },
      text: {
        de: 'Die Seiten, die man am häufigsten braucht. Mit der Tastatur geht es von überall noch schneller: D Drehplan, T Tagesdispo, S Szenen, B Besetzung, M Motive, G Budget. Strg+K öffnet die Suche, das Fragezeichen alle Tastenkürzel.',
        en: 'The pages you need most often. With the keyboard it is even faster from anywhere: D schedule, T call sheet, S scenes, B cast, M locations, G budget. Ctrl+K opens search, the question mark all shortcuts.',
        fr: "Les pages dont on a le plus souvent besoin. Au clavier, c'est encore plus rapide depuis partout : D plan, T feuille de service, S scènes, B distribution, M décors, G budget. Ctrl+K ouvre la recherche, le point d'interrogation tous les raccourcis.",
      },
    },
    {
      ziel: 'arbeitsplatz',
      titel: { de: 'Dein Arbeitsplatz', en: 'Your workspace', fr: 'Ton espace de travail' },
      text: {
        de: 'Alle Bereiche des Projekts, in Kategorien und in deiner Reihenfolge. Mit "Anordnen" ziehst du Bereiche dorthin, wo sie für deine Arbeit hingehören - auch in eine andere Kategorie - und ganze Kategorien an ihrem Griff. Die Seitenleiste übernimmt das sofort, in allen deinen Projekten. Zurück zum Standard geht es jederzeit, auch in den Einstellungen.',
        en: 'Every area of the project, in categories and in your order. With "Arrange" you drag areas to where they belong in your work - even into another category - and whole categories by their handle. The sidebar follows at once, in all your projects. You can return to the default at any time, also in the settings.',
        fr: "Tous les espaces du projet, en catégories et dans ton ordre. Avec « Organiser », tu fais glisser les espaces là où ils ont leur place - même dans une autre catégorie - et des catégories entières par leur poignée. La barre latérale suit aussitôt, dans tous tes projets. Le retour à l'ordre par défaut est possible à tout moment, aussi dans les paramètres.",
      },
    },
    {
      ziel: 'anordnen',
      titel: { de: 'Abschnitte einer Seite umstellen', en: 'Rearrange the sections of a page', fr: "Réorganiser les sections d'une page" },
      text: {
        de: 'Wo dieser Knopf erscheint, lassen sich die Abschnitte der Seite in eine eigene Reihenfolge bringen - hier Kennzahlen, Fortschritt und Arbeitsplatz, in der Tagesdispo Szenen, Besetzung und Hinweise. Am Telefon: gedrückt halten, dann ziehen.',
        en: 'Wherever this button appears, the sections of the page can be put in your own order - here key figures, progress and workspace, on the call sheet scenes, cast and notes. On a phone: press and hold, then drag.',
        fr: "Là où ce bouton apparaît, tu peux remettre les sections de la page dans ton propre ordre - ici chiffres clés, avancement et espace de travail, sur la feuille de service scènes, acteurs et consignes. Sur téléphone : maintiens appuyé, puis fais glisser.",
      },
    },
    {
      ziel: 'hilfe',
      titel: { de: 'Jede Seite erklärt sich', en: 'Every page explains itself', fr: "Chaque page s'explique" },
      text: {
        de: 'Beim ersten Öffnen zeigt dir jede Seite so wie diese, wofür sie da ist, was ihre Teile tun und wohin deine Eingaben weiterwirken. Über das Fragezeichen holst du die Einführung jederzeit zurück; mit den Pfeiltasten blätterst du, Escape beendet sie.',
        en: 'The first time you open it, every page shows you like this one what it is for, what its parts do and where your entries carry over to. The question mark brings the introduction back at any time; the arrow keys page through it, Escape ends it.',
        fr: "À la première ouverture, chaque page te montre comme celle-ci à quoi elle sert, ce que font ses parties et où tes saisies se répercutent. Le point d'interrogation relance la présentation à tout moment ; les flèches la font défiler, Échap la termine.",
      },
    },
  ],

  'creator:': [
    {
      ziel: 'titel',
      titel: { de: 'Die Hauptseite deines Kanals', en: 'Your channel’s main page', fr: 'La page principale de ta chaîne' },
      text: {
        de: 'Hier landest du, wenn du das Projekt öffnest. Titel, Format und Kurzinhalt kommen aus den Stammdaten.',
        en: 'This is where you land when you open the project. Title, format and synopsis come from the project details.',
        fr: "C'est ici que tu arrives en ouvrant le projet. Titre, format et synopsis viennent des données du projet.",
      },
      wirktAuf: ['stammdaten'],
    },
    {
      ziel: 'naechstes',
      titel: { de: 'Was als Nächstes erscheint', en: 'What comes out next', fr: 'Ce qui sort ensuite' },
      text: {
        de: 'Das nächste noch nicht veröffentlichte Video mit Termin, seinem Stand und den Tagen bis dahin. Der Knopf öffnet es direkt. Den Termin legst du im Video unter "Zahlen" als geplante Veröffentlichung fest.',
        en: 'The next unpublished video with its date, its status and the days left. The button opens it directly. You set the date in the video under "Numbers" as the planned release.',
        fr: "La prochaine vidéo non publiée avec sa date, son état et les jours restants. Le bouton l'ouvre directement. Tu fixes la date dans la vidéo, sous « Chiffres », comme publication prévue.",
      },
      wirktAuf: ['creator', 'creator/redaktionsplan'],
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Die Zahlen des Kanals', en: 'The channel’s figures', fr: 'Les chiffres de la chaîne' },
      text: {
        de: 'Videos und wie viele davon veröffentlicht sind, Aufrufe und gewonnene Abos über alle Videos, dazu die Sponsoring-Honorare. Ein Klick auf eine Kachel öffnet die Seite dahinter.',
        en: 'Videos and how many are published, views and subscribers gained across all videos, plus sponsorship fees. Click a tile to open the page behind it.',
        fr: "Les vidéos et combien sont publiées, les vues et abonnés gagnés sur toutes les vidéos, plus les cachets de sponsoring. Un clic sur une tuile ouvre la page correspondante.",
      },
      wirktAuf: ['creator', 'creator/performance', 'creator/kanal', 'creator/sponsoren'],
    },
    {
      ziel: 'fortschritt',
      titel: { de: 'Wie weit der Kanal ist', en: 'How far the channel is', fr: 'Où en est la chaîne' },
      text: {
        de: 'Wie viele Videos schon veröffentlicht sind und wie viele einen Termin haben. Ohne Termin steht ein Video in keinem Plan.',
        en: 'How many videos are already published and how many have a date. Without a date a video is in no plan.',
        fr: "Combien de vidéos sont déjà publiées et combien ont une date. Sans date, une vidéo ne figure dans aucun plan.",
      },
    },
    {
      ziel: 'schnellzugriff',
      titel: { de: 'Schnell dorthin, wo die Arbeit ist', en: 'Quickly to where the work is', fr: 'Vite là où est le travail' },
      text: {
        de: 'Videos, Ideen, Redaktionsplan, Kanal, Sponsoren und Budget. Strg+K öffnet von überall die Suche.',
        en: 'Videos, ideas, editorial plan, channel, sponsors and budget. Ctrl+K opens search from anywhere.',
        fr: 'Vidéos, idées, plan éditorial, chaîne, sponsors et budget. Ctrl+K ouvre la recherche depuis partout.',
      },
    },
    {
      ziel: 'arbeitsplatz',
      titel: { de: 'Dein Arbeitsplatz', en: 'Your workspace', fr: 'Ton espace de travail' },
      text: {
        de: 'Alle Bereiche des Kanals in deiner Reihenfolge. Mit "Anordnen" ziehst du Bereiche dorthin, wo sie für deine Arbeit hingehören - auch in eine andere Kategorie - und ganze Kategorien an ihrem Griff. Die Seitenleiste übernimmt das sofort, in allen deinen Creator-Projekten.',
        en: 'Every area of the channel in your order. With "Arrange" you drag areas to where they belong in your work - even into another category - and whole categories by their handle. The sidebar follows at once, in all your creator projects.',
        fr: "Tous les espaces de la chaîne dans ton ordre. Avec « Organiser », tu fais glisser les espaces là où ils ont leur place - même dans une autre catégorie - et des catégories entières par leur poignée. La barre latérale suit aussitôt, dans tous tes projets créateur.",
      },
    },
    {
      ziel: 'anordnen',
      titel: { de: 'Abschnitte einer Seite umstellen', en: 'Rearrange the sections of a page', fr: "Réorganiser les sections d'une page" },
      text: {
        de: 'Wo dieser Knopf erscheint, lassen sich die Abschnitte der Seite in eine eigene Reihenfolge bringen. Am Telefon: gedrückt halten, dann ziehen.',
        en: 'Wherever this button appears, the sections of the page can be put in your own order. On a phone: press and hold, then drag.',
        fr: 'Là où ce bouton apparaît, tu peux remettre les sections de la page dans ton propre ordre. Sur téléphone : maintiens appuyé, puis fais glisser.',
      },
    },
    {
      ziel: 'hilfe',
      titel: { de: 'Jede Seite erklärt sich', en: 'Every page explains itself', fr: "Chaque page s'explique" },
      text: {
        de: 'Beim ersten Öffnen zeigt dir jede Seite, wofür sie da ist, was ihre Teile tun und wohin deine Eingaben weiterwirken. Über das Fragezeichen holst du die Einführung jederzeit zurück; mit den Pfeiltasten blätterst du, Escape beendet sie.',
        en: 'The first time you open it, every page shows you what it is for, what its parts do and where your entries carry over to. The question mark brings the introduction back at any time; the arrow keys page through it, Escape ends it.',
        fr: "À la première ouverture, chaque page te montre à quoi elle sert, ce que font ses parties et où tes saisies se répercutent. Le point d'interrogation relance la présentation à tout moment ; les flèches la font défiler, Échap la termine.",
      },
    },
  ],

  stammdaten: [
    {
      ziel: 'titel',
      titel: { de: 'Die Grunddaten des Projekts', en: 'The project’s basic data', fr: 'Les données de base du projet' },
      text: {
        de: 'Alles, was das Projekt als Ganzes beschreibt. Es gibt keinen Speichern-Knopf: Jede Eingabe wird nach einem Moment gespeichert, die Anzeige oben sagt, wann.',
        en: 'Everything that describes the project as a whole. There is no save button: each entry is saved after a moment, and the indicator at the top tells you when.',
        fr: "Tout ce qui décrit le projet dans son ensemble. Pas de bouton Enregistrer : chaque saisie est enregistrée après un instant, l'indicateur en haut te dit quand.",
      },
    },
    {
      ziel: 'basisdaten',
      titel: { de: 'Basisdaten', en: 'Basic data', fr: 'Données de base' },
      text: {
        de: 'Titel, Format, Genre, Laufzeit, Status und Kurzinhalt. Der Titel steht danach sofort in Kopfleiste, Seitenleiste, auf der Hauptseite und auf den PDFs. Der Status zeigt allen im Projekt, in welcher Phase ihr seid.',
        en: 'Title, format, genre, runtime, status and synopsis. The title then shows at once in the header, sidebar, on the main page and on the PDFs. The status shows everyone in the project which phase you are in.',
        fr: "Titre, format, genre, durée, statut et synopsis. Le titre apparaît aussitôt dans l'en-tête, la barre latérale, la page principale et sur les PDF. Le statut montre à tous dans quelle phase vous êtes.",
      },
      wirktAuf: [''],
    },
    {
      ziel: 'kreativteam',
      titel: { de: 'Kreativteam', en: 'Creative team', fr: 'Équipe créative' },
      text: {
        de: 'Regie, Produktion, Kamera und Produktionsfirma. Die Regie steht im Kopf von Drehplan-, Stab- und Besetzungsliste als PDF.',
        en: 'Director, producer, camera and production company. The director appears in the header of the schedule, crew list and cast list PDFs.',
        fr: "Réalisation, production, image et société de production. La réalisation figure en tête des PDF du plan de tournage, de la liste d'équipe et de la distribution.",
      },
      wirktAuf: ['drehplan', 'stabliste', 'besetzung'],
    },
    {
      ziel: 'zeitraum',
      titel: { de: 'Zeitraum', en: 'Time frame', fr: 'Période' },
      text: {
        de: 'Drehbeginn und Drehschluss. Sie gehen in den Förderantrag, den du im Budget ausgibst. Liegt das Ende vor dem Beginn, sagt die Seite es dir.',
        en: 'First and last shoot day. They go into the funding application you export from the budget. If the end lies before the start, the page tells you.',
        fr: "Début et fin du tournage. Ils figurent dans la demande d'aide que tu exportes depuis le budget. Si la fin précède le début, la page te le signale.",
      },
      wirktAuf: ['budget'],
    },
    {
      ziel: 'grundeinstellungen',
      titel: { de: 'Grundeinstellungen für den Dreh', en: 'Basic settings for the shoot', fr: 'Réglages de base du tournage' },
      text: {
        de: 'Standard-Calltime und Drehschluss übernimmt jede neue Tagesdispo und jeder neue Tagesbericht; mit dem Drehschluss rechnet auch der Jugendschutz, wenn die Dispo keine eigene Zeit hat. Die Mindestruhezeit prüfen Konfliktradar und Timesheets. Währung und Akzentfarbe gelten in den PDFs. Ändern dürfen das nur Admins des Projekts.',
        en: 'Every new call sheet and daily report takes over the default call and wrap time; youth protection also uses the wrap time when the call sheet has no time of its own. The conflict radar and timesheets check the minimum rest period. Currency and accent colour apply in the PDFs. Only project admins can change these.',
        fr: "Chaque nouvelle feuille de service et chaque nouveau rapport reprennent l'heure d'appel et de fin par défaut ; la protection des mineurs utilise aussi l'heure de fin si la feuille n'a pas d'heure propre. Le radar des conflits et les feuilles de temps vérifient le repos minimal. Devise et couleur d'accent valent pour les PDF. Seuls les admins du projet peuvent les modifier.",
      },
      wirktAuf: ['tagesdispo', 'tagesbericht', 'konfliktradar', 'timesheets'],
    },
    {
      ziel: 'team',
      titel: { de: 'Wer im Projekt mitarbeitet', en: 'Who works on the project', fr: 'Qui travaille sur le projet' },
      text: {
        de: 'Eine Einladung ist ein Link mit einer Rolle - per Mail, kopiert oder als QR-Code zum Scannen am Set. Die Rolle legt fest, was jemand sehen und ändern darf: Admin, Produktion, Regie, Abteilungsleitung oder nur Lesen. Darunter stehen alle, die schon dabei sind.',
        en: 'An invitation is a link with a role - by email, copied or as a QR code to scan on set. The role decides what someone can see and change: admin, producer, director, head of department or read-only. Below are everyone already on board.',
        fr: "Une invitation est un lien avec un rôle - par e-mail, copié ou en QR code à scanner sur le plateau. Le rôle détermine ce que la personne peut voir et modifier : admin, production, réalisation, chef de département ou lecture seule. En dessous figurent tous ceux déjà présents.",
      },
    },
  ],

  aufgaben: [
    {
      ziel: 'titel',
      titel: { de: 'Die To-do-Liste des Projekts', en: 'The project’s to-do list', fr: 'La liste de tâches du projet' },
      text: {
        de: 'Für alles, was jemand tun muss und was sonst in einer Nachricht untergeht. Oben steht, wie viel offen und wie viel erledigt ist.',
        en: 'For everything someone has to do that would otherwise get lost in a message. At the top you see how much is open and how much is done.',
        fr: "Pour tout ce que quelqu'un doit faire et qui se perdrait sinon dans un message. En haut, tu vois ce qui est ouvert et ce qui est terminé.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Eine Aufgabe in einer Zeile', en: 'A task in one line', fr: 'Une tâche en une ligne' },
      text: {
        de: 'Was zu tun ist, wer es macht und bis wann - Enter legt sie an. Nur der Titel ist Pflicht.',
        en: 'What needs doing, who does it and by when - Enter adds it. Only the title is required.',
        fr: "Ce qu'il faut faire, qui s'en charge et pour quand - Entrée l'ajoute. Seul le titre est obligatoire.",
      },
    },
    {
      ziel: 'status',
      titel: { de: 'Status mit einem Klick', en: 'Status with one click', fr: 'Le statut en un clic' },
      text: {
        de: 'Jeder Klick auf das Zeichen schiebt die Aufgabe einen Schritt weiter: offen, in Arbeit, Abnahme, erledigt. So sieht jeder, wo etwas hängt.',
        en: 'Each click on the icon moves the task one step on: open, in progress, review, done. That way everyone sees where something is stuck.',
        fr: "Chaque clic sur l'icône fait avancer la tâche d'une étape : ouverte, en cours, validation, terminée. Ainsi chacun voit où ça bloque.",
      },
    },
    {
      ziel: 'liste',
      titel: { de: 'Offen oben, erledigt unten', en: 'Open on top, done below', fr: 'Ouvert en haut, terminé en bas' },
      text: {
        de: 'Überfällige stehen rot da. Erledigte rutschen durchgestrichen nach unten; ein Klick holt sie zurück. Gelöschte liegen noch 30 Tage im Papierkorb.',
        en: 'Overdue tasks show in red. Done ones slide down crossed out; one click brings them back. Deleted ones stay in the bin for 30 days.',
        fr: "Les tâches en retard s'affichent en rouge. Les terminées descendent, barrées ; un clic les fait revenir. Les supprimées restent 30 jours dans la corbeille.",
      },
      wirktAuf: ['papierkorb'],
    },
  ],
}
