import { dateiname } from '../lib/dateiname'
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { generatePdf } from './pdf'
import {
  renderDocument, table, stats, section, definitions, badge, fmtMoney, fmtDate,
} from '../lib/documentLayout'

/** Dateinamen von Zeichen befreien, die den Download-Header zerlegen. */
const slugify = (value: string) => dateiname(value)

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
  const budgetVersions = await db.all("SELECT * FROM budget_versions WHERE project_id = ? ORDER BY (status = 'Aktiv') DESC, created_at DESC LIMIT 1", [pid]) as any[]
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
    // Mit Namen ("2000 - Stab"): nur die Nummer sagt einem Förderer nichts
    const cat = String(line.category || 'Ohne Kategorie').trim()
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
      by_category: Object.entries(budgetByCategory)
        .sort(([a], [b]) => (parseInt(a) || 1e9) - (parseInt(b) || 1e9) || a.localeCompare(b, 'de'))
        .map(([cat, cents]) => ({ category: cat, amount_eur: (cents / 100).toFixed(2) })),
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
    const budgetTotal = budgetVersion?.total_cents ?? null
    const finTotal = finVersion?.total_cents ?? null
    // Finanzierungsluecke: die erste Frage jeder Foerderjury
    const gap = budgetTotal !== null && finTotal !== null ? budgetTotal - finTotal : null
    const confirmed = finEntries
      .filter((e: any) => e.confirmed)
      .reduce((sum: number, e: any) => sum + (Number(e.amount_cents) || 0), 0)

    const html = renderDocument({
      kind: 'Förderantrag',
      title: project.title,
      project: project.title,
      subtitle: [project.genre, project.format, project.length_minutes ? `${project.length_minutes} Min.` : '']
        .filter(Boolean).join(' · '),
      meta: [
        { label: 'Produktionsfirma', value: project.production_company },
        { label: 'Regie', value: project.director },
        { label: 'Stand', value: fmtDate(new Date().toISOString()) },
      ],
      body:
        stats([
          { label: 'Gesamtkosten', value: fmtMoney(budgetTotal) },
          { label: 'Finanzierung', value: fmtMoney(finTotal), hint: `davon ${fmtMoney(confirmed)} bestätigt` },
          {
            label: gap !== null && gap > 0 ? 'Finanzierungslücke' : 'Deckung',
            value: gap === null ? '—' : fmtMoney(Math.abs(gap)),
            hint: gap === null ? undefined : gap > 0 ? 'noch offen' : 'vollständig finanziert',
          },
          { label: 'Drehtage', value: shootDays.length },
        ]) +
        section('Eckdaten', definitions([
          { label: 'Titel', value: project.title },
          { label: 'Genre', value: project.genre },
          { label: 'Format', value: project.format },
          { label: 'Laufzeit', value: project.length_minutes ? `${project.length_minutes} Min.` : null },
          { label: 'Regie', value: project.director },
          { label: 'Produktion', value: project.producer },
          { label: 'Produktionsfirma', value: project.production_company },
          { label: 'Drehzeitraum', value: [project.shoot_start, project.shoot_end].filter(Boolean).length === 2
              ? `${fmtDate(project.shoot_start)} – ${fmtDate(project.shoot_end)}` : null },
          { label: 'Synopsis', value: project.synopsis, wide: true },
        ])) +
        section('Schlüsselpositionen', table({
          columns: [
            { header: 'Name', value: (r: any) => r.name, width: '34%' },
            { header: 'Funktion', value: (r: any) => r.role },
            { header: 'Abteilung', value: (r: any) => r.department, width: '28%' },
          ],
          rows: keyCrew,
          empty: 'Noch keine Schlüsselpositionen besetzt.',
        })) +
        section('Hauptbesetzung', table({
          columns: [
            { header: 'Darsteller*in', value: (r: any) => r.actor_name, width: '34%' },
            { header: 'Rolle', value: (r: any) => r.character_name },
            { header: 'Tagesgage', value: (r: any) => fmtMoney(r.fee_per_day), align: 'right', width: '22%' },
          ],
          rows: cast.slice(0, 5),
          empty: 'Noch keine Besetzung erfasst.',
        })) +
        section('Drehorte', table({
          columns: [
            { header: 'Motiv', value: (r: any) => r.name },
            { header: 'Stadt', value: (r: any) => r.city, width: '30%' },
            { header: 'Land', value: (r: any) => r.country, width: '22%' },
          ],
          rows: locations,
          empty: 'Noch keine Drehorte erfasst.',
        }), 'Regionaleffekt') +
        section('Kostenübersicht', table({
          columns: [
            { header: 'Kategorie', value: (r: any) => r[0] },
            { header: 'Betrag', value: (r: any) => fmtMoney(r[1]), align: 'right', width: '26%' },
          ],
          rows: Object.entries(budgetByCategory),
          empty: 'Noch keine Kalkulation hinterlegt.',
          footer: [{ label: 'Gesamtkosten', value: fmtMoney(budgetTotal) }],
        })) +
        section('Finanzierungsplan', table({
          columns: [
            { header: 'Geldgeber', value: (r: any) => r.source },
            { header: 'Art', value: (r: any) => r.type, width: '20%' },
            { header: 'Status', value: (r: any) => (r.confirmed ? badge('Bestätigt', 'ok') : badge('Offen', 'warn')), html: true, align: 'center', width: '16%' },
            { header: 'Betrag', value: (r: any) => fmtMoney(r.amount_cents), align: 'right', width: '22%' },
          ],
          rows: finEntries,
          empty: 'Noch keine Finanzierung hinterlegt.',
          footer: [{ label: 'Finanzierung gesamt', value: fmtMoney(finTotal) }],
        })),
    })

    try {
      const pdf = await generatePdf(html, {
        margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
        footer: false,
      })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="foerderantrag-${slugify(project.title)}.pdf"`)
      return res.send(pdf)
    } catch (e: any) {
      return res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
    }
  }

  res.json({ data, error: null })
})

export default router
