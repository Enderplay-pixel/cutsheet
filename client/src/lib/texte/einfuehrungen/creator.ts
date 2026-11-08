import type { Schritt } from '@/lib/einfuehrung'

/**
 * Einführungen der Creator-Projekte: die Kanal-Seiten und die Fassungen
 * geteilter Seiten, deren Film-Text Dispo, Drehplan oder Konfliktradar
 * erwähnt - die gibt es in einem Creator-Projekt nicht.
 */
export const creator: Record<string, Schritt[]> = {
  creator: [
    {
      ziel: 'titel',
      titel: { de: 'Alle Videos des Kanals', en: 'Every video of the channel', fr: 'Toutes les vidéos de la chaîne' },
      text: {
        de: "Der Einstieg in die Arbeit am Kanal. Oben steht, wie viele Videos es gibt, wie viele veröffentlicht sind und wie viel Material schon geskriptet ist.",
        en: "Where work on the channel starts. At the top you see how many videos there are, how many are published and how much material is already scripted.",
        fr: "Le point de départ du travail sur la chaîne. En haut figurent le nombre de vidéos, celles publiées et la quantité de matière déjà écrite.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Ein neues Video', en: 'A new video', fr: 'Une nouvelle vidéo' },
      text: {
        de: "Arbeitstitel, Plattform - YouTube, Shorts, TikTok, Instagram, Twitch oder Podcast -, Ziel-Laufzeit und der Hook für die ersten Sekunden. Das Skript entsteht gleich mit der üblichen Gliederung: Hook, Intro, zwei Hauptteile, Call to Action, Outro.",
        en: "Working title, platform - YouTube, Shorts, TikTok, Instagram, Twitch or podcast -, target running time and the hook for the first seconds. The script is created right away with the usual structure: hook, intro, two main parts, call to action, outro.",
        fr: "Titre provisoire, plateforme - YouTube, Shorts, TikTok, Instagram, Twitch ou podcast -, durée visée et l'accroche des premières secondes. Le script est créé aussitôt avec la structure habituelle : accroche, intro, deux parties, appel à l'action, outro.",
      },
    },
    {
      ziel: 'video',
      titel: { de: 'Ein Video', en: 'A video', fr: 'Une vidéo' },
      text: {
        de: "Titel, Plattform, Hook und zwei Zahlen aus dem Skript: die geschätzte Laufzeit aus dem Sprechtext gegen das Ziel - orange, wenn es zu lang wird - und die Zahl der Wörter. Ein Klick öffnet das Video.",
        en: "Title, platform, hook and two figures from the script: the estimated running time from the spoken text against the target - orange when it runs long - and the word count. One click opens the video.",
        fr: "Titre, plateforme, accroche et deux chiffres du script : la durée estimée à partir du texte parlé face à la cible - en orange si c'est trop long - et le nombre de mots. Un clic ouvre la vidéo.",
      },
    },
    {
      ziel: 'status',
      titel: { de: 'Der Stand', en: 'The status', fr: "L'état" },
      text: {
        de: "Idee, Skript, Dreh, Schnitt, Thumbnail, Upload, Veröffentlicht. Ein Wechsel hier gilt sofort im Redaktionsplan, auf der Kanalseite, bei Serien, Performance, Sponsoren und Rechten.",
        en: "Idea, script, shoot, edit, thumbnail, upload, published. A change here applies at once in the editorial plan, on the channel page and in series, performance, sponsors and rights.",
        fr: "Idée, script, tournage, montage, miniature, mise en ligne, publiée. Un changement ici vaut aussitôt dans le plan éditorial, la page chaîne, les séries, la performance, les sponsors et les droits.",
      },
      wirktAuf: ['creator/redaktionsplan', 'creator/kanal', 'creator/serien', 'creator/performance'],
    },
  ],

  'creator/video': [
    {
      ziel: 'werkzeuge',
      titel: { de: 'Ein Video von der Idee bis zu den Zahlen', en: 'A video from idea to numbers', fr: "Une vidéo de l'idée aux chiffres" },
      text: {
        de: "Hier entsteht alles zu einem Video. Der Teleprompter läuft den Sprechtext im Sprechtempo durch - Leertaste startet und hält an, Escape schließt. Das Skript gibt es als PDF.",
        en: "Everything about one video comes together here. The teleprompter scrolls the spoken text at speaking pace - space starts and stops, Escape closes. The script is available as a PDF.",
        fr: "Tout ce qui concerne une vidéo se fait ici. Le prompteur fait défiler le texte parlé au rythme de la parole - espace démarre et arrête, Échap ferme. Le script existe en PDF.",
      },
    },
    {
      ziel: 'stand',
      titel: { de: 'Der Stand auf einen Blick', en: 'The state at a glance', fr: "L'état d'un coup d'œil" },
      text: {
        de: "Die geschätzte Laufzeit aus dem Sprechtext gegen das Ziel, die Zahl der Wörter und das Rechte-Risiko aus dem verwendeten Material - wie wahrscheinlich ein Content-ID-Anspruch ist.",
        en: "The estimated running time from the spoken text against the target, the word count and the rights risk from the material used - how likely a Content ID claim is.",
        fr: "La durée estimée à partir du texte parlé face à la cible, le nombre de mots et le risque de droits lié au matériel utilisé - la probabilité d'une revendication Content ID.",
      },
    },
    {
      ziel: 'reiter-script',
      reiter: 'script',
      titel: { de: 'Skript', en: 'Script', fr: 'Script' },
      text: {
        de: "Oben der Hook, darunter die Abschnitte. Jeder hat eine Überschrift - sie wird zur Kapitelmarke -, Soll-Sekunden, den gesprochenen Text und was im Bild ist: Einblendungen, B-Roll, Schnittnotizen. Mit den Pfeilen änderst du die Reihenfolge.",
        en: "The hook at the top, the sections below. Each has a heading - it becomes a chapter marker -, target seconds, the spoken text and what is on screen: overlays, B-roll, edit notes. The arrows change the order.",
        fr: "L'accroche en haut, les sections en dessous. Chacune a un titre - il devient un chapitre -, des secondes visées, le texte parlé et ce qu'on voit : incrustations, B-roll, notes de montage. Les flèches changent l'ordre.",
      },
    },
    {
      ziel: 'reiter-upload',
      reiter: 'upload',
      titel: { de: 'Upload', en: 'Upload', fr: 'Mise en ligne' },
      text: {
        de: "Titelvarianten und Thumbnail-Ideen, je eine pro Zeile, Serie oder Format, Such-Keyword, Beschreibung und Tags. Die Kapitelmarken entstehen aus den Überschriften des Skripts und lassen sich kopieren. Darunter das Sponsoring: Marke, Honorar, Frist, zugesagte Leistungen und ob als Werbung gekennzeichnet ist.",
        en: "Title variants and thumbnail ideas, one per line, series or format, search keyword, description and tags. The chapter markers come from the script’s headings and can be copied. Below, the sponsorship: brand, fee, deadline, promised deliverables and whether it is labelled as advertising.",
        fr: "Variantes de titre et idées de miniature, une par ligne, série ou format, mot-clé, description et tags. Les chapitres viennent des titres du script et se copient. En dessous, le sponsoring : marque, cachet, échéance, prestations promises et mention publicitaire.",
      },
      wirktAuf: ['creator/titel', 'creator/serien', 'creator/seo', 'creator/sponsoren'],
    },
    {
      ziel: 'reiter-rights',
      reiter: 'rights',
      titel: { de: 'Rechte', en: 'Rights', fr: 'Droits' },
      text: {
        de: "Jede Musik, jedes Stock-Material, jede Grafik, jeder Soundeffekt und jede Schrift mit Quelle und Lizenznachweis. Was ohne Nachweis bleibt, hebt das Risiko an und steht auf der Seite Rechte & Lizenzen.",
        en: "Every piece of music, stock footage, graphic, sound effect and font with its source and proof of licence. Anything without proof raises the risk and appears on the Rights & licences page.",
        fr: "Chaque musique, image d'archive, graphique, effet sonore et police avec sa source et sa preuve de licence. Ce qui reste sans preuve augmente le risque et figure sur la page Droits & licences.",
      },
      wirktAuf: ['creator/rechte'],
    },
    {
      ziel: 'reiter-clips',
      reiter: 'clips',
      titel: { de: 'Auskopplungen', en: 'Clips', fr: 'Extraits' },
      text: {
        de: "Shorts, Reels und Clips aus diesem Video: von wann bis wann in Sekunden, für welche Plattform und worum es geht. Alle Auskopplungen des Kanals stehen gesammelt unter Auskopplungen.",
        en: "Shorts, reels and clips from this video: from when to when in seconds, for which platform and what it is about. All of the channel’s clips are collected under Clips.",
        fr: "Shorts, reels et extraits de cette vidéo : de quand à quand en secondes, pour quelle plateforme et de quoi il s'agit. Tous les extraits de la chaîne sont réunis sous Extraits.",
      },
      wirktAuf: ['creator/clips'],
    },
    {
      ziel: 'reiter-checklist',
      reiter: 'checklist',
      titel: { de: 'Checkliste', en: 'Checklist', fr: 'Liste de contrôle' },
      text: {
        de: "Was vor dem Hochladen erledigt sein muss - abhaken, eigene Punkte ergänzen. Welche Videos noch offene Punkte haben, zeigen die Upload-Checklisten.",
        en: "What must be done before uploading - tick it off, add your own items. The upload checklists show which videos still have open items.",
        fr: "Ce qui doit être fait avant la mise en ligne - coche, ajoute tes propres points. Les listes de publication montrent quelles vidéos ont encore des points ouverts.",
      },
      wirktAuf: ['creator/checklisten'],
    },
    {
      ziel: 'reiter-numbers',
      reiter: 'numbers',
      titel: { de: 'Zahlen', en: 'Numbers', fr: 'Chiffres' },
      text: {
        de: "Geplante und tatsächliche Veröffentlichung - der geplante Termin steht im Redaktionsplan und als Nächstes auf der Hauptseite. Ist YouTube verbunden, wählst du das Video und die Zahlen kommen beim Abgleich; sonst trägst du Aufrufe, Impressionen, Likes und Abos von Hand ein. Daraus rechnet die Seite Klickrate und gesehene Laufzeit.",
        en: "Planned and actual release - the planned date shows in the editorial plan and as next up on the main page. If YouTube is connected you pick the video and the numbers arrive with the sync; otherwise you enter views, impressions, likes and subscribers by hand. From these the page calculates click-through rate and watch time.",
        fr: "Publication prévue et réelle - la date prévue figure dans le plan éditorial et comme prochaine sur la page principale. Si YouTube est connecté, tu choisis la vidéo et les chiffres arrivent avec la synchronisation ; sinon tu saisis vues, impressions, j'aime et abonnés à la main. La page en déduit taux de clic et durée regardée.",
      },
      wirktAuf: ['creator/redaktionsplan', 'creator/performance', 'creator/kanal'],
    },
  ],

  'creator/kanal': [
    {
      ziel: 'titel',
      titel: { de: 'Der Kanal als Ganzes', en: 'The channel as a whole', fr: 'La chaîne dans son ensemble' },
      text: {
        de: "Wie viele Videos es gibt, wie viele veröffentlicht und wie viele geplant sind - und was über alle zusammen herauskommt.",
        en: "How many videos there are, how many are published and how many planned - and what comes out across all of them.",
        fr: "Combien de vidéos existent, combien sont publiées et combien prévues - et ce que donnent toutes ensemble.",
      },
    },
    {
      ziel: 'youtube',
      titel: { de: 'YouTube verbinden', en: 'Connect YouTube', fr: 'Connecter YouTube' },
      text: {
        de: "Mit verbundenem Kanal holt der Abgleich die Zahlen deiner Videos, übernimmt neue Videos und ordnet sie den vorhandenen zu. Die Verbindung lässt sich jederzeit trennen.",
        en: "With the channel connected, the sync fetches your videos’ numbers, imports new videos and matches them to existing ones. The connection can be removed at any time.",
        fr: "Avec la chaîne connectée, la synchronisation récupère les chiffres de tes vidéos, importe les nouvelles et les associe aux existantes. La connexion peut être coupée à tout moment.",
      },
      wirktAuf: ['creator', 'creator/performance'],
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Über alle Videos', en: 'Across all videos', fr: 'Sur toutes les vidéos' },
      text: {
        de: "Aufrufe, Likes und gewonnene Abos zusammengezählt, dazu die Sponsoring-Honorare. Sobald genug veröffentlicht ist, stehen darunter dein Veröffentlichungsrhythmus und Muster über den Kanal.",
        en: "Views, likes and subscribers gained added up, plus sponsorship fees. Once enough is published, your publishing rhythm and patterns across the channel appear below.",
        fr: "Vues, j'aime et abonnés gagnés additionnés, plus les cachets de sponsoring. Dès qu'assez est publié, ton rythme de publication et les tendances de la chaîne apparaissent en dessous.",
      },
      wirktAuf: ['creator/sponsoren'],
    },
    {
      ziel: 'kalender',
      titel: { de: 'Der Monat', en: 'The month', fr: 'Le mois' },
      text: {
        de: "Welches Video an welchem Tag erscheint oder erschienen ist. Mit den Pfeilen blätterst du, \"Heute\" springt zurück.",
        en: "Which video comes out or came out on which day. The arrows page through, \"Today\" jumps back.",
        fr: "Quelle vidéo sort ou est sortie quel jour. Les flèches font défiler, « Aujourd'hui » revient.",
      },
    },
  ],

  'creator/ideen': [
    {
      ziel: 'titel',
      titel: { de: 'Der Vorrat', en: 'The pool', fr: 'La réserve' },
      text: {
        de: "Aus diesen Ideen kommen die Videos. Oben steht, wie viele noch offen sind; sortiert ist nach Wirkung im Verhältnis zum Aufwand.",
        en: "The videos come from these ideas. At the top you see how many are still open; they are sorted by impact relative to effort.",
        fr: "Les vidéos viennent de ces idées. En haut figure le nombre d'idées ouvertes ; elles sont triées par impact rapporté à l'effort.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Schnell festhalten', en: 'Capture it quickly', fr: 'Noter vite' },
      text: {
        de: "Ideen kommen selten dann, wenn man Zeit für Formulare hat: worum es geht, Wirkung und Aufwand von 1 bis 5, eine Notiz zu Winkel, Hook oder Quelle - \"Aufnehmen\".",
        en: "Ideas rarely come when you have time for forms: what it is about, impact and effort from 1 to 5, a note on angle, hook or source - \"Add\".",
        fr: "Les idées viennent rarement quand on a le temps de remplir des formulaires : le sujet, impact et effort de 1 à 5, une note sur l'angle, l'accroche ou la source - « Ajouter ».",
      },
    },
    {
      ziel: 'liste|neu',
      titel: { de: 'Was zuerst dran ist', en: 'What comes first', fr: "Ce qui passe d'abord" },
      text: {
        de: "Die Zahl vorne ist das Verhältnis von Wirkung zu Aufwand: Eine kleine Idee mit großer Wirkung steht oben. Jede Idee ist offen, geplant oder verworfen. \"Video daraus\" legt ein Video an; danach führt \"Zum Video\" direkt hin.",
        en: "The number in front is the ratio of impact to effort: a small idea with big impact comes first. Each idea is open, planned or discarded. \"Make video\" creates a video; afterwards \"Go to video\" leads straight there.",
        fr: "Le chiffre devant est le rapport impact/effort : une petite idée à fort impact passe en tête. Chaque idée est ouverte, planifiée ou abandonnée. « En faire une vidéo » crée une vidéo ; ensuite « Vers la vidéo » y mène directement.",
      },
      wirktAuf: ['creator'],
    },
  ],

  'creator/redaktionsplan': [
    {
      ziel: 'titel',
      titel: { de: 'Was wann rausgeht', en: 'What goes out when', fr: 'Ce qui sort quand' },
      text: {
        de: "Alle Videos mit Termin, über den ganzen Kanal - für die Monatsplanung.",
        en: "All videos with a date, across the whole channel - for monthly planning.",
        fr: "Toutes les vidéos datées, sur toute la chaîne - pour la planification mensuelle.",
      },
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Auf einen Blick', en: 'At a glance', fr: "D'un coup d'œil" },
      text: {
        de: "Wie viele Videos im Plan stehen, wie viele überfällig sind - Datum vorbei, aber noch nicht draußen - und wie viele noch kein Datum haben. Ohne Datum taucht ein Video im Plan nicht auf.",
        en: "How many videos are in the plan, how many are overdue - date passed but not out yet - and how many have no date. Without a date a video does not appear in the plan.",
        fr: "Combien de vidéos sont au plan, combien sont en retard - date passée mais pas encore sorties - et combien n'ont pas de date. Sans date, une vidéo n'apparaît pas au plan.",
      },
    },
    {
      ziel: 'tabelle|leer',
      titel: { de: 'Der Plan', en: 'The plan', fr: 'Le plan' },
      text: {
        de: "Datum, Video, Plattform, Serie und Stand, markiert als geplant, überfällig oder veröffentlicht. Den Termin legst du im Video unter \"Zahlen\" fest; ein Klick auf das Video öffnet es.",
        en: "Date, video, platform, series and status, marked as planned, overdue or published. You set the date in the video under \"Numbers\"; a click on the video opens it.",
        fr: "Date, vidéo, plateforme, série et état, marqués prévu, en retard ou publié. La date se fixe dans la vidéo sous « Chiffres » ; un clic sur la vidéo l'ouvre.",
      },
      wirktAuf: ['creator'],
    },
  ],

  'creator/serien': [
    {
      ziel: 'titel',
      titel: { de: 'Was den Kanal trägt', en: 'What carries the channel', fr: 'Ce qui porte la chaîne' },
      text: {
        de: "Wiederkehrende Formate im Vergleich: welches Format wie oft erscheint und wie gut es läuft.",
        en: "Recurring formats compared: which format comes out how often and how well it does.",
        fr: "Les formats récurrents comparés : lequel sort combien de fois et comment il marche.",
      },
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Die stärkste Serie', en: 'The strongest series', fr: 'La série la plus forte' },
      text: {
        de: "Wie viele Serien es gibt und welche nach Aufrufen vorne liegt. Videos ohne Serie zählen als Einzelstücke.",
        en: "How many series there are and which leads by views. Videos without a series count as one-offs.",
        fr: "Combien de séries existent et laquelle mène en vues. Les vidéos sans série comptent comme pièces uniques.",
      },
    },
    {
      ziel: 'tabelle|leer',
      titel: { de: 'Je Serie', en: 'Per series', fr: 'Par série' },
      text: {
        de: "Videos, davon veröffentlicht, geplant, Aufrufe im Schnitt und die stärkste Folge. Welche Serie ein Video hat, legst du im Video unter \"Upload\" fest.",
        en: "Videos, how many published, planned, average views and the strongest episode. You set a video’s series in the video under \"Upload\".",
        fr: "Vidéos, publiées, prévues, vues moyennes et l'épisode le plus fort. La série d'une vidéo se fixe dans la vidéo sous « Mise en ligne ».",
      },
      wirktAuf: ['creator'],
    },
  ],

  'creator/titel': [
    {
      ziel: 'titel',
      titel: { de: 'Titel und Thumbnail entscheiden', en: 'Title and thumbnail decide', fr: 'Titre et miniature décident' },
      text: {
        de: "Ob jemand klickt, entscheiden Titel und Thumbnail. Hier stehen alle Varianten des Kanals nebeneinander.",
        en: "Whether someone clicks depends on the title and thumbnail. All of the channel’s variants appear side by side here.",
        fr: "Le titre et la miniature décident du clic. Toutes les variantes de la chaîne figurent ici côte à côte.",
      },
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Wie viel zur Auswahl steht', en: 'How much there is to choose from', fr: 'Combien de choix existent' },
      text: {
        de: "Wie viele Titelvarianten und Thumbnail-Ideen es gibt und wie viele Videos ohne Vergleich dastehen - mit weniger als zwei Varianten gibt es nichts abzuwägen.",
        en: "How many title variants and thumbnail ideas there are and how many videos have nothing to compare - with fewer than two variants there is nothing to weigh up.",
        fr: "Combien de variantes de titre et d'idées de miniature existent et combien de vidéos n'ont rien à comparer - avec moins de deux variantes, rien à peser.",
      },
    },
    {
      ziel: 'liste|leer',
      titel: { de: 'Je Video', en: 'Per video', fr: 'Par vidéo' },
      text: {
        de: "Gepflegt werden Titel und Thumbnail-Ideen im Video unter \"Upload\", eine pro Zeile. Hier vergleichst du sie.",
        en: "Titles and thumbnail ideas are maintained in the video under \"Upload\", one per line. Here you compare them.",
        fr: "Titres et idées de miniature se gèrent dans la vidéo sous « Mise en ligne », un par ligne. Ici, tu les compares.",
      },
      wirktAuf: ['creator'],
    },
  ],

  'creator/clips': [
    {
      ziel: 'titel',
      titel: { de: 'Kurzformate aus den Langvideos', en: 'Short formats from the long videos', fr: 'Formats courts issus des vidéos longues' },
      text: {
        de: "Shorts, Reels und Clips über den ganzen Kanal. Markiert werden sie beim jeweiligen Video unter \"Auskopplungen\".",
        en: "Shorts, reels and clips across the whole channel. They are marked on each video under \"Clips\".",
        fr: "Shorts, reels et extraits sur toute la chaîne. Ils se marquent dans chaque vidéo sous « Extraits ».",
      },
      wirktAuf: ['creator'],
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Auf einen Blick', en: 'At a glance', fr: "D'un coup d'œil" },
      text: {
        de: "Wie viele Auskopplungen es gibt, wie lang sie zusammen sind und wie viele eine Beanstandung haben.",
        en: "How many clips there are, how long they are together and how many have an issue.",
        fr: "Combien d'extraits existent, leur durée totale et combien ont un problème.",
      },
    },
    {
      ziel: 'tabelle|leer',
      titel: { de: 'Mit Prüfung', en: 'With checks', fr: 'Avec contrôle' },
      text: {
        de: "Je Clip das Video, aus dem er stammt, Plattform, Start und Dauer. Die Seite prüft Länge und sinnvolle Grenzen und sagt, was nicht passt.",
        en: "For each clip the video it comes from, platform, start and duration. The page checks length and sensible limits and tells you what doesn’t fit.",
        fr: "Pour chaque extrait : la vidéo d'origine, plateforme, début et durée. La page vérifie la durée et les limites raisonnables et dit ce qui ne va pas.",
      },
    },
  ],

  'creator/rechte': [
    {
      ziel: 'titel',
      titel: { de: 'Wo eine Lizenz fehlt', en: 'Where a licence is missing', fr: 'Où manque une licence' },
      text: {
        de: "Musik, Material und Fremdaufnahmen über alle Videos. Vor jeder Veröffentlichung lohnt der Blick hierher.",
        en: "Music, material and third-party footage across all videos. Worth a look before every release.",
        fr: "Musique, matériel et images de tiers sur toutes les vidéos. À consulter avant chaque publication.",
      },
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Das Risiko', en: 'The risk', fr: 'Le risque' },
      text: {
        de: "Wie viel Material erfasst ist, wie viel davon ohne Lizenznachweis und wie viele Videos ein hohes Risiko haben.",
        en: "How much material is recorded, how much has no proof of licence and how many videos carry a high risk.",
        fr: "Combien de matériel est saisi, combien sans preuve de licence et combien de vidéos présentent un risque élevé.",
      },
    },
    {
      ziel: 'tabelle|leer',
      titel: { de: 'Je Video', en: 'Per video', fr: 'Par vidéo' },
      text: {
        de: "Material, Risiko und was beanstandet ist. Nachgetragen wird im Video unter \"Rechte\".",
        en: "Material, risk and what is flagged. Fill in what is missing in the video under \"Rights\".",
        fr: "Matériel, risque et ce qui est signalé. Les compléments se font dans la vidéo sous « Droits ».",
      },
      wirktAuf: ['creator'],
    },
  ],

  'creator/checklisten': [
    {
      ziel: 'titel',
      titel: { de: 'Bereit zum Hochladen?', en: 'Ready to upload?', fr: 'Prêt pour la mise en ligne ?' },
      text: {
        de: "Jedes Video hat seine eigene Upload-Checkliste. Diese Seite zeigt über den ganzen Kanal, was noch fehlt.",
        en: "Each video has its own upload checklist. This page shows what is still missing across the whole channel.",
        fr: "Chaque vidéo a sa propre liste de publication. Cette page montre ce qui manque encore sur toute la chaîne.",
      },
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Der Stand', en: 'The status', fr: "L'état" },
      text: {
        de: "Wie viele Videos bereit sind, wie viele noch offene Punkte haben und wie viele gar keine Checkliste.",
        en: "How many videos are ready, how many still have open items and how many have no checklist at all.",
        fr: "Combien de vidéos sont prêtes, combien ont encore des points ouverts et combien n'ont aucune liste.",
      },
    },
    {
      ziel: 'tabelle|leer',
      titel: { de: 'Je Video', en: 'Per video', fr: 'Par vidéo' },
      text: {
        de: "Fortschritt und Stand je Video. Abgehakt wird im Video unter \"Checkliste\".",
        en: "Progress and status per video. Ticking off happens in the video under \"Checklist\".",
        fr: "Avancement et état par vidéo. Les coches se font dans la vidéo sous « Liste de contrôle ».",
      },
      wirktAuf: ['creator'],
    },
  ],

  'creator/seo': [
    {
      ziel: 'titel',
      titel: { de: 'Gefunden werden', en: 'Getting found', fr: 'Être trouvé' },
      text: {
        de: "Zielbegriff, Schlagworte, Beschreibung und Titellänge je Video - und konkret, was fehlt.",
        en: "Target term, tags, description and title length per video - and specifically what is missing.",
        fr: "Mot-clé visé, tags, description et longueur du titre par vidéo - et précisément ce qui manque.",
      },
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Vollständig oder nicht', en: 'Complete or not', fr: 'Complet ou non' },
      text: {
        de: "Wie viele Videos alles haben und wie viele Mängel. Die Richtwerte - Titel nicht zu lang, mindestens drei Schlagworte, Beschreibung ab 100 Zeichen - sind Erfahrungswerte, keine Vorgaben von YouTube.",
        en: "How many videos have everything and how many have gaps. The guidelines - title not too long, at least three tags, description of 100 characters or more - are rules of thumb, not YouTube requirements.",
        fr: "Combien de vidéos ont tout et combien ont des manques. Les repères - titre pas trop long, au moins trois tags, description d'au moins 100 caractères - sont empiriques, pas des exigences de YouTube.",
      },
    },
    {
      ziel: 'tabelle|leer',
      titel: { de: 'Je Video', en: 'Per video', fr: 'Par vidéo' },
      text: {
        de: "Zielbegriff, Titel, Beschreibung, Tags und was fehlt. Nachgetragen wird im Video unter \"Upload\".",
        en: "Target term, title, description, tags and what is missing. Fill it in in the video under \"Upload\".",
        fr: "Mot-clé, titre, description, tags et ce qui manque. Les compléments se font dans la vidéo sous « Mise en ligne ».",
      },
      wirktAuf: ['creator'],
    },
  ],

  'creator/performance': [
    {
      ziel: 'titel',
      titel: { de: 'Was die Videos bringen', en: 'What the videos achieve', fr: 'Ce que rapportent les vidéos' },
      text: {
        de: "Aufrufe, Klickrate und Haltequote der veröffentlichten Videos - aus dem YouTube-Abgleich oder von Hand im Video unter \"Zahlen\".",
        en: "Views, click-through rate and retention of the published videos - from the YouTube sync or entered by hand in the video under \"Numbers\".",
        fr: "Vues, taux de clic et rétention des vidéos publiées - via la synchronisation YouTube ou saisis à la main dans la vidéo sous « Chiffres ».",
      },
      wirktAuf: ['creator/kanal', 'creator'],
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Der Schnitt', en: 'The average', fr: 'La moyenne' },
      text: {
        de: "Aufrufe gesamt, Klickrate und Haltequote im Schnitt. Üblich sind 2 bis 10 Prozent Klickrate; eine Haltequote ab 50 Prozent gilt als gut.",
        en: "Total views, average click-through rate and retention. A click-through rate of 2 to 10 percent is usual; retention of 50 percent or more counts as good.",
        fr: "Vues totales, taux de clic et rétention moyens. Un taux de clic de 2 à 10 % est courant ; une rétention de 50 % ou plus est considérée comme bonne.",
      },
    },
    {
      ziel: 'tabelle|leer',
      titel: { de: 'Je Video', en: 'Per video', fr: 'Par vidéo' },
      text: {
        de: "Serie, Veröffentlichung, Aufrufe, Klickrate, Haltequote, gewonnene Abos und eine Einordnung gegen diese Richtwerte.",
        en: "Series, release, views, click-through rate, retention, subscribers gained and a rating against these benchmarks.",
        fr: "Série, publication, vues, taux de clic, rétention, abonnés gagnés et une appréciation au regard de ces repères.",
      },
    },
  ],

  'creator/sponsoren': [
    {
      ziel: 'titel',
      titel: { de: 'Bezahlte Platzierungen', en: 'Paid placements', fr: 'Placements rémunérés' },
      text: {
        de: "Sobald bei einem Video eine Marke eingetragen ist, steht sie hier - mit Honorar, Leistungen, Frist und ob gekennzeichnet wurde.",
        en: "As soon as a brand is entered on a video, it appears here - with fee, deliverables, deadline and whether it was labelled.",
        fr: "Dès qu'une marque est saisie sur une vidéo, elle apparaît ici - avec cachet, prestations, échéance et mention publicitaire.",
      },
      wirktAuf: ['creator'],
    },
    {
      ziel: 'kennzahlen',
      titel: { de: 'Auf einen Blick', en: 'At a glance', fr: "D'un coup d'œil" },
      text: {
        de: "Integrationen, Honorar gesamt, wie viele noch nicht gekennzeichnet sind und wie viele Fristen überschritten sind. Das Honorar zählt auch auf der Kanalseite und der Hauptseite.",
        en: "Integrations, total fees, how many are not yet labelled and how many deadlines have passed. The fees also count on the channel page and the main page.",
        fr: "Intégrations, cachets totaux, combien ne sont pas encore signalées et combien d'échéances sont dépassées. Les cachets comptent aussi sur la page chaîne et la page principale.",
      },
      wirktAuf: ['creator/kanal', ''],
    },
    {
      ziel: 'tabelle|leer',
      titel: { de: 'Kennzeichnung ist Pflicht', en: 'Labelling is mandatory', fr: 'La mention est obligatoire' },
      text: {
        de: "Je Integration Marke, Video, Honorar, Leistungen, Frist und Kennzeichnung. Bezahlte Platzierungen müssen als Werbung erkennbar sein - fehlt der Hinweis, ist es Schleichwerbung und abmahnfähig. Eingetragen wird im Video unter \"Upload\".",
        en: "For each integration brand, video, fee, deliverables, deadline and labelling. Paid placements must be recognisable as advertising - without the notice it is covert advertising and can be challenged legally. Enter it in the video under \"Upload\".",
        fr: "Pour chaque intégration : marque, vidéo, cachet, prestations, échéance et mention. Les placements rémunérés doivent être identifiables comme publicité - sans mention, c'est de la publicité clandestine, attaquable. La saisie se fait dans la vidéo sous « Mise en ligne ».",
      },
    },
  ],

  // ── Geteilte Seiten in der Creator-Fassung ──────────────────────────────

  'creator:stammdaten': [
    {
      ziel: 'titel',
      titel: { de: 'Die Grunddaten des Kanals', en: 'The channel’s basic data', fr: 'Les données de base de la chaîne' },
      text: {
        de: "Alles, was das Projekt als Ganzes beschreibt. Gespeichert wird beim Tippen, die Anzeige oben sagt, wann.",
        en: "Everything that describes the project as a whole. Saving happens as you type; the indicator at the top tells you when.",
        fr: "Tout ce qui décrit le projet dans son ensemble. L'enregistrement se fait pendant la saisie ; l'indicateur en haut te dit quand.",
      },
    },
    {
      ziel: 'basisdaten',
      titel: { de: 'Basisdaten', en: 'Basic data', fr: 'Données de base' },
      text: {
        de: "Titel, Format, Status und Kurzinhalt. Der Titel steht sofort in Kopfleiste, Seitenleiste und auf der Hauptseite.",
        en: "Title, format, status and synopsis. The title shows at once in the header, sidebar and on the main page.",
        fr: "Titre, format, statut et synopsis. Le titre apparaît aussitôt dans l'en-tête, la barre latérale et la page principale.",
      },
      wirktAuf: [''],
    },
    {
      ziel: 'team',
      titel: { de: 'Wer mitarbeitet', en: 'Who works on it', fr: 'Qui y travaille' },
      text: {
        de: "Eine Einladung ist ein Link mit einer Rolle - per Mail, kopiert oder als QR-Code. Die Rolle legt fest, was jemand sehen und ändern darf. Darunter alle, die schon dabei sind.",
        en: "An invitation is a link with a role - by email, copied or as a QR code. The role decides what someone can see and change. Below are everyone already on board.",
        fr: "Une invitation est un lien avec un rôle - par e-mail, copié ou en QR code. Le rôle détermine ce que la personne peut voir et modifier. En dessous figurent tous ceux déjà présents.",
      },
    },
  ],

  'creator:besetzung': [
    {
      ziel: 'titel',
      titel: { de: 'Wer vor der Kamera steht', en: 'Who is in front of the camera', fr: 'Qui est devant la caméra' },
      text: {
        de: "Gäste, Mitwirkende und wiederkehrende Rollen des Kanals. Oben steht, wie viele es sind.",
        en: "The channel’s guests, contributors and recurring roles. At the top you see how many there are.",
        fr: "Les invités, intervenants et rôles récurrents de la chaîne. En haut figure leur nombre.",
      },
    },
    {
      ziel: 'rolle|reiter-rollen',
      reiter: 'rollen',
      titel: { de: 'Figuren', en: 'Characters', fr: 'Personnages' },
      text: {
        de: "Für wiederkehrende Rollen oder Figuren eines Formats, mit Beschreibung.",
        en: "For recurring roles or characters of a format, with a description.",
        fr: "Pour les rôles récurrents ou les personnages d'un format, avec une description.",
      },
    },
    {
      ziel: 'darsteller|reiter-darsteller',
      reiter: 'darsteller',
      titel: { de: 'Darsteller', en: 'Cast', fr: 'Acteurs' },
      text: {
        de: "Je Person Mail, Telefon, Agentur, Honorar pro Tag und Geburtsdatum. Die Kontakte stehen auch in der Kontaktliste.",
        en: "For each person email, phone, agency, fee per day and date of birth. The contacts also appear in the contact list.",
        fr: "Pour chaque personne : e-mail, téléphone, agence, cachet par jour et date de naissance. Les contacts figurent aussi dans la liste de contacts.",
      },
      wirktAuf: ['kontakte'],
    },
  ],

  'creator:stabliste': [
    {
      ziel: 'titel',
      titel: { de: 'Das Team', en: 'The team', fr: "L'équipe" },
      text: {
        de: "Alle hinter der Kamera und im Schnitt, nach Abteilungen.",
        en: "Everyone behind the camera and in the edit, by department.",
        fr: "Tous ceux derrière la caméra et au montage, par département.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Jemanden dazunehmen', en: 'Add someone', fr: "Ajouter quelqu'un" },
      text: {
        de: "Abteilung wählen, \"Hinzufügen\" - und in der Zeile Name, Funktion, Mail, Telefon und Tagesgage eintragen. CSV und PDF geben die Liste aus.",
        en: "Choose the department, \"Add\" - then enter name, role, email, phone and day rate in the row. CSV and PDF export the list.",
        fr: "Choisis le département, « Ajouter » - puis saisis nom, fonction, e-mail, téléphone et tarif journalier. CSV et PDF exportent la liste.",
      },
    },
    {
      ziel: 'abteilungen|aktionen',
      titel: { de: 'Nach Abteilung', en: 'By department', fr: 'Par département' },
      text: {
        de: "Ein Klick zeigt nur eine Abteilung; jede kann ihre Mailadressen auf einmal kopieren. Die Kontakte stehen auch in der Kontaktliste.",
        en: "One click shows a single department; each can copy its email addresses at once. The contacts also appear in the contact list.",
        fr: "Un clic n'affiche qu'un département ; chacun peut copier ses adresses d'un coup. Les contacts figurent aussi dans la liste de contacts.",
      },
      wirktAuf: ['kontakte'],
    },
  ],

  'creator:motive': [
    {
      ziel: 'titel',
      titel: { de: 'Die Drehorte', en: 'The filming locations', fr: 'Les lieux de tournage' },
      text: {
        de: "Jeder Ort, an dem gedreht wird - mit Adresse, Ansprechpartner, Eigentümer, Miete und Strom.",
        en: "Every place where you shoot - with address, contact, owner, rent and power.",
        fr: "Chaque lieu de tournage - avec adresse, contact, propriétaire, loyer et électricité.",
      },
    },
    {
      ziel: 'neu',
      titel: { de: 'Einen Drehort anlegen', en: 'Add a location', fr: 'Ajouter un lieu' },
      text: {
        de: "Legt einen leeren Drehort an, den du gleich aufklappst und ausfüllst.",
        en: "Adds an empty location that you open up and fill in right away.",
        fr: "Crée un lieu vide que tu déplies et remplis aussitôt.",
      },
    },
    {
      ziel: 'motiv|neu',
      titel: { de: 'Karte und Vertrag', en: 'Map and release', fr: 'Carte et contrat' },
      text: {
        de: "Aufgeklappt stehen alle Angaben; mit Breiten- und Längengrad zeigt der Drehort eine Karte. Unten der Motivvertrag: Eigentümer eintragen, dann unterschreibt er direkt auf dem Bildschirm. Der Ansprechpartner steht in der Kontaktliste.",
        en: "Opened up, all details are shown; with latitude and longitude the location shows a map. At the bottom the location release: enter the owner, who then signs right on the screen. The contact appears in the contact list.",
        fr: "Déplié, tout s'affiche ; avec latitude et longitude, le lieu montre une carte. En bas, le contrat : saisis le propriétaire, qui signe directement à l'écran. Le contact figure dans la liste de contacts.",
      },
      wirktAuf: ['kontakte'],
    },
  ],

  'creator:kalender': [
    {
      ziel: 'monat',
      titel: { de: 'Alles mit Datum', en: 'Everything with a date', fr: 'Tout ce qui a une date' },
      text: {
        de: "Drehtermine und alle anderen Termine des Kanals, farbig nach Art. Ein Klick auf einen Tag zeigt daneben, was dort ansteht, und legt einen Termin an: Drehtag, Casting, Besichtigung, Probe, Meeting, Reise und mehr.",
        en: "Shoot dates and all other appointments of the channel, coloured by kind. Clicking a day shows next to it what is on and adds an appointment: shoot day, casting, recce, rehearsal, meeting, travel and more.",
        fr: "Dates de tournage et autres rendez-vous de la chaîne, colorés par type. Un clic sur un jour montre à côté ce qui est prévu et ajoute un rendez-vous : jour de tournage, casting, repérage, répétition, réunion, déplacement, etc.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'In deinen eigenen Kalender', en: 'Into your own calendar', fr: 'Dans ton propre agenda' },
      text: {
        de: "\"Neuer Termin\" öffnet einen Termin, vorbelegt mit heute. Der Export bringt alle Termine als Datei in Google, Apple oder Outlook.",
        en: "\"New appointment\" opens an appointment preset to today. The export brings all appointments as a file into Google, Apple or Outlook.",
        fr: "« Nouveau rendez-vous » en ouvre un, prérempli à aujourd'hui. L'export envoie tous les rendez-vous en fichier vers Google, Apple ou Outlook.",
      },
    },
  ],

  'creator:budget': [
    {
      ziel: 'titel',
      titel: { de: 'Was der Kanal kostet', en: 'What the channel costs', fr: 'Ce que coûte la chaîne' },
      text: {
        de: "Kalkulation und Finanzierungsplan, beide in Fassungen. Ändern dürfen beides Produktion und Admins.",
        en: "Budget and financing plan, both in versions. Producers and admins can change them.",
        fr: "Budget et plan de financement, tous deux en versions. La production et les admins peuvent les modifier.",
      },
    },
    {
      ziel: 'kalkulation',
      reiter: 'kalkulation',
      titel: { de: 'Die Kalkulation', en: 'The budget', fr: 'Le budget' },
      text: {
        de: "Positionen nach Kontenrahmen, je mit Menge, Einheit und Einzelpreis. \"Kosten übernehmen\" holt Mieten aus dem Equipment und Gagen; erst kommt eine Vorschau, von Hand angelegte Posten bleiben unberührt.",
        en: "Lines by account, each with quantity, unit and unit price. \"Import costs\" pulls in rentals from equipment and fees; a preview comes first, and lines added by hand stay untouched.",
        fr: "Des lignes par compte, chacune avec quantité, unité et prix unitaire. « Importer les coûts » reprend les locations du matériel et les cachets ; un aperçu vient d'abord, les lignes saisies à la main restent intactes.",
      },
      wirktAuf: ['equipment', 'besetzung', 'stabliste'],
    },
    {
      ziel: 'finanzierung',
      reiter: 'finanzierung',
      titel: { de: 'Der Finanzierungsplan', en: 'The financing plan', fr: 'Le plan de financement' },
      text: {
        de: "Wer was beisteuert, mit Art, Betrag und ob es bestätigt ist. Deckt die Finanzierung die Kalkulation nicht, zeigt die Hauptseite die Lücke.",
        en: "Who contributes what, with type, amount and whether it is confirmed. If financing doesn’t cover the budget, the main page shows the gap.",
        fr: "Qui apporte quoi, avec type, montant et confirmation. Si le financement ne couvre pas le budget, la page principale montre l'écart.",
      },
      wirktAuf: [''],
    },
  ],

  'creator:email': [
    {
      ziel: 'titel',
      titel: { de: 'Alles, was das Projekt verschickt', en: 'Everything the project sends', fr: 'Tout ce que le projet envoie' },
      text: {
        de: "Vorlagen, Verteiler und Versand, mit Protokoll.",
        en: "Templates, mailing lists and sending, with a log.",
        fr: "Modèles, listes de diffusion et envoi, avec historique.",
      },
    },
    {
      ziel: 'reiter-verfassen',
      reiter: 'verfassen',
      titel: { de: 'Verfassen', en: 'Compose', fr: 'Rédiger' },
      text: {
        de: "Empfänger aus einem Verteiler oder einzeln aus Team und Mitwirkenden, Betreff und Text - auf Wunsch aus einer Vorlage, mit Platzhaltern je Empfänger. \"Test an mich\" zeigt die Mail vorher, \"Später senden\" plant sie ein.",
        en: "Recipients from a mailing list or individually from team and contributors, subject and text - from a template if you like, with placeholders per recipient. \"Test to me\" shows the email first, \"Send later\" schedules it.",
        fr: "Destinataires depuis une liste ou un par un dans l'équipe et les intervenants, objet et texte - depuis un modèle si tu veux, avec champs par destinataire. « Test à moi » montre l'e-mail d'abord, « Envoyer plus tard » le programme.",
      },
    },
    {
      ziel: 'reiter-postausgang',
      reiter: 'postausgang',
      titel: { de: 'Postausgang', en: 'Outbox', fr: "Boîte d'envoi" },
      text: {
        de: "Jede Mail des Projekts mit ihrem Stand: wartet, geplant, gesendet, Empfang bestätigt oder fehlgeschlagen. Was hängen blieb, schickst du mit \"Erneut\" noch einmal.",
        en: "Every email of the project with its status: waiting, scheduled, sent, receipt confirmed or failed. Resend what got stuck with \"Retry\".",
        fr: "Chaque e-mail du projet avec son état : en attente, programmé, envoyé, réception confirmée ou échoué. Renvoie ce qui est bloqué avec « Réessayer ».",
      },
    },
    {
      ziel: 'reiter-absender',
      reiter: 'absender',
      titel: { de: 'Absender', en: 'Sender', fr: 'Expéditeur' },
      text: {
        de: "Absendername, Antwortadresse und die Signatur unter jeder Mail des Projekts.",
        en: "Sender name, reply address and the signature under every email of the project.",
        fr: "Nom d'expéditeur, adresse de réponse et signature sous chaque e-mail du projet.",
      },
    },
  ],

  'creator:kontakte': [
    {
      ziel: 'titel',
      titel: { de: 'Alle Nummern an einem Ort', en: 'Every number in one place', fr: 'Tous les numéros au même endroit' },
      text: {
        de: "Team, Mitwirkende und die Ansprechpartner der Drehorte. Getippt wird hier nichts: Jede Änderung dort steht sofort auch hier.",
        en: "Team, contributors and the contacts of the filming locations. Nothing is typed here: every change there shows up here at once.",
        fr: "Équipe, intervenants et contacts des lieux de tournage. Rien n'est saisi ici : chaque modification là-bas apparaît aussitôt ici.",
      },
      wirktAuf: ['stabliste', 'besetzung', 'motive'],
    },
    {
      ziel: 'filter',
      titel: { de: 'Suchen und eingrenzen', en: 'Search and narrow down', fr: 'Chercher et filtrer' },
      text: {
        de: "Das Suchfeld findet Namen, Funktionen und Nummern, die Knöpfe daneben zeigen nur eine Gruppe. Mailadressen und Nummern sind antippbar.",
        en: "The search field finds names, roles and numbers; the buttons next to it show a single group. Email addresses and numbers can be tapped.",
        fr: "Le champ de recherche trouve noms, fonctions et numéros ; les boutons à côté n'affichent qu'un groupe. Adresses et numéros sont cliquables.",
      },
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Ins Telefon und in die Mail', en: 'Into the phone and the mail', fr: 'Dans le téléphone et les e-mails' },
      text: {
        de: "\"Alle E-Mails kopieren\" für eine Rundmail, CSV für eine Tabelle, vCard fürs Telefon.",
        en: "\"Copy all emails\" for a round mail, CSV for a spreadsheet, vCard for the phone.",
        fr: "« Copier tous les e-mails » pour un envoi groupé, CSV pour un tableur, vCard pour le téléphone.",
      },
    },
  ],
}
