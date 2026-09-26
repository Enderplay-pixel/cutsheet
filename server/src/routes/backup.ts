import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { importiereInhalt } from '../lib/wiederherstellung'

const router = Router()

// GET /api/projects/:projectId/backup — export full project as JSON
router.get('/projects/:projectId/backup', requireAuth, requireMember, async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId])
    if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

    const backup: Record<string, unknown[]> = {}

    const tables: Array<{ table: string; column: string }> = [
      { table: 'project_settings', column: 'project_id' },
      { table: 'locations', column: 'project_id' },
      { table: 'characters', column: 'project_id' },
      { table: 'cast', column: 'project_id' },
      { table: 'crew', column: 'project_id' },
      { table: 'scenes', column: 'project_id' },
      { table: 'shoot_days', column: 'project_id' },
      { table: 'call_sheets', column: null as unknown as string },
      { table: 'call_sheet_entries', column: null as unknown as string },
      { table: 'daily_reports', column: null as unknown as string },
      { table: 'daily_report_cast', column: null as unknown as string },
      { table: 'shots', column: 'project_id' },
      { table: 'storyboard_frames', column: null as unknown as string },
      { table: 'budget_versions', column: 'project_id' },
      { table: 'budget_lines', column: null as unknown as string },
      { table: 'financing_plan_versions', column: 'project_id' },
      { table: 'financing_entries', column: null as unknown as string },
      { table: 'equipment_lists', column: 'project_id' },
      { table: 'equipment_items', column: null as unknown as string },
      { table: 'comments', column: 'project_id' },
      { table: 'project_events', column: 'project_id' },
      { table: 'drehplan_versions', column: 'project_id' },
      { table: 'email_log', column: 'project_id' },
      { table: 'scene_characters', column: null as unknown as string },
      { table: 'scene_inventory', column: null as unknown as string },
      { table: 'shoot_day_scenes', column: null as unknown as string },
      { table: 'vehicles', column: 'project_id' },
      { table: 'extras', column: 'project_id' },
      { table: 'camera_presets', column: 'project_id' },
      { table: 'sticky_notes', column: 'project_id' },
      { table: 'budget_alerts', column: 'project_id' },
    ]

    // Project itself
    backup['projects'] = [project]

    // Direkte Projekttabellen - aus dem SCHEMA abgeleitet, nicht aus einer
    // gepflegten Liste.
    //
    // Die Liste oben war handgepflegt und ist abgedriftet: gemessen am
    // 23.09.2026 fehlten 29 von 48 Tabellen, darunter screenplay_blocks (der
    // gesamte Drehbuchtext), expenses, timesheets, insurances, music_cues,
    // vfx_shots, floorplans und die komplette Creator-Seite. Eine Sicherung,
    // die stillschweigend Daten verliert, ist schlimmer als keine - man
    // verlaesst sich darauf.
    //
    // Was ein project_id traegt, gehoert zum Projekt. Neue Tabellen kommen so
    // von selbst mit.
    const mitProjektspalte = await db.all(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'project_id'
       ORDER BY table_name`
    ) as Array<{ table_name: string }>

    // Geheimnisse gehoeren nicht in eine Datei, die heruntergeladen und
    // weitergereicht wird. Wer die Sicherung hat, haette sonst Zugriff auf
    // das verknuepfte YouTube-Konto.
    const nichtExportieren = new Set(['access_token', 'refresh_token'])

    for (const { table_name } of mitProjektspalte) {
      // Nur echte Bezeichner, damit nichts Fremdes in die Abfrage geraet
      if (!/^[a-z_][a-z0-9_]*$/.test(table_name)) continue
      const zeilen = await db.all(
        `SELECT * FROM ${table_name} WHERE project_id = ?`, [projectId]) as Record<string, unknown>[]
      backup[table_name] = zeilen.map(z => {
        const sauber: Record<string, unknown> = {}
        for (const [spalte, wert] of Object.entries(z)) {
          if (nichtExportieren.has(spalte)) continue
          sauber[spalte] = wert
        }
        return sauber
      })
    }

    // Die Liste oben deckt nur noch Kindtabellen OHNE project_id ab.
    for (const { table, column } of tables) {
      if (column && !backup[table]) {
        backup[table] = await db.all(`SELECT * FROM ${table} WHERE ${column} = ?`, [projectId])
      }
    }

    // Derived tables — fetch based on parent IDs collected above
    const shootDayIds = (backup['shoot_days'] as Array<{ id: number }>).map(r => r.id)
    const sceneIds = (backup['scenes'] as Array<{ id: number }>).map(r => r.id)
    const shotIds = (backup['shots'] as Array<{ id: number }>).map(r => r.id)
    const budgetVersionIds = (backup['budget_versions'] as Array<{ id: number }>).map(r => r.id)
    const finVersionIds = (backup['financing_plan_versions'] as Array<{ id: number }>).map(r => r.id)
    const equipListIds = (backup['equipment_lists'] as Array<{ id: number }>).map(r => r.id)

    const inList = (ids: number[]) => ids.length > 0 ? `(${ids.join(',')})` : '(NULL)'

    backup['scene_characters'] = sceneIds.length
      ? await db.all(`SELECT * FROM scene_characters WHERE scene_id IN ${inList(sceneIds)}`)
      : []
    backup['scene_inventory'] = sceneIds.length
      ? await db.all(`SELECT * FROM scene_inventory WHERE scene_id IN ${inList(sceneIds)}`)
      : []
    backup['shoot_day_scenes'] = shootDayIds.length
      ? await db.all(`SELECT * FROM shoot_day_scenes WHERE shoot_day_id IN ${inList(shootDayIds)}`)
      : []

    const callSheetRows = shootDayIds.length
      ? await db.all(`SELECT * FROM call_sheets WHERE shoot_day_id IN ${inList(shootDayIds)}`) as Array<{ id: number }>
      : []
    backup['call_sheets'] = callSheetRows
    const callSheetIds = callSheetRows.map(r => r.id)
    backup['call_sheet_entries'] = callSheetIds.length
      ? await db.all(`SELECT * FROM call_sheet_entries WHERE call_sheet_id IN ${inList(callSheetIds)}`)
      : []

    const dailyReportRows = shootDayIds.length
      ? await db.all(`SELECT * FROM daily_reports WHERE shoot_day_id IN ${inList(shootDayIds)}`) as Array<{ id: number }>
      : []
    backup['daily_reports'] = dailyReportRows
    const dailyReportIds = dailyReportRows.map(r => r.id)
    backup['daily_report_cast'] = dailyReportIds.length
      ? await db.all(`SELECT * FROM daily_report_cast WHERE daily_report_id IN ${inList(dailyReportIds)}`)
      : []

    backup['storyboard_frames'] = shotIds.length
      ? await db.all(`SELECT * FROM storyboard_frames WHERE shot_id IN ${inList(shotIds)}`)
      : []

    backup['budget_lines'] = budgetVersionIds.length
      ? await db.all(`SELECT * FROM budget_lines WHERE budget_version_id IN ${inList(budgetVersionIds)}`)
      : []
    backup['financing_entries'] = finVersionIds.length
      ? await db.all(`SELECT * FROM financing_entries WHERE financing_version_id IN ${inList(finVersionIds)}`)
      : []
    backup['equipment_items'] = equipListIds.length
      ? await db.all(`SELECT * FROM equipment_items WHERE equipment_list_id IN ${inList(equipListIds)}`)
      : []

    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      data: backup,
    }

    res.setHeader('Content-Disposition', `attachment; filename="cutsheet-backup-project-${projectId}.json"`)
    res.setHeader('Content-Type', 'application/json')
    return res.json({ data: exportData, error: null })
  } catch (err) {
    console.error('[backup GET]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler' })
  }
})

// POST /api/projects/import — import a previously exported JSON backup as new project
/**
 * Eine Sicherung zurückspielen.
 *
 * Das Projekt wird hier angelegt, alles Weitere übernimmt importiereInhalt
 * über das Schema. Vorher stand hier eine Liste von 25 Tabellen von Hand -
 * die Sicherung enthält 61. Gemessen am 26.09.2026: 300 Drehbuchblöcke in
 * der Datei, 0 nach dem Zurückspielen.
 */
router.post('/projects/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body as { data?: { version?: number; data?: Record<string, unknown[]> } }
    if (!body.data || !body.data.data) {
      return res.status(400).json({ data: null, error: 'Ungültiges Backup-Format' })
    }

    const importData = body.data.data
    const originalProject = importData['projects']?.[0] as Record<string, unknown> | undefined
    if (!originalProject) {
      return res.status(400).json({ data: null, error: 'Projekt-Daten fehlen im Backup' })
    }

    const nutzerId = (req as any).user.id

    const newProjectResult = await db.run(`
      INSERT INTO projects (title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `${originalProject['title']} (Import)`,
      originalProject['genre'] || '',
      originalProject['format'] || 'Kurzfilm',
      originalProject['length_minutes'] || 0,
      originalProject['status'] || 'Vorproduktion',
      originalProject['synopsis'] || '',
      originalProject['director'] || '',
      originalProject['producer'] || '',
      originalProject['dop'] || '',
      originalProject['production_company'] || '',
      originalProject['shoot_start'] || null,
      originalProject['shoot_end'] || null,
      nutzerId,
    ])
    const newProjectId = newProjectResult.id

    await db.run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO NOTHING',
      [newProjectId, nutzerId, 'admin']
    )

    const bericht = await importiereInhalt(importData, Number(newProjectId), Number(nutzerId))

    const newProject = await db.get('SELECT * FROM projects WHERE id = ?', [newProjectId])
    return res.status(201).json({
      data: { project: newProject, projectId: newProjectId, bericht },
      error: null,
    })
  } catch (err) {
    console.error('[backup import POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler beim Import' })
  }
})

export default router
