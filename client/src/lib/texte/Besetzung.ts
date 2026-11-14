import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Planung je Darsteller: Haltetage und Drop für den DOOD (seit 13.11.2026). */
export const planungT = {
  titel:          { de: 'Planung (DOOD)', en: 'Scheduling (DOOD)', fr: 'Planification (DOOD)' },
  haltetage:      { de: 'Haltetage zählen', en: 'Count hold days', fr: 'Compter les jours de réserve' },
  haltetageHilfe: { de: 'Tage ohne Einsatz zwischen erstem und letztem Drehtag stehen dann als H im DOOD.', en: 'Days without work between the first and last shoot day then show as H in the DOOD.', fr: 'Les jours sans travail entre le premier et le dernier jour de tournage apparaissent alors en H dans le DOOD.' },
  haltegage:      { de: 'Haltegage je Tag (€)', en: 'Holding fee per day (€)', fr: "Cachet d'attente par jour (€)" },
  haltegageHilfe: { de: '0 heißt unbezahlt. Mit Betrag entsteht bei "Kosten übernehmen" ein eigener Posten.', en: '0 means unpaid. With an amount, "Import costs" creates its own line.', fr: '0 signifie non payé. Avec un montant, « Reprendre les coûts » crée une ligne propre.' },
  drop:           { de: 'Drop und Pickup erlaubt', en: 'Drop and pickup allowed', fr: 'Drop et pickup autorisés' },
  dropTage:       { de: 'ab wie vielen Kalendertagen Lücke', en: 'from a gap of how many calendar days', fr: 'à partir de combien de jours calendaires' },
  dropOhneHalt:   { de: 'Drop gibt es nur, wenn Haltetage gezählt werden.', en: 'Drop is only available when hold days are counted.', fr: "Le drop n'existe que si les jours de réserve sont comptés." },
  dropOhneTage:   { de: 'Für Drop und Pickup erst die Mindestzahl an Kalendertagen eintragen.', en: 'Enter the minimum number of calendar days for drop and pickup first.', fr: "Saisissez d'abord le nombre minimum de jours calendaires pour le drop et le pickup." },
  nichtGespeichert: { de: 'Nicht gespeichert', en: 'Not saved', fr: 'Non enregistré' },
} satisfies Record<string, Text>
