import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: Planung und Vorbereitung. */
export const planung: Record<string, Schritt[]> = {
  motive: [
    {
      ziel: 'titel',
      titel: { de: 'Die Drehorte', en: 'The locations', fr: 'Les décors' },
      text: {
        de: 'Jedes Motiv mit Adresse, Ansprechpartner, Eigentümer, Miete und Strom. Spielorte aus dem Drehbuch landen von selbst hier - beim Schreiben und beim Import.',
        en: 'Every location with address, contact, owner, rent and power. Settings from the script land here by themselves - while writing and on import.',
        fr: "Chaque décor avec adresse, contact, propriétaire, loyer et électricité. Les lieux du scénario arrivent ici d'eux-mêmes - à l'écriture et à l'import.",
      },
      wirktAuf: ['drehbuch', 'screenplay-editor'],
    },
    {
      ziel: 'motiv',
      titel: { de: 'Ein Motiv aufklappen', en: 'Open up a location', fr: 'Déplier un décor' },
      text: {
        de: 'Hier stehen alle Angaben, eine Karte und der Motivvertrag, den der Eigentümer direkt auf dem Bildschirm unterschreibt. Das Motiv einer Szene wird zum Drehort ihrer Tagesdispo, der Ansprechpartner steht in der Kontaktliste.',
        en: 'Here are all details, a map and the location release, which the owner signs right on the screen. A scene’s location becomes the set on its call sheet; the contact appears in the contact list.',
        fr: "Ici figurent toutes les infos, une carte et le contrat de décor, que le propriétaire signe directement à l'écran. Le décor d'une scène devient le lieu de tournage de sa feuille de service ; le contact figure dans la liste de contacts.",
      },
      wirktAuf: ['tagesdispo', 'kontakte'],
    },
  ],

  drehplan: [
    {
      ziel: 'pool',
      titel: { de: 'Szenen, die noch keinen Tag haben', en: 'Scenes without a day yet', fr: 'Scènes sans jour pour le moment' },
      text: {
        de: 'Links liegen alle Szenen, die noch nicht eingeplant sind. Zieh sie in einen Drehtag - am Telefon kurz gedrückt halten, dann ziehen.',
        en: 'All scenes not yet scheduled sit on the left. Drag them into a shoot day - on a phone, press briefly, then drag.',
        fr: "Toutes les scènes pas encore planifiées sont à gauche. Fais-les glisser dans un jour de tournage - sur téléphone, appuie brièvement puis fais glisser.",
      },
    },
    {
      ziel: 'drehtag',
      titel: { de: 'Ein Drehtag', en: 'A shoot day', fr: 'Un jour de tournage' },
      text: {
        de: 'Datum, Status und seine Szenen in Drehreihenfolge. Kommt eine Szene in den Tag, holt die Tagesdispo ihre Darsteller dazu, und der Konfliktradar prüft den neuen Stand.',
        en: 'Date, status and its scenes in shooting order. When a scene joins the day, the call sheet adds its actors, and the conflict radar checks the new state.',
        fr: "Date, statut et ses scènes dans l'ordre de tournage. Quand une scène rejoint le jour, la feuille de service ajoute ses acteurs, et le radar des conflits vérifie le nouvel état.",
      },
      wirktAuf: ['tagesdispo', 'konfliktradar', 'dood', 'kalender'],
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Fassungen und Vorschläge', en: 'Versions and suggestions', fr: 'Versions et suggestions' },
      text: {
        de: 'Sichere den Plan als Version, bevor du ihn umwirfst, und hol eine alte zurück. Die Optimierung schlägt eine neue Reihenfolge vor. Neue Drehtage legst du einzeln oder als Zeitraum an.',
        en: 'Save the plan as a version before you overhaul it, and restore an old one. The optimisation suggests a new order. Add new shoot days one by one or as a date range.',
        fr: "Enregistre le plan comme version avant de le bouleverser, et restaure une ancienne. L'optimisation propose un nouvel ordre. Ajoute de nouveaux jours un par un ou sur une période.",
      },
    },
  ],

  staebchenplan: [
    {
      ziel: 'tafel',
      titel: { de: 'Der Plan als Streifen', en: 'The plan as strips', fr: 'Le plan en bandes' },
      text: {
        de: 'Jeder Drehtag eine Spalte, jede Szene ein Streifen, gefärbt nach Innen/Außen und Tageszeit. So siehst du auf einen Blick, wo Tag und Nacht oder Innen und Außen wechseln. Geändert wird im Drehplan.',
        en: 'Each shoot day a column, each scene a strip, coloured by interior/exterior and time of day. You see at a glance where day and night or interior and exterior change. Changes are made in the shooting schedule.',
        fr: "Chaque jour une colonne, chaque scène une bande, colorée selon intérieur/extérieur et moment de la journée. Tu vois d'un coup d'œil où jour et nuit ou intérieur et extérieur alternent. Les modifications se font dans le plan de tournage.",
      },
      wirktAuf: ['drehplan'],
    },
  ],

  kalender: [
    {
      ziel: 'monat',
      titel: { de: 'Alles mit Datum', en: 'Everything with a date', fr: 'Tout ce qui a une date' },
      text: {
        de: 'Die Drehtage aus dem Drehplan und alle anderen Termine: Castings, Besichtigungen, Proben, Meetings, Reisen. Ein Klick auf einen Tag zeigt, was dort ansteht.',
        en: 'The shoot days from the schedule and every other appointment: castings, recces, rehearsals, meetings, travel. Click a day to see what is on.',
        fr: 'Les jours de tournage du plan et tous les autres rendez-vous : castings, repérages, répétitions, réunions, déplacements. Un clic sur un jour montre ce qui est prévu.',
      },
      wirktAuf: ['drehplan'],
    },
    {
      ziel: 'aktionen',
      titel: { de: 'In deinen eigenen Kalender', en: 'Into your own calendar', fr: 'Dans ton propre agenda' },
      text: {
        de: 'Der Export bringt Drehtage und Termine als Datei in Google, Apple oder Outlook.',
        en: 'The export brings shoot days and appointments as a file into Google, Apple or Outlook.',
        fr: "L'export envoie jours de tournage et rendez-vous sous forme de fichier vers Google, Apple ou Outlook.",
      },
    },
  ],

  konfliktradar: [
    {
      ziel: 'titel',
      titel: { de: 'Was am Plan nicht passt', en: 'What doesn’t fit the plan', fr: 'Ce qui cloche dans le plan' },
      text: {
        de: 'Der Radar prüft bei jedem Öffnen das ganze Projekt: Szenen doppelt oder gar nicht eingeplant, leere Drehtage, zwei Drehtage an einem Datum, zu kurze Ruhezeiten, Besetzung an Sperrtagen, Szenen ohne Motiv oder Figuren, Budget gegen Finanzierung.',
        en: 'Each time it opens, the radar checks the whole project: scenes scheduled twice or not at all, empty shoot days, two shoot days on one date, rest periods too short, cast on blocked days, scenes without location or characters, budget against financing.',
        fr: "À chaque ouverture, le radar vérifie tout le projet : scènes planifiées deux fois ou pas du tout, jours vides, deux jours à la même date, repos trop courts, acteurs pendant leurs jours bloqués, scènes sans décor ni personnages, budget face au financement.",
      },
    },
    {
      ziel: 'liste',
      titel: { de: 'Fehler, Warnungen, Hinweise', en: 'Errors, warnings, hints', fr: 'Erreurs, avertissements, conseils' },
      text: {
        de: 'Fehler und Warnungen zählen in der Seitenleiste und auf der Hauptseite. Die Ruhezeit nimmt der Radar aus den Stammdaten.',
        en: 'Errors and warnings are counted in the sidebar and on the main page. The radar takes the rest period from the project details.',
        fr: 'Les erreurs et avertissements sont comptés dans la barre latérale et sur la page principale. Le radar prend le temps de repos dans les données du projet.',
      },
      wirktAuf: ['', 'stammdaten'],
    },
    {
      ziel: 'sprung',
      titel: { de: 'Direkt zur Ursache', en: 'Straight to the cause', fr: 'Directement à la cause' },
      text: {
        de: 'Jede Meldung führt mit einem Klick auf die Seite, auf der du sie behebst.',
        en: 'Each message takes you with one click to the page where you fix it.',
        fr: 'Chaque message mène en un clic à la page où tu le corriges.',
      },
    },
  ],

  equipment: [
    {
      ziel: 'aktionen',
      titel: { de: 'Listen je Gewerk', en: 'Lists per department', fr: 'Listes par département' },
      text: {
        de: 'Kamera, Licht, Ton und alles andere bekommen eigene Listen, mit Menge, Miettagen und Mietpreis. Das PDF geht an den Verleih oder ans Team beim Packen.',
        en: 'Camera, lighting, sound and everything else get their own lists, with quantity, rental days and rental price. The PDF goes to the rental house or to the team when packing.',
        fr: "Caméra, lumière, son et le reste ont chacun leur liste, avec quantité, jours de location et prix. Le PDF va au loueur ou à l'équipe au moment de charger.",
      },
    },
    {
      ziel: 'titel',
      titel: { de: 'Wohin die Mieten gehen', en: 'Where the rentals go', fr: 'Où vont les locations' },
      text: {
        de: '"Kosten übernehmen" im Budget holt Menge mal Tage mal Preis in die Kalkulation. Wann welches Gerät gebraucht wird, planst du im Equipment-Kalender.',
        en: '"Import costs" in the budget brings quantity times days times price into the budget. When which item is needed, you plan in the equipment calendar.',
        fr: "« Importer les coûts » dans le budget reprend quantité fois jours fois prix. Quand quel matériel est nécessaire, tu le planifies dans le calendrier du matériel.",
      },
      wirktAuf: ['budget', 'equipment-kalender'],
    },
  ],

  'equipment-kalender': [
    {
      ziel: 'neu',
      titel: { de: 'Geräte buchen', en: 'Book equipment', fr: 'Réserver du matériel' },
      text: {
        de: 'Eine Buchung legt fest, von wann bis wann eine Position aus den Equipment-Listen gebraucht wird.',
        en: 'A booking sets from when to when an item from the equipment lists is needed.',
        fr: "Une réservation fixe de quand à quand un élément des listes de matériel est nécessaire.",
      },
      wirktAuf: ['equipment'],
    },
    {
      ziel: 'kalender',
      titel: { de: 'Doppelbuchungen fallen auf', en: 'Double bookings stand out', fr: 'Les doubles réservations ressortent' },
      text: {
        de: 'Je Position eine Zeile, je Woche eine Spalte. Überschneiden sich zwei Buchungen desselben Geräts, steht das rot über dem Kalender.',
        en: 'One row per item, one column per week. If two bookings of the same item overlap, it shows in red above the calendar.',
        fr: 'Une ligne par élément, une colonne par semaine. Si deux réservations du même matériel se chevauchent, cela apparaît en rouge au-dessus du calendrier.',
      },
    },
  ],

  fahrzeuge: [
    {
      ziel: 'neu',
      titel: { de: 'Wer fährt was', en: 'Who drives what', fr: 'Qui conduit quoi' },
      text: {
        de: 'Fahrzeuge mit Kennzeichen, Sitzplätzen und Fahrer - für Fahrgemeinschaften und auswärtige Drehs.',
        en: 'Vehicles with licence plate, seats and driver - for car pools and shoots away from base.',
        fr: "Véhicules avec immatriculation, places et conducteur - pour le covoiturage et les tournages à l'extérieur.",
      },
    },
  ],

  reise: [
    {
      ziel: 'reiter',
      titel: { de: 'Reisen und Unterkünfte', en: 'Travel and accommodation', fr: 'Voyages et hébergement' },
      text: {
        de: 'Reisekosten je Person aus Besetzung und Stab, mit den Verpflegungspauschalen nach § 9 Abs. 4a EStG und als CSV für die Abrechnung. Unter Unterkünfte steht, wer wo schläft.',
        en: 'Travel costs per person from cast and crew, with the German per-diem allowances and as CSV for accounting. Accommodation shows who sleeps where.',
        fr: "Frais de voyage par personne du casting et de l'équipe, avec les indemnités journalières allemandes et en CSV pour la comptabilité. Hébergement indique qui dort où.",
      },
      wirktAuf: ['besetzung', 'stabliste', 'abschluss'],
    },
  ],

  ablage: [
    {
      ziel: 'hochladen',
      titel: { de: 'Papier ablegen', en: 'File the paperwork', fr: 'Classer les papiers' },
      text: {
        de: 'Drehgenehmigungen, Versicherungsnachweise, Vertragsscans, Eingangsrechnungen, Grundrisse und Fotos als PDF oder Bild. Ein Nachweis mit Ablaufdatum meldet sich dreißig Tage vorher; abgelaufene stehen in der Prüfliste des Abschlusses.',
        en: 'Filming permits, insurance certificates, contract scans, incoming invoices, floor plans and photos as PDF or image. A certificate with an expiry date sends a reminder thirty days beforehand; expired ones appear in the wrap-up checklist.',
        fr: "Autorisations de tournage, attestations d'assurance, contrats scannés, factures reçues, plans et photos en PDF ou image. Une attestation avec date d'expiration prévient trente jours avant ; celles expirées figurent dans la liste de clôture.",
      },
      wirktAuf: ['abschluss'],
    },
    {
      ziel: 'filter',
      titel: { de: 'Nach Art sortiert', en: 'Sorted by type', fr: 'Triés par type' },
      text: {
        de: 'Ein Klick zeigt nur eine Art, etwa alle Drehgenehmigungen oder alle Eingangsrechnungen.',
        en: 'One click shows a single type, such as all filming permits or all incoming invoices.',
        fr: "Un clic n'affiche qu'un type, par exemple toutes les autorisations de tournage ou toutes les factures reçues.",
      },
    },
  ],

  abnahme: [
    {
      ziel: 'reiter',
      titel: { de: 'Fassungen und Abnahmerunden', en: 'Cuts and review rounds', fr: 'Versions et tours de validation' },
      text: {
        de: 'Unter Fassungen legst du jeden Schnitt mit Link und Länge ab. Eine Abnahmerunde schickt eine Fassung an den Auftraggeber: Er schaut über einen Link, schreibt Anmerkungen mit Zeitstelle und nimmt ab - ohne Konto. Das Ergebnis steht im Protokoll als PDF.',
        en: 'Under Cuts you store each edit with link and length. A review round sends a cut to the client: they watch via a link, add timecoded notes and approve - without an account. The result goes into a PDF report.',
        fr: "Sous Versions, tu ranges chaque montage avec lien et durée. Un tour de validation envoie une version au client : il regarde via un lien, annote avec le timecode et valide - sans compte. Le résultat figure dans un procès-verbal PDF.",
      },
      wirktAuf: ['abschluss'],
    },
  ],

  abschluss: [
    {
      ziel: 'pruefliste',
      titel: { de: 'Was noch offen ist', en: 'What is still open', fr: 'Ce qui reste ouvert' },
      text: {
        de: 'Die Prüfliste sammelt aus dem ganzen Projekt: offene Rechnungen, unbestätigte Verträge, Abnahmen ohne Entscheidung, fehlende Bewilligungen, nicht abgerechnete Reisen, Künstlersozialkasse, offene Agenturanfragen und abgelaufene Nachweise.',
        en: 'The checklist collects from the whole project: unpaid invoices, unconfirmed contracts, reviews without a decision, missing permits, unsettled travel, the artists’ social insurance, open agency requests and expired certificates.',
        fr: "La liste rassemble tout le projet : factures impayées, contrats non confirmés, validations sans décision, autorisations manquantes, voyages non réglés, caisse sociale des artistes, demandes d'agence ouvertes et attestations expirées.",
      },
      wirktAuf: ['vertraege', 'abnahme', 'reise', 'ablage'],
    },
    {
      ziel: 'aufbewahrung',
      titel: { de: 'Was aufzuheben ist', en: 'What must be kept', fr: 'Ce qui doit être conservé' },
      text: {
        de: 'Welche Unterlagen wie lange aufbewahrt werden müssen. Ein abgeschlossenes Projekt lässt sich wieder öffnen.',
        en: 'Which documents must be kept and for how long. A wrapped-up project can be reopened.',
        fr: 'Quels documents conserver et combien de temps. Un projet clôturé peut être rouvert.',
      },
    },
  ],

  catering: [
    {
      ziel: 'reiter',
      titel: { de: 'Wer isst was nicht', en: 'Who doesn’t eat what', fr: 'Qui ne mange pas quoi' },
      text: {
        de: 'Unter Präferenzen stehen Unverträglichkeiten und Vorlieben je Person. Die Tagesliste nimmt alle, die an einem Drehtag auf der Dispo stehen, und zählt zusammen - die Bestellung für den Caterer.',
        en: 'Preferences lists intolerances and preferences per person. The day list takes everyone on a shoot day’s call sheet and adds it up - the order for the caterer.',
        fr: "Préférences liste intolérances et goûts par personne. La liste du jour reprend tous ceux qui figurent sur la feuille de service d'un jour et additionne - la commande pour le traiteur.",
      },
      wirktAuf: ['tagesdispo'],
    },
  ],

  budget: [
    {
      ziel: 'reiter',
      titel: { de: 'Kalkulation und Finanzierung', en: 'Budget and financing', fr: 'Budget et financement' },
      text: {
        de: 'Die Kalkulation in Fassungen, daneben der Finanzierungsplan mit Geldgebern. Beides zusammen gibt es als PDF für den Förderantrag. Der Konfliktradar meldet, wenn die Finanzierung die Kalkulation nicht deckt.',
        en: 'The budget in versions, next to it the financing plan with funders. Both together are available as a PDF for the funding application. The conflict radar reports when financing doesn’t cover the budget.',
        fr: "Le budget en versions, à côté le plan de financement avec les financeurs. Les deux ensemble existent en PDF pour la demande d'aide. Le radar des conflits signale quand le financement ne couvre pas le budget.",
      },
      wirktAuf: ['konfliktradar', ''],
    },
    {
      ziel: 'kosten',
      titel: { de: 'Kosten aus dem Projekt holen', en: 'Pull costs from the project', fr: 'Récupérer les coûts du projet' },
      text: {
        de: 'Gagen aus Besetzung und Stab mal Drehtage, Mieten aus dem Equipment und Prämien der Versicherungen. Erst kommt eine Vorschau, was neu, geändert oder entfallen wäre - von Hand angelegte Posten bleiben unberührt.',
        en: 'Fees from cast and crew times shoot days, rentals from equipment and insurance premiums. First comes a preview of what would be new, changed or dropped - lines added by hand stay untouched.',
        fr: "Cachets du casting et de l'équipe fois jours de tournage, locations du matériel et primes d'assurance. D'abord un aperçu de ce qui serait nouveau, modifié ou supprimé - les lignes saisies à la main restent intactes.",
      },
      wirktAuf: ['besetzung', 'stabliste', 'equipment', 'versicherungen'],
    },
  ],

  kostenstand: [
    {
      ziel: 'summen',
      titel: { de: 'Plan gegen Ist', en: 'Plan against actual', fr: 'Prévu face au réel' },
      text: {
        de: 'Kalkuliert ist, was in der aktiven Kalkulation steht; ausgegeben, was du hier als Beleg erfasst.',
        en: 'Budgeted is what the active budget version says; spent is what you record here as receipts.',
        fr: 'Prévu, c’est ce qui figure dans le budget actif ; dépensé, ce que tu saisis ici comme justificatifs.',
      },
      wirktAuf: ['budget'],
    },
    {
      ziel: 'warnung',
      titel: { de: 'Frühwarnung', en: 'Early warning', fr: 'Alerte précoce' },
      text: {
        de: 'Lege fest, ab wie viel Prozent der Kalkulation gewarnt wird - bevor das Geld weg ist, nicht danach.',
        en: 'Set the percentage of the budget at which you get warned - before the money is gone, not after.',
        fr: "Fixe à partir de quel pourcentage du budget tu es averti - avant que l'argent soit parti, pas après.",
      },
    },
    {
      ziel: 'beleg',
      titel: { de: 'Ausgaben erfassen', en: 'Record expenses', fr: 'Saisir les dépenses' },
      text: {
        de: 'Eine Zeile je Beleg, mit Kategorie und Betrag. Wöchentlich während des Drehs hält das den Stand ehrlich.',
        en: 'One line per receipt, with category and amount. Weekly during the shoot keeps the figures honest.',
        fr: 'Une ligne par justificatif, avec catégorie et montant. Chaque semaine pendant le tournage, cela garde les chiffres honnêtes.',
      },
    },
  ],

  versicherungen: [
    {
      ziel: 'neu',
      titel: { de: 'Policen im Blick', en: 'Policies at a glance', fr: "Les polices en vue" },
      text: {
        de: 'Jede Versicherung mit Nummer, Laufzeit, Deckung und Prämie. Die Prämien holt "Kosten übernehmen" ins Budget; den Nachweis legst du in der Ablage ab.',
        en: 'Each insurance with number, term, coverage and premium. "Import costs" brings the premiums into the budget; file the certificate in the documents.',
        fr: "Chaque assurance avec numéro, durée, couverture et prime. « Importer les coûts » reprend les primes dans le budget ; range l'attestation dans les documents.",
      },
      wirktAuf: ['budget', 'ablage'],
    },
  ],
}
