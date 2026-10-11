import { describe, it, expect } from 'vitest'
import {
  leseCsv,
  leseTabelle,
  erkenneTrenner,
  feldWert,
  leseBetragCents,
  schreibeCsv,
  cents,
} from '../lib/tabelle'

/**
 * Die Testdaten sind absichtlich unangenehm: Umlaute, Semikolon, Komma im
 * Betrag, Anführungszeichen im Text, ein Zeilenumbruch mitten im Feld und
 * eine Byte-Reihenfolge-Marke am Anfang. Genau so kommen die Dateien aus
 * Excel.
 */

describe('Trennzeichen erkennen', () => {
  it('erkennt Semikolon - so schreibt deutsches Excel', () => {
    expect(erkenneTrenner('Name;Funktion;E-Mail\nSarah;Regie;s@x.de')).toBe(';')
  })

  it('erkennt Komma', () => {
    expect(erkenneTrenner('Name,Funktion,E-Mail\nSarah,Regie,s@x.de')).toBe(',')
  })

  it('erkennt Tabulator', () => {
    expect(erkenneTrenner('Name\tFunktion\nSarah\tRegie')).toBe('\t')
  })

  it('zählt keine Trennzeichen innerhalb von Anführungszeichen', () => {
    // Das Komma steckt im Feld, nicht zwischen Feldern.
    expect(erkenneTrenner('Name;Notiz\n"Müller, Sarah";Regie')).toBe(';')
  })
})

describe('CSV lesen', () => {
  it('liest eine einfache Tabelle', () => {
    expect(leseCsv('a;b;c\n1;2;3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('schneidet die Byte-Reihenfolge-Marke ab', () => {
    const zeilen = leseCsv('﻿Name;Funktion\nSarah;Regie')
    expect(zeilen[0][0]).toBe('Name')
  })

  it('verträgt Windows-Zeilenenden', () => {
    expect(leseCsv('a;b\r\n1;2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('hält ein Trennzeichen im Feld zusammen', () => {
    expect(leseCsv('Name;Rolle\n"Müller, Sarah";Regie')).toEqual([
      ['Name', 'Rolle'],
      ['Müller, Sarah', 'Regie'],
    ])
  })

  it('verträgt einen Zeilenumbruch mitten im Feld', () => {
    const text = 'Name;Notiz\nSarah;"Erste Zeile\nZweite Zeile"'
    expect(leseCsv(text)).toEqual([
      ['Name', 'Notiz'],
      ['Sarah', 'Erste Zeile\nZweite Zeile'],
    ])
  })

  it('macht aus zwei Anführungszeichen eines', () => {
    expect(leseCsv('Titel\n"Er sagte ""Hallo"""')).toEqual([['Titel'], ['Er sagte "Hallo"']])
  })

  it('wirft Leerzeilen weg', () => {
    expect(leseCsv('a;b\n\n1;2\n\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('kommt mit einer leeren Datei zurecht', () => {
    expect(leseCsv('')).toEqual([])
    expect(leseTabelle('')).toEqual([])
    expect(leseTabelle('nur;eine;Kopfzeile')).toEqual([])
  })
})

describe('Tabelle als Objekte', () => {
  it('nimmt die erste Zeile als Spaltennamen', () => {
    const zeilen = leseTabelle('Name;Funktion\nSarah Müller;Regie\nLars Weber;Aufnahmeleitung')
    expect(zeilen).toEqual([
      { name: 'Sarah Müller', funktion: 'Regie' },
      { name: 'Lars Weber', funktion: 'Aufnahmeleitung' },
    ])
  })

  it('stört sich nicht an Grossschreibung und Leerzeichen im Kopf', () => {
    const zeilen = leseTabelle('  NAME ; E-Mail \nSarah;s@x.de')
    expect(zeilen[0]).toEqual({ name: 'Sarah', 'e-mail': 's@x.de' })
  })

  it('füllt fehlende Felder am Zeilenende mit Leere', () => {
    const zeilen = leseTabelle('Name;Funktion;Telefon\nSarah;Regie')
    expect(zeilen[0]).toEqual({ name: 'Sarah', funktion: 'Regie', telefon: '' })
  })
})

describe('Felder unter mehreren Namen finden', () => {
  const zeile = { name: 'Sarah', 'e-mail': 's@x.de', tagessatz: '450' }

  it('nimmt den ersten Namen, der etwas hat', () => {
    expect(feldWert(zeile, ['nachname', 'name'])).toBe('Sarah')
    expect(feldWert(zeile, ['mail', 'e-mail', 'email'])).toBe('s@x.de')
  })

  it('gibt leer zurück, wenn keiner passt', () => {
    expect(feldWert(zeile, ['telefon', 'handy'])).toBe('')
  })
})

describe('Beträge lesen', () => {
  it('liest deutsche Schreibweise', () => {
    expect(leseBetragCents('1.234,56')).toBe(123456)
    expect(leseBetragCents('450,00')).toBe(45000)
    expect(leseBetragCents('450')).toBe(45000)
    expect(leseBetragCents('0,99')).toBe(99)
  })

  it('liest englische Schreibweise', () => {
    expect(leseBetragCents('1,234.56')).toBe(123456)
    expect(leseBetragCents('450.00')).toBe(45000)
  })

  it('wirft Währungszeichen und Leerzeichen weg', () => {
    expect(leseBetragCents('1.234,56 €')).toBe(123456)
    expect(leseBetragCents('€ 450')).toBe(45000)
    expect(leseBetragCents('1 234,56')).toBe(123456)
  })

  it('unterscheidet eine fehlende Angabe von null', () => {
    // Eine leere Gage ist keine Gage von 0 - das ist der Unterschied
    // zwischen "nicht erfasst" und "unbezahlt".
    expect(leseBetragCents('')).toBeNull()
    expect(leseBetragCents('   ')).toBeNull()
    expect(leseBetragCents('keine Angabe')).toBeNull()
    expect(leseBetragCents('0')).toBe(0)
  })

  it('rundet auf den Cent', () => {
    expect(leseBetragCents('1,005')).toBe(101)
    expect(leseBetragCents('1,004')).toBe(100)
  })
})

describe('CSV schreiben', () => {
  it('trennt mit Semikolon und setzt die Byte-Reihenfolge-Marke', () => {
    const text = schreibeCsv(['Name', 'Funktion'], [['Sarah Müller', 'Regie']])
    expect(text.startsWith('﻿')).toBe(true)
    expect(text).toContain('Name;Funktion')
    expect(text).toContain('Sarah Müller;Regie')
  })

  it('schützt Felder mit Semikolon, Anführungszeichen oder Umbruch', () => {
    const text = schreibeCsv(['Notiz'], [['a;b'], ['Er sagte "Hallo"'], ['Zeile\nZeile']])
    expect(text).toContain('"a;b"')
    expect(text).toContain('"Er sagte ""Hallo"""')
    expect(text).toContain('"Zeile\nZeile"')
  })

  it('schreibt Beträge mit Komma', () => {
    expect(cents(123456)).toBe('1234,56')
    expect(cents(0)).toBe('0,00')
    expect(cents(null)).toBe('')
  })

  it('lässt sich wieder einlesen', () => {
    const text = schreibeCsv(
      ['Name', 'Notiz', 'Gage'],
      [['Müller, Sarah', 'Zwei\nZeilen', cents(45000)]]
    )
    const zurueck = leseTabelle(text)
    expect(zurueck[0].name).toBe('Müller, Sarah')
    expect(zurueck[0].notiz).toBe('Zwei\nZeilen')
    expect(leseBetragCents(zurueck[0].gage)).toBe(45000)
  })
})
