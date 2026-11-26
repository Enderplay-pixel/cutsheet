import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte zu Zeiten je Person, Fahrdispo, Verschieben und Übersicht (Plan Kino-Ausbau, AP E7). */
export const fahrT = {
  // Zeiten je Person
  zeitenVon: { de: 'Zeiten von {name}', en: 'Times of {name}', fr: 'Horaires de {name}' },
  abholung: { de: 'Abholung', en: 'Pick-up', fr: 'Prise en charge' },
  maske: { de: 'Maske', en: 'Make-up', fr: 'Maquillage' },
  kostuem: { de: 'Kostüm', en: 'Costume', fr: 'Costume' },
  probe: { de: 'Probe', en: 'Rehearsal', fr: 'Répétition' },
  amSet: { de: 'Am Set', en: 'On set', fr: 'Sur le plateau' },
  ende: { de: 'Ende', en: 'Wrap', fr: 'Fin' },
  feldVon: { de: '{feld} von {name}', en: '{feld} of {name}', fr: '{feld} de {name}' },
  // Fahrdispo
  fahrdispo: { de: 'Fahrdispo', en: 'Transport', fr: 'Transports' },
  fahrdispoHilfe: {
    de: 'Fahrten des Tages mit Fahrzeug, Fahrer und Mitfahrenden. Stehen im PDF; jede Person sieht ihre Fahrt auf ihrer persönlichen Dispo-Seite.',
    en: 'The day’s rides with vehicle, driver and passengers. Printed in the PDF; everyone sees their ride on their personal call sheet page.',
    fr: 'Les trajets du jour avec véhicule, chauffeur et passagers. Dans le PDF ; chacun voit son trajet sur sa page personnelle.',
  },
  vorschlagen: { de: 'Aus den Abholungen vorschlagen', en: 'Suggest from pick-ups', fr: 'Proposer d’après les prises en charge' },
  vorgeschlagen: { de: '{n} Fahrten angelegt', en: '{n} rides created', fr: '{n} trajets créés' },
  neueFahrt: { de: 'Fahrt hinzufügen', en: 'Add ride', fr: 'Ajouter un trajet' },
  keineFahrten: { de: 'Noch keine Fahrten.', en: 'No rides yet.', fr: 'Pas encore de trajets.' },
  abfahrt: { de: 'Abfahrt', en: 'Departure', fr: 'Départ' },
  von: { de: 'Von', en: 'From', fr: 'De' },
  nach: { de: 'Nach', en: 'To', fr: 'À' },
  fahrzeug: { de: 'Fahrzeug', en: 'Vehicle', fr: 'Véhicule' },
  keinFahrzeug: { de: 'ohne Fahrzeug', en: 'no vehicle', fr: 'sans véhicule' },
  fahrer: { de: 'Fahrer', en: 'Driver', fr: 'Chauffeur' },
  fahrerText: { de: 'Fahrer (Name)', en: 'Driver (name)', fr: 'Chauffeur (nom)' },
  mitfahrende: { de: 'Mitfahrende', en: 'Passengers', fr: 'Passagers' },
  mitfahrendeDazu: { de: 'Person dazunehmen', en: 'Add person', fr: 'Ajouter une personne' },
  ausFahrt: { de: '{name} aus der Fahrt nehmen', en: 'Remove {name} from the ride', fr: 'Retirer {name} du trajet' },
  fahrtLoeschen: { de: 'Fahrt um {zeit} löschen', en: 'Delete ride at {zeit}', fr: 'Supprimer le trajet de {zeit}' },
  fahrtVon: { de: 'Fahrt {nr}', en: 'Ride {nr}', fr: 'Trajet {nr}' },
  // Verschieben
  vorschau: { de: 'Vorschau', en: 'Preview', fr: 'Aperçu' },
  vorschauText: {
    de: 'General Call {alt} wird {neu}, {n} Zeiten ändern sich.',
    en: 'General call {alt} becomes {neu}, {n} times change.',
    fr: 'La convocation générale {alt} devient {neu}, {n} horaires changent.',
  },
  vorschauOhneCall: { de: '{n} Zeiten ändern sich.', en: '{n} times change.', fr: '{n} horaires changent.' },
  verschieben: { de: 'Verschieben', en: 'Shift', fr: 'Décaler' },
  rueckgaengig: { de: 'Rückgängig ({n} Min)', en: 'Undo ({n} min)', fr: 'Annuler ({n} min)' },
  frueher: { de: 'früher', en: 'earlier', fr: 'plus tôt' },
  spaeter: { de: 'später', en: 'later', fr: 'plus tard' },
  // Zeitplan
  zeit: { de: 'Zeit', en: 'Time', fr: 'Heure' },
  zeitVon: { de: 'Geplanter Beginn von Szene {n}', en: 'Planned start of scene {n}', fr: 'Début prévu de la scène {n}' },
  vonHand: { de: 'von Hand', en: 'set by hand', fr: 'saisi à la main' },
  mittag: { de: 'Mittag ab {zeit}', en: 'Lunch from {zeit}', fr: 'Déjeuner à partir de {zeit}' },
  // Übersicht
  uebersicht: { de: 'Übersicht aller Dispos', en: 'All call sheets', fr: 'Toutes les feuilles de service' },
  uebersichtKurz: { de: 'Übersicht', en: 'Overview', fr: 'Vue d’ensemble' },
  spalteTag: { de: 'Tag', en: 'Day', fr: 'Jour' },
  spalteCall: { de: 'Call', en: 'Call', fr: 'Convocation' },
  spalteSchluss: { de: 'Drehschluss', en: 'Wrap', fr: 'Fin' },
  spalteSzenen: { de: 'Szenen', en: 'Scenes', fr: 'Scènes' },
  spalteVorstopp: { de: 'Vorstopp', en: 'Pre-timing', fr: 'Pré-minutage' },
  spalteStand: { de: 'Versand', en: 'Sent', fr: 'Envoi' },
  keineDispo: { de: 'keine Dispo', en: 'no call sheet', fr: 'pas de feuille' },
  stand: { de: '{v} von {n} verschickt, {b} bestätigt', en: '{v} of {n} sent, {b} confirmed', fr: '{v} sur {n} envoyées, {b} confirmées' },
  // Persönliche Dispo-Seite
  deineZeiten: { de: 'Deine Zeiten', en: 'Your times', fr: 'Tes horaires' },
  deineFahrt: { de: 'Deine Fahrt', en: 'Your ride', fr: 'Ton trajet' },
} satisfies Record<string, Text>
