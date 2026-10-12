import { describe, it, expect } from 'vitest'
import {
  ABGABESAETZE, BAGATELLGRENZE_CENTS, MELDEFRIST_TAG,
  satzFuer, satzText, abgabe, jahresmeldung, gewerkVorschlag, KUENSTLERISCHE_GEWERKE,
} from '../lib/ksk'

/**
 * Die Künstlersozialabgabe wird nachgerechnet - von der Kasse, und bei einer
 * Prüfung rückwirkend für bis zu fünf Jahre. Ein zu niedrig gemeldeter Betrag
 * wird nachgefordert, ein zu hoch gemeldeter bleibt bezahlt.
 */

describe('Abgabesätze', () => {
  it('kennt den Satz für 2026', () => {
    // 4,90 Prozent, Künstlersozialabgabe-Verordnung vom 22.09.2025.
    expect(satzFuer(2026)).toBe(490)
    expect(satzText(490)).toBe('4,90')
  })

  it('erfindet keinen Satz für ein unbekanntes Jahr', () => {
    // Lieber keine Zahl als eine geratene: Eine erfundene Abgabe steht sonst
    // in einer Meldung an eine Behörde.
    expect(satzFuer(2030)).toBeNull()
    expect(satzFuer(1999)).toBeNull()
  })

  it('führt die Sätze lückenlos bis zum aktuellen Jahr', () => {
    const jahre = Object.keys(ABGABESAETZE).map(Number).sort((a, b) => a - b)
    for (let i = 1; i < jahre.length; i++) {
      expect(jahre[i] - jahre[i - 1], `Lücke zwischen ${jahre[i - 1]} und ${jahre[i]}`).toBe(1)
    }
    expect(jahre).toContain(2026)
  })

  it('hält alle Sätze als ganze Hundertstel', () => {
    // 4.9 ist in Fließkomma nicht 4,9. Deshalb Hundertstel Prozent als
    // Ganzzahl - und dann müssen es auch alle sein.
    for (const [jahr, satz] of Object.entries(ABGABESAETZE)) {
      expect(Number.isInteger(satz), `${jahr}`).toBe(true)
      expect(satz, `${jahr}`).toBeGreaterThan(0)
    }
  })
})

describe('Abgabe rechnen', () => {
  it('rechnet den von Hand nachgerechneten Betrag', () => {
    // 48.000,00 Euro Honorare, 4,90 Prozent = 2.352,00 Euro
    expect(abgabe(4_800_000, 490)).toBe(235_200)
    // 1.000,00 Euro, 4,90 Prozent = 49,00 Euro
    expect(abgabe(100_000, 490)).toBe(4_900)
  })

  it('rundet auf den Cent, nicht auf den Euro', () => {
    // 333,33 Euro × 4,90 % = 16,3331... Euro → 1633 Cent
    expect(abgabe(33_333, 490)).toBe(1_633)
  })

  it('gibt null zurück, wo nichts zu rechnen ist', () => {
    expect(abgabe(0, 490)).toBe(0)
    expect(abgabe(-100, 490)).toBe(0)
    expect(abgabe(100_000, 0)).toBe(0)
  })
})

describe('Jahresmeldung', () => {
  it('rechnet die Abgabe einer Produktionsfirma', () => {
    const m = jahresmeldung(2026, 4_800_000, 'verwerter', '2026-10-12')
    expect(m.pflichtig).toBe(true)
    expect(m.satzHundertstel).toBe(490)
    expect(m.abgabeCents).toBe(235_200)
    expect(m.frist).toBe('2027-03-31')
    expect(m.ueberfaellig).toBe(false)
  })

  it('kennt keine Bagatellgrenze für Verwerter', () => {
    // Eine Produktionsfirma verwertet künstlerische Leistungen von Berufs
    // wegen. Auch 200 Euro Honorar im Jahr sind abgabepflichtig.
    const m = jahresmeldung(2026, 20_000, 'verwerter', '2026-10-12')
    expect(m.pflichtig).toBe(true)
    expect(m.abgabeCents).toBe(abgabe(20_000, 490))
  })

  it('wendet die Bagatellgrenze auf Eigenwerber an', () => {
    const drunter = jahresmeldung(2026, BAGATELLGRENZE_CENTS, 'eigenwerber', '2026-10-12')
    expect(drunter.pflichtig).toBe(false)
    expect(drunter.abgabeCents).toBe(0)
    // Ein Cent darüber kippt es.
    const drueber = jahresmeldung(2026, BAGATELLGRENZE_CENTS + 1, 'eigenwerber', '2026-10-12')
    expect(drueber.pflichtig).toBe(true)
    expect(drueber.abgabeCents).toBeGreaterThan(0)
  })

  it('verlangt auch bei null Honoraren eine Meldung', () => {
    const m = jahresmeldung(2026, 0, 'verwerter', '2026-10-12')
    expect(m.pflichtig).toBe(false)
    expect(m.abgabeCents).toBe(0)
    expect(m.hinweis).toContain('trotzdem abzugeben')
  })

  it('meldet eine verstrichene Frist', () => {
    // Für 2025 war der 31. März 2026 Stichtag.
    const m = jahresmeldung(2025, 4_800_000, 'verwerter', '2026-10-12')
    expect(m.frist).toBe(`2026-${MELDEFRIST_TAG}`)
    expect(m.ueberfaellig).toBe(true)
    // Am Stichtag selbst ist nichts überfällig.
    expect(jahresmeldung(2025, 1, 'verwerter', '2026-03-31').ueberfaellig).toBe(false)
    expect(jahresmeldung(2025, 1, 'verwerter', '2026-04-01').ueberfaellig).toBe(true)
  })

  it('rechnet nicht mit einem Satz, den es nicht kennt', () => {
    const m = jahresmeldung(2030, 4_800_000, 'verwerter', '2030-10-12')
    expect(m.satzHundertstel).toBeNull()
    expect(m.abgabeCents).toBe(0)
    expect(m.pflichtig).toBe(false)
    expect(m.hinweis).toContain('kein Abgabesatz hinterlegt')
  })
})

describe('Vorschlag für künstlerische Gewerke', () => {
  it('erkennt die üblichen Funktionen', () => {
    expect(gewerkVorschlag('Regie')).toBe(true)
    expect(gewerkVorschlag('Kamera')).toBe(true)
    expect(gewerkVorschlag('Schnitt')).toBe(true)
    // Mit Zusätzen und in anderer Schreibweise
    expect(gewerkVorschlag('1. Kameraassistenz')).toBe(true)
    expect(gewerkVorschlag('REGIEASSISTENZ')).toBe(true)
    expect(gewerkVorschlag('Szenenbild / Ausstattung')).toBe(true)
  })

  it('erkennt die Schreibweisen, an denen es zuerst gescheitert ist', () => {
    // Gegen echte Stammdaten gemessen: "Regie" steckt nicht in "Regisseurin",
    // und englische Bezeichnungen standen gar nicht auf der Liste - obwohl in
    // jedem deutschen Stab welche vorkommen.
    expect(gewerkVorschlag('Regisseurin')).toBe(true)
    expect(gewerkVorschlag('Regisseur')).toBe(true)
    expect(gewerkVorschlag('Director of Photography')).toBe(true)
    expect(gewerkVorschlag('Tonmeisterin')).toBe(true)
    expect(gewerkVorschlag('Editor')).toBe(true)
    expect(gewerkVorschlag('Komponist')).toBe(true)
    expect(gewerkVorschlag('Maskenbildnerin')).toBe(true)
    expect(gewerkVorschlag('Kostümbildner')).toBe(true)
  })

  it('schlägt nichts vor, wo nichts steht', () => {
    expect(gewerkVorschlag('')).toBe(false)
    expect(gewerkVorschlag('   ')).toBe(false)
  })

  it('schlägt bei Funktionen ohne künstlerischen Bezug nichts vor', () => {
    // Die Kasse sieht auf die tatsächliche Tätigkeit. Diese hier sind
    // erfahrungsgemäß nicht künstlerisch - entschieden wird trotzdem von Hand.
    expect(gewerkVorschlag('Aufnahmeleitung')).toBe(false)
    expect(gewerkVorschlag('Fahrer')).toBe(false)
    expect(gewerkVorschlag('Catering')).toBe(false)
    expect(gewerkVorschlag('Produktionsleitung')).toBe(false)
  })

  it('führt jedes Gewerk aus der Liste zu einem Treffer', () => {
    for (const g of KUENSTLERISCHE_GEWERKE) {
      expect(gewerkVorschlag(g), g).toBe(true)
    }
  })
})
