import { Request, Response, NextFunction } from 'express'
import { db } from '../db'

// ─── Role hierarchy ────────────────────────────────────────────────────────────
export const ROLE_RANK: Record<string, number> = {
  admin:     5,
  producer:  4,
  director:  3,
  dept_head: 2,
  read_only: 1,
}

/**
 * Returns the user's role in the project, or null if they have no access.
 * null = not a member (must be treated as 403, not read_only).
 */
export async function getUserProjectRole(userId: number, projectId: number): Promise<string | null> {
  try {
    const project = await db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId]) as any
    if (!project) return null
    if (project.owner_id === userId) return 'admin'
    const member = await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    ) as any
    return member?.role ?? null   // null = not a member
  } catch { return null }
}

/**
 * Express middleware — requires the requesting user to be a member of the project
 * identified by req.params.projectId. Global admins bypass the check.
 */
export async function requireMember(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  // Global site admins can access any project
  if (user.role === 'admin') return next()

  const projectId = Number(req.params.projectId)
  const role = await getUserProjectRole(user.id, projectId)
  if (role === null) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  ;(req as any).projectRole = role
  next()
}

/**
 * Wie requireMember, nur wird das Projekt aus einer Kind-Ressource aufgeloest —
 * Drehtag, Motiv, Kamerabericht.
 *
 * Noetig, weil projectWriteGuard GET-Anfragen bewusst durchlaesst und der
 * Leseschutz damit an jedem Router einzeln haengt. Wer seine Route ueber eine
 * Kind-Id adressiert (/shoot-days/7/...) statt ueber /projects/3/..., stand
 * ohne jede Pruefung da.
 */
export function requireMemberVia(resolve: (req: Request) => Promise<number | null>) {
  return async function (req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    // Globale Administratoren duerfen ueberall hin
    if (user.role === 'admin') return next()

    const projectId = await resolve(req)
    // Nicht aufloesbar heisst nicht durchwinken: ein unauffindbares Ziel darf
    // nicht mehr erlauben als ein auffindbares.
    if (!projectId) return res.status(404).json({ data: null, error: 'Nicht gefunden' })

    const role = await getUserProjectRole(user.id, projectId)
    if (role === null) {
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    }

    ;(req as any).projectRole = role
    next()
  }
}

/** Projekt ueber eine Tabelle mit project_id aufloesen. */
export function projectIdFromTable(table: 'shoot_days' | 'locations', param: string) {
  return async (req: Request): Promise<number | null> => {
    try {
      const row = await db.get(`SELECT project_id FROM ${table} WHERE id = ?`, [req.params[param]]) as any
      return row?.project_id ?? null
    } catch { return null }
  }
}

/** Kamerabericht → Drehtag → Projekt. */
export async function projectIdFromCameraReport(req: Request): Promise<number | null> {
  try {
    const row = await db.get(
      'SELECT sd.project_id FROM camera_reports cr JOIN shoot_days sd ON cr.shoot_day_id = sd.id WHERE cr.id = ?',
      [req.params.reportId]
    ) as any
    return row?.project_id ?? null
  } catch { return null }
}

// ─── Project ID extraction from request ───────────────────────────────────────
async function lookupOne(sql: string, id: string): Promise<number | null> {
  try {
    const r = await db.get(sql, [id]) as any
    return r?.project_id ?? null
  } catch { return null }
}

async function extractProjectId(method: string, path: string, body: any): Promise<number | null> {
  // /projects/5 or /projects/5/anything
  const projMatch = path.match(/^\/projects\/(\d+)/)
  if (projMatch) return Number(projMatch[1])

  // POST body has project_id
  if (method === 'POST' && body?.project_id) return Number(body.project_id)

  // Entity-level routes — look up project_id from DB
  const entityPatterns: Array<[RegExp, string]> = [
    [/^\/scenes\/(\d+)/,             'SELECT project_id FROM scenes WHERE id = ?'],
    [/^\/characters\/(\d+)/,         'SELECT project_id FROM characters WHERE id = ?'],
    [/^\/cast\/(\d+)/,               'SELECT project_id FROM cast WHERE id = ?'],
    [/^\/crew\/(\d+)/,               'SELECT project_id FROM crew WHERE id = ?'],
    [/^\/locations\/(\d+)/,          'SELECT project_id FROM locations WHERE id = ?'],
    [/^\/shots\/(\d+)/,              'SELECT project_id FROM shots WHERE id = ?'],
    [/^\/vehicles\/(\d+)/,           'SELECT project_id FROM vehicles WHERE id = ?'],
    [/^\/extras\/(\d+)/,             'SELECT project_id FROM extras WHERE id = ?'],
    [/^\/camera-presets\/(\d+)/,     'SELECT project_id FROM camera_presets WHERE id = ?'],
    [/^\/sticky-notes\/(\d+)/,       'SELECT project_id FROM sticky_notes WHERE id = ?'],
    [/^\/screenplay-blocks\/(\d+)/,  'SELECT project_id FROM screenplay_blocks WHERE id = ?'],
    [/^\/fdx-imports\/(\d+)/,        'SELECT project_id FROM fdx_imports WHERE id = ?'],
    [/^\/shoot-days\/(\d+)/,         'SELECT project_id FROM shoot_days WHERE id = ?'],
    [/^\/budget-versions\/(\d+)/,    'SELECT project_id FROM budget_versions WHERE id = ?'],
    [/^\/equipment-lists\/(\d+)/,    'SELECT project_id FROM equipment_lists WHERE id = ?'],
    [/^\/drehplan-versions\/(\d+)/,  'SELECT project_id FROM drehplan_versions WHERE id = ?'],
    [/^\/call-sheets\/(\d+)/,
     'SELECT sd.project_id FROM call_sheets cs JOIN shoot_days sd ON cs.shoot_day_id = sd.id WHERE cs.id = ?'],
    [/^\/budget-lines\/(\d+)/,
     'SELECT bv.project_id FROM budget_lines bl JOIN budget_versions bv ON bl.budget_version_id = bv.id WHERE bl.id = ?'],
    [/^\/equipment-items\/(\d+)/,
     'SELECT el.project_id FROM equipment_items ei JOIN equipment_lists el ON ei.equipment_list_id = el.id WHERE ei.id = ?'],
    [/^\/daily-reports\/(\d+)/,
     'SELECT sd.project_id FROM daily_reports dr JOIN shoot_days sd ON dr.shoot_day_id = sd.id WHERE dr.id = ?'],
    [/^\/financing-plan-versions\/(\d+)/,
     'SELECT project_id FROM financing_plan_versions WHERE id = ?'],
    [/^\/events\/(\d+)/,
     'SELECT project_id FROM project_events WHERE id = ?'],
    [/^\/tasks\/(\d+)/,
     'SELECT project_id FROM project_tasks WHERE id = ?'],
    [/^\/expenses\/(\d+)/,
     'SELECT project_id FROM expenses WHERE id = ?'],
  ]

  for (const [pattern, sql] of entityPatterns) {
    const m = path.match(pattern)
    if (m?.[1]) {
      const pid = await lookupOne(sql, m[1])
      if (pid) return pid
    }
  }

  return null
}

// ─── Route-level permission matrix ────────────────────────────────────────────
// Maps path pattern → minimum role rank required to mutate
const ROUTE_OVERRIDES: Array<[RegExp, number]> = [
  // Budget: producer+ only
  [/\/budget/,    ROLE_RANK.producer],
  [/\/financing/, ROLE_RANK.producer],
  // Project settings, invites, members: admin only
  [/\/settings$/, ROLE_RANK.admin],
  [/\/invites/,   ROLE_RANK.admin],
  [/\/members/,   ROLE_RANK.admin],
  // Drehplan versions: producer+
  [/\/drehplan-versions/, ROLE_RANK.producer],
]

function minRankForPath(path: string): number {
  for (const [pattern, rank] of ROUTE_OVERRIDES) {
    if (pattern.test(path)) return rank
  }
  // Default: dept_head and above can write
  return ROLE_RANK.dept_head
}

// ─── The global middleware ─────────────────────────────────────────────────────
export async function projectWriteGuard(req: Request, res: Response, next: NextFunction) {
  // Only intercept mutations
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()

  const path = req.path

  // Bypass: auth routes, public invite info, invite accept is protected via requireAuth
  if (path.startsWith('/auth/')) return next()
  if (path.match(/^\/invites\/[^/]+$/) && req.method === 'GET') return next()
  // Public Dispo-Links: Token-basiert (160-bit random), kein User nötig
  if (path.startsWith('/cse/t/')) return next()

  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  // Global admins can do anything
  if (user.role === 'admin') return next()

  const projectId = await extractProjectId(req.method, path, req.body)
  if (!projectId) return next() // can't determine project → pass through

  const role = await getUserProjectRole(user.id, projectId)
  if (role === null) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  const userRank = ROLE_RANK[role] ?? 0
  const requiredRank = minRankForPath(path)

  if (userRank < requiredRank) {
    const roleLabels: Record<string, string> = {
      read_only: 'Du hast nur Lesezugriff auf dieses Projekt.',
      dept_head: 'Diese Aktion erfordert mindestens Produzenten-Zugriff.',
      director:  'Diese Aktion erfordert mindestens Produzenten-Zugriff.',
    }
    const msg = roleLabels[role] ?? 'Keine Berechtigung für diese Aktion.'
    return res.status(403).json({ data: null, error: msg })
  }

  // Attach resolved role to request for downstream use
  ;(req as any).projectRole = role
  next()
}
