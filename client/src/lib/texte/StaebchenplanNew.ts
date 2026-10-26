import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const staebchenT = {
  intTag: { de: 'INT / Tag', en: 'INT / Day', fr: 'INT / Jour' },
  extTag: { de: 'EXT / Tag', en: 'EXT / Day', fr: 'EXT / Jour' },
  intNacht: { de: 'INT / Nacht', en: 'INT / Night', fr: 'INT / Nuit' },
  extNacht: { de: 'EXT / Nacht', en: 'EXT / Night', fr: 'EXT / Nuit' },
  ohneTag: { de: 'Ohne Tag', en: 'No day', fr: 'Sans jour' },
  tag: { de: 'Tag {n}', en: 'Day {n}', fr: 'Jour {n}' },
  nichtVerplant: { de: 'Nicht verplant', en: 'Not scheduled', fr: 'Non planifié' },
  keineSzenen: { de: 'Keine Szenen', en: 'No scenes', fr: 'Aucune scène' },
  titel: { de: 'Stäbchenplan', en: 'Stripboard', fr: 'Tableau de bandes' },
  untertitel: {
    de: 'Visueller Drehplan - Szenenstreifen nach Drehtag',
    en: 'Visual shooting schedule - scene strips by shoot day',
    fr: 'Plan de tournage visuel - bandes de scènes par jour de tournage',
  },
  totalSzenen: { de: 'Total Szenen', en: 'Total scenes', fr: 'Total des scènes' },
  verplanteSzenen: { de: 'Verplante Szenen', en: 'Scheduled scenes', fr: 'Scènes planifiées' },
  seitenGesamt: { de: 'Seiten gesamt', en: 'Total pages', fr: 'Pages au total' },
  drehtage: { de: 'Drehtage', en: 'Shoot days', fr: 'Jours de tournage' },
  keinDrehplan: { de: 'Noch kein Drehplan vorhanden', en: 'No shooting schedule yet', fr: 'Aucun plan de tournage pour le moment' },
  keinDrehplanText: {
    de: 'Erstelle Drehtage im Drehplan, um den Stäbchenplan zu befüllen.',
    en: 'Create shoot days in the shooting schedule to fill the stripboard.',
    fr: 'Crée des jours de tournage dans le plan de tournage pour remplir le tableau de bandes.',
  },
  alleVerplant: { de: 'Alle Szenen verplant', en: 'All scenes scheduled', fr: 'Toutes les scènes sont planifiées' },
} satisfies Record<string, Text>
