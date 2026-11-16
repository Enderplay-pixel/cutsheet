import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Finanzierungsplan mit Stand, Lücke und Raten (Plan Kino-Ausbau, AP B2). Gespeichert wird der deutsche Schlüssel. */
export const STAND_TEXT: Record<string, Text> = {
  geplant: { de: 'geplant', en: 'planned', fr: 'prévu' },
  beantragt: { de: 'beantragt', en: 'applied for', fr: 'demandé' },
  zugesagt: { de: 'zugesagt', en: 'granted', fr: 'accordé' },
  ausgezahlt: { de: 'ausgezahlt', en: 'paid out', fr: 'versé' },
}
export const STAENDE = ['geplant', 'beantragt', 'zugesagt', 'ausgezahlt']

export const finT = {
  herstellungskosten: { de: 'Herstellungskosten', en: 'Total production costs', fr: 'Coût total de production' },
  finanzierung: { de: 'Finanzierung', en: 'Financing', fr: 'Financement' },
  zugesagt: { de: 'davon zugesagt', en: 'of which granted', fr: 'dont accordé' },
  ausgezahlt: { de: 'davon ausgezahlt', en: 'of which paid out', fr: 'dont versé' },
  luecke: { de: 'Lücke', en: 'Gap', fr: 'Écart' },
  nichtZugesagt: { de: 'davon noch nicht zugesagt: {betrag}', en: 'not yet granted: {betrag}', fr: 'pas encore accordé : {betrag}' },
  ueberfinanziert: { de: 'überfinanziert um {betrag}', en: 'overfinanced by {betrag}', fr: 'surfinancé de {betrag}' },
  ausKalkulation: { de: 'aus „{name}“', en: 'from "{name}"', fr: 'de « {name} »' },
  ohneKalkulation: { de: 'noch keine Kalkulation', en: 'no budget yet', fr: 'pas encore de budget' },
  stand: { de: 'Stand', en: 'Status', fr: 'Statut' },
  standVon: { de: 'Stand von {name}', en: 'Status of {name}', fr: 'Statut de {name}' },
  details: { de: 'Antrag, Zusage und Raten von {name}', en: 'Application, grant and installments of {name}', fr: 'Demande, accord et échéances de {name}' },
  antragAm: { de: 'Antrag am', en: 'Applied on', fr: 'Demandé le' },
  zusageAm: { de: 'Zusage am', en: 'Granted on', fr: 'Accordé le' },
  aktenzeichen: { de: 'Aktenzeichen', en: 'Reference', fr: 'Référence' },
  raten: { de: 'Raten', en: 'Installments', fr: 'Échéances' },
  anlass: { de: 'Fälligkeit (Anlass)', en: 'Due (occasion)', fr: 'Échéance (occasion)' },
  anlassBeispiel: { de: 'z. B. Drehbeginn', en: 'e.g. start of shoot', fr: 'p. ex. début du tournage' },
  faelligAm: { de: 'Fällig am', en: 'Due on', fr: 'Échéance le' },
  betrag: { de: 'Betrag', en: 'Amount', fr: 'Montant' },
  eingangAm: { de: 'Eingang am', en: 'Received on', fr: 'Reçu le' },
  rateNeu: { de: 'Rate', en: 'Installment', fr: 'Échéance' },
  rateLoeschen: { de: 'Rate löschen', en: 'Delete installment', fr: 'Supprimer l’échéance' },
  ueberfaellig: { de: 'überfällig', en: 'overdue', fr: 'en retard' },
  ratenUeber: {
    de: 'Die Raten ergeben {summe} - mehr als der Betrag des Geldgebers ({betrag}).',
    en: 'The installments add up to {summe} - more than the funder’s amount ({betrag}).',
    fr: 'Les échéances totalisent {summe} - plus que le montant du financeur ({betrag}).',
  },
  keineRaten: { de: 'Noch keine Raten.', en: 'No installments yet.', fr: 'Pas encore d’échéances.' },
  // Rückstellungen, Beistellungen, Rückflussrang (AP E4)
  ausDerKalkulation: { de: 'aus der Kalkulation', en: 'from the budget', fr: 'du budget' },
  rueckstellungen: { de: 'Rückstellungen (aus der Kalkulation)', en: 'Deferrals (from the budget)', fr: 'Reports (du budget)' },
  beistellungen: { de: 'Beistellungen (aus der Kalkulation)', en: 'In-kind contributions (from the budget)', fr: 'Apports en nature (du budget)' },
  zuDenZeilen: { de: 'Zu den Zeilen', en: 'To the lines', fr: 'Vers les lignes' },
  selbstGerechnet: { de: 'Rechnet sich aus den Zeilen der Kalkulation und gilt als zugesagt - ändern lässt es sich dort.', en: 'Calculated from the budget lines and counts as committed - change it there.', fr: 'Calculé à partir des lignes du budget et compté comme accordé - à modifier là-bas.' },
  rang: { de: 'Rückflussrang', en: 'Recoupment rank', fr: 'Rang de remboursement' },
  rangKurz: { de: 'Rang {n}', en: 'Rank {n}', fr: 'Rang {n}' },
  rangBedingungen: { de: 'Bedingungen des Rückflusses', en: 'Recoupment terms', fr: 'Conditions de remboursement' },
} satisfies Record<string, Text>
