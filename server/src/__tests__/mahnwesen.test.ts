import { describe, it, expect } from 'vitest'
import {
  STUFEN, PAUSCHALE_CENTS, BASISZINS_RUECKFALL_BP, BASISZINS_STAND,
  verzugssatzBp, verzugszinsen, naechsterSchritt, zinsSatzVeraltet,
  altersklasse, tageZwischen, plusTage,
} from '../lib/mahnwesen'

/**
 * Das Mahnwesen rechnet mit Geld und mit Fristen. Beides wird nachgerechnet -
 * vom Auftraggeber, vom Steuerberater, im Streitfall von einem Gericht. Ein
 * Rundungsfehler von einem Cent macht die ganze Aufstellung angreifbar, und
 * eine Frist, die einen Tag zu kurz ist, macht die Mahnung wirkungslos.
 *
 * Deshalb stehen hier Werte, die von Hand nachgerechnet sind, und keine
 * Momentaufnahmen des Codes.
 */

describe('Verzugszinssatz nach § 288 BGB', () => {
  it('nimmt neun Prozentpunkte gegen Unternehmer und fünf gegen Verbraucher', () => {
    // Basiszins 1,52 Prozent (152 Basispunkte), Stand 1. Juli 2026
    expect(verzugssatzBp(152, true)).toBe(1052)
    expect(verzugssatzBp(152, false)).toBe(652)
  })

  it('rechnet auch mit negativem Basiszins', () => {
    // Zwischen 2016 und 2022 war der Basiszinssatz negativ (-0,88 Prozent).
    // Der Verzugszins war trotzdem positiv, und die Rechnung muss das können.
    expect(verzugssatzBp(-88, true)).toBe(812)
    expect(verzugssatzBp(-88, false)).toBe(412)
  })
})

describe('Verzugszinsen', () => {
  it('rechnet den von Hand nachgerechneten Betrag', () => {
    // 1.000,00 Euro, 30 Tage, 10,52 Prozent
    // 100000 × 1052 × 30 / (10000 × 365) = 864,66 → 865 Cent = 8,65 Euro
    expect(verzugszinsen(100_000, 30, 1052)).toBe(865)
  })

  it('erfindet keinen Cent, wo keiner ist', () => {
    // Ein Cent, ein Tag: der Zins ist kleiner als ein halber Cent.
    // In Fließkomma käme hier leicht etwas heraus, das aufgerundet wird.
    expect(verzugszinsen(1, 1, 1052)).toBe(0)
  })

  it('gibt null zurück, wo nichts zu verzinsen ist', () => {
    expect(verzugszinsen(0, 30, 1052)).toBe(0)
    expect(verzugszinsen(100_000, 0, 1052)).toBe(0)
    // Ein negativer Satz ergibt keine Gutschrift - die kennt § 288 BGB nicht.
    expect(verzugszinsen(100_000, 30, -100)).toBe(0)
  })

  it('wächst linear mit der Zeit', () => {
    // Doppelte Zeit, doppelter Zins - bis auf die Rundung.
    const dreissig = verzugszinsen(500_000, 30, 1052)
    const sechzig = verzugszinsen(500_000, 60, 1052)
    expect(Math.abs(sechzig - 2 * dreissig)).toBeLessThanOrEqual(1)
  })
})

describe('Tage und Fristen', () => {
  it('zählt Tage zwischen zwei Datumsangaben', () => {
    expect(tageZwischen('2026-10-01', '2026-10-12')).toBe(11)
    expect(tageZwischen('2026-10-12', '2026-10-01')).toBe(-11)
    expect(tageZwischen('2026-10-12', '2026-10-12')).toBe(0)
  })

  it('zählt über die Zeitumstellung hinweg richtig', () => {
    // In der Nacht zum 25. Oktober 2026 wird die Uhr zurückgestellt. Wer mit
    // Stunden rechnet, zählt hier 30 Tage und einen Rest - und eine Frist, die
    // einen Tag zu früh oder zu spät endet, ist das häufigste Ärgernis.
    expect(tageZwischen('2026-10-10', '2026-11-10')).toBe(31)
    expect(plusTage('2026-10-10', 31)).toBe('2026-11-10')
  })

  it('zählt über den Jahreswechsel und ein Schaltjahr', () => {
    expect(tageZwischen('2026-12-20', '2027-01-10')).toBe(21)
    // 2028 ist ein Schaltjahr: Februar hat 29 Tage.
    expect(tageZwischen('2028-02-01', '2028-03-01')).toBe(29)
  })
})

describe('Nächster Mahnschritt', () => {
  const offen = {
    bruttoCents: 238_000,
    bezahltCents: 0,
    faellig: '2026-09-01',
    letzteStufe: 0,
    letzteMahnung: null,
  }

  it('schlägt nichts vor, solange nichts fällig ist', () => {
    expect(naechsterSchritt({ ...offen, faellig: '2026-12-01' }, '2026-10-12')).toBeNull()
  })

  it('schlägt nichts vor, wenn bezahlt ist', () => {
    expect(naechsterSchritt({ ...offen, bezahltCents: 238_000 }, '2026-10-12')).toBeNull()
    // Auch eine Überzahlung ist keine Forderung.
    expect(naechsterSchritt({ ...offen, bezahltCents: 300_000 }, '2026-10-12')).toBeNull()
  })

  it('schlägt nichts vor, bevor die Wartezeit der Stufe um ist', () => {
    // Stufe 1 wartet sieben Tage nach Fälligkeit. Am sechsten also nichts.
    expect(naechsterSchritt(offen, '2026-09-07')).toBeNull()
    expect(naechsterSchritt(offen, '2026-09-08')).not.toBeNull()
  })

  it('beginnt mit der kostenlosen Zahlungserinnerung', () => {
    const v = naechsterSchritt(offen, '2026-09-15')!
    expect(v.stufe).toBe(1)
    expect(v.regel.name).toBe('Zahlungserinnerung')
    // Stufe 1 kostet nichts: Die häufigste Ursache ist eine untergegangene
    // Rechnung, und eine Gebühr darauf ist teurer als die Gebühr.
    expect(v.gebuehrCents).toBe(0)
    expect(v.zinsenCents).toBe(0)
    expect(v.pauschaleCents).toBe(0)
    expect(v.gesamtCents).toBe(238_000)
  })

  it('schlägt während einer laufenden Frist nicht erneut zu', () => {
    // Die erste Mahnung war am 10., Frist bis zum 20. Am 15. wird nicht
    // gemahnt - wer am dritten Tag einer zehntägigen Frist nachsetzt, hat die
    // Frist nie gemeint und verliert vor Gericht genau damit.
    const gemahnt = {
      ...offen, letzteStufe: 1, letzteMahnung: '2026-10-10', letzteFrist: '2026-10-20',
    }
    expect(naechsterSchritt(gemahnt, '2026-10-15')).toBeNull()
    expect(naechsterSchritt(gemahnt, '2026-10-20')).toBeNull()
    // Nach Ablauf der Frist und der Wartezeit von 14 Tagen: Stufe 2.
    expect(naechsterSchritt(gemahnt, '2026-10-24')!.stufe).toBe(2)
  })

  it('rechnet ab Stufe 2 Zinsen und Gebühr', () => {
    const v = naechsterSchritt(
      { ...offen, letzteStufe: 1, letzteMahnung: '2026-09-15', letzteFrist: '2026-09-25' },
      '2026-10-01',
      { basiszinsBp: 152, gegenUnternehmer: true, mitPauschale: true }
    )!
    expect(v.stufe).toBe(2)
    expect(v.tageVerzug).toBe(30)
    // 238000 × 1052 × 30 / 3.650.000 = 2057,89 → 2058 Cent
    expect(v.zinsenCents).toBe(2058)
    expect(v.gebuehrCents).toBe(500)
    expect(v.pauschaleCents).toBe(PAUSCHALE_CENTS)
    expect(v.gesamtCents).toBe(238_000 + 2058 + 500 + PAUSCHALE_CENTS)
  })

  it('berechnet die 40-Euro-Pauschale nur einmal', () => {
    const dritte = naechsterSchritt(
      { ...offen, letzteStufe: 2, letzteMahnung: '2026-09-20', letzteFrist: '2026-09-30' },
      '2026-10-12',
      { basiszinsBp: 152, gegenUnternehmer: true, mitPauschale: true }
    )!
    expect(dritte.stufe).toBe(3)
    expect(dritte.pauschaleCents).toBe(0)
  })

  it('verlangt keine Pauschale gegen Verbraucher', () => {
    const v = naechsterSchritt(
      { ...offen, letzteStufe: 1, letzteMahnung: '2026-09-15', letzteFrist: '2026-09-25' },
      '2026-10-01',
      { basiszinsBp: 152, gegenUnternehmer: false, mitPauschale: false }
    )!
    expect(v.pauschaleCents).toBe(0)
    // Fünf statt neun Prozentpunkte: 238000 × 652 × 30 / 3.650.000 = 1275,42
    expect(v.zinsenCents).toBe(1275)
  })

  it('hört nach der letzten Stufe auf', () => {
    const erledigt = {
      ...offen, letzteStufe: STUFEN.length, letzteMahnung: '2026-09-01', letzteFrist: '2026-09-08',
    }
    expect(naechsterSchritt(erledigt, '2026-12-01')).toBeNull()
  })

  it('verzinst nur den offenen Teil, nicht die ganze Rechnung', () => {
    const v = naechsterSchritt(
      {
        ...offen, bezahltCents: 138_000,
        letzteStufe: 1, letzteMahnung: '2026-09-15', letzteFrist: '2026-09-25',
      },
      '2026-10-01',
      { basiszinsBp: 152, gegenUnternehmer: true, mitPauschale: false }
    )!
    expect(v.offenCents).toBe(100_000)
    expect(v.zinsenCents).toBe(verzugszinsen(100_000, 30, 1052))
  })

  it('setzt die neue Frist aus der Regel der Stufe', () => {
    const v = naechsterSchritt(offen, '2026-09-15')!
    expect(v.neueFrist).toBe(plusTage('2026-09-15', STUFEN[0].fristTage))
  })
})

describe('Altersstruktur', () => {
  it('teilt nach den üblichen Klassen ein', () => {
    expect(altersklasse('2026-11-01', '2026-10-12')).toBe('nicht fällig')
    expect(altersklasse('2026-10-12', '2026-10-12')).toBe('nicht fällig')
    expect(altersklasse('2026-10-01', '2026-10-12')).toBe('bis 30 Tage')
    expect(altersklasse('2026-09-12', '2026-10-12')).toBe('bis 30 Tage')
    expect(altersklasse('2026-09-11', '2026-10-12')).toBe('31 bis 60 Tage')
    // Genau 60 Tage: 12. Oktober minus 60 ist der 13. August.
    expect(altersklasse('2026-08-13', '2026-10-12')).toBe('31 bis 60 Tage')
    expect(altersklasse('2026-08-12', '2026-10-12')).toBe('61 bis 90 Tage')
    // Genau 90 Tage: der 14. Juli.
    expect(altersklasse('2026-07-14', '2026-10-12')).toBe('61 bis 90 Tage')
    expect(altersklasse('2026-07-13', '2026-10-12')).toBe('über 90 Tage')
    expect(altersklasse('2026-04-01', '2026-10-12')).toBe('über 90 Tage')
  })

  it('nennt eine Rechnung ohne Fälligkeit nicht überfällig', () => {
    expect(altersklasse(null, '2026-10-12')).toBe('nicht fällig')
  })
})

describe('Basiszinssatz', () => {
  it('kennt seinen eigenen Stand', () => {
    // 1,52 Prozent seit dem 1. Juli 2026 - Bekanntgabe der Bundesbank.
    expect(BASISZINS_RUECKFALL_BP).toBe(152)
    expect(BASISZINS_STAND).toBe('2026-07-01')
  })

  it('meldet sich, sobald ein Halbjahreswechsel vorbei ist', () => {
    // Am Stichtag selbst und im Halbjahr danach ist der Satz aktuell.
    expect(zinsSatzVeraltet('2026-07-01', '2026-07-01')).toBe(false)
    expect(zinsSatzVeraltet('2026-07-01', '2026-12-31')).toBe(false)
    // Ab dem nächsten Termin hat niemand mehr nachgesehen.
    expect(zinsSatzVeraltet('2026-07-01', '2027-01-01')).toBe(true)
    expect(zinsSatzVeraltet('2026-01-15', '2026-07-01')).toBe(true)
  })
})
