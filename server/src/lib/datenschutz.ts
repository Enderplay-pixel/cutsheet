/**
 * Auskunft und Löschung nach DSGVO.
 *
 * Eine Produktion sammelt Personendaten: Namen, Telefonnummern, Adressen,
 * Gagen, Anwesenheitszeiten. Art. 15 gibt jeder betroffenen Person das Recht
 * zu erfahren, was gespeichert ist; Art. 17 das Recht auf Löschung.
 *
 * Gelöscht wird hier **nicht** ersatzlos, sondern anonymisiert: Eine Dispo
 * von vorletztem Jahr muss nachvollziehbar bleiben, und eine Honorarzeile
 * gehört zehn Jahre in die Buchhaltung. Was verschwindet, ist der Bezug zur
 * Person - Name, Kontakt, Adresse. Was bleibt, ist die Tatsache, dass an dem
 * Tag jemand in dieser Funktion gearbeitet hat.
 */
import { db } from '../db'

export type Personenart = 'crew' | 'cast' | 'extra'

/** Ein Fund in der Auskunft: woher, und was dort steht. */
export type Auskunftsposten = {
  bereich: string
  erklaerung: string
  eintraege: any[]
}

const ART_TABELLE: Record<Personenart, string> = {
  crew: 'crew',
  cast: '"cast"',
  extra: 'extras',
}

const ART_NAMENSFELD: Record<Personenart, string> = {
  crew: 'name',
  cast: 'actor_name',
  extra: 'name',
}

/** Minuten seit Mitternacht lesbar machen - in der Auskunft steht eine Uhrzeit. */
function uhrzeit(minuten: number | null): string {
  if (minuten === null || minuten === undefined) return ''
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Trägt alles zusammen, was zu einer Person im Projekt gespeichert ist.
 *
 * Die Reihenfolge folgt dem, was die Person wissen will: wer bin ich hier,
 * wann war ich da, was wurde über mich notiert.
 */
export async function auskunft(
  projectId: number,
  art: Personenart,
  personId: number
): Promise<{ person: any; posten: Auskunftsposten[] } | null> {
  const tabelle = ART_TABELLE[art]
  const person = (await db.get(
    `SELECT * FROM ${tabelle} WHERE id = ? AND project_id = ?`,
    [personId, projectId]
  )) as any
  if (!person) return null

  const posten: Auskunftsposten[] = [
    {
      bereich: 'Stammdaten',
      erklaerung: 'Was beim Anlegen der Person erfasst wurde.',
      eintraege: [person],
    },
  ]

  if (art !== 'extra') {
    const dispo = (await db.all(
      `SELECT e.call_time, e.notes, e.confirmed_at, e.viewed_at, e.sent_at,
              d.day_number, d.date
         FROM call_sheet_entries e
         JOIN call_sheets s ON s.id = e.call_sheet_id
         JOIN shoot_days d ON d.id = s.shoot_day_id
        WHERE e.person_type = ? AND e.person_id = ? AND d.project_id = ?
        ORDER BY d.date ASC`,
      [art, personId, projectId]
    )) as any[]
    posten.push({
      bereich: 'Dispositionen',
      erklaerung: 'Für welche Drehtage die Person eingeteilt war, mit ihrer Call-Zeit.',
      eintraege: dispo.map((z) => ({ ...z, call_time: uhrzeit(z.call_time) })),
    })

    const zeiten = (await db.all(
      `SELECT t.*, d.day_number, d.date
         FROM timesheets t
         LEFT JOIN shoot_days d ON d.id = t.shoot_day_id
        WHERE t.person_type = ? AND t.person_id = ? AND t.project_id = ?
        ORDER BY d.date ASC`,
      [art, personId, projectId]
    )) as any[]
    posten.push({
      bereich: 'Arbeitszeiten',
      erklaerung: 'Erfasste Anwesenheit, Pausen und Zuschläge.',
      eintraege: zeiten,
    })

    const verpflegung = (await db.all(
      'SELECT * FROM catering_preferences WHERE person_type = ? AND person_id = ? AND project_id = ?',
      [art, personId, projectId]
    )) as any[]
    posten.push({
      bereich: 'Verpflegung',
      erklaerung: 'Angaben zur Ernährung, etwa Unverträglichkeiten.',
      eintraege: verpflegung,
    })
  }

  const mails = (await db.all(
    `SELECT subject, status, sent_at, read_at FROM email_outbox
      WHERE project_id = ? AND LOWER(recipient_email) = LOWER(?)
      ORDER BY created_at DESC LIMIT 200`,
    [projectId, person.email || '\u0000']
  )) as any[]
  posten.push({
    bereich: 'E-Mails',
    erklaerung: 'Welche Nachrichten aus diesem Projekt an die Person gingen - ohne Inhalt.',
    eintraege: mails,
  })

  return { person, posten }
}

/**
 * Entfernt den Personenbezug, lässt die Produktionsdaten stehen.
 *
 * Gibt zurück, was angefasst wurde - das gehört ins Protokoll, damit die
 * Löschung später belegbar ist.
 */
export async function anonymisiere(
  projectId: number,
  art: Personenart,
  personId: number,
  grund = ''
): Promise<{ ersatzname: string; betroffen: Record<string, number> } | null> {
  const tabelle = ART_TABELLE[art]
  const namensfeld = ART_NAMENSFELD[art]
  const person = (await db.get(
    `SELECT * FROM ${tabelle} WHERE id = ? AND project_id = ?`,
    [personId, projectId]
  )) as any
  if (!person) return null

  // Der Ersatzname nennt die Funktion, nicht die Person: Auf einer alten
  // Dispo soll stehen, dass dort jemand in dieser Rolle gearbeitet hat.
  const funktion = String(person.role || person.department || 'Person').trim() || 'Person'
  const ersatzname = `${funktion} (entfernt)`
  const betroffen: Record<string, number> = {}

  const felderLeeren: Record<Personenart, string[]> = {
    crew: ['email', 'phone', 'notes'],
    cast: ['email', 'phone', 'notes', 'agency'],
    extra: ['email', 'phone', 'notes'],
  }
  const vorhandene: string[] = []
  for (const feld of felderLeeren[art]) {
    const spalte = (await db.get(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = ? AND column_name = ?`,
      [art === 'cast' ? 'cast' : tabelle.replace(/"/g, ''), feld]
    )) as any
    if (spalte) vorhandene.push(feld)
  }

  const zuweisungen = [`${namensfeld} = ?`, ...vorhandene.map((f) => `${f} = ''`)]
  const zeile = await db.run(
    `UPDATE ${tabelle} SET ${zuweisungen.join(', ')} WHERE id = ? AND project_id = ?`,
    [ersatzname, personId, projectId]
  )
  betroffen[art] = zeile.changes

  if (art !== 'extra') {
    // Freitexte, in denen der Name stehen könnte, werden geleert - nicht
    // durchsucht. Eine Teilsuche in Fliesstext würde entweder zu viel oder
    // zu wenig treffen.
    const notizen = await db.run(
      `UPDATE call_sheet_entries SET notes = '' WHERE person_type = ? AND person_id = ?`,
      [art, personId]
    )
    betroffen.dispo_notizen = notizen.changes

    const verpflegung = await db.run(
      'DELETE FROM catering_preferences WHERE person_type = ? AND person_id = ? AND project_id = ?',
      [art, personId, projectId]
    )
    betroffen.verpflegung = verpflegung.changes
  }

  // Verschickte Mails: Adresse unkenntlich, der Beleg bleibt.
  if (person.email) {
    const mails = await db.run(
      `UPDATE email_outbox SET recipient_email = '', recipient_name = ?, html = ''
        WHERE project_id = ? AND LOWER(recipient_email) = LOWER(?)`,
      [ersatzname, projectId, person.email]
    )
    betroffen.mails = mails.changes
  }

  await db.run(
    `INSERT INTO audit_log (project_id, user_id, user_name, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      'Datenschutz',
      'anonymisiert',
      art,
      personId,
      JSON.stringify({ grund }),
      JSON.stringify({ ersatzname, betroffen, zeitpunkt: new Date().toISOString() }),
    ]
  ).catch(() => undefined)

  return { ersatzname, betroffen }
}
