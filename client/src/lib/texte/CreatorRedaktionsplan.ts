import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorRedaktionsplanT = {
  titel:               { de: 'Redaktionsplan', en: 'Content calendar', fr: 'Calendrier éditorial' },
  untertitel:          { de: 'Was wann rausgeht - über alle Videos des Kanals', en: "What goes out when - across all of the channel's videos", fr: 'Ce qui sort et quand - pour toutes les vidéos de la chaîne' },
  imPlan:              { de: 'Im Plan', en: 'In the calendar', fr: 'Au calendrier' },
  ueberfaellig:        { de: 'Überfällig', en: 'Overdue', fr: 'En retard' },
  ueberfaelligHinweis: { de: 'geplantes Datum vorbei, noch nicht draußen', en: 'planned date has passed, not out yet', fr: 'date prévue dépassée, pas encore publiée' },
  ohneDatum:           { de: 'Ohne Datum', en: 'No date', fr: 'Sans date' },
  ohneDatumHinweis:    { de: 'taucht im Plan nicht auf', en: 'does not appear in the calendar', fr: "n'apparaît pas dans le calendrier" },
  nichtsTerminiert:    { de: 'Noch nichts terminiert', en: 'Nothing scheduled yet', fr: "Rien de programmé pour l'instant" },
  nichtsTerminiertText: {
    de: 'Sobald ein Video ein Veröffentlichungsdatum hat, erscheint es hier - nach Monat sortiert, mit allem was überfällig ist.',
    en: 'As soon as a video has a release date, it appears here - sorted by month, with everything that is overdue.',
    fr: "Dès qu'une vidéo a une date de publication, elle apparaît ici - triée par mois, avec tout ce qui est en retard.",
  },
  datum:     { de: 'Datum', en: 'Date', fr: 'Date' },
  video:     { de: 'Video', en: 'Video', fr: 'Vidéo' },
  serie:     { de: 'Serie', en: 'Series', fr: 'Série' },
  plattform: { de: 'Plattform', en: 'Platform', fr: 'Plateforme' },
  status:    { de: 'Status', en: 'Status', fr: 'Statut' },
  markeVeroeffentlicht: { de: 'veröffentlicht', en: 'published', fr: 'publiée' },
  markeUeberfaellig:    { de: 'überfällig', en: 'overdue', fr: 'en retard' },
  markeGeplant:         { de: 'geplant', en: 'scheduled', fr: 'prévue' },
} satisfies Record<string, Text>
