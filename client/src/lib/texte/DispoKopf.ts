import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Dispo-Kopf vollständig, Abteilungen aus dem Breakdown, Bestätigungslink (Plan Kino-Ausbau, AP C4). */
export const kopfT = {
  versorgung: { de: 'Drehort und Versorgung', en: 'Location and logistics', fr: 'Lieu et logistique' },
  vomMotiv: { de: 'vom Motiv übernehmen', en: 'take from location', fr: 'reprendre du lieu' },
  vomMotivTitel: { de: 'Krankenhaus, Basecamp und Parken neu vom Motiv „{motiv}“ holen', en: 'Fetch hospital, base camp and parking again from location "{motiv}"', fr: 'Reprendre hôpital, camp de base et parking du lieu « {motiv} »' },
  vomMotivErledigt: { de: 'Vom Motiv übernommen', en: 'Taken from the location', fr: 'Repris du lieu' },
  krankenhaus: { de: 'Nächstes Krankenhaus', en: 'Nearest hospital', fr: 'Hôpital le plus proche' },
  krankenhausAdresse: { de: 'Adresse des Krankenhauses', en: 'Hospital address', fr: 'Adresse de l’hôpital' },
  basecamp: { de: 'Basecamp', en: 'Base camp', fr: 'Camp de base' },
  parken: { de: 'Crew-Parken', en: 'Crew parking', fr: 'Parking équipe' },
  fruehstueck: { de: 'Frühstück ab', en: 'Breakfast from', fr: 'Petit-déjeuner dès' },
  mittag: { de: 'Mittag ab', en: 'Lunch from', fr: 'Déjeuner dès' },
  tempHoch: { de: 'Temperatur hoch', en: 'Temperature high', fr: 'Température max.' },
  tempTief: { de: 'Temperatur tief', en: 'Temperature low', fr: 'Température min.' },
  funk: { de: 'Funkkanäle', en: 'Walkie channels', fr: 'Canaux radio' },
  funkPh: { de: '1 Regie, 2 Technik', en: '1 directing, 2 tech', fr: '1 réalisation, 2 technique' },
  keineZeit: { de: '„{x}“ ist keine Uhrzeit - gültig sind 00:00 bis 23:59, leer heißt keine Angabe.', en: '"{x}" is not a time - valid are 00:00 to 23:59, empty means none.', fr: '« {x} » n’est pas une heure - de 00:00 à 23:59, vide signifie aucune.' },
  // Abteilungen
  abteilungen: { de: 'Abteilungen', en: 'Departments', fr: 'Départements' },
  abteilungenHilfe: {
    de: 'Je Abteilung, was die Szenen des Tages laut Breakdown brauchen. "Übernehmen" schreibt den Vorschlag in die Abteilungsnotizen der Dispo; eigener Text einer Abteilung wird nur nach Rückfrage ersetzt.',
    en: 'Per department, what the day’s scenes need according to the breakdown. "Take over" writes the suggestion into the call sheet’s department notes; a department’s own text is replaced only after asking.',
    fr: 'Par département, ce dont les scènes du jour ont besoin selon le dépouillement. « Reprendre » écrit la proposition dans les notes de département ; le texte propre d’un département n’est remplacé qu’après confirmation.',
  },
  keinVorschlag: { de: 'Der Breakdown der Szenen des Tages ist leer.', en: 'The breakdown of the day’s scenes is empty.', fr: 'Le dépouillement des scènes du jour est vide.' },
  vorschlag: { de: 'Vorschlag', en: 'Suggestion', fr: 'Proposition' },
  aufDerDispo: { de: 'Auf der Dispo', en: 'On the call sheet', fr: 'Sur la feuille' },
  uebernehmen: { de: 'Übernehmen', en: 'Take over', fr: 'Reprendre' },
  alleUebernehmen: { de: 'Alle übernehmen', en: 'Take over all', fr: 'Tout reprendre' },
  uebernommen: { de: 'übernommen', en: 'taken over', fr: 'repris' },
  ersetzenFrage: { de: '{abteilungen}: Dort steht schon eigener Text. Durch den Vorschlag ersetzen?', en: '{abteilungen}: own text is already there. Replace it with the suggestion?', fr: '{abteilungen} : un texte propre existe déjà. Le remplacer par la proposition ?' },
  notizen: { de: 'Abteilungsnotizen', en: 'Department notes', fr: 'Notes de département' },
  notizenHilfe: { de: 'Je Zeile "ABTEILUNG: Text" - so stehen sie im PDF.', en: 'One line each "DEPARTMENT: text" - that is how they appear in the PDF.', fr: 'Une ligne « DÉPARTEMENT : texte » - ainsi dans le PDF.' },
  // Links
  linkKopieren: { de: 'Link kopieren', en: 'Copy link', fr: 'Copier le lien' },
  linkVon: { de: 'Bestätigungslink von {name} kopieren', en: 'Copy confirmation link of {name}', fr: 'Copier le lien de confirmation de {name}' },
  alleLinks: { de: 'Alle Links kopieren', en: 'Copy all links', fr: 'Copier tous les liens' },
  kopiert: { de: 'Link kopiert', en: 'Link copied', fr: 'Lien copié' },
  alleKopiert: { de: '{n} Links kopiert', en: '{n} links copied', fr: '{n} liens copiés' },
  nichtKopiert: { de: 'Kopieren ging nicht - hier zum Markieren:', en: 'Copying failed - here to select:', fr: 'La copie a échoué - à sélectionner ici :' },
} satisfies Record<string, Text>
