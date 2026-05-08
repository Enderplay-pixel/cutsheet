import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

// Map of projectId -> Set of SSE response objects
const clients: Map<number, Set<Response>> = new Map()

export function broadcastToProject(projectId: number, event: string, data: unknown): void {
  const projectClients = clients.get(projectId)
  if (!projectClients) return
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  projectClients.forEach(res => {
    try { res.write(msg) } catch {}
  })
}

router.get('/api/projects/:projectId/events', requireAuth, (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  if (!clients.has(projectId)) clients.set(projectId, new Set())
  clients.get(projectId)!.add(res)

  // Heartbeat every 25s
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n') } catch {}
  }, 25000)

  req.on('close', () => {
    clearInterval(heartbeat)
    clients.get(projectId)?.delete(res)
    if (clients.get(projectId)?.size === 0) clients.delete(projectId)
  })
})

export default router
