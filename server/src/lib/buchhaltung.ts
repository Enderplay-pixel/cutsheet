/**
 * Buchhaltungsexporte: ein einfacher und ein DATEV-Buchungsstapel.
 *
 * Zwei Formate, weil sie verschiedene Zwecke haben:
 *
 * `einfacherExport` ist eine Tabelle, die jeder Mensch und jedes
 * Tabellenprogramm lesen kann. Sie braucht keine Formatzusage und ist der
 * Weg, wenn der Steuerberater nur "schick mir die Rechnungen" sagt.
 *
 * `datevStapel` erzeugt einen Buchungsstapel im EXTF-Format, den eine
 * DATEV-Anwendung einliest. Das spart dem Steuerberater das Abtippen - aber
 * nur, wenn das Format stimmt.
 *
 * ## Was an diesem DATEV-Export geprüft gehört
 *
 * Die Feldfolge unten folgt der EXTF-Beschreibung für den Buchungsstapel.
 * Drei Angaben kann diese Software nicht wissen, und sie werden deshalb
 * verlangt statt geraten:
 *
 *  - **Beraternummer und Mandantennummer** vergibt die Kanzlei. Eine
 *    erfundene Nummer führt dazu, dass der Stapel beim falschen Mandanten
 *    landet oder abgewiesen wird.
 *  - **Sachkontenlänge** (meist 4 oder 5) und **Kontenrahmen** (SKR03 oder
 *    SKR04) bestimmen, welche Kontonummern gültig sind. Die Erlöskonten
 *    unterscheiden sich zwischen den Rahmen vollständig.
 *
 * Der Stapel wird mit **Festschreibung = 0** erzeugt. Das ist Absicht: Ein
 * nicht festgeschriebener Stapel lässt sich in DATEV ansehen, korrigieren und
 * verwerfen. Vor dem ersten echten Einsatz gehört ein Probeimport in der
 * Kanzlei - diese Datei ist nach der Beschreibung gebaut, aber nicht gegen
 * eine DATEV-Installation geprüft.
 */

/** Ein Geschäftsvorfall, wie er in den Stapel geht. */
export type Buchung = {
  /** Bruttobetrag in Cent, immer positiv. Die Richtung steckt in `sollHaben`. */
  betragCents: number
  /** 'S' für Soll, 'H' für Haben - aus Sicht des Kontos in `konto`. */
  sollHaben: 'S' | 'H'
  /** Konto, auf das gebucht wird (bei Erlösen das Debitorenkonto). */
  konto: string
  /** Gegenkonto (bei Erlösen das Erlöskonto). */
  gegenkonto: string
  /** DATEV-Steuerschlüssel, leer wenn aus dem Konto ableitbar. */
  steuerschluessel?: string
  /** Belegdatum. */
  datum: string
  /** Belegfeld 1 - die Rechnungsnummer. */
  belegfeld1: string
  /** Buchungstext, höchstens 60 Zeichen. */
  text: string
}

export type DatevKopf = {
  /** Beraternummer der Kanzlei - Pflichtangabe, kommt vom Steuerberater. */
  berater: number
  /** Mandantennummer - Pflichtangabe, kommt vom Steuerberater. */
  mandant: number
  /** Beginn des Wirtschaftsjahres, ISO-Datum. Meist der 1. Januar. */
  wjBeginn: string
  /** Länge der Sachkontonummern, meist 4 oder 5. */
  sachkontenlaenge: number
  /** Zeitraum des Stapels. */
  von: string
  bis: string
  /** Bezeichnung, erscheint in DATEV in der Stapelliste. */
  bezeichnung: string
  /** Wer exportiert hat - erscheint im Kopf. */
  exportiertVon?: string
}

/** Ein Feld für die DATEV-Datei: Text in Anführungszeichen, Zahl ohne. */
function feld(wert: string | number | null | undefined): string {
  if (wert === null || wert === undefined || wert === '') return ''
  if (typeof wert === 'number') return String(wert)
  return `"${String(wert).replace(/"/g, '""')}"`
}

/** Betrag als deutsche Dezimalzahl ohne Tausendertrennzeichen. */
export function datevBetrag(cents: number): string {
  const ganz = Math.trunc(Math.abs(cents) / 100)
  const rest = Math.abs(cents) % 100
  return `${ganz},${String(rest).padStart(2, '0')}`
}

/** Belegdatum im Stapel: Tag und Monat, vierstellig (TTMM). */
export function datevDatum(iso: string): string {
  const t = String(iso).slice(8, 10)
  const m = String(iso).slice(5, 7)
  return `${t}${m}`
}

/**
 * Der Buchungstext wird auf 60 Zeichen gekürzt.
 *
 * DATEV nimmt nicht mehr an. Gekürzt wird am Ende, weil vorne das steht,
 * worum es geht - der Auftraggeber und die Leistung.
 */
export function datevText(text: string): string {
  const sauber = String(text).replace(/[\r\n;"]/g, ' ').replace(/\s+/g, ' ').trim()
  return sauber.length <= 60 ? sauber : sauber.slice(0, 60).trimEnd()
}

/**
 * Baut den Buchungsstapel.
 *
 * Zeile 1 ist der Kopf, Zeile 2 die Spaltennamen, danach die Buchungen. Die
 * Trennung ist das Semikolon, die Kodierung Windows-1252 - das macht nicht
 * diese Funktion, sondern wer die Datei schreibt (`datevKodieren`).
 */
export function datevStapel(kopf: DatevKopf, buchungen: Buchung[]): string {
  const jetzt = new Date()
  const zeitstempel =
    `${jetzt.getFullYear()}${String(jetzt.getMonth() + 1).padStart(2, '0')}` +
    `${String(jetzt.getDate()).padStart(2, '0')}${String(jetzt.getHours()).padStart(2, '0')}` +
    `${String(jetzt.getMinutes()).padStart(2, '0')}${String(jetzt.getSeconds()).padStart(2, '0')}000`

  const alsZahl = (iso: string) => Number(String(iso).slice(0, 10).replace(/-/g, ''))

  // Der Kopf hat 31 Felder in fester Reihenfolge. Leere Felder bleiben leer,
  // werden aber nicht weggelassen - die Position zählt.
  const kopfzeile = [
    feld('EXTF'),            // 1  Kennzeichen
    700,                     // 2  Versionsnummer
    21,                      // 3  Formatkategorie: Buchungsstapel
    feld('Buchungsstapel'),  // 4  Formatname
    13,                      // 5  Formatversion
    zeitstempel,             // 6  Erzeugt am
    '',                      // 7  Importiert (bleibt leer)
    feld('RE'),              // 8  Herkunft
    feld(kopf.exportiertVon || 'CutSheet'), // 9 Exportiert von
    '',                      // 10 Importiert von (bleibt leer)
    kopf.berater,            // 11 Beraternummer
    kopf.mandant,            // 12 Mandantennummer
    alsZahl(kopf.wjBeginn),  // 13 Wirtschaftsjahresbeginn
    kopf.sachkontenlaenge,   // 14 Sachkontenlänge
    alsZahl(kopf.von),       // 15 Datum von
    alsZahl(kopf.bis),       // 16 Datum bis
    feld(kopf.bezeichnung),  // 17 Bezeichnung
    '',                      // 18 Diktatkürzel
    1,                       // 19 Buchungstyp: Finanzbuchführung
    '',                      // 20 Rechnungslegungszweck
    0,                       // 21 Festschreibung: nein - siehe Kopfkommentar
    feld('EUR'),             // 22 Währungskennzeichen
    '', '', '', '', '', '', '', '', '',  // 23-31 reserviert
  ].join(';')

  // Die Spaltennamen der ersten 14 Felder. Mehr werden nicht gefüllt, und
  // DATEV verlangt nicht mehr - was fehlt, wird als leer gelesen.
  const spalten = [
    'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Kurs',
    'Basis-Umsatz', 'WKZ Basis-Umsatz', 'Konto', 'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext',
  ].map(feld).join(';')

  const zeilen = buchungen.map((b) =>
    [
      datevBetrag(b.betragCents),        // Umsatz
      feld(b.sollHaben),                 // Soll/Haben
      feld('EUR'),                       // WKZ
      '', '', '',                        // Kurs, Basis-Umsatz, WKZ Basis
      feld(b.konto),                     // Konto
      feld(b.gegenkonto),                // Gegenkonto
      feld(b.steuerschluessel || ''),    // BU-Schlüssel
      datevDatum(b.datum),               // Belegdatum TTMM
      feld(b.belegfeld1),                // Rechnungsnummer
      '',                                // Belegfeld 2
      '',                                // Skonto
      feld(datevText(b.text)),           // Buchungstext
    ].join(';')
  )

  return [kopfzeile, spalten, ...zeilen].join('\r\n') + '\r\n'
}

/**
 * Die Datei als Windows-1252.
 *
 * DATEV liest den Buchungsstapel in dieser Kodierung. Wer UTF-8 liefert,
 * bekommt aus "Müller" ein "MÃ¼ller" - und das steht dann so in der
 * Buchhaltung. Zeichen, die es in Windows-1252 nicht gibt, werden ersetzt,
 * statt die Datei scheitern zu lassen.
 */
export function datevKodieren(inhalt: string): Buffer {
  const ersatz: Record<string, string> = {
    '€': '\u0080', '‚': '\u0082', '„': '\u0084', '…': '\u0085',
    '‘': '\u0091', '’': '\u0092', '“': '\u0093', '”': '\u0094', '–': '\u0096', '—': '\u0097',
  }
  const vorbereitet = inhalt.replace(/[€‚„…‘’“”–—]/g, (z) => ersatz[z] ?? z)
  const bytes: number[] = []
  for (const zeichen of vorbereitet) {
    const code = zeichen.codePointAt(0)!
    if (code <= 0xff) bytes.push(code)
    // Was Windows-1252 nicht kennt, wird ein Fragezeichen. Besser ein
    // sichtbares Fragezeichen in einem Buchungstext als eine Datei, die
    // niemand einlesen kann.
    else bytes.push(0x3f)
  }
  return Buffer.from(bytes)
}

/**
 * Standard-Erlöskonten nach Kontenrahmen.
 *
 * Nur die beiden Sätze, die in Deutschland üblich sind. Wer andere Konten
 * nutzt, trägt sie in den Firmeneinstellungen ein - diese Werte sind der
 * Ausgangspunkt, nicht das Gesetz.
 */
export const ERLOESKONTEN = {
  SKR03: { regel19: '8400', ermaessigt7: '8300', frei: '8120', kleinunternehmer: '8200' },
  SKR04: { regel19: '4400', ermaessigt7: '4300', frei: '4125', kleinunternehmer: '4200' },
} as const

export type Kontenrahmen = keyof typeof ERLOESKONTEN

/**
 * Welches Erlöskonto zu einer Position gehört.
 *
 * Entscheidend ist der Steuersatz, nicht die Art der Leistung: Eine
 * Filmproduktion kann 19 Prozent, 7 Prozent (bei Einräumung urheberrechtlicher
 * Nutzungsrechte) oder gar keine Umsatzsteuer ausweisen.
 */
export function erloeskonto(rahmen: Kontenrahmen, steuerprozent: number, steuerart: string): string {
  const konten = ERLOESKONTEN[rahmen]
  if (steuerart === 'klein') return konten.kleinunternehmer
  if (steuerart === 'frei' || steuerprozent === 0) return konten.frei
  if (steuerprozent === 7) return konten.ermaessigt7
  return konten.regel19
}
