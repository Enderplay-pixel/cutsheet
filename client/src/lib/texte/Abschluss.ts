import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const abschlussT = {
  abgeschlossenToast: { de: 'Projekt abgeschlossen', en: 'Project wrapped up', fr: 'Projet clôturé' },
  nichtAbgeschl:      { de: 'Nicht abgeschlossen', en: 'Not wrapped up', fr: 'Non clôturé' },
  wiederOffenToast:   { de: 'Projekt wieder offen', en: 'Project reopened', fr: 'Projet rouvert' },
  nichtZurueck:       { de: 'Nicht zurückgenommen', en: 'Not reverted', fr: 'Non annulé' },
  lade:               { de: 'Lade…', en: 'Loading…', fr: 'Chargement…' },
  titel:              { de: 'Abschluss', en: 'Project wrap-up', fr: 'Clôture du projet' },
  istAbgeschlossen:   { de: 'Dieses Projekt ist abgeschlossen', en: 'This project is wrapped up', fr: 'Ce projet est clôturé' },
  imArchiv:           { de: 'Es liegt im Archiv. Die Daten bleiben erhalten - abgeschlossen heißt nicht gelöscht.', en: 'It is in the archive. The data is kept - wrapped up does not mean deleted.', fr: 'Il est archivé. Les données sont conservées - clôturé ne veut pas dire supprimé.' },
  wiederOeffnen:      { de: 'Wieder öffnen', en: 'Reopen', fr: 'Rouvrir' },
  einleitung:         { de: 'Ein Dreh ist irgendwann vorbei, ein Projekt damit nicht. Was danach kommt, vergisst man zuverlässig - diese Liste zählt es zusammen. Sie erledigt nichts von selbst.', en: 'A shoot ends at some point, but the project does not end with it. What comes afterwards is reliably forgotten - this list adds it all up. It does not take care of anything by itself.', fr: "Un tournage finit un jour, mais le projet ne s'arrête pas là. Ce qui vient après, on l'oublie à coup sûr - cette liste le récapitule. Elle ne règle rien d'elle-même." },
  nichtsOffen:        { de: 'Nichts Offenes gefunden', en: 'Nothing outstanding found', fr: 'Rien en suspens trouvé' },
  nichtsOffenText:    { de: 'Das heißt: Es spricht nichts Erkennbares dagegen - nicht, dass alles erledigt ist. Das weiß nur, wer am Projekt gearbeitet hat.', en: 'That means: nothing apparent stands in the way - not that everything is done. Only those who worked on the project know that.', fr: "Cela signifie : rien de visible ne s'y oppose - pas que tout est fait. Seuls ceux qui ont travaillé sur le projet le savent." },
  offen:              { de: 'Offen', en: 'Outstanding', fr: 'En suspens' },
  davonBlockiert:     { de: '{n} davon steht dem Abschluss entgegen', en: '{n} of them block the wrap-up', fr: "{n} d'entre eux bloquent la clôture" },
  erledigt:           { de: 'Erledigt', en: 'Done', fr: 'Terminé' },
  abschliessenKnopf:  { de: 'Projekt abschließen', en: 'Wrap up project', fr: 'Clôturer le projet' },
  aufheben:           { de: 'Was aufzuheben ist', en: 'What must be kept', fr: 'Ce qui doit être conservé' },
  nichtsGeloescht:    { de: 'Gelöscht wird hier nichts - auch nicht nach Ablauf. Wer löschen will, nutzt die Werkzeuge unter Datenschutz und entscheidet einzeln.', en: 'Nothing is deleted here - not even after the period expires. Anyone who wants to delete uses the tools under Data protection and decides case by case.', fr: "Rien n'est supprimé ici - même après expiration du délai. Qui veut supprimer utilise les outils sous Protection des données et décide au cas par cas." },
  blockEins:          { de: '{n} Punkt steht dem Abschluss entgegen. Abschließen geht trotzdem - die Punkte bleiben offen und tauchen weiter in der Sammelansicht auf.', en: '{n} item blocks the wrap-up. You can still wrap up - the items stay open and keep appearing in the overview.', fr: "{n} point bloque la clôture. La clôture reste possible - les points restent ouverts et continuent d'apparaître dans la vue d'ensemble." },
  blockMehr:          { de: '{n} Punkte stehen dem Abschluss entgegen. Abschließen geht trotzdem - die Punkte bleiben offen und tauchen weiter in der Sammelansicht auf.', en: '{n} items block the wrap-up. You can still wrap up - the items stay open and keep appearing in the overview.', fr: "{n} points bloquent la clôture. La clôture reste possible - les points restent ouverts et continuent d'apparaître dans la vue d'ensemble." },
  insArchiv:          { de: 'Das Projekt wandert ins Archiv. Die Daten bleiben erhalten, und der Abschluss lässt sich zurücknehmen.', en: 'The project moves to the archive. The data is kept, and the wrap-up can be reverted.', fr: 'Le projet passe aux archives. Les données sont conservées et la clôture peut être annulée.' },
  abbrechen:          { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  trotzdem:           { de: 'Trotzdem abschließen', en: 'Wrap up anyway', fr: 'Clôturer quand même' },
  abschliessen:       { de: 'Abschließen', en: 'Wrap up', fr: 'Clôturer' },
} satisfies Record<string, Text>
