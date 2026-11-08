import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Planung und Vorbereitung. */
export const planung: Record<string, Schritt[]> = {
  motive: [
    {
      ziel: 'titel',
      titel: { de: 'Die Drehorte', en: 'The locations', fr: 'Les décors' },
      text: {
        de: "Jeder Ort, an dem gedreht wird. Spielorte aus dem Drehbuch landen von selbst hier - beim Schreiben im Editor und beim Import. Ein Motiv kann für mehrere Spielorte stehen.",
        en: "Every place where you shoot. Settings from the script land here by themselves - while writing in the editor and on import. One location can stand in for several settings.",
        fr: "Chaque lieu de tournage. Les lieux du scénario arrivent ici d'eux-mêmes - à l'écriture dans l'éditeur et à l'import. Un décor peut servir à plusieurs lieux.",
      },
      wirktAuf: ['drehbuch', 'screenplay-editor'],
    },
    {
      ziel: 'neu',
      titel: { de: 'Ein Motiv anlegen', en: 'Add a location', fr: 'Ajouter un décor' },
      text: {
        de: "Legt ein leeres Motiv an, das du gleich aufklappst und ausfüllst.",
        en: "Adds an empty location that you open up and fill in right away.",
        fr: "Crée un décor vide que tu déplies et remplis aussitôt.",
      },
    },
    {
      ziel: 'motiv',
      titel: { de: 'Was zu einem Motiv gehört', en: 'What belongs to a location', fr: "Ce qui fait un décor" },
      text: {
        de: "Zugeklappt Name, Adresse und ob Strom da ist. Aufgeklappt: Adresse mit Postleitzahl und Stadt, Ansprechpartner mit Telefon, Eigentümer, Miete pro Tag, Strom und Notizen. Mit Breiten- und Längengrad zeigt das Motiv eine Karte, der Kartenknopf öffnet die Adresse bei OpenStreetMap.",
        en: "Collapsed: name, address and whether power is available. Opened: address with postcode and city, contact with phone, owner, rent per day, power and notes. With latitude and longitude the location shows a map; the map button opens the address on OpenStreetMap.",
        fr: "Replié : nom, adresse et présence d'électricité. Déplié : adresse avec code postal et ville, contact avec téléphone, propriétaire, loyer par jour, électricité et notes. Avec latitude et longitude, le décor affiche une carte ; le bouton carte ouvre l'adresse sur OpenStreetMap.",
      },
    },
    {
      ziel: 'motiv',
      titel: { de: 'Der Motivvertrag', en: 'The location release', fr: 'Le contrat de décor' },
      text: {
        de: "Unten im aufgeklappten Motiv: Eigentümer eintragen, dann unterschreibt er direkt auf dem Bildschirm - am Telefon oder Tablet mit dem Finger. Der Stand geht von Entwurf zu Unterschrieben, mit Datum.",
        en: "At the bottom of the opened location: enter the owner, who then signs right on the screen - with a finger on a phone or tablet. The status moves from draft to signed, with the date.",
        fr: "En bas du décor déplié : saisis le propriétaire, qui signe ensuite directement à l'écran - du doigt sur téléphone ou tablette. L'état passe de brouillon à signé, avec la date.",
      },
    },
    {
      ziel: 'motiv',
      titel: { de: 'Wohin ein Motiv wirkt', en: 'Where a location carries over', fr: "Où un décor se répercute" },
      text: {
        de: "Das Motiv einer Szene wird zum Drehort ihrer Tagesdispo, mit Adresse. Der Ansprechpartner steht in der Kontaktliste. Fehlt die Adresse, meldet es der Konfliktradar; die Tagesdispo holt das Wetter für den Ort.",
        en: "A scene's location becomes the set on its call sheet, with address. The contact appears in the contact list. If the address is missing, the conflict radar reports it; the call sheet fetches the weather for the place.",
        fr: "Le décor d'une scène devient le lieu de tournage de sa feuille de service, avec l'adresse. Le contact figure dans la liste de contacts. Sans adresse, le radar des conflits le signale ; la feuille de service récupère la météo du lieu.",
      },
      wirktAuf: ['tagesdispo', 'kontakte', 'konfliktradar'],
    },
  ],

  drehplan: [
    {
      ziel: 'titel',
      titel: { de: 'Das Herzstück der Vorbereitung', en: 'The heart of prep', fr: 'Le cœur de la préparation' },
      text: {
        de: "Welche Szene an welchem Tag gedreht wird. Oben steht, wie viele Drehtage es gibt und wie viele Szenen schon eingeplant sind.",
        en: "Which scene is shot on which day. At the top you see how many shoot days there are and how many scenes are already scheduled.",
        fr: "Quelle scène est tournée quel jour. En haut figurent le nombre de jours et de scènes déjà planifiées.",
      },
    },
    {
      ziel: 'pool',
      titel: { de: 'Szenen ohne Tag', en: 'Scenes without a day', fr: 'Scènes sans jour' },
      text: {
        de: "Links liegen alle Szenen, die noch keinen Drehtag haben, als Streifen in den Farben von Innen/Außen und Tageszeit. Zieh einen Streifen in einen Drehtag - am Telefon kurz gedrückt halten, dann ziehen. Zurück in diese Spalte nimmt ihn wieder aus dem Tag.",
        en: "All scenes without a shoot day sit on the left as strips in the colours of interior/exterior and time of day. Drag a strip into a shoot day - on a phone, press briefly, then drag. Dragging it back into this column removes it from the day.",
        fr: "Toutes les scènes sans jour de tournage sont à gauche, en bandes aux couleurs intérieur/extérieur et moment de la journée. Fais glisser une bande dans un jour - sur téléphone, appuie brièvement puis fais glisser. La remettre dans cette colonne la retire du jour.",
      },
    },
    {
      ziel: 'drehtag',
      titel: { de: 'Ein Drehtag', en: 'A shoot day', fr: 'Un jour de tournage' },
      text: {
        de: "Nummer, Datum und die Szenen des Tages. Eine Szene ziehst du von Tag zu Tag oder zurück nach links. Kommt eine Szene in den Tag, holt die Tagesdispo ihre Darsteller dazu; der Konfliktradar prüft den neuen Stand.",
        en: "Number, date and the day’s scenes. Drag a scene from day to day or back to the left. When a scene joins the day, the call sheet adds its actors; the conflict radar checks the new state.",
        fr: "Numéro, date et scènes du jour. Fais glisser une scène d'un jour à l'autre ou de nouveau à gauche. Quand une scène rejoint le jour, la feuille de service ajoute ses acteurs ; le radar des conflits vérifie le nouvel état.",
      },
      wirktAuf: ['tagesdispo', 'konfliktradar', 'dood', 'kalender'],
    },
    {
      ziel: 'status',
      titel: { de: 'Der Stand eines Tages', en: 'A day’s status', fr: "L'état d'un jour" },
      text: {
        de: "Geplant, Bestätigt, Abgedreht, Ausgefallen oder Sperrtag. Abgedrehte Tage zählt die Hauptseite im Fortschritt. An ausgefallenen Tagen und Sperrtagen wird niemand gebraucht - Sperrtage der Besetzung lösen dort keinen Konflikt aus, und zwei solche Tage am selben Datum auch nicht.",
        en: "Planned, confirmed, shot, cancelled or blocked. The main page counts shot days in its progress. Nobody is needed on cancelled and blocked days - cast blocked days cause no conflict there, and neither do two such days on the same date.",
        fr: "Prévu, confirmé, tourné, annulé ou bloqué. La page principale compte les jours tournés dans l'avancement. Personne n'est requis les jours annulés ou bloqués - les indisponibilités des acteurs n'y créent pas de conflit, deux tels jours à la même date non plus.",
      },
      wirktAuf: ['', 'konfliktradar'],
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Neue Tage, Fassungen, Vorschläge', en: 'New days, versions, suggestions', fr: 'Nouveaux jours, versions, suggestions' },
      text: {
        de: "\"Drehtag\" legt einen Tag an oder gleich einen ganzen Zeitraum. \"Version speichern\" sichert den Plan, bevor du ihn umwirfst; unter \"Versionen\" holst du einen alten Stand zurück. Die KI-Optimierung schlägt eine Reihenfolge nach Motiv, Verfügbarkeit der Besetzung und Tageszeit vor - der alte Plan wird vorher von selbst als Version gesichert. Das PDF geht ans Team.",
        en: "\"Shoot day\" adds one day or a whole range at once. \"Save version\" backs up the plan before you overhaul it; under \"Versions\" you restore an old state. The AI optimisation suggests an order by location, cast availability and time of day - the old plan is saved as a version first. The PDF goes to the team.",
        fr: "« Jour de tournage » ajoute un jour ou toute une période. « Enregistrer la version » sauvegarde le plan avant de le bouleverser ; sous « Versions », tu restaures un ancien état. L'optimisation IA propose un ordre selon le décor, la disponibilité des acteurs et le moment de la journée - l'ancien plan est d'abord sauvegardé comme version. Le PDF part à l'équipe.",
      },
    },
  ],

  staebchenplan: [
    {
      ziel: 'statistik',
      titel: { de: 'Der Plan auf einen Blick', en: 'The plan at a glance', fr: "Le plan d'un coup d'œil" },
      text: {
        de: "Wie viele Szenen es gibt, wie viele davon eingeplant sind, wie viele Seiten das zusammen sind und an wie vielen Drehtagen.",
        en: "How many scenes there are, how many are scheduled, how many pages that adds up to and over how many shoot days.",
        fr: "Combien de scènes existent, combien sont planifiées, combien de pages cela représente et sur combien de jours.",
      },
    },
    {
      ziel: 'tafel',
      titel: { de: 'Der Plan als Streifen', en: 'The plan as strips', fr: 'Le plan en bandes' },
      text: {
        de: "Jeder Drehtag eine Spalte, jede Szene ein Streifen, gefärbt nach Innen/Außen und Tag/Nacht. So siehst du sofort, wo Tag und Nacht oder Innen und Außen wechseln und wo ein Tag überladen ist. Die Tafel zeigt, umgestellt wird im Drehplan.",
        en: "Each shoot day a column, each scene a strip, coloured by interior/exterior and day/night. You see at once where day and night or interior and exterior change and where a day is overloaded. The board shows; rearranging happens in the shooting schedule.",
        fr: "Chaque jour une colonne, chaque scène une bande, colorée selon intérieur/extérieur et jour/nuit. Tu vois aussitôt où jour et nuit ou intérieur et extérieur alternent et où une journée est surchargée. Le tableau montre ; les changements se font dans le plan de tournage.",
      },
      wirktAuf: ['drehplan'],
    },
  ],

  kalender: [
    {
      ziel: 'monat',
      titel: { de: 'Alles mit Datum', en: 'Everything with a date', fr: 'Tout ce qui a une date' },
      text: {
        de: "Ein Monat auf einen Blick: die Drehtage aus dem Drehplan und alle anderen Termine, farbig nach Art. Mit den Pfeilen blätterst du die Monate.",
        en: "A month at a glance: the shoot days from the schedule and every other appointment, coloured by kind. The arrows page through the months.",
        fr: "Un mois d'un coup d'œil : les jours de tournage du plan et tous les autres rendez-vous, colorés par type. Les flèches font défiler les mois.",
      },
      wirktAuf: ['drehplan'],
    },
    {
      ziel: 'monat',
      titel: { de: 'Ein Tag', en: 'A day', fr: 'Un jour' },
      text: {
        de: "Ein Klick auf einen Tag zeigt daneben, was dort ansteht, und legt dort einen Termin an: Casting, Besichtigung, Probe, Meeting, Reise oder Sonstiges. Ein Termin der Art \"Sperrtag\" ist nur eine Notiz - wann Darsteller nicht können, trägst du unter Sperrtage ein, nur dort prüft es der Konfliktradar.",
        en: "Clicking a day shows next to it what is on and adds an appointment there: casting, recce, rehearsal, meeting, travel or other. An appointment of the kind \"blocked day\" is just a note - when actors are unavailable goes into Blocked days; only there does the conflict radar check it.",
        fr: "Un clic sur un jour montre à côté ce qui est prévu et y ajoute un rendez-vous : casting, repérage, répétition, réunion, déplacement ou autre. Un rendez-vous de type « jour bloqué » n'est qu'une note - les indisponibilités des acteurs se saisissent dans Jours bloqués ; seul là le radar des conflits les vérifie.",
      },
      wirktAuf: ['sperrtage'],
    },
    {
      ziel: 'aktionen',
      titel: { de: 'In deinen eigenen Kalender', en: 'Into your own calendar', fr: 'Dans ton propre agenda' },
      text: {
        de: "\"Neuer Termin\" öffnet einen Termin, vorbelegt mit heute. Der Export bringt Drehtage und Termine als Datei in Google, Apple oder Outlook.",
        en: "\"New appointment\" opens an appointment preset to today. The export brings shoot days and appointments as a file into Google, Apple or Outlook.",
        fr: "« Nouveau rendez-vous » en ouvre un, prérempli à aujourd'hui. L'export envoie jours et rendez-vous sous forme de fichier vers Google, Apple ou Outlook.",
      },
    },
  ],

  konfliktradar: [
    {
      ziel: 'titel',
      titel: { de: 'Was am Plan nicht passt', en: 'What doesn’t fit the plan', fr: 'Ce qui cloche dans le plan' },
      text: {
        de: "Der Radar prüft das ganze Projekt: Szenen doppelt oder gar nicht eingeplant, leere Drehtage, zwei Drehtage an einem Datum, zu kurze Ruhezeiten zwischen Drehschluss und nächstem Call, Besetzung an ihren Sperrtagen, Szenen ohne Motiv oder Figuren, Motive ohne Adresse, Budget gegen Finanzierung.",
        en: "The radar checks the whole project: scenes scheduled twice or not at all, empty shoot days, two shoot days on one date, rest periods between wrap and next call that are too short, cast on blocked days, scenes without location or characters, locations without address, budget against financing.",
        fr: "Le radar vérifie tout le projet : scènes planifiées deux fois ou pas du tout, jours vides, deux jours à la même date, repos trop courts entre la fin et la convocation suivante, acteurs pendant leurs jours bloqués, scènes sans décor ni personnages, décors sans adresse, budget face au financement.",
      },
    },
    {
      ziel: 'liste',
      titel: { de: 'Fehler, Warnungen, Hinweise', en: 'Errors, warnings, hints', fr: 'Erreurs, avertissements, conseils' },
      text: {
        de: "Fehler zuerst, dann Warnungen, dann Hinweise. Fehler und Warnungen zählen in der Seitenleiste und auf der Hauptseite. Die Mindestruhezeit nimmt der Radar aus den Stammdaten, Drehschluss und Call aus Tagesbericht und Dispo.",
        en: "Errors first, then warnings, then hints. Errors and warnings are counted in the sidebar and on the main page. The radar takes the minimum rest period from the project details, wrap and call times from the daily report and call sheet.",
        fr: "Les erreurs d'abord, puis les avertissements, puis les conseils. Erreurs et avertissements sont comptés dans la barre latérale et sur la page principale. Le radar prend le repos minimal dans les données du projet, fin et convocation dans le rapport et la feuille de service.",
      },
      wirktAuf: ['', 'stammdaten', 'tagesbericht'],
    },
    {
      ziel: 'sprung',
      titel: { de: 'Direkt zur Ursache', en: 'Straight to the cause', fr: 'Directement à la cause' },
      text: {
        de: "\"Öffnen\" führt auf die Seite, auf der du die Meldung behebst - die Szenen, den Drehplan, die Sperrtage oder die Dispo.",
        en: "\"Open\" takes you to the page where you fix the message - the scenes, the schedule, the blocked days or the call sheet.",
        fr: "« Ouvrir » mène à la page où tu corriges le message - les scènes, le plan, les jours bloqués ou la feuille de service.",
      },
    },
    {
      ziel: 'aktualisieren',
      titel: { de: 'Immer aktuell', en: 'Always up to date', fr: 'Toujours à jour' },
      text: {
        de: "Die Seite prüft alle 30 Sekunden neu, die Zahl in der Seitenleiste jede Minute. Nach einer Änderung prüft dieser Knopf sofort.",
        en: "The page rechecks every 30 seconds, the number in the sidebar every minute. After a change, this button checks right away.",
        fr: "La page revérifie toutes les 30 secondes, le chiffre de la barre latérale chaque minute. Après une modification, ce bouton vérifie tout de suite.",
      },
    },
  ],

  equipment: [
    {
      ziel: 'titel',
      titel: { de: 'Was ans Set muss', en: 'What goes to set', fr: 'Ce qui part sur le plateau' },
      text: {
        de: "Equipmentlisten je Gewerk, mit Mietpreis und Summen. Oben steht, wie viele Listen es gibt und an wie vielen Drehtagen gedreht wird.",
        en: "Equipment lists per department, with rental prices and totals. At the top you see how many lists there are and how many shoot days there are.",
        fr: "Des listes de matériel par département, avec prix de location et totaux. En haut figurent le nombre de listes et de jours de tournage.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Eine Liste anlegen', en: 'Create a list', fr: 'Créer une liste' },
      text: {
        de: "Name und Abteilung - Kamera, Licht, Ton, Grip und so weiter -, dann \"Liste anlegen\". Das PDF fasst alle Listen für den Verleih oder das Packen zusammen.",
        en: "Name and department - camera, lighting, sound, grip and so on - then \"Create list\". The PDF combines all lists for the rental house or packing.",
        fr: "Nom et département - image, lumière, son, machinerie, etc. - puis « Créer la liste ». Le PDF réunit toutes les listes pour le loueur ou le chargement.",
      },
    },
    {
      ziel: 'liste',
      titel: { de: 'Positionen', en: 'Items', fr: 'Éléments' },
      text: {
        de: "Je Position Bezeichnung, Menge, Miettage, Preis pro Tag und Verleiher; die Summe rechnet sich selbst. Neue Positionen bekommen als Miettage die Zahl der Drehtage vorgeschlagen.",
        en: "For each item the name, quantity, rental days, price per day and rental house; the total calculates itself. New items get the number of shoot days suggested as rental days.",
        fr: "Pour chaque élément : désignation, quantité, jours de location, prix par jour et loueur ; le total se calcule seul. Les nouveaux éléments reçoivent le nombre de jours de tournage comme jours de location proposés.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Wohin die Mieten gehen', en: 'Where the rentals go', fr: 'Où vont les locations' },
      text: {
        de: "\"Kosten übernehmen\" im Budget holt Menge mal Tage mal Preis in die Kalkulation. Wann welches Gerät gebraucht wird, planst du im Equipment-Kalender - der findet auch Doppelbuchungen.",
        en: "\"Import costs\" in the budget brings quantity times days times price into the budget. When which item is needed, you plan in the equipment calendar - which also finds double bookings.",
        fr: "« Importer les coûts » dans le budget reprend quantité fois jours fois prix. Quand quel matériel est nécessaire, tu le planifies dans le calendrier du matériel - qui détecte aussi les doubles réservations.",
      },
      wirktAuf: ['budget', 'equipment-kalender'],
    },
  ],

  'equipment-kalender': [
    {
      ziel: 'titel',
      titel: { de: 'Wann welches Gerät wo ist', en: 'When which item is where', fr: 'Quel matériel est où et quand' },
      text: {
        de: "Buchungen für die Positionen aus den Equipment-Listen. Oben steht, wie viele Positionen es gibt und über wie viele Wochen gebucht ist.",
        en: "Bookings for the items from the equipment lists. At the top you see how many items there are and over how many weeks they are booked.",
        fr: "Des réservations pour les éléments des listes de matériel. En haut figurent le nombre d'éléments et de semaines réservées.",
      },
      wirktAuf: ['equipment'],
    },
    {
      ziel: 'neu',
      titel: { de: 'Ein Gerät buchen', en: 'Book an item', fr: 'Réserver un élément' },
      text: {
        de: "Position wählen, von wann bis wann, dazu eine Notiz - etwa für welchen Dreh oder wer es abholt.",
        en: "Choose the item, from when to when, plus a note - for which shoot, say, or who picks it up.",
        fr: "Choisis l'élément, de quand à quand, plus une note - pour quel tournage ou qui le récupère, par exemple.",
      },
    },
    {
      ziel: 'kalender',
      titel: { de: 'Doppelbuchungen fallen auf', en: 'Double bookings stand out', fr: 'Les doubles réservations ressortent' },
      text: {
        de: "Je Position eine Zeile, je Woche eine Spalte. Überschneiden sich zwei Buchungen desselben Geräts, steht das rot über dem Kalender, mit beiden Zeiträumen.",
        en: "One row per item, one column per week. If two bookings of the same item overlap, it shows in red above the calendar, with both periods.",
        fr: "Une ligne par élément, une colonne par semaine. Si deux réservations du même matériel se chevauchent, cela apparaît en rouge au-dessus du calendrier, avec les deux périodes.",
      },
    },
  ],

  fahrzeuge: [
    {
      ziel: 'titel',
      titel: { de: 'Die Fahrzeuge der Produktion', en: 'The production’s vehicles', fr: 'Les véhicules de la production' },
      text: {
        de: "Für Fahrgemeinschaften, Technik-Transporte und auswärtige Drehs.",
        en: "For car pools, gear transport and shoots away from base.",
        fr: "Pour le covoiturage, le transport du matériel et les tournages à l'extérieur.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Ein Fahrzeug eintragen', en: 'Add a vehicle', fr: 'Ajouter un véhicule' },
      text: {
        de: "Bezeichnung, Art, Kennzeichen, Sitzplätze und Fahrer, direkt in einer Zeile.",
        en: "Name, type, licence plate, seats and driver, right in one row.",
        fr: "Désignation, type, immatriculation, places et conducteur, directement dans une ligne.",
      },
    },
    {
      ziel: 'liste',
      titel: { de: 'Ändern und löschen', en: 'Edit and delete', fr: 'Modifier et supprimer' },
      text: {
        de: "Der Stift macht eine Zeile bearbeitbar, der Papierkorb löscht sie; gelöschte Fahrzeuge bleiben 30 Tage im Papierkorb.",
        en: "The pencil makes a row editable, the bin deletes it; deleted vehicles stay in the bin for 30 days.",
        fr: "Le crayon rend une ligne modifiable, la corbeille la supprime ; les véhicules supprimés restent 30 jours dans la corbeille.",
      },
      wirktAuf: ['papierkorb'],
    },
  ],

  reise: [
    {
      ziel: 'titel',
      titel: { de: 'Reise und Unterkunft', en: 'Travel and accommodation', fr: 'Voyage et hébergement' },
      text: {
        de: "Wer wohin fährt, wo die Leute schlafen und was ihnen dafür zusteht - für jeden auswärtigen Dreh.",
        en: "Who travels where, where people sleep and what they are entitled to - for every shoot away from base.",
        fr: "Qui va où, où dorment les gens et ce à quoi ils ont droit - pour chaque tournage à l'extérieur.",
      },
    },
    {
      ziel: 'pauschalen',
      reiter: 'reisen',
      titel: { de: 'Die Pauschalen', en: 'The allowances', fr: 'Les indemnités' },
      text: {
        de: "Die Verpflegungspauschalen nach § 9 Abs. 4a EStG: für mehr als acht Stunden, für volle Tage und für An- und Abreisetage. Gestellte Mahlzeiten kürzen sie - das rechnet die Seite für dich.",
        en: "The German per-diem allowances: for more than eight hours, for full days and for arrival and departure days. Meals provided reduce them - the page does the maths for you.",
        fr: "Les indemnités journalières allemandes : pour plus de huit heures, pour les journées complètes et pour les jours d'arrivée et de départ. Les repas fournis les réduisent - la page fait le calcul pour toi.",
      },
    },
    {
      ziel: 'neue-reise',
      reiter: 'reisen',
      titel: { de: 'Eine Reise anlegen', en: 'Add a trip', fr: 'Ajouter un voyage' },
      text: {
        de: "Person aus Besetzung oder Stab, Anlass, Zeitraum, Kilometer und Unterkunft. Aus dem Zeitraum entstehen die Tage; je Tag hakst du gestellte Frühstücke, Mittag- und Abendessen ab. Hat die Unterkunft Frühstück inklusive, ist die Kürzung schon eingetragen.",
        en: "Person from cast or crew, reason, period, kilometres and accommodation. The days follow from the period; for each day you tick provided breakfasts, lunches and dinners. If the accommodation includes breakfast, the reduction is already entered.",
        fr: "Personne du casting ou de l'équipe, motif, période, kilomètres et hébergement. Les jours découlent de la période ; pour chaque jour, tu coches petits-déjeuners, déjeuners et dîners fournis. Si l'hébergement inclut le petit-déjeuner, la réduction est déjà saisie.",
      },
      wirktAuf: ['besetzung', 'stabliste'],
    },
    {
      ziel: 'neue-reise',
      reiter: 'reisen',
      titel: { de: 'Abrechnen', en: 'Settling up', fr: 'Régler' },
      text: {
        de: "Je Reise Verpflegung, Fahrt, Übernachtung und Gesamt, darüber die Summe aller Reisen. \"Als CSV\" geht an die Buchhaltung. Nicht abgerechnete Reisen meldet die Prüfliste des Abschlusses.",
        en: "For each trip meals, travel, accommodation and total, with the sum of all trips above. \"As CSV\" goes to accounting. Unsettled trips appear in the wrap-up checklist.",
        fr: "Pour chaque voyage : repas, trajet, nuitées et total, avec au-dessus la somme de tous les voyages. « En CSV » part à la comptabilité. Les voyages non réglés figurent dans la liste de clôture.",
      },
      wirktAuf: ['abschluss'],
    },
    {
      ziel: 'neue-unterkunft',
      reiter: 'unterkunft',
      titel: { de: 'Unterkünfte', en: 'Accommodation', fr: 'Hébergements' },
      text: {
        de: "Hotel oder Wohnung mit Adresse, Telefon, Buchungsnummer, An- und Abreise, Preis je Nacht und ob Frühstück dabei ist. Darunter die Zimmer und wer in welchem schläft.",
        en: "Hotel or flat with address, phone, booking number, arrival and departure, price per night and whether breakfast is included. Below, the rooms and who sleeps in which.",
        fr: "Hôtel ou appartement avec adresse, téléphone, numéro de réservation, arrivée et départ, prix par nuit et petit-déjeuner inclus ou non. En dessous, les chambres et qui dort dans laquelle.",
      },
    },
  ],

  ablage: [
    {
      ziel: 'titel',
      titel: { de: 'Das Papier des Projekts', en: 'The project’s paperwork', fr: 'Les papiers du projet' },
      text: {
        de: "Genehmigungen, Nachweise, Verträge und Belege an einem Ort - statt verteilt auf Postfächer und Ordner.",
        en: "Permits, certificates, contracts and receipts in one place - instead of spread across inboxes and folders.",
        fr: "Autorisations, attestations, contrats et justificatifs au même endroit - au lieu d'être éparpillés entre boîtes mail et dossiers.",
      },
    },
    {
      ziel: 'hochladen',
      titel: { de: 'Hochladen', en: 'Upload', fr: 'Téléverser' },
      text: {
        de: "PDF oder Bild wählen und hochladen, dann Art, Titel und bei Nachweisen das Ablaufdatum angeben. Arten sind etwa Drehgenehmigung, Versicherungsnachweis, Vertrag als Scan, Eingangsrechnung, Grundriss, Foto oder Storyboard.",
        en: "Choose a PDF or image and upload it, then set type, title and, for certificates, the expiry date. Types include filming permit, insurance certificate, scanned contract, incoming invoice, floor plan, photo or storyboard.",
        fr: "Choisis un PDF ou une image et téléverse-le, puis indique type, titre et, pour les attestations, la date d'expiration. Les types incluent autorisation de tournage, attestation d'assurance, contrat scanné, facture reçue, plan, photo ou storyboard.",
      },
    },
    {
      ziel: 'filter',
      titel: { de: 'Nach Art sortiert', en: 'Sorted by type', fr: 'Triés par type' },
      text: {
        de: "Ein Klick zeigt nur eine Art, etwa alle Drehgenehmigungen. In der Liste lädst du eine Datei herunter, änderst ihre Angaben oder löschst sie.",
        en: "One click shows a single type, such as all filming permits. In the list you download a file, edit its details or delete it.",
        fr: "Un clic n'affiche qu'un type, par exemple toutes les autorisations de tournage. Dans la liste, tu télécharges un fichier, modifies ses infos ou le supprimes.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Fristen behält CutSheet im Blick', en: 'CutSheet keeps an eye on deadlines', fr: 'CutSheet surveille les échéances' },
      text: {
        de: "Drehgenehmigungen und Versicherungsnachweise mit Ablaufdatum melden sich dreißig Tage vorher. Abgelaufene stehen in der Prüfliste des Abschlusses.",
        en: "Filming permits and insurance certificates with an expiry date send a reminder thirty days beforehand. Expired ones appear in the wrap-up checklist.",
        fr: "Les autorisations de tournage et attestations d'assurance avec date d'expiration préviennent trente jours avant. Celles expirées figurent dans la liste de clôture.",
      },
      wirktAuf: ['abschluss', 'versicherungen'],
    },
  ],

  abnahme: [
    {
      ziel: 'titel',
      titel: { de: 'Freigabe durch den Auftraggeber', en: 'Sign-off by the client', fr: 'Validation par le client' },
      text: {
        de: "Fassungen, Anmerkungen und die Freigabe - nachvollziehbar im Projekt statt verstreut in Mails.",
        en: "Cuts, notes and the sign-off - traceable in the project instead of scattered across emails.",
        fr: "Versions, annotations et validation - traçables dans le projet au lieu d'être dispersées dans les e-mails.",
      },
    },
    {
      ziel: 'neue-fassung',
      reiter: 'fassungen',
      titel: { de: 'Fassungen', en: 'Cuts', fr: 'Versions' },
      text: {
        de: "Jeder Schnitt, der rausgeht: Bezeichnung, Stufe vom Rohschnitt bis zur finalen Fassung, Länge, Format und der Link zum Ansehen. Die Liste zeigt, in wie vielen Runden eine Fassung schon war.",
        en: "Every cut that goes out: name, stage from rough cut to final, length, format and the link to watch it. The list shows how many rounds a cut has already been through.",
        fr: "Chaque montage envoyé : désignation, étape du premier montage à la version finale, durée, format et lien de visionnage. La liste montre combien de tours une version a déjà faits.",
      },
    },
    {
      ziel: 'neue-runde',
      reiter: 'runden',
      titel: { de: 'Zur Abnahme geben', en: 'Send for approval', fr: 'Envoyer en validation' },
      text: {
        de: "Fassung wählen, Mailadresse des Auftraggebers, Rückmeldefrist und eine Nachricht. Er bekommt einen Link, sieht die Fassung, schreibt Anmerkungen mit Zeitstelle und nimmt ab - ohne Konto.",
        en: "Choose the cut, the client’s email address, the reply deadline and a message. They get a link, watch the cut, add timecoded notes and approve - without an account.",
        fr: "Choisis la version, l'adresse e-mail du client, le délai de réponse et un message. Il reçoit un lien, regarde la version, annote avec le timecode et valide - sans compte.",
      },
      wirktAuf: ['email'],
    },
    {
      ziel: 'neue-runde',
      reiter: 'runden',
      titel: { de: 'Anmerkungen und Protokoll', en: 'Notes and report', fr: 'Annotations et procès-verbal' },
      text: {
        de: "In der Runde hakst du jede Anmerkung ab, sobald sie im Schnitt erledigt ist. Das Abnahmeprotokoll als PDF hält fest, was abgenommen wurde. Runden ohne Entscheidung meldet die Prüfliste des Abschlusses.",
        en: "In the round you tick off each note once it is done in the edit. The approval report as PDF records what was signed off. Rounds without a decision appear in the wrap-up checklist.",
        fr: "Dans le tour, tu coches chaque annotation une fois traitée au montage. Le procès-verbal PDF consigne ce qui a été validé. Les tours sans décision figurent dans la liste de clôture.",
      },
      wirktAuf: ['abschluss'],
    },
  ],

  abschluss: [
    {
      ziel: 'titel',
      titel: { de: 'Wenn das Projekt vorbei scheint', en: 'When the project seems over', fr: 'Quand le projet semble fini' },
      text: {
        de: "Ein Dreh ist irgendwann vorbei, ein Projekt damit nicht. Was danach kommt, vergisst man zuverlässig - diese Seite sammelt es.",
        en: "A shoot ends at some point; the project doesn’t. What comes after is reliably forgotten - this page collects it.",
        fr: "Un tournage finit un jour, pas le projet. Ce qui vient après s'oublie sûrement - cette page le rassemble.",
      },
    },
    {
      ziel: 'pruefliste',
      titel: { de: 'Was noch offen ist', en: 'What is still open', fr: 'Ce qui reste ouvert' },
      text: {
        de: "Aus acht Quellen: offene Rechnungen, unbestätigte Verträge, Abnahmen ohne Entscheidung, fehlende Bewilligungen für Kinder, nicht abgerechnete Reisen, Meldungen an die Künstlersozialkasse, offene Agenturanfragen und abgelaufene Nachweise. Jeder Punkt führt auf seine Seite.",
        en: "From eight sources: unpaid invoices, unconfirmed contracts, reviews without a decision, missing permits for children, unsettled travel, artists’ social insurance reports, open agency requests and expired certificates. Each item leads to its page.",
        fr: "Huit sources : factures impayées, contrats non confirmés, validations sans décision, autorisations manquantes pour enfants, voyages non réglés, déclarations à la caisse sociale des artistes, demandes d'agence ouvertes et attestations expirées. Chaque point mène à sa page.",
      },
      wirktAuf: ['vertraege', 'abnahme', 'reise', 'ablage'],
    },
    {
      ziel: 'pruefliste',
      titel: { de: 'Abschließen', en: 'Wrapping up', fr: 'Clôturer' },
      text: {
        de: "\"Abschließen\" setzt das Projekt auf abgeschlossen und archiviert es. Ist noch etwas offen, fragt die Seite nach. Ein abgeschlossenes Projekt lässt sich wieder öffnen - es kommt in den Stand von vorher zurück.",
        en: "\"Wrap up\" sets the project to completed and archives it. If anything is still open, the page asks first. A wrapped-up project can be reopened - it returns to its previous status.",
        fr: "« Clôturer » passe le projet à terminé et l'archive. Si quelque chose reste ouvert, la page demande confirmation. Un projet clôturé peut être rouvert - il retrouve son état précédent.",
      },
    },
    {
      ziel: 'aufbewahrung',
      titel: { de: 'Was aufzuheben ist', en: 'What must be kept', fr: 'Ce qui doit être conservé' },
      text: {
        de: "Welche Unterlagen wie lange aufbewahrt werden müssen - Verträge, Rechnungen, Belege -, damit nach Projektende nichts zu früh weggeworfen wird.",
        en: "Which documents must be kept and for how long - contracts, invoices, receipts - so that nothing is thrown away too early after the project.",
        fr: "Quels documents conserver et combien de temps - contrats, factures, justificatifs - pour ne rien jeter trop tôt après le projet.",
      },
    },
  ],

  catering: [
    {
      ziel: 'titel',
      titel: { de: 'Wer isst was nicht', en: 'Who doesn’t eat what', fr: 'Qui ne mange pas quoi' },
      text: {
        de: "Damit beim Caterer richtig bestellt wird: Vorlieben und Unverträglichkeiten aller Beteiligten, je Drehtag zusammengezählt.",
        en: "So the caterer gets the right order: preferences and intolerances of everyone involved, totalled per shoot day.",
        fr: "Pour bien commander chez le traiteur : préférences et intolérances de chacun, totalisées par jour de tournage.",
      },
    },
    {
      ziel: 'reiter-praeferenzen',
      reiter: 'praeferenzen',
      titel: { de: 'Präferenzen', en: 'Preferences', fr: 'Préférences' },
      text: {
        de: "Je Person aus Besetzung, Stab und Komparserie: keine Einschränkung, vegetarisch, vegan, glutenfrei, laktosefrei, halal oder koscher, dazu Allergien als Notiz.",
        en: "For each person from cast, crew and extras: no restriction, vegetarian, vegan, gluten-free, lactose-free, halal or kosher, plus allergies as a note.",
        fr: "Pour chaque personne du casting, de l'équipe et de la figuration : aucune restriction, végétarien, végan, sans gluten, sans lactose, halal ou casher, plus les allergies en note.",
      },
      wirktAuf: ['besetzung', 'stabliste', 'komparsen'],
    },
    {
      ziel: 'reiter-tagesliste',
      reiter: 'tagesliste',
      titel: { de: 'Tagesliste', en: 'Day list', fr: 'Liste du jour' },
      text: {
        de: "Drehtag wählen: Die Liste nimmt alle, die auf seiner Dispo stehen, zählt sie nach Ernährungsweise zusammen und nennt die Gesamtzahl - die Bestellung für den Caterer. Die Zahl der Essen in der Dispo pflegst du dort selbst.",
        en: "Pick a shoot day: the list takes everyone on its call sheet, counts them by diet and gives the total - the order for the caterer. The number of meals on the call sheet you keep there yourself.",
        fr: "Choisis un jour : la liste reprend tous ceux de sa feuille de service, les compte par régime et donne le total - la commande pour le traiteur. Le nombre de repas de la feuille de service se gère là-bas.",
      },
      wirktAuf: ['tagesdispo'],
    },
  ],

  budget: [
    {
      ziel: 'titel',
      titel: { de: 'Was der Film kostet und wer ihn bezahlt', en: 'What the film costs and who pays', fr: 'Ce que coûte le film et qui paie' },
      text: {
        de: "Die Kalkulation und der Finanzierungsplan, beide in Fassungen. Ändern dürfen beides Produktion und Admins.",
        en: "The budget and the financing plan, both in versions. Producers and admins can change them.",
        fr: "Le budget et le plan de financement, tous deux en versions. La production et les admins peuvent les modifier.",
      },
    },
    {
      ziel: 'kalkulation',
      reiter: 'kalkulation',
      titel: { de: 'Die Kalkulation', en: 'The budget', fr: 'Le budget' },
      text: {
        de: "Links die Fassung, rechts die Summe. Positionen legst du nach Kontenrahmen an, von 1000 Stab bis 10000 Musik, je mit Menge, Einheit und Einzelpreis. Das PDF ist die Kalkulation zum Weitergeben.",
        en: "The version on the left, the total on the right. Add lines by account, from 1000 crew to 10000 music, each with quantity, unit and unit price. The PDF is the budget to hand on.",
        fr: "La version à gauche, le total à droite. Ajoute les lignes par compte, de 1000 équipe à 10000 musique, chacune avec quantité, unité et prix unitaire. Le PDF est le budget à transmettre.",
      },
    },
    {
      ziel: 'kosten',
      reiter: 'kalkulation',
      titel: { de: 'Kosten aus dem Projekt holen', en: 'Pull costs from the project', fr: 'Récupérer les coûts du projet' },
      text: {
        de: "Gagen aus Besetzung und Stab mal Drehtage, Mieten aus dem Equipment und Prämien der Versicherungen. Erst kommt eine Vorschau, was neu, geändert oder entfallen wäre; wer ohne Drehtag noch nichts kostet, steht dabei. Von Hand angelegte Posten bleiben unberührt.",
        en: "Fees from cast and crew times shoot days, rentals from equipment and insurance premiums. First comes a preview of what would be new, changed or dropped; anyone without a shoot day, who costs nothing yet, is listed. Lines added by hand stay untouched.",
        fr: "Cachets du casting et de l'équipe fois jours de tournage, locations du matériel et primes d'assurance. D'abord un aperçu de ce qui serait nouveau, modifié ou supprimé ; qui n'a pas encore de jour, et ne coûte donc rien, y figure. Les lignes saisies à la main restent intactes.",
      },
      wirktAuf: ['besetzung', 'stabliste', 'equipment', 'versicherungen'],
    },
    {
      ziel: 'finanzierung',
      reiter: 'finanzierung',
      titel: { de: 'Der Finanzierungsplan', en: 'The financing plan', fr: 'Le plan de financement' },
      text: {
        de: "Jeder Geldgeber mit Art - Förderung regional oder national, Sender, Eigenmittel, Co-Produktion, Vertrieb -, Betrag und ob er schon bestätigt ist. Deckt die Finanzierung die Kalkulation nicht, zeigt die Hauptseite die Lücke und der Konfliktradar warnt.",
        en: "Each funder with type - regional or national funding, broadcaster, own funds, co-production, distribution -, amount and whether it is confirmed. If financing doesn’t cover the budget, the main page shows the gap and the conflict radar warns.",
        fr: "Chaque financeur avec son type - aide régionale ou nationale, diffuseur, fonds propres, coproduction, distribution -, son montant et s'il est confirmé. Si le financement ne couvre pas le budget, la page principale montre l'écart et le radar des conflits avertit.",
      },
      wirktAuf: ['', 'konfliktradar'],
    },
    {
      ziel: 'foerderantrag',
      reiter: 'kalkulation',
      titel: { de: 'Für den Förderantrag', en: 'For the funding application', fr: "Pour la demande d'aide" },
      text: {
        de: "Ein PDF mit Projektdaten, Kalkulation und Finanzierungsplan zusammen - mit Drehzeitraum, Regie und Produktion aus den Stammdaten.",
        en: "One PDF with project data, budget and financing plan together - with shooting period, director and producer from the project details.",
        fr: "Un PDF réunissant données du projet, budget et plan de financement - avec période de tournage, réalisation et production des données du projet.",
      },
      wirktAuf: ['stammdaten'],
    },
  ],

  kostenstand: [
    {
      ziel: 'titel',
      titel: { de: 'Plan gegen Ist', en: 'Plan against actual', fr: 'Prévu face au réel' },
      text: {
        de: "Was ausgegeben ist, gemessen an der aktiven Kalkulation - wöchentlich während des Drehs angeschaut, hält das den Stand ehrlich.",
        en: "What has been spent, measured against the active budget - looked at weekly during the shoot, it keeps the figures honest.",
        fr: "Ce qui est dépensé, comparé au budget actif - regardé chaque semaine pendant le tournage, cela garde les chiffres honnêtes.",
      },
      wirktAuf: ['budget'],
    },
    {
      ziel: 'summen',
      titel: { de: 'Kalkuliert, ausgegeben, übrig', en: 'Budgeted, spent, left', fr: 'Prévu, dépensé, restant' },
      text: {
        de: "Kalkuliert ist, was in der aktiven Kalkulation steht; ausgegeben, was du hier als Beleg erfasst; dazu, was übrig bleibt.",
        en: "Budgeted is what the active budget version says; spent is what you record here as receipts; plus what is left.",
        fr: "Prévu, c'est ce qui figure dans le budget actif ; dépensé, ce que tu saisis ici comme justificatifs ; plus ce qui reste.",
      },
    },
    {
      ziel: 'warnung',
      titel: { de: 'Frühwarnung', en: 'Early warning', fr: 'Alerte précoce' },
      text: {
        de: "Schalte sie ein und lege fest, ab wie viel Prozent der Kalkulation gewarnt wird - vorgeschlagen sind 80. Dann steht die Warnung hier, bevor das Geld weg ist, nicht danach.",
        en: "Switch it on and set at what percentage of the budget you get warned - 80 is suggested. Then the warning shows here before the money is gone, not after.",
        fr: "Active-la et fixe à partir de quel pourcentage du budget tu es averti - 80 est proposé. L'alerte apparaît alors ici avant que l'argent soit parti, pas après.",
      },
    },
    {
      ziel: 'beleg',
      titel: { de: 'Ausgaben erfassen', en: 'Record expenses', fr: 'Saisir les dépenses' },
      text: {
        de: "Eine Zeile je Beleg: Beschreibung, Kategorie, Betrag, Datum und Belegnummer. Darunter stehen alle Belege; ein Klick auf das Zeichen löscht einen.",
        en: "One line per receipt: description, category, amount, date and receipt number. All receipts are listed below; one click on the icon deletes one.",
        fr: "Une ligne par justificatif : description, catégorie, montant, date et numéro. Tous les justificatifs sont listés en dessous ; un clic sur l'icône en supprime un.",
      },
    },
  ],

  versicherungen: [
    {
      ziel: 'titel',
      titel: { de: 'Policen im Blick', en: 'Policies at a glance', fr: 'Les polices en vue' },
      text: {
        de: "Alle Versicherungen der Produktion; oben steht die Summe der Prämien. Spätestens vor dem ersten Drehtag gehört hier alles hin - und wenn ein Motiv den Nachweis verlangt.",
        en: "All of the production’s insurance; the total of the premiums is at the top. Everything belongs here before the first shoot day at the latest - and whenever a location asks for proof.",
        fr: "Toutes les assurances de la production ; le total des primes figure en haut. Tout doit y être au plus tard avant le premier jour - et chaque fois qu'un décor demande une attestation.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Eine Police eintragen', en: 'Add a policy', fr: 'Ajouter une police' },
      text: {
        de: "Art der Versicherung, Gesellschaft, Policennummer, Laufzeit, Deckungssumme und Prämie.",
        en: "Type of insurance, insurer, policy number, term, coverage amount and premium.",
        fr: "Type d'assurance, compagnie, numéro de police, durée, montant de couverture et prime.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Wohin eine Police wirkt', en: 'Where a policy carries over', fr: 'Où une police se répercute' },
      text: {
        de: "Die Prämien holt \"Kosten übernehmen\" ins Budget. Den Nachweis legst du in der Ablage als Versicherungsnachweis ab - mit Ablaufdatum meldet er sich dreißig Tage vorher.",
        en: "\"Import costs\" brings the premiums into the budget. File the certificate in the documents as an insurance certificate - with an expiry date it sends a reminder thirty days beforehand.",
        fr: "« Importer les coûts » reprend les primes dans le budget. Range l'attestation dans les documents comme attestation d'assurance - avec une date d'expiration, elle prévient trente jours avant.",
      },
      wirktAuf: ['budget', 'ablage'],
    },
  ],
}
