import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte für components/drehplan/ScenePool.tsx */
export const scenePoolT = {
  ablage:          { de: 'Ablage', en: 'Scene pool', fr: 'Réserve de scènes' },
  ungeplant:       { de: '{n} ungeplante Szenen', en: '{n} unscheduled scenes', fr: '{n} scènes non planifiées' },
  alleGeplant:     { de: 'Alle Szenen geplant', en: 'All scenes scheduled', fr: 'Toutes les scènes sont planifiées' },
} satisfies Record<string, Text>

/** Texte für components/drehplan/SceneStrip.tsx */
export const sceneStripT = {
  szene:           { de: 'Szene {n}: {titel}', en: 'Scene {n}: {titel}', fr: 'Scène {n} : {titel}' },
  verschieben:     { de: '{szene} verschieben', en: 'Move {szene}', fr: 'Déplacer {szene}' },
  entfernen:       { de: '{szene} aus dem Drehtag entfernen', en: 'Remove {szene} from the shoot day', fr: 'Retirer {szene} du jour de tournage' },
} satisfies Record<string, Text>

/** Texte für components/drehplan/ShootDayColumn.tsx */
export const shootDayColumnT = {
  drehtagDatum:    { de: 'Drehtag {n}: {d}', en: 'Shoot day {n}: {d}', fr: 'Jour de tournage {n} : {d}' },
  tagN:            { de: 'Tag {n}', en: 'Day {n}', fr: 'Jour {n}' },
  loeschen:        { de: 'Drehtag {n} löschen', en: 'Delete shoot day {n}', fr: 'Supprimer le jour de tournage {n}' },
  statusFuer:      { de: 'Status für Drehtag {n}', en: 'Status for shoot day {n}', fr: 'Statut du jour de tournage {n}' },
  szAbk:           { de: '{n} Sz.', en: '{n} sc.', fr: '{n} sc.' },
  ueberladen:      { de: 'Überladen! >12 Seiten', en: 'Overloaded! >12 pages', fr: 'Surchargé ! >12 pages' },
  vorsicht:        { de: 'Vorsicht: >10 Seiten', en: 'Caution: >10 pages', fr: 'Attention : >10 pages' },
  morningBriefPdf: { de: 'Morning Brief PDF', en: 'Morning brief PDF', fr: 'PDF Morning Brief' },
  morningBriefDl:  { de: 'Morning Brief für Drehtag {n} herunterladen', en: 'Download morning brief for shoot day {n}', fr: 'Télécharger le Morning Brief du jour de tournage {n}' },
  sperrtagN:       { de: 'Sperrtag {n}', en: 'Blocked day {n}', fr: 'Jour bloqué {n}' },
  szenenFuer:      { de: 'Szenen für Drehtag {n}', en: 'Scenes for shoot day {n}', fr: 'Scènes du jour de tournage {n}' },
  keineSzenen:     { de: 'Keine Szenen - Szenen hierhin ziehen', en: 'No scenes - drag scenes here', fr: 'Aucune scène - glisse des scènes ici' },
  hierhinZiehen:   { de: 'Szenen hierhin ziehen', en: 'Drag scenes here', fr: 'Glisse des scènes ici' },
  szenenAn:        { de: 'Szenen an Drehtag {n}', en: 'Scenes on shoot day {n}', fr: 'Scènes du jour de tournage {n}' },
} satisfies Record<string, Text>

/** Beschriftungen der Drehtag-Status - der Wert geht deutsch an den Server. */
export const drehtagStatusT: Record<string, Text> = {
  Geplant:     { de: 'Geplant', en: 'Planned', fr: 'Planifié' },
  Bestätigt:   { de: 'Bestätigt', en: 'Confirmed', fr: 'Confirmé' },
  Abgedreht:   { de: 'Abgedreht', en: 'Shot', fr: 'Tourné' },
  Ausgefallen: { de: 'Ausgefallen', en: 'Cancelled', fr: 'Annulé' },
  Sperrtag:    { de: 'Sperrtag', en: 'Blocked day', fr: 'Jour bloqué' },
}
