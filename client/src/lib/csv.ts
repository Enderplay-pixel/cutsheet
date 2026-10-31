/**
 * CSV-Dateien, die im Browser entstehen - nach denselben Regeln wie
 * `schreibeCsv` im Server (server/src/lib/tabelle.ts):
 *
 * - Semikolon als Trenner und Zeilenende CRLF: Deutsches Excel erwartet das,
 *   mit Komma landet alles in einer Spalte.
 * - Byte-Reihenfolge-Marke, sonst zeigt Excel Umlaute falsch.
 * - Ein Hochkomma vor =, +, @, Tab und Minus ohne Zahl: Sonst führt Excel einen
 *   Namen wie =HYPERLINK(…) als Formel aus.
 *
 * Vorher bauten Besetzung, Stabliste, DOOD und Musikliste ihre CSV mit Komma,
 * ohne diesen Schutz (Fund 180).
 */

function zelle(wert: unknown): string {
  const roh = wert === null || wert === undefined ? '' : String(wert)
  const text = /^[=+@\t\r]/.test(roh) || (/^-/.test(roh) && !/^-[\d.,]+$/.test(roh)) ? `'${roh}` : roh
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function csvText(kopf: unknown[], zeilen: unknown[][]): string {
  return '﻿' + [kopf, ...zeilen].map(z => z.map(zelle).join(';')).join('\r\n')
}

/** Betrag in Cent als deutsche Zahl ohne Währungszeichen, wie `cents()` im Server. */
export function betragCsv(cent: number | null | undefined): string {
  return cent === null || cent === undefined ? '' : (Number(cent) / 100).toFixed(2).replace('.', ',')
}

export function csvHerunterladen(dateiname: string, kopf: unknown[], zeilen: unknown[][]): void {
  const blob = new Blob([csvText(kopf, zeilen)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
