import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const versicherungenT = {
  // Beschriftungen der Versicherungsarten (der Wert selbst geht so an den Server)
  artFilm:          { de: 'Filmversicherung', en: 'Film production insurance', fr: 'Assurance production audiovisuelle' },
  artHaftpflicht:   { de: 'Betriebshaftpflicht', en: 'Public liability insurance', fr: 'Responsabilité civile professionnelle' },
  artUnfall:        { de: 'Unfallversicherung', en: 'Accident insurance', fr: 'Assurance accidents' },
  artAusruestung:   { de: 'Ausrüstungsversicherung', en: 'Equipment insurance', fr: 'Assurance matériel' },
  artSonstiges:     { de: 'Sonstiges', en: 'Other', fr: 'Autre' },

  abgelaufen:       { de: 'Abgelaufen', en: 'Expired', fr: 'Expirée' },
  laeuftBaldAb:     { de: 'Läuft bald ab', en: 'Expires soon', fr: 'Expire bientôt' },
  aktualisiert:     { de: 'Versicherung aktualisiert', en: 'Insurance updated', fr: 'Assurance mise à jour' },
  geloescht:        { de: 'Versicherung gelöscht', en: 'Insurance deleted', fr: 'Assurance supprimée' },
  hinzugefuegt:     { de: 'Versicherung hinzugefügt', en: 'Insurance added', fr: 'Assurance ajoutée' },
  fehlerSpeichern:  { de: 'Fehler beim Speichern', en: 'Error while saving', fr: "Erreur lors de l'enregistrement" },
  fehlerLoeschen:   { de: 'Fehler beim Löschen', en: 'Error while deleting', fr: 'Erreur lors de la suppression' },
  versicherungsart: { de: 'Versicherungsart', en: 'Type of insurance', fr: "Type d'assurance" },
  gesellschaft:     { de: 'Versicherungsgesellschaft', en: 'Insurer', fr: "Compagnie d'assurance" },
  policennummer:    { de: 'Policennummer', en: 'Policy number', fr: 'Numéro de police' },
  deckungEuro:      { de: 'Deckungssumme (€)', en: 'Sum insured (€)', fr: 'Montant de couverture (€)' },
  deckung:          { de: 'Deckungssumme', en: 'Sum insured', fr: 'Montant de couverture' },
  praemieEuro:      { de: 'Prämie (€)', en: 'Premium (€)', fr: 'Prime (€)' },
  praemie:          { de: 'Prämie', en: 'Premium', fr: 'Prime' },
  beginn:           { de: 'Beginn', en: 'Start', fr: 'Début' },
  ende:             { de: 'Ende', en: 'End', fr: 'Fin' },
  laufzeit:         { de: 'Laufzeit', en: 'Term', fr: 'Durée' },
  // Beispielwerte, sprachneutral
  beispielGesell:   { de: 'Allianz, AXA…', en: 'Allianz, AXA…', fr: 'Allianz, AXA…' },
  beispielPolice:   { de: 'POL-2024-001', en: 'POL-2024-001', fr: 'POL-2024-001' },
  notizenPh:       { de: 'Besondere Konditionen, Ausschlüsse…', en: 'Special terms, exclusions…', fr: 'Conditions particulières, exclusions…' },
  titel:            { de: 'Versicherungen', en: 'Insurance', fr: 'Assurances' },
  anzahl:           { de: '{n} Versicherungen', en: '{n} policies', fr: '{n} assurances' },
  gesamtpraemie:    { de: ' · Gesamtprämie: {betrag}', en: ' · Total premium: {betrag}', fr: ' · Prime totale : {betrag}' },
  neue:             { de: 'Neue Versicherung', en: 'New insurance', fr: 'Nouvelle assurance' },
  abgelaufenEins:   { de: ' Versicherung ist abgelaufen', en: ' policy has expired', fr: ' assurance a expiré' },
  abgelaufenMehr:   { de: ' Versicherungen ist abgelaufen', en: ' policies have expired', fr: ' assurances ont expiré' },
  baldEins:         { de: ' Versicherung läuft in weniger als 30 Tagen ab', en: ' policy expires in less than 30 days', fr: ' assurance expire dans moins de 30 jours' },
  baldMehr:         { de: ' Versicherungen läuft in weniger als 30 Tagen ab', en: ' policies expire in less than 30 days', fr: ' assurances expirent dans moins de 30 jours' },
  leer:             { de: 'Noch keine Versicherungen erfasst', en: 'No insurance policies recorded yet', fr: 'Aucune assurance saisie pour le moment' },
} satisfies Record<string, Text>
