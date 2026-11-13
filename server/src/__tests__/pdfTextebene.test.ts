/**
 * Beträge in PDFs müssen als Text auslesbar bleiben.
 *
 * Gemessen am 19.10.2026: Mit `font-variant-numeric: tabular-nums` bettet
 * Chromium die Ersatzziffern der Geist ohne Unicode-Zuordnung ein. Die
 * Rechnung sah richtig aus, aber pypdf las "\x00.\x00\x00\x00,\x00\x00" statt
 * 5.715,94, und pdftotext verlor den Steuerbetrag ganz. Buchhaltungsprogramme
 * lesen Beträge aus genau dieser Textebene.
 *
 * Ein echter PDF-Lauf braucht Chromium und ist hier zu schwer. Geprüft wird
 * deshalb die Ursache: Keine PDF-Vorlage schaltet Ersatzziffern ein.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const vorlagen = ['documentLayout.ts', 'rechnungLayout.ts', 'mahnungLayout.ts', 'callSheetLayout.ts']

describe('PDF-Vorlagen ohne Ersatzziffern', () => {
  for (const datei of vorlagen) {
    it(`${datei} schaltet kein tabular-nums ein`, () => {
      const quelle = fs.readFileSync(path.join(__dirname, '..', 'lib', datei), 'utf8')
      // Kommentare zählen nicht
      const ohneKommentare = quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(ohneKommentare).not.toMatch(/tabular-nums/)
      expect(ohneKommentare).not.toMatch(/['"]tnum['"]\s*(1|on)?\s*[;,}]/)
    })
  }
})

describe('Beträge brechen in PDFs nicht um', () => {
  // Gemessen am 13.11.2026: Die Listenvorlage erlaubte Umbrüche an jeder
  // Stelle, die Summe einer Kategorie stand als "60.003.500," und "00 €" auf
  // zwei Zeilen. Geprüft wird die Regel, die das verhindert.
  it('documentLayout.ts hält Zahlenzellen und Summen zusammen', () => {
    const quelle = fs.readFileSync(path.join(__dirname, '..', 'lib', 'documentLayout.ts'), 'utf8')
    const ohneKommentare = quelle.replace(/\/\*[\s\S]*?\*\//g, '')
    const regel = ohneKommentare.match(/td\.r:not\(\.sumlabel\),\s*tfoot \.sumvalue\s*\{([^}]*)\}/)
    expect(regel, 'Regel für Zahlenzellen fehlt').not.toBeNull()
    expect(regel![1]).toContain('white-space: nowrap')
    expect(regel![1]).toContain('overflow-wrap: normal')
  })

  it('Rechnung und Mahnung tun es schon', () => {
    for (const [datei, muster] of [['rechnungLayout.ts', /\.zahl\s*\{[^}]*nowrap/], ['mahnungLayout.ts', /td\.betrag[^{]*\{[^}]*nowrap/]] as const) {
      const quelle = fs.readFileSync(path.join(__dirname, '..', 'lib', datei), 'utf8')
      expect(quelle, datei).toMatch(muster)
    }
  })
})

describe('PDF-Schriften', () => {
  it('schalten Ligaturen und Ersatzziffern für alle Dokumente ab', async () => {
    const { pdfFontFaces } = await import('../lib/pdfFonts')
    expect(pdfFontFaces()).toContain('font-variant-ligatures: none')
    expect(pdfFontFaces()).toContain('font-variant-numeric: normal')
  })
})
