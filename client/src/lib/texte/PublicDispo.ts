import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const publicDispoT = {
  linkUngueltig:     { de: 'Link ungültig', en: 'Invalid link', fr: 'Lien invalide' },
  linkUngueltigText: { de: 'Dieser Dispo-Link existiert nicht oder wurde zurückgezogen. Bitte wende dich an deine Produktionsleitung.', en: 'This call sheet link does not exist or has been withdrawn. Please contact your production manager.', fr: "Ce lien de feuille de service n'existe pas ou a été retiré. Merci de contacter ta direction de production." },
  drehtag:           { de: 'Drehtag {n}', en: 'Shoot day {n}', fr: 'Jour de tournage {n}' },
  deineCallTime:     { de: 'Deine Call Time', en: 'Your call time', fr: 'Ton heure de convocation' },
  zusageBestaetigt:  { de: 'Zusage bestätigt', en: 'Attendance confirmed', fr: 'Présence confirmée' },
  wirdBestaetigt:    { de: 'Wird bestätigt…', en: 'Confirming…', fr: 'Confirmation…' },
  zusageBestaetigen: { de: 'Zusage bestätigen', en: 'Confirm attendance', fr: 'Confirmer ma présence' },
  allgemeinerCall:   { de: 'Allgemeiner Call:', en: 'General call:', fr: 'Convocation générale :' },
  drehbeginn:        { de: 'Drehbeginn:', en: 'Start of shooting:', fr: 'Début du tournage :' },
  tagesplan:         { de: 'Tagesplan', en: 'Day schedule', fr: 'Planning de la journée' },
  du:                { de: ' (du)', en: ' (you)', fr: ' (toi)' },
  kontoVorhanden:    { de: 'Du hast bereits ein CutSheet-Konto -', en: 'You already have a CutSheet account -', fr: 'Tu as déjà un compte CutSheet -' },
  hierAnmelden:      { de: 'hier anmelden', en: 'sign in here', fr: 'connecte-toi ici' },
  ganzesProjekt:     { de: ', um das ganze Projekt zu sehen.', en: ' to see the whole project.', fr: ' pour voir tout le projet.' },
  erstelltMit:       { de: 'Erstellt mit CutSheet', en: 'Made with CutSheet', fr: 'Créé avec CutSheet' },
  impressum:         { de: 'Impressum', en: 'Legal notice', fr: 'Mentions légales' },
  datenschutz:       { de: 'Datenschutz', en: 'Privacy', fr: 'Confidentialité' },
  fehlerAufgetreten: { de: 'Ein Fehler ist aufgetreten', en: 'An error occurred', fr: "Une erreur s'est produite" },
  teilDerCrew:       { de: 'Du bist Teil der Crew von „{titel}“', en: 'You are part of the crew of "{titel}"', fr: "Tu fais partie de l'équipe de « {titel} »" },
  kontoText:         { de: 'Erstelle dein kostenloses Konto, um Drehplan, Shotlist und Check-in des Projekts zu sehen.', en: "Create your free account to see the project's shooting schedule, shot list and check-in.", fr: 'Crée ton compte gratuit pour voir le plan de tournage, la liste des plans et le check-in du projet.' },
  deinName:          { de: 'Dein Name', en: 'Your name', fr: 'Ton nom' },
  passwortWaehlen:   { de: 'Passwort wählen (min. 6 Zeichen)', en: 'Choose a password (min. 6 characters)', fr: 'Choisis un mot de passe (6 caractères min.)' },
  kontoWirdErstellt: { de: 'Konto wird erstellt…', en: 'Creating account…', fr: 'Création du compte…' },
  kontoErstellen:    { de: 'Konto erstellen & Projekt öffnen', en: 'Create account & open project', fr: 'Créer un compte et ouvrir le projet' },
} satisfies Record<string, Text>
