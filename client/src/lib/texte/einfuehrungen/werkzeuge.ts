import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Post-Produktion und Werkzeuge. */
export const werkzeuge: Record<string, Schritt[]> = {
  dood: [
    {
      ziel: 'raster',
      titel: { de: 'Wer an welchem Tag gebraucht wird', en: 'Who is needed on which day', fr: 'Qui est nécessaire quel jour' },
      text: {
        de: 'Je Darsteller eine Zeile, je Drehtag eine Spalte. Die Tage kommen aus den Szenen der Rolle und aus der Dispo - dieselbe Zählung wie in Besetzung und Kalkulation.',
        en: 'One row per actor, one column per shoot day. The days come from the role’s scenes and from the call sheets - the same count as in the cast and the budget.',
        fr: "Une ligne par acteur, une colonne par jour de tournage. Les jours viennent des scènes du rôle et des feuilles de service - le même décompte que dans la distribution et le budget.",
      },
      wirktAuf: ['besetzung', 'budget', 'tagesdispo'],
    },
    {
      ziel: 'legende',
      titel: { de: 'Die Zeichen', en: 'The symbols', fr: 'Les symboles' },
      text: {
        de: 'Erster und letzter Arbeitstag, Arbeit dazwischen und Haltetage, an denen jemand dazwischen nicht dreht. Als CSV für Verträge und Verfügbarkeitsanfragen.',
        en: 'First and last working day, work in between and hold days, when someone doesn’t shoot in between. As CSV for contracts and availability requests.',
        fr: "Premier et dernier jour de travail, travail entre les deux et jours de maintien, où quelqu'un ne tourne pas entre-temps. En CSV pour les contrats et les demandes de disponibilité.",
      },
    },
  ],

  postplan: [
    {
      ziel: 'phasen',
      titel: { de: 'Vom Rohschnitt bis zur Ablieferung', en: 'From rough cut to delivery', fr: "Du premier montage à la livraison" },
      text: {
        de: 'Die üblichen Phasen legst du mit einem Klick an, eigene über den Knopf oben. Jede Phase hat Zeitraum, Stand und Verantwortliche; der Balken zeigt, wie sie aufeinander folgen.',
        en: 'Add the usual phases with one click, your own with the button above. Each phase has a time span, status and the people responsible; the bar shows how they follow one another.',
        fr: "Ajoute les phases habituelles en un clic, les tiennes avec le bouton du haut. Chaque phase a sa période, son état et ses responsables ; la barre montre comment elles s'enchaînent.",
      },
    },
  ],

  musikliste: [
    {
      ziel: 'aktionen',
      titel: { de: 'Jede Musik im Film', en: 'Every piece of music in the film', fr: 'Chaque musique du film' },
      text: {
        de: 'Titel, Komponist, Verlag und Textdichter je Cue, mit Art der Rechte - Lizenz, eigene Komposition, GEMA-frei. Die CSV ist die Grundlage für die Meldung an die GEMA.',
        en: 'Title, composer, publisher and lyricist per cue, with the type of rights - licence, own composition, royalty-free. The CSV is the basis for reporting to the collecting society.',
        fr: "Titre, compositeur, éditeur et parolier par morceau, avec le type de droits - licence, composition originale, libre de droits. Le CSV sert de base à la déclaration auprès de la société de gestion.",
      },
    },
  ],

  email: [
    {
      ziel: 'reiter',
      titel: { de: 'Alles, was das Projekt verschickt', en: 'Everything the project sends', fr: 'Tout ce que le projet envoie' },
      text: {
        de: 'Verfassen mit Vorlagen und Verteilern, eigener Absender. Im Postausgang steht jede Mail des Projekts - Dispos, Verträge, Abnahmen, Agenturanfragen - mit ihrem Stand. Was hängen blieb, schickst du dort erneut.',
        en: 'Compose with templates and mailing lists, your own sender. The outbox shows every email of the project - call sheets, contracts, reviews, agency requests - with its status. Resend from there whatever got stuck.',
        fr: "Rédiger avec modèles et listes de diffusion, expéditeur propre. La boîte d'envoi montre chaque e-mail du projet - feuilles de service, contrats, validations, demandes d'agence - avec son état. Renvoie de là ce qui est resté bloqué.",
      },
      wirktAuf: ['tagesdispo', 'vertraege', 'abnahme', 'agenturen'],
    },
  ],

  pinboard: [
    {
      ziel: 'neu',
      titel: { de: 'Für alles, was in keine Liste passt', en: 'For everything that fits no list', fr: "Pour tout ce qui n'entre dans aucune liste" },
      text: {
        de: 'Farbige Zettel für Gedanken, Erinnerungen und Absprachen. Jeder im Projekt sieht sie.',
        en: 'Coloured notes for thoughts, reminders and agreements. Everyone in the project sees them.',
        fr: 'Des notes de couleur pour les idées, les rappels et les accords. Tout le monde dans le projet les voit.',
      },
    },
  ],

  aktivitaet: [
    {
      ziel: 'filter',
      titel: { de: 'Was zuletzt passiert ist', en: 'What happened recently', fr: "Ce qui s'est passé récemment" },
      text: {
        de: 'Die letzten Änderungen im Projekt, neueste zuerst, wahlweise nur eine Art. Die vollständige Liste mit Inhalten steht im Audit-Log.',
        en: 'The latest changes in the project, newest first, optionally only one kind. The complete list with contents is in the audit log.',
        fr: "Les dernières modifications du projet, les plus récentes d'abord, au choix d'un seul type. La liste complète avec contenus figure dans le journal d'audit.",
      },
      wirktAuf: ['audit'],
    },
  ],

  suche: [
    {
      ziel: 'suche',
      titel: { de: 'Wenn du weißt, wie es heißt', en: 'When you know what it’s called', fr: "Quand tu sais comment ça s'appelle" },
      text: {
        de: 'Sucht über Szenen, Rollen, Besetzung, Stab und Motive. Eine Figur oder ihre Darstellerin bringt alles mit: wer sie spielt, ihre Szenen und ihre Drehtage, mit Sprung in die Dispo des Tages.',
        en: 'Searches scenes, roles, cast, crew and locations. A character or their actor brings everything along: who plays them, their scenes and their shoot days, with a jump to that day’s call sheet.',
        fr: "Cherche parmi scènes, rôles, acteurs, équipe et décors. Un personnage ou son interprète amène tout : qui le joue, ses scènes et ses jours de tournage, avec accès direct à la feuille de service du jour.",
      },
      wirktAuf: ['besetzung', 'drehbuch', 'tagesdispo'],
    },
  ],

  audit: [
    {
      ziel: 'filter',
      titel: { de: 'Wer hat das geändert', en: 'Who changed that', fr: "Qui a modifié ça" },
      text: {
        de: 'Jede Änderung mit Zeitpunkt, Person und Inhalt vorher und nachher. Grenze nach Person, Aktion, Bereich, Zeitraum und Text ein; das Ergebnis geht auch als CSV raus.',
        en: 'Every change with time, person and content before and after. Narrow it down by person, action, area, period and text; the result can also be exported as CSV.',
        fr: "Chaque modification avec date, personne et contenu avant et après. Filtre par personne, action, domaine, période et texte ; le résultat s'exporte aussi en CSV.",
      },
    },
  ],

  datenschutz: [
    {
      ziel: 'reiter',
      titel: { de: 'Wenn jemand nach seinen Daten fragt', en: 'When someone asks about their data', fr: "Quand quelqu'un demande ses données" },
      text: {
        de: 'Auskunft nach Art. 15 DSGVO je Person, Daten entfernen, wenn jemand das verlangt, und eine Übersicht, wer im Projekt was sieht.',
        en: 'Subject access under Art. 15 GDPR per person, removing data when someone asks for it, and an overview of who sees what in the project.',
        fr: "Droit d'accès selon l'art. 15 du RGPD par personne, suppression des données à la demande, et un aperçu de qui voit quoi dans le projet.",
      },
    },
  ],

  listen: [
    {
      ziel: 'reiter',
      titel: { de: 'Aus Tabellen und in Tabellen', en: 'From spreadsheets and into them', fr: 'Depuis et vers des tableurs' },
      text: {
        de: 'Stab, Besetzung und Komparserie liest du aus einer CSV ein - erst kommt eine Vorschau, was neu ist, was ergänzt und was übersprungen wird. Ausgeben lassen sich Stab, Besetzung, Szenen und Drehplan.',
        en: 'Import crew, cast and extras from a CSV - first a preview shows what is new, what is added to and what is skipped. Crew, cast, scenes and the schedule can be exported.',
        fr: "Importe l'équipe, les acteurs et la figuration depuis un CSV - d'abord un aperçu de ce qui est nouveau, complété ou ignoré. On peut exporter l'équipe, les acteurs, les scènes et le plan de tournage.",
      },
      wirktAuf: ['stabliste', 'besetzung', 'komparsen'],
    },
  ],

  papierkorb: [
    {
      ziel: 'liste',
      titel: { de: 'Nach einem Fehlklick', en: 'After a misclick', fr: 'Après un mauvais clic' },
      text: {
        de: 'Gelöschte Szenen, Rollen, Personen, Motive, Drehtage, Aufgaben und mehr bleiben 30 Tage hier. Zurückholen darf, wer auch löschen darf.',
        en: 'Deleted scenes, roles, people, locations, shoot days, tasks and more stay here for 30 days. Anyone allowed to delete may restore.',
        fr: 'Scènes, rôles, personnes, décors, jours de tournage, tâches et autres éléments supprimés restent ici 30 jours. Qui peut supprimer peut aussi restaurer.',
      },
    },
  ],
}
