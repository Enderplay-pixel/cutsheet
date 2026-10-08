/**
 * Rechnungsausgang einer Firma.
 *
 * Zwei Dinge sind hier nicht verhandelbar und deshalb festgeschrieben:
 *
 * 1. **Die Rechnungsnummer wird in einer Transaktion gezogen.** Ein
 *    `COUNT(*) + 1` vergibt unter zwei gleichzeitigen Anfragen dieselbe
 *    Nummer, und doppelte Rechnungsnummern sind ein Fehler, der beim
 *    Finanzamt auffällt und nicht mehr zu reparieren ist.
 * 2. **Eine verschickte Rechnung wird nicht mehr geändert.** Sie wird
 *    storniert und neu geschrieben. Darum greift jede Änderung nur im
 *    Entwurf.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { heuteISO } from '../lib/datum'
import {
  summiere,
  faelligkeit,
  zahlungsstand,
  istUeberfaellig,
  tageUeberfaellig,
  formatiereNummer,
  type Position,
  type Steuerart,
} from '../lib/rechnung'

const router = Router()

const FIRMEN_RANG: Record<string, number> = { inhaber: 3, produktion: 2, mitarbeiter: 1 }

async function rolleInFirma(userId: number, companyId: number): Promise<string | null> {
  const firma = (await db.get('SELECT owner_id FROM companies WHERE id = ?', [companyId])) as any
  if (!firma) return null
  if (firma.owner_id === userId) return 'inhaber'
  const mitglied = (await db.get('SELECT role FROM company_members WHERE company_id = ? AND user_id = ?', [
    companyId, userId,
  ])) as any
  return mitglied?.role ?? null
}

/** Rechnungen sind Sache der Produktion - Mitarbeit sieht sie nicht. */
function erfordereAbrechnung(mindestens = 'produktion') {
  return async (req: Request, res: Response, next: Function) => {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
    const companyId = Number(req.params.companyId)
    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({ data: null, error: 'Keine gültige Firma' })
    }
    if (user.role === 'admin') {
      ;(req as any).firmenrolle = 'inhaber'
      return next()
    }
    const rolle = await rolleInFirma(user.id, companyId)
    if (!rolle) return res.status(403).json({ data: null, error: 'Kein Zugriff auf diese Firma' })
    if ((FIRMEN_RANG[rolle] ?? 0) < (FIRMEN_RANG[mindestens] ?? 2)) {
      return res.status(403).json({ data: null, error: 'Rechnungen sehen und schreiben darf die Produktion' })
    }
    ;(req as any).firmenrolle = rolle
    return next()
  }
}

/** Lädt eine Rechnung samt Positionen und abgeleiteten Werten. */
async function ladeRechnung(companyId: number, invoiceId: number) {
  const rechnung = (await db.get('SELECT * FROM invoices WHERE id = ? AND company_id = ?', [
    invoiceId, companyId,
  ])) as any
  if (!rechnung) return null
  const positionen = (await db.all(
    'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC',
    [invoiceId]
  )) as any[]
  const kunde = rechnung.client_id
    ? ((await db.get('SELECT * FROM company_clients WHERE id = ?', [rechnung.client_id])) as any)
    : null
  const heute = heuteISO()
  return {
    ...rechnung,
    positionen,
    kunde,
    zahlungsstand: zahlungsstand(rechnung.gross_cents, rechnung.paid_cents),
    ueberfaellig: istUeberfaellig(rechnung, heute),
    tage_ueberfaellig: istUeberfaellig(rechnung, heute) ? tageUeberfaellig(rechnung.due_date, heute) : 0,
  }
}

/** Schreibt die Summen aus den Positionen in die Rechnung zurück. */
async function summenNeuRechnen(invoiceId: number) {
  const rechnung = (await db.get('SELECT tax_mode FROM invoices WHERE id = ?', [invoiceId])) as any
  const positionen = (await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId])) as Position[]
  const summen = summiere(positionen, (rechnung?.tax_mode as Steuerart) || 'regel')
  await db.run(
    'UPDATE invoices SET net_cents = ?, tax_cents = ?, gross_cents = ?, updated_at = NOW() WHERE id = ?',
    [summen.netto, summen.steuer, summen.brutto, invoiceId]
  )
  return summen
}

// ─── Auftraggeber ─────────────────────────────────────────────────────────────

// GET /api/companies/:companyId/clients
router.get('/companies/:companyId/clients', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const zeilen = await db.all(
    'SELECT * FROM company_clients WHERE company_id = ? AND archived = false ORDER BY name ASC',
    [Number(req.params.companyId)]
  )
  return res.json({ data: zeilen, error: null })
})

// POST /api/companies/:companyId/clients
router.post('/companies/:companyId/clients', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const k = req.body || {}
  if (!k.name || !String(k.name).trim()) {
    return res.status(400).json({ data: null, error: 'Der Auftraggeber braucht einen Namen' })
  }
  const zeile = await db.run(
    `INSERT INTO company_clients (company_id, name, contact_name, address, zip, city, country, vat_id, email, phone, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(req.params.companyId), String(k.name).trim(), String(k.contact_name || ''), String(k.address || ''),
      String(k.zip || ''), String(k.city || ''), String(k.country || 'Deutschland'),
      String(k.vat_id || ''), String(k.email || ''), String(k.phone || ''), String(k.notes || ''),
    ]
  )
  return res.json({ data: { id: zeile.id }, error: null })
})

// PUT /api/companies/:companyId/clients/:clientId
router.put('/companies/:companyId/clients/:clientId', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const k = req.body || {}
  const zeile = await db.run(
    `UPDATE company_clients
        SET name = ?, contact_name = ?, address = ?, zip = ?, city = ?, country = ?,
            vat_id = ?, email = ?, phone = ?, notes = ?
      WHERE id = ? AND company_id = ?`,
    [
      String(k.name || ''), String(k.contact_name || ''), String(k.address || ''), String(k.zip || ''),
      String(k.city || ''), String(k.country || 'Deutschland'), String(k.vat_id || ''),
      String(k.email || ''), String(k.phone || ''), String(k.notes || ''),
      Number(req.params.clientId), Number(req.params.companyId),
    ]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Auftraggeber nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

// DELETE /api/companies/:companyId/clients/:clientId - archiviert
router.delete('/companies/:companyId/clients/:clientId', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const zeile = await db.run(
    'UPDATE company_clients SET archived = true WHERE id = ? AND company_id = ?',
    [Number(req.params.clientId), Number(req.params.companyId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Auftraggeber nicht gefunden' })
  return res.json({ data: { archiviert: true }, error: null })
})

// ─── Rechnungen ───────────────────────────────────────────────────────────────

// GET /api/companies/:companyId/invoices
router.get('/companies/:companyId/invoices', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const status = String(req.query.status || '')
  const bedingungen = ['i.company_id = ?']
  const werte: any[] = [companyId]
  if (['entwurf', 'versendet', 'bezahlt', 'storniert'].includes(status)) {
    bedingungen.push('i.status = ?')
    werte.push(status)
  }
  const zeilen = (await db.all(
    `SELECT i.*, c.name AS kunde_name, p.title AS projekt_titel
       FROM invoices i
       LEFT JOIN company_clients c ON c.id = i.client_id
       LEFT JOIN projects p ON p.id = i.project_id
      WHERE ${bedingungen.join(' AND ')}
      ORDER BY i.issue_date DESC NULLS LAST, i.id DESC
      LIMIT 500`,
    werte
  )) as any[]

  const heute = heuteISO()
  const angereichert = zeilen.map((zeile) => ({
    ...zeile,
    zahlungsstand: zahlungsstand(zeile.gross_cents, zeile.paid_cents),
    ueberfaellig: istUeberfaellig(zeile, heute),
    tage_ueberfaellig: istUeberfaellig(zeile, heute) ? tageUeberfaellig(zeile.due_date, heute) : 0,
  }))

  // Offene Posten: was steht noch aus, und wie viel davon ist zu spät.
  const offen = angereichert.filter((z) => z.status === 'versendet' && z.zahlungsstand !== 'bezahlt')
  return res.json({
    data: {
      rechnungen: angereichert,
      offene_posten: {
        anzahl: offen.length,
        summe_cents: offen.reduce((s, z) => s + (z.gross_cents - z.paid_cents), 0),
        ueberfaellig_anzahl: offen.filter((z) => z.ueberfaellig).length,
        ueberfaellig_cents: offen
          .filter((z) => z.ueberfaellig)
          .reduce((s, z) => s + (z.gross_cents - z.paid_cents), 0),
      },
    },
    error: null,
  })
})

/*
 * Die Auswertungen stehen VOR `/invoices/:invoiceId`.
 *
 * Express nimmt die erste passende Route. Stuenden sie danach, landete bei
 * `/invoices/report/vat` das Wort "report" als Kennung in der Abfrage - und
 * Postgres bricht ab, weil "report" keine Zahl ist.
 */
// ─── Auswertungen ─────────────────────────────────────────────────────────────

/** Umsatzsteuer je Zeitraum - was abzuführen wäre, nach Sätzen getrennt. */
router.get('/companies/:companyId/invoices/report/vat', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const von = String(req.query.von || `${new Date().getFullYear()}-01-01`)
  const bis = String(req.query.bis || heuteISO())

  const rechnungen = (await db.all(
    `SELECT id, number, issue_date, net_cents, tax_cents, gross_cents, tax_mode
       FROM invoices
      WHERE company_id = ? AND status IN ('versendet', 'bezahlt')
        AND issue_date >= ? AND issue_date <= ?
      ORDER BY issue_date ASC`,
    [companyId, von, bis]
  )) as any[]

  const proSatz = new Map<number, { netto: number; steuer: number }>()
  for (const rechnung of rechnungen) {
    const positionen = (await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [rechnung.id])) as Position[]
    const summen = summiere(positionen, (rechnung.tax_mode as Steuerart) || 'regel')
    for (const zeile of summen.nachSatz) {
      const bisher = proSatz.get(zeile.satz) ?? { netto: 0, steuer: 0 }
      proSatz.set(zeile.satz, { netto: bisher.netto + zeile.netto, steuer: bisher.steuer + zeile.steuer })
    }
  }

  return res.json({
    data: {
      von,
      bis,
      anzahl: rechnungen.length,
      netto_cents: rechnungen.reduce((s, r) => s + Number(r.net_cents || 0), 0),
      steuer_cents: rechnungen.reduce((s, r) => s + Number(r.tax_cents || 0), 0),
      brutto_cents: rechnungen.reduce((s, r) => s + Number(r.gross_cents || 0), 0),
      nach_satz: [...proSatz.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([satz, werte]) => ({ satz, ...werte })),
    },
    error: null,
  })
})

/**
 * Export für die Buchhaltung: eine Zeile je Rechnung, Semikolon getrennt,
 * Beträge mit Komma - so, wie es deutsche Buchhaltungsprogramme einlesen.
 */
router.get('/companies/:companyId/invoices/report/export.csv', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const von = String(req.query.von || `${new Date().getFullYear()}-01-01`)
  const bis = String(req.query.bis || heuteISO())

  const zeilen = (await db.all(
    `SELECT i.number, i.issue_date, i.due_date, i.net_cents, i.tax_cents, i.gross_cents,
            i.paid_cents, i.status, c.name AS kunde, c.vat_id, p.title AS projekt
       FROM invoices i
       LEFT JOIN company_clients c ON c.id = i.client_id
       LEFT JOIN projects p ON p.id = i.project_id
      WHERE i.company_id = ? AND i.status IN ('versendet', 'bezahlt')
        AND i.issue_date >= ? AND i.issue_date <= ?
      ORDER BY i.issue_date ASC, i.number ASC`,
    [companyId, von, bis]
  )) as any[]

  const komma = (cents: number) => (Number(cents || 0) / 100).toFixed(2).replace('.', ',')
  const feld = (wert: any) => `"${String(wert ?? '').replace(/"/g, '""')}"`
  const kopf = [
    'Rechnungsnummer', 'Datum', 'Faellig', 'Auftraggeber', 'USt-ID', 'Projekt',
    'Netto', 'Umsatzsteuer', 'Brutto', 'Bezahlt', 'Status',
  ]
  const inhalt = [
    kopf.join(';'),
    ...zeilen.map((z) =>
      [
        feld(z.number), feld(z.issue_date), feld(z.due_date), feld(z.kunde), feld(z.vat_id), feld(z.projekt),
        komma(z.net_cents), komma(z.tax_cents), komma(z.gross_cents), komma(z.paid_cents), feld(z.status),
      ].join(';')
    ),
  ].join('\r\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="rechnungen-${von}-bis-${bis}.csv"`)
  // Byte-Reihenfolge-Marke, sonst zeigt Excel aus Umlauten Kraut an
  return res.send('﻿' + inhalt)
})

// GET /api/companies/:companyId/invoices/:invoiceId
router.get('/companies/:companyId/invoices/:invoiceId', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const rechnung = await ladeRechnung(Number(req.params.companyId), Number(req.params.invoiceId))
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  return res.json({ data: rechnung, error: null })
})

// POST /api/companies/:companyId/invoices - immer als Entwurf, ohne Nummer
router.post('/companies/:companyId/invoices', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const user = (req as any).user
  const k = req.body || {}

  const firma = (await db.get('SELECT tax_mode, payment_days FROM companies WHERE id = ?', [companyId])) as any
  const ausstellung = String(k.issue_date || heuteISO())
  const zahlungsziel = Number(k.payment_days ?? firma?.payment_days ?? 14)

  if (k.project_id) {
    const projekt = (await db.get('SELECT company_id FROM projects WHERE id = ?', [Number(k.project_id)])) as any
    if (!projekt || projekt.company_id !== companyId) {
      return res.status(400).json({ data: null, error: 'Dieses Projekt gehört nicht zu dieser Firma' })
    }
  }

  const zeile = await db.run(
    `INSERT INTO invoices (company_id, client_id, project_id, status, issue_date, due_date,
                           service_from, service_to, intro, outro, tax_mode, created_by)
     VALUES (?, ?, ?, 'entwurf', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      k.client_id ? Number(k.client_id) : null,
      k.project_id ? Number(k.project_id) : null,
      ausstellung,
      faelligkeit(ausstellung, zahlungsziel),
      k.service_from || null,
      k.service_to || null,
      String(k.intro || ''),
      String(k.outro || ''),
      String(firma?.tax_mode || 'regel'),
      user.id,
    ]
  )
  return res.json({ data: { id: zeile.id }, error: null })
})

// PUT /api/companies/:companyId/invoices/:invoiceId - nur im Entwurf
router.put('/companies/:companyId/invoices/:invoiceId', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const vorhanden = (await db.get('SELECT status FROM invoices WHERE id = ? AND company_id = ?', [
    invoiceId, companyId,
  ])) as any
  if (!vorhanden) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  if (vorhanden.status !== 'entwurf') {
    return res.status(400).json({
      data: null,
      error: 'Eine verschickte Rechnung wird nicht geändert. Storniere sie und schreibe eine neue.',
    })
  }

  const k = req.body || {}
  const firma = (await db.get('SELECT payment_days FROM companies WHERE id = ?', [companyId])) as any
  const ausstellung = String(k.issue_date || heuteISO())
  await db.run(
    `UPDATE invoices
        SET client_id = ?, project_id = ?, issue_date = ?, due_date = ?,
            service_from = ?, service_to = ?, intro = ?, outro = ?, updated_at = NOW()
      WHERE id = ? AND company_id = ?`,
    [
      k.client_id ? Number(k.client_id) : null,
      k.project_id ? Number(k.project_id) : null,
      ausstellung,
      k.due_date || faelligkeit(ausstellung, Number(k.payment_days ?? firma?.payment_days ?? 14)),
      k.service_from || null,
      k.service_to || null,
      String(k.intro || ''),
      String(k.outro || ''),
      invoiceId,
      companyId,
    ]
  )
  await summenNeuRechnen(invoiceId)
  return res.json({ data: await ladeRechnung(companyId, invoiceId), error: null })
})

// PUT …/items - Positionen im Ganzen ersetzen
router.put('/companies/:companyId/invoices/:invoiceId/items', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const rechnung = (await db.get('SELECT status FROM invoices WHERE id = ? AND company_id = ?', [
    invoiceId, companyId,
  ])) as any
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  if (rechnung.status !== 'entwurf') {
    return res.status(400).json({ data: null, error: 'Positionen lassen sich nur im Entwurf ändern' })
  }

  const positionen = Array.isArray(req.body?.items) ? req.body.items : []
  await db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId])
  let reihe = 0
  for (const position of positionen) {
    await db.run(
      `INSERT INTO invoice_items (invoice_id, description, quantity_milli, unit, unit_price_cents, tax_percent, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        String(position.description || ''),
        Math.round(Number(position.quantity_milli ?? 1000)),
        String(position.unit || 'Tag'),
        Math.round(Number(position.unit_price_cents || 0)),
        Math.round(Number(position.tax_percent ?? 19)),
        reihe++,
      ]
    )
  }
  await summenNeuRechnen(invoiceId)
  return res.json({ data: await ladeRechnung(companyId, invoiceId), error: null })
})

/**
 * Festschreiben: zieht die Rechnungsnummer und setzt den Status auf
 * „versendet". Ab hier ist die Rechnung unveränderlich.
 */
router.post('/companies/:companyId/invoices/:invoiceId/issue', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)

  const rechnung = (await db.get('SELECT * FROM invoices WHERE id = ? AND company_id = ?', [
    invoiceId, companyId,
  ])) as any
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  if (rechnung.status !== 'entwurf') {
    return res.status(400).json({ data: null, error: 'Diese Rechnung ist bereits festgeschrieben' })
  }
  if (!rechnung.client_id) {
    return res.status(400).json({ data: null, error: 'Ohne Auftraggeber keine Rechnung' })
  }
  const anzahl = (await db.get('SELECT COUNT(*) AS c FROM invoice_items WHERE invoice_id = ?', [invoiceId])) as any
  if (Number(anzahl?.c ?? 0) === 0) {
    return res.status(400).json({ data: null, error: 'Ohne Position keine Rechnung' })
  }

  const jahr = Number(String(rechnung.issue_date || heuteISO()).slice(0, 4))

  // Die Nummer wird in einer Transaktion gezogen. Zwei gleichzeitige
  // Anfragen bekommen so zwei verschiedene Nummern - und keine Luecke.
  const nummer = await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO invoice_counters (company_id, year, last_number) VALUES (?, ?, 0)
       ON CONFLICT (company_id, year) DO NOTHING
       RETURNING company_id`,
      [companyId, jahr]
    )
    const zeile = (await tx.get(
      `UPDATE invoice_counters SET last_number = last_number + 1
        WHERE company_id = ? AND year = ?
        RETURNING last_number`,
      [companyId, jahr]
    )) as any
    const laufend = Number(zeile.last_number)
    const text = formatiereNummer(jahr, laufend)
    await tx.run(
      "UPDATE invoices SET number = ?, status = 'versendet', updated_at = NOW() WHERE id = ?",
      [text, invoiceId]
    )
    return text
  })

  await summenNeuRechnen(invoiceId)
  return res.json({ data: { number: nummer, status: 'versendet' }, error: null })
})

// POST …/payment - Zahlungseingang erfassen
router.post('/companies/:companyId/invoices/:invoiceId/payment', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const rechnung = (await db.get('SELECT * FROM invoices WHERE id = ? AND company_id = ?', [
    invoiceId, companyId,
  ])) as any
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  if (rechnung.status === 'entwurf') {
    return res.status(400).json({ data: null, error: 'Auf einen Entwurf kann niemand zahlen' })
  }

  const betrag = Math.round(Number(req.body?.amount_cents ?? rechnung.gross_cents - rechnung.paid_cents))
  if (!Number.isFinite(betrag) || betrag === 0) {
    return res.status(400).json({ data: null, error: 'Kein gültiger Betrag' })
  }
  const bezahlt = Math.max(0, Number(rechnung.paid_cents) + betrag)
  const stand = zahlungsstand(rechnung.gross_cents, bezahlt)
  await db.run(
    `UPDATE invoices SET paid_cents = ?, paid_at = ?, status = ?, updated_at = NOW() WHERE id = ?`,
    [
      bezahlt,
      stand === 'bezahlt' ? String(req.body?.paid_at || heuteISO()) : null,
      stand === 'bezahlt' ? 'bezahlt' : rechnung.status,
      invoiceId,
    ]
  )
  return res.json({ data: await ladeRechnung(companyId, invoiceId), error: null })
})

// POST …/cancel - stornieren
router.post('/companies/:companyId/invoices/:invoiceId/cancel', requireAuth, erfordereAbrechnung('inhaber'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const rechnung = (await db.get('SELECT status FROM invoices WHERE id = ? AND company_id = ?', [
    invoiceId, companyId,
  ])) as any
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  if (rechnung.status === 'storniert') {
    return res.status(400).json({ data: null, error: 'Diese Rechnung ist bereits storniert' })
  }
  // Die Nummer bleibt stehen: eine stornierte Rechnung verschwindet nicht,
  // sonst entstuende genau die Luecke, die es nicht geben darf.
  await db.run("UPDATE invoices SET status = 'storniert', updated_at = NOW() WHERE id = ?", [invoiceId])
  return res.json({ data: { storniert: true }, error: null })
})

// DELETE - nur Entwürfe verschwinden
router.delete('/companies/:companyId/invoices/:invoiceId', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const zeile = await db.run(
    "DELETE FROM invoices WHERE id = ? AND company_id = ? AND status = 'entwurf'",
    [Number(req.params.invoiceId), Number(req.params.companyId)]
  )
  if (zeile.changes === 0) {
    return res.status(400).json({ data: null, error: 'Nur Entwürfe lassen sich löschen. Festgeschriebenes wird storniert.' })
  }
  return res.json({ data: { geloescht: true }, error: null })
})

// GET …/invoices/:invoiceId/pdf - das Blatt, das verschickt wird
router.get('/companies/:companyId/invoices/:invoiceId/pdf', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const rechnung = await ladeRechnung(companyId, invoiceId)
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })

  const firma = (await db.get('SELECT * FROM companies WHERE id = ?', [companyId])) as any
  const projekt = rechnung.project_id
    ? ((await db.get('SELECT title FROM projects WHERE id = ?', [rechnung.project_id])) as any)
    : null

  const { renderRechnung } = await import('../lib/rechnungLayout')
  const html = renderRechnung({
    firma,
    kunde: rechnung.kunde,
    rechnung,
    positionen: rechnung.positionen,
    projekt: projekt?.title || null,
  })

  if (String(req.query.format || '') === 'html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(html)
  }

  const { generatePdf } = require('./pdf')
  try {
    const blatt = await generatePdf(html)
    const name = rechnung.number ? `rechnung-${rechnung.number}` : `rechnung-entwurf-${invoiceId}`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${name}.pdf"`)
    return res.send(blatt)
  } catch (fehler: any) {
    console.error('[rechnung/pdf]', fehler?.message || fehler)
    return res.status(500).json({ data: null, error: 'Das PDF liess sich nicht erzeugen' })
  }
})

export default router
