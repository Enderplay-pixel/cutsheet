import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/**
 * Bundesländer mit dem Kürzel, das der Server für die Feiertage erwartet
 * (`BUNDESLAENDER` in `server/src/services/holidays.ts`). Gespeichert wird das
 * Kürzel in `project_settings.state` (Plan Kino-Ausbau, AP A2).
 */
export const BUNDESLAENDER: Array<[string, Text]> = [
  ['BW', { de: 'Baden-Württemberg', en: 'Baden-Württemberg', fr: 'Bade-Wurtemberg' }],
  ['BY', { de: 'Bayern', en: 'Bavaria', fr: 'Bavière' }],
  ['BE', { de: 'Berlin', en: 'Berlin', fr: 'Berlin' }],
  ['BB', { de: 'Brandenburg', en: 'Brandenburg', fr: 'Brandebourg' }],
  ['HB', { de: 'Bremen', en: 'Bremen', fr: 'Brême' }],
  ['HH', { de: 'Hamburg', en: 'Hamburg', fr: 'Hambourg' }],
  ['HE', { de: 'Hessen', en: 'Hesse', fr: 'Hesse' }],
  ['MV', { de: 'Mecklenburg-Vorpommern', en: 'Mecklenburg-Western Pomerania', fr: 'Mecklembourg-Poméranie-Occidentale' }],
  ['NI', { de: 'Niedersachsen', en: 'Lower Saxony', fr: 'Basse-Saxe' }],
  ['NW', { de: 'Nordrhein-Westfalen', en: 'North Rhine-Westphalia', fr: 'Rhénanie-du-Nord-Westphalie' }],
  ['RP', { de: 'Rheinland-Pfalz', en: 'Rhineland-Palatinate', fr: 'Rhénanie-Palatinat' }],
  ['SL', { de: 'Saarland', en: 'Saarland', fr: 'Sarre' }],
  ['SN', { de: 'Sachsen', en: 'Saxony', fr: 'Saxe' }],
  ['ST', { de: 'Sachsen-Anhalt', en: 'Saxony-Anhalt', fr: 'Saxe-Anhalt' }],
  ['SH', { de: 'Schleswig-Holstein', en: 'Schleswig-Holstein', fr: 'Schleswig-Holstein' }],
  ['TH', { de: 'Thüringen', en: 'Thuringia', fr: 'Thuringe' }],
]
