import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const datenschutzWerkzeugeT = {
  titel:       { de: 'Datenschutz', en: 'Data protection', fr: 'Protection des données' },
  untertitel:  { de: 'Auskunft geben, Daten entfernen, Zugriffe sehen', en: 'Provide subject access, remove data, see who has access', fr: "Répondre aux demandes d'accès, supprimer des données, voir les accès" },
  tabAuskunft: { de: 'Auskunft', en: 'Subject access', fr: "Droit d'accès" },
  tabEntfernen: { de: 'Daten entfernen', en: 'Remove data', fr: 'Supprimer des données' },
  tabZugriff:  { de: 'Wer sieht was', en: 'Who sees what', fr: 'Qui voit quoi' },

  artStab:        { de: 'Stab', en: 'Crew', fr: 'Équipe' },
  artBesetzung:   { de: 'Besetzung', en: 'Cast', fr: 'Casting' },
  artKomparserie: { de: 'Komparserie', en: 'Extras', fr: 'Figuration' },

  // Auskunft (Art. 15)
  keineAuskunft: { de: 'Keine Auskunft', en: 'No access report', fr: "Pas de rapport d'accès" },
  auskunftTitel: { de: 'Auskunft nach Artikel 15 DSGVO', en: 'Subject access under Article 15 GDPR (DSGVO)', fr: "Droit d'accès selon l'article 15 du RGPD (DSGVO)" },
  auskunftText: {
    de: 'Wer wissen will, was über sie oder ihn gespeichert ist, hat ein Recht darauf. Hier steht alles aus diesem Projekt an einer Stelle - zum Weitergeben.',
    en: 'Anyone who wants to know what is stored about them has a right to it. Here is everything from this project in one place - ready to pass on.',
    fr: 'Toute personne qui veut savoir ce qui est enregistré à son sujet en a le droit. Ici, tout ce qui concerne ce projet est réuni en un seul endroit - prêt à être transmis.',
  },
  bereich:           { de: 'Bereich', en: 'Area', fr: 'Catégorie' },
  person:            { de: 'Person', en: 'Person', fr: 'Personne' },
  waehlen:           { de: 'Wählen', en: 'Choose', fr: 'Choisir' },
  auskunftErstellen: { de: 'Auskunft erstellen', en: 'Create access report', fr: "Créer le rapport d'accès" },
  stand:             { de: 'Stand {datum}', en: 'As of {datum}', fr: 'Au {datum}' },
  alsDatei:          { de: 'Als Datei', en: 'As file', fr: 'En fichier' },

  // Entfernen (Art. 17)
  jetzt:          { de: 'Jetzt „{name}“', en: 'Now "{name}"', fr: 'Désormais « {name} »' },
  nichtEntfernt:  { de: 'Nicht entfernt', en: 'Not removed', fr: 'Non supprimé' },
  entfernenTitel: { de: 'Daten entfernen nach Artikel 17 DSGVO', en: 'Erasure of data under Article 17 GDPR (DSGVO)', fr: "Effacement des données selon l'article 17 du RGPD (DSGVO)" },
  entfernenHinweis: {
    de: 'Gelöscht wird der Bezug zur Person: Name, Kontakt, Freitexte. Was bleibt, sind Dispositionen und Arbeitszeiten als Produktionsunterlage - ohne Namen. Das ist gewollt: Eine Dispo von vorletztem Jahr muss nachvollziehbar bleiben, und Arbeitszeiten sind nach Paragraf 16 ArbZG zwei Jahre aufzubewahren.',
    en: 'What is deleted is the link to the person: name, contact details, free text. What remains are call sheets and working hours as production records - without names. This is intentional: a call sheet from the year before last must remain traceable, and working hours must be kept for two years under Section 16 of the German Working Hours Act (ArbZG).',
    fr: "Ce qui est supprimé, c'est le lien avec la personne : nom, coordonnées, textes libres. Restent les feuilles de service et les heures de travail comme documents de production - sans nom. C'est voulu : une feuille de service d'il y a deux ans doit rester traçable, et les heures de travail doivent être conservées deux ans selon le paragraphe 16 de la loi allemande sur le temps de travail (ArbZG).",
  },
  grund:            { de: 'Grund (kommt ins Protokoll)', en: 'Reason (goes into the log)', fr: "Motif (consigné dans l'historique)" },
  grundPlatzhalter: { de: 'Löschungsersuchen vom …', en: 'Erasure request of …', fr: "Demande d'effacement du …" },
  personenbezugEntfernen: { de: 'Personenbezug entfernen', en: 'Remove personal data', fr: 'Supprimer les données personnelles' },
  dialogTitel:      { de: '{name} entfernen?', en: 'Remove {name}?', fr: 'Supprimer {name} ?' },
  dialogText: {
    de: 'Name, E-Mail, Telefon, Notizen, Geburtsdatum und Angaben der Erziehungsberechtigten werden geleert, der Name durch die Funktion ersetzt. Das lässt sich nicht rückgängig machen. Dispositionen und Arbeitszeiten bleiben ohne Namen bestehen.',
    en: 'Name, email, phone, notes, date of birth and guardian details are cleared; the name is replaced by the job title. This cannot be undone. Call sheets and working hours remain, without names.',
    fr: "Le nom, l'e-mail, le téléphone, les notes, la date de naissance et les coordonnées des représentants légaux sont effacés ; le nom est remplacé par la fonction. Cette action est irréversible. Les feuilles de service et les heures de travail restent, sans nom.",
  },
  wirdEntfernt:     { de: 'Wird entfernt …', en: 'Removing …', fr: 'Suppression …' },
  endgueltig:       { de: 'Endgültig entfernen', en: 'Remove permanently', fr: 'Supprimer définitivement' },

  // Zugriff
  rolleAdmin:    { de: 'Alles, auch Löschen', en: 'Everything, including deleting', fr: 'Tout, y compris la suppression' },
  rolleProducer: { de: 'Alles außer Projekt löschen', en: 'Everything except deleting the project', fr: 'Tout sauf supprimer le projet' },
  rolleDirector: { de: 'Planung und Inhalte', en: 'Planning and content', fr: 'Planification et contenus' },
  rolleDeptHead: { de: 'Eigenes Gewerk', en: 'Own department', fr: 'Son propre département' },
  rolleReadOnly: { de: 'Nur lesen', en: 'Read only', fr: 'Lecture seule' },
  zugriffTitel:  { de: 'Wer kann die Personendaten sehen', en: 'Who can see the personal data', fr: 'Qui peut voir les données personnelles' },
  gastzugaenge: {
    de: 'Dazu {n} Gastzugänge über Links. Sie zeigen nur, was für sie freigegeben ist - keine Gagen, keine Telefonnummern.',
    en: 'Plus {n} guest accesses via links. They only show what has been shared with them - no fees, no phone numbers.',
    fr: "S'y ajoutent {n} accès invités par lien. Ils ne montrent que ce qui leur est partagé - ni cachets, ni numéros de téléphone.",
  },
} satisfies Record<string, Text>
