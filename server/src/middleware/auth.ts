import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

import { getJwtSecret } from '../config/secrets'
import { db } from '../db'

// Bewusst als Funktion statt als Konstante: in der Produktion soll ein
// fehlender Schluessel einen Fehler ausloesen und nicht still durchgehen.

export interface AuthUser {
  id: number
  email: string
  name: string
  role: string
  /** Kennung der Sitzung. Fehlt bei Tokens aus der Zeit davor. */
  sid?: string
}

/**
 * Widerrufene Sitzungen, im Arbeitsspeicher.
 *
 * Ohne diese Liste braeuchte jede Anfrage eine Datenbankabfrage. Mit ihr
 * genuegt ein Blick in eine Menge - und wer widerrufen wird, traegt sich
 * selbst ein. Nach einem Neustart ist sie leer und wird beim ersten Zugriff
 * je Sitzung neu gefuellt.
 */
const widerrufen = new Set<string>()
const geprueft = new Map<string, number>()
/** Wie lange eine geprueft-Antwort gilt, bevor erneut nachgesehen wird. */
const PRUEF_DAUER_MS = 60_000

export function merkeWiderruf(sid: string) {
  widerrufen.add(sid)
  geprueft.delete(sid)
}

/**
 * Gilt die Sitzung noch? Die Antwort wird eine Minute lang behalten, damit
 * nicht jede Anfrage die Datenbank fragt.
 */
async function sitzungGilt(sid: string): Promise<boolean> {
  if (widerrufen.has(sid)) return false
  const zuletzt = geprueft.get(sid)
  if (zuletzt && Date.now() - zuletzt < PRUEF_DAUER_MS) return true
  try {
    const zeile = (await db.get('SELECT revoked_at FROM user_sessions WHERE id = ?', [sid])) as any
    // Unbekannte Sitzung: Das Token stammt aus einer Zeit vor dieser Tabelle
    // oder aus einer anderen Datenbank. Es gilt weiter - sonst wuerde ein
    // Aufraeumen der Tabelle alle Angemeldeten hinauswerfen.
    if (!zeile) return true
    if (zeile.revoked_at) {
      widerrufen.add(sid)
      return false
    }
    geprueft.set(sid, Date.now())
    void db.run('UPDATE user_sessions SET last_seen = NOW() WHERE id = ?', [sid]).catch(() => undefined)
    return true
  } catch {
    // Datenbank nicht erreichbar: lieber anmelden lassen als alle aussperren.
    return true
  }
}

/**
 * Die Rolle eines Kontos, wie sie jetzt in der Datenbank steht.
 *
 * Das Token trägt die Rolle von der Anmeldung an 30 Tage lang mit. Gemessen
 * am 24.10.2026: Ein gelöschtes Admin-Konto kam mit seinem alten Token weiter
 * in die Verwaltung, ebenso eines, das zum normalen Konto herabgestuft wurde.
 * Löschen beendete keine Sitzung, und die Sitzungszeile verschwand per
 * CASCADE mit dem Konto - eine unbekannte Sitzung gilt aber als gültig.
 *
 * Deshalb zählt die Rolle aus der Datenbank, und ein Konto, das es nicht mehr
 * gibt, kommt nicht mehr hinein. Eine Minute zwischengespeichert wie die
 * Sitzungen; wer ein Konto ändert, ruft `vergissKonto`, damit es sofort gilt.
 */
const konten = new Map<number, { zeit: number; rolle: string | null }>()

/** `null`: Das Konto gibt es nicht mehr. `undefined`: Datenbank nicht erreichbar. */
async function aktuelleRolle(userId: number): Promise<string | null | undefined> {
  const gemerkt = konten.get(userId)
  if (gemerkt && Date.now() - gemerkt.zeit < PRUEF_DAUER_MS) return gemerkt.rolle
  try {
    const zeile = (await db.get('SELECT role FROM users WHERE id = ?', [userId])) as any
    const rolle = zeile ? String(zeile.role) : null
    konten.set(userId, { zeit: Date.now(), rolle })
    return rolle
  } catch {
    // Wie bei den Sitzungen: lieber die Angabe aus dem Token als alle aussperren.
    return undefined
  }
}

/** Nach dem Löschen oder Umstufen eines Kontos: sofort neu nachsehen. */
export function vergissKonto(userId: number) {
  konten.delete(userId)
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/**
 * Das Token prüfen und den Nutzer mit seinem jetzigen Stand liefern.
 * Gibt einen Fehlertext zurück, wenn es nicht gilt.
 */
async function pruefeToken(token: string): Promise<AuthUser | string> {
  let payload: AuthUser
  try {
    payload = jwt.verify(token, getJwtSecret()) as AuthUser
  } catch {
    return 'Token ungültig oder abgelaufen'
  }
  if (payload.sid && !(await sitzungGilt(payload.sid))) return 'Diese Anmeldung wurde beendet'
  const rolle = await aktuelleRolle(payload.id)
  if (rolle === null) return 'Dieses Konto gibt es nicht mehr'
  return rolle === undefined ? payload : { ...payload, role: rolle }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  const ergebnis = await pruefeToken(token)
  if (typeof ergebnis === 'string') return res.status(401).json({ data: null, error: ergebnis })
  req.user = ergebnis
  next()
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    const ergebnis = await pruefeToken(token)
    if (typeof ergebnis !== 'string') req.user = ergebnis
  }
  next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ data: null, error: 'Keine Berechtigung' })
    next()
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: '30d' })
}

/**
 * Meldet ein Geraet an: legt die Sitzung an und gibt ein Token aus, das sie
 * nennt. Darueber laesst sich die Anmeldung spaeter beenden.
 */
export async function starteSitzung(
  user: AuthUser,
  angaben: { device?: string; ip?: string } = {}
): Promise<{ token: string; sid: string }> {
  const sid = crypto.randomUUID()
  await db.run(
    'INSERT INTO user_sessions (id, user_id, device, ip) VALUES (?, ?, ?, ?)',
    [sid, user.id, String(angaben.device || '').slice(0, 200), String(angaben.ip || '').slice(0, 60)]
  )
  return { token: signToken({ ...user, sid }), sid }
}

/** Beendet eine Sitzung. Wirkt sofort, auch fuer laufende Tokens. */
export async function beendeSitzung(sid: string, userId: number): Promise<boolean> {
  const zeile = await db.run(
    'UPDATE user_sessions SET revoked_at = NOW() WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
    [sid, userId]
  )
  if (zeile.changes > 0) merkeWiderruf(sid)
  return zeile.changes > 0
}

/** Beendet alle Sitzungen eines Kontos, ausser der angegebenen. */
export async function beendeAlleSitzungen(userId: number, ausser?: string): Promise<number> {
  const offene = (await db.all(
    'SELECT id FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL',
    [userId]
  )) as any[]
  let beendet = 0
  for (const sitzung of offene) {
    if (ausser && sitzung.id === ausser) continue
    await db.run('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?', [sitzung.id])
    merkeWiderruf(sitzung.id)
    beendet++
  }
  return beendet
}
