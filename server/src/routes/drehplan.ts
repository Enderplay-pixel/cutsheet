import { Router } from 'express'
import { db } from '../db'
import { getUserProjectRole, requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

/**
 * Drehtage durchnummerieren - nach Datum, nicht nach Anlegereihenfolge.
 *
 * Gemessen am 26.09.2026: wer nachträglich einen früheren Tag anlegt, bekam
 * die nächste freie Nummer. Ein Plan mit Tag 3 am 5. November und Tag 1 am
 * 10. November ist kein Plan. Nachgeschobene Tage - ein Nachdreh, ein
 * vergessenes Motiv - sind in der Produktion die Regel.
 *
 * Gleiches Datum: die zuerst angelegte Zeile bleibt vorn.
 */
export async function nummeriereDrehtage(projectId: number | string) {
  const tage = await db.all(
    'SELECT id FROM shoot_days WHERE project_id = ? ORDER BY date ASC, id ASC',
    [projectId]
  ) as any[]
  await db.transaction(async (tx) => {
    for (let i = 0; i < tage.length; i++) {
      await tx.run('UPDATE shoot_days SET day_number = ? WHERE id = ?', [i + 1, tage[i].id])
    }
  })
}

async function getShootDayWithScenes(dayId: number | bigint) {
  const day = await db.get('SELECT * FROM shoot_days WHERE id = ?', [dayId]) as any
  if (!day) return null
  const scenes = await db.all(`
    SELECT sds.*, s.scene_number, s.title, s.int_ext, s.day_night, s.eighths, s.estimated_minutes, s.description, s.notes,
           s.location_id, l.name as location_name
    FROM shoot_day_scenes sds
    JOIN scenes s ON sds.scene_id = s.id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE sds.shoot_day_id = ?
    ORDER BY sds.sort_order ASC
  `, [dayId])

  const total_eighths = (scenes as any[]).reduce((sum: number, s: any) => sum + (s.eighths || 0), 0)
  const estimated_minutes = (scenes as any[]).reduce((sum: number, s: any) => sum + (s.estimated_minutes || 0), 0)
  return { ...day, scenes, total_eighths, estimated_minutes }
}

// GET /api/projects/:projectId/shoot-days
router.get('/projects/:projectId/shoot-days', async (req, res) => {
  const days = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY date ASC, id ASC', [req.params.projectId])
  const result = await Promise.all((days as any[]).map(d => getShootDayWithScenes(d.id)))
  res.json({ data: result, error: null })
})

// POST /api/projects/:projectId/shoot-days
router.post('/projects/:projectId/shoot-days', async (req, res) => {
  const { date, status = 'Geplant', unit = 'Haupteinheit', notes = '' } = req.body
  const result = await db.run('INSERT INTO shoot_days (project_id, day_number, date, status, unit, notes) VALUES (?, ?, ?, ?, ?, ?)', [req.params.projectId, 0, date, status, unit, notes])
  await nummeriereDrehtage(req.params.projectId)
  res.status(201).json({ data: await getShootDayWithScenes(result.id), error: null })
})

// POST /api/projects/:projectId/shoot-days/batch - create multiple days from a date range
router.post('/projects/:projectId/shoot-days/batch', async (req, res) => {
  const { dates } = req.body   // string[] of 'YYYY-MM-DD'
  if (!Array.isArray(dates) || dates.length === 0)
    return res.status(400).json({ data: null, error: 'dates array required' })

  const neueIds: any[] = []
  for (const date of dates) {
    const result = await db.run(
      'INSERT INTO shoot_days (project_id, day_number, date, status, unit, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.projectId, 0, date, 'Geplant', 'Haupteinheit', '']
    )
    neueIds.push(result.id)
  }
  await nummeriereDrehtage(req.params.projectId)

  const created: any[] = []
  for (const id of neueIds) {
    const day = await getShootDayWithScenes(id)
    if (day) created.push(day)
  }
  res.status(201).json({ data: created, error: null })
})

// PUT /api/shoot-days/:id
router.put('/shoot-days/:id', async (req, res) => {
  const { date, status, unit, notes, catering_count } = req.body
  await db.run('UPDATE shoot_days SET date=COALESCE(?,date), status=COALESCE(?,status), unit=COALESCE(?,unit), notes=COALESCE(?,notes), catering_count=COALESCE(?,catering_count) WHERE id=?',
    [date ?? null, status ?? null, unit ?? null, notes ?? null, catering_count ?? null, req.params.id])
  if (date) {
    // Ein verschobener Tag aendert die Reihenfolge des ganzen Plans.
    const tag = await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [req.params.id]) as any
    if (tag) await nummeriereDrehtage(tag.project_id)
  }
  res.json({ data: await getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// DELETE /api/shoot-days/:id
router.delete('/shoot-days/:id', async (req, res) => {
  // Re-number remaining days
  const day = await db.get('SELECT * FROM shoot_days WHERE id = ?', [req.params.id]) as any
  if (day) {
    await db.run('DELETE FROM shoot_days WHERE id = ?', [req.params.id])
    // Nicht "alle darueber minus eins": teilen sich zwei Tage eine Nummer,
    // rutschen sie damit uebereinander. Neu durchzaehlen ist eindeutig.
    await nummeriereDrehtage(day.project_id)
  }
  res.json({ data: { ok: true }, error: null })
})

// POST /api/shoot-days/:id/scenes
router.post('/shoot-days/:id/scenes', async (req, res) => {
  const { scene_id, sort_order = 0, estimated_minutes = null } = req.body
  try {
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order, estimated_minutes) VALUES (?, ?, ?, ?)', [req.params.id, scene_id, sort_order, estimated_minutes])
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.message?.includes('unique')) {
      return res.status(409).json({ data: null, error: 'Szene bereits in diesem Drehtag' })
    }
    throw e
  }
  res.json({ data: await getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// DELETE /api/shoot-days/:dayId/scenes/:sceneId
router.delete('/shoot-days/:dayId/scenes/:sceneId', async (req, res) => {
  await db.run('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ? AND scene_id = ?', [req.params.dayId, req.params.sceneId])
  res.json({ data: await getShootDayWithScenes(parseInt(req.params.dayId)), error: null })
})

// PUT /api/shoot-days/:id/scenes/reorder
router.put('/shoot-days/:id/scenes/reorder', async (req, res) => {
  const { order } = req.body // array of { sceneId, sortOrder }
  await db.transaction(async (tx) => {
    for (const item of order as { sceneId: number; sortOrder: number }[]) {
      await tx.run('UPDATE shoot_day_scenes SET sort_order = ? WHERE shoot_day_id = ? AND scene_id = ?', [item.sortOrder, req.params.id, item.sceneId])
    }
  })
  res.json({ data: await getShootDayWithScenes(parseInt(req.params.id)), error: null })
})

// POST /api/shoot-days/move-scene
/**
 * Die einzige schreibende Route ohne Ressourcen-ID im Pfad: Szene und
 * Drehtag stehen im Koerper. projectWriteGuard findet dort kein Projekt und
 * liess deshalb jeden durch - am 26.09.2026 nachgemessen: ein fremdes Konto
 * konnte Szenen im fremden Drehplan verschieben. Die Pruefung muss hier
 * selbst stehen.
 */
router.post('/shoot-days/move-scene', async (req, res) => {
  const { sceneId, fromDayId, toDayId, sortOrder = 0 } = req.body

  const nutzer = (req as any).user
  if (!nutzer) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const szene = await db.get('SELECT project_id FROM scenes WHERE id = ?', [sceneId]) as any
  const ziel = toDayId
    ? await db.get('SELECT project_id FROM shoot_days WHERE id = ?', [toDayId]) as any
    : null
  const projektId = szene?.project_id ?? ziel?.project_id
  if (!projektId) return res.status(404).json({ data: null, error: 'Szene oder Drehtag nicht gefunden' })

  // Szene und Zieltag muessen zum selben Projekt gehoeren, sonst waere die
  // Zuordnung ueber Projektgrenzen hinweg moeglich.
  if (ziel && Number(ziel.project_id) !== Number(projektId)) {
    return res.status(400).json({ data: null, error: 'Szene und Drehtag gehören zu verschiedenen Projekten.' })
  }

  if (nutzer.role !== 'admin' && await getUserProjectRole(nutzer.id, projektId) === null) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  await db.transaction(async (tx) => {
    // Aus ALLEN Drehtagen entfernen, nicht nur aus dem, den der Client fuer
    // den aktuellen haelt. Sonst landet die Szene bei einem veralteten Stand
    // oder zwei gleichzeitigen Zuegen an mehreren Tagen - nachgemessen am
    // 23.09.2026: zwei parallele Aufrufe, danach lag die Szene an Tag 2 UND 3,
    // und jede Folgerechnung zaehlte sie doppelt.
    await tx.run('DELETE FROM shoot_day_scenes WHERE scene_id = ?', [sceneId])
    void fromDayId
    if (toDayId) {
      try {
        await tx.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?)', [toDayId, sceneId, sortOrder])
      } catch (e: any) {
        if (!e.message?.includes('UNIQUE') && !e.message?.includes('unique')) throw e
        await tx.run('UPDATE shoot_day_scenes SET sort_order = ? WHERE shoot_day_id = ? AND scene_id = ?', [sortOrder, toDayId, sceneId])
      }
    }
  })

  res.json({ data: { ok: true }, error: null })
})

// GET /api/projects/:projectId/drehplan/versions
router.get('/projects/:projectId/drehplan/versions', async (req, res) => {
  const versions = await db.all('SELECT id, project_id, name, created_at FROM drehplan_versions WHERE project_id = ? ORDER BY created_at DESC', [req.params.projectId])
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/drehplan/snapshot
router.post('/projects/:projectId/drehplan/snapshot', async (req, res) => {
  const { name = `Snapshot ${new Date().toLocaleString('de-DE')}` } = req.body
  const days = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number', [req.params.projectId])
  const fullDrehplan = await Promise.all((days as any[]).map(d => getShootDayWithScenes(d.id)))
  const result = await db.run('INSERT INTO drehplan_versions (project_id, name, snapshot_json) VALUES (?, ?, ?)', [req.params.projectId, name, JSON.stringify(fullDrehplan)])
  res.status(201).json({ data: await db.get('SELECT id, project_id, name, created_at FROM drehplan_versions WHERE id = ?', [result.id]), error: null })
})

// POST /api/projects/:projectId/drehplan/restore/:versionId
router.post('/projects/:projectId/drehplan/restore/:versionId', async (req, res) => {
  const version = await db.get('SELECT * FROM drehplan_versions WHERE id = ? AND project_id = ?', [req.params.versionId, req.params.projectId]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })

  const snapshot: any[] = JSON.parse(version.snapshot_json)

  // Delete all current shoot day ↔ scene assignments, keep the days + scenes themselves
  const currentDays = await db.all('SELECT id FROM shoot_days WHERE project_id = ?', [req.params.projectId]) as any[]
  for (const d of currentDays) {
    await db.run('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ?', [d.id])
  }

  // Re-apply scene assignments from snapshot
  for (const snapDay of snapshot) {
    // Find matching live day by day_number (best-effort match)
    const liveDay = await db.get('SELECT id FROM shoot_days WHERE project_id = ? AND day_number = ?', [req.params.projectId, snapDay.day_number]) as any
    if (!liveDay) continue
    for (const [i, s] of (snapDay.scenes || []).entries()) {
      // scene is identified by scene_id in the snapshot
      const sceneId = s.scene_id || s.id
      const sceneExists = await db.get('SELECT id FROM scenes WHERE id = ? AND project_id = ?', [sceneId, req.params.projectId])
      if (!sceneExists) continue
      try {
        await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?)', [liveDay.id, sceneId, i])
      } catch (e: any) {
        if (!e.message?.includes('UNIQUE') && !e.message?.includes('unique')) throw e
      }
    }
  }

  const days = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number', [req.params.projectId])
  const result = await Promise.all((days as any[]).map(d => getShootDayWithScenes(d.id)))
  res.json({ data: result, error: null })
})

// DELETE /api/drehplan-versions/:id
router.delete('/drehplan-versions/:id', async (req, res) => {
  await db.run('DELETE FROM drehplan_versions WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
