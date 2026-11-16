/**
 * Der Cashflowplan eines Projekts (AP E2): sammelt Budgetzeilen, Raten,
 * Belege und Ereignisse und rechnet mit lib/cashflow.ts.
 *
 * Gerechnet wird gegen die maßgebliche Kalkulation und den maßgeblichen
 * Finanzierungsplan - dieselben wie Kostenstand und Finanzierungsstand.
 */
import { db } from '../db'
import { massgeblicheKalkulation, massgeblicherFinanzierungsplan } from './kalkulation'
import { auswertung } from './ffaSchema'
import { KEIN_DREHTAG_SQL } from './drehtage'
import { cashflow, datumAus, type Raster, type CfZeile, type CfPosten, type CfEreignis } from './cashflow'

/** Termintyp im Kalender, der als Marke über dem Cashflow steht. */
export const MEILENSTEIN = 'Meilenstein'

/** Erster und letzter Drehtag - ohne Sperr-, Ausfall- und Reservetage. */
export async function drehzeit(projectId: number): Promise<{ von: string; bis: string } | null> {
  const tage = (await db.all(
    `SELECT date FROM shoot_days WHERE project_id = ? AND status NOT IN ${KEIN_DREHTAG_SQL}`, [projectId]
  )) as Array<{ date: unknown }>
  const daten = tage.map((t) => datumAus(t.date)).filter((d): d is string => d !== null).sort()
  return daten.length ? { von: daten[0], bis: daten[daten.length - 1] } : null
}

const MINDERND = 11

export async function ladeCashflow(projectId: number, raster: Raster) {
  const kalkulation = await massgeblicheKalkulation(projectId)
  const ffa = kalkulation?.schema === 'ffa'
  const zeilenRoh = kalkulation
    ? (await db.all(
      `SELECT id, description, category, cost_group, social, total_cents, spend_from, spend_until
         FROM budget_lines WHERE budget_version_id = ? ORDER BY sort_order, id`, [kalkulation.id]
    )) as any[]
    : []
  // Im FFA-Schema mindern die Erträge (Kostenart 11) die Kosten
  const vorzeichen = (kostenart: unknown) => (ffa && Number(kostenart) === MINDERND ? -1 : 1)
  const zeilen: CfZeile[] = zeilenRoh.map((z) => ({
    bezeichnung: String(z.description || z.category || '').trim() || 'Ohne Beschreibung',
    cents: vorzeichen(z.cost_group) * (Number(z.total_cents) || 0),
    von: z.spend_from,
    bis: z.spend_until,
  }))
  // Das Rechenwerk ist keine Zeile und hat keinen Zeitraum - es steht unter
  // "nicht terminiert", damit Ausgaben und Herstellungskosten übereinstimmen
  if (ffa && kalkulation) {
    const version = await db.get('SELECT * FROM budget_versions WHERE id = ?', [kalkulation.id]) as any
    const a = auswertung(zeilenRoh, version)
    const rechenwerk: Array<[string, number]> = [
      ['Zusatzkosten Gagen', a.zusatzkosten_gagen_cent ?? 0],
      ['Handlungskosten', a.rechenwerk.handlungskosten],
      ['Überschreitungsreserve', a.rechenwerk.reserve],
      ['Produzentenhonorar', a.rechenwerk.honorar],
    ]
    for (const [bezeichnung, cents] of rechenwerk) zeilen.push({ bezeichnung, cents })
  }

  // Einnahmen: die Raten, am Eingang, sonst an der Fälligkeit; was ein
  // Geldgeber über seine Raten hinaus gibt, steht ohne Datum
  const plan = await massgeblicherFinanzierungsplan(projectId)
  const geber = plan
    ? (await db.all('SELECT id, source, amount_cents FROM financing_entries WHERE financing_version_id = ? ORDER BY sort_order, id', [plan.id])) as any[]
    : []
  const raten = geber.length
    ? (await db.all('SELECT entry_id, label, amount_cents, due_on, received_on FROM financing_installments WHERE entry_id = ANY(?::int[]) ORDER BY sort_order, id', [geber.map((g) => g.id)])) as any[]
    : []
  const einnahmen: CfPosten[] = []
  for (const g of geber) {
    const name = String(g.source || '').trim() || 'Geldgeber'
    const eigene = raten.filter((r) => Number(r.entry_id) === Number(g.id))
    for (const r of eigene) {
      einnahmen.push({
        bezeichnung: String(r.label || '').trim() ? `${name}: ${String(r.label).trim()}` : name,
        cents: Number(r.amount_cents) || 0,
        datum: datumAus(r.received_on) ?? datumAus(r.due_on),
      })
    }
    const rest = (Number(g.amount_cents) || 0) - eigene.reduce((s, r) => s + (Number(r.amount_cents) || 0), 0)
    if (rest > 0) einnahmen.push({ bezeichnung: eigene.length ? `${name}: ohne Rate` : name, cents: rest })
  }

  const belegeRoh = (await db.all(
    'SELECT description, cost_group, amount_cents, expense_date FROM expenses WHERE project_id = ? ORDER BY expense_date, id', [projectId]
  )) as any[]
  const belege: CfPosten[] = belegeRoh.map((b) => ({
    bezeichnung: String(b.description || '').trim() || 'Beleg',
    cents: vorzeichen(b.cost_group) * (Number(b.amount_cents) || 0),
    datum: b.expense_date,
  }))

  const dreh = await drehzeit(projectId)
  const ereignisse: CfEreignis[] = dreh
    ? [{ datum: dreh.von, titel: 'Drehbeginn', art: 'drehbeginn' }, { datum: dreh.bis, titel: 'Drehende', art: 'drehende' }]
    : []
  const meilensteine = (await db.all(
    'SELECT title, start_date FROM project_events WHERE project_id = ? AND type = ? ORDER BY start_date, id', [projectId, MEILENSTEIN]
  )) as any[]
  for (const m of meilensteine) {
    const datum = datumAus(m.start_date)
    if (datum) ereignisse.push({ datum, titel: String(m.title || '').trim() || MEILENSTEIN, art: 'meilenstein' })
  }

  return {
    ...cashflow({ raster, zeilen, einnahmen, belege, ereignisse }),
    kalkulation: kalkulation ? { id: kalkulation.id, name: kalkulation.name, status: kalkulation.status, schema: kalkulation.schema } : null,
    drehzeit: dreh,
  }
}
