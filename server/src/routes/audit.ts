import { Router, Request, Response, NextFunction } from 'express'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'

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
  db.run(`
      INSERT INTO audit_log (project_id, user_id, user_name, action, entity_type, entity_id, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      projectId ?? null,
      user?.id ?? null,
      user?.name || user?.email || '',
      action,
      entityType,
      entityId ?? null,
      oldValue !== undefined ? JSON.stringify(oldValue) : null,
      newValue !== undefined ? JSON.stringify(newValue) : null,
    ]
  ).catch(err => {
    console.error('[audit_log] Failed to write audit entry:', err)
  })
}

// ─── Automatisches Aenderungsprotokoll ───────────────────────────────────────
// logAudit wurde nirgends aufgerufen - das Audit-Log blieb leer, egal was im
// Projekt geschah. Statt ueber 60 Routen einzeln anzufassen, schreibt diese
// Middleware jede erfolgreiche Aenderung mit: wer, wann, was, an welchem
// Eintrag. Das Projekt hat projectWriteGuard schon aufgeloest.

const ENTITAET: Record<string, string> = {
  scenes: 'Szene', 'shoot-days': 'Drehtag', cast: 'Darsteller', characters: 'Figur', crew: 'Stab',
  locations: 'Motiv', shots: 'Einstellung', 'call-sheets': 'Tagesdispo', 'call-sheet': 'Tagesdispo',
  'call-sheet-entries': 'Dispo-Eintrag', entries: 'Eintrag', 'daily-report': 'Tagesbericht', 'daily-reports': 'Tagesbericht',
  'budget-lines': 'Budgetposten', lines: 'Budgetposten', 'budget-versions': 'Kalkulationsfassung',
  'financing-versions': 'Finanzierungsfassung', 'financing-entries': 'Finanzierungsposten', expenses: 'Beleg',
  equipment: 'Equipment', 'equipment-lists': 'Equipment-Liste', 'equipment-items': 'Equipment-Position', items: 'Position',
  vehicles: 'Fahrzeug', extras: 'Komparse', tasks: 'Aufgabe', comments: 'Kommentar', 'sticky-notes': 'Notiz',
  vfx: 'VFX-Shot', 'vfx-shots': 'VFX-Shot', 'music-cues': 'Musik-Cue', insurances: 'Versicherung',
  continuity: 'Continuity', 'post-phases': 'Postphase', postplan: 'Postphase', timesheets: 'Timesheet',
  'camera-reports': 'Kamerabericht', takes: 'Take', floorplans: 'Set-Plan', 'floorplan-items': 'Set-Plan-Element',
  moodboard: 'Moodboard', events: 'Termin', 'blackout-dates': 'Sperrtag', invites: 'Einladung', members: 'Mitglied',
  settings: 'Einstellungen', blocks: 'Drehbuchblock', screenplay: 'Drehbuch', drehplan: 'Drehplan',
  'drehplan-versions': 'Drehplan-Version', projects: 'Projekt', catering: 'Catering', releases: 'Motivvertrag',
}

const AKTION: Record<string, string> = { POST: 'angelegt', PUT: 'geändert', PATCH: 'geändert', DELETE: 'gelöscht' }

/** Nie mitschreiben: Geheimnisse und grosse Rohdaten. */
function saeubern(body: unknown): unknown {
  if (!body || typeof body !== 'object') return undefined
  const aus: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (/pass|token|secret|signature|image|photo|data_url|content_b64/i.test(k)) continue
    if (typeof v === 'string' && v.length > 200) aus[k] = v.slice(0, 200) + '…'
    else if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) aus[k] = v
  }
  return Object.keys(aus).length ? aus : undefined
}

export function aenderungenProtokollieren(req: Request, res: Response, next: NextFunction) {
  if (!AKTION[req.method]) return next()
  if (/^\/(auth|cse\/t|push|feedback|admin)\b/.test(req.path)) return next()
  const pfad = req.path
  const koerper = saeubern(req.body)
  // ID eines neu angelegten Eintrags aus der Antwort mitnehmen
  let neueId: number | undefined
  const json = res.json.bind(res)
  res.json = (b: any) => {
    const id = b?.data?.id
    if (req.method === 'POST' && Number.isInteger(id)) neueId = id
    return json(b)
  }
  res.on('finish', () => {
    const projektId = (req as any).auditProjektId
    const user = (req as any).user as AuthUser | undefined
    if (!projektId || !user || res.statusCode >= 300) return
    const teile = pfad.split('/').filter(Boolean)
    const ids = teile.filter(t => /^\d+$/.test(t))
    const namen = teile.filter(t => !/^\d+$/.test(t))
    let letzter = namen[namen.length - 1] ?? 'projects'
    let aktion = AKTION[req.method]
    // Unterpfad wie /shots/12/done: die Entitaet ist "shots", "done" die Art
    if (!ENTITAET[letzter] && namen.length > 1 && ENTITAET[namen[namen.length - 2]]) {
      aktion = `${aktion} (${letzter})`
      letzter = namen[namen.length - 2]
    }
    const entitaet = ENTITAET[letzter] ?? letzter
    const endetMitId = /^\d+$/.test(teile[teile.length - 1] ?? '')
    const unterpfad = aktion !== AKTION[req.method]
    // Bei POST auf eine Sammlung ist die letzte Zahl die des Elternteils
    const eigeneId = neueId ?? (endetMitId || unterpfad ? Number(ids[ids.length - 1]) : undefined)
    logAudit(projektId, user, aktion, entitaet, eigeneId, undefined, koerper)
  })
  next()
}

// GET /api/projects/:projectId/audit
router.get('/projects/:projectId/audit', requireAuth, requireMember, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const entries = await db.all(`
      SELECT * FROM audit_log
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `, [projectId])
    // Lesbare Kurzfassung der Aenderung fuer die Spalte "Details"
    const mitDetails = entries.map((e: any) => {
      let details = ''
      try {
        const neu = e.new_value ? JSON.parse(e.new_value) : null
        if (neu && typeof neu === 'object') {
          const titel = neu.title ?? neu.name ?? neu.label ?? neu.description ?? neu.content
          const felder = Object.keys(neu).filter(k => !['project_id', 'sort_order'].includes(k))
          details = titel ? String(titel) : felder.length ? `Felder: ${felder.slice(0, 6).join(', ')}` : ''
        }
      } catch { /* altes Format */ }
      return { ...e, details }
    })
    return res.json({ data: mitDetails, error: null })
  } catch (err) {
    console.error('[audit GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
