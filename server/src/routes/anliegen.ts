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
import { erfordereFirma, FIRMEN_RANG } from './companies'
import { tageZwischen } from '../lib/mahnwesen'
import { alterAm, KIND_BIS_ALTER } from '../lib/jugendschutz'
import { fristStand } from '../lib/dateien'
import { heuteISO } from '../lib/datum'
import { genehmigungsMeldungen } from '../lib/genehmigungen'

const router = Router()

export type Punkt = {
  /** Woher der Punkt kommt - für das Symbol und die Gruppierung. */
  art: 'vertrag' | 'bewilligung' | 'rechnung' | 'casting' | 'ksk' | 'nachweis' | 'mail' | 'rate' | 'genehmigung'
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
  // Rechnungen sieht nur, wer sie auch auf ihrer Seite sehen darf
  // (erfordereAbrechnung: ab Produktion). Gemessen am 24.10.2026: Ein
  // Mitarbeiter bekam dort 403, hier aber Nummer und offenen Betrag.
  const mitRechnungen = (FIRMEN_RANG[(req as any).firmenrolle] ?? 0) >= FIRMEN_RANG.produktion

  const [vertraege, kinder, rechnungen, anfragen, ksk, nachweise, mails, raten] = await Promise.all([
    // Verträge, auf die seit mehr als fünf Tagen niemand geantwortet hat.
    db.all(
      `SELECT c.id, c.title, c.project_id, c.sent_at, p.title AS projekt
         FROM contracts c JOIN projects p ON c.project_id = p.id
        WHERE p.company_id = ? AND c.status = 'versendet'
        ORDER BY c.sent_at ASC`,
      [companyId]
    ) as Promise<any[]>,
    // Kinder ohne Bewilligung, aus Besetzung und Komparserie - wie die
    // Jugendschutz-Seite und der Projektabschluss. Vorher nur die Besetzung.
    db.all(
      `SELECT k.*, p.title AS projekt,
              (SELECT MIN(sd.date) FROM call_sheet_entries cse
                 JOIN call_sheets cs ON cse.call_sheet_id = cs.id
                 JOIN shoot_days sd ON cs.shoot_day_id = sd.id
                WHERE cse.person_type = k.art AND cse.person_id = k.id
                  AND sd.project_id = k.project_id) AS erster_tag
         FROM (SELECT 'cast' AS art, id, actor_name AS name, birthdate, project_id
                 FROM "cast" WHERE birthdate IS NOT NULL AND permit_granted = false
               UNION ALL
               SELECT 'extra' AS art, id, name, birthdate, project_id
                 FROM extras WHERE birthdate IS NOT NULL AND permit_granted = false) k
         JOIN projects p ON k.project_id = p.id
        WHERE p.company_id = ?`,
      [companyId]
    ) as Promise<any[]>,
    mitRechnungen ? db.all(
      `SELECT id, number, due_date, gross_cents, paid_cents, reminder_level, client_id
         FROM invoices
        WHERE company_id = ? AND kind = 'rechnung'
          AND status NOT IN ('entwurf', 'storniert', 'bezahlt')
          AND due_date IS NOT NULL AND due_date < ?
        ORDER BY due_date ASC`,
      [companyId, heute]
    ) as Promise<any[]> : Promise.resolve([] as any[]),
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
    // Nachweise mit Ablaufdatum. Eine Drehgenehmigung, die am Drehtag
    // abgelaufen ist, hält den Dreh an. Abgeschlossene Projekte nicht: Ihre
    // Genehmigungen laufen alle irgendwann ab, und keine muss verlängert
    // werden - die Liste wüchse mit jedem Projekt, ohne dass etwas zu tun ist.
    db.all(
      `SELECT f.id, f.kind, f.filename, f.title, f.valid_until, f.project_id, p.title AS projekt
         FROM project_files f JOIN projects p ON f.project_id = p.id
        WHERE p.company_id = ? AND p.archived = 0 AND f.valid_until IS NOT NULL
        ORDER BY f.valid_until ASC`,
      [companyId]
    ) as Promise<any[]>,
    // Mails, die hängen geblieben sind. Ohne Projekt gehört eine Mail der
    // Firma nur, wenn sie eine Mahnung zu einer ihrer Rechnungen ist - alle
    // anderen ohne Projekt sind Kontomails (Passwort) irgendeines Kontos.
    // Vorher zählte jede Firma die Kontomails der ganzen Installation mit.
    db.get(
      `SELECT COUNT(*) AS anzahl FROM email_outbox o
         LEFT JOIN projects p ON o.project_id = p.id
        WHERE o.status = 'fehlgeschlagen'
          AND (p.company_id = ?
               OR (o.project_id IS NULL AND o.purpose = 'mahnung'
                   AND o.reference_id IN (SELECT id FROM invoices WHERE company_id = ?)))`,
      [companyId, companyId]
    ) as Promise<any>,
    // Überfällige Raten der Finanzierung (AP B2), aus dem jeweils neuesten
    // Plan eines laufenden Projekts. Geld - wie die Rechnungen ab Produktion.
    mitRechnungen ? db.all(
      `SELECT fi.id, fi.label, fi.due_on, fi.amount_cents, fe.source, p.id AS project_id, p.title AS projekt
         FROM financing_installments fi
         JOIN financing_entries fe ON fi.entry_id = fe.id
         JOIN financing_plan_versions fv ON fe.financing_version_id = fv.id
         JOIN projects p ON fv.project_id = p.id
        WHERE p.company_id = ? AND p.archived = 0
          AND fv.id = (SELECT v.id FROM financing_plan_versions v WHERE v.project_id = p.id ORDER BY v.created_at DESC, v.id DESC LIMIT 1)
          AND fi.due_on IS NOT NULL AND fi.due_on < ? AND fi.received_on IS NULL
        ORDER BY fi.due_on ASC`,
      [companyId, heute]
    ) as Promise<any[]> : Promise.resolve([] as any[]),
  ])

  // sent_at ist ein Zeitstempel, und pg liefert ihn als Date. Vorher
  // String(...).slice(0, 10) - das ergab "Mon Oct 12", tageZwischen las 0,
  // und kein Vertrag und keine Anfrage ohne abgelaufene Frist kam je auf
  // diese Liste. Gemessen am 24.10.2026, Vertrag seit 12 Tagen offen.
  const tagVon = (zeitpunkt: any) => heuteISO(new Date(zeitpunkt))

  for (const v of vertraege) {
    const tage = v.sent_at ? tageZwischen(tagVon(v.sent_at), heute) : 0
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
      titel: `${k.name}${k.art === 'extra' ? ' (Komparserie)' : ''}: Bewilligung fehlt`,
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
    const tage = a.sent_at ? tageZwischen(tagVon(a.sent_at), heute) : 0
    const fristVorbei = a.deadline ? String(a.deadline).slice(0, 10) < heute : false
    if (!fristVorbei && tage < 7) continue
    punkte.push({
      art: 'casting',
      stufe: fristVorbei ? 'dringend' : 'offen',
      titel: `${a.agentur || 'Agentur'} hat nicht geantwortet`,
      text: fristVorbei
        ? `Die Frist war am ${new Date(a.deadline).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}. ${a.projekt}.`
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

  for (const n of nachweise) {
    const stand = fristStand(n.valid_until, heute)
    if (stand !== 'abgelaufen' && stand !== 'laeuft_ab') continue
    const tage = tageZwischen(heute, String(n.valid_until).slice(0, 10))
    punkte.push({
      art: 'nachweis',
      // Ein abgelaufener Nachweis sperrt etwas, ein ablaufender nicht.
      stufe: stand === 'abgelaufen' ? 'dringend' : 'offen',
      titel: `${n.title || n.filename}: ${stand === 'abgelaufen' ? 'abgelaufen' : 'läuft ab'}`,
      text: stand === 'abgelaufen'
        ? `Seit ${-tage} Tagen abgelaufen. ${n.projekt}.`
        : `Noch ${tage} Tage gültig. Verlängern dauert. ${n.projekt}.`,
      pfad: `/projects/${n.project_id}/ablage`,
      tage: Math.abs(tage),
    })
  }

  for (const r of raten) {
    const tage = tageZwischen(String(r.due_on).slice(0, 10), heute)
    punkte.push({
      art: 'rate',
      stufe: 'dringend',
      titel: `Rate von ${r.source || 'Geldgeber'} überfällig`,
      text: `${(Number(r.amount_cents) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}${r.label ? ` (${r.label})` : ''}, seit ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} fällig. ${r.projekt}.`,
      pfad: `/projects/${r.project_id}/budget`,
      tage,
    })
  }

  const mailsFehler = Number(mails?.anzahl ?? 0)
  // Drehgenehmigungen (AP C3): ein Drehtag in den nächsten 14 Tagen oder
  // heute ohne vorliegende Genehmigung; eine vorliegende, die bald abläuft,
  // wie ein Nachweis mit Frist. Vergangene Drehtage stehen im Konfliktradar.
  const laufende = await db.all('SELECT id, title FROM projects WHERE company_id = ? AND archived = 0', [companyId]) as any[]
  const projektName = new Map(laufende.map((p) => [Number(p.id), String(p.title ?? '')]))
  for (const [pid, meldungen] of await genehmigungsMeldungen([...projektName.keys()], heute)) {
    for (const g of meldungen.filter((x) => x.tage_bis >= 0 && x.tage_bis <= 14)) {
      punkte.push({
        art: 'genehmigung',
        stufe: g.tage_bis === 0 ? 'dringend' : 'offen',
        titel: `Genehmigung für ${g.motiv} fehlt`,
        text: `Drehtag ${g.day_number} ${g.tage_bis === 0 ? 'ist heute' : `in ${g.tage_bis} ${g.tage_bis === 1 ? 'Tag' : 'Tagen'}`}, keine Genehmigung liegt vor. ${projektName.get(pid)}.`,
        pfad: `/projects/${pid}/motive`,
        tage: g.tage_bis,
      })
    }
  }
  if (projektName.size) {
    const ablaufend = await db.all(
      `SELECT g.title, g.valid_until, g.project_id, l.name AS motiv FROM permits g JOIN locations l ON l.id = g.location_id
        WHERE g.project_id = ANY(?::int[]) AND g.status = 'liegt vor' AND g.valid_until IS NOT NULL AND g.valid_until >= ?`,
      [[...projektName.keys()], heute]) as any[]
    for (const g of ablaufend) {
      if (fristStand(String(g.valid_until).slice(0, 10), heute) !== 'laeuft_ab') continue
      const tage = tageZwischen(heute, String(g.valid_until).slice(0, 10))
      punkte.push({
        art: 'genehmigung',
        stufe: 'offen',
        titel: `${g.title || 'Genehmigung'} (${g.motiv}): läuft ab`,
        text: `Noch ${tage} Tage gültig. Verlängern dauert. ${projektName.get(Number(g.project_id))}.`,
        pfad: `/projects/${g.project_id}/motive`,
        tage,
      })
    }
  }

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
