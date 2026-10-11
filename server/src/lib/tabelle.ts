/**
 * CSV lesen und schreiben - für Tabellen, die wirklich aus Excel kommen.
 *
 * Die Eigenheiten, an denen fertige Pakete im deutschen Alltag scheitern:
 *
 *  - **Semikolon statt Komma.** Deutsches Excel trennt mit Semikolon, weil
 *    das Komma das Dezimaltrennzeichen ist.
 *  - **Byte-Reihenfolge-Marke.** Excel schreibt sie, und wer sie nicht
 *    abschneidet, hat sie im ersten Spaltennamen stehen - die Spalte heisst
 *    dann `﻿Name` und wird nie gefunden.
 *  - **Zeilenumbrüche in Feldern.** Eine Notiz mit Absatz ist in
 *    Anführungszeichen eingeschlossen und zerreisst jeden zeilenweisen Leser.
 *  - **Doppelte Anführungszeichen** als Maskierung für eines.
 *  - **Beträge mit Komma**, Tausenderpunkt und Währungszeichen.
 */

/** Welches Zeichen trennt? Wird aus der Kopfzeile erraten. */
export function erkenneTrenner(text: string): string {
  const erste = text.split(/\r?\n/)[0] ?? ''
  const kandidaten = [';', ',', '\t']
  let bester = ';'
  let meiste = -1
  for (const zeichen of kandidaten) {
    // Nur ausserhalb von Anführungszeichen zählen
    let anzahl = 0
    let inAnfuehrung = false
    for (let i = 0; i < erste.length; i++) {
      if (erste[i] === '"') inAnfuehrung = !inAnfuehrung
      else if (erste[i] === zeichen && !inAnfuehrung) anzahl++
    }
    if (anzahl > meiste) {
      meiste = anzahl
      bester = zeichen
    }
  }
  return meiste > 0 ? bester : ';'
}

/**
 * Zerlegt eine CSV-Datei in Zeilen aus Feldern.
 *
 * Eigener Leser statt eines Pakets: Der Zustandsautomat ist dreissig Zeilen
 * lang, und die Eigenheiten oben stehen damit an einer Stelle, die man lesen
 * kann.
 */
export function leseCsv(text: string, trenner?: string): string[][] {
  // Byte-Reihenfolge-Marke abschneiden
  const roh = text.replace(/^﻿/, '')
  const zeichen = trenner || erkenneTrenner(roh)

  const zeilen: string[][] = []
  let felder: string[] = []
  let feld = ''
  let inAnfuehrung = false

  for (let i = 0; i < roh.length; i++) {
    const c = roh[i]

    if (inAnfuehrung) {
      if (c === '"') {
        if (roh[i + 1] === '"') {
          feld += '"'
          i++
        } else {
          inAnfuehrung = false
        }
      } else {
        feld += c
      }
      continue
    }

    if (c === '"') {
      inAnfuehrung = true
    } else if (c === zeichen) {
      felder.push(feld)
      feld = ''
    } else if (c === '\n') {
      felder.push(feld)
      zeilen.push(felder)
      felder = []
      feld = ''
    } else if (c === '\r') {
      // gehört zum Umbruch, kommt gleich als \n
    } else {
      feld += c
    }
  }

  if (feld.length > 0 || felder.length > 0) {
    felder.push(feld)
    zeilen.push(felder)
  }

  // Leerzeilen am Ende fallen weg
  return zeilen.filter((z) => z.some((f) => f.trim() !== ''))
}

/**
 * Liest eine CSV-Datei als Liste von Objekten, mit der ersten Zeile als
 * Spaltennamen. Namen werden kleingeschrieben und von Leerzeichen befreit,
 * damit „Vorname " und „vorname" dasselbe treffen.
 */
export function leseTabelle(text: string): Array<Record<string, string>> {
  const zeilen = leseCsv(text)
  if (zeilen.length < 2) return []
  const kopf = zeilen[0].map((s) => s.trim().toLowerCase())
  return zeilen.slice(1).map((zeile) => {
    const eintrag: Record<string, string> = {}
    kopf.forEach((name, i) => {
      if (name) eintrag[name] = (zeile[i] ?? '').trim()
    })
    return eintrag
  })
}

/**
 * Findet den Wert zu einem Feld, egal unter welchem der üblichen Namen es
 * steht. `feldWert(zeile, ['name', 'nachname'])`.
 */
export function feldWert(zeile: Record<string, string>, namen: string[]): string {
  for (const name of namen) {
    const wert = zeile[name.toLowerCase()]
    if (wert !== undefined && wert !== '') return wert
  }
  return ''
}

/**
 * Liest einen Geldbetrag und gibt Cent zurück.
 *
 * Verträgt „1.234,56 €", „1234.56", „1 234,56" und „450". Leer ergibt null,
 * nicht 0 - eine fehlende Gage ist keine Gage von null.
 */
export function leseBetragCents(wert: string): number | null {
  const roh = String(wert ?? '').trim()
  if (!roh) return null

  // Währungszeichen, Leerzeichen und geschützte Leerzeichen weg
  let text = roh.replace(/[€$\s ]/g, '')
  if (!text) return null

  const hatKomma = text.includes(',')
  const hatPunkt = text.includes('.')
  if (hatKomma && hatPunkt) {
    // Das letzte Trennzeichen ist das Dezimaltrennzeichen
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.')
    } else {
      text = text.replace(/,/g, '')
    }
  } else if (hatKomma) {
    // Komma als Tausendertrenner nur, wenn danach genau drei Ziffern stehen
    const nachKomma = text.split(',').pop() ?? ''
    text = nachKomma.length === 3 && text.split(',').length > 2
      ? text.replace(/,/g, '')
      : text.replace(',', '.')
  }

  if (!/^-?\d*(\.\d+)?$/.test(text)) return null

  // Ganzzahlig rechnen: Der Umweg über eine Fliesskommazahl verschiebt
  // 1,005 auf 100 statt 101, weil der Wert binär knapp darunter liegt.
  const negativ = text.startsWith('-')
  const ohneVorzeichen = negativ ? text.slice(1) : text
  const [ganz, nachkomma = ''] = ohneVorzeichen.split('.')
  if (ganz === '' && nachkomma === '') return null

  const euro = ganz === '' ? 0 : Number(ganz)
  if (!Number.isFinite(euro)) return null

  const zweiStellen = (nachkomma + '00').slice(0, 2)
  const dritte = Number(nachkomma[2] ?? '0')
  let cent = euro * 100 + Number(zweiStellen)
  if (dritte >= 5) cent += 1   // kaufmännisch aufrunden

  return negativ ? -cent : cent
}

/** Schreibt Zeilen als CSV, wie deutsches Excel es erwartet. */
export function schreibeCsv(kopf: string[], zeilen: Array<Array<string | number | null>>): string {
  const feld = (wert: string | number | null) => {
    const text = wert === null || wert === undefined ? '' : String(wert)
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const inhalt = [kopf.map(feld).join(';'), ...zeilen.map((z) => z.map(feld).join(';'))].join('\r\n')
  // Byte-Reihenfolge-Marke, sonst zeigt Excel aus Umlauten Kraut an
  return '﻿' + inhalt
}

/** Betrag in Cent als deutsche Zahl ohne Währungszeichen - für CSV. */
export function cents(wert: number | null | undefined): string {
  if (wert === null || wert === undefined) return ''
  return (Number(wert) / 100).toFixed(2).replace('.', ',')
}
