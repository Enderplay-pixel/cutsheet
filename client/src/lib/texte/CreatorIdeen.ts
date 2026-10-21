import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorIdeenT = {
  titel:           { de: 'Ideen', en: 'Ideas', fr: 'Idées' },
  untertitelLeer:  { de: 'Der Vorrat, aus dem die Videos kommen', en: 'The pool the videos come from', fr: "La réserve d'où viennent les vidéos" },
  untertitel:      { de: '{offen} offen von {n} · sortiert nach Wirkung im Verhältnis zum Aufwand', en: '{offen} open of {n} · sorted by impact relative to effort', fr: "{offen} ouvertes sur {n} · triées selon l'impact par rapport à l'effort" },
  ideeNichtGesp:   { de: 'Idee nicht gespeichert', en: 'Idea not saved', fr: 'Idée non enregistrée' },
  aenderungNicht:  { de: 'Änderung nicht gespeichert', en: 'Change not saved', fr: 'Modification non enregistrée' },
  loeschenFehl:    { de: 'Löschen fehlgeschlagen', en: 'Delete failed', fr: 'Échec de la suppression' },
  umwandelnFehl:   { de: 'Umwandeln fehlgeschlagen', en: 'Conversion failed', fr: 'Échec de la conversion' },
  idee:            { de: 'Idee', en: 'Idea', fr: 'Idée' },
  ideePlatzhalter: { de: 'Worum geht es?', en: 'What is it about?', fr: "De quoi s'agit-il ?" },
  wirkung:         { de: 'Wirkung', en: 'Impact', fr: 'Impact' },
  aufwand:         { de: 'Aufwand', en: 'Effort', fr: 'Effort' },
  aufnehmen:       { de: 'Aufnehmen', en: 'Add', fr: 'Ajouter' },
  notizPlatzhalter:{ de: 'Notiz - Winkel, Hook, Quelle (optional)', en: 'Note - angle, hook, source (optional)', fr: 'Note - angle, accroche, source (facultatif)' },
  leerTitel:       { de: 'Noch keine Ideen gesammelt', en: 'No ideas collected yet', fr: 'Aucune idée recueillie pour le moment' },
  leerText:        { de: 'Wirkung und Aufwand von 1 bis 5. Die Reihenfolge ergibt sich aus dem Verhältnis - eine kleine Idee mit großer Wirkung landet vor einem aufwendigen Großprojekt.', en: 'Impact and effort from 1 to 5. The order follows from the ratio - a small idea with a big impact ranks ahead of an elaborate major project.', fr: "Impact et effort de 1 à 5. L'ordre découle du rapport - une petite idée à fort impact passe avant un grand projet coûteux." },
  prio:            { de: 'Prio', en: 'Prio', fr: 'Prio' },
  zumVideo:        { de: 'Zum Video', en: 'Go to video', fr: 'Vers la vidéo' },
  videoDaraus:     { de: 'Video daraus', en: 'Make video', fr: 'En faire une vidéo' },
  statusOffen:     { de: 'offen', en: 'open', fr: 'ouverte' },
  statusGeplant:   { de: 'geplant', en: 'planned', fr: 'planifiée' },
  statusVerworfen: { de: 'verworfen', en: 'discarded', fr: 'abandonnée' },
} satisfies Record<string, Text>
