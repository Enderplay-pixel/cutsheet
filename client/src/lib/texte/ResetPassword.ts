import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const resetPasswordT = {
  nichtGleich:   { de: 'Die Passwörter stimmen nicht überein', en: 'The passwords do not match', fr: 'Les mots de passe ne correspondent pas' },
  fehler:        { de: 'Ein Fehler ist aufgetreten', en: 'An error occurred', fr: "Une erreur s'est produite" },
  titel:         { de: 'Neues Passwort', en: 'New password', fr: 'Nouveau mot de passe' },
  untertitel:    { de: 'Lege ein neues Passwort für dein Konto fest.', en: 'Set a new password for your account.', fr: 'Définis un nouveau mot de passe pour ton compte.' },
  neuesPasswort: { de: 'Neues Passwort', en: 'New password', fr: 'Nouveau mot de passe' },
  mindestens:    { de: 'Mindestens 6 Zeichen', en: 'At least 6 characters', fr: 'Au moins 6 caractères' },
  wiederholen:   { de: 'Passwort wiederholen', en: 'Repeat password', fr: 'Confirmer le mot de passe' },
  speichert:     { de: 'Wird gespeichert…', en: 'Saving…', fr: 'Enregistrement…' },
  festlegen:     { de: 'Passwort festlegen', en: 'Set password', fr: 'Définir le mot de passe' },
  zurueck:       { de: 'Zurück zur Anmeldung', en: 'Back to sign-in', fr: 'Retour à la connexion' },
} satisfies Record<string, Text>
