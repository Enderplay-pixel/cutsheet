import { describe, it, expect } from 'vitest'
import {
  PAUSCHALE_8H_CENTS, PAUSCHALE_24H_CENTS, PAUSCHALE_ANREISE_CENTS,
  MINDESTDAUER_MINUTEN, KUERZUNG_PROZENT, KM_PAUSCHALE_CENTS,
  pauschaleFuer, kuerzung, tagessatz, fahrtkosten, rechneReise, tagesarten,
} from '../lib/spesen'

/**
 * Reisekosten rechnet niemand im Kopf richtig, und nachgerechnet werden sie
 * zweimal: vom Betriebsprüfer und von der Person, die sie bekommt. Ein zu
 * hoher Satz ist steuerpflichtiger Arbeitslohn, ein zu niedriger ist Ärger.
 *
 * Die Werte unten stehen so im Gesetz (§ 9 Abs. 4a EStG) beziehungsweise sind
 * von Hand daraus gerechnet.
 */

describe('Pauschalen nach § 9 Abs. 4a EStG', () => {
  it('kennt die drei Sätze', () => {
    expect(PAUSCHALE_8H_CENTS).toBe(1_400)
    expect(PAUSCHALE_24H_CENTS).toBe(2_800)
    expect(PAUSCHALE_ANREISE_CENTS).toBe(1_400)
  })

  it('gibt bei einer eintägigen Reise erst über acht Stunden etwas', () => {
    // "mehr als 8 Stunden" - genau acht reicht nicht.
    expect(pauschaleFuer('einzeln', MINDESTDAUER_MINUTEN - 1)).toBe(0)
    expect(pauschaleFuer('einzeln', MINDESTDAUER_MINUTEN)).toBe(0)
    expect(pauschaleFuer('einzeln', MINDESTDAUER_MINUTEN + 1)).toBe(1_400)
    expect(pauschaleFuer('einzeln', 14 * 60)).toBe(1_400)
  })

  it('zahlt am An- und Abreisetag unabhängig von der Dauer', () => {
    // Auch wer um 22 Uhr losfährt, bekommt den vollen Anreisesatz.
    expect(pauschaleFuer('anreise', 60)).toBe(1_400)
    expect(pauschaleFuer('abreise', 30)).toBe(1_400)
    expect(pauschaleFuer('anreise', 0)).toBe(1_400)
  })

  it('zahlt am vollen Zwischentag 28 Euro', () => {
    expect(pauschaleFuer('zwischentag', 0)).toBe(2_800)
    expect(pauschaleFuer('zwischentag', 24 * 60)).toBe(2_800)
  })
})

describe('Kürzung bei gestellten Mahlzeiten', () => {
  it('rechnet die Prozentsätze vom vollen Tag', () => {
    // 20 % von 28 Euro = 5,60 · 40 % = 11,20
    expect(kuerzung({ fruehstueck: true })).toBe(560)
    expect(kuerzung({ mittag: true })).toBe(1_120)
    expect(kuerzung({ abend: true })).toBe(1_120)
    expect(KUERZUNG_PROZENT.fruehstueck).toBe(20)
  })

  it('addiert mehrere Mahlzeiten', () => {
    // Volle Verpflegung: 5,60 + 11,20 + 11,20 = 28,00 - genau der Tagessatz.
    expect(kuerzung({ fruehstueck: true, mittag: true, abend: true })).toBe(2_800)
  })

  it('kürzt am Anreisetag trotzdem vom vollen Satz', () => {
    // Der häufigste Fehler in der Praxis: Am Tag mit 14 Euro wird um 11,20
    // gekürzt, nicht um die Hälfte davon. Bleiben 2,80.
    expect(tagessatz('anreise', 0, { abend: true })).toBe(280)
  })

  it('geht nie unter null', () => {
    // Anreisetag mit Mittag- und Abendessen: 14 minus 22,40 wäre negativ.
    expect(tagessatz('anreise', 0, { mittag: true, abend: true })).toBe(0)
    expect(tagessatz('zwischentag', 0, { fruehstueck: true, mittag: true, abend: true })).toBe(0)
  })

  it('kürzt nichts, wo es nichts zu kürzen gibt', () => {
    // Unter acht Stunden gibt es keine Pauschale - und damit auch keinen Abzug.
    expect(tagessatz('einzeln', 4 * 60, { mittag: true })).toBe(0)
  })
})

describe('Fahrtkosten', () => {
  it('rechnet 30 Cent je Kilometer für den Pkw', () => {
    expect(KM_PAUSCHALE_CENTS.pkw).toBe(30)
    expect(fahrtkosten(100)).toBe(3_000)
    expect(fahrtkosten(248)).toBe(7_440)
  })

  it('rechnet 20 Cent für andere motorbetriebene Fahrzeuge', () => {
    expect(fahrtkosten(100, 'sonstige')).toBe(2_000)
  })

  it('rundet auf den Cent', () => {
    // 12,5 km × 30 = 375 Cent
    expect(fahrtkosten(12.5)).toBe(375)
    // 12,51 km × 30 = 375,3 → 375
    expect(fahrtkosten(12.51)).toBe(375)
  })

  it('gibt bei null oder unsinnigen Angaben null zurück', () => {
    expect(fahrtkosten(0)).toBe(0)
    expect(fahrtkosten(-50)).toBe(0)
    expect(fahrtkosten(NaN)).toBe(0)
  })
})

describe('Tagesarten aus einer Spanne', () => {
  it('macht aus einem Tag einen einzelnen', () => {
    expect(tagesarten('2026-11-10', '2026-11-10')).toEqual([
      { datum: '2026-11-10', art: 'einzeln' },
    ])
  })

  it('macht aus zwei Tagen Anreise und Abreise ohne vollen Tag', () => {
    expect(tagesarten('2026-11-10', '2026-11-11')).toEqual([
      { datum: '2026-11-10', art: 'anreise' },
      { datum: '2026-11-11', art: 'abreise' },
    ])
  })

  it('setzt die Zwischentage dazwischen', () => {
    const tage = tagesarten('2026-11-10', '2026-11-14')
    expect(tage.length).toBe(5)
    expect(tage.map((t) => t.art)).toEqual([
      'anreise', 'zwischentag', 'zwischentag', 'zwischentag', 'abreise',
    ])
  })

  it('rechnet über einen Monatswechsel und die Zeitumstellung', () => {
    // In der Nacht zum 25.10.2026 wird die Uhr zurückgestellt. Wer mit
    // Stunden rechnet, bekommt hier einen Tag zu viel.
    const tage = tagesarten('2026-10-23', '2026-11-02')
    expect(tage.length).toBe(11)
    expect(tage[0].datum).toBe('2026-10-23')
    expect(tage[10].datum).toBe('2026-11-02')
  })

  it('gibt bei unsinnigen Spannen nichts zurück', () => {
    expect(tagesarten('2026-11-14', '2026-11-10')).toEqual([])
    expect(tagesarten('Montag', 'Dienstag')).toEqual([])
  })
})

describe('Ganze Reise', () => {
  it('rechnet das Lehrbuchbeispiel', () => {
    // Montag Anreise, Dienstag voller Tag, Mittwoch Abreise: 14 + 28 + 14 = 56
    const r = rechneReise(
      tagesarten('2026-11-10', '2026-11-12').map((t) => ({ ...t }))
    )
    expect(r.verpflegungCents).toBe(5_600)
    expect(r.gesamtCents).toBe(5_600)
  })

  it('rechnet eine Drehreise mit Hotelfrühstück und Fahrt', () => {
    // Drei Tage, jeden Morgen Frühstück im Hotel, 248 km hin und zurück,
    // zwei Nächte zu 89 Euro.
    const tage = tagesarten('2026-11-10', '2026-11-12').map((t) => ({
      ...t, mahlzeiten: { fruehstueck: true },
    }))
    const r = rechneReise(tage, { kilometer: 248, uebernachtungCents: 17_800 })

    // Verpflegung: (14 - 5,60) + (28 - 5,60) + (14 - 5,60) = 8,40 + 22,40 + 8,40
    expect(r.verpflegungCents).toBe(3_920)
    expect(r.fahrtCents).toBe(7_440)
    expect(r.uebernachtungCents).toBe(17_800)
    expect(r.gesamtCents).toBe(3_920 + 7_440 + 17_800)
  })

  it('weist die Kürzung nur so weit aus, wie sie wirkt', () => {
    // Am Anreisetag mit Mittag und Abend wäre der Abzug 22,40 - ausgewiesen
    // werden 14,00, weil mehr nicht da war. Sonst stünde in der Abrechnung
    // ein Abzug, den es nicht gab.
    const r = rechneReise([
      { datum: '2026-11-10', art: 'anreise', mahlzeiten: { mittag: true, abend: true } },
    ])
    expect(r.tage[0].pauschaleCents).toBe(1_400)
    expect(r.tage[0].kuerzungCents).toBe(1_400)
    expect(r.tage[0].satzCents).toBe(0)
  })

  it('weist jeden Tag einzeln aus', () => {
    const r = rechneReise(tagesarten('2026-11-10', '2026-11-13').map((t) => ({ ...t })))
    expect(r.tage.length).toBe(4)
    expect(r.tage.map((t) => t.satzCents)).toEqual([1_400, 2_800, 2_800, 1_400])
  })

  it('kommt mit einer leeren Reise klar', () => {
    const r = rechneReise([])
    expect(r.gesamtCents).toBe(0)
    expect(r.tage).toEqual([])
  })
})
