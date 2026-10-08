/**
 * Vorlagen und Platzhalter für den Mailversand.
 *
 * Reine Funktionen ohne Datenbank: Was hier steht, lässt sich prüfen, ohne
 * eine Mail zu verschicken. Die Platzhalter sind bewusst in geschweiften
 * Doppelklammern geschrieben - sie überleben so das Kopieren aus Word und
 * kollidieren nicht mit eckigen Klammern, die in Betreffzeilen vorkommen.
 */

/** Ein Platzhalter, wie er in einer Vorlage steht. */
export type Platzhalter = {
  schluessel: string
  beschreibung: string
  beispiel: string
}

/**
 * Alle Platzhalter, die der Server füllen kann. Die Oberfläche zeigt genau
 * diese Liste - wer hier etwas ergänzt, muss es auch in `werteFuerEmpfaenger`
 * im Versand füllen, sonst steht später nichts an der Stelle.
 */
export const PLATZHALTER: Platzhalter[] = [
  { schluessel: 'projekt',       beschreibung: 'Titel des Projekts',            beispiel: 'Sprachlos' },
  { schluessel: 'name',          beschreibung: 'Name der empfangenden Person',   beispiel: 'Sarah Müller' },
  { schluessel: 'vorname',       beschreibung: 'Nur der erste Namensteil',       beispiel: 'Sarah' },
  { schluessel: 'rolle',         beschreibung: 'Funktion oder Rolle',            beispiel: 'Regie' },
  { schluessel: 'drehtag',       beschreibung: 'Nummer des Drehtags',            beispiel: '1' },
  { schluessel: 'datum',         beschreibung: 'Datum des Drehtags',             beispiel: 'Montag, 28. September' },
  { schluessel: 'call',          beschreibung: 'Persönliche Call-Zeit',          beispiel: '06:30' },
  { schluessel: 'general_call',  beschreibung: 'Allgemeine Call-Zeit',           beispiel: '06:30' },
  { schluessel: 'shooting_call', beschreibung: 'Drehbeginn',                     beispiel: '07:00' },
  { schluessel: 'motiv',         beschreibung: 'Motiv des Drehtags',             beispiel: 'Wohnküche Andi' },
  { schluessel: 'absender',      beschreibung: 'Absendername aus den Einstellungen', beispiel: 'Produktion Sprachlos' },
  { schluessel: 'link',          beschreibung: 'Persönlicher Link zur Dispo',    beispiel: 'https://…/dispo/ab12' },
]

const PLATZHALTER_MUSTER = /\{\{\s*([a-z_]+)\s*\}\}/g

/** Alle Platzhalter, die in einem Text vorkommen - ohne Doppelte, in Reihenfolge. */
export function platzhalterIn(text: string): string[] {
  const gefunden: string[] = []
  for (const treffer of text.matchAll(PLATZHALTER_MUSTER)) {
    if (!gefunden.includes(treffer[1])) gefunden.push(treffer[1])
  }
  return gefunden
}

/** Platzhalter im Text, für die es keinen Wert gibt. Grundlage der Warnung vor dem Versand. */
export function fehlendeWerte(text: string, werte: Record<string, string>): string[] {
  return platzhalterIn(text).filter((s) => {
    const wert = werte[s]
    return wert === undefined || wert === null || wert === ''
  })
}

/**
 * Setzt die Werte ein. Ein Platzhalter ohne Wert wird zu einem leeren String -
 * eine Mail mit „Hallo {{name}}" ist schlimmer als eine mit „Hallo ,".
 * Wer das verhindern will, prüft vorher mit `fehlendeWerte`.
 */
export function fuelleVorlage(text: string, werte: Record<string, string>): string {
  return text.replace(PLATZHALTER_MUSTER, (_treffer, schluessel: string) => werte[schluessel] ?? '')
}

/** HTML-Sonderzeichen entschärfen. */
export function maskiere(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Nimmt Text aus einem Textfeld und macht gültiges Mail-HTML daraus:
 * Absätze bleiben Absätze, Zeilenumbrüche bleiben Umbrüche, alles andere
 * wird maskiert. Kein Markdown - was eingetippt wurde, kommt so an.
 */
export function textZuHtml(text: string): string {
  const absaetze = text.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return absaetze
    .map((absatz) => {
      const zeilen = maskiere(absatz.trim()).split('\n').join('<br>')
      return `<p style="margin:0 0 14px;line-height:1.55;">${zeilen}</p>`
    })
    .join('\n')
}

/**
 * Entfernt aus mitgeschicktem HTML alles, was im Postfach der Empfangenden
 * Schaden anrichten kann. Die App darf keine Schleuder für fremde Skripte
 * sein, nur weil jemand im Projekt Mitglied ist.
 */
export function saeubereHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
}

/** Eine Vorlage, wie sie ohne eigenes Zutun bereitsteht. */
export type Standardvorlage = {
  schluessel: string
  name: string
  betreff: string
  text: string
}

/**
 * Die Vorlagen, die jedes neue Projekt bekommt. Der Ton ist der einer
 * Produktion, nicht der einer Software: kurz, höflich, ohne Werbesprache.
 */
export const STANDARDVORLAGEN: Standardvorlage[] = [
  {
    schluessel: 'dispo',
    name: 'Tagesdispo',
    betreff: '{{projekt}} - Dispo Drehtag {{drehtag}}, {{datum}}',
    text:
      'Hallo {{vorname}},\n\n' +
      'anbei die Disposition für Drehtag {{drehtag}} am {{datum}}.\n\n' +
      'Dein Call: {{call}}\n' +
      'Drehbeginn: {{shooting_call}}\n' +
      'Motiv: {{motiv}}\n\n' +
      'Deine Dispo im Browser: {{link}}\n\n' +
      'Bis morgen\n{{absender}}',
  },
  {
    schluessel: 'drehplan',
    name: 'Drehplan-Stand',
    betreff: '{{projekt}} - neuer Drehplan',
    text:
      'Hallo {{vorname}},\n\n' +
      'der Drehplan für {{projekt}} ist aktualisiert.\n\n' +
      'Bitte prüfe deine Drehtage und melde dich, wenn etwas nicht passt.\n\n' +
      'Viele Grüße\n{{absender}}',
  },
  {
    schluessel: 'motivbesichtigung',
    name: 'Motivbesichtigung',
    betreff: '{{projekt}} - Motivbesichtigung {{motiv}}',
    text:
      'Hallo {{vorname}},\n\n' +
      'wir sehen uns das Motiv {{motiv}} an.\n\n' +
      'Datum: {{datum}}\n' +
      'Treffpunkt: {{call}}\n\n' +
      'Kurze Rückmeldung genügt, ob du dabei bist.\n\n' +
      'Viele Grüße\n{{absender}}',
  },
  {
    schluessel: 'anfrage',
    name: 'Anfrage an Gewerk',
    betreff: '{{projekt}} - Anfrage {{rolle}}',
    text:
      'Hallo {{vorname}},\n\n' +
      'für {{projekt}} suchen wir Unterstützung im Bereich {{rolle}}.\n\n' +
      'Drehzeitraum und Konditionen bespreche ich gerne telefonisch.\n\n' +
      'Viele Grüße\n{{absender}}',
  },
  {
    schluessel: 'absage',
    name: 'Absage nach Casting',
    betreff: '{{projekt}} - Rückmeldung zum Casting',
    text:
      'Hallo {{vorname}},\n\n' +
      'danke, dass du dir die Zeit für das Casting genommen hast.\n\n' +
      'Wir haben uns für eine andere Besetzung entschieden. Das sagt nichts ' +
      'über deine Arbeit aus - die Rolle hat sich anders entwickelt als gedacht.\n\n' +
      'Wir behalten dich im Kopf.\n\n' +
      'Viele Grüße\n{{absender}}',
  },
  {
    schluessel: 'danke',
    name: 'Danke nach Drehschluss',
    betreff: '{{projekt}} - danke für den Dreh',
    text:
      'Hallo {{vorname}},\n\n' +
      'der Dreh zu {{projekt}} ist im Kasten. Danke für deine Arbeit.\n\n' +
      'Sobald es einen Schnitt zu sehen gibt, meldest du dich als Erstes.\n\n' +
      'Viele Grüße\n{{absender}}',
  },
]
