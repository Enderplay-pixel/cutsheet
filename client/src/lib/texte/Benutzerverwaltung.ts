import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const benutzerT = {
  rolleAdmin:     { de: 'Admin', en: 'Admin', fr: 'Admin' },
  rolleProducer:  { de: 'Produzent', en: 'Producer', fr: 'Producteur' },
  rolleDirector:  { de: 'Regisseur', en: 'Director', fr: 'Réalisateur' },
  rolleDeptHead:  { de: 'Abteilungsleitung', en: 'Head of department', fr: 'Chef de département' },
  rolleReadOnly:  { de: 'Lesezugriff', en: 'Read-only', fr: 'Lecture seule' },
  rolleGeaendert: { de: 'Rolle geändert', en: 'Role changed', fr: 'Rôle modifié' },
  fehler:         { de: 'Fehler', en: 'Error', fr: 'Erreur' },
  eingeladen:     { de: '{name} wurde eingeladen', en: '{name} has been invited', fr: '{name} a été invité(e)' },
  einladungFehler:{ de: 'Einladung fehlgeschlagen', en: 'Invitation failed', fr: "Échec de l'invitation" },
  titel:          { de: 'Benutzerverwaltung', en: 'User management', fr: 'Gestion des utilisateurs' },
  untertitel:     { de: '{n} registrierte Benutzer · nur für Admins', en: '{n} registered users · admins only', fr: '{n} utilisateurs inscrits · réservé aux admins' },
  alleBenutzer:   { de: 'Alle Benutzer', en: 'All users', fr: 'Tous les utilisateurs' },
  spalteName:     { de: 'Name', en: 'Name', fr: 'Nom' },
  spalteEmail:    { de: 'E-Mail', en: 'Email', fr: 'E-mail' },
  spalteRolle:    { de: 'Rolle', en: 'Role', fr: 'Rôle' },
  spalteSeit:     { de: 'Dabei seit', en: 'Member since', fr: 'Membre depuis' },
  keine:          { de: 'Keine Benutzer gefunden.', en: 'No users found.', fr: 'Aucun utilisateur trouvé.' },
  dasBistDu:      { de: 'Das bist du', en: 'This is you', fr: "C'est toi" },
  einladenTitel:  { de: 'Neuen Benutzer einladen', en: 'Invite new user', fr: 'Inviter un nouvel utilisateur' },
  namePlatzhalter:{ de: 'Vorname Nachname', en: 'First name Last name', fr: 'Prénom Nom' },
  mailPlatzhalter:{ de: 'person@beispiel.de', en: 'person@example.com', fr: 'personne@exemple.fr' },
  initialpasswort:{ de: 'Initialpasswort', en: 'Initial password', fr: 'Mot de passe initial' },
  mindestens:     { de: 'Mindestens 6 Zeichen', en: 'At least 6 characters', fr: 'Au moins 6 caractères' },
  wirdEingeladen: { de: 'Wird eingeladen…', en: 'Inviting…', fr: 'Invitation en cours…' },
  einladen:       { de: 'Einladen', en: 'Invite', fr: 'Inviter' },
} satisfies Record<string, Text>
