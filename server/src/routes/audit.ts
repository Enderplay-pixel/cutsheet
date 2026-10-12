import { Router, Request, Response, NextFunction } from 'express'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { schreibeCsv } from '../lib/tabelle'

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
/**
 * Lesbare Kurzfassung der Aenderung fuer die Spalte "Details".
 *
 * Das Protokoll speichert alten und neuen Wert als JSON. Niemand liest JSON in
 * einer Tabelle, also wird daraus ein Satz: der Titel des Datensatzes, wenn es
 * einen gibt, sonst die Namen der geaenderten Felder.
 */
function kurzfassung(zeile: any): string {
  try {
    const neu = zeile.new_value ? JSON.parse(zeile.new_value) : null
    if (neu && typeof neu === 'object') {
      const titel = neu.title ?? neu.name ?? neu.label ?? neu.description ?? neu.content
      const felder = Object.keys(neu).filter((k) => !['project_id', 'sort_order'].includes(k))
      return titel ? String(titel) : felder.length ? `Felder: ${felder.slice(0, 6).join(', ')}` : ''
    }
  } catch { /* altes Format */ }
  return ''
}

/** Die Zeitzone, in der ein Datum im Protokoll gemeint ist. */
const TAGESGRENZE = 'Europe/Berlin'

/**
 * Baut die Einschraenkung aus den Suchangaben.
 *
 * Alle Angaben sind freiwillig und werden mit UND verknuepft. `von` und `bis`
 * meinen ganze Tage: `bis=2026-10-12` schliesst den 12. ein, sonst faende man
 * nie etwas am letzten Tag des Zeitraums.
 *
 * Der Tag wird in Berliner Zeit abgegrenzt, nicht in der Zeitzone des
 * Servers. Ohne `AT TIME ZONE` liest PostgreSQL ein Datum ohne Zeitzone in der
 * Zeitzone der Sitzung - lokal CEST, beim Hoster UTC. Dieselbe Suche haette
 * dann je nach Serverstandort ein anderes Ergebnis, und bei einer Pruefung
 * waere nicht entscheidbar, welches das richtige ist.
 */
function einschraenkung(projectId: number, q: any): { sql: string; werte: any[] } {
  const teile = ['project_id = ?']
  const werte: any[] = [projectId]

  if (q.nutzer) {
    teile.push('(user_name ILIKE ? OR user_id = ?)')
    werte.push(`%${q.nutzer}%`, Number(q.nutzer) || -1)
  }
  if (q.aktion) { teile.push('action ILIKE ?'); werte.push(`%${q.aktion}%`) }
  if (q.bereich) { teile.push('entity_type ILIKE ?'); werte.push(`%${q.bereich}%`) }
  if (q.von) {
    teile.push(`created_at >= (?::timestamp AT TIME ZONE '${TAGESGRENZE}')`)
    werte.push(`${q.von} 00:00:00`)
  }
  if (q.bis) {
    teile.push(`created_at <= (?::timestamp AT TIME ZONE '${TAGESGRENZE}')`)
    werte.push(`${q.bis} 23:59:59.999`)
  }
  if (q.suche) {
    teile.push('(user_name ILIKE ? OR action ILIKE ? OR entity_type ILIKE ? OR new_value ILIKE ?)')
    const muster = `%${q.suche}%`
    werte.push(muster, muster, muster, muster)
  }
  return { sql: teile.join(' AND '), werte }
}

/**
 * Das Protokoll eines Projekts - durchsuchbar und seitenweise.
 *
 * Die Antwort bleibt eine Liste, damit bestehende Aufrufe weiter laufen. Was
 * dazukommt, steht in `meta`: die Gesamtzahl der Treffer, damit die
 * Oberflaeche "47 von 3.812" anzeigen kann.
 */
router.get('/projects/:projectId/audit', requireAuth, requireMember, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const { sql, werte } = einschraenkung(projectId, req.query)
    // Obergrenze 500: Wer mehr braucht, nimmt die CSV-Ausleitung.
    const grenze = Math.min(500, Math.max(1, Number(req.query.grenze) || 100))
    const sprung = Math.max(0, Number(req.query.sprung) || 0)

    const [zeilen, summe] = await Promise.all([
      db.all(
        `SELECT * FROM audit_log WHERE ${sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [...werte, grenze, sprung]
      ) as Promise<any[]>,
      db.get(`SELECT COUNT(*) AS anzahl FROM audit_log WHERE ${sql}`, werte) as Promise<any>,
    ])

    return res.json({
      data: zeilen.map((z) => ({ ...z, details: kurzfassung(z) })),
      meta: { gesamt: Number(summe?.anzahl ?? 0), grenze, sprung },
      error: null,
    })
  } catch (err) {
    console.error('[audit GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

/**
 * Die Werte fuer die Auswahlfelder - was im Protokoll wirklich vorkommt.
 *
 * Eine feste Liste waere falsch: Welche Aktionen ein Projekt kennt, haengt
 * davon ab, was darin getan wurde.
 */
router.get('/projects/:projectId/audit/werte', requireAuth, requireMember, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const leer = "<> ''"
    const [aktionen, bereiche, nutzer, spanne] = await Promise.all([
      db.all(`SELECT DISTINCT action FROM audit_log WHERE project_id = ? AND action ${leer} ORDER BY action`, [projectId]) as Promise<any[]>,
      db.all(`SELECT DISTINCT entity_type FROM audit_log WHERE project_id = ? AND entity_type ${leer} ORDER BY entity_type`, [projectId]) as Promise<any[]>,
      db.all(`SELECT DISTINCT user_name FROM audit_log WHERE project_id = ? AND user_name ${leer} ORDER BY user_name`, [projectId]) as Promise<any[]>,
      db.get('SELECT MIN(created_at) AS erste, MAX(created_at) AS letzte FROM audit_log WHERE project_id = ?', [projectId]) as Promise<any>,
    ])
    return res.json({
      data: {
        aktionen: aktionen.map((z) => z.action),
        bereiche: bereiche.map((z) => z.entity_type),
        nutzer: nutzer.map((z) => z.user_name),
        erste: spanne?.erste ?? null,
        letzte: spanne?.letzte ?? null,
      },
      error: null,
    })
  } catch (err) {
    console.error('[audit werte]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

/**
 * Das gefilterte Protokoll als CSV.
 *
 * Eine Pruefung will die Zeilen im Tabellenprogramm sehen, nicht im Browser
 * blaettern. Die Ausleitung nimmt dieselben Filter wie die Liste, aber keine
 * Seitengrenze - bis 50.000 Zeilen, danach waere die Datei ohnehin niemandem
 * zuzumuten.
 */
router.get('/projects/:projectId/audit/export.csv', requireAuth, requireMember, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)
    const { sql, werte } = einschraenkung(projectId, req.query)
    const zeilen = (await db.all(
      `SELECT * FROM audit_log WHERE ${sql} ORDER BY created_at DESC, id DESC LIMIT 50000`,
      werte
    )) as any[]

    const csv = schreibeCsv(
      ['Zeitpunkt', 'Benutzer', 'Aktion', 'Bereich', 'Datensatz', 'Zusammenfassung', 'Vorher', 'Nachher'],
      zeilen.map((z) => [
        z.created_at ? new Date(z.created_at).toISOString() : '',
        z.user_name || '',
        z.action || '',
        z.entity_type || '',
        z.entity_id ?? '',
        kurzfassung(z),
        // Der ganze Wert bleibt drin: Eine Pruefung will sehen, was vorher
        // dastand, nicht eine Kurzfassung davon.
        z.old_value || '',
        z.new_value || '',
      ])
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="protokoll-${projectId}.csv"`)
    return res.send(csv)
  } catch (err) {
    console.error('[audit CSV]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

export default router
