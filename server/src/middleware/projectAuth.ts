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
 * Express middleware - requires the requesting user to be a member of the project
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
 * Wie requireMember, nur wird das Projekt aus einer Kind-Ressource aufgeloest -
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
export type KindTabelle =
  | 'shoot_days' | 'locations' | 'scenes' | 'creator_videos'
  | 'budget_versions' | 'financing_plan_versions' | 'equipment_lists' | 'floorplans'

export function projectIdFromTable(table: KindTabelle, param: string) {
  return async (req: Request): Promise<number | null> => {
    try {
      const row = await db.get(`SELECT project_id FROM ${table} WHERE id = ?`, [req.params[param]]) as any
      return row?.project_id ?? null
    } catch { return null }
  }
}

/** Dispo → Drehtag → Projekt. */
export async function projectIdFromCallSheet(req: Request): Promise<number | null> {
  try {
    const row = await db.get(
      'SELECT sd.project_id FROM call_sheets cs JOIN shoot_days sd ON cs.shoot_day_id = sd.id WHERE cs.id = ?',
      [req.params.id]
    ) as any
    return row?.project_id ?? null
  } catch { return null }
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

/**
 * Routen, die eine einzelne Ressource ohne Projekt im Pfad ansprechen.
 *
 * Exportiert, weil ein Test prueft, dass KEINE schreibende Route fehlt: was
 * hier fehlt, laesst projectWriteGuard mangels Projekt-ID durch.
 */
export const entityPatterns: Array<[RegExp, string]> = [
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
    // Am 26.09.2026 nachgemessen: diese sieben standen nicht in der Liste.
    // Ohne Eintrag findet extractProjectId kein Projekt, und dann laesst
    // projectWriteGuard durch - ein fremdes Konto konnte Moodboard,
    // Anschlussnotizen, Verpflegung, Kommentare, Sperrtage und
    // ARBEITSZEITEN loeschen oder aendern.
    [/^\/moodboard\/(\d+)/,
     'SELECT project_id FROM moodboard_items WHERE id = ?'],
    [/^\/continuity\/(\d+)/,
     'SELECT project_id FROM continuity_notes WHERE id = ?'],
    [/^\/catering-preferences\/(\d+)/,
     'SELECT project_id FROM catering_preferences WHERE id = ?'],
    [/^\/timesheets\/(\d+)/,
     'SELECT project_id FROM timesheets WHERE id = ?'],
    [/^\/comments\/(\d+)/,
     'SELECT project_id FROM comments WHERE id = ?'],
    [/^\/blackout-dates\/(\d+)/,
     'SELECT project_id FROM cast_blackout_dates WHERE id = ?'],
    [/^\/scheduling-suggestions\/(\d+)/,
     'SELECT project_id FROM scheduling_suggestions WHERE id = ?'],
    // Zweite Messung am selben Tag, diesmal ueber den Routenbaum von Express
    // statt ueber eine Liste von Hand: elf weitere Routen liessen einen
    // Fremden durch - darunter der DREHBUCHTEXT und das Verschieben von
    // Szenen im fremden Drehplan.
    //
    // /financing-versions ist nicht /financing-plan-versions: der Pfad heisst
    // anders als die Tabelle, und das Muster daneben griff nie.
    [/^\/financing-versions\/(\d+)/,
     'SELECT project_id FROM financing_plan_versions WHERE id = ?'],
    [/^\/blocks\/(\d+)/,
     'SELECT project_id FROM screenplay_blocks WHERE id = ?'],
    [/^\/financing-entries\/(\d+)/,
     'SELECT fv.project_id FROM financing_entries fe JOIN financing_plan_versions fv ON fe.financing_version_id = fv.id WHERE fe.id = ?'],
    [/^\/equipment-bookings\/(\d+)/,
     'SELECT project_id FROM equipment_bookings WHERE id = ?'],
    [/^\/call-sheet-entries\/(\d+)/,
     'SELECT sd.project_id FROM call_sheet_entries cse JOIN call_sheets cs ON cse.call_sheet_id = cs.id JOIN shoot_days sd ON cs.shoot_day_id = sd.id WHERE cse.id = ?'],
    [/^\/camera-takes\/(\d+)/,
     'SELECT sd.project_id FROM camera_takes ct JOIN camera_reports cr ON ct.camera_report_id = cr.id JOIN shoot_days sd ON cr.shoot_day_id = sd.id WHERE ct.id = ?'],
]

async function extractProjectId(method: string, path: string, body: any): Promise<number | null> {
  // /projects/5 or /projects/5/anything
  const projMatch = path.match(/^\/projects\/(\d+)/)
  if (projMatch) return Number(projMatch[1])

  // POST body has project_id
  if (method === 'POST' && body?.project_id) return Number(body.project_id)

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
