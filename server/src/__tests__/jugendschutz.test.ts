import { describe, it, expect } from 'vitest'
import {
  grenzeFuer, alterAm, minuten, pruefeEinsatz, KIND_BIS_ALTER, ANTRAGSUNTERLAGEN,
} from '../lib/jugendschutz'

/**
 * Der Jugendarbeitsschutz entscheidet darüber, ob gedreht werden darf. Ein
 * Fehler hier führt nicht zu einer falschen Zahl auf einem Blatt, sondern
 * dazu, dass ein Kind zu lange am Set steht - oder dass ein Drehtag abgesagt
 * wird, obwohl er zulässig gewesen wäre.
 *
 * Deshalb stehen hier die Grenzen aus dem Gesetzestext, und zwar genau an den
 * Kanten: ein Jahr darüber, ein Jahr darunter, eine Minute davor.
 */

describe('Grenzen nach § 6 Abs. 1 Nr. 2 JArbSchG', () => {
  it('schließt Kinder unter drei Jahren aus', () => {
    expect(grenzeFuer(0).erlaubt).toBe(false)
    expect(grenzeFuer(2).erlaubt).toBe(false)
    expect(grenzeFuer(3).erlaubt).toBe(true)
  })

  it('gibt über drei bis sechs Jahren zwei Stunden zwischen 8 und 17 Uhr', () => {
    for (const alter of [3, 4, 5, 6]) {
      const g = grenzeFuer(alter)
      expect(g.maxMinuten, `Alter ${alter}`).toBe(120)
      expect(g.vonStunde).toBe(8)
      expect(g.bisStunde).toBe(17)
    }
  })

  it('gibt über sechs Jahren drei Stunden zwischen 8 und 22 Uhr', () => {
    // Die Kante: Mit sechs gilt die untere Stufe, mit sieben die obere. Das
    // Gesetz sagt "über sechs Jahre" - ein Kind am sechsten Geburtstag ist
    // nicht über sechs.
    expect(grenzeFuer(6).maxMinuten).toBe(120)
    expect(grenzeFuer(7).maxMinuten).toBe(180)
    expect(grenzeFuer(7).bisStunde).toBe(22)
    expect(grenzeFuer(14).maxMinuten).toBe(180)
  })

  it('kennt die abweichenden Werte für Aufführungen', () => {
    const g = grenzeFuer(10, 'theater')
    expect(g.maxMinuten).toBe(240)
    expect(g.vonStunde).toBe(10)
    expect(g.bisStunde).toBe(23)
    // Bei den Kleinen ändert die Aufführung nichts.
    expect(grenzeFuer(5, 'theater').maxMinuten).toBe(120)
  })

  it('behandelt Jugendliche ab 15 nicht mehr als Kinder', () => {
    expect(KIND_BIS_ALTER).toBe(15)
    const kind = grenzeFuer(14)
    const jugendlicher = grenzeFuer(15)
    expect(kind.bewilligungNoetig).toBe(true)
    // Ab 15 greifen die allgemeinen Vorschriften, keine Einzelbewilligung.
    expect(jugendlicher.bewilligungNoetig).toBe(false)
    expect(jugendlicher.maxMinuten).toBe(480)
  })

  it('entscheidet ohne Alter gar nichts', () => {
    const g = grenzeFuer(NaN)
    expect(g.erlaubt).toBe(false)
    expect(g.grund).toContain('Geburtsdatum')
  })
})

describe('Alter am Drehtag', () => {
  it('zählt volle Jahre, nicht angefangene', () => {
    expect(alterAm('2020-06-15', '2026-06-14')).toBe(5)
    expect(alterAm('2020-06-15', '2026-06-15')).toBe(6)
    expect(alterAm('2020-06-15', '2026-06-16')).toBe(6)
  })

  it('stimmt über Schaltjahre hinweg', () => {
    // Am 29. Februar geboren: Im Nichtschaltjahr ist der Geburtstag am 1. März
    // noch nicht gewesen, wenn man nach Datumsteilen rechnet - und genau so
    // behandelt es die Praxis.
    expect(alterAm('2016-02-29', '2026-02-28')).toBe(9)
    expect(alterAm('2016-02-29', '2026-03-01')).toBe(10)
  })

  it('verrechnet sich nicht am Jahreswechsel', () => {
    expect(alterAm('2019-12-31', '2026-12-30')).toBe(6)
    expect(alterAm('2019-12-31', '2026-12-31')).toBe(7)
    expect(alterAm('2020-01-01', '2026-12-31')).toBe(6)
  })
})

describe('Uhrzeiten', () => {
  it('rechnet in Minuten seit Mitternacht', () => {
    expect(minuten('08:00')).toBe(480)
    expect(minuten('17:30')).toBe(1050)
    expect(minuten('7:05')).toBe(425)
    expect(Number.isNaN(minuten('Mittag'))).toBe(true)
    expect(Number.isNaN(minuten(''))).toBe(true)
  })
})

describe('Prüfung eines Einsatzes', () => {
  const basis = {
    name: 'Mila',
    geburtstag: '2020-03-10',   // am Drehtag 6 Jahre
    datum: '2026-07-15',
    bewilligung: true,
    einverstaendnis: true,
  }

  it('beanstandet nichts, wenn alles im Rahmen liegt', () => {
    const p = pruefeEinsatz({ ...basis, von: '09:00', bis: '11:00' })
    expect(p.alter).toBe(6)
    expect(p.istKind).toBe(true)
    expect(p.dauerMinuten).toBe(120)
    expect(p.befunde).toEqual([])
  })

  it('meldet eine zu lange Drehzeit', () => {
    const p = pruefeEinsatz({ ...basis, von: '09:00', bis: '12:30' })
    const verstoesse = p.befunde.filter((b) => b.art === 'verstoss')
    expect(verstoesse.length).toBe(1)
    expect(verstoesse[0].text).toContain('3.5 Stunden geplant')
  })

  it('meldet ein Ende nach dem erlaubten Zeitfenster', () => {
    // Sechsjährige dürfen nur bis 17 Uhr - eine Minute danach ist zu spät.
    const p = pruefeEinsatz({ ...basis, von: '15:30', bis: '17:01' })
    expect(p.befunde.some((b) => b.art === 'verstoss' && b.text.includes('17 Uhr'))).toBe(true)
    // Genau 17:00 ist noch zulässig.
    const knapp = pruefeEinsatz({ ...basis, von: '15:30', bis: '17:00' })
    expect(knapp.befunde).toEqual([])
  })

  it('meldet einen Beginn vor dem erlaubten Zeitfenster', () => {
    const p = pruefeEinsatz({ ...basis, von: '07:30', bis: '09:00' })
    expect(p.befunde.some((b) => b.text.includes('vor 8 Uhr'))).toBe(true)
  })

  it('besteht auf der Bewilligung', () => {
    const p = pruefeEinsatz({ ...basis, von: '09:00', bis: '11:00', bewilligung: false })
    const verstoss = p.befunde.find((b) => b.art === 'verstoss')
    expect(verstoss?.text).toContain('Bewilligung der Aufsichtsbehörde')
  })

  it('merkt das fehlende Einverständnis als Hinweis an, nicht als Verstoß', () => {
    // Das Einverständnis gehört zum Antrag. Fehlt es im System, heißt das
    // nicht, dass es nicht existiert - deshalb Hinweis, nicht Verstoß.
    const p = pruefeEinsatz({ ...basis, von: '09:00', bis: '11:00', einverstaendnis: false })
    expect(p.befunde.length).toBe(1)
    expect(p.befunde[0].art).toBe('hinweis')
  })

  it('lässt ein Kind unter drei Jahren gar nicht zu', () => {
    const p = pruefeEinsatz({ ...basis, geburtstag: '2024-01-01', von: '09:00', bis: '09:30' })
    expect(p.alter).toBe(2)
    expect(p.befunde.some((b) => b.art === 'verstoss' && b.text.includes('Unter drei Jahren'))).toBe(true)
  })

  it('prüft Volljährige nicht', () => {
    const p = pruefeEinsatz({ ...basis, geburtstag: '1998-05-20', von: '06:00', bis: '22:00' })
    expect(p.alter).toBe(28)
    expect(p.istKind).toBe(false)
    expect(p.befunde).toEqual([])
  })

  it('sagt ohne Geburtsdatum, dass es nichts sagen kann', () => {
    const p = pruefeEinsatz({ ...basis, geburtstag: null, von: '09:00', bis: '11:00' })
    expect(p.befunde.length).toBe(1)
    expect(p.befunde[0].art).toBe('hinweis')
    expect(p.befunde[0].text).toContain('Kein Geburtsdatum')
  })

  it('zählt mehrere Verstöße einzeln auf', () => {
    // Zu früh, zu lang und ohne Bewilligung - alle drei müssen genannt werden,
    // sonst behebt jemand einen und glaubt, es sei erledigt.
    const p = pruefeEinsatz({ ...basis, von: '07:00', bis: '12:00', bewilligung: false })
    expect(p.befunde.filter((b) => b.art === 'verstoss').length).toBe(3)
  })
})

describe('Antragsunterlagen', () => {
  it('nennt die Stellungnahmen, die am längsten dauern', () => {
    const text = ANTRAGSUNTERLAGEN.join(' ')
    expect(text).toContain('Erziehungsberechtigten')
    expect(text).toContain('Schule')
    expect(text).toContain('Jugendamts')
  })
})
