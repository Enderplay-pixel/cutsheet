import { describe, it, expect } from 'vitest'
import { toPg } from '../db'

/**
 * Der SQL-Uebersetzer stand am Ursprung eines Fehlers, der wochenlang
 * unbemerkt blieb: Ein `datetime("now")` mit doppelten Anfuehrungszeichen ist
 * in Postgres ein Bezeichner und keine Zeichenkette. Das UPDATE der Tagesdispo
 * lief damit in einen Fehler, und jede manuelle Aenderung der Call-Zeiten ging
 * still verloren.
 */
describe('toPg', () => {
  it('setzt Platzhalter fortlaufend um', () => {
    expect(toPg('SELECT * FROM t WHERE a = ? AND b = ?')).toBe('SELECT * FROM t WHERE a = $1 AND b = $2')
  })

  it('uebersetzt datetime mit einfachen Anfuehrungszeichen', () => {
    expect(toPg("UPDATE t SET x = datetime('now')")).toBe('UPDATE t SET x = NOW()')
  })

  it('uebersetzt datetime auch mit doppelten Anfuehrungszeichen', () => {
    // Ohne diese Regel bliebe "now" als Bezeichner stehen und die Abfrage schluege fehl
    expect(toPg('UPDATE t SET x = datetime("now")')).toBe('UPDATE t SET x = NOW()')
  })

  it('laesst nach der Uebersetzung kein datetime uebrig', () => {
    const sql = toPg(`UPDATE a SET x = datetime('now'), y = datetime("now") WHERE id = ?`)
    expect(sql).not.toContain('datetime')
    expect(sql).toContain('$1')
  })

  it('uebersetzt relative Zeitangaben', () => {
    expect(toPg("SELECT * FROM t WHERE d > datetime('now', '-7 days')"))
      .toContain("NOW() - INTERVAL '-7 days'")
  })

  it('setzt date(now) auf CURRENT_DATE', () => {
    expect(toPg("SELECT date('now')")).toBe('SELECT CURRENT_DATE')
  })

  it('maskiert das reservierte Wort cast', () => {
    expect(toPg('SELECT * FROM cast')).toBe('SELECT * FROM "cast"')
  })

  it('laesst CAST-Funktionsaufrufe in Ruhe', () => {
    expect(toPg('SELECT CAST(x AS INTEGER)')).toContain('CAST(')
  })
})
