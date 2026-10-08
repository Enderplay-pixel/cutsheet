/**
 * Zeitbasierte Einmalkennwörter nach RFC 6238 (TOTP).
 *
 * Selbst gerechnet statt eine Abhängigkeit zu holen: Das Verfahren ist ein
 * HMAC über einen Zähler, und HMAC-SHA1 steckt in Node. Die Testvektoren aus
 * dem RFC stehen im Test - damit ist nachgewiesen, dass die Rechnung stimmt,
 * und nicht nur, dass sie mit sich selbst übereinstimmt.
 *
 * Verwendet wird es für die zweite Stufe der Anmeldung: Wer das Passwort
 * kennt, braucht zusätzlich das Gerät, auf dem der Schlüssel liegt.
 */
import crypto from 'crypto'

/** Zeichenvorrat der Base32-Kodierung nach RFC 4648, ohne Polster. */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Länge eines Zeitfensters in Sekunden. 30 ist der Standard aller Apps. */
export const FENSTER_SEKUNDEN = 30

/** Stellen des Codes. */
export const STELLEN = 6

/**
 * Wie viele Fenster vor und nach dem aktuellen noch gelten.
 *
 * Eins in jede Richtung: Das deckt eine Uhr ab, die eine halbe Minute
 * nachgeht, ohne das Zeitfenster unnötig zu verbreitern.
 */
export const TOLERANZ_FENSTER = 1

export function base32Kodieren(rohdaten: Buffer): string {
  let bits = 0
  let wert = 0
  let ergebnis = ''
  for (const byte of rohdaten) {
    wert = (wert << 8) | byte
    bits += 8
    while (bits >= 5) {
      ergebnis += BASE32[(wert >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) ergebnis += BASE32[(wert << (5 - bits)) & 31]
  return ergebnis
}

export function base32Dekodieren(text: string): Buffer {
  const sauber = text.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let wert = 0
  const bytes: number[] = []
  for (const zeichen of sauber) {
    const index = BASE32.indexOf(zeichen)
    if (index < 0) continue
    wert = (wert << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((wert >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** Neuer Schlüssel, 20 Byte wie im RFC empfohlen. */
export function erzeugeSchluessel(): string {
  return base32Kodieren(crypto.randomBytes(20))
}

/**
 * Einmalkennwort für einen Zähler (HOTP, RFC 4226).
 * `algorithmus` ist nur für die Testvektoren nötig; Apps nutzen SHA-1.
 */
export function hotp(schluessel: Buffer, zaehler: number, algorithmus = 'sha1', stellen = STELLEN): string {
  const puffer = Buffer.alloc(8)
  puffer.writeBigUInt64BE(BigInt(zaehler))
  const abdruck = crypto.createHmac(algorithmus, schluessel).update(puffer).digest()
  const versatz = abdruck[abdruck.length - 1] & 0x0f
  const zahl =
    ((abdruck[versatz] & 0x7f) << 24) |
    ((abdruck[versatz + 1] & 0xff) << 16) |
    ((abdruck[versatz + 2] & 0xff) << 8) |
    (abdruck[versatz + 3] & 0xff)
  return String(zahl % 10 ** stellen).padStart(stellen, '0')
}

/** Einmalkennwort zu einem Zeitpunkt (Sekunden seit 1970). */
export function totp(
  schluessel: string | Buffer,
  sekunden: number = Math.floor(Date.now() / 1000),
  algorithmus = 'sha1',
  stellen = STELLEN,
  fenster = FENSTER_SEKUNDEN
): string {
  const rohdaten = typeof schluessel === 'string' ? base32Dekodieren(schluessel) : schluessel
  return hotp(rohdaten, Math.floor(sekunden / fenster), algorithmus, stellen)
}

/**
 * Prüft einen eingegebenen Code gegen den Schlüssel.
 *
 * Der Vergleich läuft über `timingSafeEqual`: Ein Vergleich, der beim ersten
 * falschen Zeichen abbricht, verrät über die Dauer, wie viele Stellen stimmen.
 */
export function pruefeCode(
  schluessel: string,
  eingabe: string,
  sekunden: number = Math.floor(Date.now() / 1000)
): boolean {
  const sauber = String(eingabe || '').replace(/\D/g, '')
  if (sauber.length !== STELLEN) return false
  for (let versatz = -TOLERANZ_FENSTER; versatz <= TOLERANZ_FENSTER; versatz++) {
    const erwartet = totp(schluessel, sekunden + versatz * FENSTER_SEKUNDEN)
    const a = Buffer.from(erwartet)
    const b = Buffer.from(sauber)
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true
  }
  return false
}

/**
 * Der Link, den die App als Strichcode anzeigt.
 * `otpauth://totp/CutSheet:name@example.de?secret=…&issuer=CutSheet`
 */
export function otpauthUrl(schluessel: string, konto: string, herausgeber = 'CutSheet'): string {
  const name = encodeURIComponent(`${herausgeber}:${konto}`)
  const werte = new URLSearchParams({
    secret: schluessel,
    issuer: herausgeber,
    algorithm: 'SHA1',
    digits: String(STELLEN),
    period: String(FENSTER_SEKUNDEN),
  })
  return `otpauth://totp/${name}?${werte.toString()}`
}

/**
 * Wiederherstellungscodes für den Fall, dass das Gerät weg ist.
 * Je Code zehn Zeichen, in zwei Gruppen - leicht abzuschreiben.
 */
export function erzeugeWiederherstellungscodes(anzahl = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < anzahl; i++) {
    const roh = base32Kodieren(crypto.randomBytes(7)).slice(0, 10)
    codes.push(`${roh.slice(0, 5)}-${roh.slice(5)}`)
  }
  return codes
}

/** Vergleichsform eines Codes: ohne Trennzeichen, in Großbuchstaben. */
export function normalisiereCode(code: string): string {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
