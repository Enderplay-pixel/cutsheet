import { describe, it, expect, beforeAll } from 'vitest'
import { angebotsNummer } from '../routes/angebote'
import { formatiereNummer, summiere, faelligkeit, type Position } from '../lib/rechnung'
import {
  datevBetrag, datevDatum, datevText, datevKodieren, datevStapel,
  erloeskonto, ERLOESKONTEN, type Buchung,
} from '../lib/buchhaltung'

/**
 * Angebote und die Übergabe an die Buchhaltung.
 *
 * Geprüft wird hier das, was still falsch sein kann: Nummernkreise, die sich
 * überschneiden, Beträge, die beim Umrechnen Cent verlieren, und eine Datei,
 * die in der falschen Kodierung ankommt. Alles drei fällt in der Oberfläche
 * nicht auf und erst beim Steuerberater.
 */

describe('Nummernkreise', () => {
  it('hält Angebots- und Rechnungsnummern auseinander', () => {
    // Beide zählen ab 1, deshalb muss die Form sie unterscheiden - sonst
    // stünde "2026-0001" zweimal im Haus, einmal als Angebot und einmal als
    // Rechnung.
    expect(angebotsNummer(2026, 1)).toBe('A-2026-0001')
    expect(formatiereNummer(2026, 1)).toBe('2026-0001')
    expect(angebotsNummer(2026, 1)).not.toBe(formatiereNummer(2026, 1))
  })

  it('füllt auf vier Stellen auf und wächst darüber hinaus', () => {
    expect(angebotsNummer(2026, 42)).toBe('A-2026-0042')
    expect(angebotsNummer(2026, 9999)).toBe('A-2026-9999')
    // Mehr als 9999 Angebote im Jahr sind unwahrscheinlich, aber die Nummer
    // darf dann nicht abgeschnitten werden.
    expect(angebotsNummer(2026, 12345)).toBe('A-2026-12345')
  })
})

describe('Summen eines Angebots mit zwei Steuersätzen', () => {
  // Der Fall aus der Praxis: Dreharbeiten mit 19 Prozent, die Einräumung
  // urheberrechtlicher Nutzungsrechte mit 7.
  const positionen: Position[] = [
    { quantity_milli: 2000, unit_price_cents: 78_000, tax_percent: 19 },
    { quantity_milli: 3000, unit_price_cents: 145_000, tax_percent: 19 },
    { quantity_milli: 6000, unit_price_cents: 62_000, tax_percent: 19 },
    { quantity_milli: 1000, unit_price_cents: 180_000, tax_percent: 7 },
  ]

  it('rechnet die Steuer je Satz auf die Summe, nicht je Zeile', () => {
    const s = summiere(positionen, 'regel')
    // Netto: 1560 + 4350 + 3720 + 1800 = 11430 Euro
    expect(s.netto).toBe(1_143_000)
    // 19 % auf 9630 = 1829,70 · 7 % auf 1800 = 126,00 · zusammen 1955,70
    expect(s.steuer).toBe(195_570)
    expect(s.brutto).toBe(1_338_570)
  })

  it('weist die Bemessungsgrundlagen getrennt aus', () => {
    const s = summiere(positionen, 'regel')
    const nach = new Map(s.nachSatz.map((z) => [z.satz, z]))
    expect(nach.get(19)!.netto).toBe(963_000)
    expect(nach.get(19)!.steuer).toBe(182_970)
    expect(nach.get(7)!.netto).toBe(180_000)
    expect(nach.get(7)!.steuer).toBe(12_600)
  })

  it('weist beim Kleinunternehmer keine Steuer aus', () => {
    const s = summiere(positionen, 'kleinunternehmer')
    expect(s.netto).toBe(1_143_000)
    expect(s.steuer).toBe(0)
    expect(s.brutto).toBe(1_143_000)
  })
})

describe('Zahlungsziel', () => {
  it('rechnet die Frist in Tagen ab dem Rechnungsdatum', () => {
    expect(faelligkeit('2026-10-01', 14)).toBe('2026-10-15')
    // Über einen Monatswechsel und über die Zeitumstellung hinweg.
    expect(faelligkeit('2026-10-20', 14)).toBe('2026-11-03')
    expect(faelligkeit('2026-12-20', 30)).toBe('2027-01-19')
  })
})

describe('DATEV-Buchungsstapel', () => {
  it('schreibt Beträge mit Komma und zwei Stellen', () => {
    expect(datevBetrag(904_400)).toBe('9044,00')
    expect(datevBetrag(195_570)).toBe('1955,70')
    expect(datevBetrag(5)).toBe('0,05')
    expect(datevBetrag(0)).toBe('0,00')
    // Das Vorzeichen steckt im Soll-Haben-Kennzeichen, nicht im Betrag.
    expect(datevBetrag(-904_400)).toBe('9044,00')
  })

  it('schreibt das Belegdatum als Tag und Monat', () => {
    expect(datevDatum('2026-06-20')).toBe('2006')
    expect(datevDatum('2026-01-05')).toBe('0501')
    expect(datevDatum('2026-12-31')).toBe('3112')
  })

  it('kürzt den Buchungstext auf 60 Zeichen und entfernt Trennzeichen', () => {
    // Ein Semikolon im Buchungstext würde die Spalten verschieben und die
    // ganze Datei unlesbar machen.
    expect(datevText('Blaupause; Werbeagentur')).toBe('Blaupause  Werbeagentur'.replace(/\s+/g, ' '))
    expect(datevText('Zeile eins\nZeile zwei')).toBe('Zeile eins Zeile zwei')
    const lang = 'W'.repeat(80)
    expect(datevText(lang).length).toBe(60)
  })

  it('kodiert Umlaute als Windows-1252', () => {
    // DATEV liest diese Kodierung. Aus UTF-8 würde in der Buchhaltung
    // "MÃ¼ller" stehen - und zwar dauerhaft.
    const bytes = datevKodieren('Müller')
    expect([...bytes]).toEqual([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72])
    // Das Eurozeichen hat in Windows-1252 die Stelle 0x80.
    expect([...datevKodieren('€')]).toEqual([0x80])
    // Was die Kodierung nicht kennt, wird ein Fragezeichen - besser als eine
    // Datei, die niemand einlesen kann.
    expect([...datevKodieren('日')]).toEqual([0x3f])
  })

  it('baut Kopf, Spaltennamen und Buchungen in dieser Reihenfolge', () => {
    const buchungen: Buchung[] = [
      {
        betragCents: 904_400, sollHaben: 'S', konto: '10001', gegenkonto: '8400',
        datum: '2026-06-20', belegfeld1: '2026-0002', text: 'Westdeutscher Rundfunk',
      },
    ]
    const datei = datevStapel(
      {
        berater: 12345, mandant: 6789, wjBeginn: '2026-01-01', sachkontenlaenge: 4,
        von: '2026-01-01', bis: '2026-12-31', bezeichnung: 'Nordlicht Film 2026',
      },
      buchungen
    )
    const zeilen = datei.split('\r\n')
    expect(zeilen[0].startsWith('"EXTF";700;21;"Buchungsstapel";13;')).toBe(true)
    expect(zeilen[0]).toContain(';12345;6789;20260101;4;20260101;20261231;')
    // Festschreibung bleibt 0: ein Stapel, den man in DATEV noch verwerfen kann.
    expect(zeilen[0]).toContain(';1;;0;"EUR"')
    expect(zeilen[1].startsWith('"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen"')).toBe(true)
    expect(zeilen[2]).toBe('9044,00;"S";"EUR";;;;"10001";"8400";;2006;"2026-0002";;;"Westdeutscher Rundfunk"')
    // Die Datei endet mit einem Zeilenumbruch, sonst verschluckt der Import
    // die letzte Buchung.
    expect(datei.endsWith('\r\n')).toBe(true)
  })

  it('hat in jeder Zeile gleich viele Felder', () => {
    // Eine Zeile mit einem Feld zu wenig verschiebt alles Folgende, und der
    // Import meldet einen Fehler, der nichts mit der Ursache zu tun hat.
    const datei = datevStapel(
      { berater: 1, mandant: 2, wjBeginn: '2026-01-01', sachkontenlaenge: 4, von: '2026-01-01', bis: '2026-12-31', bezeichnung: 'T' },
      [
        { betragCents: 100, sollHaben: 'S', konto: '10001', gegenkonto: '8400', datum: '2026-01-02', belegfeld1: 'A', text: 'eins' },
        { betragCents: 200, sollHaben: 'H', konto: '10002', gegenkonto: '8300', datum: '2026-02-03', belegfeld1: 'B', text: 'zwei' },
      ]
    )
    const zeilen = datei.trimEnd().split('\r\n')
    const felder = zeilen.map((z) => z.split(';').length)
    expect(felder[0]).toBe(31)
    expect(felder.slice(1)).toEqual([14, 14, 14])
  })
})

describe('Erlöskonten', () => {
  it('wählt nach Steuersatz, nicht nach Art der Leistung', () => {
    expect(erloeskonto('SKR03', 19, 'regel')).toBe('8400')
    expect(erloeskonto('SKR03', 7, 'regel')).toBe('8300')
    expect(erloeskonto('SKR04', 19, 'regel')).toBe('4400')
    expect(erloeskonto('SKR04', 7, 'regel')).toBe('4300')
  })

  it('kennt Kleinunternehmer und steuerfreie Leistungen', () => {
    // Die Steuerart heisst in der Datenbank 'kleinunternehmer'. Ein Vergleich
    // gegen eine Abkuerzung war still falsch: Die Rechnung landete dann auf
    // dem Konto fuer 19 Prozent.
    expect(erloeskonto('SKR03', 0, 'kleinunternehmer')).toBe('8200')
    expect(erloeskonto('SKR03', 0, 'regel')).toBe('8120')
    // Auch bei gesetztem Satz entscheidet die Steuerart: Ein Kleinunternehmer
    // weist keine Umsatzsteuer aus, egal was an der Position steht.
    expect(erloeskonto('SKR03', 19, 'kleinunternehmer')).toBe('8200')
    expect(erloeskonto('SKR04', 19, 'kleinunternehmer')).toBe('4200')
  })

  it('unterscheidet die beiden Kontenrahmen vollständig', () => {
    // Keine Kontonummer darf in beiden Rahmen dieselbe sein - sonst würde ein
    // Vertippen beim Kontenrahmen nicht auffallen.
    const drei = Object.values(ERLOESKONTEN.SKR03)
    const vier = Object.values(ERLOESKONTEN.SKR04)
    expect(drei.filter((k) => vier.includes(k as never))).toEqual([])
  })
})
