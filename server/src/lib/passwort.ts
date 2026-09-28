/**
 * Passwörter hashen und prüfen — in Worker-Threads, nicht auf dem Haupt-Thread.
 *
 * bcryptjs ist reines JavaScript: ein Hash mit Kostenfaktor 12 blockiert den
 * Thread rund eine Viertelsekunde. Auf dem Haupt-Thread heißt das: 150
 * Anmeldungen gleichzeitig (Drehbeginn, Launch-Tag) frieren den Server für
 * alle über eine halbe Minute ein, der Verbindungspool läuft voll und
 * Anfragen scheitern mit "timeout exceeded". Im Lasttest gemessen.
 *
 * Hier läuft dieselbe Bibliothek in einem kleinen Pool von Worker-Threads.
 * Hash-Format und Kostenfaktor bleiben gleich — vorhandene Passwörter gelten
 * weiter. Die Größe des Pools richtet sich nach den verfügbaren Kernen.
 */
import { Worker } from 'worker_threads'
import { availableParallelism } from 'os'

type Auftrag = { id: number; op: 'hash' | 'compare'; a: string; b: string | number }

const WORKER_CODE = `
const { parentPort, workerData } = require('worker_threads')
const bcrypt = require(workerData.bcryptPfad)
parentPort.on('message', async ({ id, op, a, b }) => {
  try {
    const result = op === 'hash' ? await bcrypt.hash(a, b) : await bcrypt.compare(a, b)
    parentPort.postMessage({ id, result })
  } catch (e) {
    parentPort.postMessage({ id, error: String(e && e.message || e) })
  }
})
`

let pool: Worker[] | null = null
let naechster = 0
let zaehler = 0
const offen = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()

function starten(): Worker[] {
  if (pool) return pool
  const groesse = Math.max(1, Math.min(4, (availableParallelism?.() ?? 2) - 1))
  const bcryptPfad = require.resolve('bcryptjs')
  pool = Array.from({ length: groesse }, () => {
    const w = new Worker(WORKER_CODE, { eval: true, workerData: { bcryptPfad } })
    w.on('message', ({ id, result, error }) => {
      const p = offen.get(id)
      if (!p) return
      offen.delete(id)
      error ? p.reject(new Error(error)) : p.resolve(result)
    })
    w.on('error', err => console.error('[Passwort-Worker]', err))
    // Worker halten den Prozess nicht am Leben (Tests, Skripte, Shutdown)
    w.unref()
    return w
  })
  return pool
}

function auftrag<T>(op: Auftrag['op'], a: string, b: string | number): Promise<T> {
  const workers = starten()
  const id = ++zaehler
  return new Promise<T>((resolve, reject) => {
    offen.set(id, { resolve, reject })
    workers[naechster++ % workers.length].postMessage({ id, op, a, b } satisfies Auftrag)
  })
}

/** bcrypt-Hash, Standard-Kostenfaktor 12 wie bisher. */
export function hashPasswort(passwort: string, kosten = 12): Promise<string> {
  return auftrag<string>('hash', passwort, kosten)
}

/** Vergleicht ein Klartext-Passwort mit einem bcrypt-Hash. */
export function pruefePasswort(passwort: string, hash: string): Promise<boolean> {
  if (!hash) return Promise.resolve(false)
  return auftrag<boolean>('compare', passwort, hash)
}

/** Für geordnetes Herunterfahren. */
export async function passwortPoolBeenden() {
  if (!pool) return
  const p = pool
  pool = null
  await Promise.all(p.map(w => w.terminate()))
}
