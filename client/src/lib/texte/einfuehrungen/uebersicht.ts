import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Hauptseite, Stammdaten, Aufgaben. */
export const uebersicht: Record<string, Schritt[]> = {
  '': [
    {
      ziel: 'naechstes',
      titel: { de: 'Was als Nächstes ansteht', en: 'What comes next', fr: 'Ce qui vient ensuite' },
      text: {
        de: 'Hier steht der nächste Drehtag mit den Tagen bis dahin. Der Knopf öffnet direkt seine Tagesdispo.',
        en: 'This shows the next shoot day and how many days are left. The button opens its call sheet directly.',
        fr: 'Ici figure le prochain jour de tournage et le nombre de jours restants. Le bouton ouvre directement sa feuille de service.',
      },
      wirktAuf: ['tagesdispo'],
    },
    {
      ziel: 'konflikte',
      titel: { de: 'Der Konfliktradar', en: 'The conflict radar', fr: 'Le radar des conflits' },
      text: {
        de: 'Er prüft den ganzen Plan: Szenen doppelt oder gar nicht eingeplant, zu kurze Ruhezeiten, Besetzung an ihren Sperrtagen und mehr. Fehler und Warnungen zählt auch die Seitenleiste.',
        en: 'It checks the whole plan: scenes scheduled twice or not at all, rest periods that are too short, cast on their blocked days and more. The sidebar counts errors and warnings too.',
        fr: 'Il vérifie tout le plan : scènes planifiées deux fois ou pas du tout, temps de repos trop courts, acteurs pendant leurs jours bloqués, etc. La barre latérale compte aussi les erreurs et les avertissements.',
      },
      wirktAuf: ['konfliktradar'],
    },
    {
      ziel: 'arbeitsplatz',
      titel: { de: 'Dein Arbeitsplatz', en: 'Your workspace', fr: 'Ton espace de travail' },
      text: {
        de: 'Alle Bereiche des Projekts in deiner Reihenfolge. Mit "Anordnen" ziehst du sie dorthin, wo sie für deine Arbeit hingehören - die Seitenleiste übernimmt das sofort, in allen deinen Projekten.',
        en: 'Every area of the project in your order. With "Arrange" you drag them to where they belong in your work - the sidebar follows at once, in all your projects.',
        fr: 'Tous les espaces du projet dans ton ordre. Avec « Organiser », tu les fais glisser là où ils ont leur place - la barre latérale suit aussitôt, dans tous tes projets.',
      },
    },
    {
      ziel: 'anordnen',
      titel: { de: 'Abschnitte einer Seite umstellen', en: 'Rearrange the sections of a page', fr: "Réorganiser les sections d'une page" },
      text: {
        de: 'Wo dieser Knopf erscheint, lassen sich die Abschnitte der Seite in eine eigene Reihenfolge bringen. Hier zum Beispiel Kennzahlen, Fortschritt und Arbeitsplatz.',
        en: 'Wherever this button appears, the sections of the page can be put in your own order. Here, for example, key figures, progress and workspace.',
        fr: "Là où ce bouton apparaît, tu peux remettre les sections de la page dans ton propre ordre. Ici, par exemple, les chiffres clés, l'avancement et l'espace de travail.",
      },
    },
    {
      ziel: 'hilfe',
      titel: { de: 'Jede Seite erklärt sich', en: 'Every page explains itself', fr: "Chaque page s'explique" },
      text: {
        de: 'Beim ersten Öffnen zeigt dir jede Seite kurz, wofür sie da ist und wohin deine Eingaben weiterwirken. Über das Fragezeichen holst du die Einführung jederzeit zurück.',
        en: 'The first time you open a page, it briefly shows what it is for and where your entries carry over to. The question mark brings the introduction back at any time.',
        fr: "À la première ouverture, chaque page montre brièvement à quoi elle sert et où tes saisies se répercutent. Le point d'interrogation relance la présentation à tout moment.",
      },
    },
  ],

  'creator:': [
    {
      ziel: 'naechstes',
      titel: { de: 'Was als Nächstes erscheint', en: 'What comes out next', fr: 'Ce qui sort ensuite' },
      text: {
        de: 'Hier steht das nächste Video mit Termin und den Tagen bis dahin. Der Knopf öffnet es direkt.',
        en: 'This shows the next video with its date and the days left. The button opens it directly.',
        fr: "Ici figure la prochaine vidéo avec sa date et les jours restants. Le bouton l'ouvre directement.",
      },
      wirktAuf: ['creator', 'creator/redaktionsplan'],
    },
    {
      ziel: 'arbeitsplatz',
      titel: { de: 'Dein Arbeitsplatz', en: 'Your workspace', fr: 'Ton espace de travail' },
      text: {
        de: 'Alle Bereiche des Kanals in deiner Reihenfolge. Mit "Anordnen" ziehst du sie dorthin, wo sie für deine Arbeit hingehören - die Seitenleiste übernimmt das sofort, in allen deinen Creator-Projekten.',
        en: 'Every area of the channel in your order. With "Arrange" you drag them to where they belong in your work - the sidebar follows at once, in all your creator projects.',
        fr: 'Tous les espaces de la chaîne dans ton ordre. Avec « Organiser », tu les fais glisser là où ils ont leur place - la barre latérale suit aussitôt, dans tous tes projets créateur.',
      },
    },
    {
      ziel: 'anordnen',
      titel: { de: 'Abschnitte einer Seite umstellen', en: 'Rearrange the sections of a page', fr: "Réorganiser les sections d'une page" },
      text: {
        de: 'Wo dieser Knopf erscheint, lassen sich die Abschnitte der Seite in eine eigene Reihenfolge bringen.',
        en: 'Wherever this button appears, the sections of the page can be put in your own order.',
        fr: 'Là où ce bouton apparaît, tu peux remettre les sections de la page dans ton propre ordre.',
      },
    },
    {
      ziel: 'hilfe',
      titel: { de: 'Jede Seite erklärt sich', en: 'Every page explains itself', fr: "Chaque page s'explique" },
      text: {
        de: 'Beim ersten Öffnen zeigt dir jede Seite kurz, wofür sie da ist und wohin deine Eingaben weiterwirken. Über das Fragezeichen holst du die Einführung jederzeit zurück.',
        en: 'The first time you open a page, it briefly shows what it is for and where your entries carry over to. The question mark brings the introduction back at any time.',
        fr: "À la première ouverture, chaque page montre brièvement à quoi elle sert et où tes saisies se répercutent. Le point d'interrogation relance la présentation à tout moment.",
      },
    },
  ],

  stammdaten: [
    {
      ziel: 'basisdaten',
      titel: { de: 'Die Angaben zum Projekt', en: 'The project details', fr: 'Les informations du projet' },
      text: {
        de: 'Titel, Format, Genre, Laufzeit und Kurzinhalt. Gespeichert wird beim Tippen; der Titel steht danach sofort in Kopfleiste, Seitenleiste und auf der Hauptseite.',
        en: 'Title, format, genre, runtime and synopsis. Saving happens as you type; the title then shows at once in the header, the sidebar and on the main page.',
        fr: "Titre, format, genre, durée et synopsis. L'enregistrement se fait pendant la saisie ; le titre apparaît aussitôt dans l'en-tête, la barre latérale et la page principale.",
      },
      wirktAuf: [''],
    },
    {
      ziel: 'grundeinstellungen',
      titel: { de: 'Grundeinstellungen für den Dreh', en: 'Basic settings for the shoot', fr: 'Réglages de base du tournage' },
      text: {
        de: 'Die Standard-Calltime übernimmt jede neue Tagesdispo und jeder neue Tagesbericht. Die Mindestruhezeit prüfen Konfliktradar und Timesheets. Ändern dürfen das nur Admins des Projekts.',
        en: 'Every new call sheet and daily report takes over the default call time. The conflict radar and the timesheets check the minimum rest period. Only project admins can change these.',
        fr: "Chaque nouvelle feuille de service et chaque nouveau rapport reprennent l'heure d'appel par défaut. Le radar des conflits et les feuilles de temps vérifient le repos minimal. Seuls les admins du projet peuvent les modifier.",
      },
      wirktAuf: ['tagesdispo', 'tagesbericht', 'konfliktradar', 'timesheets'],
    },
    {
      ziel: 'team',
      titel: { de: 'Wer im Projekt mitarbeitet', en: 'Who works on the project', fr: 'Qui travaille sur le projet' },
      text: {
        de: 'Einladungen sind Links mit einer Rolle - per Mail, kopiert oder als QR-Code. Die Rolle legt fest, was jemand sehen und ändern darf.',
        en: 'Invitations are links with a role - by email, copied or as a QR code. The role decides what someone can see and change.',
        fr: 'Les invitations sont des liens avec un rôle - par e-mail, copiés ou en QR code. Le rôle détermine ce que la personne peut voir et modifier.',
      },
    },
  ],

  aufgaben: [
    {
      ziel: 'neu',
      titel: { de: 'Eine Aufgabe in einer Zeile', en: 'A task in one line', fr: 'Une tâche en une ligne' },
      text: {
        de: 'Was zu tun ist, wer es macht und bis wann. Für alles, was sonst in einer Nachricht untergeht.',
        en: 'What needs doing, who does it and by when. For everything that would otherwise get lost in a message.',
        fr: "Ce qu'il faut faire, qui s'en charge et pour quand. Pour tout ce qui se perdrait sinon dans un message.",
      },
    },
    {
      ziel: 'status',
      titel: { de: 'Status mit einem Klick', en: 'Status with one click', fr: 'Le statut en un clic' },
      text: {
        de: 'Jeder Klick auf das Zeichen schiebt die Aufgabe weiter: offen, in Arbeit, Abnahme, erledigt. Überfällige stehen rot da, gelöschte liegen noch 30 Tage im Papierkorb.',
        en: 'Each click on the icon moves the task on: open, in progress, review, done. Overdue ones show in red; deleted ones stay in the bin for 30 days.',
        fr: "Chaque clic sur l'icône fait avancer la tâche : ouverte, en cours, validation, terminée. Les tâches en retard s'affichent en rouge ; les supprimées restent 30 jours dans la corbeille.",
      },
      wirktAuf: ['papierkorb'],
    },
  ],
}
