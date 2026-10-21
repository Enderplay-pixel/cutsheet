import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const vergessenT = {
  fehler:        { de: 'Ein Fehler ist aufgetreten', en: 'An error occurred', fr: "Une erreur s'est produite" },
  titel:         { de: 'Passwort vergessen', en: 'Forgot password', fr: 'Mot de passe oublié' },
  unterwegs:     { de: 'E-Mail unterwegs', en: 'Email on its way', fr: 'E-mail en route' },
  gesendet:      {
    de: 'Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Der Link ist 60 Minuten gültig.',
    en: 'If an account with this address exists, we have sent you a link to reset your password. The link is valid for 60 minutes.',
    fr: 'Si un compte existe avec cette adresse, nous vous avons envoyé un lien de réinitialisation. Le lien est valable 60 minutes.',
  },
  keinVersand:   {
    de: 'Auf diesem Server ist kein E-Mail-Versand konfiguriert. Bitte wende dich an die Person, die CutSheet betreibt - sie kann dein Passwort zurücksetzen.',
    en: 'Email sending is not configured on this server. Please contact the person who runs CutSheet - they can reset your password.',
    fr: "L'envoi d'e-mails n'est pas configuré sur ce serveur. Veuillez contacter la personne qui gère CutSheet - elle peut réinitialiser votre mot de passe.",
  },
  hinweis:       {
    de: 'Gib deine E-Mail-Adresse ein - wir schicken dir einen Link, mit dem du ein neues Passwort festlegen kannst.',
    en: "Enter your email address - we'll send you a link to set a new password.",
    fr: 'Saisissez votre adresse e-mail - nous vous enverrons un lien pour définir un nouveau mot de passe.',
  },
  email:         { de: 'E-Mail', en: 'Email', fr: 'E-mail' },
  emailBeispiel: { de: 'name@example.com', en: 'name@example.com', fr: 'nom@exemple.fr' },
  wirdGesendet:  { de: 'Wird gesendet…', en: 'Sending…', fr: 'Envoi en cours…' },
  anfordern:     { de: 'Link anfordern', en: 'Request link', fr: 'Demander le lien' },
  zurueck:       { de: 'Zurück zur Anmeldung', en: 'Back to sign-in', fr: 'Retour à la connexion' },
} satisfies Record<string, Text>
