/**
 * Offene Posten, Zahlungseingänge und Mahnungen.
 *
 * Die Reihenfolge ist die der Buchhaltung: Erst sieht man, was offen ist, dann
 * trägt man ein, was eingegangen ist, und was dann noch offen ist, wird
 * gemahnt - in dieser Richtung, nicht umgekehrt. Eine Mahnung auf eine
 * Rechnung, deren Zahlung nur nicht eingetragen war, kostet mehr als sie
 * einbringt.
 *
 * Nichts hier verschickt von sich aus etwas. Der Mahnlauf berechnet und
 * schlägt vor; abgeschickt wird auf Knopfdruck, und zwar je Rechnung
 * bestätigt.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { logAudit } from './audit'
import { schreibeCsv, cents } from '../lib/tabelle'
import { euro, zahlungsstand } from '../lib/rechnung'
import {
  STUFEN, PAUSCHALE_CENTS, BASISZINS_RUECKFALL_BP, BASISZINS_STAND,
  zinsSatzVeraltet, verzugssatzBp, naechsterSchritt,
  altersklasse, ALTERSKLASSEN, tageZwischen,
  type Vorschlag,
} from '../lib/mahnwesen'
import { erfordereAbrechnung } from './invoices'
import { reiheEin } from '../lib/mailversand'
import { generatePdf } from './pdf'
import { renderMahnung } from '../lib/mahnungLayout'

const router = Router()

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Die Mahneinstellungen einer Firma, mit Rückfallwerten. */
async function einstellungen(companyId: number) {
  const firma = (await db.get('SELECT * FROM companies WHERE id = ?', [companyId])) as any
  const eigenerSatz = Number(firma?.base_rate_bp ?? 0)
  // 0 heißt "nicht eingetragen" - ein echter Basiszins von 0 ist möglich,
  // aber dann trägt man ihn mit Datum ein und die Unterscheidung stimmt wieder.
  const basiszinsBp = eigenerSatz !== 0 ? eigenerSatz : BASISZINS_RUECKFALL_BP
  const stand = eigenerSatz !== 0 ? (firma?.base_rate_date || '') : BASISZINS_STAND
  return {
    firma,
    basiszinsBp,
    stand,
    veraltet: stand ? zinsSatzVeraltet(String(stand).slice(0, 10), heuteISO()) : true,
    aus: firma?.dunning_enabled === false,
  }
}

/**
 * Was eine Rechnung wirklich offen hat.
 *
 * Nicht `gross_cents - paid_cents` aus der Rechnung, sondern die Summe der
 * erfassten Zahlungen. Beides sollte gleich sein; wenn nicht, ist die Summe
 * der Zahlungen die Wahrheit, weil sie belegt ist.
 */
const OFFENE_RECHNUNGEN = `
  SELECT i.*, c.name AS client_name, c.email AS client_email, c.contact_name,
         c.is_business, c.payment_days AS client_payment_days,
         COALESCE(z.summe, 0) AS zahlungen_cents,
         p.title AS project_title
    FROM invoices i
    LEFT JOIN company_clients c ON i.client_id = c.id
    LEFT JOIN projects p ON i.project_id = p.id
    LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS summe
                 FROM invoice_payments GROUP BY invoice_id) z ON z.invoice_id = i.id
   WHERE i.company_id = ?
     AND i.kind = 'rechnung'
     AND i.status NOT IN ('entwurf', 'storniert')
`

// ─── Offene Posten ───────────────────────────────────────────────────────────

/**
 * Die Offene-Posten-Liste mit Altersstruktur.
 *
 * Die Altersstruktur ist die eine Zahl, die eine Produktionsfirma über ihre
 * Liquidität informiert: Nicht wie viel offen ist, sondern wie lange schon.
 * 40.000 Euro offen sind ein guter Monat, wenn sie zehn Tage alt sind, und ein
 * Problem, wenn sie vier Monate alt sind.
 */
router.get('/companies/:companyId/opos', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const heute = heuteISO()
  const zeilen = (await db.all(`${OFFENE_RECHNUNGEN} ORDER BY i.due_date ASC NULLS LAST, i.number ASC`, [companyId])) as any[]

  const posten = zeilen
    .map((z) => {
      const bezahlt = Number(z.zahlungen_cents || 0)
      const offen = Number(z.gross_cents || 0) - bezahlt
      return {
        id: z.id,
        number: z.number,
        client_id: z.client_id,
        client_name: z.client_name || '',
        project_title: z.project_title || '',
        issue_date: z.issue_date,
        due_date: z.due_date,
        gross_cents: Number(z.gross_cents || 0),
        bezahlt_cents: bezahlt,
        offen_cents: offen,
        tage_ueberfaellig: z.due_date ? Math.max(0, tageZwischen(String(z.due_date), heute)) : 0,
        klasse: altersklasse(z.due_date, heute),
        reminder_level: Number(z.reminder_level || 0),
        reminded_on: z.reminded_on,
        reminder_due_on: z.reminder_due_on,
        status: z.status,
      }
    })
    .filter((p) => p.offen_cents > 0)

  // Summen je Altersklasse, in der festen Reihenfolge - auch die leeren, sonst
  // springt die Darstellung, sobald eine Klasse leer wird.
  const struktur = ALTERSKLASSEN.map((klasse) => {
    const eigene = posten.filter((p) => p.klasse === klasse)
    return {
      klasse,
      anzahl: eigene.length,
      summe_cents: eigene.reduce((s, p) => s + p.offen_cents, 0),
    }
  })

  const e = await einstellungen(companyId)
  return res.json({
    data: {
      posten,
      struktur,
      offen_cents: posten.reduce((s, p) => s + p.offen_cents, 0),
      ueberfaellig_cents: posten.filter((p) => p.tage_ueberfaellig > 0).reduce((s, p) => s + p.offen_cents, 0),
      basiszins_bp: e.basiszinsBp,
      basiszins_stand: e.stand,
      basiszins_veraltet: e.veraltet,
      mahnwesen_aus: e.aus,
    },
    error: null,
  })
})

/** Die Offene-Posten-Liste als CSV - was der Steuerberater sehen will. */
router.get('/companies/:companyId/opos/export.csv', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const heute = heuteISO()
  const zeilen = (await db.all(`${OFFENE_RECHNUNGEN} ORDER BY i.due_date ASC NULLS LAST`, [companyId])) as any[]

  const csv = schreibeCsv(
    ['Nummer', 'Auftraggeber', 'Projekt', 'Rechnungsdatum', 'Fällig', 'Brutto', 'Bezahlt', 'Offen', 'Tage überfällig', 'Altersklasse', 'Mahnstufe'],
    zeilen
      .map((z) => {
        const offen = Number(z.gross_cents || 0) - Number(z.zahlungen_cents || 0)
        return { z, offen }
      })
      .filter(({ offen }) => offen > 0)
      .map(({ z, offen }) => [
        z.number, z.client_name || '', z.project_title || '',
        z.issue_date ? String(z.issue_date).slice(0, 10) : '',
        z.due_date ? String(z.due_date).slice(0, 10) : '',
        cents(Number(z.gross_cents || 0)), cents(Number(z.zahlungen_cents || 0)), cents(offen),
        z.due_date ? Math.max(0, tageZwischen(String(z.due_date), heute)) : 0,
        altersklasse(z.due_date, heute),
        Number(z.reminder_level || 0),
      ])
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="offene-posten-${heute}.csv"`)
  return res.send(csv)
})

// ─── Zahlungseingänge ────────────────────────────────────────────────────────

/** Die Summe der Zahlungen zurück in die Rechnung schreiben. */
async function zahlungenVerrechnen(invoiceId: number): Promise<any> {
  const rechnung = (await db.get('SELECT gross_cents, status FROM invoices WHERE id = ?', [invoiceId])) as any
  const summe = (await db.get(
    'SELECT COALESCE(SUM(amount_cents), 0) AS summe, MAX(paid_on) AS letzte FROM invoice_payments WHERE invoice_id = ?',
    [invoiceId]
  )) as any
  const bezahlt = Number(summe?.summe ?? 0)
  const stand = zahlungsstand(Number(rechnung?.gross_cents ?? 0), bezahlt)
  // Eine stornierte Rechnung bleibt storniert, auch wenn später noch etwas
  // eingeht - sonst stünde eine Gutschrift plötzlich wieder als Forderung da.
  const status = rechnung?.status === 'storniert'
    ? 'storniert'
    : stand === 'bezahlt' ? 'bezahlt' : 'versendet'
  await db.run(
    'UPDATE invoices SET paid_cents = ?, paid_at = ?, status = ?, updated_at = NOW() WHERE id = ?',
    [bezahlt, stand === 'bezahlt' ? (summe?.letzte ?? null) : null, status, invoiceId]
  )
  return { bezahlt_cents: bezahlt, stand, status }
}

router.get('/companies/:companyId/invoices/:invoiceId/payments', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const rechnung = (await db.get('SELECT id FROM invoices WHERE id = ? AND company_id = ?', [
    Number(req.params.invoiceId), Number(req.params.companyId),
  ])) as any
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  const zeilen = await db.all(
    'SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY paid_on DESC, id DESC',
    [rechnung.id]
  )
  return res.json({ data: zeilen, error: null })
})

/**
 * Einen Zahlungseingang erfassen.
 *
 * Ein negativer Betrag ist erlaubt: So wird eine Rücklastschrift abgebildet,
 * ohne die ursprüngliche Zahlung zu löschen. Was eingegangen war, war
 * eingegangen - das verschwindet nicht rückwirkend aus der Buchhaltung.
 */
router.post('/companies/:companyId/invoices/:invoiceId/payments', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const rechnung = (await db.get('SELECT * FROM invoices WHERE id = ? AND company_id = ?', [invoiceId, companyId])) as any
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  if (rechnung.status === 'entwurf') {
    return res.status(400).json({ data: null, error: 'Auf einen Entwurf kann niemand zahlen' })
  }

  const betrag = Math.round(Number(req.body?.amount_cents))
  if (!Number.isFinite(betrag) || betrag === 0) {
    return res.status(400).json({ data: null, error: 'Kein gültiger Betrag' })
  }
  const datum = String(req.body?.paid_on || heuteISO()).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return res.status(400).json({ data: null, error: 'Kein gültiges Datum' })
  }

  const zeile = await db.run(
    `INSERT INTO invoice_payments (invoice_id, amount_cents, paid_on, method, reference, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceId, betrag, datum,
      String(req.body?.method || 'ueberweisung').slice(0, 40),
      String(req.body?.reference || '').slice(0, 200),
      String(req.body?.note || '').slice(0, 500),
      (req as any).user?.id ?? null,
    ]
  )
  const stand = await zahlungenVerrechnen(invoiceId)
  logAudit(rechnung.project_id ?? null, (req as any).user as AuthUser, 'zahlung erfasst', 'invoice_payments', zeile.id,
    null, { rechnung: rechnung.number, betrag: euro(betrag), datum })
  return res.json({ data: { id: zeile.id, ...stand }, error: null })
})

/**
 * Einen Zahlungseingang löschen - nur bei einem Erfassungsfehler.
 *
 * Das ist die Ausnahme von der Regel, dass Buchhaltung nichts löscht: Wer sich
 * beim Eintippen vertut, muss das berichtigen können, und ein Tippfehler ist
 * kein Geschäftsvorfall. Die Löschung steht im Protokoll.
 */
router.delete('/companies/:companyId/invoices/:invoiceId/payments/:paymentId', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const zahlung = (await db.get(
    `SELECT p.* FROM invoice_payments p
       JOIN invoices i ON p.invoice_id = i.id
      WHERE p.id = ? AND p.invoice_id = ? AND i.company_id = ?`,
    [Number(req.params.paymentId), invoiceId, companyId]
  )) as any
  if (!zahlung) return res.status(404).json({ data: null, error: 'Zahlung nicht gefunden' })

  await db.run('DELETE FROM invoice_payments WHERE id = ?', [zahlung.id])
  const stand = await zahlungenVerrechnen(invoiceId)
  logAudit(null, (req as any).user as AuthUser, 'zahlung gelöscht', 'invoice_payments', zahlung.id,
    { betrag: euro(zahlung.amount_cents), datum: String(zahlung.paid_on).slice(0, 10) }, null)
  return res.json({ data: stand, error: null })
})

// ─── Mahnlauf ────────────────────────────────────────────────────────────────

/** Rechnung samt Vorschlag - der gemeinsame Teil von Vorschau und Versand. */
async function vorschlaegeSammeln(companyId: number, heute: string, nurRechnung?: number) {
  const e = await einstellungen(companyId)
  const zeilen = (await db.all(
    `${OFFENE_RECHNUNGEN} ${nurRechnung ? 'AND i.id = ?' : ''} ORDER BY i.due_date ASC NULLS LAST`,
    nurRechnung ? [companyId, nurRechnung] : [companyId]
  )) as any[]

  const treffer: Array<{ rechnung: any; vorschlag: Vorschlag }> = []
  for (const z of zeilen) {
    const vorschlag = naechsterSchritt(
      {
        bruttoCents: Number(z.gross_cents || 0),
        bezahltCents: Number(z.zahlungen_cents || 0),
        faellig: z.due_date ? String(z.due_date).slice(0, 10) : null,
        letzteStufe: Number(z.reminder_level || 0),
        letzteMahnung: z.reminded_on ? String(z.reminded_on).slice(0, 10) : null,
        letzteFrist: z.reminder_due_on ? String(z.reminder_due_on).slice(0, 10) : null,
      },
      heute,
      {
        basiszinsBp: e.basiszinsBp,
        gegenUnternehmer: z.is_business !== false,
        mitPauschale: z.is_business !== false,
      }
    )
    if (vorschlag) treffer.push({ rechnung: z, vorschlag })
  }
  return { einstellungen: e, treffer }
}

/**
 * Der Mahnlauf als Vorschau - was gemahnt würde, wenn man jetzt mahnte.
 *
 * Getrennt vom Versand, damit man es ansehen kann, ohne etwas auszulösen. Das
 * ist nicht Bequemlichkeit: Ein Mahnlauf, der beim Ansehen verschickt, wird
 * nicht angesehen.
 */
router.get('/companies/:companyId/mahnlauf', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const heute = String(req.query.stichtag || heuteISO()).slice(0, 10)
  const { einstellungen: e, treffer } = await vorschlaegeSammeln(companyId, heute)

  return res.json({
    data: {
      stichtag: heute,
      aus: e.aus,
      basiszins_bp: e.basiszinsBp,
      basiszins_stand: e.stand,
      basiszins_veraltet: e.veraltet,
      verzugssatz_unternehmer_bp: verzugssatzBp(e.basiszinsBp, true),
      verzugssatz_verbraucher_bp: verzugssatzBp(e.basiszinsBp, false),
      stufen: STUFEN,
      pauschale_cents: PAUSCHALE_CENTS,
      vorschlaege: treffer.map(({ rechnung, vorschlag }) => ({
        invoice_id: rechnung.id,
        number: rechnung.number,
        client_name: rechnung.client_name || '',
        client_email: rechnung.client_email || '',
        is_business: rechnung.is_business !== false,
        project_title: rechnung.project_title || '',
        due_date: rechnung.due_date,
        stufe: vorschlag.stufe,
        stufe_name: vorschlag.regel.name,
        offen_cents: vorschlag.offenCents,
        tage_verzug: vorschlag.tageVerzug,
        zinsen_cents: vorschlag.zinsenCents,
        gebuehr_cents: vorschlag.gebuehrCents,
        pauschale_cents: vorschlag.pauschaleCents,
        gesamt_cents: vorschlag.gesamtCents,
        neue_frist: vorschlag.neueFrist,
      })),
    },
    error: null,
  })
})

/** Das Mahnschreiben als PDF - auch vor dem Versand ansehbar. */
router.get('/companies/:companyId/invoices/:invoiceId/mahnung.pdf', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const heute = String(req.query.stichtag || heuteISO()).slice(0, 10)
  const { einstellungen: e, treffer } = await vorschlaegeSammeln(companyId, heute, invoiceId)
  if (treffer.length === 0) {
    return res.status(400).json({ data: null, error: 'Für diese Rechnung steht keine Mahnung an' })
  }
  const { rechnung, vorschlag } = treffer[0]
  const html = renderMahnung({
    firma: e.firma,
    kunde: {
      name: rechnung.client_name || '', contact_name: rechnung.contact_name || '',
      address: rechnung.address || '', zip: rechnung.zip || '', city: rechnung.city || '',
    },
    rechnung: {
      number: rechnung.number,
      issue_date: rechnung.issue_date ? String(rechnung.issue_date).slice(0, 10) : null,
      due_date: rechnung.due_date ? String(rechnung.due_date).slice(0, 10) : null,
    },
    mahnung: {
      stufe: vorschlag.stufe, name: vorschlag.regel.name, datum: heute,
      frist: vorschlag.neueFrist, tage_verzug: vorschlag.tageVerzug,
      offen_cents: vorschlag.offenCents, zinsen_cents: vorschlag.zinsenCents,
      gebuehr_cents: vorschlag.gebuehrCents, pauschale_cents: vorschlag.pauschaleCents,
      gesamt_cents: vorschlag.gesamtCents,
      satz_bp: verzugssatzBp(e.basiszinsBp, rechnung.is_business !== false),
      basiszins_bp: e.basiszinsBp,
    },
  })
  const pdf = await generatePdf(html)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="mahnung-${rechnung.number || invoiceId}.pdf"`)
  return res.send(pdf)
})

/**
 * Eine Mahnung festschreiben und die Mail einreihen.
 *
 * Je Rechnung ein Aufruf. Kein "alle mahnen" in einem Zug: Wer vier Mahnungen
 * schickt, soll vier Entscheidungen getroffen haben.
 */
router.post('/companies/:companyId/invoices/:invoiceId/mahnung', requireAuth, erfordereAbrechnung(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const invoiceId = Number(req.params.invoiceId)
  const heute = heuteISO()
  const { einstellungen: e, treffer } = await vorschlaegeSammeln(companyId, heute, invoiceId)
  if (treffer.length === 0) {
    return res.status(400).json({ data: null, error: 'Für diese Rechnung steht keine Mahnung an' })
  }
  const { rechnung, vorschlag } = treffer[0]
  const satzBp = verzugssatzBp(e.basiszinsBp, rechnung.is_business !== false)

  const mahnung = await db.run(
    `INSERT INTO invoice_reminders
       (invoice_id, level, sent_on, due_on, open_cents, interest_cents, fee_cents,
        lump_sum_cents, total_cents, days_overdue, rate_bp, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceId, vorschlag.stufe, heute, vorschlag.neueFrist,
      vorschlag.offenCents, vorschlag.zinsenCents, vorschlag.gebuehrCents,
      vorschlag.pauschaleCents, vorschlag.gesamtCents, vorschlag.tageVerzug,
      satzBp, (req as any).user?.id ?? null,
    ]
  )
  await db.run(
    'UPDATE invoices SET reminder_level = ?, reminded_on = ?, reminder_due_on = ?, updated_at = NOW() WHERE id = ?',
    [vorschlag.stufe, heute, vorschlag.neueFrist, invoiceId]
  )

  // Die Mail geht in die Warteschlange, nicht direkt raus - derselbe Weg wie
  // jede andere Mail, mit Wiederholung und Protokoll.
  let mailId: number | null = null
  const empfaenger = String(rechnung.client_email || '').trim()
  if (empfaenger && req.body?.mail !== false) {
    const pdf = await generatePdf(renderMahnung({
      firma: e.firma,
      kunde: {
        name: rechnung.client_name || '', contact_name: rechnung.contact_name || '',
        address: rechnung.address || '', zip: rechnung.zip || '', city: rechnung.city || '',
      },
      rechnung: {
        number: rechnung.number,
        issue_date: rechnung.issue_date ? String(rechnung.issue_date).slice(0, 10) : null,
        due_date: rechnung.due_date ? String(rechnung.due_date).slice(0, 10) : null,
      },
      mahnung: {
        stufe: vorschlag.stufe, name: vorschlag.regel.name, datum: heute,
        frist: vorschlag.neueFrist, tage_verzug: vorschlag.tageVerzug,
        offen_cents: vorschlag.offenCents, zinsen_cents: vorschlag.zinsenCents,
        gebuehr_cents: vorschlag.gebuehrCents, pauschale_cents: vorschlag.pauschaleCents,
        gesamt_cents: vorschlag.gesamtCents, satz_bp: satzBp, basiszins_bp: e.basiszinsBp,
      },
    }))
    const eingereiht = await reiheEin({
      projectId: rechnung.project_id ?? null,
      betreff: `${vorschlag.regel.name} zur Rechnung ${rechnung.number}`,
      html: mahnMailText(e.firma, rechnung, vorschlag),
      empfaenger: [{ email: empfaenger, name: rechnung.contact_name || rechnung.client_name || '' }],
      anlass: 'mahnung',
      bezugId: invoiceId,
      erstelltVon: (req as any).user?.id ?? null,
      anhang: { dateiname: `mahnung-${rechnung.number}.pdf`, inhalt: pdf },
    })
    mailId = eingereiht[0]?.id ?? null
    if (mailId) await db.run('UPDATE invoice_reminders SET mail_id = ? WHERE id = ?', [mailId, mahnung.id])
  }

  logAudit(rechnung.project_id ?? null, (req as any).user as AuthUser, 'mahnung', 'invoice_reminders', mahnung.id,
    null, { rechnung: rechnung.number, stufe: vorschlag.stufe, gesamt: euro(vorschlag.gesamtCents) })

  return res.json({
    data: {
      id: mahnung.id, stufe: vorschlag.stufe, frist: vorschlag.neueFrist,
      gesamt_cents: vorschlag.gesamtCents, mail_id: mailId,
      mail: mailId ? 'eingereiht' : empfaenger ? 'abgewählt' : 'keine Adresse hinterlegt',
    },
    error: null,
  })
})

/** Die Mahnungen einer Rechnung - für die Zeitleiste in der Oberfläche. */
router.get('/companies/:companyId/invoices/:invoiceId/mahnungen', requireAuth, erfordereAbrechnung('mitarbeiter'), async (req: Request, res: Response) => {
  const rechnung = (await db.get('SELECT id FROM invoices WHERE id = ? AND company_id = ?', [
    Number(req.params.invoiceId), Number(req.params.companyId),
  ])) as any
  if (!rechnung) return res.status(404).json({ data: null, error: 'Rechnung nicht gefunden' })
  const zeilen = await db.all(
    'SELECT * FROM invoice_reminders WHERE invoice_id = ? ORDER BY level ASC, sent_on ASC',
    [rechnung.id]
  )
  return res.json({ data: zeilen, error: null })
})

/** Der Text der Mahnmail. Das Blatt im Anhang trägt die Zahlen. */
function mahnMailText(firma: any, rechnung: any, v: Vorschlag): string {
  const anrede = rechnung.contact_name
    ? `Guten Tag ${rechnung.contact_name},`
    : 'Guten Tag,'
  const einleitung = v.stufe === 1
    ? `unsere Rechnung ${rechnung.number} ist noch offen. Vermutlich ist sie untergegangen - das passiert.`
    : `unsere Rechnung ${rechnung.number} ist trotz unserer vorherigen Mahnung noch offen.`
  const zusatz: string[] = []
  if (v.zinsenCents > 0) zusatz.push(`Verzugszinsen ${euro(v.zinsenCents)}`)
  if (v.gebuehrCents > 0) zusatz.push(`Mahngebühr ${euro(v.gebuehrCents)}`)
  if (v.pauschaleCents > 0) zusatz.push(`Pauschale nach § 288 Abs. 5 BGB ${euro(v.pauschaleCents)}`)

  return `<p>${anrede}</p>
<p>${einleitung}</p>
<p>Offener Betrag: <strong>${euro(v.offenCents)}</strong>${zusatz.length ? `<br>${zusatz.join('<br>')}` : ''}
<br>Zu zahlen: <strong>${euro(v.gesamtCents)}</strong></p>
<p>Wir bitten um Zahlung bis zum ${new Date(`${v.neueFrist}T12:00:00Z`).toLocaleDateString('de-DE')}.
Die Einzelheiten stehen im angehängten Schreiben.</p>
<p>Sollte die Zahlung bereits unterwegs sein, betrachten Sie diese Nachricht als erledigt.</p>
<p>Mit freundlichen Grüßen<br>${firma?.name || ''}</p>`
}

export default router
