import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const moodboardT = {
  // Notizfarben
  amber:            { de: 'Amber', en: 'Amber', fr: 'Ambre' },
  blau:             { de: 'Blau', en: 'Blue', fr: 'Bleu' },
  gruen:            { de: 'Grün', en: 'Green', fr: 'Vert' },
  lila:             { de: 'Lila', en: 'Purple', fr: 'Violet' },
  rot:              { de: 'Rot', en: 'Red', fr: 'Rouge' },

  leereNotiz:       { de: 'Leere Notiz…', en: 'Empty note…', fr: 'Note vide…' },
  fehlerHinzufuegen:{ de: 'Fehler beim Hinzufügen', en: 'Error while adding', fr: "Erreur lors de l'ajout" },
  fehlerLoeschen:   { de: 'Fehler beim Löschen', en: 'Error while deleting', fr: 'Erreur lors de la suppression' },
  hinzufuegen:      { de: 'Hinzufügen', en: 'Add', fr: 'Ajouter' },
  bildUrl:          { de: 'Bild URL', en: 'Image URL', fr: 'Image URL' },
  bildDatei:        { de: 'Bild Datei', en: 'Image file', fr: 'Fichier image' },
  notiz:            { de: 'Notiz', en: 'Note', fr: 'Note' },
  farbe:            { de: 'Farbe', en: 'Colour', fr: 'Couleur' },
  bildViaUrl:       { de: 'Bild via URL', en: 'Image via URL', fr: 'Image par URL' },
  bildHochladen:    { de: 'Bild hochladen', en: 'Upload image', fr: 'Importer une image' },
  ansichtZurueck:   { de: 'Ansicht zurücksetzen', en: 'Reset view', fr: 'Réinitialiser la vue' },
  titelPh:          { de: 'Titel…', en: 'Title…', fr: 'Titre…' },
  dateiGewaehlt:    { de: 'Datei ausgewählt ✓', en: 'File selected ✓', fr: 'Fichier sélectionné ✓' },
  klickenAuswaehlen:{ de: 'Klicken zum Auswählen', en: 'Click to choose', fr: 'Cliquer pour choisir' },
  notizinhaltPh:    { de: 'Notizinhalt…', en: 'Note content…', fr: 'Contenu de la note…' },
  abbrechen:        { de: 'Abbrechen', en: 'Cancel', fr: 'Annuler' },
  titel:            { de: 'Moodboard', en: 'Mood board', fr: "Planche d'ambiance" },
  dragHinweis:      { de: 'Drag zum Verschieben', en: 'Drag to move', fr: 'Glisser pour déplacer' },
  laedt:            { de: 'Lädt…', en: 'Loading…', fr: 'Chargement…' },
  leer:             { de: 'Board ist leer', en: 'Board is empty', fr: 'La planche est vide' },
  leerHinweis:      { de: 'Füge Bilder, Notizen und Farben hinzu', en: 'Add images, notes and colours', fr: 'Ajoute des images, des notes et des couleurs' },
  rollenOben:       { de: 'Nach oben rollen', en: 'Scroll up', fr: 'Défiler vers le haut' },
  rollenUnten:      { de: 'Nach unten rollen', en: 'Scroll down', fr: 'Défiler vers le bas' },
  rollenLinks:      { de: 'Nach links rollen', en: 'Scroll left', fr: 'Défiler vers la gauche' },
  rollenRechts:     { de: 'Nach rechts rollen', en: 'Scroll right', fr: 'Défiler vers la droite' },
} satisfies Record<string, Text>
