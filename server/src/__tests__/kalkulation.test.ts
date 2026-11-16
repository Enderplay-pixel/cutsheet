import { describe, it, expect } from 'vitest'
import { kostenstand, vergleicheFassungen } from '../lib/kalkulation'

/** Kostenstand mit Endstand und Vergleich zweier Fassungen (Plan Kino-Ausbau, AP E1). Beträge in Cent. */
describe('kostenstand', () => {
  const zeile = (id: number, soll: number, extra: Record<string, unknown> = {}) => ({ id, gruppe: '5', description: `Zeile ${id}`, total_cents: soll, ...extra })

  it('Vorgabe: noch zu erwarten ist Kalkulation minus Ist, nie unter null', () => {
    const [g] = kostenstand([zeile(1, 10_000_000), zeile(2, 1_000_000)], [
      { budget_line_id: 1, gruppe: '5', amount_cents: 6_000_000 },
      { budget_line_id: 2, gruppe: '5', amount_cents: 1_500_000 },
    ], [{ gruppe: '5' }])
    expect(g.zeilen[0]).toMatchObject({ soll_cents: 10_000_000, ist_cents: 6_000_000, rest_cents: 4_000_000, endstand_cents: 10_000_000, abweichung_cents: 0, ueber: false })
    expect(g.zeilen[1]).toMatchObject({ rest_cents: 0, endstand_cents: 1_500_000, abweichung_cents: 500_000, abweichung_prozent: 50, ueber: true })
  })

  it('zurückgestellt und beigestellt (AP E4): kein Beleg erwartet, im Endstand enthalten', () => {
    const [g] = kostenstand([zeile(1, 5_000_000, { deferred_cents: 2_000_000 }), zeile(2, 1_000_000, { in_kind_cents: 400_000 })], [
      { budget_line_id: 2, gruppe: '5', amount_cents: 700_000 },
    ], [{ gruppe: '5' }])
    expect(g.zeilen[0]).toMatchObject({ rest_cents: 3_000_000, zurueckgestellt_cents: 2_000_000, endstand_cents: 5_000_000, abweichung_cents: 0 })
    // 10.000 € kalkuliert, 4.000 € beigestellt, 7.000 € Ist: nichts mehr zu erwarten, 1.000 € drüber
    expect(g.zeilen[1]).toMatchObject({ rest_cents: 0, beigestellt_cents: 400_000, endstand_cents: 1_100_000, abweichung_cents: 100_000, ueber: true })
    expect(g).toMatchObject({ rest_cents: 3_000_000, ohne_zahlung_cents: 2_400_000, endstand_cents: 6_100_000 })
  })

  it('überschriebener Rest gilt und trägt, wer ihn gesetzt hat; eine abgeschlossene Zeile erwartet nichts mehr', () => {
    const [g] = kostenstand([
      zeile(1, 10_000_000, { forecast_rest_cents: 5_500_000, forecast_set_by_name: 'Inhaberin', forecast_set_at: '2026-11-16' }),
      zeile(2, 10_000_000, { closed: true, forecast_rest_cents: 3_000_000 }),
    ], [
      { budget_line_id: 1, gruppe: '5', amount_cents: 6_000_000 },
      { budget_line_id: 2, gruppe: '5', amount_cents: 6_000_000 },
    ], [])
    expect(g.zeilen[0]).toMatchObject({ rest_cents: 5_500_000, endstand_cents: 11_500_000, abweichung_cents: 1_500_000, abweichung_prozent: 15, ueber: true, rest_gesetzt: true, gesetzt_von: 'Inhaberin' })
    expect(g.zeilen[1]).toMatchObject({ rest_cents: 0, endstand_cents: 6_000_000, abgeschlossen: true, rest_gesetzt: false })
  })

  it('die Summen je Gruppe sind die Summen der Zeilen, Belege ohne Zeile stehen für sich', () => {
    const gruppen = kostenstand([zeile(1, 10_000_000), { ...zeile(2, 2_000_000), gruppe: '3' }], [
      { budget_line_id: 1, gruppe: '5', amount_cents: 6_000_000 },
      { gruppe: '5', amount_cents: 959_000 },
      // Ein Beleg mit Zeile zählt zur Gruppe seiner Zeile
      { budget_line_id: 2, gruppe: '5', amount_cents: 500_000 },
    ], [{ gruppe: '3', zusatz: { description: 'Zusatzkosten Gagen', cents: 400_000 } }, { gruppe: '5' }])
    const g5 = gruppen.find((g) => g.gruppe === '5')!
    expect(g5.zeilen.map((z) => z.description)).toEqual(['Zeile 1', 'Belege ohne Zeile'])
    for (const g of gruppen) {
      for (const k of ['soll_cents', 'ist_cents', 'rest_cents', 'endstand_cents'] as const) {
        expect(g[k]).toBe(g.zeilen.reduce((s, z) => s + z[k], 0))
      }
    }
    expect(g5).toMatchObject({ ist_cents: 6_959_000, endstand_cents: 10_959_000 })
    expect(gruppen.find((g) => g.gruppe === '3')).toMatchObject({ soll_cents: 2_400_000, ist_cents: 500_000, rest_cents: 1_900_000 })
  })
})

describe('vergleicheFassungen', () => {
  it('gleiche Zeile über den Herkunftsschlüssel, über die Beschreibung, nur in A, nur in B', () => {
    const a = [
      { gruppe: '3', source_key: 'crew:1', description: 'Ole (Szenenbild)', total_cents: 1_250_000 },
      { gruppe: '5', source_key: '', description: 'Kamerapaket', total_cents: 1_260_000 },
      { gruppe: '10', source_key: '', description: 'Büro', total_cents: 300_000 },
    ]
    const b = [
      { gruppe: '3', source_key: 'crew:1', description: 'Ole (Szenenbild), Vorbereitung 5 Tage', total_cents: 1_500_000 },
      { gruppe: '5', source_key: '', description: '  KAMERAPAKET ', total_cents: 1_260_000 },
      { gruppe: '6', source_key: '', description: 'Reise', total_cents: 80_000 },
    ]
    const v = vergleicheFassungen(a, b)
    const zeilen = v.gruppen.flatMap((g) => g.zeilen)
    expect(zeilen.map((z) => [z.description, z.art, z.diff_cents])).toEqual([
      ['Ole (Szenenbild)', 'beide', 250_000],
      ['Kamerapaket', 'beide', 0],
      ['Büro', 'nur_a', -300_000],
      ['Reise', 'nur_b', 80_000],
    ])
    expect(v.unterschiede).toBe(3)
    expect(v.gruppen.find((g) => g.gruppe === '3')).toMatchObject({ a_cents: 1_250_000, b_cents: 1_500_000, diff_cents: 250_000 })
  })
})
