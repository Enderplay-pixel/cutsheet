import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Beschriftungen der Rollen - die Schlüssel sind Werte vom Server. */
export const einladungRollenT = {
  admin:     { de: 'Admin', en: 'Admin', fr: 'Administrateur' },
  producer:  { de: 'Produzent', en: 'Producer', fr: 'Producteur' },
  director:  { de: 'Regisseur', en: 'Director', fr: 'Réalisateur' },
  dept_head: { de: 'Abteilungsleitung', en: 'Head of department', fr: 'Chef de département' },
  read_only: { de: 'Lesezugriff', en: 'Read-only access', fr: 'Accès en lecture seule' },
} satisfies Record<string, Text>

export const einladungT = {
  netzwerkfehler: { de: 'Netzwerkfehler', en: 'Network error', fr: 'Erreur réseau' },
  wirdGeprueft: { de: 'Einladungslink wird geprüft…', en: 'Checking invitation link…', fr: "Vérification du lien d'invitation…" },
  ungueltig: { de: 'Ungültiger Link', en: 'Invalid link', fr: 'Lien non valide' },
  zurStartseite: { de: 'Zur Startseite', en: 'To the home page', fr: "Vers la page d'accueil" },
  willkommen: { de: 'Willkommen im Projekt!', en: 'Welcome to the project!', fr: 'Bienvenue dans le projet !' },
  duBistJetzt: { de: 'Du bist jetzt', en: 'You are now', fr: 'Vous êtes maintenant' },
  in: { de: 'in', en: 'in', fr: 'dans' },
  projektZitat: { de: ' „{titel}“', en: ' "{titel}"', fr: ' « {titel} »' },
  zitat: { de: '„{text}“', en: '"{text}"', fr: '« {text} »' },
  leiteWeiter: { de: 'Leite weiter…', en: 'Redirecting…', fr: 'Redirection…' },
  eingeladenZu: { de: 'Du wurdest eingeladen zu', en: 'You have been invited to', fr: 'Vous avez été invité(e) à rejoindre' },
  rolle: { de: 'Rolle:', en: 'Role:', fr: 'Rôle :' },
  angemeldetAls: { de: 'Angemeldet als', en: 'Signed in as', fr: 'Connecté(e) en tant que' },
  beitreten: { de: 'Projekt beitreten', en: 'Join project', fr: 'Rejoindre le projet' },
  anmeldenOderKonto: {
    de: 'Melde dich an oder erstelle ein Konto, um dem Projekt beizutreten.',
    en: 'Sign in or create an account to join the project.',
    fr: 'Connecte-toi ou crée un compte pour rejoindre le projet.',
  },
  registrieren: { de: 'Registrieren', en: 'Register', fr: "S'inscrire" },
  anmelden: { de: 'Anmelden', en: 'Sign in', fr: 'Se connecter' },
  passwort: { de: 'Passwort', en: 'Password', fr: 'Mot de passe' },
  anmeldenBeitreten: { de: 'Anmelden & Beitreten', en: 'Sign in & join', fr: 'Se connecter et rejoindre' },
  registrierenBeitreten: { de: 'Registrieren & Beitreten', en: 'Register & join', fr: "S'inscrire et rejoindre" },
} satisfies Record<string, Text>
