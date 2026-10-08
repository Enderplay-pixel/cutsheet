import { describe, it, expect } from 'vitest'
import {
  base32Kodieren,
  base32Dekodieren,
  hotp,
  totp,
  pruefeCode,
  otpauthUrl,
  erzeugeSchluessel,
  erzeugeWiederherstellungscodes,
  normalisiereCode,
  FENSTER_SEKUNDEN,
} from '../lib/zweiterFaktor'

/**
 * Die Testvektoren stammen aus den Standards selbst, nicht aus dem eigenen
 * Code. Nur so ist nachgewiesen, dass die Rechnung mit jeder
 * Authenticator-App zusammenpasst - und nicht bloss mit sich selbst.
 */

describe('Base32 nach RFC 4648', () => {
  it('kodiert die Beispiele des Standards', () => {
    expect(base32Kodieren(Buffer.from('f'))).toBe('MY')
    expect(base32Kodieren(Buffer.from('fo'))).toBe('MZXQ')
    expect(base32Kodieren(Buffer.from('foo'))).toBe('MZXW6')
    expect(base32Kodieren(Buffer.from('foob'))).toBe('MZXW6YQ')
    expect(base32Kodieren(Buffer.from('fooba'))).toBe('MZXW6YTB')
    expect(base32Kodieren(Buffer.from('foobar'))).toBe('MZXW6YTBOI')
  })

  it('dekodiert wieder zum Ausgangswert', () => {
    for (const wort of ['f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) {
      expect(base32Dekodieren(base32Kodieren(Buffer.from(wort))).toString()).toBe(wort)
    }
  })

  it('überliest Leerzeichen und Kleinbuchstaben', () => {
    expect(base32Dekodieren('mzxw 6ytb oi').toString()).toBe('foobar')
  })
})

describe('HOTP nach RFC 4226', () => {
  // Anhang D des RFC: Schlüssel "12345678901234567890", Zähler 0 bis 9
  const schluessel = Buffer.from('12345678901234567890')
  const erwartet = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489']

  it('rechnet die zehn Testvektoren des Standards', () => {
    for (let zaehler = 0; zaehler < erwartet.length; zaehler++) {
      expect(hotp(schluessel, zaehler), `Zähler ${zaehler}`).toBe(erwartet[zaehler])
    }
  })
})

describe('TOTP nach RFC 6238', () => {
  // Anhang B des RFC. Der Schlüssel ist für SHA-1 "12345678901234567890".
  const sha1 = Buffer.from('12345678901234567890')

  it('rechnet die Testvektoren mit acht Stellen', () => {
    const faelle: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ]
    for (const [sekunden, code] of faelle) {
      expect(totp(sha1, sekunden, 'sha1', 8), `t=${sekunden}`).toBe(code)
    }
  })

  it('liefert innerhalb eines Fensters denselben Code', () => {
    const schluessel = erzeugeSchluessel()
    const basis = 1_700_000_000 - (1_700_000_000 % FENSTER_SEKUNDEN)
    expect(totp(schluessel, basis)).toBe(totp(schluessel, basis + FENSTER_SEKUNDEN - 1))
  })

  it('liefert im nächsten Fenster einen anderen Code', () => {
    const schluessel = erzeugeSchluessel()
    const basis = 1_700_000_000 - (1_700_000_000 % FENSTER_SEKUNDEN)
    expect(totp(schluessel, basis)).not.toBe(totp(schluessel, basis + FENSTER_SEKUNDEN))
  })
})

describe('Code prüfen', () => {
  const schluessel = 'JBSWY3DPEHPK3PXP'
  const jetzt = 1_700_000_000

  it('nimmt den Code des aktuellen Fensters an', () => {
    expect(pruefeCode(schluessel, totp(schluessel, jetzt), jetzt)).toBe(true)
  })

  it('verzeiht eine Uhr, die ein Fenster daneben liegt', () => {
    expect(pruefeCode(schluessel, totp(schluessel, jetzt - FENSTER_SEKUNDEN), jetzt)).toBe(true)
    expect(pruefeCode(schluessel, totp(schluessel, jetzt + FENSTER_SEKUNDEN), jetzt)).toBe(true)
  })

  it('weist einen Code von vor zwei Minuten zurück', () => {
    expect(pruefeCode(schluessel, totp(schluessel, jetzt - 120), jetzt)).toBe(false)
  })

  it('weist Unfug zurück', () => {
    for (const eingabe of ['', '12345', '1234567', 'abcdef', '000000']) {
      // 000000 kann zufällig stimmen - dann hätte der Test einen echten Grund,
      // und das wäre ein Treffer von eins zu einer Million.
      if (eingabe === '000000' && totp(schluessel, jetzt) === '000000') continue
      expect(pruefeCode(schluessel, eingabe, jetzt), eingabe).toBe(false)
    }
  })

  it('verträgt Leerzeichen in der Eingabe', () => {
    const code = totp(schluessel, jetzt)
    expect(pruefeCode(schluessel, `${code.slice(0, 3)} ${code.slice(3)}`, jetzt)).toBe(true)
  })
})

describe('Einrichtung', () => {
  it('erzeugt Schlüssel, die sich unterscheiden', () => {
    const schluessel = new Set(Array.from({ length: 20 }, () => erzeugeSchluessel()))
    expect(schluessel.size).toBe(20)
    for (const einer of schluessel) expect(einer).toMatch(/^[A-Z2-7]{32}$/)
  })

  it('baut einen Link, den Authenticator-Apps lesen', () => {
    const url = otpauthUrl('JBSWY3DPEHPK3PXP', 'florian@example.de')
    expect(url).toMatch(/^otpauth:\/\/totp\//)
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(url).toContain('issuer=CutSheet')
    expect(url).toContain('period=30')
    expect(url).toContain(encodeURIComponent('CutSheet:florian@example.de'))
  })

  it('erzeugt lesbare Wiederherstellungscodes', () => {
    const codes = erzeugeWiederherstellungscodes(8)
    expect(codes).toHaveLength(8)
    expect(new Set(codes).size).toBe(8)
    for (const code of codes) expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/)
  })

  it('vergleicht Wiederherstellungscodes nachsichtig', () => {
    expect(normalisiereCode('abcde-fghij')).toBe('ABCDEFGHIJ')
    expect(normalisiereCode('ABCDE FGHIJ')).toBe('ABCDEFGHIJ')
  })
})
