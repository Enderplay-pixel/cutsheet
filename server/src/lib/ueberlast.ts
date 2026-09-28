/**
 * Ueberlast erkennen und als 503 statt 500 melden - ohne jede Route anzufassen.
 *
 * Rund 90 Routen fangen ihre Fehler selbst und antworten pauschal mit 500.
 * Laeuft der Verbindungspool voll, ist das aber kein Programmfehler, sondern
 * ein "gleich nochmal": der Client soll kurz warten und wiederholen.
 *
 * Deshalb merkt sich jede Anfrage in ihrem Async-Kontext, ob eine
 * Datenbankabfrage an Ueberlast gescheitert ist. Will die Route danach 500
 * senden, wird daraus 503 mit Retry-After. Nichts wurde ausgefuehrt - eine
 * Wiederholung ist sicher.
 */
import { AsyncLocalStorage } from 'async_hooks'
import { Request, Response, NextFunction } from 'express'

const kontext = new AsyncLocalStorage<{ ueberlastet: boolean }>()

export const UEBERLAST_TEXT = 'Der Server ist gerade stark ausgelastet. Bitte gleich noch einmal versuchen.'

/** Datenbank ueberlastet oder kurz weg - Anfrage kann spaeter wiederholt werden. */
export function istUeberlastet(err: any): boolean {
  const text = String(err?.message ?? '')
  return /timeout exceeded when trying to connect|too many clients|remaining connection slots|Connection terminated|canceling statement due to statement timeout|ECONNREFUSED/i.test(text)
}

/** Von der Datenbankschicht aufgerufen, wenn eine Abfrage scheitert. */
export function ueberlastMelden(err: any) {
  if (!istUeberlastet(err)) return
  const s = kontext.getStore()
  if (s) s.ueberlastet = true
}

/** Nach dem Body-Parser einhaengen, damit der Kontext die Route erreicht. */
export function ueberlastKontext(req: Request, res: Response, next: NextFunction) {
  const store = { ueberlastet: false }
  const status = res.status.bind(res)
  const json = res.json.bind(res)
  let umgeschrieben = false
  res.status = (code: number) => {
    if (code === 500 && store.ueberlastet) {
      umgeschrieben = true
      res.setHeader('Retry-After', '2')
      return status(503)
    }
    return status(code)
  }
  res.json = (body: any) => {
    if (umgeschrieben && body && typeof body === 'object' && 'error' in body) {
      return json({ ...body, error: UEBERLAST_TEXT })
    }
    return json(body)
  }
  kontext.run(store, next)
}

/** Fuer eigene Engpaesse ausserhalb der Datenbank (z. B. PDF-Warteschlange). */
export function ueberlastMarkieren() {
  const s = kontext.getStore()
  if (s) s.ueberlastet = true
}
