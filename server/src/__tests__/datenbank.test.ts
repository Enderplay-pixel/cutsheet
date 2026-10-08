/**
 * Alles, was nur eine echte PostgreSQL-Instanz zeigen kann.
 *
 * Die übrigen Tests fälschen die Datenbank - schnell, aber blind für alles,
 * was erst Postgres entscheidet: `ON CONFLICT`, `::interval`, BYTEA, die
 * Reihenfolge der Express-Routen und ob `toPg` die Abfrage heil lässt. In
 * diesem Projekt sind daran schon mehrere Fehler erst in der Produktion
 * aufgefallen.
 *
 * Eine Instanz für alle Prüfungen: Drei Dateien mit je eigener Instanz
 * blockierten sich gegenseitig, und eine wurde ohne Meldung übersprungen.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'http'
import path from 'path'
import os from 'os'
import fs from 'fs'

const PORT = 55439
const datenverzeichnis = path.join(os.tmpdir(), `cutsheet-dbtest-${process.pid}`)

let postgres: any
let db: any
let mailversand: typeof import('../lib/mailversand')
let aufbewahrung: typeof import('../lib/mailaufbewahrung')
let server: http.Server
let basis = ''
let tokenInhaber = ''
let tokenFremd = ''
let nutzerId = 0
let fremdeId = 0
let projektId = 0

/** Hält höchstens so lange die Luft an, wie angegeben. */
function mitZeitgrenze<T>(versprechen: Promise<T>, ms: number): Promise<T | 'abgelaufen'> {
  return Promise.race([
    versprechen,
    new Promise<'abgelaufen'>((aufloesen) => setTimeout(() => aufloesen('abgelaufen'), ms)),
  ])
}

beforeAll(async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres')
  postgres = new EmbeddedPostgres({
    databaseDir: datenverzeichnis,
    user: 'cutsheet',
    password: 'cutsheet',
    port: PORT,
    persistent: false,
  })
  await postgres.initialise()
  await postgres.start()
  // UTF-8 erzwingen: initdb nimmt unter Windows sonst die Locale des Rechners
  // (WIN1252), und der Test liefe gegen eine andere Kodierung als die
  // Produktion.
  const { Client } = await import('pg')
  const verwaltung = new Client({ connectionString: `postgresql://cutsheet:cutsheet@localhost:${PORT}/postgres` })
  await verwaltung.connect()
  await verwaltung.query(`CREATE DATABASE cutsheet WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`)
  await verwaltung.end()

  // Muss vor dem Import stehen: der Pool entsteht beim Laden des Moduls.
  process.env.DATABASE_URL = `postgresql://cutsheet:cutsheet@localhost:${PORT}/cutsheet`
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-geheimnis-fuer-die-datenbanktests-0123456789'

  const modul = await import('../db')
  db = modul.db
  mailversand = await import('../lib/mailversand')
  aufbewahrung = await import('../lib/mailaufbewahrung')
  await modul.initDatabase()

  const inhaberin = await db.run(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'user')",
    ['inhaberin@example.com', 'x', 'Inhaberin']
  )
  nutzerId = inhaberin.id
  const fremde = await db.run(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'user')",
    ['fremde@example.com', 'x', 'Fremde Person']
  )
  fremdeId = fremde.id
  const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Testprojekt', nutzerId])
  projektId = projekt.id

  // Echter Server mit echten Tokens: so läuft die ganze Kette mit - Token
  // prüfen, Rolle bestimmen, Abfrage ausführen.
  const { signToken } = await import('../middleware/auth')
  const { default: companiesRouter } = await import('../routes/companies')
  const { default: invoicesRouter } = await import('../routes/invoices')
  const app = express()
  app.use(express.json())
  app.use('/api', companiesRouter)
  app.use('/api', invoicesRouter)
  await new Promise<void>((aufloesen) => {
    server = app.listen(0, () => {
      basis = `http://127.0.0.1:${(server.address() as any).port}`
      aufloesen()
    })
  })
  tokenInhaber = signToken({ id: nutzerId, email: 'inhaberin@example.com', name: 'Inhaberin', role: 'user' })
  tokenFremd = signToken({ id: fremdeId, email: 'fremde@example.com', name: 'Fremde Person', role: 'user' })
}, 180_000)

afterAll(async () => {
  // Offene Verbindungen kappen: fetch hält sie per keep-alive offen, und
  // close() wartet sonst auf ihr Ende.
  server?.closeAllConnections?.()
  server?.close()
  try {
    const modul = await import('../db')
    await modul.pool.end()
  } catch { /* schon zu */ }
  // Gemessen: stop() kommt nicht immer zurück. Der Lauf darf daran nicht hängen.
  await mitZeitgrenze((postgres?.stop?.() ?? Promise.resolve()).catch(() => undefined), 5_000)
  try { fs.rmSync(datenverzeichnis, { recursive: true, force: true }) } catch { /* egal */ }
}, 90_000)

/** Anfrage mit Token; gibt Status, Rumpf und Fehlertext zurück. */
async function hole(pfad: string, token: string, optionen: RequestInit = {}) {
  const antwort = await fetch(`${basis}${pfad}`, {
    ...optionen,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...((optionen.headers as Record<string, string>) || {}),
    },
  })
  const rumpf: any = await antwort.json().catch(() => null)
  return { status: antwort.status, daten: rumpf?.data, fehler: rumpf?.error }
}

describe('Schema für den Mailbetrieb', () => {
  it('legt alle fünf Tabellen an', async () => {
    const zeilen = await db.all(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'email%'
        ORDER BY table_name`
    )
    expect(zeilen.map((z: any) => z.table_name)).toEqual([
      'email_attachments',
      'email_group_members',
      'email_groups',
      'email_identities',
      'email_log',
      'email_outbox',
      'email_templates',
    ])
  })

  it('lässt eine Mail ohne Projekt zu - Passwort-Mails gehören zu keinem Dreh', async () => {
    const zeile = await db.run(
      "INSERT INTO email_outbox (project_id, subject, html, recipient_email, purpose) VALUES (?, ?, ?, ?, 'passwort')",
      [null, 'Passwort', '<p>x</p>', 'jemand@example.com']
    )
    expect(zeile.id).toBeGreaterThan(0)
    await db.run('DELETE FROM email_outbox WHERE id = ?', [zeile.id])
  })
})

describe('Postausgang', () => {
  it('reiht eine Zeile je Empfänger ein und verwirft ungültige Adressen', async () => {
    const eingereiht = await mailversand.reiheEin({
      projectId: projektId,
      betreff: 'Dispo Drehtag 1',
      html: (person) => `<p>Hallo ${person.name}</p>`,
      empfaenger: [
        { email: 'sarah@example.com', name: 'Sarah Müller' },
        { email: 'lars@example.com', name: 'Lars Weber' },
        { email: 'kaputt', name: 'Niemand' },
      ],
      anlass: 'dispo',
      erstelltVon: nutzerId,
    })
    expect(eingereiht).toHaveLength(2)

    const zeilen = await db.all(
      'SELECT recipient_email, html, status FROM email_outbox WHERE project_id = ? ORDER BY id',
      [projektId]
    )
    expect(zeilen.map((z: any) => z.recipient_email)).toEqual(['sarah@example.com', 'lars@example.com'])
    expect(zeilen[0].html).toContain('Sarah Müller')
    expect(zeilen[1].html).toContain('Lars Weber')
    expect(zeilen[0].status).toBe('wartet')
  })

  it('sagt ohne Mailserver, dass nichts rausgegangen ist - und behauptet nichts anderes', async () => {
    delete process.env.SMTP_HOST
    mailversand.vergissTransport()
    const lauf = await mailversand.sendeFaellige()
    expect(lauf.gesendet).toBe(0)
    expect(lauf.ohneVersand).toBeGreaterThanOrEqual(2)

    const zeilen = await db.all('SELECT status, last_error FROM email_outbox WHERE project_id = ?', [projektId])
    for (const zeile of zeilen) {
      expect(zeile.status).toBe('ohne_versand')
      expect(zeile.last_error).toContain('SMTP_HOST')
    }
  })

  it('legt eine nicht versendete Mail zurück in die Warteschlange', async () => {
    const mail = await db.get('SELECT id FROM email_outbox WHERE project_id = ? ORDER BY id LIMIT 1', [projektId])
    expect(await mailversand.erneutVersuchen(mail.id, projektId)).toBe(true)
    const danach = await db.get('SELECT status, attempts FROM email_outbox WHERE id = ?', [mail.id])
    expect(danach.status).toBe('wartet')
    expect(Number(danach.attempts)).toBe(0)
  })

  it('erneuert nichts aus einem fremden Projekt', async () => {
    const mail = await db.get('SELECT id FROM email_outbox WHERE project_id = ? ORDER BY id LIMIT 1', [projektId])
    expect(await mailversand.erneutVersuchen(mail.id, projektId + 999)).toBe(false)
  })

  it('speichert einen Anhang einmal, auch bei mehreren Empfängern', async () => {
    const vorher = await db.get('SELECT COUNT(*) AS c FROM email_attachments')
    await mailversand.reiheEin({
      projectId: projektId,
      betreff: 'Mit Anhang',
      html: '<p>x</p>',
      empfaenger: [{ email: 'a@example.com' }, { email: 'b@example.com' }, { email: 'c@example.com' }],
      anlass: 'dispo',
      anhang: { dateiname: 'dispo.pdf', inhalt: Buffer.from('%PDF-1.4 Test') },
    })
    const nachher = await db.get('SELECT COUNT(*) AS c FROM email_attachments')
    expect(Number(nachher.c) - Number(vorher.c)).toBe(1)

    const zeilen = await db.all(
      "SELECT attachment_id FROM email_outbox WHERE subject = 'Mit Anhang'"
    )
    expect(zeilen).toHaveLength(3)
    expect(new Set(zeilen.map((z: any) => z.attachment_id)).size).toBe(1)

    const datei = await db.get('SELECT filename, content FROM email_attachments ORDER BY id DESC LIMIT 1')
    expect(datei.filename).toBe('dispo.pdf')
    expect(Buffer.from(datei.content).toString()).toBe('%PDF-1.4 Test')
  })

  it('setzt den Quittungslink ein, bevor die Mail abgelegt wird', async () => {
    const eingereiht = await mailversand.reiheEin({
      projectId: projektId,
      betreff: 'Mit Quittung',
      html: '<p>Bitte bestätigen: <a href="{{quittung_link}}">hier</a></p>',
      empfaenger: [{ email: 'quittung@example.com' }],
      anlass: 'manuell',
      mitQuittung: true,
    })
    const token = eingereiht[0].quittungToken!
    expect(token).toMatch(/^[0-9a-f]{32}$/)

    const zeile = await db.get('SELECT html, read_at FROM email_outbox WHERE id = ?', [eingereiht[0].id])
    expect(zeile.html).toContain(`/api/email/receipt/${token}`)
    expect(zeile.html).not.toContain('{{quittung_link}}')
    expect(zeile.read_at).toBeNull()

    const bestaetigt = await mailversand.quittiere(token)
    expect(bestaetigt?.betreff).toBe('Mit Quittung')
    const danach = await db.get('SELECT read_at FROM email_outbox WHERE id = ?', [eingereiht[0].id])
    expect(danach.read_at).not.toBeNull()
  })

  it('quittiert nichts auf einen erfundenen Token', async () => {
    expect(await mailversand.quittiere('gibtsnicht')).toBeNull()
  })
})

describe('Absender je Projekt', () => {
  it('legt die Angaben an und überschreibt sie beim zweiten Speichern', async () => {
    const speichern = (name: string, antwort: string) =>
      db.run(
        `INSERT INTO email_identities (project_id, sender_name, reply_to, signature, logo_url, accent_color, footer_note, updated_at)
         VALUES (?, ?, ?, '', '', '#0A84FF', '', NOW())
         ON CONFLICT (project_id) DO UPDATE SET
           sender_name = EXCLUDED.sender_name,
           reply_to = EXCLUDED.reply_to,
           updated_at = NOW()`,
        [projektId, name, antwort]
      )
    await speichern('Produktion Eins', 'eins@example.com')
    await speichern('Produktion Zwei', 'zwei@example.com')

    const zeilen = await db.all('SELECT sender_name, reply_to FROM email_identities WHERE project_id = ?', [projektId])
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].sender_name).toBe('Produktion Zwei')

    const absender = await mailversand.holeAbsender(projektId)
    expect(absender.from).toContain('Produktion Zwei')
    expect(absender.replyTo).toBe('zwei@example.com')
  })

  it('fällt ohne eigene Angaben auf den Standard zurück', async () => {
    const absender = await mailversand.holeAbsender(null)
    expect(absender.from).toBeTruthy()
    expect(absender.replyTo).toBeUndefined()
  })
})

describe('Aufbewahrung', () => {
  it('entfernt alte Anhänge und lässt frische stehen', async () => {
    await db.run(
      `INSERT INTO email_attachments (project_id, filename, content, created_at)
       VALUES (?, ?, ?, NOW() - INTERVAL '400 days')`,
      [projektId, 'uralt.pdf', Buffer.from('alt')]
    )
    const vorher = await db.get('SELECT COUNT(*) AS c FROM email_attachments')
    const ergebnis = await aufbewahrung.raeumeMailanhaengeAuf()
    const nachher = await db.get('SELECT COUNT(*) AS c FROM email_attachments')

    expect(ergebnis.anhaenge).toBe(1)
    expect(Number(nachher.c)).toBe(Number(vorher.c) - 1)
    expect(await db.get("SELECT id FROM email_attachments WHERE filename = 'uralt.pdf'")).toBeUndefined()
    expect(await db.get("SELECT id FROM email_attachments WHERE filename = 'dispo.pdf'")).toBeTruthy()
  })
})

describe('Die Firma über den Projekten', () => {
  let firmaId = 0

  it('legt eine Firma an und führt die anlegende Person als Inhaberin', async () => {
    const angelegt = await hole('/api/companies', tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ name: 'Nordlicht Film' }),
    })
    expect(angelegt.status).toBe(200)
    firmaId = angelegt.daten.id

    const gelesen = await hole(`/api/companies/${firmaId}`, tokenInhaber)
    expect(gelesen.daten.name).toBe('Nordlicht Film')
    expect(gelesen.daten.meine_rolle).toBe('inhaber')
  })

  it('weist jeden ab, der nicht zur Firma gehört', async () => {
    const versuche: Array<[string, RequestInit]> = [
      [`/api/companies/${firmaId}`, {}],
      [`/api/companies/${firmaId}/contacts`, {}],
      [`/api/companies/${firmaId}/members`, {}],
      [`/api/companies/${firmaId}/rates`, {}],
      [`/api/companies/${firmaId}`, { method: 'PUT', body: JSON.stringify({ name: 'Uebernommen' }) }],
      [`/api/companies/${firmaId}/contacts`, { method: 'POST', body: JSON.stringify({ name: 'Eindringling' }) }],
    ]
    for (const [pfad, optionen] of versuche) {
      const antwort = await hole(pfad, tokenFremd, optionen)
      expect(antwort.status, `${optionen.method || 'GET'} ${pfad}`).toBe(403)
    }
  })

  it('listet die Firma nur bei denen auf, die dazugehören', async () => {
    const meine = await hole('/api/companies', tokenInhaber)
    expect(meine.daten.map((f: any) => f.id)).toContain(firmaId)
    const fremde = await hole('/api/companies', tokenFremd)
    expect(fremde.daten.map((f: any) => f.id)).not.toContain(firmaId)
  })

  it('führt das Adressbuch und archiviert, statt zu löschen', async () => {
    const angelegt = await hole(`/api/companies/${firmaId}/contacts`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sarah Müller', role: 'Regie', department: 'Regie',
        email: 'sarah@example.com', day_rate_cents: 45000,
      }),
    })
    expect(angelegt.status).toBe(200)
    const kontaktId = angelegt.daten.id

    const liste = await hole(`/api/companies/${firmaId}/contacts`, tokenInhaber)
    expect(liste.daten).toHaveLength(1)
    expect(liste.daten[0].day_rate_cents).toBe(45000)

    const treffer = await hole(`/api/companies/${firmaId}/contacts?q=regie`, tokenInhaber)
    expect(treffer.daten).toHaveLength(1)
    const daneben = await hole(`/api/companies/${firmaId}/contacts?q=kamera`, tokenInhaber)
    expect(daneben.daten).toHaveLength(0)

    await hole(`/api/companies/${firmaId}/contacts/${kontaktId}`, tokenInhaber, { method: 'DELETE' })
    const danach = await hole(`/api/companies/${firmaId}/contacts`, tokenInhaber)
    expect(danach.daten).toHaveLength(0)
    const zeile = await db.get('SELECT archived FROM company_contacts WHERE id = ?', [kontaktId])
    expect(zeile.archived).toBe(true)
  })

  it('weist eine unbrauchbare Adresse zurück', async () => {
    const antwort = await hole(`/api/companies/${firmaId}/contacts`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ name: 'Kaputt', email: 'keine-adresse' }),
    })
    expect(antwort.status).toBe(400)
  })

  it('übernimmt nur in Projekte derselben Firma und niemanden doppelt', async () => {
    const kontakt = await hole(`/api/companies/${firmaId}/contacts`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ name: 'Lars Weber', role: 'Aufnahmeleitung', email: 'lars@example.com' }),
    })
    const kontaktId = kontakt.daten.id

    const abgelehnt = await hole(`/api/companies/${firmaId}/contacts/import`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ project_id: projektId, contact_ids: [kontaktId] }),
    })
    expect(abgelehnt.status, 'Projekt gehoert noch zu keiner Firma').toBe(400)

    await db.run('UPDATE projects SET company_id = ? WHERE id = ?', [firmaId, projektId])

    const erster = await hole(`/api/companies/${firmaId}/contacts/import`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ project_id: projektId, contact_ids: [kontaktId] }),
    })
    expect(erster.daten.stab).toBe(1)

    const zweiter = await hole(`/api/companies/${firmaId}/contacts/import`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ project_id: projektId, contact_ids: [kontaktId] }),
    })
    expect(zweiter.daten.stab).toBe(0)
    expect(zweiter.daten.uebersprungen).toBe(1)

    const stab = await db.all('SELECT name, contact_id FROM crew WHERE project_id = ?', [projektId])
    expect(stab).toHaveLength(1)
    expect(stab[0].name).toBe('Lars Weber')
    expect(stab[0].contact_id).toBe(kontaktId)
  })

  it('öffnet über die Firmenzugehörigkeit kein fremdes Projekt', async () => {
    await db.run(
      "INSERT INTO company_members (company_id, user_id, role) VALUES (?, ?, 'mitarbeiter')",
      [firmaId, fremdeId]
    )
    const stammdaten = await hole(`/api/companies/${firmaId}/contacts`, tokenFremd)
    expect(stammdaten.status, 'Stammdaten der Firma sind offen').toBe(200)

    const insProjekt = await hole(`/api/companies/${firmaId}/contacts/import`, tokenFremd, {
      method: 'POST',
      body: JSON.stringify({ project_id: projektId, contact_ids: [1] }),
    })
    expect(insProjekt.status, 'das Projekt bleibt zu').toBe(403)

    const ausProjekt = await hole(`/api/companies/${firmaId}/contacts/from-project`, tokenFremd, {
      method: 'POST',
      body: JSON.stringify({ project_id: projektId }),
    })
    expect(ausProjekt.status, 'auch lesend bleibt es zu').toBe(403)
  })

  it('lässt Profil und Sätze nur von der Firmenleitung ändern', async () => {
    const profil = await hole(`/api/companies/${firmaId}`, tokenFremd, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Umbenannt' }),
    })
    expect(profil.status).toBe(403)

    const satzVersuch = await hole(`/api/companies/${firmaId}/rates`, tokenFremd, {
      method: 'POST',
      body: JSON.stringify({ role: 'Kamera', day_rate_cents: 1 }),
    })
    expect(satzVersuch.status).toBe(403)

    const erlaubt = await hole(`/api/companies/${firmaId}/rates`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ role: 'Kamera', department: 'Kamera', day_rate_cents: 52000 }),
    })
    expect(erlaubt.status).toBe(200)

    const saetze = await hole(`/api/companies/${firmaId}/rates`, tokenFremd)
    expect(saetze.status, 'lesen darf die Mitarbeit').toBe(200)
    expect(saetze.daten).toHaveLength(1)
  })

  it('sammelt den Stab eines Projekts ein, ohne Doppelte anzulegen', async () => {
    await db.run(
      'INSERT INTO crew (project_id, name, role, department, email) VALUES (?, ?, ?, ?, ?)',
      [projektId, 'Felix Wagner', 'Ton', 'Ton', 'felix@example.com']
    )
    const erster = await hole(`/api/companies/${firmaId}/contacts/from-project`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ project_id: projektId }),
    })
    expect(erster.daten.uebernommen).toBe(1)

    const zweiter = await hole(`/api/companies/${firmaId}/contacts/from-project`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ project_id: projektId }),
    })
    expect(zweiter.daten.uebernommen).toBe(0)
  })

  it('beantwortet die Verfügbarkeit mit Terminen, nicht mit Projektinhalten', async () => {
    const kontakt = await db.get(
      "SELECT id FROM company_contacts WHERE company_id = ? AND name = 'Lars Weber'",
      [firmaId]
    )
    const tag = await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, ?)', [
      projektId, '2026-11-12',
    ])
    const dispo = await db.run('INSERT INTO call_sheets (shoot_day_id, general_call) VALUES (?, 420)', [tag.id])
    const person = await db.get('SELECT id FROM crew WHERE contact_id = ?', [kontakt.id])
    await db.run(
      'INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time) VALUES (?, ?, ?, 420)',
      [dispo.id, 'crew', person.id]
    )

    const antwort = await hole(`/api/companies/${firmaId}/contacts/${kontakt.id}/availability`, tokenInhaber)
    expect(antwort.status).toBe(200)
    expect(antwort.daten).toHaveLength(1)
    expect(String(antwort.daten[0].date)).toContain('2026-11-12')
    expect(antwort.daten[0].day_number).toBe(1)
    expect(Object.keys(antwort.daten[0]).sort()).toEqual(['date', 'day_number', 'project_id', 'title'])
  })

  it('gibt zu einem Eintrag einer fremden Firma nichts heraus', async () => {
    const andere = await hole('/api/companies', tokenFremd, {
      method: 'POST',
      body: JSON.stringify({ name: 'Andere Firma' }),
    })
    const andereId = andere.daten.id
    const kontakt = await db.get(
      "SELECT id FROM company_contacts WHERE company_id = ? AND name = 'Lars Weber'",
      [firmaId]
    )
    const antwort = await hole(`/api/companies/${andereId}/contacts/${kontakt.id}/availability`, tokenFremd)
    expect(antwort.status).toBe(404)
  })
})

describe('Rechnungen', () => {
  let firmaId = 0
  let kundeId = 0

  beforeAll(async () => {
    const firma = await hole('/api/companies', tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ name: 'Rechnungsfirma' }),
    })
    firmaId = firma.daten.id
    await db.run(
      "UPDATE companies SET tax_number = '123/456/789', address = 'Hauptstr. 1', zip = '44787', city = 'Bochum' WHERE id = ?",
      [firmaId]
    )
    const kunde = await hole(`/api/companies/${firmaId}/clients`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Sender Nord', address: 'Sendeplatz 1', zip: '20095', city: 'Hamburg', vat_id: 'DE123456789',
      }),
    })
    kundeId = kunde.daten.id
  }, 60_000)

  /** Legt einen Entwurf mit einer Position an und gibt die Kennung zurück. */
  async function entwurfMitPosition(betragCents = 10000): Promise<number> {
    const entwurf = await hole(`/api/companies/${firmaId}/invoices`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ client_id: kundeId, issue_date: '2026-10-08' }),
    })
    const id = entwurf.daten.id
    await hole(`/api/companies/${firmaId}/invoices/${id}/items`, tokenInhaber, {
      method: 'PUT',
      body: JSON.stringify({
        items: [{ description: 'Pauschale', quantity_milli: 1000, unit: 'Pauschale', unit_price_cents: betragCents, tax_percent: 19 }],
      }),
    })
    return id
  }

  it('legt einen Entwurf ohne Nummer an und rechnet die Fälligkeit', async () => {
    const entwurf = await hole(`/api/companies/${firmaId}/invoices`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ client_id: kundeId, issue_date: '2026-10-08' }),
    })
    expect(entwurf.status).toBe(200)
    const gelesen = await hole(`/api/companies/${firmaId}/invoices/${entwurf.daten.id}`, tokenInhaber)
    expect(gelesen.daten.number).toBe('')
    expect(gelesen.daten.status).toBe('entwurf')
    expect(String(gelesen.daten.due_date)).toContain('2026-10-22')
  })

  it('schreibt ohne Position nicht fest', async () => {
    const entwurf = await hole(`/api/companies/${firmaId}/invoices`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ client_id: kundeId, issue_date: '2026-10-08' }),
    })
    const versuch = await hole(`/api/companies/${firmaId}/invoices/${entwurf.daten.id}/issue`, tokenInhaber, {
      method: 'POST',
    })
    expect(versuch.status).toBe(400)
    expect(versuch.fehler).toContain('Position')
  })

  it('schreibt ohne Auftraggeber nicht fest', async () => {
    const entwurf = await hole(`/api/companies/${firmaId}/invoices`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ issue_date: '2026-10-08' }),
    })
    await hole(`/api/companies/${firmaId}/invoices/${entwurf.daten.id}/items`, tokenInhaber, {
      method: 'PUT',
      body: JSON.stringify({ items: [{ description: 'x', quantity_milli: 1000, unit_price_cents: 100, tax_percent: 19 }] }),
    })
    const versuch = await hole(`/api/companies/${firmaId}/invoices/${entwurf.daten.id}/issue`, tokenInhaber, {
      method: 'POST',
    })
    expect(versuch.status).toBe(400)
    expect(versuch.fehler).toContain('Auftraggeber')
  })

  it('rechnet die Summen aus den Positionen', async () => {
    const entwurf = await hole(`/api/companies/${firmaId}/invoices`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ client_id: kundeId, issue_date: '2026-10-08' }),
    })
    const mit = await hole(`/api/companies/${firmaId}/invoices/${entwurf.daten.id}/items`, tokenInhaber, {
      method: 'PUT',
      body: JSON.stringify({
        items: [
          { description: 'Drehtag Kamera', quantity_milli: 2000, unit: 'Tag', unit_price_cents: 50000, tax_percent: 19 },
          { description: 'Fahrtkosten', quantity_milli: 1000, unit: 'Pauschale', unit_price_cents: 10000, tax_percent: 19 },
        ],
      }),
    })
    expect(mit.daten.net_cents).toBe(110000)
    expect(mit.daten.tax_cents).toBe(20900)
    expect(mit.daten.gross_cents).toBe(130900)
  })

  it('vergibt fortlaufende Nummern', async () => {
    const nummern: string[] = []
    for (let i = 0; i < 3; i++) {
      const id = await entwurfMitPosition()
      const fest = await hole(`/api/companies/${firmaId}/invoices/${id}/issue`, tokenInhaber, { method: 'POST' })
      expect(fest.status).toBe(200)
      nummern.push(fest.daten.number)
    }
    expect(nummern).toEqual(['2026-0001', '2026-0002', '2026-0003'])
  })

  it('vergibt auch bei gleichzeitigen Anfragen keine Nummer doppelt', async () => {
    const ids = await Promise.all(Array.from({ length: 5 }, () => entwurfMitPosition(5000)))
    const ergebnisse = await Promise.all(
      ids.map((id) => hole(`/api/companies/${firmaId}/invoices/${id}/issue`, tokenInhaber, { method: 'POST' }))
    )
    const nummern = ergebnisse.map((e) => e.daten?.number)
    expect(nummern.every(Boolean), `Antworten: ${JSON.stringify(ergebnisse.map(e => e.fehler))}`).toBe(true)
    expect(new Set(nummern).size, `Nummern: ${nummern.join(', ')}`).toBe(5)
  })

  it('ändert eine festgeschriebene Rechnung nicht mehr', async () => {
    const rechnung = await db.get(
      "SELECT id FROM invoices WHERE company_id = ? AND status = 'versendet' ORDER BY id LIMIT 1",
      [firmaId]
    )
    const kopf = await hole(`/api/companies/${firmaId}/invoices/${rechnung.id}`, tokenInhaber, {
      method: 'PUT',
      body: JSON.stringify({ intro: 'nachtraeglich' }),
    })
    expect(kopf.status).toBe(400)

    const posten = await hole(`/api/companies/${firmaId}/invoices/${rechnung.id}/items`, tokenInhaber, {
      method: 'PUT',
      body: JSON.stringify({ items: [] }),
    })
    expect(posten.status).toBe(400)

    const geloescht = await hole(`/api/companies/${firmaId}/invoices/${rechnung.id}`, tokenInhaber, { method: 'DELETE' })
    expect(geloescht.status).toBe(400)
  })

  it('erfasst Teilzahlung und Restzahlung', async () => {
    const rechnung = await db.get(
      "SELECT id FROM invoices WHERE company_id = ? AND status = 'versendet' ORDER BY id LIMIT 1",
      [firmaId]
    )
    const teil = await hole(`/api/companies/${firmaId}/invoices/${rechnung.id}/payment`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ amount_cents: 1000 }),
    })
    expect(teil.daten.zahlungsstand).toBe('teilweise')
    expect(teil.daten.status).toBe('versendet')

    const rest = await hole(`/api/companies/${firmaId}/invoices/${rechnung.id}/payment`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    expect(rest.daten.zahlungsstand).toBe('bezahlt')
    expect(rest.daten.status).toBe('bezahlt')
  })

  it('behält die Nummer beim Stornieren', async () => {
    const rechnung = await db.get(
      "SELECT id, number FROM invoices WHERE company_id = ? AND status = 'versendet' ORDER BY id DESC LIMIT 1",
      [firmaId]
    )
    const storniert = await hole(`/api/companies/${firmaId}/invoices/${rechnung.id}/cancel`, tokenInhaber, {
      method: 'POST',
    })
    expect(storniert.status).toBe(200)
    const danach = await db.get('SELECT number, status FROM invoices WHERE id = ?', [rechnung.id])
    expect(danach.number).toBe(rechnung.number)
    expect(danach.status).toBe('storniert')
  })

  it('zeigt die Rechnungen niemandem von aussen', async () => {
    const liste = await hole(`/api/companies/${firmaId}/invoices`, tokenFremd)
    expect(liste.status).toBe(403)
    const kunden = await hole(`/api/companies/${firmaId}/clients`, tokenFremd)
    expect(kunden.status).toBe(403)
  })

  it('weist ein Projekt zurück, das nicht zu dieser Firma gehört', async () => {
    const versuch = await hole(`/api/companies/${firmaId}/invoices`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ client_id: kundeId, project_id: projektId }),
    })
    expect(versuch.status).toBe(400)
  })

  it('wertet die Umsatzsteuer nach Sätzen aus', async () => {
    const bericht = await hole(
      `/api/companies/${firmaId}/invoices/report/vat?von=2026-01-01&bis=2026-12-31`,
      tokenInhaber
    )
    expect(bericht.status).toBe(200)
    expect(bericht.daten.anzahl).toBeGreaterThan(0)
    const satz19 = bericht.daten.nach_satz.find((z: any) => z.satz === 19)
    expect(satz19.steuer).toBe(Math.round((satz19.netto * 19) / 100))
  })

  it('gibt die Rechnung als HTML mit allen Pflichtangaben aus', async () => {
    const rechnung = await db.get(
      "SELECT id, number FROM invoices WHERE company_id = ? AND number <> '' ORDER BY id LIMIT 1",
      [firmaId]
    )
    const antwort = await fetch(`${basis}/api/companies/${firmaId}/invoices/${rechnung.id}/pdf?format=html`, {
      headers: { Authorization: `Bearer ${tokenInhaber}` },
    })
    expect(antwort.status).toBe(200)
    const html = await antwort.text()
    for (const pflicht of [
      rechnung.number,          // fortlaufende Nummer
      '123/456/789',            // Steuernummer der Firma
      'Sender Nord',            // Name des Auftraggebers
      'DE123456789',            // USt-IdNr. des Auftraggebers
      'Rechnungsdatum',
      'Nettobetrag',
      'Umsatzsteuer 19',
      'Gesamtbetrag',
    ]) {
      expect(html, `fehlt: ${pflicht}`).toContain(pflicht)
    }
  })

  it('zählt den Jahreswechsel neu', async () => {
    const entwurf = await hole(`/api/companies/${firmaId}/invoices`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ client_id: kundeId, issue_date: '2027-01-03' }),
    })
    await hole(`/api/companies/${firmaId}/invoices/${entwurf.daten.id}/items`, tokenInhaber, {
      method: 'PUT',
      body: JSON.stringify({ items: [{ description: 'Neues Jahr', quantity_milli: 1000, unit_price_cents: 10000, tax_percent: 19 }] }),
    })
    const fest = await hole(`/api/companies/${firmaId}/invoices/${entwurf.daten.id}/issue`, tokenInhaber, {
      method: 'POST',
    })
    expect(fest.daten.number).toBe('2027-0001')
  })
})
