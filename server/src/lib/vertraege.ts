/**
 * Verträge und Einverständnisse.
 *
 * Eine Produktion scheitert selten an der Technik und oft daran, dass eine
 * Unterschrift fehlt - und niemand weiß, welche. Diese Datei hält die
 * Vorlagen, füllt sie mit den Daten aus dem Projekt und sagt, was noch fehlt.
 *
 * ## Zu den Vorlagen
 *
 * Die mitgelieferten Texte sind **Entwürfe**, keine geprüften Verträge. Sie
 * decken ab, was in einer kleinen Produktion üblicherweise geregelt wird, und
 * sie sind so geschrieben, dass man sie versteht. Was sie nicht sind: auf den
 * Einzelfall zugeschnitten oder anwaltlich geprüft. Wer eine Produktion mit
 * Sendeplatz macht, legt sie einmal einer Kanzlei vor; danach stehen sie als
 * eigene Vorlage im System und werden nie wieder angefasst.
 *
 * Der Text eines verschickten Vertrags wird **eingefroren**. Ändert jemand
 * später die Vorlage, bleibt der Vertrag derselbe - sonst könnte niemand
 * belegen, was zugestimmt wurde.
 */
/**
 * Dasselbe Muster wie bei den Mailvorlagen: {{schluessel}}.
 *
 * Eigene Kopie statt Import: Die Mailvorlagen behalten ihre Platzhalter, die
 * Vertraege ihre, und eine Aenderung an einer Seite soll die andere nicht
 * mitnehmen. Das Muster selbst ist zwei Zeilen - eine geteilte Konstante
 * waere mehr Kopplung als Ersparnis.
 */
const PLATZHALTER_MUSTER = /\{\{\s*([a-z_]+)\s*\}\}/g

export type Vertragsart =
  | 'darsteller' | 'crew' | 'komparse' | 'bildrechte' | 'einverstaendnis_kind'

export const ARTEN: Array<{ art: Vertragsart; name: string; fuer: string }> = [
  { art: 'darsteller', name: 'Darstellervertrag', fuer: 'cast' },
  { art: 'crew', name: 'Crew-Vertrag', fuer: 'crew' },
  { art: 'komparse', name: 'Komparsenvertrag', fuer: 'extra' },
  { art: 'bildrechte', name: 'Einwilligung in die Bildnisverwertung', fuer: 'alle' },
  { art: 'einverstaendnis_kind', name: 'Einverständnis der Erziehungsberechtigten', fuer: 'alle' },
]

/** Die Platzhalter, die in einem Vertrag stehen dürfen. */
export const VERTRAGS_PLATZHALTER = [
  { schluessel: 'name', beschreibung: 'Name der Person', beispiel: 'Sarah Müller' },
  { schluessel: 'rolle', beschreibung: 'Rolle oder Funktion', beispiel: 'Lena' },
  { schluessel: 'projekt', beschreibung: 'Titel der Produktion', beispiel: 'Sprachlos' },
  { schluessel: 'produktion', beschreibung: 'Name der Produktionsfirma', beispiel: 'Nordlicht Film' },
  { schluessel: 'drehzeitraum', beschreibung: 'Erster bis letzter Drehtag', beispiel: '12.11. bis 20.11.2026' },
  { schluessel: 'drehtage', beschreibung: 'Anzahl der Drehtage', beispiel: '6' },
  { schluessel: 'gage', beschreibung: 'Gage je Drehtag', beispiel: '450,00 €' },
  { schluessel: 'gage_gesamt', beschreibung: 'Gage mal Drehtage', beispiel: '2.700,00 €' },
  { schluessel: 'drehorte', beschreibung: 'Die Motive der Produktion', beispiel: 'Bochum, Essen' },
  { schluessel: 'geburtsdatum', beschreibung: 'Geburtsdatum der Person', beispiel: '10.03.2020' },
  { schluessel: 'erziehungsberechtigt', beschreibung: 'Name der erziehungsberechtigten Person', beispiel: 'Anna Müller' },
  { schluessel: 'datum', beschreibung: 'Heutiges Datum', beispiel: '12.10.2026' },
] as const

/** Welche Platzhalter in einem Text vorkommen. */
export function platzhalterIn(text: string): string[] {
  const gefunden: string[] = []
  for (const treffer of String(text).matchAll(PLATZHALTER_MUSTER)) {
    if (!gefunden.includes(treffer[1])) gefunden.push(treffer[1])
  }
  return gefunden
}

/**
 * Welche Platzhalter keinen Wert haben.
 *
 * Wird vor dem Versand geprüft: Ein Vertrag, in dem "Gage: " ohne Betrag
 * steht, ist schlimmer als gar keiner.
 */
export function fehlendeWerte(text: string, werte: Record<string, string>): string[] {
  return platzhalterIn(text).filter((s) => {
    const wert = werte[s]
    return wert === undefined || wert === null || wert === ''
  })
}

export function fuelleVorlage(text: string, werte: Record<string, string>): string {
  return String(text).replace(PLATZHALTER_MUSTER, (_t, schluessel: string) => werte[schluessel] ?? '')
}

const HINWEIS = 'Dieser Text ist eine Vorlage und keine Rechtsberatung. Vor dem ersten '
  + 'Einsatz einmal prüfen lassen.'

/**
 * Die mitgelieferten Vorlagen.
 *
 * Bewusst knapp. Ein Vertrag, den niemand liest, regelt nichts; die Punkte,
 * um die es am Set wirklich geht, sind Gage, Zeitraum, Nutzungsrechte und
 * was passiert, wenn der Dreh ausfällt.
 */
export const STANDARDVORLAGEN: Array<{ kind: Vertragsart; name: string; body: string; hinweis: string }> = [
  {
    kind: 'darsteller',
    name: 'Darstellervertrag (Entwurf)',
    hinweis: HINWEIS,
    body: `# Darstellervertrag

zwischen {{produktion}} - nachfolgend "Produktion" -
und {{name}} - nachfolgend "Darsteller:in" -

## 1. Gegenstand
Die Darsteller:in wirkt in der Produktion "{{projekt}}" in der Rolle {{rolle}} mit.

## 2. Zeitraum
Die Mitwirkung erfolgt an {{drehtage}} Drehtagen im Zeitraum {{drehzeitraum}}.
Drehorte: {{drehorte}}. Die genauen Zeiten ergeben sich aus der Tagesdisposition,
die spätestens am Vortag zugeht.

## 3. Gage
Die Gage beträgt {{gage}} je Drehtag, insgesamt {{gage_gesamt}}.
Sie ist innerhalb von 14 Tagen nach dem letzten Drehtag zur Zahlung fällig.
Reisekosten und Verpflegung trägt die Produktion.

## 4. Nutzungsrechte
Die Darsteller:in räumt der Produktion das räumlich, zeitlich und inhaltlich
unbeschränkte Recht ein, die Aufnahmen ihrer Mitwirkung im Rahmen der Produktion
"{{projekt}}" zu nutzen, zu vervielfältigen, zu verbreiten und öffentlich
zugänglich zu machen. Das Recht umfasst Auswertung in allen Medien einschließlich
Festivals, Fernsehen und Internet sowie die Verwendung von Ausschnitten zu
Zwecken der Bewerbung der Produktion.

Eine Verwendung in anderem Zusammenhang, insbesondere zu Werbezwecken Dritter,
bedarf der gesonderten Zustimmung.

## 5. Ausfall
Sagt die Produktion einen vereinbarten Drehtag später als 48 Stunden vorher ab,
wird die Tagesgage zur Hälfte geschuldet. Bei Absage aus Gründen, die die
Darsteller:in zu vertreten hat, entfällt der Anspruch für diesen Tag.

## 6. Verschwiegenheit
Über Inhalt und Verlauf der Produktion wird bis zur Veröffentlichung
Stillschweigen bewahrt.

## 7. Schlussbestimmungen
Änderungen bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt
der Vertrag im Übrigen wirksam.

{{datum}}`,
  },
  {
    kind: 'crew',
    name: 'Crew-Vertrag (Entwurf)',
    hinweis: HINWEIS,
    body: `# Vertrag über eine Mitarbeit

zwischen {{produktion}} - nachfolgend "Produktion" -
und {{name}} - nachfolgend "Mitarbeiter:in" -

## 1. Tätigkeit
Die Mitarbeiter:in übernimmt in der Produktion "{{projekt}}" die Funktion
{{rolle}}.

## 2. Zeitraum
{{drehtage}} Drehtage im Zeitraum {{drehzeitraum}}, Drehorte: {{drehorte}}.
Die Arbeitszeiten ergeben sich aus der Tagesdisposition.

## 3. Vergütung
{{gage}} je Drehtag, insgesamt {{gage_gesamt}}, fällig innerhalb von 14 Tagen
nach dem letzten Drehtag. Überstunden werden nach den vereinbarten Sätzen
abgerechnet.

## 4. Status
Die Tätigkeit erfolgt selbständig. Die Mitarbeiter:in führt Steuern und
Sozialabgaben selbst ab und versichert, nicht weisungsgebunden in den Betrieb
eingegliedert zu sein. Eine abweichende Einordnung durch Behörden bleibt
unberührt.

## 5. Arbeitsergebnisse
Alle im Rahmen der Tätigkeit entstehenden Arbeitsergebnisse und daran
bestehenden Nutzungsrechte stehen der Produktion zu, räumlich, zeitlich und
inhaltlich unbeschränkt. Die Nennung im Abspann erfolgt branchenüblich.

## 6. Eigenes Material
Bringt die Mitarbeiter:in eigenes Material ein, wird dies gesondert vereinbart.
Für Schäden an eingebrachtem Material haftet die Produktion nur bei Vorsatz und
grober Fahrlässigkeit.

## 7. Verschwiegenheit
Über Inhalt und Verlauf der Produktion wird bis zur Veröffentlichung
Stillschweigen bewahrt.

{{datum}}`,
  },
  {
    kind: 'komparse',
    name: 'Komparsenvertrag (Entwurf)',
    hinweis: HINWEIS,
    body: `# Vereinbarung über eine Komparsenrolle

zwischen {{produktion}} und {{name}}

Ich wirke am {{drehzeitraum}} als Komparse an der Produktion "{{projekt}}" mit.

**Vergütung:** {{gage}} je Drehtag, insgesamt {{gage_gesamt}}, zahlbar innerhalb
von 14 Tagen. Verpflegung stellt die Produktion.

**Nutzungsrechte:** Ich willige ein, dass die Aufnahmen meiner Mitwirkung im
Rahmen der Produktion "{{projekt}}" zeitlich, räumlich und inhaltlich
unbeschränkt genutzt, vervielfältigt, verbreitet und öffentlich zugänglich
gemacht werden, einschließlich der Bewerbung der Produktion. Ein Anspruch auf
Verwendung besteht nicht - Szenen können auch entfallen.

**Widerruf:** Die Einwilligung kann aus wichtigem Grund widerrufen werden,
solange die Produktion noch nicht veröffentlicht ist.

{{datum}}`,
  },
  {
    kind: 'bildrechte',
    name: 'Einwilligung in die Bildnisverwertung (Entwurf)',
    hinweis: HINWEIS,
    body: `# Einwilligung in die Verwertung von Bildnissen

Ich, {{name}}, willige ein, dass die im Rahmen der Produktion "{{projekt}}" von
mir angefertigten Bild- und Tonaufnahmen von {{produktion}} genutzt werden.

Die Einwilligung umfasst:
- Vervielfältigung, Verbreitung und öffentliche Zugänglichmachung der Aufnahmen
- Auswertung in allen Medien, auch im Internet und auf Festivals
- Verwendung von Ausschnitten zur Bewerbung der Produktion

Die Einwilligung gilt zeitlich und räumlich unbeschränkt für den genannten
Zweck. Eine Verwendung in einem anderen, insbesondere herabsetzenden oder
werblichen Zusammenhang ist nicht umfasst.

Mir ist bekannt, dass ich diese Einwilligung mit Wirkung für die Zukunft
widerrufen kann, soweit der Widerruf für die Produktion zumutbar ist.
Eine bereits erfolgte Veröffentlichung bleibt davon unberührt.

Diese Erklärung erfolgt freiwillig. Verweigere ich sie, entstehen mir daraus
keine Nachteile.

{{datum}}`,
  },
  {
    kind: 'einverstaendnis_kind',
    name: 'Einverständnis der Erziehungsberechtigten (Entwurf)',
    hinweis: HINWEIS + ' Die Bewilligung der Aufsichtsbehörde nach § 6 JArbSchG '
      + 'ersetzt dieses Formular nicht - sie kommt dazu.',
    body: `# Einverständnis der Erziehungsberechtigten

Kind: {{name}}, geboren am {{geburtsdatum}}
Produktion: "{{projekt}}" von {{produktion}}
Rolle: {{rolle}}
Zeitraum: {{drehzeitraum}}, Drehorte: {{drehorte}}

Ich, {{erziehungsberechtigt}}, bin erziehungsberechtigt für das oben genannte
Kind und erkläre mein Einverständnis mit seiner Mitwirkung.

Mir ist bekannt:

1. Die Mitwirkung bedarf zusätzlich der Bewilligung der zuständigen
   Aufsichtsbehörde nach § 6 des Jugendarbeitsschutzgesetzes. Ohne diese
   Bewilligung darf das Kind nicht mitwirken.

2. Für die tägliche Dauer und die Tageszeit gelten gesetzliche Grenzen. Bei
   Kindern über drei bis sechs Jahren sind es höchstens zwei Stunden täglich
   zwischen 8 und 17 Uhr, bei Kindern über sechs Jahren höchstens drei Stunden
   täglich zwischen 8 und 22 Uhr. Der Bescheid der Behörde kann engere Grenzen
   setzen; dann gelten diese.

3. Das Kind wird am Set durchgehend betreut. Ich oder eine von mir benannte
   Person kann jederzeit anwesend sein.

4. Ich kann die Mitwirkung jederzeit beenden, wenn das Wohl des Kindes es
   erfordert.

Außerdem willige ich ein, dass die Aufnahmen des Kindes im Rahmen der Produktion
"{{projekt}}" genutzt, vervielfältigt, verbreitet und öffentlich zugänglich
gemacht werden, einschließlich der Bewerbung der Produktion. Diese Einwilligung
kann ich mit Wirkung für die Zukunft widerrufen.

Vergütung: {{gage}} je Drehtag, insgesamt {{gage_gesamt}}.

{{datum}}`,
  },
]

/** Euro-Betrag aus Cent - für die Platzhalter. */
export function euroText(cents: number): string {
  return (Number(cents || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

/** Datum als 12.10.2026 - für die Platzhalter. */
export function datumText(wert: string | null | undefined): string {
  if (!wert) return ''
  const d = new Date(`${String(wert).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return String(wert)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
