import type { Schritt } from '@/lib/einfuehrung'

/** Einführungen: die Seiten rund um den Drehtag. */
export const dreh: Record<string, Schritt[]> = {
  tagesdispo: [
    {
      ziel: 'tage',
      titel: { de: 'Ein Drehtag nach dem anderen', en: 'One shoot day after another', fr: "Un jour de tournage après l'autre" },
      text: {
        de: 'Hier blätterst du durch die Drehtage. Das PDF ist die Dispo für alle; die Script Sides enthalten nur die Drehbuchseiten der Szenen dieses Tages.',
        en: 'Page through the shoot days here. The PDF is the call sheet for everyone; the script sides contain only the script pages of that day’s scenes.',
        fr: "Parcours ici les jours de tournage. Le PDF est la feuille de service pour tous ; les script sides ne contiennent que les pages des scènes de ce jour.",
      },
    },
    {
      ziel: 'kopf',
      titel: { de: 'Was sich die Dispo selbst holt', en: 'What the call sheet fetches itself', fr: 'Ce que la feuille de service récupère seule' },
      text: {
        de: 'Szenen kommen aus dem Drehplan, die Darsteller über die Rollen dieser Szenen, der Drehort aus ihrem Motiv, der Stab ganz. Wetter und Sonnenzeiten holst du per Knopf für den Drehort.',
        en: 'Scenes come from the schedule, the actors through the roles of those scenes, the set from their location, the crew in full. Weather and sun times are fetched for the set at the push of a button.',
        fr: "Les scènes viennent du plan de tournage, les acteurs via les rôles de ces scènes, le lieu via leur décor, l'équipe au complet. Météo et heures du soleil se récupèrent d'un bouton pour le lieu.",
      },
      wirktAuf: ['drehplan', 'besetzung', 'motive', 'stabliste'],
    },
    {
      ziel: 'anordnen',
      titel: { de: 'Deine Reihenfolge', en: 'Your order', fr: 'Ton ordre' },
      text: {
        de: 'Unter dem Kopf folgen Szenen, Besetzung und Stab, dann Zeiten und Hinweise. Mit diesem Knopf stellst du sie um - für die Dispo in allen deinen Projekten.',
        en: 'Below the header come scenes, cast and crew, then times and notes. Use this button to rearrange them - for the call sheet in all your projects.',
        fr: "Sous l'en-tête suivent scènes, acteurs et équipe, puis horaires et consignes. Ce bouton les réorganise - pour la feuille de service dans tous tes projets.",
      },
    },
    {
      ziel: 'versenden',
      titel: { de: 'Raus an alle', en: 'Out to everyone', fr: 'Envoyée à tous' },
      text: {
        de: 'Jede Person bekommt eine eigene Mail mit ihrer Call Time, einem Link zum Bestätigen und der Dispo als PDF - sofort oder zu einem Zeitpunkt. Wer hier steht, steht auch im Check-in, in der Catering-Tagesliste und im Lohnexport.',
        en: 'Each person gets their own email with their call time, a link to confirm and the call sheet as PDF - now or at a set time. Whoever is listed here also appears in check-in, the catering day list and the payroll export.',
        fr: "Chaque personne reçoit son propre e-mail avec son heure de convocation, un lien de confirmation et la feuille de service en PDF - tout de suite ou à une heure prévue. Qui figure ici figure aussi à l'accueil, dans la liste du jour du traiteur et dans l'export de paie.",
      },
      wirktAuf: ['checkin', 'catering', 'timesheets'],
    },
  ],

  checkin: [
    {
      ziel: 'tag',
      titel: { de: 'Wer ist schon da', en: 'Who is here already', fr: 'Qui est déjà là' },
      text: {
        de: 'Wähle den Drehtag: Darunter stehen alle, die auf seiner Dispo stehen. Ein Tippen hakt jemanden als angekommen ab, der Balken zeigt, wie viele noch fehlen.',
        en: 'Pick the shoot day: below are everyone on its call sheet. One tap checks someone in, and the bar shows how many are still missing.',
        fr: "Choisis le jour de tournage : en dessous figurent tous ceux de sa feuille de service. Un appui pointe l'arrivée de quelqu'un, la barre montre combien manquent encore.",
      },
      wirktAuf: ['tagesdispo'],
    },
  ],

  shotlist: [
    {
      ziel: 'szene',
      titel: { de: 'Einstellungen je Szene', en: 'Shots per scene', fr: 'Plans par scène' },
      text: {
        de: 'Jede Szene klappt ihre Einstellungen auf: Größe, Bewegung, Brennweite, Dauer und der beste Take. Am Set hakst du ab, was im Kasten ist.',
        en: 'Each scene opens up its shots: size, movement, focal length, duration and the best take. On set you tick off what is in the can.',
        fr: "Chaque scène déplie ses plans : valeur, mouvement, focale, durée et la meilleure prise. Sur le plateau, tu coches ce qui est dans la boîte.",
      },
      wirktAuf: ['drehbuch'],
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Für die Regie und den Drehtag', en: 'For the director and the shoot day', fr: 'Pour la réalisation et le jour de tournage' },
      text: {
        de: 'Als PDF nach Szenen sortiert für die Auflösung, oder nach Drehtagen in der Reihenfolge des Drehplans.',
        en: 'As a PDF sorted by scene for the shot breakdown, or by shoot day in the order of the schedule.',
        fr: 'En PDF trié par scène pour le découpage, ou par jour de tournage dans l’ordre du plan.',
      },
      wirktAuf: ['drehplan'],
    },
  ],

  setplan: [
    {
      ziel: 'arbeitsflaeche',
      titel: { de: 'Grundriss mit Technik', en: 'Floor plan with gear', fr: 'Plan au sol avec matériel' },
      text: {
        de: 'Links deine Pläne, in der Mitte der Grundriss, rechts die Elemente. Lade einen Grundriss hoch und zieh Kamera, Licht und Ton darauf. Als PDF geht der Plan ans Team.',
        en: 'Your plans on the left, the floor plan in the middle, the elements on the right. Upload a floor plan and drag camera, lighting and sound onto it. As a PDF the plan goes to the team.',
        fr: "Tes plans à gauche, le plan au sol au milieu, les éléments à droite. Téléverse un plan et places-y caméra, lumière et son. En PDF, le plan part à l'équipe.",
      },
    },
  ],

  vfx: [
    {
      ziel: 'neu',
      titel: { de: 'Jede Effekt-Einstellung', en: 'Every effects shot', fr: "Chaque plan d'effets" },
      text: {
        de: 'Art des Effekts, Aufwand, wer ihn baut, bis wann und wie weit er ist - von offen über Review bis finalisiert.',
        en: 'Type of effect, effort, who builds it, by when and how far along it is - from open through review to final.',
        fr: "Type d'effet, effort, qui le réalise, pour quand et où il en est - d'ouvert à finalisé en passant par la revue.",
      },
    },
  ],

  continuity: [
    {
      ziel: 'neu',
      titel: { de: 'Anschlüsse festhalten', en: 'Record continuity', fr: 'Noter les raccords' },
      text: {
        de: 'Ein Eintrag gehört zu einer Szene und einem Darsteller: Kostüm, Maske, Haare, Props oder Set, mit Foto. So stimmt der Anschluss auch Wochen später.',
        en: 'An entry belongs to a scene and an actor: costume, make-up, hair, props or set, with a photo. That way continuity still matches weeks later.',
        fr: "Une entrée appartient à une scène et à un acteur : costume, maquillage, coiffure, accessoires ou décor, avec photo. Ainsi, le raccord tient encore des semaines plus tard.",
      },
      wirktAuf: ['drehbuch', 'besetzung'],
    },
  ],

  kameraberichte: [
    {
      ziel: 'tag',
      titel: { de: 'Je Drehtag und Kamera', en: 'Per shoot day and camera', fr: 'Par jour de tournage et caméra' },
      text: {
        de: 'Wähle den Drehtag, dann bekommt jede Kamera - A, B und so weiter - ihren eigenen Bericht.',
        en: 'Pick the shoot day; then each camera - A, B and so on - gets its own report.',
        fr: 'Choisis le jour de tournage ; chaque caméra - A, B, etc. - reçoit alors son propre rapport.',
      },
    },
    {
      ziel: 'kamera',
      titel: { de: 'Takes mitschreiben', en: 'Log the takes', fr: 'Noter les prises' },
      text: {
        de: 'Für jeden Take Szene, Timecode und Notiz, dazu der Circle Take. Die Szenen dieses Drehtags schlägt das Feld aus dem Drehplan vor. Am Ende geht alles als CSV an den Schnitt.',
        en: 'For each take the scene, timecode and a note, plus the circle take. The field suggests the scenes of this shoot day from the schedule. At the end everything goes to editing as CSV.',
        fr: "Pour chaque prise, la scène, le timecode et une note, plus la prise retenue. Le champ propose les scènes de ce jour depuis le plan. À la fin, tout part au montage en CSV.",
      },
      wirktAuf: ['drehplan'],
    },
  ],

  tagesbericht: [
    {
      ziel: 'tage',
      titel: { de: 'Was wirklich gedreht wurde', en: 'What was actually shot', fr: 'Ce qui a vraiment été tourné' },
      text: {
        de: 'Je Drehtag die echten Zeiten von Call bis Drehschluss, gedrehte Seiten, Setups, Kamera- und Tonrollen und Notizen. Gespeichert wird beim Tippen, als PDF geht der Bericht an die Produktion.',
        en: 'Per shoot day the real times from call to wrap, pages shot, set-ups, camera and sound rolls and notes. Saving happens as you type; as a PDF the report goes to production.',
        fr: "Par jour de tournage, les vrais horaires de la convocation à la fin, pages tournées, installations, bobines image et son, et notes. L'enregistrement se fait pendant la saisie ; en PDF, le rapport part à la production.",
      },
    },
    {
      ziel: 'szenen',
      titel: { de: 'Szenen abhaken', en: 'Tick off scenes', fr: 'Cocher les scènes' },
      text: {
        de: 'Antippen schaltet weiter: offen, angefangen, abgedreht. Abgedreht gilt dann auch in der Szenenliste und im Fortschritt der Hauptseite; die Zeitanalyse verteilt die Drehzeit des Tages auf die markierten Szenen. Der Drehschluss zählt für die Ruhezeit im Konfliktradar.',
        en: 'Tap to move on: open, started, shot. Shot then also counts in the scene list and in the progress on the main page; the time analysis spreads the day’s shooting time across the marked scenes. The wrap time counts for the rest period in the conflict radar.',
        fr: "Un appui fait avancer : ouverte, commencée, tournée. Tournée compte alors aussi dans la liste des scènes et dans l'avancement de la page principale ; l'analyse du temps répartit le temps de tournage du jour entre les scènes marquées. L'heure de fin compte pour le repos dans le radar des conflits.",
      },
      wirktAuf: ['drehbuch', '', 'zeitanalyse', 'konfliktradar'],
    },
  ],

  zeitanalyse: [
    {
      ziel: 'summen',
      titel: { de: 'Plan gegen Drehzeit', en: 'Plan against shooting time', fr: 'Prévu face au temps de tournage' },
      text: {
        de: 'Je Szene die geplante Zeit gegen die tatsächliche. Gemessene Minuten kommen aus dem Tagesbericht; wo keine stehen, wird die Drehzeit des Tages auf die abgedrehten Szenen verteilt und als geschätzt markiert.',
        en: 'For each scene the planned time against the actual time. Measured minutes come from the daily report; where there are none, the day’s shooting time is spread across the shot scenes and marked as estimated.',
        fr: "Pour chaque scène, le temps prévu face au temps réel. Les minutes mesurées viennent du rapport journalier ; à défaut, le temps de tournage du jour est réparti entre les scènes tournées et marqué comme estimé.",
      },
      wirktAuf: ['tagesbericht', 'drehbuch'],
    },
  ],

  timesheets: [
    {
      ziel: 'tag',
      titel: { de: 'Arbeitszeiten je Person', en: 'Working hours per person', fr: 'Heures de travail par personne' },
      text: {
        de: 'Für jeden Drehtag Call und Wrap je Person, mit Überstunden und Mahlzeiten. Ist die Ruhezeit bis zum nächsten Call kürzer als in den Stammdaten festgelegt, steht hier eine Warnung.',
        en: 'For each shoot day the call and wrap per person, with overtime and meals. If the rest until the next call is shorter than set in the project details, a warning appears here.',
        fr: "Pour chaque jour, la convocation et la fin par personne, avec heures supplémentaires et repas. Si le repos jusqu'à la convocation suivante est plus court que fixé dans les données du projet, un avertissement apparaît ici.",
      },
      wirktAuf: ['stammdaten'],
    },
    {
      ziel: 'aktionen',
      titel: { de: 'Für die Lohnabrechnung', en: 'For payroll', fr: 'Pour la paie' },
      text: {
        de: 'Die Zeiten als CSV, und der Lohnexport: Drehtage laut Dispo mal Tagesgage, dazu die Überstunden.',
        en: 'The times as CSV, and the payroll export: shoot days according to the call sheets times day rate, plus overtime.',
        fr: "Les horaires en CSV, et l'export de paie : jours de tournage selon les feuilles de service fois tarif journalier, plus les heures supplémentaires.",
      },
      wirktAuf: ['tagesdispo', 'besetzung', 'stabliste'],
    },
  ],
}
