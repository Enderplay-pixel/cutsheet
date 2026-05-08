import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

// GET /api/projects/:projectId/backup — export full project as JSON
router.get('/projects/:projectId/backup', requireAuth, (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.projectId)

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
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

    // Direct project tables
    for (const { table, column } of tables) {
      if (column) {
        backup[table] = db.prepare(`SELECT * FROM ${table} WHERE ${column} = ?`).all(projectId)
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
      ? db.prepare(`SELECT * FROM scene_characters WHERE scene_id IN ${inList(sceneIds)}`).all()
      : []
    backup['scene_inventory'] = sceneIds.length
      ? db.prepare(`SELECT * FROM scene_inventory WHERE scene_id IN ${inList(sceneIds)}`).all()
      : []
    backup['shoot_day_scenes'] = shootDayIds.length
      ? db.prepare(`SELECT * FROM shoot_day_scenes WHERE shoot_day_id IN ${inList(shootDayIds)}`).all()
      : []

    const callSheetRows = shootDayIds.length
      ? db.prepare(`SELECT * FROM call_sheets WHERE shoot_day_id IN ${inList(shootDayIds)}`).all() as Array<{ id: number }>
      : []
    backup['call_sheets'] = callSheetRows
    const callSheetIds = callSheetRows.map(r => r.id)
    backup['call_sheet_entries'] = callSheetIds.length
      ? db.prepare(`SELECT * FROM call_sheet_entries WHERE call_sheet_id IN ${inList(callSheetIds)}`).all()
      : []

    const dailyReportRows = shootDayIds.length
      ? db.prepare(`SELECT * FROM daily_reports WHERE shoot_day_id IN ${inList(shootDayIds)}`).all() as Array<{ id: number }>
      : []
    backup['daily_reports'] = dailyReportRows
    const dailyReportIds = dailyReportRows.map(r => r.id)
    backup['daily_report_cast'] = dailyReportIds.length
      ? db.prepare(`SELECT * FROM daily_report_cast WHERE daily_report_id IN ${inList(dailyReportIds)}`).all()
      : []

    backup['storyboard_frames'] = shotIds.length
      ? db.prepare(`SELECT * FROM storyboard_frames WHERE shot_id IN ${inList(shotIds)}`).all()
      : []

    backup['budget_lines'] = budgetVersionIds.length
      ? db.prepare(`SELECT * FROM budget_lines WHERE budget_version_id IN ${inList(budgetVersionIds)}`).all()
      : []
    backup['financing_entries'] = finVersionIds.length
      ? db.prepare(`SELECT * FROM financing_entries WHERE financing_version_id IN ${inList(finVersionIds)}`).all()
      : []
    backup['equipment_items'] = equipListIds.length
      ? db.prepare(`SELECT * FROM equipment_items WHERE equipment_list_id IN ${inList(equipListIds)}`).all()
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
router.post('/projects/import', requireAuth, (req: Request, res: Response) => {
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

    // Insert new project (strip id, created_at, updated_at)
    const newProjectResult = db.prepare(`
      INSERT INTO projects (title, genre, format, length_minutes, status, synopsis, director, producer, dop, production_company, shoot_start, shoot_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    )
    const newProjectId = newProjectResult.lastInsertRowid
    const oldProjectId = Number(originalProject['id'])

    // ID remapping maps: oldId -> newId for each table
    const idMap: Record<string, Map<number, number>> = {}

    function remap(table: string, rows: unknown[], insertFn: (row: Record<string, unknown>) => number) {
      idMap[table] = new Map()
      for (const row of rows as Record<string, unknown>[]) {
        const oldId = Number(row['id'])
        const newId = insertFn(row)
        idMap[table].set(oldId, newId)
      }
    }

    function getMapped(table: string, oldId: unknown): number | null {
      if (oldId == null) return null
      return idMap[table]?.get(Number(oldId)) ?? null
    }

    // project_settings
    const settingsRows = (importData['project_settings'] || []) as Record<string, unknown>[]
    for (const row of settingsRows) {
      db.prepare(`
        INSERT INTO project_settings (project_id, default_call_time, default_wrap_time, turnaround_hours, currency, country, logo_url, header_color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newProjectId, row['default_call_time'], row['default_wrap_time'], row['turnaround_hours'], row['currency'], row['country'], row['logo_url'] ?? null, row['header_color'])
    }

    // locations
    remap('locations', importData['locations'] || [], (row) => {
      const r = db.prepare(`
        INSERT INTO locations (project_id, name, address, city, zip, country, lat, lng, contact_name, contact_phone, contact_email, rental_fee, parking_info, power_available, notes, photos)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newProjectId, row['name'], row['address'], row['city'], row['zip'], row['country'], row['lat'] ?? null, row['lng'] ?? null, row['contact_name'], row['contact_phone'], row['contact_email'], row['rental_fee'], row['parking_info'], row['power_available'], row['notes'], row['photos'] || '[]')
      return r.lastInsertRowid
    })

    // characters
    remap('characters', importData['characters'] || [], (row) => {
      const r = db.prepare(`
        INSERT INTO characters (project_id, name, description, age_range, gender, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newProjectId, row['name'], row['description'], row['age_range'], row['gender'], row['sort_order'])
      return r.lastInsertRowid
    })

    // cast
    remap('cast', importData['cast'] || [], (row) => {
      const r = db.prepare(`
        INSERT INTO cast (project_id, character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, photo_url, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newProjectId, getMapped('characters', row['character_id']), row['actor_name'], row['email'], row['phone'], row['agent'], row['agent_email'], row['agency'], row['fee_per_day'], row['contract_type'], row['availability_notes'], row['photo_url'] ?? null, row['notes'])
      return r.lastInsertRowid
    })

    // crew
    remap('crew', importData['crew'] || [], (row) => {
      const r = db.prepare(`
        INSERT INTO crew (project_id, name, department, role, email, phone, fee_per_day, contract_type, availability_notes, notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newProjectId, row['name'], row['department'], row['role'], row['email'], row['phone'], row['fee_per_day'], row['contract_type'], row['availability_notes'], row['notes'], row['sort_order'])
      return r.lastInsertRowid
    })

    // scenes
    remap('scenes', importData['scenes'] || [], (row) => {
      const r = db.prepare(`
        INSERT INTO scenes (project_id, scene_number, sort_order, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newProjectId, row['scene_number'], row['sort_order'], row['title'], row['description'], getMapped('locations', row['location_id']), row['int_ext'], row['day_night'], row['eighths'], row['estimated_minutes'], row['notes'])
      return r.lastInsertRowid
    })

    // scene_characters
    for (const row of (importData['scene_characters'] || []) as Record<string, unknown>[]) {
      const newSceneId = getMapped('scenes', row['scene_id'])
      const newCharId = getMapped('characters', row['character_id'])
      if (newSceneId && newCharId) {
        try {
          db.prepare('INSERT INTO scene_characters (scene_id, character_id, role_in_scene) VALUES (?, ?, ?)').run(newSceneId, newCharId, row['role_in_scene'] || '')
        } catch { /* ignore UNIQUE */ }
      }
    }

    // scene_inventory
    for (const row of (importData['scene_inventory'] || []) as Record<string, unknown>[]) {
      const newSceneId = getMapped('scenes', row['scene_id'])
      if (newSceneId) {
        db.prepare('INSERT INTO scene_inventory (scene_id, item, category, quantity, notes) VALUES (?, ?, ?, ?, ?)').run(newSceneId, row['item'], row['category'], row['quantity'], row['notes'])
      }
    }

    // shoot_days
    remap('shoot_days', importData['shoot_days'] || [], (row) => {
      const r = db.prepare(`
        INSERT INTO shoot_days (project_id, day_number, date, status, unit, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newProjectId, row['day_number'], row['date'], row['status'], row['unit'], row['notes'])
      return r.lastInsertRowid
    })

    // shoot_day_scenes
    for (const row of (importData['shoot_day_scenes'] || []) as Record<string, unknown>[]) {
      const newDayId = getMapped('shoot_days', row['shoot_day_id'])
      const newSceneId = getMapped('scenes', row['scene_id'])
      if (newDayId && newSceneId) {
        try {
          db.prepare('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order, estimated_minutes) VALUES (?, ?, ?, ?)').run(newDayId, newSceneId, row['sort_order'], row['estimated_minutes'] ?? null)
        } catch { /* ignore UNIQUE */ }
      }
    }

    // call_sheets
    remap('call_sheets', importData['call_sheets'] || [], (row) => {
      const r = db.prepare(`
        INSERT INTO call_sheets (shoot_day_id, general_call, shooting_call, location_id, weather_forecast, sunrise, sunset, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(getMapped('shoot_days', row['shoot_day_id']), row['general_call'], row['shooting_call'], getMapped('locations', row['location_id']), row['weather_forecast'], row['sunrise'], row['sunset'], row['notes'])
      return r.lastInsertRowid
    })

    // call_sheet_entries
    for (const row of (importData['call_sheet_entries'] || []) as Record<string, unknown>[]) {
      const newCsId = getMapped('call_sheets', row['call_sheet_id'])
      if (newCsId) {
        db.prepare('INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time, pickup_location, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(newCsId, row['person_type'], row['person_id'], row['call_time'], row['pickup_location'], row['notes'], row['sort_order'])
      }
    }

    // shots
    remap('shots', importData['shots'] || [], (row) => {
      const r = db.prepare(`
        INSERT INTO shots (project_id, scene_id, shoot_day_id, shot_number, sort_order, size, movement, lens_mm, description, notes, storyboard_url, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newProjectId, getMapped('scenes', row['scene_id']), getMapped('shoot_days', row['shoot_day_id']), row['shot_number'], row['sort_order'], row['size'], row['movement'], row['lens_mm'], row['description'], row['notes'], row['storyboard_url'] ?? null, row['duration_seconds'] ?? null)
      return r.lastInsertRowid
    })

    // budget_versions
    remap('budget_versions', importData['budget_versions'] || [], (row) => {
      const r = db.prepare('INSERT INTO budget_versions (project_id, name, status, total_cents) VALUES (?, ?, ?, ?)').run(newProjectId, row['name'], row['status'], row['total_cents'])
      return r.lastInsertRowid
    })

    // budget_lines
    for (const row of (importData['budget_lines'] || []) as Record<string, unknown>[]) {
      const newBvId = getMapped('budget_versions', row['budget_version_id'])
      if (newBvId) {
        db.prepare('INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(newBvId, row['category'], row['account_code'], row['description'], row['unit'], row['quantity'], row['unit_price_cents'], row['total_cents'], row['notes'], row['sort_order'])
      }
    }

    // financing_plan_versions
    remap('financing_plan_versions', importData['financing_plan_versions'] || [], (row) => {
      const r = db.prepare('INSERT INTO financing_plan_versions (project_id, name, total_cents) VALUES (?, ?, ?)').run(newProjectId, row['name'], row['total_cents'])
      return r.lastInsertRowid
    })

    // financing_entries
    for (const row of (importData['financing_entries'] || []) as Record<string, unknown>[]) {
      const newFvId = getMapped('financing_plan_versions', row['financing_version_id'])
      if (newFvId) {
        db.prepare('INSERT INTO financing_entries (financing_version_id, source, type, amount_cents, confirmed, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(newFvId, row['source'], row['type'], row['amount_cents'], row['confirmed'], row['notes'], row['sort_order'])
      }
    }

    // equipment_lists
    remap('equipment_lists', importData['equipment_lists'] || [], (row) => {
      const r = db.prepare('INSERT INTO equipment_lists (project_id, name, department, shoot_day_id, notes) VALUES (?, ?, ?, ?, ?)').run(newProjectId, row['name'], row['department'], getMapped('shoot_days', row['shoot_day_id']), row['notes'])
      return r.lastInsertRowid
    })

    // equipment_items
    for (const row of (importData['equipment_items'] || []) as Record<string, unknown>[]) {
      const newElId = getMapped('equipment_lists', row['equipment_list_id'])
      if (newElId) {
        db.prepare('INSERT INTO equipment_items (equipment_list_id, item, quantity, supplier, rental_per_day_cents, total_days, total_cents, checked, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(newElId, row['item'], row['quantity'], row['supplier'], row['rental_per_day_cents'], row['total_days'], row['total_cents'], row['checked'], row['notes'], row['sort_order'])
      }
    }

    // project_events
    for (const row of (importData['project_events'] || []) as Record<string, unknown>[]) {
      db.prepare('INSERT INTO project_events (project_id, title, start_date, end_date, type, color, notes, all_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(newProjectId, row['title'], row['start_date'], row['end_date'] ?? null, row['type'], row['color'], row['notes'], row['all_day'])
    }

    // vehicles, extras, camera_presets, sticky_notes
    for (const row of (importData['vehicles'] || []) as Record<string, unknown>[]) {
      db.prepare('INSERT INTO vehicles (project_id, name, license_plate, type, capacity, driver_name, driver_phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(newProjectId, row['name'], row['license_plate'], row['type'], row['capacity'], row['driver_name'], row['driver_phone'], row['notes'])
    }
    for (const row of (importData['extras'] || []) as Record<string, unknown>[]) {
      db.prepare('INSERT INTO extras (project_id, name, phone, email, tariff_group, notes) VALUES (?, ?, ?, ?, ?, ?)').run(newProjectId, row['name'], row['phone'], row['email'], row['tariff_group'], row['notes'])
    }
    for (const row of (importData['camera_presets'] || []) as Record<string, unknown>[]) {
      db.prepare('INSERT INTO camera_presets (project_id, name, camera, lenses, notes) VALUES (?, ?, ?, ?, ?)').run(newProjectId, row['name'], row['camera'], row['lenses'], row['notes'])
    }
    for (const row of (importData['sticky_notes'] || []) as Record<string, unknown>[]) {
      db.prepare('INSERT INTO sticky_notes (project_id, content, color, position_x, position_y) VALUES (?, ?, ?, ?, ?)').run(newProjectId, row['content'], row['color'], row['position_x'], row['position_y'])
    }

    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(newProjectId)
    return res.status(201).json({ data: { project: newProject, projectId: newProjectId }, error: null })
  } catch (err) {
    console.error('[backup import POST]', err)
    return res.status(500).json({ data: null, error: 'Interner Serverfehler beim Import' })
  }
})

export default router
