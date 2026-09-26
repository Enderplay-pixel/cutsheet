import { Request, Response, NextFunction } from 'express'

/**
 * Eingabepruefung an der Grenze.
 *
 * Ohne sie erreicht Unsinn die Datenbank, und Postgres antwortet mit seiner
 * eigenen Fehlermeldung. Gemessen am 23.09.2026 endeten fuenf Faelle in einem
 * HTTP 500:
 *
 *   /projects/abc                    invalid input syntax for type integer
 *   /projects/99999999999999999999   out of range for type integer
 *   /shoot-days/xyz/call-sheet       invalid input syntax for type integer
 *   eighths: 10^15                   out of range for type integer
 *   Titel mit \u0000                 invalid byte sequence for encoding UTF8
 *
 * 500 heisst "unbehandelt". Hier wird daraus ein 400 mit einem Satz, den ein
 * Mensch versteht - und die Postgres-Meldung bleibt drinnen.
 */

/** Grenzen von Postgres' INTEGER. Alles darueber sprengt die Spalte. */
export const PG_INT_MAX = 2147483647
export const PG_INT_MIN = -2147483648

/** Eine Id ist eine ganze Zahl in Postgres-Reichweite, nichts anderes. */
export function istGueltigeId(wert: unknown): boolean {
  const s = String(wert ?? '').trim()
  if (!/^\d{1,10}$/.test(s)) return false
  const n = Number(s)
  return Number.isSafeInteger(n) && n >= 1 && n <= PG_INT_MAX
}

/** Parameter, die eine Id tragen - alles auf "id" endend, ohne Token-Pfade. */
export function istIdParameter(name: string): boolean {
  return name === 'id' || /Id$/.test(name)
}

/**
 * Pfadstücke an der Stelle einer Id, die keine Id sind.
 *
 * `/api/projects/import` trifft dasselbe Muster wie `/api/projects/7`, und
 * die Prüfung wies "import" als ungültige Kennung ab - der Import einer
 * Sicherung war damit unerreichbar. Gemessen am 26.09.2026 beim Versuch,
 * eine Sicherung zurückzuspielen.
 *
 * Bewusst eine kurze Liste statt einer allgemeinen Ausnahme: jede weitere
 * Route dieser Art soll hier auffallen, nicht stillschweigend durchrutschen.
 */
const KEINE_ID = new Set(['import'])

export function pruefeIdParameter(req: Request, res: Response, next: NextFunction) {
  for (const [name, wert] of Object.entries(req.params ?? {})) {
    if (KEINE_ID.has(String(wert))) continue
    if (!istIdParameter(name)) continue
    if (!istGueltigeId(wert)) {
      return res.status(400).json({
        data: null,
        error: `Ungültige Kennung "${String(wert).slice(0, 40)}" für ${name}.`,
      })
    }
  }
  next()
}

/**
 * Nullbytes entfernen und Zahlen begrenzen.
 *
 * Ein \u0000 im Text ist in Postgres nicht speicherbar. Er kommt selten
 * absichtlich und fast immer aus einem kaputten Import - deshalb wird er
 * entfernt statt die ganze Anfrage abzulehnen.
 *
 * Eine Zahl außerhalb der Spaltenreichweite ist dagegen eine echte
 * Falschangabe und wird zurückgewiesen: stillschweigend zu kappen hieße,
 * einen anderen Wert zu speichern als angegeben.
 */
export function saeubereKoerper(req: Request, res: Response, next: NextFunction) {
  const ausreisser: string[] = []

  function gehe(wert: any, pfad: string, tiefe: number): any {
    if (tiefe > 12) return wert
    if (typeof wert === 'string') {
      return wert.includes('\u0000') ? wert.replace(/\u0000/g, '') : wert
    }
    if (typeof wert === 'number') {
      if (!Number.isFinite(wert)) { ausreisser.push(pfad); return wert }
      // Nur ganze Zahlen betreffen INTEGER-Spalten. Kommazahlen wie eine
      // Menge von 1,5 sind zulässig und bleiben unberührt.
      if (Number.isInteger(wert) && (wert > PG_INT_MAX || wert < PG_INT_MIN)) {
        ausreisser.push(pfad)
      }
      return wert
    }
    if (Array.isArray(wert)) return wert.map((x, i) => gehe(x, `${pfad}[${i}]`, tiefe + 1))
    if (wert && typeof wert === 'object') {
      const out: Record<string, any> = {}
      for (const [k, v] of Object.entries(wert)) out[k] = gehe(v, pfad ? `${pfad}.${k}` : k, tiefe + 1)
      return out
    }
    return wert
  }

  if (req.body && typeof req.body === 'object') {
    req.body = gehe(req.body, '', 0)
  }

  if (ausreisser.length) {
    return res.status(400).json({
      data: null,
      // Die Grenze mit nennen: wer sich um drei Nullen vertippt, sieht sonst
      // nur einen internen Feldnamen und weiß nicht, was zu klein wäre.
      error: `Zahl außerhalb des zulässigen Bereichs (höchstens ${PG_INT_MAX.toLocaleString('de-DE')}): `
        + `${ausreisser.slice(0, 3).join(', ')}.`,
    })
  }
  next()
}

/**
 * Letzte Instanz: was trotzdem aus der Datenbank kommt, wird uebersetzt.
 *
 * Die Rohmeldung von Postgres nennt Spaltentypen und Kodierungen. Das gehoert
 * nicht in eine Antwort nach aussen, und ein Mensch kann damit nichts anfangen.
 */
export function uebersetzeDatenbankfehler(
  fehler: any, _req: Request, res: Response, next: NextFunction,
) {
  if (res.headersSent) return next(fehler)
  const text = String(fehler?.message ?? '')

  const bekannt: Array<[RegExp, number, string]> = [
    [/invalid input syntax for type (integer|bigint|numeric)/i, 400,
     'Eine Zahl wurde als Text übergeben.'],
    [/out of range for type/i, 400,
     'Eine Zahl liegt außerhalb des zulässigen Bereichs.'],
    [/invalid byte sequence for encoding/i, 400,
     'Der Text enthält ein Zeichen, das nicht gespeichert werden kann.'],
    [/violates foreign key constraint/i, 409,
     'Der Eintrag hängt an einem anderen, der nicht existiert oder noch gebraucht wird.'],
    [/violates unique constraint/i, 409, 'Diesen Eintrag gibt es bereits.'],
    [/violates not-null constraint/i, 400, 'Ein Pflichtfeld fehlt.'],
  ]

  for (const [muster, code, satz] of bekannt) {
    if (muster.test(text)) {
      return res.status(code).json({ data: null, error: satz })
    }
  }

  // Unbekannt: der Text bleibt drinnen, im Log steht er vollstaendig.
  console.error('[Unbehandelt]', text)
  res.status(500).json({ data: null, error: 'Unerwarteter Serverfehler.' })
}
