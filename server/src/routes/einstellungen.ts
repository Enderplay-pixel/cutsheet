/**
 * Persönliche Einstellungen je Konto: der Arbeitsplatz (Reihenfolge der
 * Bereiche), die Anordnung einzelner Seiten und welche Einführungen schon
 * gesehen sind.
 *
 * Florian (03.11.2026): je Nutzer dauerhaft, für alle seine Projekte gleich,
 * sicher voneinander getrennt. Deshalb hängt jede Abfrage hier an der
 * Kennung des angemeldeten Kontos - eine fremde Kennung kommt in keiner Route
 * vor, und mit dem Konto verschwinden auch seine Einstellungen.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

/** Erlaubte Schlüssel: klein, ohne Leerzeichen, z. B. "arbeitsplatz:film". */
const SCHLUESSEL = /^[a-z0-9][a-z0-9:_./-]{0,79}$/

/** Eine Einstellung ist eine Anordnung, kein Dokument. */
export const MAX_ZEICHEN = 32_000

router.get('/einstellungen', requireAuth, async (req: Request, res: Response) => {
  const zeilen = (await db.all(
    'SELECT schluessel, wert FROM user_einstellungen WHERE user_id = ?', [(req as any).user.id]
  )) as Array<{ schluessel: string; wert: unknown }>
  return res.json({ data: Object.fromEntries(zeilen.map((z) => [z.schluessel, z.wert])), error: null })
})

router.put('/einstellungen/:schluessel', requireAuth, async (req: Request, res: Response) => {
  const schluessel = String(req.params.schluessel)
  if (!SCHLUESSEL.test(schluessel)) {
    return res.status(400).json({ data: null, error: 'Ungültiger Name für eine Einstellung' })
  }
  if (!req.body || !('wert' in req.body)) {
    return res.status(400).json({ data: null, error: 'Es fehlt der Wert' })
  }
  const text = JSON.stringify(req.body.wert ?? null)
  if (text.length > MAX_ZEICHEN) {
    return res.status(413).json({ data: null, error: 'Die Einstellung ist zu groß' })
  }
  await db.run(
    `INSERT INTO user_einstellungen (user_id, schluessel, wert, aktualisiert)
     VALUES (?, ?, ?::jsonb, NOW())
     ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, aktualisiert = NOW()`,
    [(req as any).user.id, schluessel, text]
  )
  return res.json({ data: { schluessel, wert: req.body.wert ?? null }, error: null })
})

/** Eine Einstellung zurück auf den Standard - etwa "Einführungen erneut zeigen". */
router.delete('/einstellungen/:schluessel', requireAuth, async (req: Request, res: Response) => {
  const schluessel = String(req.params.schluessel)
  if (!SCHLUESSEL.test(schluessel)) {
    return res.status(400).json({ data: null, error: 'Ungültiger Name für eine Einstellung' })
  }
  await db.run('DELETE FROM user_einstellungen WHERE user_id = ? AND schluessel = ?', [(req as any).user.id, schluessel])
  return res.json({ data: { schluessel }, error: null })
})

export default router
