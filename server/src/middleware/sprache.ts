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
  [/^Zahl außerhalb des zulässigen Bereichs \(höchstens ([\d.]+)\): (.*)$/s,
    { en: 'Number out of range (at most $1): $2', fr: 'Nombre hors limites (au maximum $1) : $2' }],
  [/^Zu viele Fehlversuche\. Bitte (\d+) Sekunden warten\.$/,
    { en: 'Too many failed attempts. Please wait $1 seconds.', fr: 'Trop de tentatives échouées. Veuillez patienter $1 secondes.' }],
  [/^(.+): zu viele Anfragen\. Bitte (\d+) Sekunden warten\.$/,
    { en: '$1: too many requests. Please wait $2 seconds.', fr: '$1 : trop de requêtes. Veuillez patienter $2 secondes.' }],
  [/^Validierungsfehler: (.*)$/s, { en: 'Validation error: $1', fr: 'Erreur de validation : $1' }],
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
