import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: die Seiten rund um den Drehtag. */
export const dreh: Record<string, Schritt[]> = {
  tagesdispo: [
    {
      ziel: 'tage',
      titel: { de: 'Ein Drehtag nach dem anderen', en: 'One shoot day after another', fr: "Un jour de tournage après l'autre" },
      text: {
        de: "Mit den Pfeilen oder der Auswahl blätterst du durch die Drehtage. Das PDF ist die Dispo für alle; die Script Sides enthalten nur die Drehbuchseiten der Szenen dieses Tages - für Schauspieler und Script.",
        en: "Use the arrows or the selector to page through the shoot days. The PDF is the call sheet for everyone; the script sides contain only the script pages of that day’s scenes - for actors and script supervision.",
        fr: "Les flèches ou la sélection font défiler les jours. Le PDF est la feuille de service pour tous ; les script sides ne contiennent que les pages des scènes du jour - pour les acteurs et la scripte.",
      },
    },
    {
      ziel: 'kopf',
      titel: { de: 'Der Kopf der Dispo', en: 'The call sheet header', fr: "L'en-tête de la feuille de service" },
      text: {
        de: "General Call und Shooting Call, darunter Drehort, Wetter, Sonnenaufgang und -untergang. Der Drehort kommt aus dem Motiv der Szenen, lässt sich aber ändern. Wetter und Sonnenzeiten holst du per Knopf für den Ort; die Wetterlage kannst du auch selbst wählen.",
        en: "General call and shooting call, then set, weather, sunrise and sunset. The set comes from the scenes’ location but can be changed. Weather and sun times are fetched for the place at the push of a button; you can also pick the conditions yourself.",
        fr: "Convocation générale et heure de tournage, puis lieu, météo, lever et coucher du soleil. Le lieu vient du décor des scènes mais peut être modifié. Météo et heures du soleil se récupèrent d'un bouton pour le lieu ; tu peux aussi choisir la météo toi-même.",
      },
      wirktAuf: ['motive'],
    },
    {
      ziel: 'szenen',
      titel: { de: 'Die Szenen des Tages', en: 'The day’s scenes', fr: 'Les scènes du jour' },
      text: {
        de: "Aus dem Drehplan: Nummer, Innen/Außen, Tag/Nacht in den Farben des Drehplans, Titel, Motiv und Achtel. Im PDF steht zu jeder Szene auch, welche Rollen spielen. Ändert sich der Drehplan, ändert sich diese Liste mit.",
        en: "From the schedule: number, interior/exterior, day/night in the schedule’s colours, title, location and eighths. The PDF also lists which roles appear in each scene. When the schedule changes, this list changes with it.",
        fr: "Issues du plan : numéro, intérieur/extérieur, jour/nuit aux couleurs du plan, titre, décor et huitièmes. Le PDF indique aussi quels rôles jouent dans chaque scène. Quand le plan change, cette liste change aussi.",
      },
      wirktAuf: ['drehplan', 'drehbuch'],
    },
    {
      ziel: 'personen',
      titel: { de: 'Besetzung, Stab, Komparsen', en: 'Cast, crew, extras', fr: 'Acteurs, équipe, figurants' },
      text: {
        de: "Je Person die eigene Call Time, Abholort und Hinweis. Die Darsteller kommen über die Rollen der Szenen, der Stab ganz, die Komparsen über ihre Drehtage. \"Person hinzufügen\" nimmt jemanden von Hand dazu; geänderte Zeiten speicherst du mit \"Speichern\".",
        en: "For each person their own call time, pick-up point and note. Actors come through the roles of the scenes, the crew in full, extras through their shoot days. \"Add person\" adds someone by hand; save changed times with \"Save\".",
        fr: "Pour chaque personne : son heure de convocation, son lieu de prise en charge et une remarque. Les acteurs viennent par les rôles des scènes, l'équipe au complet, les figurants par leurs jours. « Ajouter une personne » ajoute quelqu'un à la main ; enregistre les horaires modifiés avec « Enregistrer ».",
      },
      wirktAuf: ['besetzung', 'stabliste', 'komparsen'],
    },
    {
      ziel: 'personen',
      titel: { de: 'Wer hat die Dispo gesehen', en: 'Who has seen the call sheet', fr: 'Qui a vu la feuille de service' },
      text: {
        de: "Nach dem Versand steht bei jeder Person, wann die Mail rausging, wann sie die Dispo geöffnet und wann sie bestätigt hat. Wer ein Konto hat, kann über seinen Link das ganze Projekt mit Lesezugriff öffnen.",
        en: "After sending, each person shows when the email went out, when they opened the call sheet and when they confirmed. Anyone with an account can open the whole project read-only through their link.",
        fr: "Après l'envoi, chaque personne indique quand l'e-mail est parti, quand elle a ouvert la feuille et quand elle a confirmé. Qui a un compte peut ouvrir tout le projet en lecture via son lien.",
      },
    },
    {
      ziel: 'zeiten',
      titel: { de: 'Zeiten, Hinweise, Catering', en: 'Times, notes, catering', fr: 'Horaires, consignes, restauration' },
      text: {
        de: "Verschiebt sich der Tag, rücken \"Zeiten verschieben\" alle Call Times um die gewählten Minuten auf einmal. Darunter allgemeine Hinweise für alle und die Zahl der Essen für den Caterer.",
        en: "If the day shifts, \"Shift times\" moves all call times by the chosen minutes at once. Below, general notes for everyone and the number of meals for the caterer.",
        fr: "Si la journée se décale, « Décaler les horaires » déplace toutes les convocations du nombre de minutes choisi d'un coup. En dessous, les consignes générales et le nombre de repas pour le traiteur.",
      },
      wirktAuf: ['catering'],
    },
    {
      ziel: 'anordnen',
      titel: { de: 'Deine Reihenfolge', en: 'Your order', fr: 'Ton ordre' },
      text: {
        de: "Szenen, Besetzung und Stab, Zeiten und Hinweise - mit diesem Knopf stellst du sie in deine Reihenfolge, für die Dispo in allen deinen Projekten.",
        en: "Scenes, cast and crew, times and notes - this button puts them in your order, for the call sheet in all your projects.",
        fr: "Scènes, acteurs et équipe, horaires et consignes - ce bouton les met dans ton ordre, pour la feuille de service dans tous tes projets.",
      },
    },
    {
      ziel: 'versenden',
      titel: { de: 'Raus an alle', en: 'Out to everyone', fr: 'Envoyée à tous' },
      text: {
        de: "Jede Person bekommt eine eigene Mail mit ihrer Call Time, einem Link zum Bestätigen und der Dispo als PDF - sofort oder zu einem Zeitpunkt, den du einplanst. Wer hier steht, steht auch im Check-in, in der Catering-Tagesliste und im Lohnexport; die Call Times prüft der Konfliktradar auf Ruhezeiten.",
        en: "Each person gets their own email with their call time, a link to confirm and the call sheet as PDF - now or at a time you schedule. Whoever is listed here also appears in check-in, the catering day list and the payroll export; the conflict radar checks the call times for rest periods.",
        fr: "Chaque personne reçoit son propre e-mail avec son heure de convocation, un lien de confirmation et la feuille en PDF - tout de suite ou à une heure programmée. Qui figure ici figure aussi à l'accueil, dans la liste du jour du traiteur et dans l'export de paie ; le radar des conflits vérifie les repos sur ces horaires.",
      },
      wirktAuf: ['checkin', 'catering', 'timesheets', 'konfliktradar'],
    },
  ],

  checkin: [
    {
      ziel: 'titel',
      titel: { de: 'Wer ist schon da', en: 'Who is here already', fr: 'Qui est déjà là' },
      text: {
        de: "Morgens am Set: Wer angekommen ist, wird abgehakt. Oben steht, wie viele schon da sind.",
        en: "In the morning on set: whoever has arrived is ticked off. At the top you see how many are already there.",
        fr: "Le matin sur le plateau : qui est arrivé est pointé. En haut figure le nombre de présents.",
      },
    },
    {
      ziel: 'tag',
      titel: { de: 'Drehtag wählen', en: 'Choose the shoot day', fr: 'Choisir le jour' },
      text: {
        de: "Die Liste ist die Dispo dieses Tages - wer dort steht, steht hier. Der Balken zeigt, wie viele noch fehlen.",
        en: "The list is that day’s call sheet - whoever is on it is here. The bar shows how many are still missing.",
        fr: "La liste est la feuille de service du jour - qui y figure est ici. La barre montre combien manquent encore.",
      },
      wirktAuf: ['tagesdispo'],
    },
    {
      ziel: 'liste',
      titel: { de: 'Abhaken', en: 'Checking in', fr: 'Pointer' },
      text: {
        de: "Je Person Name, Funktion und Call Time. Ein Tippen hakt sie ab und hält die Uhrzeit fest; ein zweites nimmt es zurück. Gut am Tablet am Eingang.",
        en: "For each person the name, role and call time. One tap checks them in and records the time; a second undoes it. Handy on a tablet at the entrance.",
        fr: "Pour chaque personne : nom, fonction et heure de convocation. Un appui la pointe et note l'heure ; un second l'annule. Pratique sur une tablette à l'entrée.",
      },
    },
  ],

  shotlist: [
    {
      ziel: 'titel',
      titel: { de: 'Die Auflösung', en: 'The shot breakdown', fr: 'Le découpage' },
      text: {
        de: "Welche Einstellungen eine Szene braucht - mit der Regie vorbereitet und am Drehtag abgehakt. Oben steht, wie viele Einstellungen es gibt und wie viele erledigt sind.",
        en: "Which shots a scene needs - prepared with the director and ticked off on the shoot day. At the top you see how many shots there are and how many are done.",
        fr: "Quels plans une scène demande - préparés avec la réalisation et cochés le jour du tournage. En haut figurent le nombre de plans et ceux terminés.",
      },
    },
    {
      ziel: 'suche',
      titel: { de: 'Die richtige Szene finden', en: 'Find the right scene', fr: 'Trouver la bonne scène' },
      text: {
        de: "Bei vielen Szenen: nach Nummer oder Titel suchen, alle auf- oder zuklappen.",
        en: "With many scenes: search by number or title, expand or collapse all.",
        fr: "Avec beaucoup de scènes : chercher par numéro ou titre, tout déplier ou replier.",
      },
    },
    {
      ziel: 'szene',
      titel: { de: 'Einstellungen je Szene', en: 'Shots per scene', fr: 'Plans par scène' },
      text: {
        de: "Jede Szene aus der Szenenübersicht klappt ihre Einstellungen auf: Nummer, Größe, Bewegung, Brennweite, Beschreibung, Dauer und der beste Take. Eine Einstellung lässt sich duplizieren, wenn die nächste fast gleich ist.",
        en: "Each scene from the scene overview opens up its shots: number, size, movement, focal length, description, duration and the best take. A shot can be duplicated when the next one is almost the same.",
        fr: "Chaque scène de la vue des scènes déplie ses plans : numéro, valeur, mouvement, focale, description, durée et meilleure prise. Un plan peut être dupliqué quand le suivant est presque identique.",
      },
      wirktAuf: ['drehbuch'],
    },
    {
      ziel: 'szene',
      titel: { de: 'Am Set abhaken', en: 'Tick off on set', fr: 'Cocher sur le plateau' },
      text: {
        de: "Ist eine Einstellung im Kasten, hakst du sie ab. Die Szene zeigt dann, wie viele ihrer Einstellungen erledigt sind.",
        en: "Once a shot is in the can, tick it off. The scene then shows how many of its shots are done.",
        fr: "Quand un plan est dans la boîte, coche-le. La scène indique alors combien de ses plans sont terminés.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Für die Regie und den Drehtag', en: 'For the director and the shoot day', fr: 'Pour la réalisation et le jour de tournage' },
      text: {
        de: "Als PDF nach Szenen sortiert für die Auflösung, oder nach Drehtagen in der Reihenfolge des Drehplans - für die Mappe am Set.",
        en: "As a PDF sorted by scene for the breakdown, or by shoot day in the order of the schedule - for the folder on set.",
        fr: "En PDF trié par scène pour le découpage, ou par jour dans l'ordre du plan - pour le classeur du plateau.",
      },
      wirktAuf: ['drehplan'],
    },
  ],

  setplan: [
    {
      ziel: 'titel',
      titel: { de: 'Wer wo steht', en: 'Who stands where', fr: 'Qui se place où' },
      text: {
        de: "Für komplizierte Drehtage: ein Grundriss, auf dem Kamera, Licht und Ton schon stehen, bevor jemand am Set ist.",
        en: "For complicated shoot days: a floor plan with camera, lighting and sound in place before anyone is on set.",
        fr: "Pour les journées compliquées : un plan au sol avec caméra, lumière et son déjà placés avant que quiconque arrive.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Pläne anlegen und ausgeben', en: 'Create and export plans', fr: 'Créer et exporter des plans' },
      text: {
        de: "\"Neuer Plan\" legt einen Plan an, das PDF gibt den gewählten Plan fürs Team aus.",
        en: "\"New plan\" creates a plan; the PDF exports the selected plan for the team.",
        fr: "« Nouveau plan » crée un plan ; le PDF exporte le plan choisi pour l'équipe.",
      },
    },
    {
      ziel: 'arbeitsflaeche',
      titel: { de: 'Grundriss und Elemente', en: 'Floor plan and elements', fr: 'Plan au sol et éléments' },
      text: {
        de: "Links deine Pläne, jeder mit seiner Szene und der Zahl seiner Elemente. In der Mitte der Grundriss: hochladen, dann Kamera, Licht, Praktikable, Ton, Darsteller, Requisiten und Möbel aus der Leiste rechts daraufziehen. Kameras bekommen Buchstaben, alles andere Nummern.",
        en: "Your plans on the left, each with its scene and number of elements. The floor plan in the middle: upload it, then drag camera, lighting, practicals, sound, actors, props and furniture onto it from the bar on the right. Cameras get letters, everything else numbers.",
        fr: "Tes plans à gauche, chacun avec sa scène et son nombre d'éléments. Le plan au sol au milieu : téléverse-le, puis fais glisser caméra, lumière, praticables, son, acteurs, accessoires et meubles depuis la barre de droite. Les caméras reçoivent des lettres, le reste des numéros.",
      },
    },
  ],

  vfx: [
    {
      ziel: 'titel',
      titel: { de: 'Jede Effekt-Einstellung', en: 'Every effects shot', fr: "Chaque plan d'effets" },
      text: {
        de: "Alle Einstellungen, die einen Effekt brauchen, mit ihrem Stand - damit in der Post nichts vergessen wird.",
        en: "Every shot that needs an effect, with its status - so nothing gets forgotten in post.",
        fr: "Tous les plans qui demandent un effet, avec leur état - pour ne rien oublier en post.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Eine Einstellung eintragen', en: 'Add a shot', fr: 'Ajouter un plan' },
      text: {
        de: "Einstellungsnummer, Beschreibung, Art - Compositing, CGI, Rotoskopie, Color Grading und mehr -, Aufwand von niedrig bis sehr hoch, wer ihn baut und bis wann.",
        en: "Shot number, description, type - compositing, CGI, rotoscoping, colour grading and more -, effort from low to very high, who builds it and by when.",
        fr: "Numéro de plan, description, type - compositing, CGI, rotoscopie, étalonnage, etc. -, effort de faible à très élevé, qui le réalise et pour quand.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Der Stand', en: 'The status', fr: "L'état" },
      text: {
        de: "Offen, In Arbeit, Review, Finalisiert oder Abgelehnt - farbig in der Liste, damit sofort sichtbar ist, was noch fehlt.",
        en: "Open, in progress, review, final or rejected - colour-coded in the list so what is missing is visible at once.",
        fr: "Ouvert, en cours, revue, finalisé ou refusé - en couleur dans la liste pour voir aussitôt ce qui manque.",
      },
    },
  ],

  continuity: [
    {
      ziel: 'titel',
      titel: { de: 'Anschlüsse festhalten', en: 'Record continuity', fr: 'Noter les raccords' },
      text: {
        de: "Wie jemand aussah und was wo lag - damit der Anschluss auch Wochen später stimmt, wenn die Szene weitergedreht wird.",
        en: "How someone looked and what was where - so continuity still matches weeks later when the scene is picked up.",
        fr: "À quoi ressemblait quelqu'un et ce qui était où - pour que le raccord tienne des semaines plus tard quand la scène reprend.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Ein Eintrag', en: 'An entry', fr: 'Une entrée' },
      text: {
        de: "Er gehört zu einer Szene und einem Darsteller, mit Kategorie - Kostüm, Maske, Haare, Props, Set - und Fotos vom Set.",
        en: "It belongs to a scene and an actor, with a category - costume, make-up, hair, props, set - and photos from set.",
        fr: "Elle appartient à une scène et à un acteur, avec une catégorie - costume, maquillage, coiffure, accessoires, décor - et des photos du plateau.",
      },
      wirktAuf: ['drehbuch', 'besetzung'],
    },
    {
      ziel: 'titel',
      titel: { de: 'Nach Kategorie', en: 'By category', fr: 'Par catégorie' },
      text: {
        de: "Die Knöpfe unter der Überschrift zeigen, wie viele Einträge jede Kategorie hat, und filtern nach ihr - so findet die Maske ihre Fotos ohne das Kostüm.",
        en: "The buttons below the heading show how many entries each category has and filter by it - so make-up finds its photos without costume.",
        fr: "Les boutons sous le titre montrent le nombre d'entrées par catégorie et filtrent - le maquillage trouve ainsi ses photos sans le costume.",
      },
    },
  ],

  kameraberichte: [
    {
      ziel: 'titel',
      titel: { de: 'Was auf welcher Karte ist', en: 'What is on which card', fr: 'Ce qui est sur quelle carte' },
      text: {
        de: "Der Kamerabericht für den Schnitt: jeder Take je Drehtag und Kamera. Am Set führt ihn die Kamera-Assistenz.",
        en: "The camera report for editing: every take per shoot day and camera. On set the camera assistant keeps it.",
        fr: "Le rapport caméra pour le montage : chaque prise par jour et caméra. Sur le plateau, l'assistant caméra le tient.",
      },
    },
    {
      ziel: 'tag',
      titel: { de: 'Drehtag wählen', en: 'Choose the shoot day', fr: 'Choisir le jour' },
      text: {
        de: "Alles auf dieser Seite gilt für den gewählten Tag. Darüber stehen Berichte, Takes und Circle Takes des Tages.",
        en: "Everything on this page applies to the chosen day. Above you see the day’s reports, takes and circle takes.",
        fr: "Tout sur cette page vaut pour le jour choisi. Au-dessus figurent les rapports, prises et prises retenues du jour.",
      },
    },
    {
      ziel: 'kamera',
      titel: { de: 'Ein Bericht je Kamera', en: 'One report per camera', fr: 'Un rapport par caméra' },
      text: {
        de: "Jede Kamera - A, B und so weiter - bekommt ihren eigenen Bericht. Angeboten werden nur Buchstaben, die es an diesem Tag noch nicht gibt.",
        en: "Each camera - A, B and so on - gets its own report. Only letters not yet used on this day are offered.",
        fr: "Chaque caméra - A, B, etc. - reçoit son propre rapport. Seules les lettres pas encore utilisées ce jour sont proposées.",
      },
    },
    {
      ziel: 'kamera',
      titel: { de: 'Takes mitschreiben', en: 'Log the takes', fr: 'Noter les prises' },
      text: {
        de: "Im Bericht je Take Szene, Timecode ein und aus, Notiz und ob es der Circle Take ist; die Takenummer zählt je Szene mit. Das Szenenfeld schlägt die Szenen dieses Drehtags aus dem Drehplan vor. Am Ende geht alles als CSV an den Schnitt.",
        en: "In the report, for each take the scene, timecode in and out, a note and whether it is the circle take; the take number counts up per scene. The scene field suggests this shoot day’s scenes from the schedule. At the end everything goes to editing as CSV.",
        fr: "Dans le rapport, pour chaque prise : scène, timecode d'entrée et de sortie, note et si c'est la prise retenue ; le numéro de prise s'incrémente par scène. Le champ de scène propose les scènes du jour depuis le plan. À la fin, tout part au montage en CSV.",
      },
      wirktAuf: ['drehplan'],
    },
  ],

  tagesbericht: [
    {
      ziel: 'tage',
      titel: { de: 'Was wirklich gedreht wurde', en: 'What was actually shot', fr: 'Ce qui a vraiment été tourné' },
      text: {
        de: "Abends nach Drehschluss, je Drehtag. Gespeichert wird beim Tippen - auch wenn du gleich zum nächsten Tag blätterst. Das PDF geht an die Produktion.",
        en: "In the evening after wrap, per shoot day. Saving happens as you type - even if you page straight to the next day. The PDF goes to production.",
        fr: "Le soir après la fin, par jour de tournage. L'enregistrement se fait pendant la saisie - même si tu passes aussitôt au jour suivant. Le PDF part à la production.",
      },
    },
    {
      ziel: 'zeiten',
      titel: { de: 'Die Zeiten des Tages', en: 'The day’s times', fr: 'Les horaires du jour' },
      text: {
        de: "Call Time, erste Klappe, Mittagspause und Drehschluss - daraus rechnet die Seite Drehdauer, Pause und Netto-Drehzeit. Vorbelegt mit Calltime und Drehschluss aus den Stammdaten. Der Drehschluss zählt für die Ruhezeit im Konfliktradar.",
        en: "Call time, first shot, lunch break and wrap - the page works out shooting duration, break and net shooting time. Preset with call and wrap times from the project details. The wrap time counts for the rest period in the conflict radar.",
        fr: "Convocation, premier plan, pause déjeuner et fin - la page en déduit durée, pause et temps net. Préremplis avec les heures des données du projet. L'heure de fin compte pour le repos dans le radar des conflits.",
      },
      wirktAuf: ['stammdaten', 'konfliktradar', 'zeitanalyse'],
    },
    {
      ziel: 'produktion',
      titel: { de: 'Produktionsdaten', en: 'Production data', fr: 'Données de production' },
      text: {
        de: "Gedrehte Seiten in Achteln gegen die geplanten, die Zahl der Setups, Kamera- und Tonrollen. Wurde mehr gedreht als geplant, weist die Seite darauf hin.",
        en: "Pages shot in eighths against those planned, the number of set-ups, camera and sound rolls. If more was shot than planned, the page points it out.",
        fr: "Pages tournées en huitièmes face aux prévues, nombre d'installations, bobines image et son. Si plus a été tourné que prévu, la page le signale.",
      },
    },
    {
      ziel: 'szenen',
      titel: { de: 'Szenen abhaken', en: 'Tick off scenes', fr: 'Cocher les scènes' },
      text: {
        de: "Antippen schaltet weiter: offen, angefangen, abgedreht. Abgedreht gilt dann auch in der Szenenliste und im Fortschritt der Hauptseite. Die Zeitanalyse verteilt die Drehzeit des Tages auf die markierten Szenen; gemessene Minuten je Szene gehen vor.",
        en: "Tap to move on: open, started, shot. Shot then also counts in the scene list and in the progress on the main page. The time analysis spreads the day’s shooting time across the marked scenes; measured minutes per scene take priority.",
        fr: "Un appui fait avancer : ouverte, commencée, tournée. Tournée compte alors aussi dans la liste des scènes et dans l'avancement de la page principale. L'analyse du temps répartit le temps du jour entre les scènes marquées ; les minutes mesurées par scène priment.",
      },
      wirktAuf: ['drehbuch', '', 'zeitanalyse'],
    },
    {
      ziel: 'notizen',
      titel: { de: 'Was sonst passiert ist', en: 'What else happened', fr: "Ce qui s'est passé d'autre" },
      text: {
        de: "Vorkommnisse, Verzögerungen, Unfälle und Hinweise für die Produktion - festgehalten am selben Abend, solange alle sich erinnern.",
        en: "Incidents, delays, accidents and notes for production - recorded the same evening while everyone still remembers.",
        fr: "Incidents, retards, accidents et remarques pour la production - notés le soir même, tant que chacun s'en souvient.",
      },
    },
  ],

  zeitanalyse: [
    {
      ziel: 'titel',
      titel: { de: 'Sind wir im Plan?', en: 'Are we on schedule?', fr: 'Sommes-nous dans les temps ?' },
      text: {
        de: "Die geschätzte Drehzeit jeder Szene gegen die tatsächliche - nach ein paar Drehtagen weißt du, ob der Plan hält.",
        en: "Each scene’s estimated shooting time against the actual one - after a few shoot days you know whether the plan holds.",
        fr: "Le temps estimé de chaque scène face au temps réel - après quelques jours, tu sais si le plan tient.",
      },
    },
    {
      ziel: 'summen',
      titel: { de: 'Die Summen', en: 'The totals', fr: 'Les totaux' },
      text: {
        de: "Geplant über alle Szenen, tatsächlich gedreht und die Differenz. Ein Plus heißt: länger als geschätzt.",
        en: "Planned across all scenes, actually shot and the difference. A plus means longer than estimated.",
        fr: "Prévu sur toutes les scènes, réellement tourné et l'écart. Un plus signifie plus long que prévu.",
      },
    },
    {
      ziel: 'tabelle',
      titel: { de: 'Je Szene', en: 'Per scene', fr: 'Par scène' },
      text: {
        de: "Die geschätzte Zeit kommt aus der Szene, die tatsächliche aus dem Tagesbericht: gemessene Minuten, wo es sie gibt, sonst die Drehzeit des Tages auf die abgedrehten Szenen verteilt - dann steht \"geschätzt\" dabei.",
        en: "The estimated time comes from the scene, the actual from the daily report: measured minutes where there are any, otherwise the day’s shooting time spread across the shot scenes - then it says \"estimated\".",
        fr: "Le temps estimé vient de la scène, le réel du rapport journalier : minutes mesurées s'il y en a, sinon le temps du jour réparti entre les scènes tournées - alors « estimé » s'affiche.",
      },
      wirktAuf: ['drehbuch', 'tagesbericht'],
    },
  ],

  timesheets: [
    {
      ziel: 'titel',
      titel: { de: 'Arbeitszeiten', en: 'Working hours', fr: 'Heures de travail' },
      text: {
        de: "Call und Wrap je Person und Drehtag, mit Überstunden und Mahlzeiten - täglich erfassen, am Monatsende abrechnen.",
        en: "Call and wrap per person and shoot day, with overtime and meals - record daily, settle at the end of the month.",
        fr: "Convocation et fin par personne et par jour, avec heures supplémentaires et repas - saisir chaque jour, régler en fin de mois.",
      },
    },
    {
      ziel: 'tag',
      titel: { de: 'Drehtag wählen', en: 'Choose the shoot day', fr: 'Choisir le jour' },
      text: {
        de: "Für den gewählten Tag trägst du Personen mit Call und Wrap ein; die Überstunden rechnen sich selbst.",
        en: "For the chosen day you add people with call and wrap; overtime calculates itself.",
        fr: "Pour le jour choisi, tu ajoutes les personnes avec convocation et fin ; les heures supplémentaires se calculent seules.",
      },
    },
    {
      ziel: 'eintraege',
      titel: { de: 'Ruhezeit im Blick', en: 'Rest periods in view', fr: 'Le repos en vue' },
      text: {
        de: "Je Person die Zeiten, Überstunden und ob ein Essen zu spät kam. Ist die Ruhezeit bis zum nächsten Call kürzer als die Mindestzeit aus den Stammdaten, steht hier eine Warnung - auch bei einem Wrap nach Mitternacht.",
        en: "For each person the times, overtime and whether a meal came too late. If the rest until the next call is shorter than the minimum from the project details, a warning appears here - even with a wrap after midnight.",
        fr: "Pour chaque personne : horaires, heures supplémentaires et repas en retard. Si le repos jusqu'à la convocation suivante est plus court que le minimum des données du projet, un avertissement apparaît - même avec une fin après minuit.",
      },
      wirktAuf: ['stammdaten'],
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Für die Lohnabrechnung', en: 'For payroll', fr: 'Pour la paie' },
      text: {
        de: "Die Zeiten als CSV, und der Lohnexport: Drehtage laut Dispo mal Tagesgage aus Besetzung und Stab, dazu die Überstunden.",
        en: "The times as CSV, and the payroll export: shoot days according to the call sheets times the day rate from cast and crew, plus overtime.",
        fr: "Les horaires en CSV, et l'export de paie : jours selon les feuilles de service fois tarif journalier du casting et de l'équipe, plus les heures supplémentaires.",
      },
      wirktAuf: ['tagesdispo', 'besetzung', 'stabliste'],
    },
  ],
}
