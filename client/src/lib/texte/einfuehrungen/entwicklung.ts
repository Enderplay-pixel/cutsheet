import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Szenen, Drehbuch-Editor, Moodboard, Szenen-Kommentare. */
export const entwicklung: Record<string, Schritt[]> = {
  drehbuch: [
    {
      ziel: 'titel',
      titel: { de: 'Alle Szenen des Buchs', en: 'Every scene of the script', fr: 'Toutes les scènes du scénario' },
      text: {
        de: 'Die Szenenübersicht ist die Grundlage für alles Weitere: Drehplan, Dispo, Besetzung und Kalkulation bauen auf ihr auf. Oben steht, wie viele Szenen es sind, wie viele Seiten in Achteln und wie lange sie nach Schätzung dauern.',
        en: 'The scene overview is the basis for everything else: schedule, call sheets, cast and budget build on it. At the top you see how many scenes there are, how many pages in eighths and how long they take by estimate.',
        fr: "La vue des scènes est la base de tout le reste : plan, feuilles de service, distribution et budget s'appuient dessus. En haut figurent le nombre de scènes, les pages en huitièmes et leur durée estimée.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Szenen anlegen oder einlesen', en: 'Create or import scenes', fr: 'Créer ou importer des scènes' },
      text: {
        de: '"Neue Szene" legt eine leere Szene an. "Import" liest eine Liste von Überschriften ein, eine Szene je Zeile, etwa "1 INT. KÜCHE - TAG"; der Spielort jeder Überschrift wird dabei zum Motiv. Der Export gibt das Buch als Fountain-Datei für Highland, Slugline oder Final Draft aus.',
        en: '"New scene" adds an empty scene. "Import" reads a list of headings, one scene per line, such as "1 INT. KITCHEN - DAY"; the setting of each heading becomes a location. Export gives you the script as a Fountain file for Highland, Slugline or Final Draft.',
        fr: "« Nouvelle scène » crée une scène vide. « Importer » lit une liste d'en-têtes, une scène par ligne, comme « 1 INT. CUISINE - JOUR » ; le lieu de chaque en-tête devient un décor. L'export fournit le scénario en Fountain pour Highland, Slugline ou Final Draft.",
      },
      wirktAuf: ['motive'],
    },
    {
      ziel: 'filter',
      titel: { de: 'Schnell eingrenzen', en: 'Narrow it down quickly', fr: 'Filtrer rapidement' },
      text: {
        de: 'Innen oder außen, Tag oder Nacht, abgedreht oder offen - jede Gruppe mit ihrer Anzahl. So siehst du etwa sofort, wie viele Nachtdrehs anstehen. Das Suchfeld daneben findet Szenen nach Nummer, Titel und Motiv.',
        en: 'Interior or exterior, day or night, shot or still open - each group with its count. That way you see at once how many night shoots lie ahead, for instance. The search field next to it finds scenes by number, title and location.',
        fr: 'Intérieur ou extérieur, jour ou nuit, tournée ou à faire - chaque groupe avec son nombre. Tu vois ainsi tout de suite combien de tournages de nuit t’attendent. Le champ de recherche trouve les scènes par numéro, titre et décor.',
      },
    },
    {
      ziel: 'szene',
      titel: { de: 'Eine Szene', en: 'A scene', fr: 'Une scène' },
      text: {
        de: 'Die farbige Kante zeigt Innen/Außen und Tageszeit in denselben Farben wie Drehplan und Dispo. Daneben Nummer, Typ, Titel, Motiv, Anzahl der Figuren und Länge in Achteln. Ein Klick klappt alle Angaben auf.',
        en: 'The coloured edge shows interior/exterior and time of day in the same colours as the schedule and call sheet. Next to it the number, type, title, location, number of characters and length in eighths. One click opens all details.',
        fr: "Le bord coloré indique intérieur/extérieur et moment de la journée, dans les mêmes couleurs que le plan et la feuille de service. À côté : numéro, type, titre, décor, nombre de personnages et durée en huitièmes. Un clic déplie tout.",
      },
      wirktAuf: ['drehplan', 'tagesdispo'],
    },
    {
      ziel: 'szene',
      titel: { de: 'Was in einer Szene steckt', en: 'What a scene holds', fr: "Ce que contient une scène" },
      text: {
        de: 'Aufgeklappt: Innen/Außen, Tageszeit, Achtel, Motiv, geschätzte Drehzeit, Beschreibung, die Figuren und das Inventar - Requisiten, Kostüm, Maske, Effekte, Fahrzeuge, Tiere. Jede Figur holt ihren Darsteller in die Dispo jedes Tages, an dem die Szene gedreht wird; das Motiv wird dort zum Drehort. "Cover-Set" macht eine Szene zur Ausweichszene: Die Dispo eines Tages mit Außenszenen nennt sie unter "Bei Schlechtwetter". Eine Nachtszene, die am Tag gedreht wird, bekommt "Tag für Nacht" und trägt T/N. Erzähltag und Vorstopp stehen auf Streifen und Dispo (T3, N3); ohne gestoppten Vorstopp schätzt CutSheet eine Seite als eine Minute. Unter "Listen" gibt es Requisiten, Kostüm und Maske nach Erzähltag als PDF.',
        en: 'Opened up: interior/exterior, time of day, eighths, location, estimated shooting time, description, the characters and the breakdown - props, costume, make-up, effects, vehicles, animals. Each character brings their actor onto the call sheet of every day the scene is shot; the location becomes the set there. "Cover set" makes a scene a fallback: the call sheet of a day with exterior scenes lists it under "Bad weather". A night scene shot during the day gets "Day for night" and shows D/N. Story day and pre-timing appear on strips and the call sheet (D3, N3); without a timed value CutSheet estimates one page as one minute. Under "Lists" you get props, costume and make-up by story day as a PDF.',
        fr: "Dépliée : intérieur/extérieur, moment de la journée, huitièmes, décor, durée estimée, description, personnages et dépouillement - accessoires, costume, maquillage, effets, véhicules, animaux. Chaque personnage amène son acteur sur la feuille de service de chaque jour où la scène est tournée ; le décor y devient le lieu de tournage. « Décor de repli » en fait une scène de secours : la feuille de service d'un jour avec extérieurs la cite sous « Mauvais temps ». Une scène de nuit tournée de jour reçoit « Nuit américaine » et porte J/N. Jour de récit et pré-minutage figurent sur les bandes et la feuille de service (J3, N3) ; sans valeur chronométrée, CutSheet compte une page pour une minute. Sous « Listes », accessoires, costumes et maquillage par jour de récit en PDF.",
      },
      wirktAuf: ['besetzung', 'tagesdispo', 'motive'],
    },
    {
      ziel: 'abgedreht',
      titel: { de: 'Abgedreht', en: 'Shot', fr: 'Tournée' },
      text: {
        de: 'Der Haken markiert eine Szene als abgedreht. Das zählt im Fortschritt der Hauptseite und im Filter oben. Wer die Szene im Tagesbericht abhakt, setzt diesen Haken mit.',
        en: 'The tick marks a scene as shot. It counts in the progress on the main page and in the filter above. Ticking the scene in the daily report sets this tick too.',
        fr: "La coche marque une scène comme tournée. Cela compte dans l'avancement de la page principale et dans le filtre du haut. Cocher la scène dans le rapport journalier pose aussi cette coche.",
      },
      wirktAuf: ['', 'tagesbericht'],
    },
    {
      ziel: 'szene',
      titel: { de: 'Szene löschen', en: 'Deleting a scene', fr: 'Supprimer une scène' },
      text: {
        de: 'Das Papierkorb-Zeichen rechts in der Zeile löscht eine Szene. Sie bleibt 30 Tage im Papierkorb und lässt sich von dort zurückholen.',
        en: 'The bin icon on the right of the row deletes a scene. It stays in the bin for 30 days and can be restored from there.',
        fr: "L'icône corbeille à droite de la ligne supprime une scène. Elle reste 30 jours dans la corbeille et peut en être restaurée.",
      },
      wirktAuf: ['papierkorb'],
    },
    {
      ziel: 'filter',
      titel: { de: 'Gesperrtes Drehbuch: Szenen entfallen', en: 'Locked script: scenes are omitted', fr: 'Scénario verrouillé : les scènes sont supprimées' },
      text: {
        de: 'Ist das Drehbuch im Editor gesperrt, bleibt jede Nummer, wie sie ist - das Nummernfeld lässt sich nicht ändern. Löschen heißt dann "entfällt": Die Szene steht grau mit dem Vermerk ENTFÄLLT da, kommt aus dem Drehplan und zählt nirgends mehr mit. Der Filter "Entfällt" zeigt sie, "Zurückholen" holt sie wieder.',
        en: 'If the script is locked in the editor, every number stays as it is - the number field cannot be changed. Deleting then means "omitted": the scene stays greyed out with the note OMITTED, leaves the schedule and no longer counts anywhere. The "Omitted" filter shows them, "Restore" brings one back.',
        fr: "Si le scénario est verrouillé dans l'éditeur, chaque numéro reste tel quel - le champ ne peut pas être modifié. Supprimer signifie alors « supprimée » : la scène reste grisée avec la mention SUPPRIMÉE, quitte le plan et ne compte plus nulle part. Le filtre « Supprimées » les montre, « Rétablir » en ramène une.",
      },
      wirktAuf: ['drehplan', 'staebchenplan'],
    },
  ],

  'screenplay-editor': [
    {
      ziel: 'szenen',
      titel: { de: 'Das Buch Szene für Szene', en: 'The script scene by scene', fr: 'Le scénario scène par scène' },
      text: {
        de: 'Links stehen alle Szenen in ihrer Reihenfolge, ein Klick springt hin. Dort legst du auch neue Szenen an. Am Telefon öffnet der Knopf "Szenen" diese Liste.',
        en: 'All scenes are listed on the left in order; one click jumps there. You also add new scenes there. On a phone, the "Scenes" button opens this list.',
        fr: "Toutes les scènes sont listées à gauche dans l'ordre ; un clic y mène. Tu y crées aussi de nouvelles scènes. Sur téléphone, le bouton « Scènes » ouvre cette liste.",
      },
    },
    {
      ziel: 'blatt',
      titel: { de: 'Schreiben im Drehbuchformat', en: 'Writing in screenplay format', fr: 'Écrire au format scénario' },
      text: {
        de: 'Jede Zeile hat einen Typ und steht automatisch richtig eingerückt. Enter beginnt die nächste Zeile im passenden Typ: nach der Szenenüberschrift Handlung, nach einer Figur Dialog. Tab wechselt den Typ der Zeile reihum: Handlung, Figur, Dialog, Regieanweisung. Gespeichert wird beim Tippen.',
        en: 'Each line has a type and is indented correctly by itself. Enter starts the next line in the fitting type: action after the scene heading, dialogue after a character. Tab cycles the line’s type: action, character, dialogue, parenthetical. Saving happens as you type.',
        fr: "Chaque ligne a un type et s'indente d'elle-même. Entrée commence la ligne suivante dans le type adapté : action après l'en-tête, dialogue après un personnage. Tab change le type de la ligne : action, personnage, dialogue, didascalie. L'enregistrement se fait pendant la saisie.",
      },
    },
    {
      ziel: 'blatt',
      titel: { de: 'Das Buch füllt das Projekt', en: 'The script fills the project', fr: 'Le scénario remplit le projet' },
      text: {
        de: 'Sobald du eine Figurenzeile verlässt, wird die Figur zur Rolle und hängt an ihrer Szene - "JANA (O.S.)" wird die Rolle "Jana". Die Szenenüberschrift legt Innen/Außen, Tageszeit und Motiv der Szene fest. Nichts davon musst du ein zweites Mal eintragen.',
        en: 'As soon as you leave a character line, the character becomes a role linked to its scene - "JANA (O.S.)" becomes the role "Jana". The scene heading sets the scene’s interior/exterior, time of day and location. None of this needs entering twice.',
        fr: "Dès que tu quittes une ligne de personnage, il devient un rôle lié à sa scène - « JANA (O.S.) » devient le rôle « Jana ». L'en-tête fixe intérieur/extérieur, moment de la journée et décor de la scène. Rien de tout cela n'est à saisir deux fois.",
      },
      wirktAuf: ['besetzung', 'drehbuch', 'motive'],
    },
    {
      ziel: 'werkzeuge',
      titel: { de: 'Die Werkzeugleiste', en: 'The toolbar', fr: "La barre d'outils" },
      text: {
        de: 'Sie passt sich der aktuellen Zeile an: Typ wählen, bei einer Figur der Zusatz (V.O., O.S., CONT\'D), bei einem Übergang die gängigen wie "CUT TO:", bei einer Anmerkung ihre Farbe. Anmerkungen sind Notizen für euch, nicht Teil des Buchs.',
        en: 'It adapts to the current line: choose the type, for a character the extension (V.O., O.S., CONT\'D), for a transition the common ones like "CUT TO:", for a note its colour. Notes are for you, not part of the script.',
        fr: "Elle s'adapte à la ligne en cours : choisir le type, pour un personnage l'extension (V.O., O.S., CONT'D), pour une transition les plus courantes comme « CUT TO: », pour une annotation sa couleur. Les annotations sont pour vous, pas pour le scénario.",
      },
    },
    {
      ziel: 'werkzeuge',
      titel: { de: 'Einlesen und ausgeben', en: 'Import and export', fr: 'Importer et exporter' },
      text: {
        de: 'Rechts in der Leiste: Ein vorhandenes Buch liest du aus Final Draft, Celtx, Fountain oder Text ein. Heraus geht es als PDF, als PDF mit euren Anmerkungen oder als Fountain-Datei.',
        en: 'On the right of the bar: import an existing script from Final Draft, Celtx, Fountain or plain text. Export it as a PDF, as a PDF with your notes or as a Fountain file.',
        fr: "À droite de la barre : importe un scénario existant depuis Final Draft, Celtx, Fountain ou texte. Exporte-le en PDF, en PDF avec vos annotations ou en Fountain.",
      },
    },
    {
      ziel: 'werkzeuge',
      titel: { de: 'Fassungen und Sperre', en: 'Revisions and locking', fr: 'Versions et verrouillage' },
      text: {
        de: 'Hat das Projekt schon Szenen, fragt das Einlesen: als neue Fassung, anhängen oder abbrechen. Die neue Fassung zeigt vorher, was unverändert, geändert, neu ist und was fehlt; geänderte Szenen bleiben an ihrem Drehtag, neue kommen hinter ihre Vorgängerin. "Drehbuch sperren" (Produktion) hält die Nummern fest: Neue Szenen bekommen einen Buchstaben wie 13A, gelöschte entfallen. "Fassungen" listet alle mit Farbe und zeigt eine Szene alt gegen neu; das Sternchen am Rand markiert, was die aktuelle Fassung geändert hat - auch im PDF.',
        en: 'If the project already has scenes, importing asks: as a new revision, append or cancel. The new revision first shows what is unchanged, changed, new and missing; changed scenes stay on their shoot day, new ones follow their predecessor. "Lock script" (producers) fixes the numbers: new scenes get a letter such as 13A, deleted ones are omitted. "Revisions" lists them all with colour and shows a scene old against new; the asterisk in the margin marks what the current revision changed - in the PDF too.',
        fr: "Si le projet a déjà des scènes, l'import demande : comme nouvelle version, ajouter ou annuler. La nouvelle version montre d'abord ce qui est inchangé, modifié, nouveau ou manquant ; les scènes modifiées restent à leur jour, les nouvelles suivent leur précédente. « Verrouiller le scénario » (production) fige les numéros : les nouvelles scènes reçoivent une lettre comme 13A, les supprimées sont marquées. « Versions » les liste avec leur couleur et compare une scène ; l'astérisque en marge marque ce que la version actuelle a changé - aussi dans le PDF.",
      },
      wirktAuf: ['drehbuch', 'drehplan', 'staebchenplan'],
    },
  ],

  moodboard: [
    {
      ziel: 'titel',
      titel: { de: 'Eine freie Fläche für den Look', en: 'A free canvas for the look', fr: 'Une surface libre pour le look' },
      text: {
        de: 'Bilder, Notizen und Farben für Look, Ausstattung und alles, was man zeigen statt beschreiben will. Oben steht, wie viele es von jeder Art gibt.',
        en: 'Images, notes and colours for the look, production design and everything you would rather show than describe. At the top you see how many there are of each kind.',
        fr: "Images, notes et couleurs pour le look, les décors et tout ce qu'on préfère montrer plutôt que décrire. En haut, le nombre de chaque type.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Etwas dazulegen', en: 'Add something', fr: 'Ajouter un élément' },
      text: {
        de: 'Ein Bild per Link oder als Datei, eine Notiz mit Titel und Text oder einen Farbton. Neues erscheint in der Mitte des Ausschnitts, den du gerade siehst.',
        en: 'An image by link or as a file, a note with title and text, or a colour. New items appear in the middle of the area you are looking at.',
        fr: "Une image par lien ou en fichier, une note avec titre et texte, ou une couleur. Les nouveaux éléments apparaissent au milieu de la zone que tu regardes.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Anordnen und bewegen', en: 'Arrange and move', fr: 'Organiser et déplacer' },
      text: {
        de: 'Jedes Stück ziehst du dorthin, wo es hingehört; die Lage wird gespeichert und gilt für alle im Projekt. Die Pfeile am Rand verschieben den Ausschnitt, das Kreuz an einem Stück löscht es.',
        en: 'Drag each piece to where it belongs; its position is saved and applies for everyone in the project. The arrows at the edges move the view, the cross on a piece deletes it.',
        fr: "Fais glisser chaque élément là où il va ; sa position est enregistrée et vaut pour tout le projet. Les flèches sur les bords déplacent la vue, la croix sur un élément le supprime.",
      },
    },
  ],

  kommentare: [
    {
      ziel: 'titel',
      titel: { de: 'Gespräche über Szenen', en: 'Conversations about scenes', fr: 'Échanges sur les scènes' },
      text: {
        de: 'Wenn Regie und Produktion über eine Szene reden, gehört das an die Szene - nicht in einen Chat. Oben steht, wie viele Anmerkungen im ganzen Projekt noch offen sind.',
        en: 'When direction and production discuss a scene, it belongs on the scene - not in a chat. At the top you see how many comments are still open across the project.',
        fr: "Quand réalisation et production parlent d'une scène, cela va sur la scène - pas dans une messagerie. En haut figure le nombre de commentaires encore ouverts dans le projet.",
      },
    },
    {
      ziel: 'szenen',
      titel: { de: 'Szene wählen', en: 'Pick a scene', fr: 'Choisir une scène' },
      text: {
        de: 'Links alle Szenen aus der Szenenübersicht, jede mit der Zahl ihrer offenen Anmerkungen. Wähle eine aus.',
        en: 'All scenes from the scene overview on the left, each with its number of open comments. Pick one.',
        fr: 'Toutes les scènes de la vue des scènes à gauche, chacune avec son nombre de commentaires ouverts. Choisis-en une.',
      },
      wirktAuf: ['drehbuch'],
    },
    {
      ziel: 'gespraech',
      titel: { de: 'Anmerken und abhaken', en: 'Comment and resolve', fr: 'Commenter et résoudre' },
      text: {
        de: 'Rechts steht das Gespräch zur gewählten Szene, darunter das Feld für eine neue Anmerkung. Eine Anmerkung bleibt offen, bis jemand sie als gelöst markiert; gelöste stehen durchgestrichen darunter und lassen sich wieder öffnen.',
        en: 'The conversation about the selected scene is on the right, below it the field for a new comment. A comment stays open until someone marks it as resolved; resolved ones appear crossed out below and can be reopened.',
        fr: "L'échange sur la scène choisie est à droite, avec en dessous le champ pour un nouveau commentaire. Un commentaire reste ouvert jusqu'à ce que quelqu'un le marque comme résolu ; les résolus apparaissent barrés en dessous et peuvent être rouverts.",
      },
    },
  ],
}
