/**
 * Was anliegt.
 *
 * Die Anwendung erzeugt inzwischen an einem Dutzend Stellen Verpflichtungen:
 * ein Vertrag, auf den niemand geantwortet hat; eine Bewilligung, die fehlt;
 * eine Rechnung, die überfällig ist; eine Agentur, die nicht zurückschreibt.
 * Jede dieser Stellen hat ihre eigene Seite, und keine davon sieht man, wenn
 * man gerade woanders ist.
 *
 * Diese Datei sammelt sie an einem Ort - nicht als Nachrichtenstrom, sondern
 * als Liste offener Punkte, die kürzer wird, wenn man sie abarbeitet.
 *
 * ## Was hier nicht passiert
 *
 * Es wird nichts verschickt und nichts verändert. Die Liste rechnet nur. Wer
 * nachfassen will, tut das auf der Seite, zu der der Punkt gehört - dort steht
 * der Zusammenhang, hier nur der Hinweis.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { erfordereFirma } from './companies'
import { tageZwischen } from '../lib/mahnwesen'
import { alterAm, KIND_BIS_ALTER } from '../lib/jugendschutz'

const router = Router()

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export type Punkt = {
  /** Woher der Punkt kommt - für das Symbol und die Gruppierung. */
  art: 'vertrag' | 'bewilligung' | 'rechnung' | 'casting' | 'ksk' | 'mail'
  /** 'dringend' sperrt etwas oder kostet Geld. 'offen' will nur erledigt werden. */
  stufe: 'dringend' | 'offen'
  titel: string
  /** Ein Satz, der sagt, was zu tun ist. */
  text: string
  /** Wohin man klickt. Relativ, ohne führenden Schrägstrich-Präfix der App. */
  pfad: string
  /** Seit wie vielen Tagen, falls das zählt. */
  tage?: number
}

/**
 * Alle offenen Punkte einer Firma.
 *
 * Eine Abfrage je Quelle, nicht eine je Projekt: Bei zwanzig Projekten wäre
 * das sonst der N+1-Fehler aus Runde 8, nur an neuer Stelle.
 */
router.get('/companies/:companyId/anliegen', requireAuth, erfordereFirma('mitarbeiter'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const heute = heuteISO()
  const punkte: Punkt[] = []

  const [vertraege, kinder, rechnungen, anfragen, ksk, mails] = await Promise.all([
    // Verträge, auf die seit mehr als fünf Tagen niemand geantwortet hat.
    db.all(
      `SELECT c.id, c.title, c.project_id, c.sent_at, p.title AS projekt
         FROM contracts c JOIN projects p ON c.project_id = p.id
        WHERE p.company_id = ? AND c.status = 'versendet'
        ORDER BY c.sent_at ASC`,
      [companyId]
    ) as Promise<any[]>,
    // Kinder ohne Bewilligung, die auf einer Disposition stehen.
    db.all(
      `SELECT DISTINCT c.id, c.actor_name, c.birthdate, c.permit_granted, c.project_id, p.title AS projekt,
              (SELECT MIN(sd.date) FROM call_sheet_entries cse
                 JOIN call_sheets cs ON cse.call_sheet_id = cs.id
                 JOIN shoot_days sd ON cs.shoot_day_id = sd.id
                WHERE cse.person_type = 'cast' AND cse.person_id = c.id
                  AND sd.project_id = c.project_id) AS erster_tag
         FROM "cast" c JOIN projects p ON c.project_id = p.id
        WHERE p.company_id = ? AND c.birthdate IS NOT NULL AND c.permit_granted = false`,
      [companyId]
    ) as Promise<any[]>,
    db.all(
      `SELECT id, number, due_date, gross_cents, paid_cents, reminder_level, client_id
         FROM invoices
        WHERE company_id = ? AND kind = 'rechnung'
          AND status NOT IN ('entwurf', 'storniert', 'bezahlt')
          AND due_date IS NOT NULL AND due_date < ?
        ORDER BY due_date ASC`,
      [companyId, heute]
    ) as Promise<any[]>,
    db.all(
      `SELECT r.id, r.project_id, r.deadline, r.sent_at, r.reminded_at, a.name AS agentur, p.title AS projekt
         FROM casting_requests r
         JOIN projects p ON r.project_id = p.id
         LEFT JOIN agencies a ON r.agency_id = a.id
        WHERE p.company_id = ? AND r.status = 'versendet'
        ORDER BY r.sent_at ASC`,
      [companyId]
    ) as Promise<any[]>,
    // Unentschiedene KSK-Fälle, über alle Projekte der Firma.
    db.get(
      `SELECT (SELECT COUNT(*) FROM crew c JOIN projects p ON c.project_id = p.id
                WHERE p.company_id = ? AND c.ksk_relevant IS NULL AND c.fee_per_day > 0)
            + (SELECT COUNT(*) FROM "cast" c JOIN projects p ON c.project_id = p.id
                WHERE p.company_id = ? AND c.ksk_relevant IS NULL AND c.fee_per_day > 0) AS anzahl`,
      [companyId, companyId]
    ) as Promise<any>,
    // Mails, die hängen geblieben sind.
    db.get(
      `SELECT COUNT(*) AS anzahl FROM email_outbox o
         LEFT JOIN projects p ON o.project_id = p.id
        WHERE (p.company_id = ? OR o.project_id IS NULL) AND o.status = 'fehlgeschlagen'`,
      [companyId]
    ) as Promise<any>,
  ])

  for (const v of vertraege) {
    const tage = v.sent_at ? tageZwischen(String(v.sent_at).slice(0, 10), heute) : 0
    if (tage < 5) continue
    punkte.push({
      art: 'vertrag',
      stufe: tage >= 14 ? 'dringend' : 'offen',
      titel: `${v.title} - keine Antwort`,
      text: `Seit ${tage} Tagen verschickt und nicht bestätigt. ${v.projekt}.`,
      pfad: `/projects/${v.project_id}/vertraege`,
      tage,
    })
  }

  for (const k of kinder) {
    const alter = alterAm(String(k.birthdate).slice(0, 10), heute)
    if (alter >= KIND_BIS_ALTER) continue
    const tage = k.erster_tag ? tageZwischen(heute, String(k.erster_tag).slice(0, 10)) : null
    punkte.push({
      art: 'bewilligung',
      // Ohne Bewilligung darf nicht gedreht werden - das ist nie nur "offen".
      stufe: 'dringend',
      titel: `${k.actor_name}: Bewilligung fehlt`,
      text: tage === null
        ? `${alter} Jahre, steht auf keiner Disposition. Ohne Bewilligung nach § 6 JArbSchG darf nicht gedreht werden.`
        : tage < 0
          ? `${alter} Jahre, erster Drehtag war vor ${-tage} Tagen - ohne Bewilligung.`
          : `${alter} Jahre, erster Drehtag in ${tage} Tagen. Der Antrag braucht ein bis zwei Wochen.`,
      pfad: `/projects/${k.project_id}/vertraege`,
      tage: tage ?? undefined,
    })
  }

  for (const r of rechnungen) {
    const offen = Number(r.gross_cents || 0) - Number(r.paid_cents || 0)
    if (offen <= 0) continue
    const tage = tageZwischen(String(r.due_date).slice(0, 10), heute)
    punkte.push({
      art: 'rechnung',
      stufe: tage >= 30 ? 'dringend' : 'offen',
      titel: `Rechnung ${r.number} überfällig`,
      text: `${tage} Tage über der Frist, ${(offen / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} offen.`
        + (Number(r.reminder_level || 0) > 0 ? ` Zuletzt Stufe ${r.reminder_level}.` : ' Noch nicht gemahnt.'),
      pfad: `/firma/${companyId}/offene-posten`,
      tage,
    })
  }

  for (const a of anfragen) {
    const tage = a.sent_at ? tageZwischen(String(a.sent_at).slice(0, 10), heute) : 0
    const fristVorbei = a.deadline ? String(a.deadline).slice(0, 10) < heute : false
    if (!fristVorbei && tage < 7) continue
    punkte.push({
      art: 'casting',
      stufe: fristVorbei ? 'dringend' : 'offen',
      titel: `${a.agentur || 'Agentur'} hat nicht geantwortet`,
      text: fristVorbei
        ? `Die Frist war am ${new Date(a.deadline).toLocaleDateString('de-DE')}. ${a.projekt}.`
        : `Seit ${tage} Tagen offen.${a.reminded_at ? ' Bereits nachgefasst.' : ' Noch nicht nachgefasst.'} ${a.projekt}.`,
      pfad: `/projects/${a.project_id}/agenturen`,
      tage,
    })
  }

  const kskOffen = Number(ksk?.anzahl ?? 0)
  if (kskOffen > 0) {
    punkte.push({
      art: 'ksk',
      stufe: 'offen',
      titel: `${kskOffen} ${kskOffen === 1 ? 'Person' : 'Personen'} ohne KSK-Entscheidung`,
      text: 'Solange nicht entschieden ist, wer künstlerisch tätig war, ist die Jahresmeldung nicht fertig.',
      pfad: `/firma/${companyId}/auswertungen`,
    })
  }

  const mailsFehler = Number(mails?.anzahl ?? 0)
  if (mailsFehler > 0) {
    punkte.push({
      art: 'mail',
      stufe: 'dringend',
      titel: `${mailsFehler} ${mailsFehler === 1 ? 'Mail' : 'Mails'} nicht zugestellt`,
      text: 'Der Versand ist endgültig gescheitert. Adresse prüfen und neu einreihen.',
      pfad: `/firma/${companyId}`,
    })
  }

  // Dringendes zuerst, innerhalb davon das Älteste.
  punkte.sort((a, b) => {
    if (a.stufe !== b.stufe) return a.stufe === 'dringend' ? -1 : 1
    return (b.tage ?? 0) - (a.tage ?? 0)
  })

  return res.json({
    data: {
      punkte,
      dringend: punkte.filter((p) => p.stufe === 'dringend').length,
      offen: punkte.filter((p) => p.stufe === 'offen').length,
      stand: heute,
    },
    error: null,
  })
})

export default router
