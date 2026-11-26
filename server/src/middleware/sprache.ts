/**
 * Fehlermeldungen in der Sprache der Oberfläche.
 *
 * Die Routen formulieren ihre Meldungen auf Deutsch. Der Client schickt seine
 * Sprache im Kopf `X-Sprache` mit; steht dort `en` oder `fr`, wird `error` in
 * der Antwort anhand von `MELDUNGEN` übersetzt. Ohne Eintrag bleibt der
 * deutsche Satz - lieber eine deutsche Meldung als keine.
 *
 * Meldungen mit eingesetzten Werten (Template-Strings) laufen über MUSTER:
 * Der deutsche Satz wird erkannt, die Werte bleiben, der Rahmen wird
 * übersetzt. Eingesetzte Fremdtexte (etwa die Meldung von Chromium) bleiben,
 * wie sie sind.
 */
import { Request, Response, NextFunction } from 'express'
import { MELDUNGEN } from '../lib/meldungenText'

type Sprache = 'en' | 'fr'

/** Rahmen der Meldungen mit Werten, Platzhalter $1, $2 ... aus der Gruppe. */
const MUSTER: Array<[RegExp, Record<Sprache, string>]> = [
  [/^PDF-Fehler: (.*)$/s, { en: 'PDF error: $1', fr: 'Erreur PDF : $1' }],
  [/^(\d+) Punkte? (?:steht|stehen) dem Abschluss entgegen\. Zum Abschließen trotzdem bestätigen\.$/,
    { en: '$1 open item(s) block the wrap-up. Confirm to wrap up anyway.', fr: '$1 point(s) bloquent la clôture. Confirmez pour clôturer quand même.' }],
  [/^Für den DATEV-Export fehlt noch: (.*)$/s, { en: 'Still missing for the DATEV export: $1', fr: "Il manque encore pour l'export DATEV : $1" }],
  [/^Keine Datei empfangen\. Erlaubt sind Bilder und PDF bis (.+)\.$/,
    { en: 'No file received. Images and PDF up to $1 are allowed.', fr: "Aucun fichier reçu. Images et PDF jusqu'à $1 autorisés." }],
  [/^Dieses Projekt hat in der letzten Stunde schon (\d+) Mails ausgelöst\. Grenze: (\d+)\.$/,
    { en: 'This project has already sent $1 emails in the last hour. Limit: $2.', fr: 'Ce projet a déjà envoyé $1 e-mails au cours de la dernière heure. Limite : $2.' }],
  [/^Die Liste wurde nicht übernommen: (.*)$/s, { en: 'The list was not imported: $1', fr: "La liste n'a pas été importée : $1" }],
  [/^Ungültige Kennung "(.*)" für (.+)\.$/, { en: 'Invalid ID "$1" for $2.', fr: 'Identifiant "$1" invalide pour $2.' }],
  [/^Im Vertrag fehlen noch Angaben: (.*)\. Ergänzen und "Neu füllen" oder ausdrücklich trotzdem senden\.$/s,
    { en: 'The contract is still missing: $1. Complete it and "Refill", or explicitly send anyway.', fr: 'Il manque encore dans le contrat : $1. Complétez puis « Remplir à nouveau », ou envoyez quand même explicitement.' }],
  // Board des Stäbchenplans (AP A2, 14.11.2026)
  [/^Im Weg steht (.*)\. Abgedrehte Tage und Tage mit verschickter Dispo werden nie verschoben\.$/s,
    { en: 'In the way: $1. Days already shot and days with a sent call sheet are never moved.', fr: 'Bloque le passage : $1. Les jours déjà tournés et ceux dont la feuille de service est envoyée ne sont jamais déplacés.' }],
  [/^Der (.+) ist schon Drehtag (\d+)\. Die Folgetage um einen Arbeitstag verschieben\?$/,
    { en: '$1 is already shoot day $2. Move the following days by one working day?', fr: 'Le $1 est déjà le jour de tournage $2. Décaler les jours suivants d’un jour ouvré ?' }],
  [/^Drehtag (\d+) hat eine Dispo, einen Tagesbericht oder Check-ins - beim Zusammenlegen werden sie mit gelöscht\.$/,
    { en: 'Shoot day $1 has a call sheet, a daily report or check-ins - merging deletes them too.', fr: 'Le jour de tournage $1 a une feuille de service, un rapport ou des arrivées - la fusion les supprime aussi.' }],
  [/^Betrag zu groß \(höchstens ([^)]+)\): (.*)$/s,
    { en: 'Amount too large (at most $1): $2', fr: 'Montant trop élevé (au maximum $1) : $2' }],
  [/^Zahl außerhalb des zulässigen Bereichs \(höchstens ([\d.]+)\): (.*)$/s,
    { en: 'Number out of range (at most $1): $2', fr: 'Nombre hors limites (au maximum $1) : $2' }],
  [/^Zu viele Fehlversuche\. Bitte (\d+) Sekunden warten\.$/,
    { en: 'Too many failed attempts. Please wait $1 seconds.', fr: 'Trop de tentatives échouées. Veuillez patienter $1 secondes.' }],
  [/^(.+): zu viele Anfragen\. Bitte (\d+) Sekunden warten\.$/,
    { en: '$1: too many requests. Please wait $2 seconds.', fr: '$1 : trop de requêtes. Veuillez patienter $2 secondes.' }],
  [/^Validierungsfehler: (.*)$/s, { en: 'Validation error: $1', fr: 'Erreur de validation : $1' }],
  [/^Einchecken geht erst am Drehtag \((.+)\)$/,
    { en: 'Check-in opens on the shoot day ($1)', fr: 'L’enregistrement ouvre le jour du tournage ($1)' }],
  // Komparserie als Gruppen (AP C1)
  [/^Abgerufen sind (\d+) - eingecheckt werden 0 bis (\d+)$/,
    { en: '$1 are called - check in 0 to $2', fr: '$1 convoqués - enregistrer de 0 à $2' }],
  [/^Die Gruppe hat (\d+) Köpfe - (\d+) lassen sich nicht abrufen$/,
    { en: 'The group has $1 heads - $2 cannot be called', fr: 'Le groupe compte $1 personnes - impossible d’en convoquer $2' }],
  [/^An einem Drehtag sind (\d+) Köpfe abgerufen - die Gruppe braucht mindestens so viele$/,
    { en: '$1 heads are called on a shoot day - the group needs at least as many', fr: '$1 personnes sont convoquées un jour de tournage - le groupe en a besoin d’au moins autant' }],
  // Szene teilen (AP E6)
  [/^Der neue Teil hat mehr als 0 und weniger als (\d+) Achtel$/,
    { en: 'The new part has more than 0 and fewer than $1 eighths', fr: 'La nouvelle partie compte plus de 0 et moins de $1 huitièmes' }],
  // Units und parallele Drehtage (AP C2)
  [/^Eine Unit „(.+)" gibt es schon$/,
    { en: 'A unit "$1" already exists', fr: 'Une unité « $1 » existe déjà' }],
  [/^Die Unit hat (\d+) \S+ - beim Löschen wandern sie zur Haupteinheit\.$/,
    { en: 'The unit has $1 shoot day(s) - deleting moves them to the main unit.', fr: 'L’unité a $1 jour(s) de tournage - la suppression les déplace vers l’unité principale.' }],
  // Regionaleffekt (AP E3)
  [/^Die Anteile ergeben zusammen ([\d,]+) % - höchstens 100 %$/,
    { en: 'The shares add up to $1 % - at most 100 %', fr: 'Les parts totalisent $1 % - au plus 100 %' }],
  [/^Das Projekt hat schon (\d+) Szenen\. Der Import würde (\d+) weitere anhängen\.$/,
    { en: 'The project already has $1 scenes. The import would add $2 more.', fr: 'Le projet a déjà $1 scènes. L’import en ajouterait $2 de plus.' }],
]

/** Übersetzt eine Meldung oder gibt sie unverändert zurück. */
export function uebersetzeMeldung(text: string, sprache: Sprache): string {
  const fest = MELDUNGEN[text]?.[sprache]
  if (fest) return fest
  for (const [muster, rahmen] of MUSTER) {
    const treffer = muster.exec(text)
    if (treffer) return rahmen[sprache].replace(/\$(\d)/g, (_, n) => treffer[Number(n)] ?? '')
  }
  return text
}

export function meldungenUebersetzen(req: Request, res: Response, next: NextFunction) {
  const sprache = String(req.get('x-sprache') || '').toLowerCase().slice(0, 2)
  if (sprache !== 'en' && sprache !== 'fr') return next()

  const json = res.json.bind(res)
  res.json = ((body: any) => {
    if (body && typeof body === 'object' && typeof body.error === 'string') {
      const uebersetzt = uebersetzeMeldung(body.error, sprache)
      if (uebersetzt !== body.error) return json({ ...body, error: uebersetzt })
    }
    return json(body)
  }) as Response['json']
  next()
}
