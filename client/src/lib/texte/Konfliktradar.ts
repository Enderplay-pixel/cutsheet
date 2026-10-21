import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const konfliktradarT = {
  titel:        { de: 'Konfliktradar', en: 'Conflict radar', fr: 'Radar des conflits' },
  untertitel:   { de: 'Automatische Projektprüfung · alle 30 Sek.', en: 'Automatic project check · every 30 sec.', fr: 'Vérification automatique du projet · toutes les 30 s' },
  neuPruefen:   { de: 'Neu prüfen', en: 'Check again', fr: 'Revérifier' },
  allesOk:      { de: 'Alles in Ordnung', en: 'All good', fr: 'Tout est en ordre' },
  keineKonflikte: { de: 'Keine Konflikte im Projekt gefunden.', en: 'No conflicts found in the project.', fr: 'Aucun conflit trouvé dans le projet.' },
  oeffnen:      { de: 'Öffnen', en: 'Open', fr: 'Ouvrir' },
  fehler:       { de: 'Fehler', en: 'Error', fr: 'Erreur' },
  fehlerMehr:   { de: 'Fehler', en: 'Errors', fr: 'Erreurs' },
  warnung:      { de: 'Warnung', en: 'Warning', fr: 'Avertissement' },
  warnungMehr:  { de: 'Warnungen', en: 'Warnings', fr: 'Avertissements' },
  hinweis:      { de: 'Hinweis', en: 'Note', fr: 'Remarque' },
  hinweisMehr:  { de: 'Hinweise', en: 'Notes', fr: 'Remarques' },
} satisfies Record<string, Text>
