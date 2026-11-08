import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Szenen, Drehbuch-Editor, Moodboard, Szenen-Kommentare. */
export const entwicklung: Record<string, Schritt[]> = {
  drehbuch: [
    {
      ziel: 'aktionen',
      titel: { de: 'Szenen anlegen oder einlesen', en: 'Create or import scenes', fr: 'Créer ou importer des scènes' },
      text: {
        de: 'Neue Szenen legst du einzeln an oder liest eine Liste von Überschriften ein, eine Szene je Zeile. Der Spielort jeder Überschrift wird dabei zum Motiv. Der Export liefert das Buch als Fountain-Datei.',
        en: 'Create scenes one by one or import a list of headings, one scene per line. The setting of each heading becomes a location. Export gives you the script as a Fountain file.',
        fr: "Crée les scènes une par une ou importe une liste d'en-têtes, une scène par ligne. Le lieu de chaque en-tête devient un décor. L'export fournit le scénario au format Fountain.",
      },
      wirktAuf: ['motive'],
    },
    {
      ziel: 'filter',
      titel: { de: 'Schnell eingrenzen', en: 'Narrow it down quickly', fr: 'Filtrer rapidement' },
      text: {
        de: 'Innen oder außen, Tag oder Nacht, abgedreht oder offen - mit der Anzahl je Gruppe. Das Suchfeld daneben findet Szenen nach Nummer, Titel und Motiv.',
        en: 'Interior or exterior, day or night, shot or still open - with the count for each group. The search field next to it finds scenes by number, title and location.',
        fr: 'Intérieur ou extérieur, jour ou nuit, tournée ou à faire - avec le nombre pour chaque groupe. Le champ de recherche à côté trouve les scènes par numéro, titre et décor.',
      },
    },
    {
      ziel: 'szene',
      titel: { de: 'Eine Szene aufklappen', en: 'Open up a scene', fr: 'Déplier une scène' },
      text: {
        de: 'Ein Klick zeigt alle Angaben: Innen/Außen, Tageszeit, Achtel, Motiv und die Figuren. Die Figuren holen ihre Darsteller in die Dispo jedes Tages, an dem die Szene gedreht wird; das Motiv wird dort zum Drehort, die Tageszeit färbt Drehplan und Dispo.',
        en: 'One click shows all details: interior/exterior, time of day, eighths, location and the characters. The characters bring their actors onto the call sheet of every day the scene is shot; the location becomes the set there, and the time of day colours the schedule and call sheet.',
        fr: "Un clic affiche tout : intérieur/extérieur, moment de la journée, huitièmes, décor et personnages. Les personnages amènent leurs acteurs sur la feuille de service de chaque jour où la scène est tournée ; le décor y devient le lieu de tournage, et le moment de la journée colore le plan et la feuille de service.",
      },
      wirktAuf: ['drehplan', 'tagesdispo', 'besetzung'],
    },
  ],

  'screenplay-editor': [
    {
      ziel: 'blatt',
      titel: { de: 'Schreiben im Drehbuchformat', en: 'Writing in screenplay format', fr: 'Écrire au format scénario' },
      text: {
        de: 'Enter beginnt die nächste Zeile im passenden Typ - nach einer Figur kommt Dialog. Tab wechselt den Typ: Handlung, Figur, Dialog, Regieanweisung. Gespeichert wird beim Tippen.',
        en: 'Enter starts the next line in the fitting type - a character is followed by dialogue. Tab switches the type: action, character, dialogue, parenthetical. Saving happens as you type.',
        fr: "Entrée commence la ligne suivante dans le type adapté - après un personnage vient le dialogue. Tab change le type : action, personnage, dialogue, didascalie. L'enregistrement se fait pendant la saisie.",
      },
    },
    {
      ziel: 'szenen',
      titel: { de: 'Das Buch füllt das Projekt', en: 'The script fills the project', fr: 'Le scénario remplit le projet' },
      text: {
        de: 'Eine neue Figur wird zur Rolle und hängt an ihrer Szene. Die Überschrift legt Innen/Außen, Tageszeit und Motiv der Szene fest. Links stehen alle Szenen - ein Klick springt hin.',
        en: 'A new character becomes a role and is linked to its scene. The heading sets the scene’s interior/exterior, time of day and location. All scenes are listed on the left - one click jumps there.',
        fr: "Un nouveau personnage devient un rôle lié à sa scène. L'en-tête fixe intérieur/extérieur, moment de la journée et décor de la scène. Toutes les scènes sont listées à gauche - un clic y mène.",
      },
      wirktAuf: ['besetzung', 'drehbuch', 'motive'],
    },
    {
      ziel: 'werkzeuge',
      titel: { de: 'Einlesen und ausgeben', en: 'Import and export', fr: 'Importer et exporter' },
      text: {
        de: 'Ein vorhandenes Buch liest du aus Final Draft, Celtx oder Fountain ein. Heraus geht es als PDF, als PDF mit deinen Anmerkungen oder als Fountain-Datei.',
        en: 'Import an existing script from Final Draft, Celtx or Fountain. Export it as a PDF, as a PDF with your notes or as a Fountain file.',
        fr: 'Importe un scénario existant depuis Final Draft, Celtx ou Fountain. Exporte-le en PDF, en PDF avec tes annotations ou au format Fountain.',
      },
    },
  ],

  moodboard: [
    {
      ziel: 'titel',
      titel: { de: 'Eine freie Fläche für den Look', en: 'A free canvas for the look', fr: 'Une surface libre pour le look' },
      text: {
        de: 'Bilder, Notizen und Farben liegen hier, wo du sie hinziehst. Für Look, Ausstattung und alles, was man zeigen statt beschreiben will.',
        en: 'Images, notes and colours stay wherever you drag them. For the look, production design and everything you would rather show than describe.',
        fr: "Images, notes et couleurs restent là où tu les fais glisser. Pour le look, les décors et tout ce qu'on préfère montrer plutôt que décrire.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Etwas dazulegen', en: 'Add something', fr: 'Ajouter un élément' },
      text: {
        de: 'Ein Bild per Link oder als Datei, eine Notiz oder einen Farbton. Neues erscheint in der Mitte des sichtbaren Ausschnitts.',
        en: 'An image by link or as a file, a note or a colour. New items appear in the middle of the visible area.',
        fr: 'Une image par lien ou en fichier, une note ou une couleur. Les nouveaux éléments apparaissent au milieu de la zone visible.',
      },
    },
  ],

  kommentare: [
    {
      ziel: 'szenen',
      titel: { de: 'Gespräche je Szene', en: 'Conversations per scene', fr: 'Échanges par scène' },
      text: {
        de: 'Links alle Szenen mit der Zahl offener Anmerkungen. Wähle eine aus, um zu lesen, was Regie und Produktion zu ihr sagen.',
        en: 'All scenes on the left with the number of open comments. Pick one to read what direction and production say about it.',
        fr: 'Toutes les scènes à gauche avec le nombre de commentaires ouverts. Choisis-en une pour lire ce que la réalisation et la production en disent.',
      },
    },
    {
      ziel: 'gespraech',
      titel: { de: 'Anmerken und abhaken', en: 'Comment and resolve', fr: 'Commenter et résoudre' },
      text: {
        de: 'Rechts steht das Gespräch zur gewählten Szene. Eine Anmerkung bleibt offen, bis jemand sie als gelöst markiert; gelöste stehen durchgestrichen darunter und lassen sich wieder öffnen.',
        en: 'The conversation about the selected scene appears on the right. A comment stays open until someone marks it as resolved; resolved ones appear crossed out below and can be reopened.',
        fr: "L'échange sur la scène choisie s'affiche à droite. Un commentaire reste ouvert jusqu'à ce que quelqu'un le marque comme résolu ; les commentaires résolus apparaissent barrés en dessous et peuvent être rouverts.",
      },
    },
  ],
}
