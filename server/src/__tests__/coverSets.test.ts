import { describe, it, expect } from 'vitest'
import { coverSetsFuer, istAussen, type CoverSet } from '../lib/coverSets'

const cover = (id: number, int_ext: string, location_id: number | null): CoverSet =>
  ({ id, scene_number: String(id), title: `Szene ${id}`, int_ext, day_night: 'TAG', location_id, location_name: null, eighths: 8 })

describe('Cover-Sets (AP C5)', () => {
  it('Außenanteil: EXT und INT/EXT ja, INT nein', () => {
    expect([istAussen('EXT'), istAussen('INT/EXT'), istAussen('INT'), istAussen(null)]).toEqual([true, true, false, false])
  })

  it('nennt Innenszenen und Szenen am selben Motiv, nur an Tagen mit Außenszene, nie eine Szene des Tages', () => {
    const offene = [cover(1, 'INT', 9), cover(2, 'EXT', 5), cover(3, 'EXT', 9), cover(4, 'INT', null)]
    const tag = [{ scene_id: 10, int_ext: 'EXT', location_id: 5 }, { scene_id: 4, int_ext: 'INT', location_id: null }]
    expect(coverSetsFuer(tag, offene).map((k) => k.id)).toEqual([1, 2])
    // Ein Tag ohne Außenszene braucht keine Ausweichszene
    expect(coverSetsFuer([{ scene_id: 10, int_ext: 'INT', location_id: 5 }], offene)).toEqual([])
    expect(coverSetsFuer([], offene)).toEqual([])
  })
})
