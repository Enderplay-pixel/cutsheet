import { describe, it, expect } from 'vitest'
import { genehmigungsstand, gedeckt } from '../lib/genehmigungen'

/** Drehgenehmigungen je Motiv (Plan Kino-Ausbau, AP C3). */
describe('genehmigungsstand', () => {
  const motive = [{ id: 1, name: 'Deich', permit_required: true }, { id: 2, name: 'Wohnung', permit_required: false }]
  const tag = (id: number, date: string, orte: number[]) => ({ id, day_number: id, date, location_ids: orte })

  it('je nach Abstand: mehr als 14 Tage Hinweis, darunter Warnung, am Drehtag und danach Fehler', () => {
    const m = genehmigungsstand([tag(1, '2026-12-20', [1]), tag(2, '2026-11-26', [1]), tag(3, '2026-11-16', [1]), tag(4, '2026-11-10', [1])], motive, [], '2026-11-16')
    expect(m.map((x) => [x.datum, x.tage_bis, x.schwere])).toEqual([
      ['2026-11-10', -6, 'fehler'], ['2026-11-16', 0, 'fehler'], ['2026-11-26', 10, 'warnung'], ['2026-12-20', 34, 'hinweis'],
    ])
    // 14 Tage sind noch eine Warnung, 15 ein Hinweis
    expect(genehmigungsstand([tag(1, '2026-11-30', [1]), tag(2, '2026-12-01', [1])], motive, [], '2026-11-16').map((x) => x.schwere)).toEqual(['warnung', 'hinweis'])
  })

  it('eine vorliegende Genehmigung, die das Datum abdeckt, beendet die Meldung; endet sie vorher, kommt sie wieder', () => {
    const tage = [tag(1, '2026-11-26', [1, 2])]
    expect(genehmigungsstand(tage, motive, [{ location_id: 1, status: 'liegt vor', valid_from: '2026-11-20', valid_until: '2026-11-30' }], '2026-11-16')).toEqual([])
    expect(genehmigungsstand(tage, motive, [{ location_id: 1, status: 'liegt vor', valid_from: '2026-11-20', valid_until: '2026-11-25' }], '2026-11-16')).toHaveLength(1)
    // Beantragt deckt nicht; eine andere Genehmigung auch nicht
    expect(genehmigungsstand(tage, motive, [{ location_id: 1, status: 'beantragt', valid_from: '2026-11-01', valid_until: '2026-12-31' }], '2026-11-16')).toHaveLength(1)
    expect(gedeckt([{ location_id: 2, status: 'liegt vor' }], 1, '2026-11-26')).toBe(false)
    // Ohne Ende gilt sie offen
    expect(gedeckt([{ location_id: 1, status: 'liegt vor', valid_from: '2026-11-01', valid_until: null }], 1, '2027-06-01')).toBe(true)
  })

  it('ein Motiv ohne "Genehmigung nötig" und Tage ohne Datum melden nichts', () => {
    expect(genehmigungsstand([tag(1, '2026-11-20', [2]), tag(2, '', [1])], motive, [], '2026-11-16')).toEqual([])
  })
})
