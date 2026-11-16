import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte des Cashflowplans (Plan Kino-Ausbau, AP E2). */
export const cashflowT = {
  titel:            { de: 'Cashflow', en: 'Cash flow', fr: 'Trésorerie' },
  gegen:            { de: 'Einnahmen aus dem Finanzierungsplan, Ausgaben aus der Kalkulation „{name}“', en: 'Income from the financing plan, expenses from the budget "{name}"', fr: 'Recettes du plan de financement, dépenses du budget « {name} »' },
  ohneKalkulation:  { de: 'Noch keine Kalkulation - Ausgaben laut Plan gibt es erst mit ihr.', en: 'No budget yet - planned expenses need one.', fr: 'Pas encore de budget - les dépenses prévues en ont besoin.' },
  woche:            { de: 'Woche', en: 'Week', fr: 'Semaine' },
  monat:            { de: 'Monat', en: 'Month', fr: 'Mois' },
  raster:           { de: 'Raster', en: 'Grid', fr: 'Grille' },
  csv:              { de: 'CSV', en: 'CSV', fr: 'CSV' },
  einnahmen:        { de: 'Einnahmen', en: 'Income', fr: 'Recettes' },
  ausgabenPlan:     { de: 'Ausgaben laut Plan', en: 'Planned expenses', fr: 'Dépenses prévues' },
  ausgabenIst:      { de: 'Ausgaben laut Belegen', en: 'Expenses per receipts', fr: 'Dépenses selon justificatifs' },
  saldo:            { de: 'Saldo', en: 'Balance', fr: 'Solde' },
  aufgelaufen:      { de: 'Saldo aufgelaufen', en: 'Running balance', fr: 'Solde cumulé' },
  zeitraum:         { de: 'Zeitraum', en: 'Period', fr: 'Période' },
  kw:               { de: 'KW {n}', en: 'Wk {n}', fr: 'S{n}' },
  bis:              { de: '{von} bis {bis}', en: '{von} to {bis}', fr: 'du {von} au {bis}' },
  unterdeckung:     { de: 'Unterdeckung', en: 'Shortfall', fr: 'Découvert' },
  unterdeckungAb:   {
    de: 'Unterdeckung ab {zeitraum}: Bis dahin ist mehr ausgegeben als eingegangen, im tiefsten Punkt {betrag}. Eine frühere Rate oder spätere Ausgaben schließen die Lücke.',
    en: 'Shortfall from {zeitraum}: more has been spent than received by then, at the lowest point {betrag}. An earlier installment or later expenses close the gap.',
    fr: 'Découvert à partir de {zeitraum} : plus de dépenses que de recettes à ce moment-là, au plus bas {betrag}. Une échéance plus tôt ou des dépenses plus tard comblent l’écart.',
  },
  keineUnterdeckung: { de: 'Keine Unterdeckung: Das Geld ist in jedem Zeitraum da, bevor es gebraucht wird.', en: 'No shortfall: the money is there in every period before it is needed.', fr: 'Pas de découvert : l’argent est là à chaque période avant d’être nécessaire.' },
  ereignisse:       { de: 'Ereignisse', en: 'Events', fr: 'Événements' },
  meilensteinHilfe: { de: 'Termine vom Typ "Meilenstein" im Kalender stehen hier mit.', en: 'Calendar appointments of type "Milestone" show here too.', fr: 'Les rendez-vous de type « Jalon » du calendrier apparaissent ici aussi.' },
  summe:            { de: 'Summe', en: 'Total', fr: 'Total' },
  nichtTerminiert:  { de: 'Nicht terminiert', en: 'Not scheduled', fr: 'Non planifié' },
  nichtTerminiertHilfe: {
    de: 'Ohne Datum steht es nicht in der Tabelle, zählt aber mit. Budgetzeilen bekommen ihren Zeitraum in der Kalkulation, Raten ihr Datum im Finanzierungsplan.',
    en: 'Without a date it is not in the table, but it still counts. Budget lines get their period in the budget, installments their date in the financing plan.',
    fr: 'Sans date, cela n’apparaît pas dans le tableau mais compte quand même. Les lignes du budget reçoivent leur période dans le budget, les échéances leur date dans le plan de financement.',
  },
  einnahmenOhne:    { de: 'Einnahmen ohne Datum', en: 'Income without date', fr: 'Recettes sans date' },
  ausgabenOhne:     { de: 'Ausgaben ohne Zeitraum', en: 'Expenses without period', fr: 'Dépenses sans période' },
  belegeOhne:       { de: 'Belege ohne Datum', en: 'Receipts without date', fr: 'Justificatifs sans date' },
  leer:             { de: 'Noch nichts auf der Zeitachse', en: 'Nothing on the timeline yet', fr: 'Rien encore sur la ligne du temps' },
  leerText:         {
    de: 'Gib Budgetzeilen einen Zeitraum - in der Kalkulation, auch "Drehzeit" für mehrere auf einmal - und den Raten der Geldgeber ein Fälligkeitsdatum.',
    en: 'Give budget lines a period - in the budget, also "Shoot period" for several at once - and the funders’ installments a due date.',
    fr: 'Donne une période aux lignes du budget - dans le budget, aussi « Tournage » pour plusieurs à la fois - et une date d’échéance aux versements des financeurs.',
  },
  zurKalkulation:   { de: 'Zur Kalkulation', en: 'To the budget', fr: 'Vers le budget' },
} satisfies Record<string, Text>

/** Texte des Zeitraums in der Kalkulation (AP E2). */
export const zeitraumT = {
  spalte:           { de: 'Zeitraum', en: 'Period', fr: 'Période' },
  nichtTerminiert:  { de: 'nicht terminiert', en: 'not scheduled', fr: 'non planifié' },
  zeitraumVon:      { de: 'Zeitraum von {name}', en: 'Period of {name}', fr: 'Période de {name}' },
  von:              { de: 'Von', en: 'From', fr: 'Du' },
  bis:              { de: 'Bis', en: 'To', fr: 'Au' },
  hilfe:            { de: 'Der Betrag verteilt sich nach Tagen über den Zeitraum - so steht er im Cashflow.', en: 'The amount is spread by days over the period - that is how it shows in the cash flow.', fr: 'Le montant est réparti par jours sur la période - c’est ainsi qu’il apparaît dans la trésorerie.' },
  speichern:        { de: 'Speichern', en: 'Save', fr: 'Enregistrer' },
  entfernen:        { de: 'Zeitraum entfernen', en: 'Remove period', fr: 'Supprimer la période' },
  beideEnden:       { de: 'Bitte Anfang und Ende eintragen.', en: 'Please enter start and end.', fr: 'Merci d’indiquer le début et la fin.' },
  endeVorAnfang:    { de: 'Das Ende liegt vor dem Anfang.', en: 'The end is before the start.', fr: 'La fin est avant le début.' },
  markieren:        { de: '{name} markieren', en: 'Select {name}', fr: 'Sélectionner {name}' },
  alleMarkieren:    { de: 'Alle Zeilen markieren', en: 'Select all lines', fr: 'Sélectionner toutes les lignes' },
  markiert:         { de: '{n} markiert', en: '{n} selected', fr: '{n} sélectionnée(s)' },
  aufDrehzeit:      { de: 'Zeitraum: Drehzeit', en: 'Period: shoot', fr: 'Période : tournage' },
  aufDrehzeitLang:  { de: 'Erster bis letzter Drehtag, ohne Sperr- und Reservetage', en: 'First to last shoot day, without blocked and standby days', fr: 'Du premier au dernier jour de tournage, sans jours bloqués ni de réserve' },
  gesetzt:          { de: '{n} Zeilen: {von} bis {bis}', en: '{n} lines: {von} to {bis}', fr: '{n} lignes : du {von} au {bis}' },
  aufheben:         { de: 'Markierung aufheben', en: 'Clear selection', fr: 'Annuler la sélection' },
  fehler:           { de: 'Nicht gesetzt', en: 'Not set', fr: 'Non défini' },
} satisfies Record<string, Text>
