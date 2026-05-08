import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'

const router = Router()

export function logAudit(
  projectId: number | null,
  user: AuthUser | undefined,
  action: string,
  entityType: string,
  entityId?: number,
  oldValue?: unknown,
  newValue?: unknown
): void {
  try {
    db.prepare(`
      INSERT INTO audit_log (project_id, user_id, user_name, action, entity_type, entity_id, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId ?? null,
      user?.id ?? null,
      user?.name || user?.email || '',
      action,
      entityType,
      entityId ?? null,
      oldValue !== undefined ? JSON.stringify(oldValue) : null,
      newValue !== undefined ? JSON.stringify(newValue) : null
    )
  } catch (err) {
    console.error('[audit_log] Failed to write audit entry:', err)
  }
}

// GET /api/projects/:projectId/audit
router.get('/projects/:projectId/audit', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const entries = db.prepare(`
      SELECT * FROM audit_log
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `).all(projectId)
    return res.json({ data: entries, error: null })
  } catch (err) {
    console.error('[audit GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
