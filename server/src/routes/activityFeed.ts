import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

router.use('/projects/:projectId', requireMember)

function iconForAction(action: string, entityType: string): string {
  if (entityType === 'comment') return '💬'
  if (action.startsWith('create')) return '✅'
  if (action.startsWith('update') || action.startsWith('edit')) return '✏️'
  if (action.startsWith('delete') || action.startsWith('remove')) return '🗑️'
  if (action.startsWith('import')) return '📥'
  if (action.startsWith('export') || action.startsWith('generate')) return '📤'
  if (action.startsWith('invite')) return '📨'
  return '📋'
}

// GET /api/projects/:projectId/activity?limit=50
router.get('/projects/:projectId/activity', async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const limit = Math.min(Number(req.query.limit) || 50, 200)

    const auditEntries = await db.all(`
      SELECT id, user_name, action, entity_type, entity_id, created_at
      FROM audit_log
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [projectId, limit]) as any[]

    const commentEntries = await db.all(`
      SELECT id, author as user_name, 'comment' as action, entity_type, entity_id, content, created_at
      FROM comments
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [projectId, limit]) as any[]

    const auditItems = auditEntries.map(e => ({
      id: `audit-${e.id}`,
      user_name: e.user_name || 'Unbekannt',
      action: e.action,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      created_at: e.created_at,
      icon: iconForAction(e.action, e.entity_type),
    }))

    const commentItems = commentEntries.map(e => ({
      id: `comment-${e.id}`,
      user_name: e.user_name || 'Unbekannt',
      action: 'comment',
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      content: e.content,
      created_at: e.created_at,
      icon: '💬',
    }))

    const merged = [...auditItems, ...commentItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)

    res.json({ data: merged, error: null })
  } catch (err) {
    console.error('[activityFeed GET]', err)
    res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
