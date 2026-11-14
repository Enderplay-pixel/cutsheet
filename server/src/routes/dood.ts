import { Router, Request, Response } from 'express'
import { db } from '../db'
import { ladeDood } from '../lib/dood'

const router = Router()

/**
 * GET /api/projects/:pid/dood-report
 *
 * Kürzel und Regeln nach der Branche (lib/dood.ts). Spalten sind Kalendertage,
 * damit freie Tage, Reise- und Probetage einen Platz haben. `cast[].days`
 * steht in derselben Reihenfolge wie `spalten`.
 *
 * `total_work_days` sind die Drehtage - dieselbe Zahl wie in Kalkulation,
 * Vertrag, Lohnexport und Besetzung (lib/drehtage.ts). `total_worked_days`
 * zählt Reise, Probe und Anprobe dazu.
 */
router.get('/projects/:pid/dood-report', async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  const { spalten, cast } = await ladeDood(db, Number(req.params.pid))
  return res.json({ data: { spalten, cast }, error: null })
})

export default router
