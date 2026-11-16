import { Router, Request, Response } from 'express'
import * as kosten from '../lib/kostenquellen'
import { drehtageBesetzung, drehtageStab, anzahl, KEIN_DREHTAG_SQL } from '../lib/drehtage'
import { ladeDood } from '../lib/dood'
import { db, TxClient } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import { massgeblicheKalkulation, massgeblicherFinanzierungsplan, finanzierungsstand, istFinanzStatus, istZugesagt, fassungenVergleichen, VERGLEICH_ART, ausKalkulation, zeilenAusKalkulation, regionaleffekt, anteileFehler } from '../lib/kalkulation'
import { heuteISO } from '../lib/datum'
import { pruefeBudgetzeile, pruefeGeldgeberBetrag, GELD_MAX_CENT } from '../lib/geld'
import { auswertung, istKostenart, SCHEMATA, VORGABE, type Schema } from '../lib/ffaSchema'
import { rechneReise, type Tagesart } from '../lib/spesen'
import { wochentageAus } from '../lib/board'
import { kalkulationsAufbau } from '../lib/kalkulationsAufbau'
import { schreibeCsv, cents } from '../lib/tabelle'
import { dateiname } from '../lib/dateiname'
import { datumAus, istRaster, type Raster } from '../lib/cashflow'
import { ladeCashflow, drehzeit } from '../lib/cashflowProjekt'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

/**
 * Die Summe einer Fassung neu rechnen - in derselben Transaktion wie die
 * Änderung, die sie auslöst.
 *
 * Bis zum 12.11.2026 lief das nach dem Schreiben und ohne Transaktion:
 * Scheiterte die Summe, war die Zeile schon gespeichert. Gemessen mit zwei
 * Zeilen zu je 20 Mio. €: Antwort 400, Zeile da, Summe der Fassung falsch.
 */
async function recalcBudgetTotal(versionId: number, tx: TxClient) {
  // Im FFA-Schema ist die Summe der Fassung die Herstellungskosten:
  // Kostenarten minus Erträge, dazu Handlungskosten, Reserve und Honorar (AP B1)
  const version = await tx.get('SELECT * FROM budget_versions WHERE id = ?', [versionId]) as any
  let total: number
  if (version?.schema === 'ffa') {
    const zeilen = await tx.all('SELECT cost_group, social, total_cents FROM budget_lines WHERE budget_version_id = ?', [versionId]) as any[]
    total = auswertung(zeilen, version).rechenwerk.herstellungskosten
  } else {
    const row = await tx.get('SELECT COALESCE(SUM(total_cents), 0) as s FROM budget_lines WHERE budget_version_id = ?', [versionId])
    total = Number((row as any).s) || 0
  }
  await tx.run("UPDATE budget_versions SET total_cents = ?, updated_at = datetime('now') WHERE id = ?", [total, versionId])
  return total
}

/** Kostenart einer Zeile: 1 bis 11, leer heißt keine; sonst undefined (Unsinn). */
function kostenartAus(wert: unknown): number | null | undefined {
  if (wert === null || wert === '' || wert === undefined) return null
  const n = Number(wert)
  return istKostenart(n) ? n : undefined
}

/** Die Sätze des Rechenwerks aus einer Anfrage: Basispunkte und Cent, geprüft. */
const SATZFELDER = ['hu_percent_bp', 'hu_percent_above_bp', 'reserve_percent_bp', 'producer_fee_percent_bp'] as const
const BETRAGSFELDER = ['hu_threshold_cents', 'hu_cap_cents', 'producer_fee_cap_cents'] as const
function saetzeAusAnfrage(body: any): { werte: Record<string, number | null> } | { fehler: string } {
  const werte: Record<string, number | null> = {}
  for (const k of SATZFELDER) {
    if (body?.[k] === undefined) continue
    const n = Number(body[k])
    // Unter 100 % - das Honorar teilt durch (1 minus Satz)
    if (!Number.isInteger(n) || n < 0 || n >= 10_000) return { fehler: 'Ein Satz liegt zwischen 0 und 99,99 %' }
    werte[k] = n
  }
  for (const k of BETRAGSFELDER) {
    if (body?.[k] === undefined) continue
    const n = Number(body[k])
    if (!Number.isInteger(n) || n < 0 || n > GELD_MAX_CENT) return { fehler: 'Der Preis muss ein Betrag in ganzen Cent sein.' }
    werte[k] = n
  }
  if (body?.social_percent_bp !== undefined) {
    if (body.social_percent_bp === null || body.social_percent_bp === '') werte.social_percent_bp = null
    else {
      const n = Number(body.social_percent_bp)
      if (!Number.isInteger(n) || n < 0 || n >= 10_000) return { fehler: 'Ein Satz liegt zwischen 0 und 99,99 %' }
      werte.social_percent_bp = n
    }
  }
  return { werte }
}

/** Dasselbe für einen Finanzierungsplan. */
async function recalcFinancingTotal(versionId: number, tx: TxClient) {
  const row = await tx.get('SELECT COALESCE(SUM(amount_cents), 0) as s FROM financing_entries WHERE financing_version_id = ?', [versionId])
  await tx.run('UPDATE financing_plan_versions SET total_cents = ? WHERE id = ?', [Number((row as any).s) || 0, versionId])
}

// GET /api/projects/:projectId/budget-alerts
router.get('/projects/:projectId/budget-alerts', async (req, res) => {
  const pid = req.params.projectId
  const row = await db.get('SELECT * FROM budget_alerts WHERE project_id = ?', [pid]) as any
  if (!row) {
    return res.json({ data: { project_id: Number(pid), threshold_percent: 80, enabled: false }, error: null })
  }
  res.json({ data: { ...row, enabled: !!row.enabled }, error: null })
})

// PUT /api/projects/:projectId/budget-alerts
router.put('/projects/:projectId/budget-alerts', async (req, res) => {
  const pid = req.params.projectId
  const { threshold_percent = 80, enabled = true } = req.body

  const existing = await db.get('SELECT id FROM budget_alerts WHERE project_id = ?', [pid])
  if (existing) {
    await db.run('UPDATE budget_alerts SET threshold_percent = ?, enabled = ? WHERE project_id = ?',
      [threshold_percent, enabled ? 1 : 0, pid])
  } else {
    await db.run('INSERT INTO budget_alerts (project_id, threshold_percent, enabled) VALUES (?, ?, ?)',
      [pid, threshold_percent, enabled ? 1 : 0])
  }

  const row = await db.get('SELECT * FROM budget_alerts WHERE project_id = ?', [pid]) as any
  res.json({ data: { ...row, enabled: !!row.enabled }, error: null })
})

// GET /api/projects/:projectId/budget-summary
router.get('/projects/:projectId/budget-summary', async (req, res) => {
  const pid = req.params.projectId

  // Doppelte Anfuehrungszeichen sind in Postgres ein BEZEICHNER, kein Text:
  // status = "Aktiv" suchte eine Spalte namens Aktiv. Die Auswertung
  // antwortete deshalb bei JEDEM Projekt mit 500 - und mit ihr der
  // Budgetalarm, der nie ausgeloest hat.
  // Die aktive Fassung, sonst die neueste (lib/kalkulation.ts)
  const budgetRow = { total: (await massgeblicheKalkulation(pid))?.total_cents ?? 0 }

  // Ausgegeben heisst AUSGEGEBEN - die erfassten Kosten, nicht die Summe der
  // Kalkulationszeilen. Vorher stand hier die Kalkulation gegen sich selbst:
  // bei einer aktiven Fassung war das Ergebnis immer genau 100 Prozent, und
  // ein Alarm bei 80 Prozent haette an jedem Tag jedes Projekts geschlagen.
  const spentRow = await db.get(
    'SELECT COALESCE(SUM(amount_cents), 0) as spent FROM expenses WHERE project_id = ?',
    [pid]
  ) as any

  const budget_total = budgetRow.total
  const total_spent = spentRow.spent
  const current_percent = budget_total > 0 ? Math.round((total_spent / budget_total) * 100) : 0

  const alertConfig = await db.get('SELECT * FROM budget_alerts WHERE project_id = ?', [pid]) as any
  const threshold = alertConfig?.threshold_percent ?? 80
  const alertEnabled = alertConfig ? !!alertConfig.enabled : false
  const triggered = alertEnabled && budget_total > 0 && current_percent >= threshold

  const result: any = {
    budget_total_cents: budget_total,
    total_spent_cents: total_spent,
    current_percent,
  }

  if (triggered) {
    result.alert = { triggered: true, threshold, current_percent }
  }

  res.json({ data: result, error: null })
})

// GET /api/projects/:projectId/budget-versions
router.get('/projects/:projectId/budget-versions', async (req, res) => {
  const versions = await db.all('SELECT * FROM budget_versions WHERE project_id = ? ORDER BY created_at DESC', [req.params.projectId])
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/budget-versions
// Eine neue Fassung eines Films beginnt im FFA-Schema, sonst frei (AP B1)
router.post('/projects/:projectId/budget-versions', async (req, res) => {
  const { name = 'Neue Kalkulation', status = 'Entwurf' } = req.body
  const projekt = await db.get('SELECT project_kind FROM projects WHERE id = ?', [req.params.projectId]) as any
  const schema: Schema = (SCHEMATA as readonly string[]).includes(req.body?.schema)
    ? req.body.schema
    : (projekt?.project_kind ?? 'film') === 'film' ? 'ffa' : 'frei'
  const result = await db.run('INSERT INTO budget_versions (project_id, name, status, schema) VALUES (?, ?, ?, ?)', [req.params.projectId, name, status, schema])
  res.status(201).json({ data: await db.get('SELECT * FROM budget_versions WHERE id = ?', [result.id]), error: null })
})

// PUT /api/budget-versions/:id - Name, Status und die Sätze des Rechenwerks (AP B1)
router.put('/budget-versions/:id', async (req, res) => {
  const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const s = saetzeAusAnfrage(req.body)
  if ('fehler' in s) return res.status(400).json({ data: null, error: s.fehler })
  const felder: string[] = []
  const werte: unknown[] = []
  for (const k of ['name', 'status'] as const) {
    if (typeof req.body?.[k] === 'string' && req.body[k].trim()) { felder.push(`${k} = ?`); werte.push(req.body[k].trim()) }
  }
  for (const [k, v] of Object.entries(s.werte)) { felder.push(`${k} = ?`); werte.push(v) }
  const neu = await db.transaction(async (tx) => {
    if (felder.length) await tx.run(`UPDATE budget_versions SET ${felder.join(', ')} WHERE id = ?`, [...werte, req.params.id])
    await recalcBudgetTotal(Number(req.params.id), tx)
    return tx.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id])
  })
  res.json({ data: neu, error: null })
})

/**
 * POST /api/budget-versions/:id/schema - eine Fassung umstellen (AP B1).
 * Von "frei" auf "FFA" ordnet `zuordnung` jede Kategorie einer Kostenart zu
 * ({ "Kamera": 5 }); Zeilen, die schon eine Kostenart haben (aus "Kosten
 * übernehmen"), behalten sie. Keine Zeile geht verloren.
 */
router.post('/budget-versions/:id/schema', async (req, res) => {
  const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const schema = req.body?.schema
  if (!(SCHEMATA as readonly string[]).includes(schema)) return res.status(400).json({ data: null, error: 'Das Schema ist "frei" oder "ffa"' })
  const zuordnung = req.body?.zuordnung ?? {}
  if (typeof zuordnung !== 'object' || Array.isArray(zuordnung)) return res.status(400).json({ data: null, error: 'Unbekannte Kostenart' })
  for (const v of Object.values(zuordnung)) if (kostenartAus(v) === undefined) return res.status(400).json({ data: null, error: 'Unbekannte Kostenart' })
  const neu = await db.transaction(async (tx) => {
    if (schema === 'ffa') {
      for (const [kategorie, nr] of Object.entries(zuordnung)) {
        await tx.run('UPDATE budget_lines SET cost_group = ? WHERE budget_version_id = ? AND cost_group IS NULL AND category = ?',
          [kostenartAus(nr), req.params.id, kategorie])
      }
    }
    await tx.run('UPDATE budget_versions SET schema = ? WHERE id = ?', [schema, req.params.id])
    await recalcBudgetTotal(Number(req.params.id), tx)
    return tx.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id])
  })
  res.json({ data: neu, error: null })
})

/**
 * GET /api/budget-versions/:id/export.csv - die Kalkulation im Aufbau des
 * Schemas, wie PDF und Bildschirm (AP B1). Kein XLSX: Die CSV öffnet Excel mit
 * BOM, Semikolon und Dezimalkomma (lib/tabelle.ts).
 */
router.get('/budget-versions/:id/export.csv', requireMemberVia(projectIdFromTable('budget_versions', 'id')), async (req: Request, res: Response) => {
  const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const lines = await db.all('SELECT * FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order ASC, account_code ASC', [req.params.id]) as any[]
  const a = kalkulationsAufbau(version, lines)
  const zeilen: unknown[][] = []
  for (const b of a.bloecke) {
    for (const z of b.zeilen) zeilen.push([b.titel, z.konto, z.bezeichnung, z.einheit, String(z.menge).replace('.', ','), cents(z.einzelpreis_cent), cents(z.gesamt_cent), ''])
    zeilen.push([b.titel, '', `Summe ${b.titel}`, '', '', '', cents(b.mindernd ? -b.summe_cent : b.summe_cent), ''])
  }
  for (const r of a.rechenwerk) zeilen.push(['Rechenwerk', '', r.bezeichnung, r.satz, '', '', cents(r.betrag_cent), r.hinweis])
  if (a.schema === 'frei') zeilen.push(['', '', 'Gesamt', '', '', '', cents(a.gesamt_cent), ''])
  const csv = schreibeCsv([a.schema === 'ffa' ? 'Kostenart' : 'Kategorie', 'Konto', 'Bezeichnung', 'Einheit', 'Menge', 'Einzelpreis', 'Gesamt', 'Hinweis'], zeilen as any)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="kalkulation-${dateiname(String(version.name || 'fassung'))}.csv"`)
  return res.send(csv)
})

/**
 * POST /api/budget-versions/:id/kopie - eine Fassung kopieren, etwa die
 * Vorkalkulation als Grundlage der Abschlusskalkulation (AP E1). Schema,
 * Sätze und alle Zeilen samt Herkunft und Kostenart; keine Prognosen.
 */
router.post('/budget-versions/:id/kopie', async (req, res) => {
  const alt = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!alt) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : `${alt.name} (Kopie)`
  const neu = await db.transaction(async (tx) => {
    const v = await tx.run(
      `INSERT INTO budget_versions (project_id, name, status, schema, hu_percent_bp, hu_percent_above_bp, hu_threshold_cents, hu_cap_cents,
         reserve_percent_bp, producer_fee_percent_bp, producer_fee_cap_cents, social_percent_bp)
       VALUES (?, ?, 'Entwurf', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [alt.project_id, name, alt.schema, alt.hu_percent_bp, alt.hu_percent_above_bp, alt.hu_threshold_cents, alt.hu_cap_cents,
        alt.reserve_percent_bp, alt.producer_fee_percent_bp, alt.producer_fee_cap_cents, alt.social_percent_bp])
    // Zeile für Zeile, damit die Anteile an Regionen (AP E3) mitkommen
    const zeilen = await tx.all('SELECT id FROM budget_lines WHERE budget_version_id = ? ORDER BY id', [alt.id]) as Array<{ id: number }>
    for (const z of zeilen) {
      const neu = await tx.run(
        `INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, sort_order, source_key, cost_group, social, spend_from, spend_until, deferred_cents, in_kind_cents, german_spend, internal)
         SELECT ?, category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, sort_order, source_key, cost_group, social, spend_from, spend_until, deferred_cents, in_kind_cents, german_spend, internal
           FROM budget_lines WHERE id = ?`, [v.id, z.id])
      await tx.run('INSERT INTO budget_line_regions (budget_line_id, region_id, share_bp) SELECT ?, region_id, share_bp FROM budget_line_regions WHERE budget_line_id = ?', [neu.id, z.id])
    }
    await recalcBudgetTotal(v.id, tx)
    return tx.get('SELECT * FROM budget_versions WHERE id = ?', [v.id])
  })
  res.status(201).json({ data: neu, error: null })
})

// GET /api/budget-versions/:id/auswertung - Kostenarten, Rechenwerk, Hinweise (AP B1)
router.get('/budget-versions/:id/auswertung', requireMemberVia(projectIdFromTable('budget_versions', 'id')), async (req: Request, res: Response) => {
  const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const zeilen = await db.all('SELECT cost_group, social, total_cents FROM budget_lines WHERE budget_version_id = ?', [req.params.id]) as any[]
  res.json({ data: { schema: version.schema, vorgabe: VORGABE, ...auswertung(zeilen, version) }, error: null })
})

/**
 * GET /api/projects/:projectId/budget-versions/vergleich?a=…&b=… - zwei
 * Fassungen nebeneinander (AP E1); `format=csv` als Tabelle. Beide Fassungen
 * müssen zum Projekt gehören, sonst 404.
 */
router.get('/projects/:projectId/budget-versions/vergleich', async (req, res) => {
  const v = await fassungenVergleichen(Number(req.params.projectId), req.query.a, req.query.b)
  if (!v) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  if (req.query.format === 'csv') {
    const zeilen: unknown[][] = []
    for (const g of v.gruppen) {
      for (const z of g.zeilen) zeilen.push([g.name, z.description, z.a_cents === null ? '' : cents(z.a_cents), z.b_cents === null ? '' : cents(z.b_cents), cents(z.diff_cents), VERGLEICH_ART[z.art]])
      zeilen.push([g.name, `Summe ${g.name}`, cents(g.a_cents), cents(g.b_cents), cents(g.diff_cents), ''])
    }
    zeilen.push(['', 'Gesamt', cents(v.summe.a_cents), cents(v.summe.b_cents), cents(v.summe.diff_cents), ''])
    const csv = schreibeCsv(['Kostenart', 'Zeile', v.a.name, v.b.name, 'Differenz', 'Stand'], zeilen as any)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="vergleich-${dateiname(v.a.name)}-${dateiname(v.b.name)}.csv"`)
    return res.send(csv)
  }
  res.json({ data: v, error: null })
})

// GET /api/budget-versions/:id/lines
router.get('/budget-versions/:id/lines', requireMemberVia(projectIdFromTable('budget_versions', 'id')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const version = await db.get('SELECT project_id FROM budget_versions WHERE id = ?', [req.params.id]) as any
    if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
    if ((await getUserProjectRole(user.id, version.project_id)) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const lines = await db.all('SELECT * FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order ASC, account_code ASC', [req.params.id]) as any[]
  // Anteile an Regionen je Zeile (AP E3)
  const anteile = lines.length
    ? await db.all('SELECT budget_line_id, region_id, share_bp FROM budget_line_regions WHERE budget_line_id = ANY(?::int[]) ORDER BY id', [lines.map((l) => l.id)]) as any[]
    : []
  res.json({ data: lines.map((l) => ({ ...l, regionen: anteile.filter((a) => a.budget_line_id === l.id).map((a) => ({ region_id: a.region_id, share_bp: a.share_bp })) })), error: null })
})

// POST /api/budget-versions/:id/lines
router.post('/budget-versions/:id/lines', async (req, res) => {
  const { category = '', account_code = '', description = '', unit = 'Pauschal', quantity = 1, unit_price_cents = 0, notes = '' } = req.body
  // Gemessen am 12.11.2026: Menge -5 wurde gespeichert, Menge "abc" ergab 500.
  const zeile = pruefeBudgetzeile(quantity, unit_price_cents)
  if ('fehler' in zeile) return res.status(400).json({ data: null, error: zeile.fehler })
  const kostenart = kostenartAus(req.body?.cost_group)
  if (kostenart === undefined) return res.status(400).json({ data: null, error: 'Unbekannte Kostenart' })
  const social = req.body?.social === true
  const id = await db.transaction(async (tx) => {
    const maxSortRow = await tx.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM budget_lines WHERE budget_version_id = ?', [req.params.id])
    const maxSort = (maxSortRow as any).m
    const result = await tx.run('INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit, quantity, unit_price_cents, total_cents, notes, sort_order, cost_group, social) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.id, category, account_code, description, unit, zeile.quantity, zeile.unit_price_cents, zeile.total_cents, notes, maxSort + 1, kostenart, social])
    await recalcBudgetTotal(parseInt(req.params.id), tx)
    return result.id
  })
  res.status(201).json({ data: await db.get('SELECT * FROM budget_lines WHERE id = ?', [id]), error: null })
})

/**
 * PUT /api/budget-lines/:id/prognose - "noch zu erwarten" einer Zeile setzen
 * oder zurück auf die Vorgabe (`rest_cents: null`), und abschließen (AP E1).
 * Wer und wann stehen daneben.
 */
router.put('/budget-lines/:id/prognose', async (req, res) => {
  const zeile = await db.get('SELECT * FROM budget_lines WHERE id = ?', [req.params.id]) as any
  if (!zeile) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  const rest = req.body?.rest_cents
  if (rest !== undefined && rest !== null && (!Number.isInteger(Number(rest)) || Number(rest) < 0 || Number(rest) > GELD_MAX_CENT)) {
    return res.status(400).json({ data: null, error: 'Der Preis muss ein Betrag in ganzen Cent sein.' })
  }
  const abgeschlossen = req.body?.abgeschlossen === undefined ? zeile.closed === true : req.body.abgeschlossen === true
  const neuerRest = rest === undefined ? zeile.forecast_rest_cents : rest === null ? null : Number(rest)
  const gesetzt = rest !== undefined
  await db.run(
    `UPDATE budget_lines SET forecast_rest_cents = ?, closed = ?${gesetzt ? ', forecast_set_by = ?, forecast_set_at = ' + (neuerRest === null ? 'NULL' : 'NOW()') : ''} WHERE id = ?`,
    gesetzt ? [neuerRest, abgeschlossen, neuerRest === null ? null : (req as any).user?.id ?? null, req.params.id] : [neuerRest, abgeschlossen, req.params.id])
  res.json({ data: await db.get('SELECT * FROM budget_lines WHERE id = ?', [req.params.id]), error: null })
})

// PUT /api/budget-lines/:id
router.put('/budget-lines/:id', async (req, res) => {
  // Gemessen am 25.10.2026: Eine Zeile, die es nicht gibt, ergab 200 ohne Daten.
  if (!(await db.get('SELECT id FROM budget_lines WHERE id = ?', [req.params.id]))) {
    return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  }
  const { category, account_code, description, unit, quantity, unit_price_cents, notes } = req.body
  const zeile = pruefeBudgetzeile(quantity, unit_price_cents)
  if ('fehler' in zeile) return res.status(400).json({ data: null, error: zeile.fehler })
  // Kostenart und Sozialversicherung (AP B1): ohne Angabe bleibt, was war
  const alt = await db.get('SELECT cost_group, social, spend_from, spend_until, deferred_cents, in_kind_cents, german_spend, internal FROM budget_lines WHERE id = ?', [req.params.id]) as any
  // Kennzeichen (AP E3): ohne Angabe bleibt, was war
  const deutsch = req.body?.german_spend === undefined ? alt?.german_spend !== false : req.body.german_spend !== false
  const intern = req.body?.internal === undefined ? alt?.internal === true : req.body.internal === true
  const kostenart = req.body?.cost_group === undefined ? (alt?.cost_group ?? null) : kostenartAus(req.body.cost_group)
  if (kostenart === undefined) return res.status(400).json({ data: null, error: 'Unbekannte Kostenart' })
  const social = req.body?.social === undefined ? alt?.social === true : req.body.social === true
  const zeitraum = zeitraumAngaben(req.body, alt)
  if ('fehler' in zeitraum) return res.status(400).json({ data: null, error: zeitraum.fehler })
  const anteile = anteileAngaben(req.body, alt, zeile.total_cents)
  if ('fehler' in anteile) return res.status(400).json({ data: null, error: anteile.fehler })
  const line = await db.transaction(async (tx) => {
    await tx.run('UPDATE budget_lines SET category=?, account_code=?, description=?, unit=?, quantity=?, unit_price_cents=?, total_cents=?, notes=?, cost_group=?, social=?, spend_from=?, spend_until=?, deferred_cents=?, in_kind_cents=?, german_spend=?, internal=? WHERE id=?', [category, account_code, description, unit, zeile.quantity, zeile.unit_price_cents, zeile.total_cents, notes, kostenart, social, zeitraum.von, zeitraum.bis, anteile.zurueck, anteile.bei, deutsch, intern, req.params.id])
    const zeileNeu = await tx.get('SELECT * FROM budget_lines WHERE id = ?', [req.params.id]) as any
    if (zeileNeu) await recalcBudgetTotal(zeileNeu.budget_version_id, tx)
    return zeileNeu
  })
  res.json({ data: line, error: null })
})

/**
 * Zeitraum einer Budgetzeile aus der Anfrage (AP E2): beide Enden oder
 * keins, das Ende nicht vor dem Anfang. Was nicht mitkommt, bleibt.
 */
function zeitraumAngaben(body: any, vorher: any): { von: string | null; bis: string | null } | { fehler: string } {
  const feld = (w: unknown, alt: unknown): string | null | undefined => {
    if (w === undefined) return datumAus(alt)
    if (w === null || w === '') return null
    return datumAus(w) ?? undefined
  }
  const von = feld(body?.spend_from, vorher?.spend_from)
  const bis = feld(body?.spend_until, vorher?.spend_until)
  if (von === undefined || bis === undefined) return { fehler: 'Ungültiges Datum im Zeitraum' }
  if ((von === null) !== (bis === null)) return { fehler: 'Ein Zeitraum braucht Anfang und Ende' }
  if (von !== null && bis !== null && bis < von) return { fehler: 'Das Ende des Zeitraums liegt vor dem Anfang' }
  return { von, bis }
}

/**
 * Zurückgestellt und beigestellt einer Budgetzeile (AP E4): ganze Cent, nicht
 * negativ, zusammen höchstens die Zeilensumme. Was nicht mitkommt, bleibt -
 * es muss dann aber noch in die neue Zeilensumme passen.
 */
function anteileAngaben(body: any, vorher: any, summe: number): { zurueck: number; bei: number } | { fehler: string } {
  const feld = (w: unknown, alt: unknown): number | undefined => {
    if (w === undefined) return Number(alt) || 0
    if (w === null || w === '') return 0
    const n = Number(w)
    return Number.isInteger(n) && n >= 0 && n <= GELD_MAX_CENT ? n : undefined
  }
  const zurueck = feld(body?.deferred_cents, vorher?.deferred_cents)
  const bei = feld(body?.in_kind_cents, vorher?.in_kind_cents)
  if (zurueck === undefined || bei === undefined) return { fehler: 'Zurückgestellt und beigestellt sind Beträge ab 0' }
  if (zurueck + bei > Math.max(0, summe)) return { fehler: 'Zurückgestellt und beigestellt zusammen höchstens die Zeilensumme' }
  return { zurueck, bei }
}

// ─── Regionaleffekt (AP E3) ─────────────────────────────────────────────────

/** Regionen des Projekts und die Übersicht je Region gegen maßgebliche Kalkulation und Finanzierungsplan. */
async function regionenMitUebersicht(projectId: number) {
  const regionen = await db.all('SELECT id, name, sort_order FROM regions WHERE project_id = ? ORDER BY sort_order, id', [projectId]) as any[]
  const kalkulation = await massgeblicheKalkulation(projectId)
  const zeilen = kalkulation
    ? await db.all('SELECT id, total_cents, cost_group FROM budget_lines WHERE budget_version_id = ?', [kalkulation.id]) as any[]
    : []
  const anteile = zeilen.length
    ? await db.all('SELECT budget_line_id, region_id, share_bp FROM budget_line_regions WHERE budget_line_id = ANY(?::int[])', [zeilen.map((z) => z.id)]) as any[]
    : []
  const belege = await db.all('SELECT budget_line_id, amount_cents FROM expenses WHERE project_id = ?', [projectId]) as any[]
  const plan = await massgeblicherFinanzierungsplan(projectId)
  const geldgeber = plan
    ? await db.all('SELECT id, source, amount_cents, region_id, regional_effect_bp FROM financing_entries WHERE financing_version_id = ? ORDER BY sort_order, id', [plan.id]) as any[]
    : []
  const ffa = kalkulation?.schema === 'ffa'
  return {
    regionen,
    uebersicht: regionaleffekt(regionen, zeilen.map((z) => ({ id: z.id, total_cents: z.total_cents, mindernd: ffa && Number(z.cost_group) === 11 })), anteile, belege, geldgeber),
    kalkulation: kalkulation ? { id: kalkulation.id, name: kalkulation.name } : null,
  }
}

// GET /api/projects/:projectId/regionen - Regionen und Übersicht je Region
router.get('/projects/:projectId/regionen', async (req, res) => {
  res.json({ data: await regionenMitUebersicht(Number(req.params.projectId)), error: null })
})

/** Name einer Region: was im Bescheid steht, nicht leer, im Projekt einmalig. */
async function regionsName(projectId: number, name: unknown, ausser: number | null): Promise<{ name: string } | { fehler: string }> {
  const n = String(name ?? '').trim()
  if (!n) return { fehler: 'Eine Region braucht einen Namen' }
  if (n.length > 100) return { fehler: 'Der Name einer Region hat höchstens 100 Zeichen' }
  const doppelt = await db.get('SELECT id FROM regions WHERE project_id = ? AND lower(name) = lower(?) AND id <> ?', [projectId, n, ausser ?? 0])
  if (doppelt) return { fehler: 'Diese Region gibt es im Projekt schon' }
  return { name: n }
}

// POST /api/projects/:projectId/regionen
router.post('/projects/:projectId/regionen', async (req, res) => {
  const pid = Number(req.params.projectId)
  const n = await regionsName(pid, req.body?.name, null)
  if ('fehler' in n) return res.status(400).json({ data: null, error: n.fehler })
  const sort = Number(((await db.get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM regions WHERE project_id = ?', [pid])) as any)?.m ?? 0) + 1
  const neu = await db.run('INSERT INTO regions (project_id, name, sort_order) VALUES (?, ?, ?)', [pid, n.name, sort])
  res.status(201).json({ data: await db.get('SELECT * FROM regions WHERE id = ?', [neu.id]), error: null })
})

// PUT /api/regionen/:id - umbenennen
router.put('/regionen/:id', async (req, res) => {
  const region = await db.get('SELECT * FROM regions WHERE id = ?', [req.params.id]) as any
  if (!region) return res.status(404).json({ data: null, error: 'Region nicht gefunden' })
  const n = await regionsName(region.project_id, req.body?.name, region.id)
  if ('fehler' in n) return res.status(400).json({ data: null, error: n.fehler })
  await db.run('UPDATE regions SET name = ? WHERE id = ?', [n.name, region.id])
  res.json({ data: await db.get('SELECT * FROM regions WHERE id = ?', [region.id]), error: null })
})

// DELETE /api/regionen/:id - die Anteile der Zeilen gehen mit, Geldgeber verlieren die Region
router.delete('/regionen/:id', async (req, res) => {
  const region = await db.get('SELECT id FROM regions WHERE id = ?', [req.params.id])
  if (!region) return res.status(404).json({ data: null, error: 'Region nicht gefunden' })
  await db.run('DELETE FROM regions WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

/**
 * PUT /api/budget-lines/:id/regionen - die Anteile einer Zeile ersetzen:
 * `{ anteile: [{ region_id, share_bp }] }`, bis zu vier Regionen des eigenen
 * Projekts, zusammen höchstens 100 %. Der Rest ist "ohne Region".
 */
router.put('/budget-lines/:id/regionen', async (req, res) => {
  const zeile = await db.get('SELECT bl.id, bv.project_id FROM budget_lines bl JOIN budget_versions bv ON bv.id = bl.budget_version_id WHERE bl.id = ?', [req.params.id]) as any
  if (!zeile) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  const roh = Array.isArray(req.body?.anteile) ? req.body.anteile : null
  if (!roh) return res.status(400).json({ data: null, error: 'Anteile fehlen' })
  const anteile = roh.map((a: any) => ({ region_id: Number(a?.region_id), share_bp: Number(a?.share_bp) }))
  const grund = anteileFehler(anteile)
  if (grund) return res.status(400).json({ data: null, error: grund })
  if (anteile.length) {
    const eigene = await db.all('SELECT id FROM regions WHERE project_id = ? AND id = ANY(?::int[])', [zeile.project_id, anteile.map((a: any) => a.region_id)]) as any[]
    if (eigene.length !== anteile.length) return res.status(400).json({ data: null, error: 'Unbekannte Region' })
  }
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM budget_line_regions WHERE budget_line_id = ?', [zeile.id])
    for (const a of anteile) await tx.run('INSERT INTO budget_line_regions (budget_line_id, region_id, share_bp) VALUES (?, ?, ?)', [zeile.id, a.region_id, a.share_bp])
  })
  res.json({ data: anteile, error: null })
})

/**
 * POST /api/budget-versions/:id/zeitraum - den Zeitraum mehrerer Zeilen auf
 * eine Phase setzen (AP E2). Bisher kennt das Projekt nur die Drehzeit:
 * erster bis letzter Drehtag ohne Sperr-, Ausfall- und Reservetage.
 */
router.post('/budget-versions/:id/zeitraum', async (req, res) => {
  const version = await db.get('SELECT id, project_id FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))] as number[] : []
  if (!ids.length) return res.status(400).json({ data: null, error: 'Keine Zeile markiert' })
  if (req.body?.phase !== 'drehzeit') return res.status(400).json({ data: null, error: 'Unbekannte Phase' })
  const zeit = await drehzeit(Number(version.project_id))
  if (!zeit) return res.status(400).json({ data: null, error: 'Noch kein Drehtag - die Drehzeit ist unbekannt' })
  const r = await db.run(
    'UPDATE budget_lines SET spend_from = ?, spend_until = ? WHERE budget_version_id = ? AND id = ANY(?::int[])',
    [zeit.von, zeit.bis, version.id, ids])
  res.json({ data: { geaendert: r.changes ?? 0, von: zeit.von, bis: zeit.bis }, error: null })
})

/**
 * GET /api/projects/:projectId/cashflow?raster=woche|monat - Einnahmen,
 * Ausgaben laut Plan und laut Belegen, Saldo und Saldo aufgelaufen je Woche
 * oder Monat (AP E2); `format=csv` als Tabelle.
 */
router.get('/projects/:projectId/cashflow', async (req, res) => {
  const raster: Raster = istRaster(req.query.raster) ? req.query.raster : 'woche'
  const cf = await ladeCashflow(Number(req.params.projectId), raster)
  if (req.query.format === 'csv') {
    const zeilen: Array<Array<string | number | null>> = cf.perioden.map((p) => [
      raster === 'woche' ? `${p.von} bis ${p.bis}` : p.schluessel,
      p.ereignisse.map((x) => x.titel).join(', '),
      cents(p.einnahmen_cents), cents(p.ausgaben_plan_cents), cents(p.ausgaben_ist_cents),
      cents(p.saldo_cents), cents(p.saldo_aufgelaufen_cents), p.unterdeckung ? 'Unterdeckung' : '',
    ])
    zeilen.push(['Summe', '', cents(cf.summen.einnahmen_cents), cents(cf.summen.ausgaben_plan_cents), cents(cf.summen.ausgaben_ist_cents), cents(cf.summen.saldo_cents), '', ''])
    const nt = cf.nicht_terminiert
    if (nt.einnahmen.length || nt.ausgaben.length || nt.belege.length) {
      zeilen.push(['Nicht terminiert', '', cents(nt.einnahmen_cents), cents(nt.ausgaben_cents), cents(nt.belege_cents), '', '', ''])
      for (const x of nt.einnahmen) zeilen.push(['Nicht terminiert', x.bezeichnung, cents(x.cents), '', '', '', '', ''])
      for (const x of nt.ausgaben) zeilen.push(['Nicht terminiert', x.bezeichnung, '', cents(x.cents), '', '', '', ''])
      for (const x of nt.belege) zeilen.push(['Nicht terminiert', x.bezeichnung, '', '', cents(x.cents), '', '', ''])
    }
    const csv = schreibeCsv([raster === 'woche' ? 'Woche' : 'Monat', 'Ereignisse', 'Einnahmen', 'Ausgaben laut Plan', 'Ausgaben laut Belegen', 'Saldo', 'Saldo aufgelaufen', 'Stand'], zeilen)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="cashflow-${raster}.csv"`)
    return res.send(csv)
  }
  res.json({ data: cf, error: null })
})

// DELETE /api/budget-lines/:id
router.delete('/budget-lines/:id', async (req, res) => {
  await db.transaction(async (tx) => {
    const line = await tx.get('SELECT * FROM budget_lines WHERE id = ?', [req.params.id]) as any
    await tx.run('DELETE FROM budget_lines WHERE id = ?', [req.params.id])
    if (line) await recalcBudgetTotal(line.budget_version_id, tx)
  })
  res.json({ data: { ok: true }, error: null })
})

// POST /api/budget-versions/:id/kosten-uebernehmen
//
// Ersetzt die frueheren Routen pull-crew und pull-cast. Die waren aus drei
// Gruenden unbrauchbar:
//   1. `contract_type = "Tagesgage"` - doppelte Anfuehrungszeichen sind in
//      Postgres ein BEZEICHNER. Die Abfrage suchte eine Spalte namens
//      Tagesgage und lief auf HTTP 500.
//   2. Jede Person bekam ALLE Drehtage des Projekts angerechnet, nicht ihre
//      eigenen. Wer in einer Szene mitspielt, kostete den ganzen Dreh.
//   3. Zweimal aufgerufen standen alle Zeilen doppelt drin.
//
// Diese Route ist wiederholbar: erzeugte Zeilen tragen einen
// Herkunftsschluessel, handgeschriebene bleiben unangetastet.
router.post('/budget-versions/:id/kosten-uebernehmen', async (req, res) => {
  const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const pid = version.project_id
  const nurZeigen = Boolean(req.body?.nurZeigen)

  // Drehtage je Person - dieselbe Zählung wie DOOD und Besetzung
  // (lib/drehtage.ts). Bis zum 03.11.2026 zählten hier nur die Dispos: Ein
  // Drehtag ohne angelegte Dispo kostete niemanden etwas.
  const besetzung = await db.all(
    `SELECT c.id, c.actor_name AS name, ch.name AS rolle, c.fee_per_day
     FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id
     WHERE c.project_id = ?`, [pid]) as any[]
  const stab = await db.all(
    'SELECT id, name, role AS rolle, fee_per_day, contract_type, fee_per_week, prep_days, wrap_days FROM crew WHERE project_id = ?', [pid]) as any[]
  const equipment = await db.all(
    `SELECT ei.id, ei.item AS name, ei.quantity, ei.total_days AS days,
            ei.rental_per_day_cents, ei.total_cents, ei.rate_unit
     FROM equipment_items ei
     JOIN equipment_lists el ON ei.equipment_list_id = el.id
     WHERE el.project_id = ?`, [pid]) as any[]
  const policen = await db.all(
    'SELECT id, ins_type AS type, provider, premium_cents FROM insurances WHERE project_id = ?', [pid]) as any[]

  // Motive, Reisen, Unterkünfte flossen bis AP B1 gar nicht in die Kalkulation
  const motive = await db.all('SELECT id, name, rental_fee FROM locations WHERE project_id = ?', [pid]) as any[]
  // Drehtage am Motiv wie auf der Seite Motive: Tage mit einer Szene dort
  const motivTage = new Map(((await db.all(
    `SELECT s.location_id, COUNT(DISTINCT sd.id) AS tage
       FROM shoot_days sd
       JOIN shoot_day_scenes sds ON sds.shoot_day_id = sd.id
       JOIN scenes s ON s.id = sds.scene_id
      WHERE sd.project_id = ? AND sd.status NOT IN ${KEIN_DREHTAG_SQL} AND s.location_id IS NOT NULL AND COALESCE(s.omitted, false) = false
      GROUP BY s.location_id`, [pid])) as any[]).map((z) => [Number(z.location_id), Number(z.tage)]))
  const motivvertraege = await db.all(
    `SELECT lr.id, lr.location_id, lr.owner_name, lr.fee_cents
       FROM location_releases lr JOIN locations l ON l.id = lr.location_id WHERE l.project_id = ?`, [pid]) as any[]
  const reisenRoh = await db.all('SELECT * FROM trips WHERE project_id = ?', [pid]) as any[]
  const reiseTage = await db.all('SELECT d.* FROM trip_days d JOIN trips t ON t.id = d.trip_id WHERE t.project_id = ? ORDER BY d.day_date', [pid]) as any[]
  const reisen = reisenRoh.map((r) => ({
    id: Number(r.id), person_name: r.person_name, purpose: r.purpose,
    gesamt_cent: rechneReise(
      reiseTage.filter((t) => t.trip_id === r.id).map((t) => ({
        datum: String(t.day_date).slice(0, 10), art: String(t.kind) as Tagesart, dauerMinuten: Number(t.minutes_away || 0),
        mahlzeiten: { fruehstueck: t.breakfast === true, mittag: t.lunch === true, abend: t.dinner === true },
      })),
      {
        kilometer: Number(r.kilometers || 0),
        fahrzeugart: r.vehicle_kind === 'sonstige' ? 'sonstige' : 'pkw',
        // Wohnt die Person in einer erfassten Unterkunft, steht das Zimmer
        // dort - sonst zählte die Übernachtung doppelt
        uebernachtungCents: r.accommodation_id ? 0 : Number(r.lodging_cents || 0),
      }).gesamtCents,
  }))
  const unterkuenfte = await db.all(
    `SELECT a.id, a.name, a.price_per_night_cents,
            COALESCE((SELECT SUM(r.nights) FROM accommodation_rooms r WHERE r.accommodation_id = a.id), 0) AS naechte
       FROM accommodations a WHERE a.project_id = ?`, [pid]) as any[]
  // Eine Woche hat so viele Tage, wie das Projekt Arbeitstage hat (AP A2)
  const einstellung = await db.get('SELECT work_weekdays FROM project_settings WHERE project_id = ?', [pid]) as any
  const tageJeWoche = Math.max(1, wochentageAus(String(einstellung?.work_weekdays ?? '1,2,3,4,5')).length)

  const castTage = anzahl(await drehtageBesetzung(db, pid))
  const stabTage = anzahl(await drehtageStab(db, pid))
  // Haltetage aus dem DOOD - dieselbe Zählung, die die DOOD-Seite zeigt
  const dood = await ladeDood(db, pid)
  const halteTage = new Map(dood.cast.map(c => [c.id, c.total_hold_days]))
  const haltende = dood.cast.map(c => ({ id: c.id, name: c.actor_name, hold_fee_per_day: c.hold_fee_per_day }))

  // Drehtage ohne Szenen zählen für den Stab mit (lib/drehtage.ts). Ein
  // Reservetag ist oft genau so ein Tag; die Vorschau nennt sie, damit
  // niemand Stabgagen für einen Tag kalkuliert, an dem nichts gedreht wird
  // (Testbericht SALZWIND, Plan AP A1).
  const leereTage = await db.all(
    `SELECT sd.day_number FROM shoot_days sd
      WHERE sd.project_id = ? AND sd.status NOT IN ${KEIN_DREHTAG_SQL}
        AND NOT EXISTS (SELECT 1 FROM shoot_day_scenes sds WHERE sds.shoot_day_id = sd.id)
      ORDER BY sd.day_number ASC`, [pid]) as any[]

  const soll = [
    ...kosten.gagenPosten(besetzung, castTage, 'cast'),
    ...kosten.haltePosten(haltende, halteTage),
    ...kosten.gagenPosten(stab, stabTage, 'crew', tageJeWoche),
    ...kosten.equipmentPosten(equipment),
    ...kosten.motivPosten(motive, motivTage, motivvertraege),
    ...kosten.reisePosten(reisen),
    ...kosten.unterkunftPosten(unterkuenfte.map((u) => ({ ...u, naechte: Number(u.naechte) || 0 }))),
    ...kosten.versicherungsPosten(policen),
  ]

  // Wer eine Gage hat, aber an keinem Drehtag gebraucht wird, faellt still heraus.
  // Das muss man sehen, sonst sucht man den fehlenden Posten vergeblich.
  const ohneDrehtag = [...besetzung.map(x => ({ ...x, art: 'cast' as const })),
                       ...stab.map(x => ({ ...x, art: 'crew' as const }))]
    .filter(x => (kosten.zahl(x.fee_per_day) ?? 0) > 0
              && ((x.art === 'cast' ? castTage : stabTage).get(Number(x.id)) ?? 0) === 0)
    .map(x => String(x.name ?? '').trim() || 'Ohne Namen')

  const vorhanden = await db.all(
    'SELECT id, source_key, description, quantity, unit_price_cents, total_cents, cost_group FROM budget_lines WHERE budget_version_id = ?',
    [req.params.id]) as any[]
  // Jede erzeugte Zeile trägt ihre Kostenart (AP B1) - im FFA-Schema ist eine
  // falsche Kostenart eine Änderung
  const plan = kosten.abgleiche(vorhanden, soll, version.schema === 'ffa')

  if (!nurZeigen) {
    // Alles oder nichts: Scheitert eine Zeile, bleibt die Fassung, wie sie war.
    await db.transaction(async (tx) => {
    const maxRow = await tx.get(
      'SELECT COALESCE(MAX(sort_order), 0) AS m FROM budget_lines WHERE budget_version_id = ?',
      [req.params.id]) as any
    let sort = Number(maxRow?.m ?? 0)

    for (const n of plan.neu) {
      sort++
      await tx.run(
        `INSERT INTO budget_lines (budget_version_id, category, account_code, description, unit,
         quantity, unit_price_cents, total_cents, sort_order, source_key, cost_group)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.params.id, n.kategorie, '', n.beschreibung, n.einheit,
         n.menge, n.einzelpreis_cent, n.gesamt_cent, sort, n.schluessel, n.kostenart])
    }
    for (const g of plan.geaendert) {
      await tx.run(
        // Rückstellung und Beistellung (AP E4) passen weiter in die Zeile:
        // erst die Rückstellung kürzen, dann die Beistellung
        `UPDATE budget_lines SET category = ?, description = ?, unit = ?, quantity = ?,
         unit_price_cents = ?, total_cents = ?, cost_group = ?,
         deferred_cents = LEAST(deferred_cents, GREATEST(?::bigint, 0)),
         in_kind_cents = LEAST(in_kind_cents, GREATEST(?::bigint - LEAST(deferred_cents, GREATEST(?::bigint, 0)), 0))
         WHERE id = ?`,
        [g.posten.kategorie, g.posten.beschreibung, g.posten.einheit, g.posten.menge,
         g.posten.einzelpreis_cent, g.posten.gesamt_cent, g.posten.kostenart,
         g.posten.gesamt_cent, g.posten.gesamt_cent, g.posten.gesamt_cent, g.id])
    }
    for (const id of plan.entfallen) {
      await tx.run('DELETE FROM budget_lines WHERE id = ?', [id])
    }
    await recalcBudgetTotal(parseInt(req.params.id), tx)
    })
  }

  res.json({
    data: {
      nurZeigen,
      neu: plan.neu.length,
      geaendert: plan.geaendert.length,
      entfallen: plan.entfallen.length,
      unveraendert: plan.unveraendert,
      summe_cent: soll.reduce((s, p) => s + p.gesamt_cent, 0),
      ohne_drehtag: ohneDrehtag,
      leere_drehtage: leereTage.map(t => Number(t.day_number)),
      posten: plan.neu.concat(plan.geaendert.map(g => g.posten)),
    },
    error: null,
  })
})

// GET /api/projects/:projectId/financing-versions
router.get('/projects/:projectId/financing-versions', async (req, res) => {
  const versions = await db.all('SELECT * FROM financing_plan_versions WHERE project_id = ? ORDER BY created_at DESC', [req.params.projectId])
  res.json({ data: versions, error: null })
})

// POST /api/projects/:projectId/financing-versions
router.post('/projects/:projectId/financing-versions', async (req, res) => {
  const { name = 'Finanzierungsplan' } = req.body
  const result = await db.run('INSERT INTO financing_plan_versions (project_id, name) VALUES (?, ?)', [req.params.projectId, name])
  res.status(201).json({ data: await db.get('SELECT * FROM financing_plan_versions WHERE id = ?', [result.id]), error: null })
})

// GET /api/financing-versions/:id/entries
router.get('/financing-versions/:id/entries', requireMemberVia(projectIdFromTable('financing_plan_versions', 'id')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const version = await db.get('SELECT project_id FROM financing_plan_versions WHERE id = ?', [req.params.id]) as any
    if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
    if ((await getUserProjectRole(user.id, version.project_id)) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const entries = await db.all('SELECT * FROM financing_entries WHERE financing_version_id = ? ORDER BY sort_order ASC', [req.params.id]) as any[]
  // Raten je Geldgeber (AP B2), und ob ihre Summe den Betrag übersteigt
  const raten = entries.length
    ? await db.all('SELECT * FROM financing_installments WHERE entry_id = ANY(?::int[]) ORDER BY sort_order, due_on NULLS LAST, id', [entries.map((e) => e.id)]) as any[]
    : []
  const stand = finanzierungsstand(entries, raten, 0, heuteISO())
  const parsed = entries.map(e => ({
    ...e, confirmed: !!e.confirmed,
    raten: raten.filter((r) => r.entry_id === e.id),
    raten_summe_cents: stand.je_geldgeber[e.id]?.summe_cents ?? 0,
    raten_ueber_betrag: stand.je_geldgeber[e.id]?.ueber_betrag ?? false,
  }))
  res.json({ data: parsed, error: null })
})

/**
 * GET /api/financing-versions/:id/stand - der Kopf des Plans (AP B2):
 * Herstellungskosten der maßgeblichen Kalkulation, Summe, zugesagt,
 * ausgezahlt, Lücke, noch nicht zugesagt, überfinanziert.
 */
router.get('/financing-versions/:id/stand', requireMemberVia(projectIdFromTable('financing_plan_versions', 'id')), async (req: Request, res: Response) => {
  const version = await db.get('SELECT * FROM financing_plan_versions WHERE id = ?', [req.params.id]) as any
  if (!version) return res.status(404).json({ data: null, error: 'Version nicht gefunden' })
  const entries = await db.all('SELECT id, amount_cents, status FROM financing_entries WHERE financing_version_id = ?', [req.params.id]) as any[]
  const raten = entries.length ? await db.all('SELECT * FROM financing_installments WHERE entry_id = ANY(?::int[])', [entries.map((e) => e.id)]) as any[] : []
  const kalkulation = await massgeblicheKalkulation(version.project_id)
  // Rückstellungen und Beistellungen der Kalkulation zählen als zugesagt (AP E4)
  const aus = zeilenAusKalkulation(await ausKalkulation(version.project_id))
  res.json({
    data: {
      ...finanzierungsstand([...entries, ...aus], raten, kalkulation?.total_cents ?? 0, heuteISO()),
      kalkulation: kalkulation ? { id: kalkulation.id, name: kalkulation.name } : null,
      aus_kalkulation: aus.map((z) => ({ art: z.art, source: z.source, amount_cents: z.amount_cents })),
    },
    error: null,
  })
})

/** Status und Angaben eines Geldgebers aus der Anfrage (AP B2); undefined heißt: bleibt. */
function geldgeberAngaben(body: any, vorher: any): { werte: { status: string; applied_on: string | null; granted_on: string | null; reference: string; recoupment_rank: number | null; recoupment_terms: string; region_id: number | null; regional_effect_bp: number | null } } | { fehler: string } {
  let status = vorher?.status ?? 'geplant'
  if (body?.status !== undefined) {
    if (!istFinanzStatus(body.status)) return { fehler: 'Unbekannter Stand' }
    status = body.status
  } else if (body?.confirmed !== undefined) {
    // Ältere Aufrufer schicken noch den Schalter "bestätigt"
    status = body.confirmed ? (istZugesagt(status) ? status : 'zugesagt') : (istZugesagt(status) ? 'geplant' : status)
  }
  const datum = (w: unknown, alt: unknown): string | null | undefined => {
    if (w === undefined) return (alt as string | null) ?? null
    if (w === null || w === '') return null
    return typeof w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : undefined
  }
  const applied_on = datum(body?.applied_on, vorher?.applied_on)
  const granted_on = datum(body?.granted_on, vorher?.granted_on)
  if (applied_on === undefined || granted_on === undefined) return { fehler: 'Ein Datum hat die Form JJJJ-MM-TT' }
  const reference = body?.reference === undefined ? String(vorher?.reference ?? '') : String(body.reference ?? '').trim()
  // Rückflussrang (AP E4): eine Angabe, gerechnet wird damit nicht
  let recoupment_rank: number | null = vorher?.recoupment_rank ?? null
  if (body?.recoupment_rank !== undefined) {
    if (body.recoupment_rank === null || body.recoupment_rank === '') recoupment_rank = null
    else {
      const n = Number(body.recoupment_rank)
      if (!Number.isInteger(n) || n < 1 || n > 999) return { fehler: 'Der Rückflussrang ist eine ganze Zahl von 1 bis 999' }
      recoupment_rank = n
    }
  }
  const recoupment_terms = body?.recoupment_terms === undefined ? String(vorher?.recoupment_terms ?? '') : String(body.recoupment_terms ?? '').trim()
  // Regionaleffekt (AP E3): Region und geforderter Effekt in Prozent des Betrags
  // (Basispunkte) - kein Vorgabewert, die Richtlinie des Förderers nennt ihn
  let region_id: number | null = vorher?.region_id ?? null
  if (body?.region_id !== undefined) {
    if (body.region_id === null || body.region_id === '') region_id = null
    else {
      const n = Number(body.region_id)
      if (!Number.isInteger(n) || n <= 0) return { fehler: 'Unbekannte Region' }
      region_id = n
    }
  }
  let regional_effect_bp: number | null = vorher?.regional_effect_bp ?? null
  if (body?.regional_effect_bp !== undefined) {
    if (body.regional_effect_bp === null || body.regional_effect_bp === '') regional_effect_bp = null
    else {
      const n = Number(body.regional_effect_bp)
      if (!Number.isInteger(n) || n < 0 || n > 1_000_000) return { fehler: 'Der Regionaleffekt liegt zwischen 0 und 10.000 %' }
      regional_effect_bp = n
    }
  }
  return { werte: { status, applied_on, granted_on, reference, recoupment_rank, recoupment_terms, region_id, regional_effect_bp } }
}

/** Gehört die Region zum Projekt des Finanzierungsplans? (AP E3) */
async function regionImPlan(regionId: number | null, planId: unknown): Promise<boolean> {
  if (regionId === null) return true
  return !!(await db.get(
    'SELECT r.id FROM regions r JOIN financing_plan_versions fv ON fv.project_id = r.project_id WHERE r.id = ? AND fv.id = ?', [regionId, planId]))
}

// POST /api/financing-versions/:id/entries
router.post('/financing-versions/:id/entries', async (req, res) => {
  const { source = '', type = 'Förderung', amount_cents = 0, notes = '' } = req.body
  // Gemessen am 12.11.2026: Ein Geldgeber mit -5.000 € wurde gespeichert.
  const betrag = pruefeGeldgeberBetrag(amount_cents)
  if ('fehler' in betrag) return res.status(400).json({ data: null, error: betrag.fehler })
  const angaben = geldgeberAngaben(req.body, null)
  if ('fehler' in angaben) return res.status(400).json({ data: null, error: angaben.fehler })
  const a = angaben.werte
  if (!(await regionImPlan(a.region_id, req.params.id))) return res.status(400).json({ data: null, error: 'Unbekannte Region' })
  const id = await db.transaction(async (tx) => {
    const maxSortRow = await tx.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM financing_entries WHERE financing_version_id = ?', [req.params.id])
    const maxSort = (maxSortRow as any).m
    const result = await tx.run('INSERT INTO financing_entries (financing_version_id, source, type, amount_cents, confirmed, notes, sort_order, status, applied_on, granted_on, reference, recoupment_rank, recoupment_terms, region_id, regional_effect_bp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [req.params.id, source, type, betrag.amount_cents, istZugesagt(a.status) ? 1 : 0, notes, maxSort + 1, a.status, a.applied_on, a.granted_on, a.reference, a.recoupment_rank, a.recoupment_terms, a.region_id, a.regional_effect_bp])
    await recalcFinancingTotal(parseInt(req.params.id), tx)
    return result.id
  })

  const row = await db.get('SELECT * FROM financing_entries WHERE id = ?', [id]) as any
  res.status(201).json({ data: { ...row, confirmed: !!row.confirmed }, error: null })
})

// PUT /api/financing-entries/:id
router.put('/financing-entries/:id', async (req, res) => {
  // Gemessen am 25.10.2026: Eine Zeile, die es nicht gibt, ergab 500.
  const vorher = await db.get('SELECT * FROM financing_entries WHERE id = ?', [req.params.id]) as any
  if (!vorher) {
    return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  }
  const { source, type, amount_cents, notes } = req.body
  const betrag = pruefeGeldgeberBetrag(amount_cents)
  if ('fehler' in betrag) return res.status(400).json({ data: null, error: betrag.fehler })
  const angaben = geldgeberAngaben(req.body, vorher)
  if ('fehler' in angaben) return res.status(400).json({ data: null, error: angaben.fehler })
  const a = angaben.werte
  if (!(await regionImPlan(a.region_id, vorher.financing_version_id))) return res.status(400).json({ data: null, error: 'Unbekannte Region' })
  const entry = await db.transaction(async (tx) => {
    await tx.run('UPDATE financing_entries SET source=?, type=?, amount_cents=?, confirmed=?, notes=?, status=?, applied_on=?, granted_on=?, reference=?, recoupment_rank=?, recoupment_terms=?, region_id=?, regional_effect_bp=? WHERE id=?', [source, type, betrag.amount_cents, istZugesagt(a.status) ? 1 : 0, notes, a.status, a.applied_on, a.granted_on, a.reference, a.recoupment_rank, a.recoupment_terms, a.region_id, a.regional_effect_bp, req.params.id])
    const eintrag = await tx.get('SELECT * FROM financing_entries WHERE id = ?', [req.params.id]) as any
    await recalcFinancingTotal(eintrag.financing_version_id, tx)
    return eintrag
  })
  res.json({ data: { ...entry, confirmed: !!entry.confirmed }, error: null })
})

// ─── Raten je Geldgeber (AP B2) ─────────────────────────────────────────────

/** Eine Rate aus der Anfrage: Anlass als Text, Fälligkeit, Betrag, Eingang. */
function rateAus(body: any, vorher: any): { werte: { label: string; due_on: string | null; amount_cents: number; received_on: string | null } } | { fehler: string } {
  const datum = (w: unknown, alt: unknown): string | null | undefined => {
    if (w === undefined) return (alt as string | null) ?? null
    if (w === null || w === '') return null
    return typeof w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : undefined
  }
  const due_on = datum(body?.due_on, vorher?.due_on)
  const received_on = datum(body?.received_on, vorher?.received_on)
  if (due_on === undefined || received_on === undefined) return { fehler: 'Ein Datum hat die Form JJJJ-MM-TT' }
  const betrag = pruefeGeldgeberBetrag(body?.amount_cents === undefined ? (vorher?.amount_cents ?? 0) : body.amount_cents)
  if ('fehler' in betrag) return { fehler: betrag.fehler }
  const label = body?.label === undefined ? String(vorher?.label ?? '') : String(body.label ?? '').trim()
  return { werte: { label, due_on, amount_cents: betrag.amount_cents, received_on } }
}

// POST /api/financing-entries/:id/raten
router.post('/financing-entries/:id/raten', async (req, res) => {
  const eintrag = await db.get('SELECT id FROM financing_entries WHERE id = ?', [req.params.id])
  if (!eintrag) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  const r = rateAus(req.body, null)
  if ('fehler' in r) return res.status(400).json({ data: null, error: r.fehler })
  const sort = Number(((await db.get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM financing_installments WHERE entry_id = ?', [req.params.id])) as any)?.m ?? 0) + 1
  const neu = await db.run('INSERT INTO financing_installments (entry_id, label, due_on, amount_cents, received_on, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    [req.params.id, r.werte.label, r.werte.due_on, r.werte.amount_cents, r.werte.received_on, sort])
  res.status(201).json({ data: await db.get('SELECT * FROM financing_installments WHERE id = ?', [neu.id]), error: null })
})

// PUT /api/financing-raten/:id
router.put('/financing-raten/:id', async (req, res) => {
  const vorher = await db.get('SELECT * FROM financing_installments WHERE id = ?', [req.params.id]) as any
  if (!vorher) return res.status(404).json({ data: null, error: 'Rate nicht gefunden' })
  const r = rateAus(req.body, vorher)
  if ('fehler' in r) return res.status(400).json({ data: null, error: r.fehler })
  // Nur die geschickten Felder schreiben: Zwei schnelle Änderungen an
  // verschiedenen Feldern überschrieben sich sonst mit dem alten Stand
  const felder = (['label', 'due_on', 'amount_cents', 'received_on'] as const).filter((k) => req.body?.[k] !== undefined)
  if (felder.length) {
    await db.run(`UPDATE financing_installments SET ${felder.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...felder.map((k) => r.werte[k]), req.params.id])
  }
  res.json({ data: await db.get('SELECT * FROM financing_installments WHERE id = ?', [req.params.id]), error: null })
})

// DELETE /api/financing-raten/:id
router.delete('/financing-raten/:id', async (req, res) => {
  await db.run('DELETE FROM financing_installments WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// DELETE /api/financing-entries/:id
router.delete('/financing-entries/:id', async (req, res) => {
  await db.transaction(async (tx) => {
    const entry = await tx.get('SELECT * FROM financing_entries WHERE id = ?', [req.params.id]) as any
    await tx.run('DELETE FROM financing_entries WHERE id = ?', [req.params.id])
    if (entry) await recalcFinancingTotal(entry.financing_version_id, tx)
  })
  res.json({ data: { ok: true }, error: null })
})

export default router
