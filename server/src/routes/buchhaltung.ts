/**
 * Die Übergabe an die Buchhaltung.
 *
 * Zwei Wege, weil es zwei Situationen gibt. Der eine ist eine Tabelle, die
 * jeder lesen kann - die geht immer. Der andere ist ein DATEV-Buchungsstapel,
 * der dem Steuerberater das Abtippen erspart, aber Angaben braucht, die nur
 * die Kanzlei hat.
 *
 * Deshalb hier derselbe Aufbau wie beim Mahnlauf: Erst eine Prüfung, die
 * sagt, was fehlt, dann die Datei. Ein Export, der stillschweigend eine
 * erfundene Debitorennummer einsetzt, richtet in einer Buchhaltung mehr
 * Schaden an als ein Export, der nicht zustande kommt.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { erfordereAbrechnung } from './invoices'
import { schreibeCsv, cents } from '../lib/tabelle'
import {
  datevStapel, datevKodieren, erloeskonto, ERLOESKONTEN,
  type Buchung, type Kontenrahmen,
} from '../lib/buchhaltung'

const router = Router()

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Zeitraum aus der Abfrage, mit dem laufenden Jahr als Rückfall. */
function zeitraum(req: Request): { von: string; bis: string } {
  const jahr = new Date().getFullYear()
  const von = String(req.query.von || `${jahr}-01-01`).slice(0, 10)
  const bis = String(req.query.bis || heuteISO()).slice(0, 10)
  return { von, bis }
}

/**
 * Die Rechnungen eines Zeitraums samt Positionen.
 *
 * Entwürfe bleiben draußen - ein Entwurf ist kein Geschäftsvorfall. Stornos
 * kommen mit: Eine stornierte Rechnung ist gebucht worden und wird
 * ausgebucht, sie verschwindet nicht.
 */
async function rechnungenLaden(companyId: number, von: string, bis: string) {
  const rechnungen = (await db.all(
    `SELECT i.*, c.name AS client_name, c.debitor_number, c.vat_id AS client_vat_id,
            p.title AS project_title
       FROM invoices i
       LEFT JOIN company_clients c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.company_id = ?
        AND i.kind = 'rechnung'
        AND i.status <> 'entwurf'
        AND i.issue_date >= ? AND i.issue_date <= ?
      ORDER BY i.issue_date ASC, i.number ASC`,
    [companyId, von, bis]
  )) as any[]
  if (rechnungen.length === 0) return { rechnungen, positionen: new Map<number, any[]>() }

  // Eine Abfrage für alle Positionen, nicht eine je Rechnung.
  const alle = (await db.all(
    `SELECT it.* FROM invoice_items it
       JOIN invoices i ON it.invoice_id = i.id
      WHERE i.company_id = ? AND i.issue_date >= ? AND i.issue_date <= ?
      ORDER BY it.sort_order ASC`,
    [companyId, von, bis]
  )) as any[]
  const positionen = new Map<number, any[]>()
  for (const p of alle) {
    const liste = positionen.get(p.invoice_id)
    if (liste) liste.push(p)
    else positionen.set(p.invoice_id, [p])
  }
  return { rechnungen, positionen }
}

// ─── Der einfache Export ─────────────────────────────────────────────────────

/**
 * Alle Rechnungen eines Zeitraums als Tabelle.
 *
 * Eine Zeile je Steuersatz und Rechnung, weil die Umsatzsteuer je Satz
 * getrennt gemeldet wird. Eine Rechnung mit 19 und 7 Prozent ergibt also zwei
 * Zeilen - das ist keine Doppelung, sondern die Form, in der es gebucht wird.
 */
router.get('/companies/:companyId/buchhaltung/export.csv', requireAuth, erfordereAbrechnung('produktion'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const { von, bis } = zeitraum(req)
  const { rechnungen, positionen } = await rechnungenLaden(companyId, von, bis)

  const zeilen: Array<Array<string | number>> = []
  for (const r of rechnungen) {
    const eigene = positionen.get(r.id) ?? []
    // Nach Steuersatz zusammenfassen
    const jeSatz = new Map<number, number>()
    for (const p of eigene) {
      const netto = Math.round((Number(p.quantity_milli) * Number(p.unit_price_cents)) / 1000)
      const satz = Number(p.tax_percent ?? 0)
      jeSatz.set(satz, (jeSatz.get(satz) ?? 0) + netto)
    }
    if (jeSatz.size === 0) jeSatz.set(0, 0)

    for (const [satz, netto] of [...jeSatz.entries()].sort((a, b) => b[0] - a[0])) {
      const steuer = r.tax_mode === 'regel' ? Math.round((netto * satz) / 100) : 0
      zeilen.push([
        String(r.issue_date || '').slice(0, 10),
        r.number || '',
        r.client_name || '',
        r.debitor_number || '',
        r.project_title || '',
        satz,
        cents(netto),
        cents(steuer),
        cents(netto + steuer),
        r.status === 'storniert' ? 'storniert' : r.status,
        String(r.due_date || '').slice(0, 10),
        cents(Number(r.paid_cents || 0)),
      ])
    }
  }

  const csv = schreibeCsv(
    ['Belegdatum', 'Rechnungsnummer', 'Auftraggeber', 'Debitor', 'Projekt',
      'Steuersatz %', 'Netto', 'Umsatzsteuer', 'Brutto', 'Status', 'Fällig', 'Bezahlt'],
    zeilen
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="buchhaltung-${von}-bis-${bis}.csv"`)
  return res.send(csv)
})

// ─── DATEV ───────────────────────────────────────────────────────────────────

/** Die Buchungen eines Zeitraums - und was dem Export noch fehlt. */
async function buchungenBauen(companyId: number, von: string, bis: string) {
  const firma = (await db.get('SELECT * FROM companies WHERE id = ?', [companyId])) as any
  const rahmen = (String(firma?.datev_kontenrahmen || 'SKR03') as Kontenrahmen) in ERLOESKONTEN
    ? (String(firma?.datev_kontenrahmen || 'SKR03') as Kontenrahmen)
    : 'SKR03'
  const { rechnungen, positionen } = await rechnungenLaden(companyId, von, bis)

  const fehlt: string[] = []
  if (!firma?.datev_berater) fehlt.push('Beraternummer der Kanzlei')
  if (!firma?.datev_mandant) fehlt.push('Mandantennummer')

  const ohneDebitor = new Set<string>()
  const buchungen: Buchung[] = []

  for (const r of rechnungen) {
    const debitor = String(r.debitor_number || '').trim()
    if (!debitor) {
      ohneDebitor.add(r.client_name || `Auftraggeber #${r.client_id}`)
      continue
    }
    const eigene = positionen.get(r.id) ?? []
    const jeSatz = new Map<number, number>()
    for (const p of eigene) {
      const netto = Math.round((Number(p.quantity_milli) * Number(p.unit_price_cents)) / 1000)
      const satz = Number(p.tax_percent ?? 0)
      jeSatz.set(satz, (jeSatz.get(satz) ?? 0) + netto)
    }

    for (const [satz, netto] of [...jeSatz.entries()].sort((a, b) => b[0] - a[0])) {
      const steuer = r.tax_mode === 'regel' ? Math.round((netto * satz) / 100) : 0
      const brutto = netto + steuer
      if (brutto === 0) continue
      buchungen.push({
        betragCents: Math.abs(brutto),
        // Eine Erlösbuchung steht im Soll auf dem Debitor: Der Auftraggeber
        // schuldet. Beim Storno kehrt sich die Richtung um.
        sollHaben: r.status === 'storniert' ? 'H' : 'S',
        konto: debitor,
        gegenkonto: erloeskonto(rahmen, satz, String(r.tax_mode || 'regel')),
        datum: String(r.issue_date || von).slice(0, 10),
        belegfeld1: String(r.number || ''),
        text: [r.client_name, r.project_title].filter(Boolean).join(' / ') || 'Rechnung',
      })
    }
  }

  if (ohneDebitor.size > 0) {
    fehlt.push(`Debitorennummer für: ${[...ohneDebitor].join(', ')}`)
  }
  return { firma, rahmen, buchungen, fehlt, anzahlRechnungen: rechnungen.length }
}

/**
 * Die Prüfung vor dem Export.
 *
 * Sagt, wie viele Buchungen entstehen würden und was dafür noch fehlt. Diese
 * Route löst nichts aus und kann gefahrlos aufgerufen werden.
 */
router.get('/companies/:companyId/buchhaltung/datev/pruefung', requireAuth, erfordereAbrechnung('produktion'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const { von, bis } = zeitraum(req)
  const { firma, rahmen, buchungen, fehlt, anzahlRechnungen } = await buchungenBauen(companyId, von, bis)

  return res.json({
    data: {
      von, bis,
      kontenrahmen: rahmen,
      sachkontenlaenge: Number(firma?.datev_sachkontenlaenge ?? 4),
      berater: firma?.datev_berater ?? null,
      mandant: firma?.datev_mandant ?? null,
      rechnungen: anzahlRechnungen,
      buchungen: buchungen.length,
      summe_cents: buchungen.reduce((s, b) => s + (b.sollHaben === 'S' ? b.betragCents : -b.betragCents), 0),
      erloeskonten: ERLOESKONTEN[rahmen],
      fehlt,
      bereit: fehlt.length === 0 && buchungen.length > 0,
      // Dieser Satz steht in der Oberflaeche ueber dem Knopf. Er gehoert dort
      // hin, bis der erste Probeimport in der Kanzlei gelaufen ist.
      hinweis: 'Der Stapel enthält die Erlösbuchungen der Rechnungen, keine '
        + 'Zahlungseingänge - für die braucht die Kanzlei ihr eigenes Finanzkonto. '
        + 'Er wird ohne Festschreibung erzeugt und lässt sich in DATEV ansehen und '
        + 'verwerfen. Bitte einmal probeweise einlesen, bevor er in die laufende '
        + 'Buchhaltung geht.',
    },
    error: null,
  })
})

/** Der Buchungsstapel als Datei. */
router.get('/companies/:companyId/buchhaltung/datev', requireAuth, erfordereAbrechnung('produktion'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const { von, bis } = zeitraum(req)
  const { firma, buchungen, fehlt } = await buchungenBauen(companyId, von, bis)

  if (fehlt.length > 0) {
    return res.status(400).json({
      data: null,
      error: `Für den DATEV-Export fehlt noch: ${fehlt.join('; ')}`,
    })
  }
  if (buchungen.length === 0) {
    return res.status(400).json({ data: null, error: 'In diesem Zeitraum gibt es keine Buchungen' })
  }

  const inhalt = datevStapel(
    {
      berater: Number(firma.datev_berater),
      mandant: Number(firma.datev_mandant),
      // Das Wirtschaftsjahr beginnt am 1. Januar des Jahres, in dem der
      // Zeitraum liegt. Ein abweichendes Wirtschaftsjahr kommt bei
      // Produktionsfirmen praktisch nicht vor.
      wjBeginn: `${von.slice(0, 4)}-01-01`,
      sachkontenlaenge: Number(firma.datev_sachkontenlaenge ?? 4),
      von, bis,
      bezeichnung: `${firma.name || 'Rechnungen'} ${von} bis ${bis}`,
      exportiertVon: 'CutSheet',
    },
    buchungen
  )

  res.setHeader('Content-Type', 'text/csv; charset=windows-1252')
  res.setHeader('Content-Disposition', `attachment; filename="EXTF_Buchungsstapel_${von}_${bis}.csv"`)
  return res.send(datevKodieren(inhalt))
})

/** Die Buchhaltungsangaben der Firma setzen. */
router.put('/companies/:companyId/buchhaltung/einstellungen', requireAuth, erfordereAbrechnung('inhaber'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const rahmen = String(req.body?.datev_kontenrahmen || 'SKR03')
  if (!(rahmen in ERLOESKONTEN)) {
    return res.status(400).json({ data: null, error: 'Kontenrahmen muss SKR03 oder SKR04 sein' })
  }
  const laenge = Number(req.body?.datev_sachkontenlaenge ?? 4)
  if (![4, 5, 6, 7, 8].includes(laenge)) {
    return res.status(400).json({ data: null, error: 'Die Sachkontenlänge liegt zwischen 4 und 8' })
  }
  const zahlOderNull = (wert: any) => {
    const n = Number(wert)
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
  }
  await db.run(
    `UPDATE companies SET datev_berater = ?, datev_mandant = ?,
       datev_sachkontenlaenge = ?, datev_kontenrahmen = ?,
       base_rate_bp = ?, base_rate_date = ?, dunning_enabled = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      zahlOderNull(req.body?.datev_berater),
      zahlOderNull(req.body?.datev_mandant),
      laenge, rahmen,
      Math.trunc(Number(req.body?.base_rate_bp ?? 0)) || 0,
      req.body?.base_rate_date ? String(req.body.base_rate_date).slice(0, 10) : null,
      req.body?.dunning_enabled !== false,
      companyId,
    ]
  )
  const firma = await db.get(
    `SELECT datev_berater, datev_mandant, datev_sachkontenlaenge, datev_kontenrahmen,
            base_rate_bp, base_rate_date, dunning_enabled FROM companies WHERE id = ?`,
    [companyId]
  )
  return res.json({ data: firma, error: null })
})

export default router
