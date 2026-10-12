/**
 * Angebote.
 *
 * Vor einer Rechnung steht meist ein Angebot, und zwischen beiden liegt die
 * Zusage des Auftraggebers. Diese drei Schritte abzubilden ist kein
 * Verwaltungsaufwand, sondern der Grund, warum man später weiß, was vereinbart
 * war.
 *
 * Ein Angebot liegt in derselben Tabelle wie die Rechnungen, unterschieden
 * durch `kind`. Das ist Absicht: Positionen, Summenrechnung, Steuerarten und
 * das Blatt sind identisch, und zwei getrennte Tabellen hätten bedeutet, all
 * das zweimal zu pflegen.
 *
 * Getrennt ist dagegen der **Nummernkreis**. Eine Rechnungsnummer muss
 * fortlaufend und lückenlos sein - ein Angebot, das nie zur Rechnung wird,
 * darf keine Rechnungsnummer verbrauchen. Angebote zählen deshalb eigenständig
 * und tragen ein A vorweg: `A-2026-0001`.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { erfordereAbrechnung } from './invoices'
import { logAudit } from './audit'
import { summiere, faelligkeit, euro, type Position, type Steuerart } from '../lib/rechnung'
import { renderRechnung } from '../lib/rechnungLayout'
import { generatePdf } from './pdf'

const router = Router()

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function plusTage(datum: string, tage: number): string {
  const ms = Date.parse(`${String(datum).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(ms)) return String(datum).slice(0, 10)
  return new Date(ms + tage * 86_400_000).toISOString().slice(0, 10)
}

/** Wie lange ein Angebot ohne eigene Angabe gilt. */
const GUELTIG_TAGE = 30

/** Die Nummer eines Angebots: A-2026-0001. */
export function angebotsNummer(jahr: number, laufend: number): string {
  return `A-${jahr}-${String(laufend).padStart(4, '0')}`
}

async function positionenLaden(id: number): Promise<Array<Position & { description: string; unit: string }>> {
  const zeilen = (await db.all(
    'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC',
    [id]
  )) as any[]
  return zeilen.map((z) => ({
    description: z.description || '',
    unit: z.unit || 'Tag',
    quantity_milli: Number(z.quantity_milli ?? 1000),
    unit_price_cents: Number(z.unit_price_cents ?? 0),
    tax_percent: Number(z.tax_percent ?? 19),
  }))
}

/** Summen neu rechnen und in das Angebot schreiben. */
async function summenNeuRechnen(id: number): Promise<void> {
  const kopf = (await db.get('SELECT tax_mode FROM invoices WHERE id = ?', [id])) as any
  const summen = summiere(await positionenLaden(id), (kopf?.tax_mode || 'regel') as Steuerart)
  await db.run(
    'UPDATE invoices SET net_cents = ?, tax_cents = ?, gross_cents = ?, updated_at = NOW() WHERE id = ?',
    [summen.netto, summen.steuer, summen.brutto, id]
  )
}

async function ladeAngebot(companyId: number, id: number) {
  const kopf = (await db.get(
    `SELECT i.*, c.name AS client_name, c.contact_name, c.address, c.zip, c.city, c.country,
            c.vat_id AS client_vat_id, c.email AS client_email, p.title AS project_title
       FROM invoices i
       LEFT JOIN company_clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.id = ? AND i.company_id = ? AND i.kind = 'angebot'`,
    [id, companyId]
  )) as any
  if (!kopf) return null
  return { ...kopf, items: await positionenLaden(id) }
}

// ─── Liste und Einzelstück ───────────────────────────────────────────────────

router.get('/companies/:companyId/quotes', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const heute = heuteISO()
  const zeilen = (await db.all(
    `SELECT i.*, c.name AS client_name, p.title AS project_title,
            r.number AS rechnung_nummer, r.id AS rechnung_id
       FROM invoices i
       LEFT JOIN company_clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       LEFT JOIN invoices r ON r.from_quote_id = i.id AND r.kind = 'rechnung'
      WHERE i.company_id = ? AND i.kind = 'angebot'
      ORDER BY i.issue_date DESC NULLS LAST, i.id DESC`,
    [companyId]
  )) as any[]

  return res.json({
    data: zeilen.map((z) => ({
      ...z,
      // Ein abgelaufenes Angebot ist nicht abgelehnt, aber auch nicht mehr
      // offen. Die Unterscheidung gehört in die Liste, nicht in den Kopf des
      // Lesers.
      abgelaufen: z.status === 'versendet' && z.valid_until
        ? String(z.valid_until).slice(0, 10) < heute
        : false,
    })),
    error: null,
  })
})

router.get('/companies/:companyId/quotes/:quoteId', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const angebot = await ladeAngebot(Number(req.params.companyId), Number(req.params.quoteId))
  if (!angebot) return res.status(404).json({ data: null, error: 'Angebot nicht gefunden' })
  return res.json({ data: angebot, error: null })
})

// ─── Anlegen und ändern ──────────────────────────────────────────────────────

router.post('/companies/:companyId/quotes', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const ausstellung = String(req.body?.issue_date || heuteISO()).slice(0, 10)
  const firma = (await db.get('SELECT tax_mode FROM companies WHERE id = ?', [companyId])) as any

  const zeile = await db.run(
    `INSERT INTO invoices
       (company_id, client_id, project_id, kind, status, issue_date, valid_until,
        intro, outro, tax_mode, created_by)
     VALUES (?, ?, ?, 'angebot', 'entwurf', ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      req.body?.client_id ? Number(req.body.client_id) : null,
      req.body?.project_id ? Number(req.body.project_id) : null,
      ausstellung,
      String(req.body?.valid_until || plusTage(ausstellung, GUELTIG_TAGE)).slice(0, 10),
      String(req.body?.intro || ''),
      String(req.body?.outro || ''),
      String(req.body?.tax_mode || firma?.tax_mode || 'regel'),
      (req as any).user?.id ?? null,
    ]
  )
  return res.json({ data: await ladeAngebot(companyId, zeile.id), error: null })
})

router.put('/companies/:companyId/quotes/:quoteId', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const quoteId = Number(req.params.quoteId)
  const vorher = (await db.get(
    "SELECT * FROM invoices WHERE id = ? AND company_id = ? AND kind = 'angebot'",
    [quoteId, companyId]
  )) as any
  if (!vorher) return res.status(404).json({ data: null, error: 'Angebot nicht gefunden' })
  if (vorher.status === 'angenommen') {
    return res.status(400).json({ data: null, error: 'Ein angenommenes Angebot wird nicht mehr geändert' })
  }

  const felder: string[] = []
  const werte: any[] = []
  const setze = (spalte: string, wert: any) => { felder.push(`${spalte} = ?`); werte.push(wert) }
  if ('client_id' in req.body) setze('client_id', req.body.client_id ? Number(req.body.client_id) : null)
  if ('project_id' in req.body) setze('project_id', req.body.project_id ? Number(req.body.project_id) : null)
  if ('issue_date' in req.body) setze('issue_date', String(req.body.issue_date).slice(0, 10) || null)
  if ('valid_until' in req.body) setze('valid_until', req.body.valid_until ? String(req.body.valid_until).slice(0, 10) : null)
  if ('intro' in req.body) setze('intro', String(req.body.intro || ''))
  if ('outro' in req.body) setze('outro', String(req.body.outro || ''))
  if ('tax_mode' in req.body) setze('tax_mode', String(req.body.tax_mode || 'regel'))
  if (felder.length === 0) return res.json({ data: await ladeAngebot(companyId, quoteId), error: null })

  await db.run(`UPDATE invoices SET ${felder.join(', ')}, updated_at = NOW() WHERE id = ?`, [...werte, quoteId])
  await summenNeuRechnen(quoteId)
  return res.json({ data: await ladeAngebot(companyId, quoteId), error: null })
})

router.put('/companies/:companyId/quotes/:quoteId/items', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const quoteId = Number(req.params.quoteId)
  const angebot = (await db.get(
    "SELECT status FROM invoices WHERE id = ? AND company_id = ? AND kind = 'angebot'",
    [quoteId, companyId]
  )) as any
  if (!angebot) return res.status(404).json({ data: null, error: 'Angebot nicht gefunden' })
  if (angebot.status === 'angenommen') {
    return res.status(400).json({ data: null, error: 'Ein angenommenes Angebot wird nicht mehr geändert' })
  }

  const posten = Array.isArray(req.body?.items) ? req.body.items : []
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM invoice_items WHERE invoice_id = ?', [quoteId])
    for (let i = 0; i < posten.length; i++) {
      const p = posten[i]
      await tx.run(
        `INSERT INTO invoice_items
           (invoice_id, description, quantity_milli, unit, unit_price_cents, tax_percent, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          quoteId,
          String(p?.description || ''),
          Math.round(Number(p?.quantity_milli ?? 1000)),
          String(p?.unit || 'Tag'),
          Math.round(Number(p?.unit_price_cents ?? 0)),
          Math.round(Number(p?.tax_percent ?? 19)),
          i,
        ]
      )
    }
  })
  await summenNeuRechnen(quoteId)
  return res.json({ data: await ladeAngebot(companyId, quoteId), error: null })
})

// ─── Festschreiben, annehmen, ablehnen ───────────────────────────────────────

/**
 * Das Angebot festschreiben und seine Nummer ziehen.
 *
 * Die Nummer kommt aus einem eigenen Zähler, in einer Transaktion gezogen.
 * Zwei gleichzeitige Anfragen bekommen zwei verschiedene Nummern.
 */
router.post('/companies/:companyId/quotes/:quoteId/issue', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const quoteId = Number(req.params.quoteId)
  const angebot = (await db.get(
    "SELECT * FROM invoices WHERE id = ? AND company_id = ? AND kind = 'angebot'",
    [quoteId, companyId]
  )) as any
  if (!angebot) return res.status(404).json({ data: null, error: 'Angebot nicht gefunden' })
  if (angebot.status !== 'entwurf') {
    return res.status(400).json({ data: null, error: 'Dieses Angebot ist bereits festgeschrieben' })
  }
  if (!angebot.client_id) {
    return res.status(400).json({ data: null, error: 'Ohne Auftraggeber kein Angebot' })
  }
  const anzahl = (await db.get('SELECT COUNT(*) AS c FROM invoice_items WHERE invoice_id = ?', [quoteId])) as any
  if (Number(anzahl?.c ?? 0) === 0) {
    return res.status(400).json({ data: null, error: 'Ohne Position kein Angebot' })
  }

  const jahr = Number(String(angebot.issue_date || heuteISO()).slice(0, 4))
  const nummer = await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO quote_counters (company_id, year, last_number) VALUES (?, ?, 0)
       ON CONFLICT (company_id, year) DO NOTHING
       RETURNING company_id`,
      [companyId, jahr]
    )
    const zeile = (await tx.get(
      `UPDATE quote_counters SET last_number = last_number + 1
        WHERE company_id = ? AND year = ?
        RETURNING last_number`,
      [companyId, jahr]
    )) as any
    const text = angebotsNummer(jahr, Number(zeile.last_number))
    await tx.run(
      "UPDATE invoices SET number = ?, status = 'versendet', updated_at = NOW() WHERE id = ?",
      [text, quoteId]
    )
    return text
  })

  await summenNeuRechnen(quoteId)
  logAudit(angebot.project_id ?? null, (req as any).user as AuthUser, 'angebot festgeschrieben', 'invoices', quoteId,
    null, { nummer })
  return res.json({ data: { number: nummer, status: 'versendet' }, error: null })
})

/**
 * Das Angebot ist angenommen - daraus wird eine Rechnung.
 *
 * Die Positionen werden kopiert, nicht verknüpft. Wenn später die Rechnung
 * geändert wird, soll das Angebot unverändert bleiben: Es belegt, was
 * vereinbart war, und das ist sein ganzer Zweck.
 *
 * Die Rechnung entsteht als Entwurf. Festgeschrieben wird sie dort, wo jede
 * Rechnung festgeschrieben wird - erst dann zieht sie ihre Rechnungsnummer.
 */
router.post('/companies/:companyId/quotes/:quoteId/accept', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const quoteId = Number(req.params.quoteId)
  const angebot = (await db.get(
    "SELECT * FROM invoices WHERE id = ? AND company_id = ? AND kind = 'angebot'",
    [quoteId, companyId]
  )) as any
  if (!angebot) return res.status(404).json({ data: null, error: 'Angebot nicht gefunden' })
  if (angebot.status === 'entwurf') {
    return res.status(400).json({ data: null, error: 'Ein Entwurf kann nicht angenommen werden' })
  }
  if (angebot.status === 'angenommen') {
    const vorhanden = (await db.get(
      "SELECT id, number FROM invoices WHERE from_quote_id = ? AND kind = 'rechnung'", [quoteId]
    )) as any
    return res.status(400).json({
      data: vorhanden ?? null,
      error: vorhanden
        ? `Dieses Angebot wurde bereits angenommen - Rechnung ${vorhanden.number || 'im Entwurf'}`
        : 'Dieses Angebot wurde bereits angenommen',
    })
  }

  const firma = (await db.get('SELECT payment_days FROM companies WHERE id = ?', [companyId])) as any
  const kunde = angebot.client_id
    ? ((await db.get('SELECT payment_days FROM company_clients WHERE id = ?', [angebot.client_id])) as any)
    : null
  const zahlungstage = Number(kunde?.payment_days ?? firma?.payment_days ?? 14)
  const ausstellung = String(req.body?.issue_date || heuteISO()).slice(0, 10)
  const angenommenAm = String(req.body?.accepted_on || heuteISO()).slice(0, 10)

  const rechnung = await db.transaction(async (tx) => {
    const neu = await tx.run(
      `INSERT INTO invoices
         (company_id, client_id, project_id, kind, status, issue_date, due_date,
          service_from, service_to, intro, outro, tax_mode, from_quote_id, created_by)
       VALUES (?, ?, ?, 'rechnung', 'entwurf', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId, angebot.client_id, angebot.project_id,
        ausstellung, faelligkeit(ausstellung, zahlungstage),
        angebot.service_from, angebot.service_to,
        angebot.intro || '', angebot.outro || '',
        angebot.tax_mode || 'regel', quoteId,
        (req as any).user?.id ?? null,
      ]
    )
    const posten = (await tx.all(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC', [quoteId]
    )) as any[]
    for (const p of posten) {
      await tx.run(
        `INSERT INTO invoice_items
           (invoice_id, description, quantity_milli, unit, unit_price_cents, tax_percent, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [neu.id, p.description, p.quantity_milli, p.unit, p.unit_price_cents, p.tax_percent, p.sort_order]
      )
    }
    await tx.run(
      "UPDATE invoices SET status = 'angenommen', accepted_on = ?, updated_at = NOW() WHERE id = ?",
      [angenommenAm, quoteId]
    )
    return neu.id as number
  })

  await summenNeuRechnen(rechnung)
  const neu = (await db.get('SELECT id, number, status, gross_cents FROM invoices WHERE id = ?', [rechnung])) as any
  logAudit(angebot.project_id ?? null, (req as any).user as AuthUser, 'angebot angenommen', 'invoices', quoteId,
    null, { angebot: angebot.number, rechnung_id: rechnung, betrag: euro(Number(neu?.gross_cents ?? 0)) })

  return res.json({ data: { angebot: angebot.number, rechnung: neu }, error: null })
})

router.post('/companies/:companyId/quotes/:quoteId/decline', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const quoteId = Number(req.params.quoteId)
  const angebot = (await db.get(
    "SELECT status, number, project_id FROM invoices WHERE id = ? AND company_id = ? AND kind = 'angebot'",
    [quoteId, companyId]
  )) as any
  if (!angebot) return res.status(404).json({ data: null, error: 'Angebot nicht gefunden' })
  if (angebot.status === 'angenommen') {
    return res.status(400).json({ data: null, error: 'Ein angenommenes Angebot wird nicht abgelehnt' })
  }
  // Der Grund wird mitgeschrieben, nicht aus Neugier: Wer nach einem Jahr
  // sieht, dass drei Angebote am Preis gescheitert sind, kalkuliert anders.
  await db.run(
    "UPDATE invoices SET status = 'abgelehnt', outro = ?, updated_at = NOW() WHERE id = ?",
    [String(req.body?.reason || '').slice(0, 500), quoteId]
  )
  logAudit(angebot.project_id ?? null, (req as any).user as AuthUser, 'angebot abgelehnt', 'invoices', quoteId,
    null, { nummer: angebot.number, grund: String(req.body?.reason || '').slice(0, 200) })
  return res.json({ data: { abgelehnt: true }, error: null })
})

router.delete('/companies/:companyId/quotes/:quoteId', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const zeile = await db.run(
    "DELETE FROM invoices WHERE id = ? AND company_id = ? AND kind = 'angebot' AND status = 'entwurf'",
    [Number(req.params.quoteId), Number(req.params.companyId)]
  )
  if (zeile.changes === 0) {
    return res.status(400).json({ data: null, error: 'Nur Entwürfe lassen sich löschen' })
  }
  return res.json({ data: { geloescht: true }, error: null })
})

/** Das Angebot als Blatt. */
router.get('/companies/:companyId/quotes/:quoteId/pdf', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const quoteId = Number(req.params.quoteId)
  const angebot = await ladeAngebot(companyId, quoteId)
  if (!angebot) return res.status(404).json({ data: null, error: 'Angebot nicht gefunden' })
  const firma = (await db.get('SELECT * FROM companies WHERE id = ?', [companyId])) as any

  const html = renderRechnung({
    firma,
    kunde: angebot.client_id
      ? {
          name: angebot.client_name || '', contact_name: angebot.contact_name || '',
          address: angebot.address || '', zip: angebot.zip || '', city: angebot.city || '',
          country: angebot.country || '', vat_id: angebot.client_vat_id || '',
        }
      : null,
    rechnung: {
      number: angebot.number || '',
      issue_date: angebot.issue_date ? String(angebot.issue_date).slice(0, 10) : null,
      due_date: null,
      service_from: angebot.service_from ? String(angebot.service_from).slice(0, 10) : null,
      service_to: angebot.service_to ? String(angebot.service_to).slice(0, 10) : null,
      intro: angebot.intro || '', outro: angebot.outro || '',
      status: angebot.status, tax_mode: angebot.tax_mode || 'regel',
      kind: 'angebot',
      valid_until: angebot.valid_until ? String(angebot.valid_until).slice(0, 10) : null,
    },
    positionen: angebot.items,
    projekt: angebot.project_title || null,
  })
  const pdf = await generatePdf(html)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="angebot-${angebot.number || quoteId}.pdf"`)
  return res.send(pdf)
})

export default router
