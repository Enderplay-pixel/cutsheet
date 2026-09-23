import { describe, it, expect } from 'vitest'
import {
  zahl, gagenPosten, equipmentPosten, versicherungsPosten, abgleiche,
  type Kostenposten,
} from '../lib/kostenquellen'

describe('zahl', () => {
  it('unterscheidet "nicht erfasst" von echter Null', () => {
    expect(zahl(null)).toBeNull()
    expect(zahl('')).toBeNull()
    expect(zahl(0)).toBe(0)
    expect(zahl('4500')).toBe(4500)
    expect(zahl('viel')).toBeNull()
  })
})

describe('Gagen', () => {
  const tage = new Map([[1, 3], [2, 0], [3, 5]])

  it('rechnet Gage mal Drehtage', () => {
    const p = gagenPosten([{ id: 1, name: 'Anna Berg', rolle: 'Mia', fee_per_day: 25000 }], tage, 'cast')
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({
      schluessel: 'cast:1', kategorie: 'Gagen Besetzung',
      beschreibung: 'Anna Berg (Mia)', einheit: 'Tag',
      menge: 3, einzelpreis_cent: 25000, gesamt_cent: 75000,
    })
  })

  it('legt keinen Posten an, wenn niemand an einem Drehtag steht', () => {
    expect(gagenPosten([{ id: 2, name: 'Ohne Tag', fee_per_day: 25000 }], tage, 'cast')).toEqual([])
  })

  it('legt keinen Posten ueber 0 Euro an', () => {
    expect(gagenPosten([{ id: 3, name: 'Ohne Gage', fee_per_day: 0 }], tage, 'crew')).toEqual([])
    expect(gagenPosten([{ id: 3, name: 'Gage leer', fee_per_day: null }], tage, 'crew')).toEqual([])
  })

  it('trennt Stab und Besetzung', () => {
    const p = gagenPosten([{ id: 3, name: 'Tom', rolle: 'Kamera', fee_per_day: 40000 }], tage, 'crew')
    expect(p[0].kategorie).toBe('Gagen Stab')
    expect(p[0].schluessel).toBe('crew:3')
  })

  it('kommt ohne Namen aus', () => {
    const p = gagenPosten([{ id: 1, name: '', fee_per_day: 100 }], tage, 'cast')
    expect(p[0].beschreibung).toBe('Ohne Namen')
  })
})

describe('Equipment', () => {
  it('nimmt die bereits gerechnete Summe', () => {
    const p = equipmentPosten([{ id: 7, name: 'Kamera', total_cents: 45000, rental_per_day_cents: 9000 }])
    expect(p[0]).toMatchObject({ schluessel: 'equipment:7', einheit: 'Pauschal', menge: 1, gesamt_cent: 45000 })
  })

  it('rechnet aus Tagessatz, wenn keine Summe da ist', () => {
    const p = equipmentPosten([{ id: 8, name: 'Licht', total_cents: 0, rental_per_day_cents: 5000, quantity: 2, days: 3 }])
    expect(p[0]).toMatchObject({ einheit: 'Tag', menge: 6, einzelpreis_cent: 5000, gesamt_cent: 30000 })
  })

  it('ueberspringt Posten ganz ohne Preis', () => {
    expect(equipmentPosten([{ id: 9, name: 'Geliehen', total_cents: 0, rental_per_day_cents: 0 }])).toEqual([])
  })
})

describe('Versicherungen', () => {
  it('nimmt die Praemie, nicht die Deckungssumme', () => {
    const p = versicherungsPosten([{ id: 2, type: 'Haftpflicht', provider: 'Allianz', premium_cents: 32000 }])
    expect(p[0]).toMatchObject({
      schluessel: 'insurance:2', kategorie: 'Versicherungen',
      beschreibung: 'Haftpflicht - Allianz', gesamt_cent: 32000,
    })
  })

  it('ueberspringt Policen ohne Praemie', () => {
    expect(versicherungsPosten([{ id: 3, type: 'Noch offen', premium_cents: null }])).toEqual([])
  })
})

describe('Abgleich mit der Kalkulation', () => {
  const soll: Kostenposten[] = [
    { schluessel: 'cast:1', kategorie: 'Gagen Besetzung', beschreibung: 'Anna', einheit: 'Tag', menge: 3, einzelpreis_cent: 25000, gesamt_cent: 75000 },
    { schluessel: 'equipment:7', kategorie: 'Equipment', beschreibung: 'Kamera', einheit: 'Pauschal', menge: 1, einzelpreis_cent: 45000, gesamt_cent: 45000 },
  ]

  it('laesst handgeschriebene Zeilen unangetastet', () => {
    const r = abgleiche([
      { id: 100, source_key: '', description: 'Von Hand: Reisekosten', quantity: 1, unit_price_cents: 50000, total_cents: 50000 },
      { id: 101, source_key: null, description: 'Auch von Hand', quantity: 1, unit_price_cents: 1, total_cents: 1 },
    ], soll)
    expect(r.entfallen).toEqual([])          // nichts Handgeschriebenes faellt weg
    expect(r.neu).toHaveLength(2)
  })

  it('erkennt unveraenderte Zeilen', () => {
    const r = abgleiche([
      { id: 1, source_key: 'cast:1', description: 'Anna', quantity: 3, unit_price_cents: 25000, total_cents: 75000 },
    ], soll)
    expect(r.unveraendert).toBe(1)
    expect(r.geaendert).toEqual([])
    expect(r.neu.map(n => n.schluessel)).toEqual(['equipment:7'])
  })

  it('aktualisiert, wenn sich die Gage aendert', () => {
    const r = abgleiche([
      { id: 1, source_key: 'cast:1', description: 'Anna', quantity: 3, unit_price_cents: 20000, total_cents: 60000 },
    ], soll)
    expect(r.geaendert).toHaveLength(1)
    expect(r.geaendert[0].id).toBe(1)
    expect(r.geaendert[0].posten.gesamt_cent).toBe(75000)
    expect(r.unveraendert).toBe(0)
  })

  it('entfernt Zeilen, deren Quelle es nicht mehr gibt', () => {
    const r = abgleiche([
      { id: 1, source_key: 'cast:1', description: 'Anna', quantity: 3, unit_price_cents: 25000, total_cents: 75000 },
      { id: 2, source_key: 'cast:99', description: 'Weggefallen', quantity: 1, unit_price_cents: 100, total_cents: 100 },
    ], soll)
    expect(r.entfallen).toEqual([2])
  })

  it('ist wiederholbar: zweimal laufen aendert nichts mehr', () => {
    const erste = abgleiche([], soll)
    const danach = erste.neu.map((p, i) => ({
      id: i + 1, source_key: p.schluessel, description: p.beschreibung,
      quantity: p.menge, unit_price_cents: p.einzelpreis_cent, total_cents: p.gesamt_cent,
    }))
    const zweite = abgleiche(danach, soll)
    expect(zweite.neu).toEqual([])
    expect(zweite.geaendert).toEqual([])
    expect(zweite.entfallen).toEqual([])
    expect(zweite.unveraendert).toBe(2)
  })
})
