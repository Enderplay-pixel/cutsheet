export type Lang = 'en' | 'de' | 'fr'

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
]

// ─── Login page ───────────────────────────────────────────────────────────────
export const loginT = {
  tagline:            { en: 'Film production made easy',         de: 'Filmproduktion leicht gemacht',        fr: 'La production filmée simplifiée'          },
  tabLogin:           { en: 'Sign in',                           de: 'Anmelden',                             fr: 'Connexion'                                },
  tabRegister:        { en: 'Create account',                    de: 'Registrieren',                         fr: "Créer un compte"                          },
  labelName:          { en: 'Full name',                         de: 'Name',                                 fr: 'Nom complet'                              },
  labelEmail:         { en: 'Email',                             de: 'E-Mail',                               fr: 'E-mail'                                   },
  labelPassword:      { en: 'Password',                          de: 'Passwort',                             fr: 'Mot de passe'                             },
  labelLanguage:      { en: 'Language',                          de: 'Sprache',                              fr: 'Langue'                                   },
  placeholderName:    { en: 'First Last',                        de: 'Vorname Nachname',                     fr: 'Prénom Nom'                               },
  placeholderEmail:   { en: 'name@example.com',                  de: 'name@beispiel.de',                     fr: 'nom@exemple.fr'                           },
  placeholderPw:      { en: '••••••••',                          de: '••••••••',                             fr: '••••••••'                                 },
  btnLogin:           { en: 'Sign in',                           de: 'Anmelden',                             fr: 'Se connecter'                             },
  btnLoginLoading:    { en: 'Signing in…',                       de: 'Anmelden…',                            fr: 'Connexion…'                               },
  btnRegister:        { en: 'Create account',                    de: 'Registrieren',                         fr: 'Créer un compte'                          },
  btnRegisterLoading: { en: 'Creating account…',                 de: 'Registrieren…',                        fr: 'Création…'                               },
}

// ─── Tutorial steps ───────────────────────────────────────────────────────────
export const tutorialT = {
  skip:   { en: 'Skip',         de: 'Überspringen', fr: 'Passer'         },
  back:   { en: 'Back',         de: 'Zurück',       fr: 'Retour'         },
  next:   { en: 'Next',         de: 'Weiter',       fr: 'Suivant'        },
  finish: { en: "Let's go! 🚀", de: 'Los geht\'s! 🚀', fr: 'C\'est parti! 🚀' },
  step:   { en: 'Step',         de: 'Schritt',      fr: 'Étape'          },
  of:     { en: 'of',           de: 'von',          fr: 'sur'            },

  steps: [
    {
      emoji: '🎬',
      title:  { en: 'Welcome to CutSheet',          de: 'Willkommen bei CutSheet',          fr: 'Bienvenue sur CutSheet'             },
      body:   {
        en: 'CutSheet is your all-in-one tool for film production — from the very first scene breakdown all the way to the final wrap day. Everything your team needs, in one place.',
        de: 'CutSheet ist dein All-in-One-Tool für Filmproduktionen — vom ersten Szenen-Breakdown bis zum letzten Drehtag. Alles, was dein Team braucht, an einem Ort.',
        fr: "CutSheet est ton outil tout-en-un pour la production cinématographique — du premier découpage jusqu'au dernier jour de tournage. Tout ce dont ton équipe a besoin, au même endroit.",
      },
    },
    {
      emoji: '📁',
      title:  { en: 'Projects',                     de: 'Projekte',                         fr: 'Projets'                            },
      body:   {
        en: 'Create as many projects as you need. Invite your team members by link or QR code — and assign them a role: Director, Producer, Department Head, or Read-only. Completed projects can be archived.',
        de: 'Lege so viele Projekte an, wie du brauchst. Lade dein Team per Link oder QR-Code ein und vergib Rollen: Regie, Produzent, Abteilungsleitung oder Lesezugriff. Fertige Projekte lassen sich archivieren.',
        fr: "Crée autant de projets que nécessaire. Invite ton équipe par lien ou QR code et assigne-leur un rôle : Réalisateur, Producteur, Chef de département ou Lecture seule. Les projets terminés peuvent être archivés.",
      },
    },
    {
      emoji: '🎞️',
      title:  { en: 'Scenes & Script',              de: 'Szenen & Drehbuch',                fr: 'Scènes & Scénario'                  },
      body:   {
        en: 'Break down your script into scenes with location, INT/EXT, day/night, page count, props, costumes, SFX and more. Mark scenes as shot with one click. Filter by INT, EXT, day, night, or status.',
        de: 'Zerlege dein Skript in Szenen mit Motiv, INT/EXT, Tag/Nacht, Seitenanzahl, Requisite, Kostüm, SFX und mehr. Markiere Szenen als abgedreht — ein Klick genügt. Filtere nach INT, EXT, Tag, Nacht oder Status.',
        fr: "Décompose ton scénario en scènes avec lieu, INT/EXT, jour/nuit, nombre de pages, accessoires, costumes, effets spéciaux et plus. Marque les scènes comme tournées en un clic. Filtre par INT, EXT, jour, nuit ou statut.",
      },
    },
    {
      emoji: '👥',
      title:  { en: 'Cast & Crew',                  de: 'Besetzung & Stab',                 fr: 'Acteurs & Équipe'                   },
      body:   {
        en: 'Manage characters and their actors with contact details, agency and daily rate. Organise your crew by department — Camera, Sound, Lighting, Costume and more. Export everything as CSV or PDF at any time.',
        de: 'Verwalte Figuren und ihre Darsteller mit Kontaktdaten, Agentur und Tagesgage. Organisiere deinen Stab nach Abteilungen — Kamera, Ton, Licht, Kostüm und mehr. Exportiere jederzeit als CSV oder PDF.',
        fr: "Gère les personnages et leurs acteurs avec coordonnées, agence et cachet journalier. Organise ton équipe par département — Caméra, Son, Lumière, Costume et plus. Exporte tout en CSV ou PDF à tout moment.",
      },
    },
    {
      emoji: '📋',
      title:  { en: 'Shooting Plan & Daily Call Sheet', de: 'Drehplan & Tagesdispo',        fr: 'Plan de tournage & Feuille de service' },
      body:   {
        en: 'Build your shooting schedule and distribute scenes across shoot days. Each day gets its own call sheet with General Call, Shooting Call, weather forecast (fetched automatically!), catering count, cast & crew call times, and a PDF export.',
        de: 'Erstelle deinen Drehplan und verteile Szenen auf Drehtage. Jeder Tag bekommt eine eigene Tagesdispo mit General Call, Shooting Call, Wettervorhersage (automatisch abrufbar!), Catering-Zähler, Call Times für Cast & Crew und PDF-Export.',
        fr: "Construis ton planning de tournage et répartis les scènes sur les jours de tournage. Chaque jour dispose de sa propre feuille de service avec Appel général, Appel tournage, météo (récupérée automatiquement!), compteur repas, horaires d'appel et export PDF.",
      },
    },
    {
      emoji: '🚀',
      title:  { en: "You're all set!",              de: 'Du bist startklar!',               fr: 'Tu es prêt·e !'                     },
      body:   {
        en: "That's the quick tour. There's a lot more to explore — budget tracking, a conflict radar, pinboard, shot list, daily reports, and a full screenplay editor. Press '?' at any time to see all keyboard shortcuts. Lights, camera, action!",
        de: 'Das war der Schnelldurchlauf. Es gibt noch viel mehr zu entdecken — Budget, Konfliktradar, Pinboard, Shotlist, Tagesbericht und einen vollständigen Drehbuch-Editor. Drücke jederzeit \'?\' für alle Tastaturkürzel. Licht an, Kamera läuft — und Action!',
        fr: "Voilà pour le tour rapide. Il y a encore beaucoup à découvrir — suivi du budget, radar de conflits, tableau d'affichage, liste de plans, rapports journaliers et un éditeur de scénario complet. Appuie sur '?' à tout moment pour voir tous les raccourcis clavier. Lumières, caméra, action !",
      },
    },
  ],
}

export function t(map: Record<Lang, string>, lang: Lang): string {
  return map[lang] ?? map['en']
}
