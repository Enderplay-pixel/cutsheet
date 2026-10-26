import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const buchhaltungT = {
  gespeichert: { de: 'Gespeichert', en: 'Saved', fr: 'Enregistré' },
  nichtGespeichert: { de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
  titel: { de: 'Buchhaltung', en: 'Accounting', fr: 'Comptabilité' },
  rechnungen: { de: 'Rechnungen', en: 'Invoices', fr: 'Factures' },
  zeitraum: { de: 'Zeitraum', en: 'Period', fr: 'Période' },
  von: { de: 'Von', en: 'From', fr: 'Du' },
  bis: { de: 'Bis', en: 'To', fr: 'Au' },
  lade: { de: 'Lade…', en: 'Loading…', fr: 'Chargement…' },
  anzahlRechnungen: { de: '{n} Rechnungen', en: '{n} invoices', fr: '{n} factures' },
  einfacheTabelle: { de: 'Einfache Tabelle als CSV', en: 'Simple table as CSV', fr: 'Tableau simple en CSV' },
  einfacheTabelleText: {
    de: 'Eine Zeile je Rechnung und Steuersatz. Braucht keine Formatzusage - der Weg, wenn der Steuerberater nur die Rechnungen sehen will.',
    en: 'One row per invoice and tax rate. Needs no format approval - the way to go if the tax adviser only wants to see the invoices.',
    fr: "Une ligne par facture et par taux de TVA. Aucun accord de format nécessaire - la solution lorsque l'expert-comptable veut seulement voir les factures.",
  },
  datevStapel: { de: 'DATEV-Buchungsstapel', en: 'DATEV posting batch', fr: "Lot d'écritures DATEV" },
  datevHinweis: {
    de: 'Der Stapel wird ohne Festschreibung erzeugt und lässt sich in DATEV ansehen und verwerfen.',
    en: 'The batch is created without being finalised and can be viewed and discarded in DATEV.',
    fr: 'Le lot est généré sans validation et peut être consulté et rejeté dans DATEV.',
  },
  dafuerFehlt: { de: 'Dafür fehlt noch:', en: 'Still missing for this:', fr: 'Il manque encore :' },
  buchungen: { de: 'Buchungen', en: 'Postings', fr: 'Écritures' },
  summe: { de: 'Summe', en: 'Total', fr: 'Total' },
  kontenrahmen: { de: 'Kontenrahmen', en: 'Chart of accounts', fr: 'Plan comptable' },
  erloeskonto19: { de: 'Erlöskonto 19 %', en: 'Revenue account 19 %', fr: 'Compte de produits 19 %' },
  stapelHerunterladen: { de: 'Buchungsstapel herunterladen', en: 'Download posting batch', fr: "Télécharger le lot d'écritures" },
  kanzlei: { de: 'Angaben der Kanzlei', en: "Tax adviser's details", fr: "Coordonnées du cabinet comptable" },
  beraternummer: { de: 'Beraternummer', en: 'Adviser number (Beraternummer)', fr: 'Numéro de conseiller (Beraternummer)' },
  mandantennummer: { de: 'Mandantennummer', en: 'Client number (Mandantennummer)', fr: 'Numéro de client (Mandantennummer)' },
  vomSteuerberater: { de: 'vom Steuerberater', en: 'from your tax adviser', fr: "fourni par l'expert-comptable" },
  sachkontenlaenge: { de: 'Sachkontenlänge', en: 'G/L account length', fr: 'Longueur des comptes généraux' },
  basiszins: { de: 'Basiszinssatz in Basispunkten', en: 'Base interest rate in basis points', fr: "Taux d'intérêt de base en points de base" },
  basiszinsBeispiel: { de: '152 = 1,52 %', en: '152 = 1.52 %', fr: '152 = 1,52 %' },
  gueltigSeit: { de: 'Gültig seit', en: 'Valid from', fr: 'Valable depuis' },
  basiszinsText: {
    de: 'Der Basiszinssatz nach § 247 BGB ändert sich zum 1. Januar und zum 1. Juli. Leer heißt: CutSheet nimmt seinen eigenen Stand. Wer hier einträgt, trägt auch das Datum ein - sonst weiß später niemand, ob der Satz noch gilt.',
    en: 'The base interest rate under § 247 BGB (German Civil Code) changes on 1 January and 1 July. Empty means: CutSheet uses its own value. If you enter a rate here, enter the date too - otherwise nobody will know later whether the rate still applies.',
    fr: "Le taux d'intérêt de base selon le § 247 BGB (Code civil allemand) change au 1er janvier et au 1er juillet. Vide signifie : CutSheet utilise sa propre valeur. Si tu saisis un taux ici, saisis aussi la date - sinon personne ne saura plus tard si le taux est encore valable.",
  },
  mahnwesen: { de: 'Mahnwesen eingeschaltet', en: 'Payment reminders enabled', fr: 'Relances activées' },
  speichern: { de: 'Speichern', en: 'Save', fr: 'Enregistrer' },
} satisfies Record<string, Text>
