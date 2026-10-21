import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const papierkorbT = {
  titel:          { de: 'Papierkorb', en: 'Bin', fr: 'Corbeille' },
  untertitel:     { de: 'Gelöschtes bleibt {n} Tage liegen', en: 'Deleted items are kept for {n} days', fr: 'Les éléments supprimés sont conservés {n} jours' },
  zurueckgeholt:  { de: '{tabelle} zurückgeholt', en: '{tabelle} restored', fr: '{tabelle} restauré(e)' },
  wiederDa:       { de: '„{titel}" steht wieder an seinem Platz.', en: '"{titel}" is back in its place.', fr: "« {titel} » a retrouvé sa place." },
  nichtZurueck:   { de: 'Nicht zurückgeholt', en: 'Not restored', fr: 'Non restauré' },
  geloescht:      { de: 'Gelöscht', en: 'Deleted', fr: 'Supprimés' },
  zurueckholen:   { de: 'Zurückholen', en: 'Restore', fr: 'Restaurer' },
  leer:           { de: 'Nichts gelöscht. Was hier landet, lässt sich zurückholen - mit derselben Kennung, sodass Drehplan, Dispo und Zeiten wieder daran hängen.', en: 'Nothing deleted. Anything that ends up here can be restored - with the same ID, so the shooting schedule, call sheet and times are linked to it again.', fr: "Rien n'a été supprimé. Tout ce qui atterrit ici peut être restauré - avec le même identifiant, de sorte que le plan de tournage, la feuille de service et les horaires y sont de nouveau rattachés." },
} satisfies Record<string, Text>
