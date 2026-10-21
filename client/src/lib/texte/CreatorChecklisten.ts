import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorChecklistenT = {
  titel:          { de: 'Upload-Checklisten', en: 'Upload checklists', fr: "Checklists d'upload" },
  untertitel:     { de: 'Was vor dem Hochladen noch offen ist - für jedes Video', en: 'What is still open before uploading - for every video', fr: "Ce qui reste à faire avant la mise en ligne - pour chaque vidéo" },
  videos:         { de: 'Videos', en: 'Videos', fr: 'Vidéos' },
  bereit:         { de: 'Bereit zum Upload', en: 'Ready to upload', fr: 'Prêtes pour la mise en ligne' },
  ohneCheckliste: { de: 'Ohne Checkliste', en: 'Without checklist', fr: 'Sans checklist' },
  leerTitel:      { de: 'Noch keine Videos', en: 'No videos yet', fr: 'Pas encore de vidéos' },
  leerText:       { de: 'Jedes Video bekommt eine eigene Upload-Checkliste. Diese Seite zeigt über den ganzen Kanal, was noch fehlt.', en: 'Every video gets its own upload checklist. This page shows what is still missing across the whole channel.', fr: "Chaque vidéo a sa propre checklist d'upload. Cette page montre ce qui manque encore sur toute la chaîne." },
  video:          { de: 'Video', en: 'Video', fr: 'Vidéo' },
  status:         { de: 'Status', en: 'Status', fr: 'Statut' },
  fortschritt:    { de: 'Fortschritt', en: 'Progress', fr: 'Avancement' },
  erledigt:       { de: 'Erledigt', en: 'Done', fr: 'Fait' },
  nochOffen:      { de: 'Noch offen', en: 'Still open', fr: 'Reste à faire' },
  keineCheckliste:{ de: 'keine Checkliste', en: 'no checklist', fr: 'pas de checklist' },
  allesErledigt:  { de: 'alles erledigt', en: 'all done', fr: 'tout est fait' },
} satisfies Record<string, Text>
