import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorSponsorenT = {
  titel:          { de: 'Sponsoren & Integrationen', en: 'Sponsors & integrations', fr: 'Sponsors et intégrations' },
  untertitel:     { de: 'Bezahlte Platzierungen, Honorare, Fristen und Kennzeichnung', en: 'Paid placements, fees, deadlines and disclosure', fr: 'Placements rémunérés, cachets, échéances et mention publicitaire' },
  integrationen:  { de: 'Integrationen', en: 'Integrations', fr: 'Intégrations' },
  honorarGesamt:  { de: 'Honorar gesamt', en: 'Total fees', fr: 'Cachets au total' },
  nochOffen:      { de: 'Noch offen', en: 'Outstanding', fr: 'Encore ouvert' },
  nochOffenHinweis: { de: 'Videos noch nicht veröffentlicht', en: 'videos not yet published', fr: 'vidéos pas encore publiées' },
  fristUeber:     { de: 'Frist überschritten', en: 'Deadline missed', fr: 'Échéance dépassée' },
  eineOhne:       { de: 'Eine Integration ohne Kennzeichnung', en: 'One integration without disclosure', fr: 'Une intégration sans mention publicitaire' },
  mehrereOhne:    { de: '{n} Integrationen ohne Kennzeichnung', en: '{n} integrations without disclosure', fr: '{n} intégrations sans mention publicitaire' },
  warnText:       { de: 'Bezahlte Platzierungen müssen als Werbung erkennbar sein. Fehlt der Hinweis, ist es Schleichwerbung - das ist kein Formfehler, sondern abmahnfähig.', en: 'Paid placements must be recognisable as advertising. Without the notice it is covert advertising - not a formality, but grounds for a formal legal warning (Abmahnung).', fr: "Les placements rémunérés doivent être identifiables comme publicité. Sans mention, c'est de la publicité clandestine - ce n'est pas un vice de forme, mais un motif de mise en demeure (Abmahnung)." },
  leerTitel:      { de: 'Keine Integrationen erfasst', en: 'No integrations recorded', fr: 'Aucune intégration enregistrée' },
  leerText:       { de: 'Sobald bei einem Video eine Marke eingetragen ist, erscheint sie hier - mit Honorar, Leistungen, Frist und der Prüfung, ob gekennzeichnet wurde.', en: 'As soon as a brand is entered on a video, it appears here - with fee, deliverables, deadline and a check whether it was disclosed.', fr: "Dès qu'une marque est saisie pour une vidéo, elle apparaît ici - avec le cachet, les prestations, l'échéance et la vérification de la mention publicitaire." },
  spalteMarke:    { de: 'Marke', en: 'Brand', fr: 'Marque' },
  spalteVideo:    { de: 'Video', en: 'Video', fr: 'Vidéo' },
  spalteLeist:    { de: 'Leistungen', en: 'Deliverables', fr: 'Prestations' },
  spalteHonorar:  { de: 'Honorar', en: 'Fee', fr: 'Cachet' },
  spalteFrist:    { de: 'Frist', en: 'Deadline', fr: 'Échéance' },
  spalteKennz:    { de: 'Kennzeichnung', en: 'Disclosure', fr: 'Mention' },
  ueberschritten: { de: 'überschritten', en: 'overdue', fr: 'dépassée' },
  gekennzeichnet: { de: 'gekennzeichnet', en: 'disclosed', fr: 'mentionnée' },
  fehlt:          { de: 'fehlt', en: 'missing', fr: 'manquante' },
} satisfies Record<string, Text>
