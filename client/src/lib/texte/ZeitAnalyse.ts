import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const zeitAnalyseT = {
  minuten:         { de: '{n} Min.', en: '{n} min', fr: '{n} min' },
  stunden:         { de: '{n} Std.', en: '{n} h', fr: '{n} h' },
  stundenMinuten:  { de: '{h} Std. {m} Min.', en: '{h} h {m} min', fr: '{h} h {m} min' },
  titel:           { de: 'Zeitanalyse', en: 'Time analysis', fr: 'Analyse du temps' },
  untertitel:      { de: 'Vergleich von geplantem und tatsächlichem Drehaufwand pro Szene', en: 'Planned versus actual shooting time per scene', fr: 'Comparaison du temps de tournage prévu et réel par scène' },
  gesamtGeplant:   { de: 'Gesamt geplant', en: 'Total planned', fr: 'Total prévu' },
  gesamtIst:       { de: 'Gesamt Ist', en: 'Total actual', fr: 'Total réel' },
  differenz:       { de: 'Differenz', en: 'Difference', fr: 'Écart' },
  szenenAbgedreht: { de: 'Szenen abgedreht', en: 'Scenes shot', fr: 'Scènes tournées' },
  ueberzogen:      { de: '{n} überzogen', en: '{n} over time', fr: '{n} en dépassement' },
  imZeitplan:      { de: '{n} im Zeitplan', en: '{n} on schedule', fr: '{n} dans les temps' },
  leerTitel:       { de: 'Noch keine Szenen vorhanden.', en: 'No scenes yet.', fr: 'Pas encore de scènes.' },
  leerText:        { de: 'Füge Szenen hinzu und trage Tagesberichte ein, um die Zeitanalyse zu sehen.', en: 'Add scenes and fill in daily reports to see the time analysis.', fr: "Ajoute des scènes et remplis les rapports journaliers pour voir l'analyse du temps." },
  verteilung:      { de: 'Zeitverteilung pro Szene', en: 'Time per scene', fr: 'Répartition du temps par scène' },
  szKurz:          { de: 'Sz. {n}', en: 'Sc. {n}', fr: 'Sc. {n}' },
  plan:            { de: 'Plan', en: 'Plan', fr: 'Prévu' },
  ist:             { de: 'Ist', en: 'Actual', fr: 'Réel' },
  geplant:         { de: 'Geplant', en: 'Planned', fr: 'Prévu' },
  istImPlan:       { de: 'Ist (im Plan)', en: 'Actual (on plan)', fr: 'Réel (dans les temps)' },
  istUeberzogen:   { de: 'Ist (überzogen)', en: 'Actual (over)', fr: 'Réel (dépassement)' },
  istGespart:      { de: 'Ist (gespart)', en: 'Actual (saved)', fr: 'Réel (gagné)' },
  szene:           { de: 'Szene', en: 'Scene', fr: 'Scène' },
  titelSpalte:     { de: 'Titel', en: 'Title', fr: 'Titre' },
  geschKurz:       { de: 'gesch.', en: 'est.', fr: 'est.' },
  gesamt:          { de: 'Gesamt', en: 'Total', fr: 'Total' },
  fussnote:        { de: ' heißt: für diese {szenen} wurde keine Zeit gemessen. Der Wert ist die Drehzeit des Tages, verteilt nach geplanter Dauer. Gemessene Minuten trägst du im Tagesbericht bei der jeweiligen Szene ein.', en: " means: no time was measured for {szenen}. The value is the day's shooting time, split by planned duration. You enter measured minutes in the daily report for each scene.", fr: " signifie : aucun temps n'a été mesuré pour {szenen}. La valeur correspond au temps de tournage de la journée, réparti selon la durée prévue. Tu saisis les minutes mesurées dans le rapport journalier, pour chaque scène." },
  fussnoteEine:    { de: 'Szene', en: 'this scene', fr: 'cette scène' },
  fussnoteMehr:    { de: '{n} Szenen', en: 'these {n} scenes', fr: 'ces {n} scènes' },
} satisfies Record<string, Text>
