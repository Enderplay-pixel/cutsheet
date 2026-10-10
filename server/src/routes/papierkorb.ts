/**
 * Papierkorb eines Projekts: ansehen und zurückholen.
 */
import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { getUserProjectRole, ROLE_RANK } from '../middleware/projectAuth'
import { inhalt, ausDemPapierkorb, AUFBEWAHRUNG_TAGE } from '../lib/papierkorb'

const router = Router()

/** Zurückholen darf, wer auch löschen darf. */
async function darfZurueckholen(req: Request, projectId: number): Promise<boolean> {
  const user = (req as any).user
  if (!user) return false
  if (user.role === 'admin') return true
  const rolle = await getUserProjectRole(user.id, projectId)
  return (ROLE_RANK[rolle || ''] ?? 0) >= ROLE_RANK.dept_head
}

// GET /api/projects/:projectId/papierkorb
router.get('/projects/:projectId/papierkorb', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const eintraege = await inhalt(projectId)
  return res.json({
    data: { eintraege, aufbewahrung_tage: AUFBEWAHRUNG_TAGE },
    error: null,
  })
})

// POST /api/projects/:projectId/papierkorb/:id/wiederherstellen
router.post('/projects/:projectId/papierkorb/:id/wiederherstellen', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  if (!(await darfZurueckholen(req, projectId))) {
    return res.status(403).json({ data: null, error: 'Dafür fehlt dir die Berechtigung in diesem Projekt' })
  }
  const ergebnis = await ausDemPapierkorb(Number(req.params.id), projectId)
  if (!ergebnis.wiederhergestellt) {
    return res.status(400).json({ data: null, error: ergebnis.grund })
  }
  return res.json({
    data: ergebnis,
    error: null,
  })
})

export default router
