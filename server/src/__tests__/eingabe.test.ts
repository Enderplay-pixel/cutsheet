/**
 * Eingabepruefung an der Grenze.
 *
 * Anlass: fuenf Faelle endeten am 23.09.2026 in einem HTTP 500, weil Unsinn
 * bis zur Datenbank durchlief und Postgres mit seiner eigenen Meldung
 * antwortete - inklusive Spaltentyp und Kodierung.
 */
import { describe, it, expect, vi } from 'vitest'
import { MELDUNGEN } from '../lib/meldungenText'
import {
  istGueltigeId, istIdParameter, pruefeIdParameter, saeubereKoerper,
  uebersetzeDatenbankfehler, PG_INT_MAX,
} from '../middleware/eingabe'

function antwort() {
  const r: any = { code: 0, koerper: null, headersSent: false }
  r.status = (c: number) => { r.code = c; return r }
  r.json = (k: any) => { r.koerper = k; return r }
  return r
}

describe('istGueltigeId', () => {
  it('nimmt normale Kennungen', () => {
    expect(istGueltigeId('1')).toBe(true)
    expect(istGueltigeId('4711')).toBe(true)
    expect(istGueltigeId(String(PG_INT_MAX))).toBe(true)
  })

  it('weist ab, was keine Kennung sein kann', () => {
    for (const w of ['abc', '', '  ', '-5', '1.5', '1e5', 'NaN', null, undefined, '0']) {
      expect(istGueltigeId(w as any), String(w)).toBe(false)
    }
  })

  it('weist Zahlen ausserhalb der Spaltenreichweite ab', () => {
    expect(istGueltigeId(String(PG_INT_MAX + 1))).toBe(false)
    expect(istGueltigeId('99999999999999999999')).toBe(false)
  })
})

describe('istIdParameter', () => {
  it('erkennt Kennungsparameter', () => {
    for (const n of ['id', 'projectId', 'dayId', 'videoId', 'sceneId']) {
      expect(istIdParameter(n), n).toBe(true)
    }
  })

  it('laesst Token und Namen in Ruhe', () => {
    for (const n of ['token', 'slug', 'name', 'nach']) {
      expect(istIdParameter(n), n).toBe(false)
    }
  })
})

describe('pruefeIdParameter', () => {
  it('laesst gueltige Kennungen durch', () => {
    const next = vi.fn(); const res = antwort()
    pruefeIdParameter({ params: { projectId: '7', token: 'egal-was' } } as any, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.code).toBe(0)
  })

  it('antwortet mit 400 statt die Datenbank zu fragen', () => {
    const next = vi.fn(); const res = antwort()
    pruefeIdParameter({ params: { projectId: 'abc' } } as any, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.code).toBe(400)
    expect(res.koerper.error).toContain('abc')
  })

  it('kuerzt lange Eingaben in der Meldung', () => {
    const res = antwort()
    pruefeIdParameter({ params: { id: 'x'.repeat(500) } } as any, res, vi.fn() as any)
    expect(res.koerper.error.length).toBeLessThan(120)
  })
})

describe('saeubereKoerper', () => {
  it('entfernt Nullbytes, statt die Anfrage abzulehnen', () => {
    const req: any = { body: { titel: 'vorher\u0000nachher', tief: { a: ['x\u0000y'] } } }
    const next = vi.fn(); const res = antwort()
    saeubereKoerper(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.body.titel).toBe('vorhernachher')
    expect(req.body.tief.a[0]).toBe('xy')
  })

  it('weist ganze Zahlen ausserhalb der Spaltenreichweite ab', () => {
    const next = vi.fn(); const res = antwort()
    saeubereKoerper({ body: { eighths: 10 ** 15 } } as any, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.code).toBe(400)
    expect(res.koerper.error).toContain('eighths')
  })

  // Gemessen am 12.11.2026: Ein Einzelpreis von 30 Mio. € wurde abgelehnt,
  // weil fuer Geld die Grenze von INTEGER galt.
  it('laesst Geldbetraege ueber 21,4 Mio. Euro durch', () => {
    const next = vi.fn(); const res = antwort()
    saeubereKoerper({ body: { unit_price_cents: 3_000_000_000, zeilen: [{ amount_cents: 2_500_000_000 }], fee_per_day: 2_200_000_000 } } as any, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.code).toBe(0)
  })

  it('weist Geldbetraege ueber der Geldgrenze ab und nennt sie in Euro', () => {
    const next = vi.fn(); const res = antwort()
    saeubereKoerper({ body: { zeilen: [{ unit_price_cents: 10 ** 12 }] } } as any, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.code).toBe(400)
    expect(res.koerper.error).toBe('Betrag zu groß (höchstens 999.999.999,99 €): zeilen[0].unit_price_cents.')
  })

  it('laesst die Grenze von INTEGER fuer alles andere stehen', () => {
    const next = vi.fn(); const res = antwort()
    saeubereKoerper({ body: { total_days: 3_000_000_000 } } as any, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.koerper.error).toContain('total_days')
    expect(res.koerper.error).toContain('2.147.483.647')
  })

  it('laesst Kommazahlen in Ruhe', () => {
    const next = vi.fn(); const res = antwort()
    saeubereKoerper({ body: { menge: 1.5, preis: 12.34 } } as any, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.code).toBe(0)
  })

  it('kommt ohne Koerper aus', () => {
    const next = vi.fn()
    saeubereKoerper({ } as any, antwort(), next)
    expect(next).toHaveBeenCalled()
  })
})

describe('uebersetzeDatenbankfehler', () => {
  const faelle: Array<[string, number, string]> = [
    ['invalid input syntax for type integer: "NaN"', 400, 'Text übergeben'],
    ['value "100000000000000000000" is out of range for type integer', 400, 'Bereichs'],
    ['invalid byte sequence for encoding "UTF8": 0x00', 400, 'gespeichert'],
    ['insert violates foreign key constraint "fk_x"', 409, 'hängt an'],
    ['duplicate key value violates unique constraint "u_x"', 409, 'bereits'],
    ['null value violates not-null constraint', 400, 'Pflichtfeld'],
    ['invalid input syntax for type date: "abc"', 400, 'Datum'],
    ['invalid input syntax for type timestamp: "abc 00:00:00"', 400, 'Datum'],
    ['date/time field value out of range: "2026-13-45"', 400, 'Datum'],
  ]

  for (const [meldung, code, teil] of faelle) {
    it(`uebersetzt: ${meldung.slice(0, 40)}`, () => {
      const res = antwort()
      uebersetzeDatenbankfehler({ message: meldung }, {} as any, res, vi.fn() as any)
      expect(res.code).toBe(code)
      expect(res.koerper.error).toContain(teil)
      // Die Rohmeldung darf nicht nach aussen
      expect(res.koerper.error).not.toContain('constraint')
      expect(res.koerper.error).not.toContain('type integer')
      // Und der Satz kommt auch englisch und französisch an - gemessen am
      // 24.10.2026 kamen diese Sätze mit "X-Sprache: en" deutsch.
      expect(MELDUNGEN[res.koerper.error], 'Übersetzung in lib/meldungenText.ts').toBeTruthy()
    })
  }

  it('haelt Unbekanntes zurueck, statt es durchzureichen', () => {
    const res = antwort()
    const leise = vi.spyOn(console, 'error').mockImplementation(() => {})
    uebersetzeDatenbankfehler({ message: 'SELECT * FROM geheim WHERE x = 1' }, {} as any, res, vi.fn() as any)
    expect(res.code).toBe(500)
    expect(res.koerper.error).toBe('Unerwarteter Serverfehler.')
    expect(res.koerper.error).not.toContain('SELECT')
    leise.mockRestore()
  })
})
