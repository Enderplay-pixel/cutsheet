import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const musiklisteT = {
  // Beschriftungen der Lizenzarten (der Wert selbst geht so an den Server)
  typOriginal:      { de: 'Original', en: 'Original', fr: 'Original' },
  typLizenz:        { de: 'Lizenz', en: 'Licence', fr: 'Licence' },
  typGemeinfrei:    { de: 'Gemeinfreiheit', en: 'Public domain', fr: 'Domaine public' },
  typGemaFrei:      { de: 'GEMA-frei', en: 'GEMA-free', fr: 'Libre de GEMA' },
  typEigen:         { de: 'Eigenkomposition', en: 'Own composition', fr: 'Composition originale' },
  // Beschriftungen der Verwendungsarten
  nutzUnterlegt:    { de: 'Unterlegt', en: 'Underscore', fr: 'Musique de fond' },
  nutzQuelle:       { de: 'Quelle', en: 'Source', fr: 'Source' },
  nutzThema:        { de: 'Thema', en: 'Theme', fr: 'Thème' },
  nutzJingle:       { de: 'Jingle', en: 'Jingle', fr: 'Jingle' },

  aktualisiert:     { de: 'Musikcue aktualisiert', en: 'Music cue updated', fr: 'Cue musical mis à jour' },
  hinzugefuegt:     { de: 'Musikcue hinzugefügt', en: 'Music cue added', fr: 'Cue musical ajouté' },
  geloescht:        { de: 'Musikcue gelöscht', en: 'Music cue deleted', fr: 'Cue musical supprimé' },
  fehlerSpeichern:  { de: 'Fehler beim Speichern', en: 'Error while saving', fr: "Erreur lors de l'enregistrement" },
  fehlerLoeschen:   { de: 'Fehler beim Löschen', en: 'Error while deleting', fr: 'Erreur lors de la suppression' },
  titel:            { de: 'Titel', en: 'Title', fr: 'Titre' },
  komponist:        { de: 'Komponist', en: 'Composer', fr: 'Compositeur' },
  verlag:           { de: 'Verlag', en: 'Publisher', fr: 'Éditeur' },
  textdichter:      { de: 'Textdichter', en: 'Lyricist', fr: 'Parolier' },
  mmss:             { de: 'MM:SS', en: 'MM:SS', fr: 'MM:SS' },
  artDerNutzung:    { de: 'Art der Nutzung', en: 'Type of use', fr: "Type d'utilisation" },
  szeneNr:          { de: 'Szene #', en: 'Scene #', fr: 'Scène n°' },
  szeneN:           { de: 'Szene {n}', en: 'Scene {n}', fr: 'Scène {n}' },
  dauerMmss:        { de: 'Dauer (MM:SS)', en: 'Duration (MM:SS)', fr: 'Durée (MM:SS)' },
  dauer:            { de: 'Dauer', en: 'Duration', fr: 'Durée' },
  lizenzart:        { de: 'Lizenzart', en: 'Licence type', fr: 'Type de licence' },
  verwendungsart:   { de: 'Verwendungsart', en: 'Type of use', fr: "Type d'utilisation" },
  verwendung:       { de: 'Verwendung', en: 'Use', fr: 'Utilisation' },
  szene:            { de: 'Szene', en: 'Scene', fr: 'Scène' },
  seitentitel:      { de: 'Musikliste / GEMA-Cuesheet', en: 'Music list / GEMA cue sheet', fr: 'Liste musicale / cue sheet GEMA' },
  untertitel:       { de: '{n} Cues · Gesamtdauer: {dauer}', en: '{n} cues · Total duration: {dauer}', fr: '{n} cues · Durée totale : {dauer}' },
  csvExport:        { de: 'CSV-Export (GEMA)', en: 'CSV export (GEMA)', fr: 'Export CSV (GEMA)' },
  neuerCue:         { de: 'Neuer Cue', en: 'New cue', fr: 'Nouveau cue' },
  leer:             { de: 'Noch keine Musikcues erfasst', en: 'No music cues recorded yet', fr: 'Aucun cue musical saisi pour le moment' },
} satisfies Record<string, Text>
