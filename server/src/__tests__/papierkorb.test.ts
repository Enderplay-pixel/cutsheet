import { describe, it, expect } from 'vitest'
import { erkenneZiel } from '../middleware/papierkorbWaechter'
import { BEOBACHTET, AUFBEWAHRUNG_TAGE } from '../lib/papierkorb'

/**
 * Der Wächter entscheidet allein am Pfad, ob er sichert. Diese Entscheidung
 * muss stimmen: Zu wenig heisst, dass ein gelöschter Eintrag weg ist. Zu viel
 * heisst, dass eine Verknüpfung als eigener Eintrag im Papierkorb landet und
 * beim Zurückholen Unsinn anrichtet.
 */
describe('Was in den Papierkorb gehört', () => {
  it('erkennt die beobachteten Entitäten', () => {
    expect(erkenneZiel('/scenes/42')).toEqual({ tabelle: 'scenes', id: 42 })
    expect(erkenneZiel('/crew/7')).toEqual({ tabelle: 'crew', id: 7 })
    expect(erkenneZiel('/cast/3')).toEqual({ tabelle: 'cast', id: 3 })
    expect(erkenneZiel('/shoot-days/1')).toEqual({ tabelle: 'shoot_days', id: 1 })
    expect(erkenneZiel('/budget-lines/99')).toEqual({ tabelle: 'budget_lines', id: 99 })
  })

  it('lässt Verknüpfungen in Ruhe', () => {
    // Eine Rolle aus einer Szene nehmen ist eine Änderung, kein Verlust.
    expect(erkenneZiel('/scenes/4/characters/7')).toBeNull()
    expect(erkenneZiel('/scenes/4/inventory/7')).toBeNull()
    expect(erkenneZiel('/projects/1/email/groups/2')).toBeNull()
  })

  it('lässt alles in Ruhe, was nicht in der Liste steht', () => {
    for (const pfad of ['/invoices/3', '/email/outbox/5', '/companies/1', '/sessions/abc']) {
      expect(erkenneZiel(pfad), pfad).toBeNull()
    }
  })

  it('verlangt eine echte Kennung', () => {
    expect(erkenneZiel('/scenes/abc')).toBeNull()
    expect(erkenneZiel('/scenes/0')).toBeNull()
    expect(erkenneZiel('/scenes/-1')).toBeNull()
    expect(erkenneZiel('/scenes/')).toBeNull()
    expect(erkenneZiel('/scenes')).toBeNull()
  })

  it('verträgt einen führenden Schrägstrich oder keinen', () => {
    expect(erkenneZiel('scenes/42')).toEqual({ tabelle: 'scenes', id: 42 })
    expect(erkenneZiel('//scenes/42')).toEqual({ tabelle: 'scenes', id: 42 })
  })

  it('kennt zu jeder gesicherten Tabelle einen lesbaren Namen und ein Titelfeld', () => {
    for (const [tabelle, muster] of Object.entries(BEOBACHTET)) {
      expect(muster.bezeichnung, tabelle).toBeTruthy()
      expect(muster.titelfeld, tabelle).toBeTruthy()
      expect(muster.bezeichnung, tabelle).not.toMatch(/[–—]/)
    }
  })

  it('bewahrt lange genug auf, um einen Fehler zu bemerken', () => {
    expect(AUFBEWAHRUNG_TAGE).toBeGreaterThanOrEqual(14)
  })
})
