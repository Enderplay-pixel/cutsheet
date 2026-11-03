import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const budgetT = {
  beschreibungPos:  { de: 'Beschreibung der Position', en: 'Item description', fr: 'Description du poste' },
  einheit:          { de: 'Einheit', en: 'Unit', fr: 'Unité' },
  menge:            { de: 'Menge', en: 'Quantity', fr: 'Quantité' },
  mengeFuer:        { de: 'Menge für {name}', en: 'Quantity for {name}', fr: 'Quantité pour {name}' },
  einzelpreisEuro:  { de: 'Einzelpreis in Euro', en: 'Unit price in euros', fr: 'Prix unitaire en euros' },
  einzelpreisFuer:  { de: 'Einzelpreis in Euro für {name}', en: 'Unit price in euros for {name}', fr: 'Prix unitaire en euros pour {name}' },
  positionLoeschenN:{ de: 'Position {name} löschen', en: 'Delete item {name}', fr: 'Supprimer le poste {name}' },
  positionLoeschen: { de: 'Position löschen', en: 'Delete item', fr: 'Supprimer le poste' },
  geldgeberQuelle:  { de: 'Geldgeber oder Quelle', en: 'Funder or source', fr: 'Financeur ou source' },
  betragEuro:       { de: 'Betrag in Euro', en: 'Amount in euros', fr: 'Montant en euros' },
  betragVon:        { de: 'Betrag in Euro von {name}', en: 'Amount in euros from {name}', fr: 'Montant en euros de {name}' },
  bestaetigt:       { de: 'Bestätigt', en: 'Confirmed', fr: 'Confirmé' },
  offen:            { de: 'Offen', en: 'Open', fr: 'En attente' },
  finPostenLoeschen:{ de: 'Finanzierungsposten löschen', en: 'Delete funding entry', fr: 'Supprimer la ligne de financement' },
  postenLoeschen:   { de: 'Posten löschen', en: 'Delete entry', fr: 'Supprimer la ligne' },
  fehler:           { de: 'Fehler', en: 'Error', fr: 'Erreur' },
  kostenUebernommen:{ de: 'Kosten übernommen', en: 'Costs imported', fr: 'Coûts importés' },
  kostenErgebnis:   {
    de: '{neu} neu, {geaendert} aktualisiert, {entfallen} entfernt.',
    en: '{neu} new, {geaendert} updated, {entfallen} removed.',
    fr: '{neu} nouveaux, {geaendert} mis à jour, {entfallen} supprimés.',
  },
  titel:            { de: 'Kalkulation & Finanzierung', en: 'Budget & financing', fr: 'Budget & financement' },
  untertitel:       { de: 'Budget und Finanzierungsplan', en: 'Budget and financing plan', fr: 'Budget et plan de financement' },
  vorschauTitel:    { de: 'Das würde sich ändern', en: 'This is what would change', fr: 'Voici ce qui changerait' },
  vorschauEine:     {
    de: '{neu} neue Position, {geaendert} aktualisiert, {entfallen} entfernt, {unveraendert} unverändert. Summe aus den Quellen:',
    en: '{neu} new item, {geaendert} updated, {entfallen} removed, {unveraendert} unchanged. Total from the sources:',
    fr: '{neu} nouveau poste, {geaendert} mis à jour, {entfallen} supprimés, {unveraendert} inchangés. Total des sources :',
  },
  vorschauMehrere:  {
    de: '{neu} neue Positionen, {geaendert} aktualisiert, {entfallen} entfernt, {unveraendert} unverändert. Summe aus den Quellen:',
    en: '{neu} new items, {geaendert} updated, {entfallen} removed, {unveraendert} unchanged. Total from the sources:',
    fr: '{neu} nouveaux postes, {geaendert} mis à jour, {entfallen} supprimés, {unveraendert} inchangés. Total des sources :',
  },
  vorschauHinweis:  {
    de: 'Von Hand eingetragene Positionen bleiben unangetastet. Übernommene Positionen werden beim nächsten Lauf aktualisiert statt doppelt angelegt.',
    en: 'Manually entered items remain untouched. Imported items are updated on the next run instead of being created twice.',
    fr: "Les postes saisis à la main restent intacts. Les postes importés sont mis à jour au prochain passage au lieu d'être créés en double.",
  },
  ohneDrehtag:      {
    de: 'Ohne Position, weil auf keiner Tagesdispo: {namen}. Erst eintragen, dann erneut übernehmen.',
    en: 'No item, because not on any call sheet: {namen}. Add them first, then import again.',
    fr: "Sans poste, car sur aucune feuille de service : {namen}. D'abord les inscrire, puis importer à nouveau.",
  },
  uebernehmen:      { de: 'Übernehmen', en: 'Import', fr: 'Importer' },
  abbrechen:        { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  kalkulation:      { de: 'Kalkulation', en: 'Budget', fr: 'Budget' },
  finanzierungsplan:{ de: 'Finanzierungsplan', en: 'Financing plan', fr: 'Plan de financement' },
  fassungWaehlen:   { de: 'Kalkulationsfassung wählen', en: 'Choose budget version', fr: 'Choisir la version du budget' },
  kategorieWaehlen: { de: 'Kategorie wählen', en: 'Choose category', fr: 'Choisir une catégorie' },
  position:         { de: 'Position', en: 'Item', fr: 'Poste' },
  kostenUebernehmen:{ de: 'Kosten übernehmen', en: 'Import costs', fr: 'Importer les coûts' },
  foerderTitel:     {
    de: 'Projektdaten, Kalkulation und Finanzierungsplan gebündelt für den Förderantrag',
    en: 'Project data, budget and financing plan bundled for the funding application',
    fr: 'Données du projet, budget et plan de financement regroupés pour la demande de subvention',
  },
  foerderantrag:    { de: 'Förderantrag', en: 'Funding application', fr: 'Demande de subvention' },
  gesamt:           { de: 'Gesamt', en: 'Total', fr: 'Total' },
  kto:              { de: 'Kto', en: 'Acct', fr: 'Cpte' },
  beschreibung:     { de: 'Beschreibung', en: 'Description', fr: 'Description' },
  einzelpreis:      { de: 'Einzelpreis', en: 'Unit price', fr: 'Prix unitaire' },
  keinePositionen:  {
    de: 'Noch keine Positionen. Wähle eine Kategorie und klicke „Position“.',
    en: 'No items yet. Choose a category and click "Item".',
    fr: 'Aucun poste pour le moment. Choisis une catégorie et clique sur « Poste ».',
  },
  gesamtbudget:     { de: 'Gesamtbudget', en: 'Total budget', fr: 'Budget total' },
  finFassungWaehlen:{ de: 'Finanzierungsfassung wählen', en: 'Choose financing version', fr: 'Choisir la version du financement' },
  geldgeber:        { de: 'Geldgeber', en: 'Funder', fr: 'Financeur' },
  neuerGeldgeber:   { de: 'Neuer Geldgeber', en: 'New funder', fr: 'Nouveau financeur' },
  geldgeberSpalte:  { de: 'Geldgeber / Quelle', en: 'Funder / source', fr: 'Financeur / source' },
  typ:              { de: 'Typ', en: 'Type', fr: 'Type' },
  betrag:           { de: 'Betrag', en: 'Amount', fr: 'Montant' },
  anteil:           { de: 'Anteil', en: 'Share', fr: 'Part' },
  status:           { de: 'Status', en: 'Status', fr: 'Statut' },
  keineEintraege:   { de: 'Noch keine Einträge.', en: 'No entries yet.', fr: 'Aucune entrée pour le moment.' },
  loeschenFrage:    { de: '„{name}“ löschen? Das lässt sich nicht rückgängig machen.', en: 'Delete "{name}"? This cannot be undone.', fr: 'Supprimer « {name} » ? Cette action est irréversible.' },
  nurProduktion:    { de: 'Kalkulation und Finanzierung bearbeiten Produktion und Admins.', en: 'Only producers and admins can edit the budget and financing.', fr: 'Seuls les producteurs et les administrateurs peuvent modifier le budget et le financement.' },
} satisfies Record<string, Text>

/** Beschriftung der Einheiten; gespeichert wird der deutsche Wert. */
export const EINHEIT_TEXT: Record<string, Text> = {
  'Pauschal': { de: 'Pauschal', en: 'Flat rate', fr: 'Forfait' },
  'Tage':     { de: 'Tage', en: 'Days', fr: 'Jours' },
  'Stunden':  { de: 'Stunden', en: 'Hours', fr: 'Heures' },
  'Wochen':   { de: 'Wochen', en: 'Weeks', fr: 'Semaines' },
  'Monate':   { de: 'Monate', en: 'Months', fr: 'Mois' },
  'Stück':    { de: 'Stück', en: 'Pieces', fr: 'Pièces' },
}

/** Beschriftung der Finanzierungsarten; gespeichert wird der deutsche Wert. */
export const FINANZIERUNGSART_TEXT: Record<string, Text> = {
  'Förderung':          { de: 'Förderung', en: 'Funding', fr: 'Subvention' },
  'Förderung regional': { de: 'Förderung regional', en: 'Regional funding', fr: 'Subvention régionale' },
  'Förderung national': { de: 'Förderung national', en: 'National funding', fr: 'Subvention nationale' },
  'Sender':             { de: 'Sender', en: 'Broadcaster', fr: 'Diffuseur' },
  'Eigenmittel':        { de: 'Eigenmittel', en: 'Own funds', fr: 'Fonds propres' },
  'Co-Produktion':      { de: 'Co-Produktion', en: 'Co-production', fr: 'Coproduction' },
  'Vertrieb':           { de: 'Vertrieb', en: 'Distribution', fr: 'Distribution' },
  'Sonstiges':          { de: 'Sonstiges', en: 'Other', fr: 'Autre' },
}
