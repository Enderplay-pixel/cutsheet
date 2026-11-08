/**
 * Die Angaben, von denen die Jugendschutzprüfung lebt: Geburtsdatum,
 * Erziehungsberechtigte, Bewilligung nach § 6 JArbSchG, Schulpflicht.
 *
 * Geprüft wird hier, bevor `PUT /jugendschutz/:art/:id` schreibt. Vorher
 * nahm die Route jeden Text als Datum ("abc" endete als Datenbankfehler)
 * und jede Adresse als E-Mail der Erziehungsberechtigten - an die gehen
 * die Verträge eines Kindes.
 *
 * Gespeichert wird nur, was im Körper der Anfrage steht.
 */
import { heuteISO, istIsoDatum } from './datum'

export type Personenart = 'cast' | 'extra'

const SPALTEN: Record<Personenart, readonly string[]> = {
  cast: ['birthdate', 'guardian_name', 'guardian_email', 'guardian_phone', 'permit_granted', 'permit_reference', 'permit_valid_until', 'school_bound'],
  extra: ['birthdate', 'guardian_name', 'guardian_email', 'permit_granted', 'school_bound'],
}

const DATUM = new Set(['birthdate', 'permit_valid_until'])
const TEXT = new Set(['guardian_name', 'guardian_email', 'guardian_phone', 'permit_reference'])
const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type Felder = { spalten: string[]; werte: unknown[] }

/** Prüft die Jugendschutz-Angaben im Körper; ein Fehler ist ein Satz für die Oberfläche. */
export function jugendschutzFelder(body: Record<string, unknown>, art: Personenart): Felder | { fehler: string } {
  const spalten: string[] = []
  const werte: unknown[] = []
  for (const spalte of SPALTEN[art]) {
    if (!body || !(spalte in body)) continue
    const roh = body[spalte]
    let wert: unknown
    if (DATUM.has(spalte)) {
      if (roh === null || roh === '') wert = null
      else if (!istIsoDatum(roh)) return { fehler: 'Ungültiges Datum' }
      else if (spalte === 'birthdate' && (String(roh) > heuteISO() || String(roh) < '1900-01-01')) {
        return { fehler: 'Das Geburtsdatum kann nicht stimmen' }
      } else wert = String(roh)
    } else if (TEXT.has(spalte)) {
      if (roh !== null && typeof roh !== 'string') return { fehler: 'Ungültige Angabe' }
      wert = String(roh ?? '').trim()
      if ((wert as string).length > 200) return { fehler: 'Die Angabe ist zu lang' }
      if (spalte === 'guardian_email' && wert && !MAIL.test(wert as string)) {
        return { fehler: 'Die E-Mail der Erziehungsberechtigten ist ungültig' }
      }
    } else if (spalte === 'permit_granted') {
      if (typeof roh !== 'boolean') return { fehler: 'Ungültige Angabe zur Bewilligung' }
      wert = roh
    } else if (spalte === 'school_bound') {
      // null heißt "nicht erfasst" - die Prüfung erinnert dann daran
      if (roh !== null && typeof roh !== 'boolean') return { fehler: 'Ungültige Angabe zur Schulpflicht' }
      wert = roh
    }
    spalten.push(spalte)
    werte.push(wert)
  }
  return { spalten, werte }
}
