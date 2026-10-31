/**
 * Projektabschluss.
 *
 * Ein Dreh ist irgendwann vorbei, aber ein Projekt ist es damit nicht. Was
 * danach kommt, vergisst man zuverlässig: die letzte Rechnung, der Vertrag,
 * den nie jemand bestätigt hat, die Abnahme ohne Entscheidung, die Reise, die
 * niemand abgerechnet hat.
 *
 * Diese Datei zählt zusammen, was noch offen ist - aus den Daten, die ohnehin
 * da sind. Sie erledigt nichts von selbst und schließt nichts von selbst ab.
 *
 * ## Zur Aufbewahrung
 *
 * Diese Datei löscht **nichts** und schlägt auch keine Löschung vor. Die
 * steuerlichen Aufbewahrungsfristen sind derzeit nicht eindeutig: Für
 * Rechnungen und Buchungsbelege nennen die Quellen acht Jahre (Paragraf 147
 * Absatz 3 AO in der Fassung des Bürokratieentlastungsgesetzes IV) und
 * zehn Jahre nebeneinander. Was hier steht, ist deshalb ein Hinweis mit
 * Quelle - keine Frist, nach der etwas verschwindet.
 *
 * Wer löschen will, nutzt die Werkzeuge unter Datenschutz. Dort steht, was
 * eine betroffene Person verlangen kann, und dort wird einzeln entschieden.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { logAudit } from './audit'
import { euro } from '../lib/rechnung'
import { heuteISO } from '../lib/datum'

const router = Router()

/**
 * Kinder ohne Bewilligung nach Paragraf 6 JArbSchG - Kind ist, wer noch nicht
 * 15 ist (Paragraf 2).
 *
 * Besetzung und Komparserie, wie die Jugendschutz-Seite. Bis zum 24.10.2026
 * zaehlte der Abschluss nur die Besetzung: Eine elfjaehrige Komparsin ohne
 * Bewilligung stand auf der Jugendschutz-Seite, der Abschluss meldete 0 und
 * liess das Projekt schliessen. Eine Abfrage fuer Anzeige und Abschluss,
 * damit die beiden nicht wieder auseinanderlaufen.
 */
const KINDER_OHNE_BEWILLIGUNG = `
  SELECT (SELECT COUNT(*) FROM "cast"
           WHERE project_id = ? AND birthdate IS NOT NULL AND permit_granted = false
             AND birthdate > (CURRENT_DATE - INTERVAL '15 years'))
       + (SELECT COUNT(*) FROM extras
           WHERE project_id = ? AND birthdate IS NOT NULL AND permit_granted = false
             AND birthdate > (CURRENT_DATE - INTERVAL '15 years'))
       AS anzahl`

export type Punkt = {
  schluessel: string
  titel: string
  /** Wie viele es sind. 0 heißt: erledigt. */
  anzahl: number
  /** Ein Satz, der sagt, worum es geht. */
  text: string
  /** Wohin man klickt, relativ zum Projekt. */
  pfad: string
  /** Ob der Punkt einem Abschluss entgegensteht oder nur offen ist. */
  blockiert: boolean
}

/**
 * Was vor dem Abschluss noch offen ist.
 *
 * Alles in einer Abfrage je Quelle. Ein Projekt mit vierzig Drehtagen und
 * hundert Beteiligten darf diese Seite nicht langsam machen - sonst sieht sie
 * niemand an.
 */
router.get('/projects/:projectId/abschluss', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const heute = heuteISO()

  const projekt = (await db.get(
    'SELECT id, title, status, archived, company_id FROM projects WHERE id = ?', [projectId]
  )) as any
  if (!projekt) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const [rechnungen, vertraege, abnahmen, reisen, bewilligungen, ksk, anfragen, fristen] =
    await Promise.all([
      db.get(
        `SELECT COUNT(*) AS anzahl, COALESCE(SUM(gross_cents - paid_cents), 0) AS offen
           FROM invoices
          WHERE project_id = ? AND kind = 'rechnung'
            AND status NOT IN ('entwurf', 'storniert', 'bezahlt')`,
        [projectId]
      ) as Promise<any>,
      db.get(
        "SELECT COUNT(*) AS anzahl FROM contracts WHERE project_id = ? AND status = 'versendet'",
        [projectId]
      ) as Promise<any>,
      db.get(
        `SELECT COUNT(*) AS anzahl FROM reviews
          WHERE project_id = ? AND status IN ('entwurf', 'versendet', 'nachbesserung')`,
        [projectId]
      ) as Promise<any>,
      db.get(
        "SELECT COUNT(*) AS anzahl FROM trips WHERE project_id = ? AND status = 'entwurf'",
        [projectId]
      ) as Promise<any>,
      db.get(KINDER_OHNE_BEWILLIGUNG, [projectId, projectId]) as Promise<any>,
      db.get(
        `SELECT (SELECT COUNT(*) FROM crew WHERE project_id = ? AND ksk_relevant IS NULL AND fee_per_day > 0)
              + (SELECT COUNT(*) FROM "cast" WHERE project_id = ? AND ksk_relevant IS NULL AND fee_per_day > 0)
              AS anzahl`,
        [projectId, projectId]
      ) as Promise<any>,
      db.get(
        "SELECT COUNT(*) AS anzahl FROM casting_requests WHERE project_id = ? AND status = 'versendet'",
        [projectId]
      ) as Promise<any>,
      db.get(
        `SELECT COUNT(*) AS anzahl FROM project_files
          WHERE project_id = ? AND valid_until IS NOT NULL AND valid_until < ?`,
        [projectId, heute]
      ) as Promise<any>,
    ])

  const zahl = (z: any) => Number(z?.anzahl ?? 0)
  const offenCents = Number(rechnungen?.offen ?? 0)

  const punkte: Punkt[] = [
    {
      schluessel: 'rechnungen',
      titel: 'Rechnungen offen',
      anzahl: zahl(rechnungen),
      text: zahl(rechnungen) > 0
        ? `${euro(offenCents)} stehen noch aus. Ein Projekt, das abgeschlossen ist, bevor das Geld da ist, wird nicht mehr nachverfolgt.`
        : 'Alles bezahlt.',
      pfad: `/firma/${projekt.company_id ?? 0}/offene-posten`,
      // Offenes Geld steht einem Abschluss wirklich entgegen.
      blockiert: true,
    },
    {
      schluessel: 'vertraege',
      titel: 'Verträge ohne Bestätigung',
      anzahl: zahl(vertraege),
      text: 'Verschickt, aber nie bestätigt. Ohne Zustimmung fehlt der Beleg dafür, was vereinbart war.',
      pfad: `/projects/${projectId}/vertraege`,
      blockiert: true,
    },
    {
      schluessel: 'abnahmen',
      titel: 'Abnahmen ohne Entscheidung',
      anzahl: zahl(abnahmen),
      text: 'Solange nicht abgenommen ist, ist die Schlussrechnung angreifbar.',
      pfad: `/projects/${projectId}/abnahme`,
      blockiert: true,
    },
    {
      schluessel: 'bewilligungen',
      titel: 'Kinder ohne Bewilligung',
      anzahl: zahl(bewilligungen),
      text: 'Nach § 6 JArbSchG darf ohne Bewilligung nicht gedreht werden. Für die Akte gehört sie nachgereicht.',
      pfad: `/projects/${projectId}/vertraege`,
      blockiert: true,
    },
    {
      schluessel: 'reisen',
      titel: 'Reisen nicht abgerechnet',
      anzahl: zahl(reisen),
      text: 'Noch im Entwurf. Was nicht abgerechnet ist, zahlt am Ende die Produktion.',
      pfad: `/projects/${projectId}/reise`,
      blockiert: false,
    },
    {
      schluessel: 'ksk',
      titel: 'KSK nicht entschieden',
      anzahl: zahl(ksk),
      text: 'Ob jemand künstlerisch tätig war, entscheidet über die Jahresmeldung - und die kommt nach dem Projekt.',
      pfad: `/firma/${projekt.company_id ?? 0}/auswertungen`,
      blockiert: false,
    },
    {
      schluessel: 'anfragen',
      titel: 'Besetzungsanfragen offen',
      anzahl: zahl(anfragen),
      text: 'Agenturen warten auf eine Antwort - auch eine Absage ist eine.',
      pfad: `/projects/${projectId}/agenturen`,
      blockiert: false,
    },
    {
      schluessel: 'fristen',
      titel: 'Abgelaufene Nachweise',
      anzahl: zahl(fristen),
      text: 'Genehmigungen oder Versicherungen, deren Gültigkeit vorbei ist. Für die Akte ist das in Ordnung - prüfen, ob es das war.',
      pfad: `/projects/${projectId}/ablage`,
      blockiert: false,
    },
  ]

  const offen = punkte.filter((p) => p.anzahl > 0)
  const blockierend = offen.filter((p) => p.blockiert)

  return res.json({
    data: {
      projekt: { id: projekt.id, titel: projekt.title, status: projekt.status, archiviert: !!projekt.archived },
      punkte,
      offen: offen.length,
      blockierend: blockierend.length,
      // `true` heißt nur: Es spricht nichts Erkennbares dagegen. Nicht, dass
      // alles erledigt ist - das weiß nur, wer am Projekt gearbeitet hat.
      bereit: blockierend.length === 0,
      aufbewahrung: AUFBEWAHRUNG,
    },
    error: null,
  })
})

/**
 * Was wie lange aufzuheben ist.
 *
 * **Keine Rechtsauskunft und keine Frist, nach der etwas verschwindet.** Die
 * Angaben widersprechen sich derzeit in den Quellen: Für Rechnungen und
 * Buchungsbelege werden acht Jahre (Paragraf 147 Absatz 3 AO in der Fassung
 * des Bürokratieentlastungsgesetzes IV, ab 1.1.2025) und zehn Jahre
 * nebeneinander genannt.
 *
 * Deshalb steht hier beides mit dem Hinweis, dass es zu klären ist - und
 * nichts wird automatisch gelöscht. Eine Software, die steuerrelevante Belege
 * nach einer Zahl entfernt, die ein Entwickler einmal nachgesehen hat, ist
 * gefährlicher als gar keine.
 */
export const AUFBEWAHRUNG = {
  hinweis: 'Keine Rechtsauskunft. Nichts wird automatisch gelöscht. Die Fristen für '
    + 'Rechnungen und Buchungsbelege werden derzeit mit acht und mit zehn Jahren '
    + 'angegeben - vor dem Löschen mit der Kanzlei klären.',
  posten: [
    {
      was: 'Rechnungen und Buchungsbelege',
      frist: '8 oder 10 Jahre',
      grundlage: '§ 147 Abs. 3 AO, § 14b UStG - die Quellen sind uneinheitlich',
      unsicher: true,
    },
    {
      was: 'Bücher, Inventare, Jahresabschlüsse',
      frist: '10 Jahre',
      grundlage: '§ 147 Abs. 3 AO',
      unsicher: false,
    },
    {
      was: 'Geschäftsbriefe, auch Mails',
      frist: '6 Jahre',
      grundlage: '§ 147 Abs. 3 AO',
      unsicher: false,
    },
    {
      was: 'Verträge mit Cast und Crew',
      frist: 'solange Ansprüche daraus möglich sind',
      grundlage: 'regelmäßige Verjährung 3 Jahre, §§ 195, 199 BGB - bei Nutzungsrechten länger',
      unsicher: true,
    },
    {
      was: 'Personenbezogene Daten ohne Aufbewahrungspflicht',
      frist: 'nicht länger als nötig',
      grundlage: 'Art. 5 Abs. 1 lit. e DSGVO - siehe Datenschutz-Werkzeuge',
      unsicher: false,
    },
  ],
}

/**
 * Das Projekt abschließen.
 *
 * Setzt den Status und archiviert. Blockierende Punkte lassen sich übergehen,
 * aber nur ausdrücklich - wer `trotzdem` schickt, hat sie gesehen.
 */
router.post('/projects/:projectId/abschluss', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const projekt = (await db.get('SELECT id, title, status FROM projects WHERE id = ?', [projectId])) as any
  if (!projekt) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  if (req.body?.trotzdem !== true) {
    // Dieselbe Rechnung wie oben, nur die blockierenden Punkte. Doppelt
    // geprüft, weil zwischen Ansehen und Abschließen Zeit vergeht.
    const [rechnungen, vertraege, abnahmen, bewilligungen] = await Promise.all([
      db.get(
        `SELECT COUNT(*) AS anzahl FROM invoices
          WHERE project_id = ? AND kind = 'rechnung'
            AND status NOT IN ('entwurf', 'storniert', 'bezahlt')`,
        [projectId]
      ) as Promise<any>,
      db.get("SELECT COUNT(*) AS anzahl FROM contracts WHERE project_id = ? AND status = 'versendet'",
        [projectId]) as Promise<any>,
      db.get(
        `SELECT COUNT(*) AS anzahl FROM reviews
          WHERE project_id = ? AND status IN ('entwurf', 'versendet', 'nachbesserung')`,
        [projectId]
      ) as Promise<any>,
      db.get(KINDER_OHNE_BEWILLIGUNG, [projectId, projectId]) as Promise<any>,
    ])
    const summe = [rechnungen, vertraege, abnahmen, bewilligungen]
      .reduce((s, z) => s + Number(z?.anzahl ?? 0), 0)
    if (summe > 0) {
      return res.status(400).json({
        data: { blockierend: summe },
        error: `${summe} ${summe === 1 ? 'Punkt steht' : 'Punkte stehen'} dem Abschluss entgegen. `
          + 'Zum Abschließen trotzdem bestätigen.',
      })
    }
  }

  await db.run(
    "UPDATE projects SET status = 'Abgeschlossen', archived = 1 WHERE id = ?", [projectId]
  )
  logAudit(projectId, (req as any).user as AuthUser, 'projekt abgeschlossen', 'projects', projectId,
    { status: projekt.status }, { status: 'Abgeschlossen', trotzdem: req.body?.trotzdem === true })

  return res.json({ data: { status: 'Abgeschlossen', archiviert: true }, error: null })
})

/**
 * Den Abschluss zurücknehmen - ein Projekt kann wieder aufgehen.
 *
 * Mit dem Status von vor dem Abschluss (steht im Protokoll). Vorher wurde
 * immer "Postproduktion" gesetzt - gemessen am 31.10.2026: ein versehentlich
 * abgeschlossenes Projekt aus der Vorproduktion kam als Postproduktion
 * zurück. Nur ein abgeschlossenes Projekt lässt sich wieder öffnen.
 */
router.post('/projects/:projectId/abschluss/zuruecknehmen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const projekt = await db.get('SELECT status FROM projects WHERE id = ?', [projectId]) as any
  if (!projekt) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })
  if (projekt.status !== 'Abgeschlossen') {
    return res.status(409).json({ data: null, error: 'Das Projekt ist nicht abgeschlossen' })
  }
  const eintrag = await db.get(
    `SELECT old_value FROM audit_log
      WHERE project_id = ? AND action = 'projekt abgeschlossen'
      ORDER BY id DESC LIMIT 1`,
    [projectId]
  ) as any
  let vorher = 'Postproduktion'
  try {
    const status = JSON.parse(eintrag?.old_value ?? 'null')?.status
    if (typeof status === 'string' && status && status !== 'Abgeschlossen') vorher = status
  } catch { /* unlesbarer Eintrag: Postproduktion bleibt */ }

  await db.run('UPDATE projects SET status = ?, archived = 0 WHERE id = ?', [vorher, projectId])
  logAudit(projectId, (req as any).user as AuthUser, 'abschluss zurückgenommen', 'projects', projectId,
    { status: 'Abgeschlossen' }, { status: vorher })
  return res.json({ data: { status: vorher, archiviert: false }, error: null })
})

export default router
