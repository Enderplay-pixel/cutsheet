/**
 * Auswertungen für die Firma - und die Meldung an die Künstlersozialkasse.
 *
 * Die Frage, die eine Produktionsfirma an ihre Zahlen hat, ist nicht "wie
 * viel haben wir umgesetzt", sondern "womit haben wir verdient und womit
 * nicht". Deshalb steht hier der Deckungsbeitrag je Projekt neben dem Umsatz
 * und nicht darunter.
 *
 * Alles rechnet aus den Daten, die ohnehin da sind: Rechnungen, Ausgaben,
 * Drehtage. Nichts wird doppelt gepflegt.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { erfordereAbrechnung } from './invoices'
import { schreibeCsv, cents } from '../lib/tabelle'
import {
  jahresmeldung, gewerkVorschlag, satzText, ABGABESAETZE,
  KUENSTLERISCHE_GEWERKE, type Abgabepflicht,
} from '../lib/ksk'

const router = Router()

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function zeitraum(req: Request): { von: string; bis: string } {
  const jahr = new Date().getFullYear()
  return {
    von: String(req.query.von || `${jahr}-01-01`).slice(0, 10),
    bis: String(req.query.bis || heuteISO()).slice(0, 10),
  }
}

// ─── Auswertungen ────────────────────────────────────────────────────────────

/**
 * Umsatz, Kosten und Deckungsbeitrag.
 *
 * Umsatz ist der Nettobetrag festgeschriebener Rechnungen - nicht der
 * Bruttobetrag, denn die Umsatzsteuer gehört der Firma nicht, und nicht die
 * Zahlungseingänge, denn gearbeitet wurde, als die Rechnung entstand.
 * Stornierte Rechnungen zählen nicht mit.
 */
router.get('/companies/:companyId/auswertungen', requireAuth, erfordereAbrechnung('produktion'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const { von, bis } = zeitraum(req)

  const [jeMonat, jeKunde, jeProjekt, kosten, drehtage, offen] = await Promise.all([
    db.all(
      `SELECT to_char(issue_date, 'YYYY-MM') AS monat,
              SUM(net_cents) AS netto, COUNT(*) AS anzahl
         FROM invoices
        WHERE company_id = ? AND kind = 'rechnung' AND status NOT IN ('entwurf', 'storniert')
          AND issue_date >= ? AND issue_date <= ?
        GROUP BY 1 ORDER BY 1`,
      [companyId, von, bis]
    ) as Promise<any[]>,
    db.all(
      `SELECT c.id, c.name, SUM(i.net_cents) AS netto, COUNT(*) AS anzahl
         FROM invoices i JOIN company_clients c ON i.client_id = c.id
        WHERE i.company_id = ? AND i.kind = 'rechnung' AND i.status NOT IN ('entwurf', 'storniert')
          AND i.issue_date >= ? AND i.issue_date <= ?
        GROUP BY c.id, c.name ORDER BY 3 DESC`,
      [companyId, von, bis]
    ) as Promise<any[]>,
    db.all(
      `SELECT p.id, p.title, SUM(i.net_cents) AS netto, COUNT(*) AS anzahl
         FROM invoices i JOIN projects p ON i.project_id = p.id
        WHERE i.company_id = ? AND i.kind = 'rechnung' AND i.status NOT IN ('entwurf', 'storniert')
          AND i.issue_date >= ? AND i.issue_date <= ?
        GROUP BY p.id, p.title ORDER BY 3 DESC`,
      [companyId, von, bis]
    ) as Promise<any[]>,
    // Ausgaben je Projekt - die andere Seite des Deckungsbeitrags.
    db.all(
      `SELECT e.project_id, SUM(e.amount_cents) AS summe
         FROM expenses e JOIN projects p ON e.project_id = p.id
        WHERE p.company_id = ? AND e.expense_date >= ? AND e.expense_date <= ?
        GROUP BY e.project_id`,
      [companyId, von, bis]
    ) as Promise<any[]>,
    db.all(
      // shoot_days.date ist eine Textspalte im ISO-Format - to_char gibt es
      // dafuer nicht, substring schon.
      `SELECT substring(sd.date, 1, 7) AS monat, COUNT(*) AS tage
         FROM shoot_days sd JOIN projects p ON sd.project_id = p.id
        WHERE p.company_id = ? AND sd.date >= ? AND sd.date <= ?
        GROUP BY 1 ORDER BY 1`,
      [companyId, von, bis]
    ) as Promise<any[]>,
    db.get(
      `SELECT COALESCE(SUM(gross_cents - paid_cents), 0) AS summe
         FROM invoices
        WHERE company_id = ? AND kind = 'rechnung' AND status NOT IN ('entwurf', 'storniert', 'bezahlt')`,
      [companyId]
    ) as Promise<any>,
  ])

  const kostenJeProjekt = new Map<number, number>(
    kosten.map((k) => [Number(k.project_id), Number(k.summe || 0)])
  )

  const projekte = jeProjekt.map((p) => {
    const umsatz = Number(p.netto || 0)
    const aufwand = kostenJeProjekt.get(Number(p.id)) ?? 0
    return {
      id: p.id,
      titel: p.title,
      umsatz_cents: umsatz,
      kosten_cents: aufwand,
      deckungsbeitrag_cents: umsatz - aufwand,
      // Marge in Zehntelprozent, ganzzahlig. Ohne Umsatz keine Marge - nicht
      // null Prozent, sondern gar keine Aussage.
      marge_promille: umsatz > 0 ? Math.round(((umsatz - aufwand) * 1000) / umsatz) : null,
      rechnungen: Number(p.anzahl || 0),
    }
  })

  // Projekte mit Kosten, aber ohne Rechnung - die fehlen sonst völlig, und
  // genau sie sind interessant.
  for (const [projektId, summe] of kostenJeProjekt) {
    if (projekte.some((p) => Number(p.id) === projektId)) continue
    const titel = (await db.get('SELECT title FROM projects WHERE id = ?', [projektId])) as any
    projekte.push({
      id: projektId, titel: titel?.title || `Projekt ${projektId}`,
      umsatz_cents: 0, kosten_cents: summe, deckungsbeitrag_cents: -summe,
      marge_promille: null, rechnungen: 0,
    })
  }
  projekte.sort((a, b) => b.deckungsbeitrag_cents - a.deckungsbeitrag_cents)

  const umsatz = jeMonat.reduce((s, m) => s + Number(m.netto || 0), 0)
  const aufwand = kosten.reduce((s, k) => s + Number(k.summe || 0), 0)

  return res.json({
    data: {
      von, bis,
      umsatz_cents: umsatz,
      kosten_cents: aufwand,
      deckungsbeitrag_cents: umsatz - aufwand,
      offen_cents: Number(offen?.summe ?? 0),
      je_monat: jeMonat.map((m) => ({
        monat: m.monat,
        umsatz_cents: Number(m.netto || 0),
        rechnungen: Number(m.anzahl || 0),
        drehtage: Number(drehtage.find((d) => d.monat === m.monat)?.tage ?? 0),
      })),
      // Monate mit Drehtagen, aber ohne Rechnung: Da wurde gearbeitet und
      // nicht abgerechnet.
      drehtage_ohne_umsatz: drehtage
        .filter((d) => !jeMonat.some((m) => m.monat === d.monat))
        .map((d) => ({ monat: d.monat, drehtage: Number(d.tage || 0) })),
      je_kunde: jeKunde.map((k) => ({
        id: k.id, name: k.name,
        umsatz_cents: Number(k.netto || 0),
        rechnungen: Number(k.anzahl || 0),
        anteil_promille: umsatz > 0 ? Math.round((Number(k.netto || 0) * 1000) / umsatz) : 0,
      })),
      je_projekt: projekte,
    },
    error: null,
  })
})

/** Die Auswertung als CSV. */
router.get('/companies/:companyId/auswertungen/export.csv', requireAuth, erfordereAbrechnung('produktion'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const { von, bis } = zeitraum(req)
  const zeilen = (await db.all(
    `SELECT p.title, SUM(i.net_cents) AS netto, COUNT(*) AS anzahl,
            COALESCE((SELECT SUM(amount_cents) FROM expenses e
                       WHERE e.project_id = p.id AND e.expense_date >= ? AND e.expense_date <= ?), 0) AS kosten
       FROM invoices i JOIN projects p ON i.project_id = p.id
      WHERE i.company_id = ? AND i.kind = 'rechnung' AND i.status NOT IN ('entwurf', 'storniert')
        AND i.issue_date >= ? AND i.issue_date <= ?
      GROUP BY p.id, p.title ORDER BY 2 DESC`,
    [von, bis, companyId, von, bis]
  )) as any[]

  const csv = schreibeCsv(
    ['Projekt', 'Rechnungen', 'Umsatz netto', 'Kosten', 'Deckungsbeitrag'],
    zeilen.map((z) => {
      const umsatz = Number(z.netto || 0)
      const aufwand = Number(z.kosten || 0)
      return [z.title, Number(z.anzahl || 0), cents(umsatz), cents(aufwand), cents(umsatz - aufwand)]
    })
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="auswertung-${von}-bis-${bis}.csv"`)
  return res.send(csv)
})

// ─── Künstlersozialabgabe ────────────────────────────────────────────────────

/**
 * Honorare an gekennzeichnete Personen, nach Jahr.
 *
 * Bemessungsgrundlage ist, was **gezahlt** wurde - die Kasse fragt nach dem
 * Kalenderjahr der Zahlung, nicht der Leistung. Hier wird aus den
 * Dispositionen gerechnet: Tagesgage mal Drehtage, zugeordnet nach Drehtag.
 * Das ist eine Annäherung und steht so auch in der Antwort.
 */
router.get('/companies/:companyId/ksk', requireAuth, erfordereAbrechnung('produktion'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const jahr = Number(req.query.jahr) || new Date().getFullYear() - 1
  const firma = (await db.get('SELECT ksk_art, ksk_nummer, name FROM companies WHERE id = ?', [companyId])) as any

  const personen = (await db.all(
    `SELECT 'crew' AS art, c.id, c.name, c.role AS funktion, c.fee_per_day, c.ksk_relevant,
            p.title AS projekt, p.id AS projekt_id,
            COUNT(DISTINCT sd.id) AS tage
       FROM crew c
       JOIN projects p ON c.project_id = p.id
       LEFT JOIN call_sheet_entries cse ON cse.person_type = 'crew' AND cse.person_id = c.id
       LEFT JOIN call_sheets cs ON cse.call_sheet_id = cs.id
       LEFT JOIN shoot_days sd ON cs.shoot_day_id = sd.id
            AND substring(sd.date, 1, 4) = ?
      WHERE p.company_id = ?
      GROUP BY c.id, c.name, c.role, c.fee_per_day, c.ksk_relevant, p.title, p.id
     UNION ALL
     SELECT 'cast' AS art, c.id, c.actor_name AS name, '' AS funktion, c.fee_per_day, c.ksk_relevant,
            p.title AS projekt, p.id AS projekt_id,
            COUNT(DISTINCT sd.id) AS tage
       FROM "cast" c
       JOIN projects p ON c.project_id = p.id
       LEFT JOIN call_sheet_entries cse ON cse.person_type = 'cast' AND cse.person_id = c.id
       LEFT JOIN call_sheets cs ON cse.call_sheet_id = cs.id
       LEFT JOIN shoot_days sd ON cs.shoot_day_id = sd.id
            AND substring(sd.date, 1, 4) = ?
      WHERE p.company_id = ?
      GROUP BY c.id, c.actor_name, c.fee_per_day, c.ksk_relevant, p.title, p.id`,
    [String(jahr), companyId, String(jahr), companyId]
  )) as any[]

  const mitHonorar = personen
    .map((p) => ({
      art: p.art,
      id: p.id,
      name: p.name,
      funktion: p.funktion || '',
      projekt: p.projekt,
      projekt_id: p.projekt_id,
      tage: Number(p.tage || 0),
      honorar_cents: Number(p.fee_per_day || 0) * Number(p.tage || 0),
      // true, false oder null - null heißt "noch nicht entschieden".
      ksk_relevant: p.ksk_relevant === null || p.ksk_relevant === undefined ? null : p.ksk_relevant === true,
      // Der Vorschlag ersetzt die Entscheidung nicht, er macht sie sichtbar.
      vorschlag: p.art === 'cast' ? true : gewerkVorschlag(p.funktion || ''),
    }))
    .filter((p) => p.honorar_cents > 0)

  const gezaehlt = mitHonorar.filter((p) => p.ksk_relevant === true)
  const offen = mitHonorar.filter((p) => p.ksk_relevant === null)
  const grundlage = gezaehlt.reduce((s, p) => s + p.honorar_cents, 0)

  const meldung = jahresmeldung(
    jahr, grundlage,
    (String(firma?.ksk_art || 'verwerter') as Abgabepflicht), heuteISO()
  )

  return res.json({
    data: {
      ...meldung,
      satz_text: meldung.satzHundertstel !== null ? satzText(meldung.satzHundertstel) : null,
      firma: firma?.name || '',
      ksk_art: firma?.ksk_art || 'verwerter',
      ksk_nummer: firma?.ksk_nummer || '',
      personen: mitHonorar.sort((a, b) => b.honorar_cents - a.honorar_cents),
      gezaehlt: gezaehlt.length,
      // Die wichtigste Zahl auf dieser Seite: Wie viele Personen noch
      // unentschieden sind. Solange die nicht null ist, ist die Meldung nicht
      // fertig - und zwar egal, wie plausibel die Summe aussieht.
      unentschieden: offen.length,
      unentschieden_cents: offen.reduce((s, p) => s + p.honorar_cents, 0),
      jahre_mit_satz: Object.keys(ABGABESAETZE).map(Number).sort((a, b) => b - a),
      gewerke: KUENSTLERISCHE_GEWERKE,
    },
    error: null,
  })
})

/** Eine Person als künstlerisch tätig kennzeichnen - oder ausdrücklich nicht. */
router.put('/companies/:companyId/ksk/:art/:personId', requireAuth, erfordereAbrechnung('produktion'), async (req: Request, res: Response) => {
  const art = String(req.params.art)
  const tabelle = art === 'crew' ? 'crew' : art === 'cast' ? '"cast"' : null
  if (!tabelle) return res.status(400).json({ data: null, error: 'Unbekannte Personenart' })

  // Drei Zustände: ja, nein, noch nicht entschieden. `null` ist keine
  // Abkürzung für nein.
  const wert = req.body?.ksk_relevant
  const gesetzt = wert === null ? null : wert === true

  const zeile = await db.run(
    `UPDATE ${tabelle} SET ksk_relevant = ?
      WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE company_id = ?)`,
    [gesetzt, Number(req.params.personId), Number(req.params.companyId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Person nicht gefunden' })
  return res.json({ data: { gespeichert: true, ksk_relevant: gesetzt }, error: null })
})

/** Die KSK-Einstellungen der Firma. */
router.put('/companies/:companyId/ksk/einstellungen', requireAuth, erfordereAbrechnung('inhaber'), async (req: Request, res: Response) => {
  const art = String(req.body?.ksk_art || 'verwerter')
  if (!['verwerter', 'eigenwerber'].includes(art)) {
    return res.status(400).json({ data: null, error: 'Art muss Verwerter oder Eigenwerber sein' })
  }
  await db.run(
    'UPDATE companies SET ksk_art = ?, ksk_nummer = ?, updated_at = NOW() WHERE id = ?',
    [art, String(req.body?.ksk_nummer || '').slice(0, 40), Number(req.params.companyId)]
  )
  return res.json({ data: { gespeichert: true }, error: null })
})

/** Die Aufstellung für die Meldung als CSV. */
router.get('/companies/:companyId/ksk/export.csv', requireAuth, erfordereAbrechnung('produktion'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const jahr = Number(req.query.jahr) || new Date().getFullYear() - 1

  const zeilen = (await db.all(
    `SELECT c.name, c.role AS funktion, p.title AS projekt, c.fee_per_day,
            COUNT(DISTINCT sd.id) AS tage
       FROM crew c
       JOIN projects p ON c.project_id = p.id
       LEFT JOIN call_sheet_entries cse ON cse.person_type = 'crew' AND cse.person_id = c.id
       LEFT JOIN call_sheets cs ON cse.call_sheet_id = cs.id
       LEFT JOIN shoot_days sd ON cs.shoot_day_id = sd.id AND substring(sd.date, 1, 4) = ?
      WHERE p.company_id = ? AND c.ksk_relevant = true
      GROUP BY c.id, c.name, c.role, p.title, c.fee_per_day
     UNION ALL
     SELECT c.actor_name AS name, 'Darsteller' AS funktion, p.title AS projekt, c.fee_per_day,
            COUNT(DISTINCT sd.id) AS tage
       FROM "cast" c
       JOIN projects p ON c.project_id = p.id
       LEFT JOIN call_sheet_entries cse ON cse.person_type = 'cast' AND cse.person_id = c.id
       LEFT JOIN call_sheets cs ON cse.call_sheet_id = cs.id
       LEFT JOIN shoot_days sd ON cs.shoot_day_id = sd.id AND substring(sd.date, 1, 4) = ?
      WHERE p.company_id = ? AND c.ksk_relevant = true
      GROUP BY c.id, c.actor_name, p.title, c.fee_per_day`,
    [String(jahr), companyId, String(jahr), companyId]
  )) as any[]

  const csv = schreibeCsv(
    ['Name', 'Funktion', 'Projekt', 'Tagessatz', 'Tage', 'Honorar'],
    zeilen
      .filter((z) => Number(z.tage || 0) > 0)
      .map((z) => [
        z.name, z.funktion || '', z.projekt || '',
        cents(Number(z.fee_per_day || 0)), Number(z.tage || 0),
        cents(Number(z.fee_per_day || 0) * Number(z.tage || 0)),
      ])
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="ksk-${jahr}.csv"`)
  return res.send(csv)
})

export default router
