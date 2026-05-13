import { Router, Request, Response } from 'express'
import { db } from '../db'
import puppeteer from 'puppeteer'

const router = Router()

// GET /api/projects/:pid/foerderantrag/export
// Returns structured data for Förderantrag
router.get('/projects/:pid/foerderantrag/export', async (req: Request, res: Response) => {
  const pid = Number(req.params.pid)
  const format = req.query.format as string || 'json'

  const project = await db.get('SELECT * FROM projects WHERE id = ?', [pid]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const crew = await db.all('SELECT * FROM crew WHERE project_id = ? ORDER BY sort_order ASC', [pid]) as any[]
  const cast = await db.all('SELECT c.*, ch.name as character_name FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.project_id = ? ORDER BY c.id ASC', [pid]) as any[]
  const locations = await db.all('SELECT * FROM locations WHERE project_id = ?', [pid]) as any[]
  const shootDays = await db.all('SELECT * FROM shoot_days WHERE project_id = ? ORDER BY day_number ASC', [pid]) as any[]

  // Budget
  const budgetVersions = await db.all('SELECT * FROM budget_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1', [pid]) as any[]
  const budgetVersion = budgetVersions[0]
  const budgetLines = budgetVersion ? await db.all('SELECT * FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order ASC', [budgetVersion.id]) as any[] : []

  // Financing
  const finVersions = await db.all('SELECT * FROM financing_plan_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1', [pid]) as any[]
  const finVersion = finVersions[0]
  const finEntries = finVersion ? await db.all('SELECT * FROM financing_entries WHERE financing_version_id = ? ORDER BY sort_order ASC', [finVersion.id]) as any[] : []

  // Key crew positions for Förderantrag
  const keyRoles = ['Regisseur', 'Regisseurin', 'Produzent', 'Produzentin', 'Director of Photography', 'Drehbuch', 'Schnitt', 'Ton']
  const keyCrew = crew.filter((c: any) => keyRoles.some(r => c.role.includes(r) || c.department.includes('Regie') || c.department.includes('Produktion')))

  // Budget by category (FFA-like structure)
  const budgetByCategory: Record<string, number> = {}
  for (const line of budgetLines) {
    const cat = line.category.split(' - ')[0] || line.category
    budgetByCategory[cat] = (budgetByCategory[cat] || 0) + line.total_cents
  }

  // Regional effect: count locations per city/state
  const locationsByCity: Record<string, number> = {}
  for (const loc of locations) {
    locationsByCity[loc.city || 'Unbekannt'] = (locationsByCity[loc.city || 'Unbekannt'] || 0) + 1
  }

  const data = {
    project: {
      title: project.title,
      genre: project.genre,
      format: project.format,
      length_minutes: project.length_minutes,
      status: project.status,
      director: project.director,
      producer: project.producer,
      production_company: project.production_company,
      shoot_start: project.shoot_start,
      shoot_end: project.shoot_end,
      total_shoot_days: shootDays.length,
    },
    crew_key_positions: keyCrew.map((c: any) => ({ name: c.name, role: c.role, department: c.department })),
    cast_main: cast.slice(0, 5).map((c: any) => ({ actor: c.actor_name, character: c.character_name, fee_per_day_eur: c.fee_per_day / 100 })),
    locations: locations.map((l: any) => ({ name: l.name, city: l.city, country: l.country })),
    budget: {
      total_eur: budgetVersion ? (budgetVersion.total_cents / 100).toFixed(2) : '0.00',
      by_category: Object.entries(budgetByCategory).map(([cat, cents]) => ({ category: cat, amount_eur: (cents / 100).toFixed(2) })),
    },
    financing: {
      total_eur: finVersion ? (finVersion.total_cents / 100).toFixed(2) : '0.00',
      entries: finEntries.map((e: any) => ({ source: e.source, type: e.type, amount_eur: (e.amount_cents / 100).toFixed(2), confirmed: !!e.confirmed })),
    },
    regional_impact: {
      cities: locationsByCity,
      shoot_days_local: shootDays.length,
    },
    generated_at: new Date().toISOString(),
  }

  if (format === 'pdf') {
    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><style>
body { font-family: 'Helvetica Neue', sans-serif; margin: 40px; color: #111; font-size: 12px; }
h1 { font-size: 20px; margin-bottom: 4px; }
h2 { font-size: 14px; border-bottom: 2px solid #f59e0b; padding-bottom: 4px; margin-top: 24px; color: #333; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; }
th { background: #f5f5f5; padding: 6px 10px; text-align: left; font-size: 11px; }
td { padding: 5px 10px; border-bottom: 1px solid #eee; }
.chip { display: inline-block; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
.total { font-weight: bold; background: #f9f9f9; }
</style></head><body>
<h1>${data.project.title}</h1>
<p><strong>Genre:</strong> ${data.project.genre} &bull; <strong>Format:</strong> ${data.project.format} &bull; <strong>Laufzeit:</strong> ${data.project.length_minutes} Min. &bull; <strong>Drehtage:</strong> ${data.project.total_shoot_days}</p>
<p><strong>Regie:</strong> ${data.project.director} &bull; <strong>Produktion:</strong> ${data.project.producer} &bull; <strong>Firma:</strong> ${data.project.production_company}</p>
<p><strong>Drehzeitraum:</strong> ${data.project.shoot_start || '–'} bis ${data.project.shoot_end || '–'}</p>

<h2>Schlüsselpositionen</h2>
<table><tr><th>Name</th><th>Funktion</th><th>Abteilung</th></tr>
${data.crew_key_positions.map(c => `<tr><td>${c.name}</td><td>${c.role}</td><td>${c.department}</td></tr>`).join('')}
</table>

<h2>Hauptbesetzung</h2>
<table><tr><th>Darsteller/in</th><th>Rolle</th><th>Tagesgage (EUR)</th></tr>
${data.cast_main.map(c => `<tr><td>${c.actor}</td><td>${c.character || '–'}</td><td>${c.fee_per_day_eur}</td></tr>`).join('')}
</table>

<h2>Drehorte (Regionaleffekt)</h2>
<table><tr><th>Motiv</th><th>Stadt</th><th>Land</th></tr>
${data.locations.map(l => `<tr><td>${l.name}</td><td>${l.city}</td><td>${l.country}</td></tr>`).join('')}
</table>

<h2>Budgetübersicht — Gesamtkosten: ${data.budget.total_eur} EUR</h2>
<table><tr><th>Kategorie</th><th>Betrag (EUR)</th></tr>
${data.budget.by_category.map(b => `<tr><td>${b.category}</td><td>${b.amount_eur}</td></tr>`).join('')}
<tr class="total"><td>GESAMT</td><td>${data.budget.total_eur}</td></tr>
</table>

<h2>Finanzierungsplan — Gesamt: ${data.financing.total_eur} EUR</h2>
<table><tr><th>Geldgeber</th><th>Typ</th><th>Betrag (EUR)</th><th>Status</th></tr>
${data.financing.entries.map(e => `<tr><td>${e.source}</td><td>${e.type}</td><td>${e.amount_eur}</td><td>${e.confirmed ? '<span class="chip">Bestätigt</span>' : 'Offen'}</td></tr>`).join('')}
</table>

<p style="margin-top:32px;font-size:10px;color:#999">Generiert mit CutSheet am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
</body></html>`

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(html)
    const pdf = await page.pdf({ format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } })
    await browser.close()

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="foerderantrag-${project.title.replace(/\s+/g, '-')}.pdf"`)
    return res.send(Buffer.from(pdf))
  }

  res.json({ data, error: null })
})

export default router
