/**
 * Fehlermeldungen in der Sprache der Oberfläche.
 *
 * Der Wächter unten liest jede feste Meldung `error: '...'` aus dem Quelltext
 * und verlangt einen Eintrag in MELDUNGEN. Ohne ihn bliebe eine neue Meldung
 * auf einer englischen Oberfläche unbemerkt deutsch.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { meldungenUebersetzen } from '../middleware/sprache'
import { MELDUNGEN } from '../lib/meldungenText'

let server: http.Server
let basis = ''

beforeAll(async () => {
  const app = express()
  app.use('/api', meldungenUebersetzen)
  app.get('/api/fehlt', (_req, res) => res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' }))
  app.get('/api/unbekannt', (_req, res) => res.status(400).json({ data: null, error: 'Ein Satz, den es nicht gibt' }))
  app.get('/api/gut', (_req, res) => res.json({ data: { ok: true }, error: null }))
  await new Promise<void>((fertig) => {
    server = app.listen(0, () => {
      basis = `http://127.0.0.1:${(server.address() as any).port}`
      fertig()
    })
  })
})

afterAll(() => {
  server?.closeAllConnections?.()
  server?.close()
})

async function hole(pfad: string, sprache?: string) {
  const r = await fetch(`${basis}${pfad}`, { headers: sprache ? { 'X-Sprache': sprache } : {} })
  return { status: r.status, rumpf: (await r.json()) as any }
}

describe('Übersetzung der Meldungen', () => {
  it('übersetzt ins Englische und Französische', async () => {
    expect((await hole('/api/fehlt', 'en')).rumpf.error).toBe(MELDUNGEN['Rechnung nicht gefunden'].en)
    expect((await hole('/api/fehlt', 'fr')).rumpf.error).toBe(MELDUNGEN['Rechnung nicht gefunden'].fr)
  })

  it('lässt Deutsch und fehlende Sprache unverändert', async () => {
    expect((await hole('/api/fehlt', 'de')).rumpf.error).toBe('Rechnung nicht gefunden')
    expect((await hole('/api/fehlt')).rumpf.error).toBe('Rechnung nicht gefunden')
  })

  it('behält Status und lässt unbekannte Sätze und Erfolge in Ruhe', async () => {
    const fehlt = await hole('/api/fehlt', 'en')
    expect(fehlt.status).toBe(404)
    expect((await hole('/api/unbekannt', 'en')).rumpf.error).toBe('Ein Satz, den es nicht gibt')
    expect((await hole('/api/gut', 'en')).rumpf).toEqual({ data: { ok: true }, error: null })
  })
})

describe('Meldungen mit eingesetzten Werten', () => {
  it('übersetzt den Rahmen und behält die Werte', async () => {
    const { uebersetzeMeldung } = await import('../middleware/sprache')
    expect(uebersetzeMeldung('Zu viele Fehlversuche. Bitte 30 Sekunden warten.', 'en'))
      .toBe('Too many failed attempts. Please wait 30 seconds.')
    expect(uebersetzeMeldung('3 Punkte stehen dem Abschluss entgegen. Zum Abschließen trotzdem bestätigen.', 'fr'))
      .toBe('3 point(s) bloquent la clôture. Confirmez pour clôturer quand même.')
    expect(uebersetzeMeldung('PDF-Fehler: Timeout', 'en')).toBe('PDF error: Timeout')
    expect(uebersetzeMeldung('API: zu viele Anfragen. Bitte 12 Sekunden warten.', 'en'))
      .toBe('API: too many requests. Please wait 12 seconds.')
  })

  it('jeder Template-Text im Server passt auf ein Muster', async () => {
    const { uebersetzeMeldung } = await import('../middleware/sprache')
    // Werte durch Beispiele ersetzen und prüfen, dass etwas übersetzt wird
    const muster = /error:\s*`([^`]*\$\{[^`]*)`/g
    const unerkannt: string[] = []
    for (const ordner of ['routes', 'middleware', 'lib']) {
      const pfad = path.join(__dirname, '..', ordner)
      for (const datei of fs.readdirSync(pfad).filter((d) => d.endsWith('.ts'))) {
        const quelle = fs.readFileSync(path.join(pfad, datei), 'utf8')
        for (const treffer of quelle.matchAll(muster)) {
          const beispiel = treffer[1]
            .replace(/\$\{summe\} \$\{summe === 1 \? 'Punkt steht' : 'Punkte stehen'\}/, '2 Punkte stehen')
            .replace(/\$\{[^}]*\}/g, '7')
          // Fortsetzung in der nächsten Zeile (+ '...') fehlt hier - nur der Anfang zählt
          if (uebersetzeMeldung(beispiel, 'en') === beispiel && !/Abschluss entgegen|Bereichs/.test(beispiel)) {
            unerkannt.push(`${ordner}/${datei}: ${beispiel}`)
          }
        }
      }
    }
    expect(unerkannt).toEqual([])
  })
})

describe('Jede feste Meldung hat eine Übersetzung', () => {
  it('kein error-Text im Server ohne Eintrag in MELDUNGEN', () => {
    const muster = /error:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`$]*`)/g
    const fehlend = new Set<string>()
    for (const ordner of ['routes', 'middleware', 'lib']) {
      const pfad = path.join(__dirname, '..', ordner)
      for (const datei of fs.readdirSync(pfad).filter((d) => d.endsWith('.ts'))) {
        // Zeilen mit console.* sind Protokoll, keine Antwort ("parse error:', parseErr")
        const quelle = fs.readFileSync(path.join(pfad, datei), 'utf8')
          .split('\n').filter((z) => !z.includes('console.')).join('\n')
        for (const treffer of quelle.matchAll(muster)) {
          const text = treffer[1].slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"')
          if (!MELDUNGEN[text]) fehlend.add(`${ordner}/${datei}: ${text}`)
        }
      }
    }
    expect([...fehlend]).toEqual([])
  })

  it('keine Übersetzung mit Gedankenstrich', () => {
    const falsch = Object.entries(MELDUNGEN)
      .filter(([, t]) => /[–—]/.test(t.en + t.fr))
      .map(([schluessel]) => schluessel)
    expect(falsch).toEqual([])
  })
})
