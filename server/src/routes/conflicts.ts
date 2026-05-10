import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

router.get('/projects/:projectId/conflicts', async (req, res) => {
  const pid = req.params.projectId
  const conflicts: any[] = []

  // 1. Scenes in multiple shoot days
  try {
    const dupScenes = await db.all(`
      SELECT s.scene_number, s.title, COUNT(sds.shoot_day_id) as day_count
      FROM shoot_day_scenes sds
      JOIN scenes s ON sds.scene_id = s.id
      JOIN shoot_days sd ON sds.shoot_day_id = sd.id
      WHERE sd.project_id = ?
      GROUP BY sds.scene_id
      HAVING day_count > 1
    `, [pid]) as any[]

    dupScenes.forEach(s => {
      conflicts.push({
        severity: 'error', category: 'Drehplan',
        message: `Szene ${s.scene_number} „${s.title}" ist ${s.day_count} Drehtagen zugewiesen`,
        detail: 'Eine Szene darf nur einem Drehtag zugeordnet sein.',
        link: 'drehplan'
      })
    })
  } catch (e) { /* ignore */ }

  // 2. Unscheduled scenes
  try {
    const unscheduled = await db.all(`
      SELECT s.scene_number, s.title FROM scenes s
      WHERE s.project_id = ?
      AND s.id NOT IN (
        SELECT sds.scene_id FROM shoot_day_scenes sds
        JOIN shoot_days sd ON sds.shoot_day_id = sd.id WHERE sd.project_id = ?
      )
    `, [pid, pid]) as any[]

    if (unscheduled.length > 0) {
      conflicts.push({
        severity: 'warning', category: 'Drehplan',
        message: `${unscheduled.length} Szene(n) noch nicht im Drehplan`,
        detail: unscheduled.map(s => `Sz. ${s.scene_number}: ${s.title}`).join(', '),
        link: 'drehplan'
      })
    }
  } catch (e) { /* ignore */ }

  // 3. Empty shoot days
  try {
    const emptyDays = await db.all(`
      SELECT sd.day_number, sd.date FROM shoot_days sd
      WHERE sd.project_id = ?
      AND sd.id NOT IN (SELECT DISTINCT shoot_day_id FROM shoot_day_scenes)
      AND sd.status NOT IN ('Sperrtag', 'Drehfrei', 'Reisetag', 'Feiertag')
    `, [pid]) as any[]

    emptyDays.forEach(d => {
      conflicts.push({
        severity: 'warning', category: 'Drehplan',
        message: `Drehtag ${d.day_number} (${d.date}) enthält keine Szenen`,
        link: 'drehplan'
      })
    })
  } catch (e) { /* ignore */ }

  // 4. Cast without character
  try {
    const castNoChar = await db.all(`SELECT actor_name FROM cast WHERE project_id = ? AND character_id IS NULL`, [pid]) as any[]
    castNoChar.forEach(c => {
      conflicts.push({
        severity: 'info', category: 'Besetzung',
        message: `${c.actor_name} ist keiner Rolle zugewiesen`,
        link: 'besetzung'
      })
    })
  } catch (e) { /* ignore */ }

  // 5. Scenes without location
  try {
    const scenesNoLoc = await db.all('SELECT scene_number, title FROM scenes WHERE project_id = ? AND location_id IS NULL', [pid]) as any[]
    if (scenesNoLoc.length > 0) {
      conflicts.push({
        severity: 'info', category: 'Motive',
        message: `${scenesNoLoc.length} Szene(n) ohne Motivzuweisung`,
        detail: scenesNoLoc.map(s => `Sz. ${s.scene_number}`).join(', '),
        link: 'motive'
      })
    }
  } catch (e) { /* ignore */ }

  // 6. Locations without address
  try {
    const locNoAddr = await db.all(`SELECT name FROM locations WHERE project_id = ? AND (address = '' OR address IS NULL)`, [pid]) as any[]
    locNoAddr.forEach(l => {
      conflicts.push({
        severity: 'info', category: 'Motive',
        message: `Motiv „${l.name}" hat keine Adresse`,
        link: 'motive'
      })
    })
  } catch (e) { /* ignore */ }

  // 7. Budget vs financing
  try {
    const budget = await db.get(`SELECT COALESCE(total_cents, 0) as t FROM budget_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`, [pid]) as any
    const financing = await db.get(`SELECT COALESCE(total_cents, 0) as t FROM financing_plan_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`, [pid]) as any
    const gap = (budget?.t || 0) - (financing?.t || 0)
    if (gap > 5000) { // >50€ gap
      conflicts.push({
        severity: 'warning', category: 'Budget',
        message: `Finanzierungslücke von ${(gap / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`,
        detail: `Budget (${(budget?.t / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}) übersteigt Finanzierung (${(financing?.t / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})`,
        link: 'budget'
      })
    }
  } catch (e) { /* ignore */ }

  // 8. No budget versions at all
  try {
    const budgetCount = await db.get(`SELECT COUNT(*) as c FROM budget_versions WHERE project_id = ?`, [pid]) as any
    if (!budgetCount || budgetCount.c === 0) {
      conflicts.push({
        severity: 'info', category: 'Budget',
        message: 'Noch keine Kalkulation erstellt',
        link: 'budget'
      })
    }
  } catch (e) { /* ignore */ }

  // 9. Scenes without any characters
  try {
    const scenesNoChars = await db.all(`
      SELECT s.scene_number, s.title FROM scenes s
      WHERE s.project_id = ?
      AND s.id NOT IN (SELECT DISTINCT scene_id FROM scene_characters)
    `, [pid]) as any[]
    if (scenesNoChars.length > 0) {
      conflicts.push({
        severity: 'info', category: 'Szenen',
        message: `${scenesNoChars.length} Szene(n) ohne Figuren`,
        detail: scenesNoChars.map(s => `Sz. ${s.scene_number}`).join(', '),
        link: 'drehbuch'
      })
    }
  } catch (e) { /* ignore */ }

  // 10. Turnaround violations — cast called back before minimum rest
  try {
    const settings = await db.get('SELECT turnaround_hours FROM project_settings WHERE project_id = ?', [pid]) as any
    const turnaroundMins = (settings?.turnaround_hours ?? 11) * 60

    // Get all call sheet entries for this project, joined to shoot day date
    const entries = await db.all(`
      SELECT cse.person_type, cse.person_id, cse.call_time, sd.date, sd.day_number,
             cs.general_call
      FROM call_sheet_entries cse
      JOIN call_sheets cs ON cse.call_sheet_id = cs.id
      JOIN shoot_days sd ON cs.shoot_day_id = sd.id
      WHERE sd.project_id = ?
      ORDER BY cse.person_type, cse.person_id, sd.date ASC
    `, [pid]) as any[]

    // Group by person
    const byPerson: Record<string, any[]> = {}
    entries.forEach((e: any) => {
      const key = `${e.person_type}:${e.person_id}`
      if (!byPerson[key]) byPerson[key] = []
      byPerson[key].push(e)
    })

    // Also get daily reports for wrap times
    const reports = await db.all(`
      SELECT dr.wrap, sd.date FROM daily_reports dr
      JOIN shoot_days sd ON dr.shoot_day_id = sd.id
      WHERE sd.project_id = ?
    `, [pid]) as any[]
    const wrapByDate: Record<string, number> = {}
    reports.forEach((r: any) => { wrapByDate[r.date] = r.wrap })

    for (const [key, days] of Object.entries(byPerson)) {
      for (let i = 0; i < days.length - 1; i++) {
        const today = days[i]
        const tomorrow = days[i + 1]
        // Only check consecutive calendar days
        const d1 = new Date(today.date), d2 = new Date(tomorrow.date)
        const diffDays = Math.round((d2.getTime() - d1.getTime()) / 86400000)
        if (diffDays !== 1) continue

        const wrapToday = wrapByDate[today.date] ?? today.general_call + 480 // fallback: 8h day
        // Turnaround = (24h - wrapToday) * 60 + callTomorrow
        const restMins = (24 * 60 - wrapToday) + tomorrow.call_time
        if (restMins < turnaroundMins) {
          const [type, idStr] = key.split(':')
          const person = type === 'cast'
            ? await db.get('SELECT actor_name as name FROM cast WHERE id = ?', [idStr]) as any
            : await db.get('SELECT name FROM crew WHERE id = ?', [idStr]) as any
          conflicts.push({
            severity: 'warning', category: 'Turnaround',
            message: `Turnaround-Verletzung: ${person?.name || 'Unbekannt'}`,
            detail: `${today.date} → ${tomorrow.date}: nur ${Math.round(restMins / 60 * 10) / 10}h Ruhezeit (Minimum: ${turnaroundMins / 60}h)`,
            link: 'tagesdispo'
          })
        }
      }
    }
  } catch (e) { /* ignore */ }

  // 11. Shoot days that overlap with each other on same date
  try {
    const sameDateDays = await db.all(`
      SELECT date, COUNT(*) as c FROM shoot_days
      WHERE project_id = ? AND status NOT IN ('Sperrtag', 'Drehfrei', 'Ausgefallen')
      GROUP BY date HAVING c > 1
    `, [pid]) as any[]
    sameDateDays.forEach(d => {
      conflicts.push({
        severity: 'warning', category: 'Drehplan',
        message: `Mehrere Drehtage am ${d.date}`,
        detail: `${d.c} aktive Drehtage am selben Datum — Terminkonflikt prüfen.`,
        link: 'drehplan'
      })
    })
  } catch (e) { /* ignore */ }

  res.json({ data: conflicts, error: null })
})

export default router
