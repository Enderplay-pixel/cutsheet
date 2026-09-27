import { Router } from 'express'
import { db } from '../db'
import { requireMember } from '../middleware/projectAuth'
import { ruhezeit } from '../lib/drehzeit'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

/**
 * Eine Prüfung des Konfliktradars.
 *
 * Bisher verschluckte ein leeres catch um jede Prüfung jeden Fehler. Gemessen am
 * 26.09.2026: zwei Prüfungen scheiterten bei JEDEM Aufruf an Postgres-SQL
 * ("column c does not exist" - ein Alias in HAVING, erlaubt in SQLite, nicht
 * in Postgres). Der Radar meldete trotzdem seelenruhig "keine Konflikte".
 *
 * Eine Prüfung, die still ausfällt, ist schlimmer als keine: sie erzeugt
 * Vertrauen, das sie nicht deckt. Deshalb steht ein Ausfall jetzt im Log UND
 * im Ergebnis - der Radar sagt, was er nicht prüfen konnte.
 */
async function pruefung(name: string, ziel: any[], fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e: any) {
    console.error(`[Konfliktradar] Prüfung "${name}" fehlgeschlagen:`, e?.message || e)
    ziel.push({
      severity: 'warning', category: 'Prüfung',
      message: `Prüfung „${name}" konnte nicht ausgeführt werden`,
      detail: String(e?.message || e).slice(0, 200),
      link: '',
    })
  }
}

router.get('/projects/:projectId/conflicts', async (req, res) => {
  const pid = req.params.projectId
  const conflicts: any[] = []

  // 1. Scenes in multiple shoot days
  await pruefung('Szene an mehreren Drehtagen', conflicts, async () => {
    const dupScenes = await db.all(`
      SELECT s.scene_number, s.title, COUNT(sds.shoot_day_id) as day_count
      FROM shoot_day_scenes sds
      JOIN scenes s ON sds.scene_id = s.id
      JOIN shoot_days sd ON sds.shoot_day_id = sd.id
      WHERE sd.project_id = ?
      GROUP BY sds.scene_id, s.scene_number, s.title
      HAVING COUNT(sds.shoot_day_id) > 1
    `, [pid]) as any[]

    dupScenes.forEach(s => {
      conflicts.push({
        severity: 'error', category: 'Drehplan',
        message: `Szene ${s.scene_number} „${s.title}" ist ${s.day_count} Drehtagen zugewiesen`,
        detail: 'Eine Szene darf nur einem Drehtag zugeordnet sein.',
        link: 'drehplan'
      })
    })
  })

  // 2. Unscheduled scenes
  await pruefung('Nicht eingeplante Szenen', conflicts, async () => {
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
  })

  // 3. Empty shoot days
  await pruefung('Leere Drehtage', conflicts, async () => {
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
  })

  // 4. Cast without character
  await pruefung('Besetzung ohne Rolle', conflicts, async () => {
    const castNoChar = await db.all(`SELECT actor_name FROM cast WHERE project_id = ? AND character_id IS NULL`, [pid]) as any[]
    castNoChar.forEach(c => {
      conflicts.push({
        severity: 'info', category: 'Besetzung',
        message: `${c.actor_name} ist keiner Rolle zugewiesen`,
        link: 'besetzung'
      })
    })
  })

  // 5. Scenes without location
  await pruefung('Szenen ohne Motiv', conflicts, async () => {
    const scenesNoLoc = await db.all('SELECT scene_number, title FROM scenes WHERE project_id = ? AND location_id IS NULL', [pid]) as any[]
    if (scenesNoLoc.length > 0) {
      conflicts.push({
        severity: 'info', category: 'Motive',
        message: `${scenesNoLoc.length} Szene(n) ohne Motivzuweisung`,
        detail: scenesNoLoc.map(s => `Sz. ${s.scene_number}`).join(', '),
        link: 'motive'
      })
    }
  })

  // 6. Locations without address
  await pruefung('Motive ohne Adresse', conflicts, async () => {
    const locNoAddr = await db.all(`SELECT name FROM locations WHERE project_id = ? AND (address = '' OR address IS NULL)`, [pid]) as any[]
    locNoAddr.forEach(l => {
      conflicts.push({
        severity: 'info', category: 'Motive',
        message: `Motiv „${l.name}" hat keine Adresse`,
        link: 'motive'
      })
    })
  })

  // 7. Budget vs financing
  await pruefung('Budget gegen Finanzierung', conflicts, async () => {
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
  })

  // 8. No budget versions at all
  await pruefung('Fehlende Budgetfassung', conflicts, async () => {
    const budgetCount = await db.get(`SELECT COUNT(*) as c FROM budget_versions WHERE project_id = ?`, [pid]) as any
    if (!budgetCount || budgetCount.c === 0) {
      conflicts.push({
        severity: 'info', category: 'Budget',
        message: 'Noch keine Kalkulation erstellt',
        link: 'budget'
      })
    }
  })

  // 9. Scenes without any characters
  await pruefung('Szenen ohne Figuren', conflicts, async () => {
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
  })

  // 10. Turnaround violations - cast called back before minimum rest
  await pruefung('Turnaround', conflicts, async () => {
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
      SELECT dr.wrap, dr.call_time, sd.date FROM daily_reports dr
      JOIN shoot_days sd ON dr.shoot_day_id = sd.id
      WHERE sd.project_id = ?
    `, [pid]) as any[]
    const wrapByDate: Record<string, number> = {}
    const callByDate: Record<string, number> = {}
    reports.forEach((r: any) => { wrapByDate[r.date] = r.wrap; callByDate[r.date] = r.call_time })

    for (const [key, days] of Object.entries(byPerson)) {
      for (let i = 0; i < days.length - 1; i++) {
        const today = days[i]
        const tomorrow = days[i + 1]
        // Only check consecutive calendar days
        const d1 = new Date(today.date), d2 = new Date(tomorrow.date)
        const diffDays = Math.round((d2.getTime() - d1.getTime()) / 86400000)
        if (diffDays !== 1) continue

        const wrapToday = wrapByDate[today.date] ?? today.general_call + 480 // fallback: 8h day
        // ruhezeit() braucht den Call des Drehtags, um einen Wrap nach
        // Mitternacht zu erkennen: ein Drehschluss um 02:00 steht als 120 in
        // der Datenbank. Die alte Rechnung (24h - 120) + Call ergab daraus 32
        // Stunden Ruhezeit statt acht - die Verletzung blieb unentdeckt.
        const restMins = ruhezeit(wrapToday, callByDate[today.date] ?? today.general_call, tomorrow.call_time)
        if (restMins !== null && restMins < turnaroundMins) {
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
  })

  // 11. Shoot days that overlap with each other on same date
  await pruefung('Mehrere Drehtage am selben Datum', conflicts, async () => {
    const sameDateDays = await db.all(`
      SELECT date, COUNT(*) as c FROM shoot_days
      WHERE project_id = ? AND status NOT IN ('Sperrtag', 'Drehfrei', 'Ausgefallen')
      GROUP BY date HAVING COUNT(*) > 1
    `, [pid]) as any[]
    sameDateDays.forEach(d => {
      conflicts.push({
        severity: 'warning', category: 'Drehplan',
        message: `Mehrere Drehtage am ${d.date}`,
        detail: `${d.c} aktive Drehtage am selben Datum - Terminkonflikt prüfen.`,
        link: 'drehplan'
      })
    })
  })

  res.json({ data: conflicts, error: null })
})

export default router
