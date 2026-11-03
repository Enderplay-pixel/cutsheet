/**
 * Datum und Uhrzeit in Dokumenten und Mails immer in Berliner Zeit.
 *
 * Der Server beim Hoster läuft in UTC. Ohne Zeitzone formatierte er den
 * Sonnenaufgang im Morning Brief zwei Stunden zu früh: gemessen unter TZ=UTC
 * 06:02 statt 08:02 für Bochum am 19.10.2026. Ebenso "Erstellt am" im
 * Abnahmeprotokoll.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Berliner Zeit unabhängig von der Serverzone', () => {
  it('läuft in UTC wie der Server beim Hoster', () => {
    // vitest.config.ts setzt die Zone. Bis zum 03.11.2026 stellte dieser Test
    // sie selbst um - das wirkt im Worker nicht, alles lief in Berliner Zeit.
    expect(new Date('2026-07-01T12:00:00Z').getTimezoneOffset()).toBe(0)
  })

  it('zeigt einen Zeitpunkt unter UTC in Berliner Zeit', async () => {
    const sonnenaufgang = new Date('2026-10-19T06:02:00Z')
    expect(sonnenaufgang.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })).toBe('08:02')
  })

  it('verschiebt ein reines Datum aus der Datenbank um keinen Tag', async () => {
    const { fmtDate } = await import('../lib/documentLayout')
    expect(fmtDate('2026-10-19')).toBe('19.10.2026')
    expect(fmtDate('2026-03-29'), 'Sommerzeitbeginn').toBe('29.03.2026')
  })

  it('kein Datumsformat auf dem Server ohne Zeitzone', () => {
    const fundstellen: string[] = []
    for (const ordner of ['routes', 'lib']) {
      const pfad = path.join(__dirname, '..', ordner)
      for (const datei of fs.readdirSync(pfad).filter((d) => d.endsWith('.ts'))) {
        fs.readFileSync(path.join(pfad, datei), 'utf8').split('\n').forEach((zeile, i) => {
          if (/toLocale(Date|Time)String\(/.test(zeile) && !zeile.includes("timeZone: 'Europe/Berlin'")) {
            fundstellen.push(`${ordner}/${datei}:${i + 1}`)
          }
          if (/(new Date\(\)|\bd)\.toLocaleString\('de-DE'/.test(zeile) && !zeile.includes('timeZone')) {
            fundstellen.push(`${ordner}/${datei}:${i + 1}`)
          }
        })
      }
    }
    expect(fundstellen).toEqual([])
  })
})
