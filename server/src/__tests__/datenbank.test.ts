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

let PORT = 0
const datenverzeichnis = path.join(os.tmpdir(), `cutsheet-dbtest-${process.pid}-${Date.now()}`)

/**
 * Einen freien Port vom Betriebssystem erfragen.
 *
 * Ein fester Port geht schief, sobald ein Postgres aus einem frueheren Lauf
 * noch darauf liegt: Die neue Instanz startet nicht, und vitest meldet einen
 * Fehler ohne Text.
 */
async function freierPort(): Promise<number> {
  const net = await import('net')
  return new Promise((aufloesen, ablehnen) => {
    const horcher = net.createServer()
    horcher.unref()
    horcher.on('error', ablehnen)
    horcher.listen(0, '127.0.0.1', () => {
      const port = (horcher.address() as any).port
      horcher.close(() => aufloesen(port))
    })
  })
}

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
  PORT = await freierPort()
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
  // prüfen, Rolle bestimmen, Abfrage ausführen. Fehlerbehandlung wie in
  // index.ts, sonst hängt eine Anfrage, deren Route wirft, bis zum Zeitlimit.
  await import('express-async-errors')
  const { signToken } = await import('../middleware/auth')
  const { default: companiesRouter } = await import('../routes/companies')
  const { default: invoicesRouter } = await import('../routes/invoices')
  const { default: dateienRouter } = await import('../routes/dateien')
  const { default: sperrzeitenRouter } = await import('../routes/blackoutDates')
  const { default: authRouter } = await import('../routes/auth')
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  const { default: adminRouter } = await import('../routes/admin')
  app.use('/api/admin', adminRouter)
  app.use('/api', companiesRouter)
  app.use('/api', invoicesRouter)
  const { default: mahnwesenRouter } = await import('../routes/mahnwesen')
  app.use('/api', mahnwesenRouter)
  const { default: angeboteRouter } = await import('../routes/angebote')
  app.use('/api', angeboteRouter)
  app.use('/api', dateienRouter)
  const { default: anliegenRouter } = await import('../routes/anliegen')
  app.use('/api', anliegenRouter)
  // Der echte Server setzt req.user global per optionalAuth; dieser Router verlässt sich darauf
  const { optionalAuth } = await import('../middleware/auth')
  app.use('/api', optionalAuth, sperrzeitenRouter)
  const { default: vertraegeRouter } = await import('../routes/vertraege')
  const { default: abnahmeRouter } = await import('../routes/abnahme')
  const { default: agenturenRouter } = await import('../routes/agenturen')
  app.use('/api', optionalAuth, vertraegeRouter, abnahmeRouter, agenturenRouter)
  const loeschRouter = await Promise.all(
    ['cameraPresets', 'extras', 'insurances', 'musicCues', 'postplan', 'stickyNotes', 'vehicles', 'vfx']
      .map(async (name) => (await import(`../routes/${name}`)).default)
  )
  app.use('/api', optionalAuth, ...loeschRouter)
  const { default: motivvertragRouter } = await import('../routes/locationRelease')
  app.use('/api', optionalAuth, motivvertragRouter)
  const { default: drehbuchRouter } = await import('../routes/screenplay')
  app.use('/api', optionalAuth, drehbuchRouter)
  const { default: suchRouter } = await import('../routes/search')
  app.use('/api', optionalAuth, suchRouter)
  const { default: abschlussRouter } = await import('../routes/abschluss')
  app.use('/api', optionalAuth, abschlussRouter)
  const { default: kontakteRouter } = await import('../routes/contactsExport')
  app.use('/api', optionalAuth, kontakteRouter)
  const { default: einladungRouter } = await import('../routes/invites')
  app.use('/api', einladungRouter)
  const { default: dispoLinkRouter } = await import('../routes/confirmation')
  app.use('/api', dispoLinkRouter)
  const { default: kommentarRouter } = await import('../routes/sceneComments')
  app.use('/api', optionalAuth, kommentarRouter)
  const { default: drehplanRouter } = await import('../routes/drehplan')
  app.use('/api', optionalAuth, drehplanRouter)
  const { uebersetzeDatenbankfehler } = await import('../middleware/eingabe')
  app.use(uebersetzeDatenbankfehler)
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
  it('legt alle sieben Tabellen an', async () => {
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

  it('stellt eine wartende Mail nur einmal zu, auch bei zwei gleichzeitigen Läufen', async () => {
    // Schleife und Route laufen gleichzeitig. Mit einem langsamen Mailserver
    // griffen beide dieselbe Zeile, und die Mail kam zweimal an.
    const net = await import('net')
    const empfangen: string[] = []
    const falle = net.createServer((sock) => {
      let daten = false
      const antworte = (t: string) => setTimeout(() => sock.write(t + '\r\n'), 100)
      sock.write('220 falle\r\n')
      sock.on('data', (chunk) => {
        for (const zeile of chunk.toString().split('\r\n').filter(Boolean)) {
          if (daten) { if (zeile === '.') { daten = false; antworte('250 ok') } continue }
          if (/^RCPT/i.test(zeile)) empfangen.push(zeile)
          if (/^DATA/i.test(zeile)) { daten = true; antworte('354 los') } else if (/^QUIT/i.test(zeile)) sock.end('221 tschüss\r\n')
          else antworte('250 ok')
        }
      })
      sock.on('error', () => undefined)
    })
    await new Promise<void>((fertig) => falle.listen(0, '127.0.0.1', () => fertig()))
    const alt = { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT }
    process.env.SMTP_HOST = '127.0.0.1'
    process.env.SMTP_PORT = String((falle.address() as any).port)
    mailversand.vergissTransport()
    try {
      // Andere wartende Zeilen aus früheren Tests stören die Zählung nicht
      await db.run("UPDATE email_outbox SET status = 'ohne_versand' WHERE status = 'wartet'")
      await mailversand.reiheEin({
        projectId: projektId, betreff: 'Doppelt?', html: '<p>x</p>',
        empfaenger: [{ email: 'doppelt@cutsheet-falle.de' }], anlass: 'test',
      })
      await Promise.all([mailversand.sendeFaellige(), mailversand.sendeFaellige()])
      expect(empfangen).toHaveLength(1)
    } finally {
      process.env.SMTP_HOST = alt.host ?? ''
      if (!alt.host) delete process.env.SMTP_HOST
      if (alt.port) process.env.SMTP_PORT = alt.port
      else delete process.env.SMTP_PORT
      mailversand.vergissTransport()
      falle.close()
    }
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

  it('behält Mahnungen samt Anhang sechs Jahre, Dispos nicht', async () => {
    // § 257 HGB: abgesandte Handelsbriefe sechs Jahre - vorher nach 365 Tagen
    // gelöscht, das PDF nach 60
    const alt = async (anlass: string, tage: number) => {
      const anhang = (await db.run(
        `INSERT INTO email_attachments (project_id, filename, content, created_at) VALUES (?, ?, ?, NOW() - (? * INTERVAL '1 day'))`,
        [projektId, `${anlass}-${tage}.pdf`, Buffer.from('x'), tage])).id
      return (await db.run(
        `INSERT INTO email_outbox (project_id, subject, html, recipient_email, purpose, attachment_id, created_at)
         VALUES (?, ?, '<p>x</p>', 'k@example.com', ?, ?, NOW() - (? * INTERVAL '1 day'))`,
        [projektId, `${anlass} ${tage}`, anlass, anhang, tage])).id
    }
    const mahnung = await alt('mahnung', 400)
    const dispo = await alt('dispo', 400)
    const uralt = await alt('mahnung', 365 * 8)
    await aufbewahrung.raeumeMailanhaengeAuf()
    expect(await db.get('SELECT id FROM email_outbox WHERE id = ?', [mahnung])).toBeTruthy()
    expect(await db.get("SELECT id FROM email_attachments WHERE filename = 'mahnung-400.pdf'")).toBeTruthy()
    expect(await db.get('SELECT id FROM email_outbox WHERE id = ?', [dispo])).toBeUndefined()
    expect(await db.get("SELECT id FROM email_attachments WHERE filename = 'dispo-400.pdf'")).toBeUndefined()
    expect(await db.get('SELECT id FROM email_outbox WHERE id = ?', [uralt])).toBeUndefined()
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


describe('Angebote nach dem Festschreiben', () => {
  // Bis zum 03.11.2026 bis zur Annahme änderbar, obwohl der Dialog beim
  // Festschreiben "lässt sich danach nicht mehr ändern" sagt.
  it('sperrt das Festgeschriebene und kopiert es als neuen Entwurf', async () => {
    const firma = (await hole('/api/companies', tokenInhaber, { method: 'POST', body: JSON.stringify({ name: 'Angebotsfirma' }) })).daten.id
    const kunde = (await hole(`/api/companies/${firma}/clients`, tokenInhaber, { method: 'POST', body: JSON.stringify({ name: 'Sender' }) })).daten.id
    const angebot = (await hole(`/api/companies/${firma}/quotes`, tokenInhaber, { method: 'POST', body: JSON.stringify({ client_id: kunde }) })).daten.id
    const posten = { items: [{ description: 'Drehtag', quantity_milli: 2000, unit: 'Tag', unit_price_cents: 90000, tax_percent: 19 }] }
    expect((await hole(`/api/companies/${firma}/quotes/${angebot}/items`, tokenInhaber, { method: 'PUT', body: JSON.stringify(posten) })).status).toBe(200)
    expect((await hole(`/api/companies/${firma}/quotes/${angebot}/issue`, tokenInhaber, { method: 'POST' })).status).toBe(200)

    expect((await hole(`/api/companies/${firma}/quotes/${angebot}/items`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ items: [] }) })).status).toBe(400)
    expect((await hole(`/api/companies/${firma}/quotes/${angebot}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ intro: 'nachträglich' }) })).status).toBe(400)

    const kopie = await hole(`/api/companies/${firma}/quotes/${angebot}/kopie`, tokenInhaber, { method: 'POST' })
    expect(kopie.status).toBe(200)
    expect(kopie.daten).toMatchObject({ status: 'entwurf', number: '', client_id: kunde })
    expect(kopie.daten.items.map((p: any) => [p.description, p.quantity_milli, p.unit_price_cents])).toEqual([['Drehtag', 2000, 90000]])
    expect(Number(kopie.daten.net_cents)).toBe(180000)
    expect((await hole(`/api/companies/${firma}/quotes/${kopie.daten.id}/items`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ items: [] }) })).status).toBe(200)
  })
})

describe('Zweiter Faktor und Sitzungen', () => {
  let totpModul: typeof import('../lib/zweiterFaktor')
  let konto = { email: 'faktor@example.com', passwort: 'ein-langes-passwort-123' }
  let token = ''
  let schluessel = ''

  beforeAll(async () => {
    totpModul = await import('../lib/zweiterFaktor')
    const { hashPasswort } = await import('../lib/passwort')
    const hash = await hashPasswort(konto.passwort, 10)
    await db.run(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'user')",
      [konto.email, hash, 'Faktor Test']
    )
  }, 60_000)

  /** Anmeldung ohne Token - gibt die ganze Antwort zurück. */
  async function melde(code?: string) {
    const antwort = await fetch(`${basis}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: konto.email, password: konto.passwort, code }),
    })
    const rumpf: any = await antwort.json().catch(() => null)
    return { status: antwort.status, daten: rumpf?.data, fehler: rumpf?.error }
  }

  it('meldet ohne zweiten Faktor wie bisher an', async () => {
    const ergebnis = await melde()
    expect(ergebnis.status).toBe(200)
    expect(ergebnis.daten.token).toBeTruthy()
    token = ergebnis.daten.token
  })

  it('legt bei der Anmeldung eine Sitzung an', async () => {
    const sitzungen = await hole('/api/auth/sessions', token)
    expect(sitzungen.status).toBe(200)
    expect(sitzungen.daten.length).toBeGreaterThan(0)
    expect(sitzungen.daten.some((s: any) => s.diese)).toBe(true)
  })

  it('richtet den zweiten Faktor ein, aber erst der Code schaltet ihn scharf', async () => {
    const einrichtung = await hole('/api/auth/2fa/setup', token, { method: 'POST' })
    expect(einrichtung.status).toBe(200)
    schluessel = einrichtung.daten.schluessel
    expect(einrichtung.daten.url).toContain('otpauth://totp/')

    const stand = await hole('/api/auth/2fa', token)
    expect(stand.daten.eingerichtet).toBe(true)
    expect(stand.daten.aktiv, 'ohne Bestaetigung nicht scharf').toBe(false)

    // Anmeldung geht weiterhin ohne Code
    expect((await melde()).status).toBe(200)
  })

  it('weist einen falschen Code bei der Bestätigung zurück', async () => {
    const versuch = await hole('/api/auth/2fa/confirm', token, {
      method: 'POST',
      body: JSON.stringify({ code: '000000' }),
    })
    // Eins zu einer Million, dass 000000 gerade stimmt - dann waere der Test
    // zu Recht rot und beim naechsten Lauf wieder gruen.
    expect(versuch.status).toBe(400)
  })

  /**
   * Ein Code gilt nur einmal. Statt 30 Sekunden auf das nächste Zeitfenster
   * zu warten, vergisst der Test das zuletzt verwendete.
   */
  const neuesFenster = () => db.run('UPDATE user_totp SET last_step = NULL')

  it('schaltet mit richtigem Code scharf und gibt Wiederherstellungscodes aus', async () => {
    const code = totpModul.totp(schluessel)
    const bestaetigt = await hole('/api/auth/2fa/confirm', token, {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    expect(bestaetigt.status).toBe(200)
    expect(bestaetigt.daten.wiederherstellungscodes).toHaveLength(8)
    ;(globalThis as any).__codes = bestaetigt.daten.wiederherstellungscodes
    // Gespeichert ist nur die Ablageform, nicht der Code selbst.
    const zeile = await db.get('SELECT recovery_codes FROM user_totp WHERE recovery_codes LIKE ?', ['%scrypt$%'])
    for (const c of bestaetigt.daten.wiederherstellungscodes) {
      expect(zeile.recovery_codes).not.toContain(c)
      expect(zeile.recovery_codes).not.toContain(c.replace('-', ''))
    }
  })

  it('verlangt ab jetzt den Code bei der Anmeldung', async () => {
    const ohne = await melde()
    expect(ohne.status).toBe(401)
    expect(ohne.daten.zweiter_faktor).toBe(true)

    const falsch = await melde('123456')
    expect([400, 401]).toContain(falsch.status)

    await neuesFenster()
    const code = totpModul.totp(schluessel)
    const richtig = await melde(code)
    expect(richtig.status).toBe(200)
    expect(richtig.daten.token).toBeTruthy()
    token = richtig.daten.token

    // Derselbe Code ein zweites Mal: abgelehnt (RFC 6238, 5.2). Vorher galt
    // ein abgefangener Code rund 90 Sekunden lang beliebig oft.
    expect((await melde(code)).status).toBe(401)
  })

  it('nimmt einen Wiederherstellungscode an - und nur einmal', async () => {
    const codes: string[] = (globalThis as any).__codes
    const einer = codes[0]
    expect((await melde(einer)).status).toBe(200)
    expect((await melde(einer)).status, 'derselbe Code ein zweites Mal').toBe(401)

    const stand = await hole('/api/auth/2fa', token)
    expect(stand.daten.codes_uebrig).toBe(codes.length - 1)
  })

  it('hält den Anmeldeverlauf fest', async () => {
    const verlauf = await hole('/api/auth/login-events', token)
    expect(verlauf.status).toBe(200)
    expect(verlauf.daten.length).toBeGreaterThan(2)
    expect(verlauf.daten.some((e: any) => e.result === 'ok')).toBe(true)
    expect(verlauf.daten.some((e: any) => e.result !== 'ok'), 'auch Fehlversuche').toBe(true)
  })

  it('beendet eine Sitzung, und das Token gilt sofort nicht mehr', async () => {
    await neuesFenster()
    const zweite = await melde(totpModul.totp(schluessel))
    const zweitesToken = zweite.daten.token

    const sitzungen = await hole('/api/auth/sessions', token)
    const andere = sitzungen.daten.find((s: any) => !s.diese)
    expect(andere, 'es gibt eine zweite Sitzung').toBeTruthy()

    const beendet = await hole(`/api/auth/sessions/${andere.id}`, token, { method: 'DELETE' })
    expect(beendet.status).toBe(200)

    // Das Token der beendeten Sitzung ist sofort wertlos - irgendeines der
    // beiden muss es sein.
    const eins = await hole('/api/auth/sessions', zweitesToken)
    const zwei = await hole('/api/auth/sessions', token)
    expect([eins.status, zwei.status]).toContain(401)
  })

  it('schaltet den zweiten Faktor nur mit Passwort ab', async () => {
    await neuesFenster()
    const gueltig = await melde(totpModul.totp(schluessel))
    const frisch = gueltig.daten.token

    const ohne = await hole('/api/auth/2fa', frisch, {
      method: 'DELETE',
      body: JSON.stringify({ password: 'falsch' }),
    })
    expect(ohne.status).toBe(401)

    const mit = await hole('/api/auth/2fa', frisch, {
      method: 'DELETE',
      body: JSON.stringify({ password: konto.passwort }),
    })
    expect(mit.status).toBe(200)
    expect((await melde()).status, 'danach wieder ohne Code').toBe(200)
  })
})

describe('Tabellen ohne Spalte id', () => {
  /**
   * `db.run` haengt an jedes INSERT ohne RETURNING ein `RETURNING id` an.
   * Bei einer Tabelle mit zusammengesetztem Schluessel bricht das ab - zweimal
   * schon passiert (invoice_counters, user_totp). Dieser Test zaehlt die
   * betroffenen Tabellen auf, damit die naechste nicht erst in der Produktion
   * auffaellt.
   */
  it('nennt jede Tabelle, deren INSERT ein eigenes RETURNING braucht', async () => {
    const ohneId = await db.all(`
      SELECT t.table_name
        FROM information_schema.tables t
       WHERE t.table_schema = 'public'
         AND t.table_type = 'BASE TABLE'
         AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'id'
         )
       ORDER BY t.table_name
    `)
    const namen = ohneId.map((z: any) => z.table_name)
    // Wer hier etwas ergaenzt, muss im Code ein eigenes RETURNING setzen.
    expect(namen).toEqual(['creator_youtube_ignored', 'invoice_counters',
      'notification_settings', 'quote_counters', 'user_totp'])
  })
})


describe('Papierkorb', () => {
  let papierkorb: typeof import('../lib/papierkorb')

  beforeAll(async () => {
    papierkorb = await import('../lib/papierkorb')
  })

  /** Loeschen, wie es die Middleware tut: erst sichern, dann entfernen. */
  async function loesche(tabelle: string, id: number) {
    await papierkorb.inDenPapierkorb(tabelle, id, { userId: nutzerId })
    await db.run(`DELETE FROM ${tabelle === 'cast' ? '"cast"' : tabelle} WHERE id = ?`, [id])
  }

  it('legt eine geloeschte Szene mit allen Feldern ab', async () => {
    const szene = await db.run(
      'INSERT INTO scenes (project_id, scene_number, title, int_ext, day_night) VALUES (?, ?, ?, ?, ?)',
      [projektId, '12', 'Am Fluss, Abend', 'EXT', 'NACHT']
    )
    await loesche('scenes', szene.id)

    expect(await db.get('SELECT id FROM scenes WHERE id = ?', [szene.id])).toBeUndefined()

    const liste = await papierkorb.inhalt(projektId)
    const eintrag = liste.find(e => e.row_id === szene.id)
    expect(eintrag, 'die Szene liegt im Papierkorb').toBeTruthy()
    expect(eintrag.bezeichnung).toBe('Szene')
    expect(eintrag.label).toBe('Am Fluss, Abend')
    ;(globalThis as any).__szene = szene.id
  })

  it('holt sie mit derselben Kennung zurueck', async () => {
    const szeneId = (globalThis as any).__szene
    const liste = await papierkorb.inhalt(projektId)
    const eintrag = liste.find(e => e.row_id === szeneId)

    const ergebnis = await papierkorb.ausDemPapierkorb(eintrag.id, projektId)
    expect(ergebnis.wiederhergestellt).toBe(true)

    // Dieselbe Kennung, damit alles, was auf sie zeigt, wieder passt.
    const wieder = await db.get('SELECT * FROM scenes WHERE id = ?', [szeneId]) as any
    expect(wieder).toBeTruthy()
    expect(wieder.title).toBe('Am Fluss, Abend')
    expect(wieder.int_ext).toBe('EXT')
    expect(wieder.day_night).toBe('NACHT')
    expect(wieder.scene_number).toBe('12')
  })

  it('zeigt den zurueckgeholten Eintrag nicht mehr', async () => {
    const liste = await papierkorb.inhalt(projektId)
    expect(liste.some(e => e.row_id === (globalThis as any).__szene)).toBe(false)
  })

  it('findet Budget- und Equipment-Posten ueber die Elternzeile im Projekt', async () => {
    // Beide Tabellen haben keine eigene project_id. Vorher lagen sie mit
    // project_id NULL im Papierkorb und tauchten in keinem Projekt auf.
    const fassung = await db.run('INSERT INTO budget_versions (project_id, name) VALUES (?, ?)', [projektId, 'Papierkorb'])
    const posten = await db.run(
      'INSERT INTO budget_lines (budget_version_id, category, description, quantity, unit_price_cents, total_cents) VALUES (?, ?, ?, ?, ?, ?)',
      [fassung.id, '1000 - Stab', 'Kameraassistenz', 1, 25000, 25000])
    await db.run('UPDATE budget_versions SET total_cents = 25000 WHERE id = ?', [fassung.id])
    const liste = await db.run('INSERT INTO equipment_lists (project_id, name) VALUES (?, ?)', [projektId, 'Kamera'])
    const geraet = await db.run('INSERT INTO equipment_items (equipment_list_id, item) VALUES (?, ?)', [liste.id, 'Stativ'])

    await loesche('budget_lines', posten.id)
    await db.run('UPDATE budget_versions SET total_cents = 0 WHERE id = ?', [fassung.id])
    await loesche('equipment_items', geraet.id)

    const inhalt = await papierkorb.inhalt(projektId)
    const budget = inhalt.find(e => e.table_name === 'budget_lines' && e.row_id === posten.id)
    const equipment = inhalt.find(e => e.table_name === 'equipment_items' && e.row_id === geraet.id)
    expect(budget?.label).toBe('Kameraassistenz')
    expect(equipment?.label).toBe('Stativ')

    // Zurueckgeholt zaehlt die Position wieder zur Summe der Fassung
    expect((await papierkorb.ausDemPapierkorb(budget.id, projektId)).wiederhergestellt).toBe(true)
    const summe = await db.get('SELECT total_cents FROM budget_versions WHERE id = ?', [fassung.id]) as any
    expect(Number(summe.total_cents)).toBe(25000)
  })

  it('holt nichts zweimal zurueck', async () => {
    const szene = await db.run(
      'INSERT INTO scenes (project_id, scene_number, title) VALUES (?, ?, ?)',
      [projektId, '13', 'Zweimal']
    )
    await loesche('scenes', szene.id)
    const eintrag = (await papierkorb.inhalt(projektId)).find(e => e.row_id === szene.id)

    expect((await papierkorb.ausDemPapierkorb(eintrag.id, projektId)).wiederhergestellt).toBe(true)
    const zweiter = await papierkorb.ausDemPapierkorb(eintrag.id, projektId)
    expect(zweiter.wiederhergestellt).toBe(false)
  })

  it('haelt die Papierkoerbe zweier Projekte auseinander', async () => {
    const fremdesProjekt = await db.run(
      'INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Fremd', fremdeId])
    const szene = await db.run(
      'INSERT INTO scenes (project_id, scene_number, title) VALUES (?, ?, ?)',
      [fremdesProjekt.id, '1', 'Geheim'])
    await loesche('scenes', szene.id)

    const eigener = await papierkorb.inhalt(projektId)
    expect(eigener.some(e => e.label === 'Geheim')).toBe(false)
    const anderer = await papierkorb.inhalt(fremdesProjekt.id)
    expect(anderer.some(e => e.label === 'Geheim')).toBe(true)
  })

  it('sichert nichts, was nicht beobachtet wird', async () => {
    const vorher = await db.get('SELECT COUNT(*) AS c FROM deleted_items')
    expect(await papierkorb.inDenPapierkorb('invoices', 1, {})).toBe(false)
    const nachher = await db.get('SELECT COUNT(*) AS c FROM deleted_items')
    expect(Number(nachher.c)).toBe(Number(vorher.c))
  })

  it('meldet ehrlich, wenn es nichts zu sichern gibt', async () => {
    expect(await papierkorb.inDenPapierkorb('scenes', 999999, {})).toBe(false)
  })
})

describe('Suche', () => {
  /**
   * In SQLite war `LIKE` fuer ASCII unempfindlich gegenueber Gross- und
   * Kleinschreibung, in PostgreSQL ist es das nicht. Nach dem Umzug fand
   * "Jana" fuenfzig Treffer und "jana" keinen - gemessen an einer
   * Grossproduktion mit 896 Drehbuchbloecken.
   */
  it('findet unabhaengig von Gross- und Kleinschreibung', async () => {
    const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Suchprojekt', nutzerId])
    await db.run(
      'INSERT INTO scenes (project_id, scene_number, title, description) VALUES (?, ?, ?, ?)',
      [projekt.id, '1', 'Jana im Praesidium', 'Jana betritt das Polizeipraesidium']
    )
    await db.run(
      'INSERT INTO crew (project_id, name, role) VALUES (?, ?, ?)',
      [projekt.id, 'Mara Lindqvist', 'Szenenbild']
    )

    const treffer = async (wort: string) => {
      const zeilen = await db.all(
        `SELECT id FROM scenes WHERE project_id = ? AND (title ILIKE ? OR description ILIKE ?)`,
        [projekt.id, `%${wort}%`, `%${wort}%`]
      )
      return zeilen.length
    }

    expect(await treffer('Jana')).toBe(1)
    expect(await treffer('jana'), 'klein geschrieben').toBe(1)
    expect(await treffer('JANA'), 'gross geschrieben').toBe(1)
    expect(await treffer('praesidium'), 'mitten im Wort und klein').toBe(1)
    expect(await treffer('gibtsnicht')).toBe(0)

    // Zum Vergleich: so war es vorher
    const empfindlich = await db.all(
      `SELECT id FROM scenes WHERE project_id = ? AND title LIKE ?`,
      [projekt.id, '%jana%']
    )
    expect(empfindlich.length, 'LIKE bleibt empfindlich - deshalb ILIKE').toBe(0)
  })
})

describe('Drehplan laedt in zwei Abfragen', () => {
  /**
   * Vorher lief je Drehtag ein eigenes Laden, also zwei Abfragen pro Tag.
   * Gemessen an 45 Drehtagen: 1,95 Sekunden. Mit zwei Abfragen sind es
   * Millisekunden, und die Dauer waechst nicht mehr mit der Zahl der Tage.
   */
  it('ordnet jedem Tag seine Szenen zu und rechnet Achtel und Minuten', async () => {
    const { ladeDrehtageMitSzenen } = await import('../routes/drehplan')
    const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Drehplanprojekt', nutzerId])

    const motiv = await db.run('INSERT INTO locations (project_id, name) VALUES (?, ?)', [projekt.id, 'Wohnkueche'])
    const szenen: number[] = []
    for (const [nummer, achtel, minuten] of [['1', 4, 30], ['2', 8, 60], ['3', 2, 15]] as Array<[string, number, number]>) {
      const s = await db.run(
        'INSERT INTO scenes (project_id, scene_number, title, eighths, estimated_minutes, location_id) VALUES (?, ?, ?, ?, ?, ?)',
        [projekt.id, nummer, `Szene ${nummer}`, achtel, minuten, motiv.id]
      )
      szenen.push(s.id)
    }

    const tag1 = await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, ?)', [projekt.id, '2026-11-02'])
    const tag2 = await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 2, ?)', [projekt.id, '2026-11-03'])
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag1.id, szenen[0]])
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 1)', [tag1.id, szenen[1]])
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag2.id, szenen[2]])

    const tage = await ladeDrehtageMitSzenen(projekt.id)
    expect(tage).toHaveLength(2)

    expect(tage[0].scenes).toHaveLength(2)
    expect(tage[0].total_eighths).toBe(12)
    expect(tage[0].estimated_minutes).toBe(90)
    expect(tage[0].scenes[0].location_name).toBe('Wohnkueche')

    expect(tage[1].scenes).toHaveLength(1)
    expect(tage[1].total_eighths).toBe(2)
  })

  it('gibt einen Tag ohne Szenen mit leerer Liste zurueck', async () => {
    const { ladeDrehtageMitSzenen } = await import('../routes/drehplan')
    const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Leerer Plan', nutzerId])
    await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, ?)', [projekt.id, '2026-11-05'])

    const tage = await ladeDrehtageMitSzenen(projekt.id)
    expect(tage).toHaveLength(1)
    expect(tage[0].scenes).toEqual([])
    expect(tage[0].total_eighths).toBe(0)
  })

  it('gibt bei einem Projekt ohne Drehtage eine leere Liste zurueck', async () => {
    const { ladeDrehtageMitSzenen } = await import('../routes/drehplan')
    const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Ohne Plan', nutzerId])
    expect(await ladeDrehtageMitSzenen(projekt.id)).toEqual([])
  })
})

describe('Abfragen zaehlen', () => {
  /**
   * Nicht die Laufzeit messen - die schwankt -, sondern die Zahl der
   * Abfragen. Genau daran lagen die drei Flaschenhaelse: eine Abfrage je
   * Zeile statt einer fuer alle.
   *
   * Gemessen an der Grossproduktion vor dem Umbau: Drehplan 1,95 s bei 45
   * Tagen, Arbeitszeiten-Export 2,9 s bei 2060 Zeilen, Honoraruebersicht
   * 1,3 s bei 135 Personen. Danach: 0,02 s, 0,06 s und 0,05 s.
   */
  async function zaehleAbfragen<T>(lauf: () => Promise<T>): Promise<{ ergebnis: T; abfragen: number }> {
    const modul = await import('../db')
    const echtesAll = modul.db.all.bind(modul.db)
    const echtesGet = modul.db.get.bind(modul.db)
    let abfragen = 0
    ;(modul.db as any).all = (...args: any[]) => { abfragen++; return (echtesAll as any)(...args) }
    ;(modul.db as any).get = (...args: any[]) => { abfragen++; return (echtesGet as any)(...args) }
    try {
      const ergebnis = await lauf()
      return { ergebnis, abfragen }
    } finally {
      ;(modul.db as any).all = echtesAll
      ;(modul.db as any).get = echtesGet
    }
  }

  it('laedt den Drehplan mit zwei Abfragen, egal wie viele Tage', async () => {
    const { ladeDrehtageMitSzenen } = await import('../routes/drehplan')
    const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Viele Tage', nutzerId])

    // Je Tag eine eigene Szene: Eine Szene gehoert immer nur zu einem Drehtag,
    // dafuer sorgt eine eindeutige Bedingung in der Datenbank.
    for (let tag = 1; tag <= 30; tag++) {
      const szene = await db.run(
        'INSERT INTO scenes (project_id, scene_number, title, eighths) VALUES (?, ?, ?, 4)',
        [projekt.id, String(tag), `Szene ${tag}`]
      )
      const d = await db.run(
        'INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, ?, ?)',
        [projekt.id, tag, `2026-11-${String(tag).padStart(2, '0')}`]
      )
      await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [d.id, szene.id])
    }

    const { ergebnis, abfragen } = await zaehleAbfragen(() => ladeDrehtageMitSzenen(projekt.id))
    expect(ergebnis).toHaveLength(30)
    expect(abfragen, 'eine Abfrage fuer die Tage, eine fuer die Szenen').toBe(2)
  })

  it('zaehlt auch bei einem leeren Plan nicht mehr als noetig', async () => {
    const { ladeDrehtageMitSzenen } = await import('../routes/drehplan')
    const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Leer', nutzerId])
    const { abfragen } = await zaehleAbfragen(() => ladeDrehtageMitSzenen(projekt.id))
    expect(abfragen, 'ohne Tage braucht es die zweite Abfrage nicht').toBe(1)
  })
})

/**
 * Die Protokollsuche.
 *
 * Das Protokoll lieferte vorher die letzten 200 Zeilen und sonst nichts. Bei
 * einer Produktion mit taeglichen Aenderungen sind 200 Zeilen zwei Tage - was
 * davor passiert ist, war von aussen nicht erreichbar, obwohl es in der
 * Datenbank stand.
 *
 * Geprueft wird hier die Einschraenkung selbst, nicht die Route: Sie ist der
 * Teil, der falsch sein kann, ohne dass es auffaellt - ein Filter, der
 * stillschweigend zu viel oder zu wenig findet, sieht in der Oberflaeche aus
 * wie eine korrekte Antwort.
 */
describe('Protokollsuche', () => {
  let projekt: any

  beforeAll(async () => {
    projekt = await db.run('INSERT INTO projects (title) VALUES (?)', ['Protokollprojekt'])
    const zeilen: Array<[string, string, string, string]> = [
      ['2026-09-01 08:00:00+00', 'Jana Berg', 'update', 'shoot_days'],
      ['2026-09-15 09:30:00+00', 'Jana Berg', 'create', 'scenes'],
      ['2026-10-01 10:00:00+00', 'Tom Klein', 'delete', 'scenes'],
      ['2026-10-12 23:30:00+00', 'Tom Klein', 'update', 'call_sheets'],
    ]
    for (const [wann, wer, was, wo] of zeilen) {
      await db.run(
        `INSERT INTO audit_log (project_id, user_name, action, entity_type, new_value, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projekt.id, wer, was, wo, JSON.stringify({ title: `${was} in ${wo}` }), wann]
      )
    }
  })

  /**
   * Die Einschraenkung der Route selbst. Bis zum 03.11.2026 stand hier eine
   * nachgebaute Kopie - eine Aenderung an der Route waere dem Test entgangen.
   */
  const finde = async (q: Record<string, string>) => {
    const { einschraenkung } = await import('../routes/audit')
    const { sql, werte } = einschraenkung(projekt.id, q)
    return (await db.all(
      `SELECT * FROM audit_log WHERE ${sql} ORDER BY created_at DESC`,
      werte
    )) as any[]
  }

  it('findet ohne Filter alles aus dem Projekt', async () => {
    expect((await finde({})).length).toBe(4)
  })

  it('sucht Namen unabhaengig von Gross- und Kleinschreibung', async () => {
    // Der Grund fuer ILIKE: In PostgreSQL findet LIKE 'jana%' niemanden, der
    // Jana heisst. In SQLite fand es sie - deshalb fiel es lange nicht auf.
    expect((await finde({ nutzer: 'jana' })).length).toBe(2)
    expect((await finde({ nutzer: 'JANA' })).length).toBe(2)
  })

  it('grenzt den Tag in Berliner Zeit ab, nicht in der des Servers', async () => {
    // Der letzte Eintrag steht auf 23:30 Uhr UTC - in Berlin ist das 01:30 am
    // 13. Oktober. Er gehoert also **nicht** zum 12., und genau das ist der
    // Punkt: Ohne `AT TIME ZONE` entscheidet die Zeitzone der Datenbank-
    // sitzung darueber, und dieselbe Suche liefert lokal und beim Hoster
    // verschiedene Mengen.
    const bisZwoelfter = await finde({ von: '2026-10-01', bis: '2026-10-12' })
    expect(bisZwoelfter.map((z) => z.entity_type)).toEqual(['scenes'])

    const bisDreizehnter = await finde({ von: '2026-10-01', bis: '2026-10-13' })
    expect(bisDreizehnter.map((z) => z.entity_type)).toEqual(['call_sheets', 'scenes'])
  })

  it('nimmt den ersten Tag des Zeitraums ganz mit', async () => {
    // 00:00:00 als untere Grenze: Ein Eintrag um 08:00 Uhr am 1. September
    // muss bei von=2026-09-01 dabei sein.
    const treffer = await finde({ von: '2026-09-01', bis: '2026-09-01' })
    expect(treffer.map((z) => z.entity_type)).toEqual(['shoot_days'])
  })

  it('verknuepft mehrere Angaben mit UND', async () => {
    expect((await finde({ nutzer: 'Tom', aktion: 'update' })).length).toBe(1)
    expect((await finde({ nutzer: 'Tom', bereich: 'scenes' })).length).toBe(1)
    expect((await finde({ nutzer: 'Jana', aktion: 'delete' })).length).toBe(0)
  })

  it('zaehlt die Treffer unabhaengig von der Seitengrenze', async () => {
    const summe = (await db.get('SELECT COUNT(*) AS anzahl FROM audit_log WHERE project_id = ?', [projekt.id])) as any
    const seite = (await db.all(
      'SELECT * FROM audit_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [projekt.id, 2, 2]
    )) as any[]
    // Die Oberflaeche zeigt "2 von 4" - die Gesamtzahl darf nicht die
    // Seitenlaenge sein.
    expect(Number(summe.anzahl)).toBe(4)
    expect(seite.length).toBe(2)
    expect(seite[0].entity_type).toBe('scenes')
  })
})

describe('Ablaufende Nachweise einer Firma', () => {
  // Gefunden mit src/scripts/zugriffsscan.ts: Die Route hatte nur requireAuth.
  // Jede angemeldete Person sah Dateinamen und Projekttitel jeder Firma.
  let firma = 0
  let tokenAussen = ''

  beforeAll(async () => {
    firma = (await db.run('INSERT INTO companies (name, owner_id) VALUES (?, ?)', ['Nachweis GmbH', nutzerId])).id
    const projekt = await db.run('INSERT INTO projects (title, owner_id, company_id) VALUES (?, ?, ?)', ['Nachtdreh', nutzerId, firma])
    await db.run(
      "INSERT INTO project_files (project_id, filename, title, content, bytes, valid_until) VALUES (?, 'genehmigung.pdf', 'Drehgenehmigung Hafen', ?, 4, CURRENT_DATE - 1)",
      [projekt.id, Buffer.from('test')]
    )
    const aussen = await db.run(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, 'x', 'Außenstehende', 'user')",
      ['aussen@example.com']
    )
    const { signToken } = await import('../middleware/auth')
    tokenAussen = signToken({ id: aussen.id, email: 'aussen@example.com', name: 'Außenstehende', role: 'user' })
  })

  it('zeigt der Inhaberin den abgelaufenen Nachweis', async () => {
    const antwort = await hole(`/api/companies/${firma}/dateien/fristen`, tokenInhaber)
    expect(antwort.status).toBe(200)
    expect(antwort.daten.abgelaufen).toBe(1)
    expect(antwort.daten.dateien[0].title).toBe('Drehgenehmigung Hafen')
  })

  it('verweigert ihn einer Person außerhalb der Firma', async () => {
    const antwort = await hole(`/api/companies/${firma}/dateien/fristen`, tokenAussen)
    expect(antwort.status).toBe(403)
    expect(antwort.daten ?? null).toBeNull()
  })
})

describe('Sperrzeiten nur für die eigene Besetzung', () => {
  // Gefunden mit dem schreibenden Teil von src/scripts/zugriffsscan.ts: Die
  // Route nahm jede castId an. Die Liste holt den Namen per JOIN dazu - so
  // landete der Name einer fremden Darstellerin im eigenen Projekt.
  it('lehnt eine Darstellerin aus einem fremden Projekt ab', async () => {
    const fremdesProjekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Geheimdreh', nutzerId])
    const darstellerin = await db.run('INSERT INTO "cast" (project_id, actor_name) VALUES (?, ?)', [fremdesProjekt.id, 'Geheime Hauptrolle'])
    const eigenes = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Eigener Dreh', fremdeId])

    const antwort = await hole(`/api/projects/${eigenes.id}/cast/${darstellerin.id}/blackout-dates`, tokenFremd, {
      method: 'POST',
      body: JSON.stringify({ start_date: '2026-11-01', end_date: '2026-11-02' }),
    })
    expect(antwort.status).toBe(404)

    const liste = await hole(`/api/projects/${eigenes.id}/blackout-dates`, tokenFremd)
    expect(JSON.stringify(liste.daten)).not.toContain('Geheime Hauptrolle')
  })

  it('nimmt die eigene Darstellerin an', async () => {
    const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Mit Besetzung', nutzerId])
    const darstellerin = await db.run('INSERT INTO "cast" (project_id, actor_name) VALUES (?, ?)', [projekt.id, 'Lena Hoffmann'])
    const antwort = await hole(`/api/projects/${projekt.id}/cast/${darstellerin.id}/blackout-dates`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ start_date: '2026-11-01', end_date: '2026-11-02' }),
    })
    expect(antwort.status).toBe(201)
  })
})

describe('Verschickte Links zurückziehen', () => {
  // Vorher gab es keinen Weg zurück: Ein Vertrag an die falsche Adresse oder
  // ein überholter Text blieb über den Link für immer bestätigbar.
  let projekt = 0
  beforeAll(async () => {
    projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Links zurück', nutzerId])).id
  })

  it('Vertrag: zurückgezogen gilt der Link nicht mehr und lässt sich nicht neu schicken', async () => {
    const vertrag = await db.run(
      "INSERT INTO contracts (project_id, person_type, person_id, title, status, token) VALUES (?, 'cast', 1, 'Darstellervertrag', 'versendet', ?)",
      [projekt, 'v'.repeat(48)]
    )
    expect((await hole(`/api/vertrag/${'v'.repeat(48)}`, '')).status).toBe(200)
    const zurueck = await hole(`/api/projects/${projekt}/vertraege/${vertrag.id}/zurueckziehen`, tokenInhaber, { method: 'POST', body: '{}' })
    expect(zurueck.status).toBe(200)
    expect((await hole(`/api/vertrag/${'v'.repeat(48)}`, '')).status).toBe(404)
    const bestaetigen = await hole(`/api/vertrag/${'v'.repeat(48)}/bestaetigen`, '', { method: 'POST', body: JSON.stringify({ name: 'Zu spät' }) })
    expect(bestaetigen.status).toBe(404)
    const neu = await hole(`/api/projects/${projekt}/vertraege/${vertrag.id}/senden`, tokenInhaber, { method: 'POST', body: '{}' })
    expect(neu.status).toBe(400)
  })

  it('Vertrag: ein bestätigter bleibt, wie er ist', async () => {
    const vertrag = await db.run(
      "INSERT INTO contracts (project_id, person_type, person_id, title, status) VALUES (?, 'cast', 1, 'Bestätigt', 'bestaetigt')",
      [projekt]
    )
    const zurueck = await hole(`/api/projects/${projekt}/vertraege/${vertrag.id}/zurueckziehen`, tokenInhaber, { method: 'POST', body: '{}' })
    expect(zurueck.status).toBe(400)
    expect((await db.get('SELECT status FROM contracts WHERE id = ?', [vertrag.id])).status).toBe('bestaetigt')
  })

  it('Vertrag: Fremde können nicht zurückziehen', async () => {
    const vertrag = await db.run(
      "INSERT INTO contracts (project_id, person_type, person_id, title, status) VALUES (?, 'cast', 1, 'Fremd', 'versendet')",
      [projekt]
    )
    const zurueck = await hole(`/api/projects/${projekt}/vertraege/${vertrag.id}/zurueckziehen`, tokenFremd, { method: 'POST', body: '{}' })
    expect(zurueck.status).toBe(403)
  })

  it('Abnahme: zurückgezogen gilt der Link nicht mehr', async () => {
    const runde = await db.run(
      "INSERT INTO reviews (project_id, recipient_name, status, token) VALUES (?, 'Kundin', 'versendet', ?)",
      [projekt, 'a'.repeat(48)]
    )
    expect((await hole(`/api/abnahme/${'a'.repeat(48)}`, '')).status).toBe(200)
    const zurueck = await hole(`/api/projects/${projekt}/abnahmen/${runde.id}/zurueckziehen`, tokenInhaber, { method: 'POST', body: '{}' })
    expect(zurueck.status).toBe(200)
    expect((await hole(`/api/abnahme/${'a'.repeat(48)}`, '')).status).toBe(404)
    const entscheiden = await hole(`/api/abnahme/${'a'.repeat(48)}/entscheiden`, '', { method: 'POST', body: JSON.stringify({ name: 'X', abgenommen: true }) })
    expect(entscheiden.status).toBe(404)
  })

  it('Casting: Link weg nach Zurückziehen, fremde role_id wird nicht übernommen', async () => {
    const anfrage = await db.run(
      "INSERT INTO casting_requests (project_id, subject, status, token) VALUES (?, 'Hauptrolle', 'versendet', ?)",
      [projekt, 'c'.repeat(48)]
    )
    const rolle = await db.run("INSERT INTO casting_request_roles (request_id, role_name) VALUES (?, 'Lena')", [anfrage.id])
    const andere = await db.run("INSERT INTO casting_requests (project_id, subject) VALUES (?, 'Andere')", [projekt])
    const fremdeRolle = await db.run("INSERT INTO casting_request_roles (request_id, role_name) VALUES (?, 'Fremd')", [andere.id])

    const antwort = await hole(`/api/casting/${'c'.repeat(48)}/antwort`, '', {
      method: 'POST',
      body: JSON.stringify({ vorschlaege: [
        { role_id: rolle.id, actor_name: 'Passt' },
        { role_id: fremdeRolle.id, actor_name: 'Daneben' },
      ] }),
    })
    expect(antwort.status).toBe(200)
    const gespeichert = (await db.all('SELECT actor_name, role_id FROM casting_proposals WHERE request_id = ? ORDER BY id', [anfrage.id])) as any[]
    expect(gespeichert).toEqual([
      { actor_name: 'Passt', role_id: rolle.id },
      { actor_name: 'Daneben', role_id: null },
    ])

    const zurueck = await hole(`/api/projects/${projekt}/casting-anfragen/${anfrage.id}/zurueckziehen`, tokenInhaber, { method: 'POST', body: '{}' })
    expect(zurueck.status).toBe(200)
    expect((await hole(`/api/casting/${'c'.repeat(48)}`, '')).status).toBe(404)
  })
})

describe('Löschen nur im eigenen Projekt', () => {
  // Gemeldet vom Arbeiter in Runde 3: Diese Routen löschten per
  // `DELETE ... WHERE id = ?`. Wer in irgendeinem Projekt Mitglied war, konnte
  // über das eigene Projekt im Pfad Zeilen fremder Projekte löschen.
  const faelle: Array<[string, string]> = [
    ['camera-presets', 'camera_presets'], ['extras', 'extras'], ['insurances', 'insurances'],
    ['music-cues', 'music_cues'], ['post-phases', 'post_phases'], ['sticky-notes', 'sticky_notes'],
    ['vehicles', 'vehicles'], ['vfx', 'vfx_shots'], ['vertragsvorlagen', 'contract_templates'],
  ]
  let opferProjekt = 0
  let eigenesProjekt = 0
  beforeAll(async () => {
    opferProjekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Opfer', nutzerId])).id
    eigenesProjekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Täter', fremdeId])).id
  })

  for (const [pfad, tabelle] of faelle) {
    it(`${pfad}: fremde Zeile bleibt stehen, eigene lässt sich löschen`, async () => {
      const fremd = await db.run(`INSERT INTO ${tabelle} (project_id) VALUES (?)`, [opferProjekt])
      const quer = await hole(`/api/projects/${eigenesProjekt}/${pfad}/${fremd.id}`, tokenFremd, { method: 'DELETE' })
      expect(quer.status).not.toBe(200)
      expect(await db.get(`SELECT id FROM ${tabelle} WHERE id = ?`, [fremd.id])).toBeTruthy()

      const eigen = await db.run(`INSERT INTO ${tabelle} (project_id) VALUES (?)`, [eigenesProjekt])
      const weg = await hole(`/api/projects/${eigenesProjekt}/${pfad}/${eigen.id}`, tokenFremd, { method: 'DELETE' })
      expect(weg.status).toBe(200)
      expect(await db.get(`SELECT id FROM ${tabelle} WHERE id = ?`, [eigen.id])).toBeFalsy()
    })
  }
})

describe('Mahnung trägt die Anschrift', () => {
  // Gefunden mit src/scripts/pdfprobe.ts: Die Mahnung druckte nur Name und
  // Ansprechperson. Die Abfrage holte Straße, PLZ und Ort nicht ab - im
  // Fensterumschlag käme der Brief nicht an.
  it('liefert Straße, PLZ und Ort des Auftraggebers mit', async () => {
    const { OFFENE_RECHNUNGEN } = await import('../routes/mahnwesen')
    const firma = (await db.run('INSERT INTO companies (name, owner_id) VALUES (?, ?)', ['Mahn GmbH', nutzerId])).id
    const kunde = await db.run(
      "INSERT INTO company_clients (company_id, name, address, zip, city) VALUES (?, 'Stadtwerke', 'Königsstraße 12', '45879', 'Gelsenkirchen')",
      [firma]
    )
    await db.run("INSERT INTO invoices (company_id, client_id, number, status) VALUES (?, ?, 'M-1', 'versendet')", [firma, kunde.id])
    const zeile = (await db.get(OFFENE_RECHNUNGEN, [firma])) as any
    expect(zeile.address).toBe('Königsstraße 12')
    expect(zeile.zip).toBe('45879')
    expect(zeile.city).toBe('Gelsenkirchen')
  })
})

describe('Eine Zahlung zählt überall gleich', () => {
  // Die Rechnungsseite erfasste über POST .../payment nur paid_cents, ohne
  // Zeile in invoice_payments. Offene Posten und Mahnwesen rechnen aber mit
  // invoice_payments - die bezahlte Rechnung stand dort weiter offen und
  // wurde zur Mahnung vorgeschlagen. Die nächste Teilzahlung über die
  // Offene-Posten-Seite überschrieb paid_cents dann mit der eigenen Summe.
  let firma = 0
  let rechnung = 0
  beforeAll(async () => {
    firma = (await db.run('INSERT INTO companies (name, owner_id) VALUES (?, ?)', ['Zahl GmbH', nutzerId])).id
    const kunde = await db.run("INSERT INTO company_clients (company_id, name) VALUES (?, 'Kunde')", [firma])
    rechnung = (await db.run(
      "INSERT INTO invoices (company_id, client_id, number, status, gross_cents, net_cents, due_date) VALUES (?, ?, 'Z-1', 'versendet', 11900, 10000, CURRENT_DATE - 40)",
      [firma, kunde.id]
    )).id
  })

  it('der Knopf auf der Rechnung legt eine Zahlungszeile an', async () => {
    const antwort = await hole(`/api/companies/${firma}/invoices/${rechnung}/payment`, tokenInhaber, { method: 'POST', body: '{}' })
    expect(antwort.status).toBe(200)
    const zeilen = (await db.all('SELECT amount_cents FROM invoice_payments WHERE invoice_id = ?', [rechnung])) as any[]
    expect(zeilen.map((z) => Number(z.amount_cents))).toEqual([11900])
    const stand = (await db.get('SELECT paid_cents, status FROM invoices WHERE id = ?', [rechnung])) as any
    expect(Number(stand.paid_cents)).toBe(11900)
    expect(stand.status).toBe('bezahlt')
  })
})


describe('DATEV: Storno bucht zum eigenen Datum zurück', () => {
  // Vorher: Eine stornierte Rechnung stand nur noch als Habenbuchung zum
  // Rechnungsdatum im Export. Ein neuer Export des Rechnungsmonats zeigte
  // negativen Umsatz statt null, und im Monat des Stornos fehlte er ganz.
  let firma = 0
  beforeAll(async () => {
    firma = (await db.run(
      "INSERT INTO companies (name, owner_id, datev_berater, datev_mandant) VALUES ('Storno GmbH', ?, 1001, 1)",
      [nutzerId]
    )).id
    const kunde = await db.run("INSERT INTO company_clients (company_id, name, debitor_number) VALUES (?, 'Kunde', '10001')", [firma])
    const rechnung = await db.run(
      "INSERT INTO invoices (company_id, client_id, number, status, issue_date, tax_mode) VALUES (?, ?, 'S-1', 'versendet', '2026-09-15', 'regel')",
      [firma, kunde.id]
    )
    await db.run(
      'INSERT INTO invoice_items (invoice_id, quantity_milli, unit_price_cents, tax_percent) VALUES (?, 1000, 10000, 19)',
      [rechnung.id]
    )
    // Storniert im Oktober, über die echte Route
    const antwort = await hole(`/api/companies/${firma}/invoices/${rechnung.id}/cancel`, tokenInhaber, { method: 'POST', body: '{}' })
    expect(antwort.status).toBe(200)
    await db.run("UPDATE invoices SET cancelled_on = '2026-10-05' WHERE id = ?", [rechnung.id])
  })

  it('September: die Rechnung im Soll, wie damals gebucht', async () => {
    const { buchungenBauen } = await import('../routes/buchhaltung')
    const { buchungen } = await buchungenBauen(firma, '2026-09-01', '2026-09-30')
    expect(buchungen.map((b: any) => [b.sollHaben, b.betragCents, b.datum])).toEqual([['S', 11900, '2026-09-15']])
  })

  it('Oktober: der Storno im Haben, zum Datum des Stornos', async () => {
    const { buchungenBauen } = await import('../routes/buchhaltung')
    const { buchungen } = await buchungenBauen(firma, '2026-10-01', '2026-10-31')
    expect(buchungen.map((b: any) => [b.sollHaben, b.betragCents, b.datum])).toEqual([['H', 11900, '2026-10-05']])
  })
})

describe('Umsatzsteuer: Storno mindert im eigenen Monat', () => {
  it('September behält die Steuer, Oktober zieht sie ab', async () => {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('USt GmbH', ?)", [nutzerId])).id
    const kunde = await db.run("INSERT INTO company_clients (company_id, name) VALUES (?, 'Kunde')", [firma])
    const r = await db.run(
      "INSERT INTO invoices (company_id, client_id, number, status, issue_date, tax_mode, cancelled_on) VALUES (?, ?, 'U-1', 'storniert', '2026-09-15', 'regel', '2026-10-05')",
      [firma, kunde.id]
    )
    await db.run('INSERT INTO invoice_items (invoice_id, quantity_milli, unit_price_cents, tax_percent) VALUES (?, 1000, 10000, 19)', [r.id])
    const sept = await hole(`/api/companies/${firma}/invoices/report/vat?von=2026-09-01&bis=2026-09-30`, tokenInhaber)
    const okt = await hole(`/api/companies/${firma}/invoices/report/vat?von=2026-10-01&bis=2026-10-31`, tokenInhaber)
    const beide = await hole(`/api/companies/${firma}/invoices/report/vat?von=2026-09-01&bis=2026-10-31`, tokenInhaber)
    expect(sept.daten.steuer_cents).toBe(1900)
    expect(okt.daten.steuer_cents).toBe(-1900)
    expect(beide.daten.steuer_cents).toBe(0)
  })
})

describe('SQLite-Zeitangaben bedeuten in Postgres dasselbe', () => {
  // toPg machte aus datetime('now', '-7 days') ein NOW() - INTERVAL '-7 days',
  // also sieben Tage in der Zukunft. Die Admin-Statistik "neu in den letzten
  // sieben Tagen" zählte damit nie jemanden.
  it("datetime('now', '-7 days') liegt sieben Tage in der Vergangenheit", async () => {
    const { toPg } = await import('../db')
    const zeile = (await db.get(
      toPg("SELECT EXTRACT(EPOCH FROM (NOW() - (datetime('now', '-7 days')))) / 86400 AS tage")
    )) as any
    expect(Math.round(Number(zeile.tage))).toBe(7)
  })
})

describe('Drehbuch-Import gegen echte Datenbank', () => {
  const fountain = 'Title: Nachtfalter\n\nINT. WOHNKÜCHE - NACHT\n\nLena sitzt am Tisch.\n\nLENA\nHörst du das?\n\nEXT. HINTERHOF - NACHT\n\nEin Falter.\n'
  let projekt = 0
  beforeAll(async () => {
    projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Import', nutzerId])).id
  })

  it('legt genau die Szenen des Drehbuchs an, ohne Phantomszene', async () => {
    const antwort = await hole(`/api/projects/${projekt}/fdx-import`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ xml: fountain, filename: 'nachtfalter.fountain' }),
    })
    expect(antwort.status).toBe(200)
    const szenen = (await db.all('SELECT scene_number, title FROM scenes WHERE project_id = ? ORDER BY sort_order', [projekt])) as any[]
    expect(szenen).toEqual([{ scene_number: '1', title: 'WOHNKÜCHE' }, { scene_number: '2', title: 'HINTERHOF' }])
  })

  it('hinterlässt bei einem Abbruch mittendrin keine halben Szenen', async () => {
    const leer = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Abbruch', nutzerId])).id
    // Szenenkopf geht durch, der Absatz danach scheitert in Postgres am Nullbyte
    const antwort = await hole(`/api/projects/${leer}/fdx-import`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ xml: 'INT. FLUR - TAG\n\nText\u0000kaputt\n', filename: 'kaputt.txt' }),
    })
    expect(antwort.status).toBe(400)
    const anzahl = (await db.get('SELECT COUNT(*) AS c FROM scenes WHERE project_id = ?', [leer])) as any
    expect(Number(anzahl.c)).toBe(0)
  })

  it('nummeriert einen zweiten Import weiter statt doppelt', async () => {
    await hole(`/api/projects/${projekt}/fdx-import`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ xml: fountain, filename: 'nochmal.fountain' }),
    })
    const nummern = ((await db.all('SELECT scene_number FROM scenes WHERE project_id = ? ORDER BY sort_order', [projekt])) as any[])
      .map((z) => z.scene_number)
    expect(nummern).toEqual(['1', '2', '3', '4'])
  })
})

describe('Auswertungen ohne Abfrage je Zeile', () => {
  async function zaehle(lauf: () => Promise<unknown>): Promise<number> {
    const modul = await import('../db')
    const echtesAll = modul.db.all.bind(modul.db)
    const echtesGet = modul.db.get.bind(modul.db)
    let abfragen = 0
    ;(modul.db as any).all = (...args: any[]) => { abfragen++; return (echtesAll as any)(...args) }
    ;(modul.db as any).get = (...args: any[]) => { abfragen++; return (echtesGet as any)(...args) }
    try { await lauf() } finally {
      ;(modul.db as any).all = echtesAll
      ;(modul.db as any).get = echtesGet
    }
    return abfragen
  }

  it('Umsatzsteuer: gleich viele Abfragen bei 5 und bei 40 Rechnungen', async () => {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Last GmbH', ?)", [nutzerId])).id
    const kunde = await db.run("INSERT INTO company_clients (company_id, name) VALUES (?, 'Kunde')", [firma])
    const anlegen = async (n: number) => {
      for (let i = 0; i < n; i++) {
        const r = await db.run(
          "INSERT INTO invoices (company_id, client_id, number, status, issue_date, tax_mode) VALUES (?, ?, ?, 'versendet', '2026-06-15', 'regel')",
          [firma, kunde.id, `L-${Math.random()}`]
        )
        await db.run('INSERT INTO invoice_items (invoice_id, quantity_milli, unit_price_cents, tax_percent) VALUES (?, 1000, 1000, 19)', [r.id])
      }
    }
    const pfad = `/api/companies/${firma}/invoices/report/vat?von=2026-06-01&bis=2026-06-30`
    await anlegen(5)
    const bei5 = await zaehle(() => hole(pfad, tokenInhaber))
    await anlegen(35)
    let antwort: any
    const bei40 = await zaehle(async () => { antwort = await hole(pfad, tokenInhaber) })
    expect(antwort.daten.anzahl).toBe(40)
    expect(antwort.daten.steuer_cents).toBe(40 * 190)
    expect(bei40).toBe(bei5)
  })
})

describe('Konten, die es so nicht mehr gibt', () => {
  /**
   * Gemessen am 24.10.2026: Die Rolle kam 30 Tage lang aus dem Token. Ein
   * gelöschtes Admin-Konto kam mit seinem alten Token weiter in die
   * Verwaltung, ein herabgestuftes ebenso.
   */
  it('kommen mit ihrem alten Token nicht mehr in die Verwaltung', async () => {
    const { signToken } = await import('../middleware/auth')
    const anlegen = async (mail: string) => {
      const r = await db.run(
        "INSERT INTO users (email, password_hash, name, role) VALUES (?, 'x', ?, 'admin')", [mail, mail]
      )
      return { id: r.id, token: signToken({ id: r.id, email: mail, name: mail, role: 'admin' }) }
    }
    const chefin = await anlegen('chefin@example.com')
    const zweite = await anlegen('zweite@example.com')

    expect((await hole('/api/admin/users', zweite.token)).status).toBe(200)

    const umstufen = await hole(`/api/admin/users/${zweite.id}/role`, chefin.token, {
      method: 'PUT', body: JSON.stringify({ role: 'user' }),
    })
    expect(umstufen.status).toBe(200)
    expect((await hole('/api/admin/users', zweite.token)).status).toBe(403)

    expect((await hole(`/api/admin/users/${zweite.id}`, chefin.token, { method: 'DELETE' })).status).toBe(200)
    const danach = await hole('/api/admin/users', zweite.token)
    expect(danach.status).toBe(401)
    expect(danach.fehler).toBe('Dieses Konto gibt es nicht mehr')
  })

  it('verlieren ihre Anmeldung, wenn ein Admin das Passwort zurücksetzt', async () => {
    const { signToken } = await import('../middleware/auth')
    const admin = await db.run(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, 'x', ?, 'admin')", ['reset-chef@example.com', 'Chef']
    )
    const chefToken = signToken({ id: admin.id, email: 'reset-chef@example.com', name: 'Chef', role: 'admin' })
    const konto = await hole('/api/auth/register', '', {
      method: 'POST',
      body: JSON.stringify({ name: 'Übernommen', email: 'uebernommen@example.com', password: 'Alt-Passwort-123' }),
    })
    expect(konto.status).toBe(201)
    const altesToken = konto.daten.token
    expect((await hole('/api/auth/me', altesToken)).status).toBe(200)

    const reset = await hole(`/api/admin/users/${konto.daten.user.id}/reset-password`, chefToken, {
      method: 'POST', body: JSON.stringify({ new_password: 'Neu-Passwort-456' }),
    })
    expect(reset.status).toBe(200)
    expect((await hole('/api/auth/me', altesToken)).status).toBe(401)
  })
})

describe('Projekte gelöschter Konten', () => {
  /**
   * Florian, 03.11.2026: nur 30 Tage behalten, bei erneuter Anmeldung mit
   * derselben Adresse zurückgeben. Vorher blieben sie nach einer
   * Admin-Löschung ohne Inhaber für immer stehen.
   */
  it('übergibt Teamprojekte, merkt Soloprojekte vor und gibt sie bei erneuter Anmeldung zurück', async () => {
    const { signToken } = await import('../middleware/auth')
    const chef = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES ('konto-chef@example.com', 'x', 'Chef', 'admin')")
    const chefToken = signToken({ id: chef.id, email: 'konto-chef@example.com', name: 'Chef', role: 'admin' })
    const geht = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES ('Geht@Example.com', 'x', 'Geht', 'user')")
    const bleibt = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES ('bleibt@example.com', 'x', 'Bleibt', 'user')")
    const leser = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES ('liest@example.com', 'x', 'Liest', 'user')")
    const solo = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Solo', geht.id])).id
    const team = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Team', geht.id])).id
    const nurLeser = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Nur Leser', geht.id])).id
    await db.run("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'read_only')", [team, leser.id])
    await db.run("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'producer')", [team, bleibt.id])
    await db.run("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'read_only')", [nurLeser, leser.id])

    const weg = await hole(`/api/admin/users/${geht.id}`, chefToken, { method: 'DELETE' })
    expect(weg.status).toBe(200)
    expect(weg.daten).toMatchObject({ uebergeben: 1, vorgemerkt: 2 })
    const stand = async (id: number) => db.get('SELECT owner_id, verwaist_seit, verwaist_email FROM projects WHERE id = ?', [id])
    expect((await stand(team)).owner_id).toBe(bleibt.id)
    expect(await stand(solo)).toMatchObject({ owner_id: null, verwaist_email: 'geht@example.com' })
    expect((await stand(nurLeser)).verwaist_seit).not.toBeNull()

    // Neu angemeldet mit derselben Adresse, anders geschrieben
    const neu = await hole('/api/auth/register', '', {
      method: 'POST', body: JSON.stringify({ name: 'Wieder da', email: 'geht@example.com', password: 'Wieder-da-12345' }),
    })
    expect(neu.status).toBe(201)
    expect(await stand(solo)).toMatchObject({ owner_id: neu.daten.user.id, verwaist_seit: null, verwaist_email: null })
    expect((await stand(nurLeser)).owner_id).toBe(neu.daten.user.id)
  })

  it('löscht vorgemerkte Projekte nach 30 Tagen, vorher nicht', async () => {
    const { raeumeVerwaisteProjekteAuf } = await import('../lib/kontoloeschung')
    const alt = (await db.run(
      "INSERT INTO projects (title, verwaist_seit, verwaist_email) VALUES ('Alt', NOW() - INTERVAL '31 days', 'alt@example.com')")).id
    const frisch = (await db.run(
      "INSERT INTO projects (title, verwaist_seit, verwaist_email) VALUES ('Frisch', NOW() - INTERVAL '29 days', 'frisch@example.com')")).id
    await raeumeVerwaisteProjekteAuf()
    expect(await db.get('SELECT id FROM projects WHERE id = ?', [alt])).toBeUndefined()
    expect(await db.get('SELECT id FROM projects WHERE id = ?', [frisch])).toBeTruthy()
  })

  it('löscht bei der Selbstlöschung Soloprojekte nicht sofort', async () => {
    const konto = await hole('/api/auth/register', '', {
      method: 'POST', body: JSON.stringify({ name: 'Selbst', email: 'selbst@example.com', password: 'Selbst-geht-123' }),
    })
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Eigenes', konto.daten.user.id])).id
    const weg = await hole('/api/auth/me', konto.daten.token, { method: 'DELETE', body: JSON.stringify({ password: 'Selbst-geht-123' }) })
    expect(weg.status).toBe(200)
    expect(await db.get('SELECT owner_id, verwaist_email FROM projects WHERE id = ?', [projekt]))
      .toEqual({ owner_id: null, verwaist_email: 'selbst@example.com' })
  })

  it('verlangt beim Registrieren mindestens 8 Zeichen', async () => {
    const versuch = (password: string, email: string) =>
      hole('/api/auth/register', '', { method: 'POST', body: JSON.stringify({ name: 'Kurz', email, password }) })
    expect((await versuch('1234567', 'sieben@example.com')).status).toBe(400)
    expect((await versuch('12345678', 'acht@example.com')).status).toBe(201)
  })

  it('macht das Konto aus ADMIN_EMAIL sofort und dauerhaft zum Admin', async () => {
    const vorher = process.env.ADMIN_EMAIL
    process.env.ADMIN_EMAIL = 'Dauer-Admin@example.com'
    try {
      const { signToken } = await import('../middleware/auth')
      const chef = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES ('dauer-chef@example.com', 'x', 'Chef', 'admin')")
      const chefToken = signToken({ id: chef.id, email: 'dauer-chef@example.com', name: 'Chef', role: 'admin' })
      const konto = await hole('/api/auth/register', '', {
        method: 'POST', body: JSON.stringify({ name: 'Dauer', email: 'dauer-admin@example.com', password: 'Dauer-Admin-123' }),
      })
      expect(konto.daten.user.role).toBe('admin')
      const id = konto.daten.user.id
      expect((await hole(`/api/admin/users/${id}/role`, chefToken, { method: 'PUT', body: JSON.stringify({ role: 'user' }) })).status).toBe(400)
      expect((await hole(`/api/admin/users/${id}`, chefToken, { method: 'DELETE' })).status).toBe(400)
      expect((await db.get('SELECT role FROM users WHERE id = ?', [id])).role).toBe('admin')
    } finally {
      if (vorher === undefined) delete process.env.ADMIN_EMAIL
      else process.env.ADMIN_EMAIL = vorher
    }
  })

  it('kennt global nur Admin und Nutzer', async () => {
    const { signToken } = await import('../middleware/auth')
    const chef = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES ('rollen-chef@example.com', 'x', 'Chef', 'admin')")
    const chefToken = signToken({ id: chef.id, email: 'rollen-chef@example.com', name: 'Chef', role: 'admin' })
    const jemand = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES ('rolle@example.com', 'x', 'Rolle', 'user')")
    expect((await hole(`/api/admin/users/${jemand.id}/role`, chefToken, { method: 'PUT', body: JSON.stringify({ role: 'producer' }) })).status).toBe(400)
    expect((await hole(`/api/admin/users/${jemand.id}/role`, chefToken, { method: 'PUT', body: JSON.stringify({ role: 'admin' }) })).status).toBe(200)
  })
})

describe('Projekt-Guard: Pfad vor Body', () => {
  /**
   * Gemessen am 24.10.2026: Ein Konto ohne Zugang schickte
   * POST /scenes/{fremde Szene}/blocks mit der Nummer seines eigenen Projekts
   * im Body. Der Guard prüfte gegen das eigene Projekt, der Block landete im
   * fremden Drehbuch.
   */
  it('prüft gegen das Projekt des Eintrags im Pfad, nicht gegen den Body', async () => {
    const { extractProjectId } = await import('../middleware/projectAuth')
    const fremdesProjekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Fremd', fremdeId])).id
    const szene = (await db.run(
      "INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '1', 'Ziel')", [projektId]
    )).id

    expect(await extractProjectId('POST', `/scenes/${szene}/blocks`, { project_id: fremdesProjekt }))
      .toBe(projektId)
    // Ohne Eintrag im Pfad gilt der Body weiter - so legen Routen wie
    // POST /tasks ihre Einträge an.
    expect(await extractProjectId('POST', '/tasks', { project_id: fremdesProjekt })).toBe(fremdesProjekt)
  })
})

describe('Neustart', () => {
  /**
   * Gemessen am 24.10.2026: Bei jedem Start bekam jedes Projekt ohne Inhaber
   * das erste Konto als Inhaber. Ohne Inhaber sind die Projekte gelöschter
   * Konten - nach jedem Deploy gehörten sie still jemand anderem.
   */
  it('gibt Projekte gelöschter Konten niemand anderem', async () => {
    const modul = await import('../db')
    const verwaist = (await db.run(
      'INSERT INTO projects (title, owner_id, is_demo) VALUES (?, NULL, false)', ['Verwaist']
    )).id
    const demo = (await db.run(
      'INSERT INTO projects (title, owner_id, is_demo) VALUES (?, NULL, true)', ['Demo vom ersten Start']
    )).id

    await modul.initDatabase()

    const zeilen = await db.all('SELECT id, owner_id FROM projects WHERE id IN (?, ?)', [verwaist, demo])
    const inhaber = new Map(zeilen.map((z: any) => [z.id, z.owner_id]))
    expect(inhaber.get(verwaist)).toBeNull()
    // Auch das Demo-Projekt vom ersten Start bleibt ohne Inhaber - sonst
    // findet der Reseed es nicht wieder und legt ein weiteres an.
    expect(inhaber.get(demo)).toBeNull()
  }, 60_000)
})

describe('Testadressen im Versand', () => {
  /**
   * Gemessen am 24.10.2026: "Dispo versenden" im Demo-Projekt schrieb sieben
   * Adressen bei echten Mailanbietern an. Die Demo-Daten stehen jetzt unter
   * .test - und der Versand legt solche Adressen keinem Mailserver vor.
   */
  it('verbindet für eine Testadresse gar nicht erst mit dem Mailserver', async () => {
    // Port 1: Dort hört niemand. Versuchte der Versand es, stünde ein
    // Verbindungsfehler in der Zeile und sie wartete auf den nächsten Versuch.
    process.env.SMTP_HOST = '127.0.0.1'
    process.env.SMTP_PORT = '1'
    process.env.SMTP_USER = 'niemand'
    process.env.SMTP_PASS = 'niemand'
    mailversand.vergissTransport()
    try {
      await db.run("UPDATE email_outbox SET status = 'ohne_versand' WHERE status = 'wartet'")
      const [mail] = await mailversand.reiheEin({
        projectId: projektId,
        betreff: 'Dispo Demo',
        html: '<p>Hallo</p>',
        empfaenger: [{ email: 'felix.wagner@demo.test', name: 'Felix Wagner' }],
        anlass: 'dispo',
      })
      const lauf = await mailversand.sendeFaellige()
      expect(lauf.gesendet).toBe(0)
      const zeile = await db.get('SELECT status, last_error FROM email_outbox WHERE id = ?', [mail.id])
      expect(zeile.status).toBe('ohne_versand')
      expect(zeile.last_error).toContain('Testadresse')
    } finally {
      delete process.env.SMTP_HOST
      delete process.env.SMTP_PORT
      delete process.env.SMTP_USER
      delete process.env.SMTP_PASS
      mailversand.vergissTransport()
    }
  }, 30_000)
})

describe('Was anliegt', () => {
  /**
   * Gemessen am 24.10.2026: Kein unbeantworteter Vertrag kam je auf die
   * Liste (Zeitstempel als "Mon Oct 12" gelesen), Komparsen ohne Bewilligung
   * fehlten, jede Firma zählte die Passwort-Mails der ganzen Installation,
   * abgeschlossene Projekte meldeten ihre Genehmigungen als dringend, und ein
   * Mitarbeiter sah Rechnungen, die ihm die Rechnungsseite verweigert.
   */
  it('zeigt, was die Firma angeht, und nur das', async () => {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Anliegen GmbH', ?)", [nutzerId])).id
    const projekt = (await db.run(
      "INSERT INTO projects (title, owner_id, company_id) VALUES ('Laufend', ?, ?)", [nutzerId, firma]
    )).id
    const archiv = (await db.run(
      "INSERT INTO projects (title, owner_id, company_id, archived) VALUES ('Fertig', ?, ?, 1)", [nutzerId, firma]
    )).id
    await db.run(
      `INSERT INTO contracts (project_id, person_type, person_id, kind, title, body, status, token, sent_at)
       VALUES (?, 'crew', 0, 'crew', 'Kameravertrag', '', 'versendet', 'anliegen-vertrag', NOW() - INTERVAL '12 days')`,
      [projekt]
    )
    await db.run(
      "INSERT INTO extras (project_id, name, birthdate, permit_granted) VALUES (?, 'Mila', CURRENT_DATE - INTERVAL '11 years', false)",
      [projekt]
    )
    await db.run(
      `INSERT INTO project_files (project_id, kind, filename, content, title, valid_until)
       VALUES (?, 'genehmigung', 'g.pdf', decode('00', 'hex'), 'Alte Drehgenehmigung', CURRENT_DATE - 20)`,
      [archiv]
    )
    await db.run(
      "INSERT INTO email_outbox (project_id, subject, recipient_email, purpose, status) VALUES (NULL, 'Passwort', 'wer@demo.test', 'system', 'fehlgeschlagen')"
    )
    await db.run(
      `INSERT INTO invoices (company_id, number, kind, status, issue_date, due_date, gross_cents, paid_cents)
       VALUES (?, 'A-1', 'rechnung', 'versendet', CURRENT_DATE - 40, CURRENT_DATE - 26, 119000, 0)`,
      [firma]
    )
    await db.run("INSERT INTO company_members (company_id, user_id, role) VALUES (?, ?, 'mitarbeiter')", [firma, fremdeId])

    const inhaberin = await hole(`/api/companies/${firma}/anliegen`, tokenInhaber)
    expect(inhaberin.status).toBe(200)
    const punkte: any[] = inhaberin.daten.punkte
    const titel = punkte.map((p) => p.titel)
    expect(punkte.find((p) => p.art === 'vertrag')?.tage).toBe(12)
    expect(titel).toContain('Mila (Komparserie): Bewilligung fehlt')
    expect(titel).toContain('Rechnung A-1 überfällig')
    expect(punkte.some((p) => p.art === 'nachweis')).toBe(false)
    expect(punkte.some((p) => p.art === 'mail')).toBe(false)

    const mitarbeiter = await hole(`/api/companies/${firma}/anliegen`, tokenFremd)
    expect(mitarbeiter.status).toBe(200)
    expect(mitarbeiter.daten.punkte.some((p: any) => p.art === 'rechnung')).toBe(false)
  })
})

describe('Passwort und Sitzungen', () => {
  /**
   * Gemessen am 24.10.2026: Nach dem Zurücksetzen per Link galten alle alten
   * Anmeldungen weiter, nach dem Passwortwechsel die der anderen Geräte, und
   * das Token aus der Registrierung überstand beides. Der Rücksetz-Link stand
   * im Klartext in der Datenbank.
   */
  it('beendet Anmeldungen, wenn das Passwort neu ist', async () => {
    const adresse = 'sitzungen@demo.test'
    const melde = async (passwort: string) =>
      (await hole('/api/auth/login', '', { method: 'POST', body: JSON.stringify({ email: adresse, password: passwort }) })).daten.token
    const gilt = async (t: string) => (await hole('/api/auth/me', t)).status

    const registriert = await hole('/api/auth/register', '', {
      method: 'POST', body: JSON.stringify({ email: adresse, password: 'erstes-passwort', name: 'Sitzung' }),
    })
    expect(registriert.status).toBe(201)
    const ausRegistrierung = registriert.daten.token
    const hier = await melde('erstes-passwort')
    expect((await hole('/api/auth/sessions/revoke-others', hier, { method: 'POST' })).status).toBe(200)
    expect(await gilt(ausRegistrierung), 'Token der Registrierung nach "alle anderen abmelden"').toBe(401)

    const anderesGeraet = await melde('erstes-passwort')
    const wechsel = await hole('/api/auth/me/password', hier, {
      method: 'PUT', body: JSON.stringify({ current_password: 'erstes-passwort', new_password: 'zweites-passwort' }),
    })
    expect(wechsel.status).toBe(200)
    expect(await gilt(anderesGeraet), 'anderes Gerät nach dem Passwortwechsel').toBe(401)
    expect(await gilt(hier), 'dieses Gerät bleibt angemeldet').toBe(200)

    await hole('/api/auth/forgot-password', '', { method: 'POST', body: JSON.stringify({ email: adresse }) })
    const mail = await db.get('SELECT html FROM email_outbox WHERE recipient_email = ? ORDER BY id DESC LIMIT 1', [adresse])
    const link = String(mail.html).match(/reset-password\/([0-9a-f]+)/)![1]
    const gespeichert = await db.get(
      'SELECT token FROM password_reset_tokens t JOIN users u ON t.user_id = u.id WHERE u.email = ? ORDER BY t.id DESC LIMIT 1',
      [adresse]
    )
    expect(gespeichert.token, 'der Link steht nicht im Klartext in der Datenbank').not.toBe(link)

    const zurueck = await hole('/api/auth/reset-password', '', {
      method: 'POST', body: JSON.stringify({ token: link, password: 'drittes-passwort' }),
    })
    expect(zurueck.status).toBe(200)
    expect(await gilt(hier), 'nach dem Zurücksetzen ist jede Anmeldung beendet').toBe(401)
    const nochmal = await hole('/api/auth/reset-password', '', {
      method: 'POST', body: JSON.stringify({ token: link, password: 'viertes-passwort' }),
    })
    expect(nochmal.status).toBe(400)
  }, 60_000)
})

describe('Sicherung zurückspielen', () => {
  /**
   * Gemessen am 25.10.2026: Jedes Konto außer einem globalen Admin bekam beim
   * Zurückspielen 403 - requireMember hielt "import" für eine Projektnummer.
   * Für Admins übernahm es Verweise in fremde Firmen wörtlich und legte
   * Rechnungen als Doppel an.
   */
  it('lässt /projects/import durch, aber kein fremdes Projekt', async () => {
    const { requireMember } = await import('../middleware/projectAuth')
    const antwort = () => {
      const r: any = { code: 0 }
      r.status = (c: number) => { r.code = c; return r }
      r.json = () => r
      return r
    }
    const nutzer = { id: fremdeId, role: 'user' }
    let weiter = false
    await requireMember({ user: nutzer, params: { projectId: 'import' } } as any, antwort(), () => { weiter = true })
    expect(weiter).toBe(true)
    const fremd = antwort()
    weiter = false
    await requireMember({ user: nutzer, params: { projectId: String(projektId) } } as any, fremd, () => { weiter = true })
    expect(weiter).toBe(false)
    expect(fremd.code).toBe(403)
  })

  it('übernimmt keine Verweise in Firmen und keine Rechnungen', async () => {
    const { importiereInhalt } = await import('../lib/wiederherstellung')
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Fremde Firma', ?)", [fremdeId])).id
    const kontakt = (await db.run("INSERT INTO company_contacts (company_id, name) VALUES (?, 'Geheimer Kontakt')", [firma])).id
    const ziel = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Import-Ziel', ?)", [nutzerId])).id
    const bericht = await importiereInhalt({
      invoices: [{ id: 1, company_id: firma, number: 'DOPPEL-1', kind: 'rechnung', status: 'versendet' }],
      crew: [{ id: 1, name: 'Mit Kontakt', contact_id: kontakt }],
      contract_templates: [{ id: 1, company_id: firma, name: 'Vorlage', body: 'x' }],
    }, ziel, nutzerId)
    expect(bericht.uebernommen.invoices).toBeUndefined()
    expect(Number((await db.get("SELECT COUNT(*) AS c FROM invoices WHERE number = 'DOPPEL-1'")).c)).toBe(0)
    expect((await db.get('SELECT contact_id FROM crew WHERE project_id = ?', [ziel])).contact_id).toBeNull()
    expect((await db.get('SELECT company_id FROM contract_templates WHERE project_id = ?', [ziel])).company_id).toBeNull()
  })

  it('bildet Verweise auf die Kopie ab und lässt den Postausgang beim alten Projekt', async () => {
    const { importiereInhalt } = await import('../lib/wiederherstellung')
    const ziel = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Import-Ziel 2', ?)", [nutzerId])).id
    const bericht = await importiereInhalt({
      shoot_days: [{ id: 501, day_number: 1, date: '2026-11-02' }],
      email_groups: [{ id: 601, name: 'Drehtag 1', rule: 'drehtag', parameter: '501' }],
      email_group_members: [{ id: 1, group_id: 601, name: 'Ana', email: 'ana@demo.test' }],
      email_outbox: [{ id: 1, subject: 'Alt', recipient_email: 'wer@demo.test', status: 'wartet' }],
    }, ziel, nutzerId)
    expect(bericht.uebernommen.email_outbox).toBeUndefined()
    const tag = await db.get('SELECT id FROM shoot_days WHERE project_id = ?', [ziel])
    const gruppe = await db.get('SELECT id, parameter FROM email_groups WHERE project_id = ?', [ziel])
    expect(gruppe.parameter).toBe(String(tag.id))
    expect((await db.get('SELECT group_id FROM email_group_members WHERE project_id = ?', [ziel])).group_id).toBe(gruppe.id)
  })

  it('bildet Komparsen in Dispo und Vertrag auf die Kopie ab', async () => {
    // Seit Fund 119 stehen Komparsen in der Dispo (person_type 'extra')
    const { importiereInhalt } = await import('../lib/wiederherstellung')
    const ziel = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Import-Ziel Komparsen', ?)", [nutzerId])).id
    await importiereInhalt({
      shoot_days: [{ id: 901, day_number: 1, date: '2026-11-02' }],
      extras: [{ id: 902, name: 'Ida Probe' }],
      call_sheets: [{ id: 903, shoot_day_id: 901 }],
      call_sheet_entries: [{ id: 904, call_sheet_id: 903, person_type: 'extra', person_id: 902, call_time: 420 }],
      timesheets: [{ id: 905, shoot_day_id: 901, person_type: 'extra', person_id: 902 }],
    }, ziel, nutzerId)
    const komparse = await db.get('SELECT id FROM extras WHERE project_id = ?', [ziel])
    const dispo = await db.get(
      `SELECT e.person_id FROM call_sheet_entries e JOIN call_sheets s ON s.id = e.call_sheet_id
         JOIN shoot_days d ON d.id = s.shoot_day_id WHERE d.project_id = ?`, [ziel])
    expect(dispo.person_id).toBe(komparse.id)
    expect((await db.get('SELECT person_id FROM timesheets WHERE project_id = ?', [ziel])).person_id).toBe(komparse.id)
  })

  it('spielt Dateien mit ihrem Inhalt zurück und schreibt die Bildadresse um', async () => {
    const { importiereInhalt } = await import('../lib/wiederherstellung')
    const ziel = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Import-Ziel 3', ?)", [nutzerId])).id
    // So steht ein Buffer nach JSON.stringify in der Sicherung
    const inhalt = JSON.parse(JSON.stringify(Buffer.from('%PDF-1')))
    await importiereInhalt({
      project_files: [{ id: 701, kind: 'grundriss', filename: 'plan.png', mime: 'image/png', content: inhalt }],
      floorplans: [{ id: 801, name: 'Plan', image_url: '/api/projects/1/dateien/701/inhalt' }],
    }, ziel, nutzerId)
    const datei = await db.get('SELECT id, content FROM project_files WHERE project_id = ?', [ziel])
    expect(Buffer.from(datei.content).toString()).toBe('%PDF-1')
    const plan = await db.get('SELECT image_url FROM floorplans WHERE project_id = ?', [ziel])
    expect(plan.image_url).toBe(`/api/projects/${ziel}/dateien/${datei.id}/inhalt`)
  })
})

describe('Motivvertrag', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='

  it('behält beim Speichern, was nicht mitkommt, und lässt sich unterschreiben', async () => {
    const motiv = (await db.run("INSERT INTO locations (project_id, name) VALUES (?, 'Hafen')", [projektId])).id
    const pfad = `/api/locations/${motiv}/release`
    await hole(pfad, tokenInhaber, { method: 'POST', body: JSON.stringify({ owner_name: 'Erna', owner_address: 'Hafenstr. 1', fee_cents: 50000 }) })
    // So speichert die Oberfläche: nur der Name
    const gespeichert = await hole(pfad, tokenInhaber, { method: 'POST', body: JSON.stringify({ owner_name: 'Erna Meyer', status: 'Entwurf' }) })
    expect(gespeichert.daten).toMatchObject({ owner_name: 'Erna Meyer', owner_address: 'Hafenstr. 1', fee_cents: 50000 })
    expect((await hole(`${pfad}/sign`, tokenInhaber, { method: 'PATCH', body: JSON.stringify({ signature_data: 'https://example.com/a.png' }) })).status).toBe(400)
    // Wie die Oberfläche: ohne Namen
    const unterschrieben = await hole(`${pfad}/sign`, tokenInhaber, { method: 'PATCH', body: JSON.stringify({ signature_data: png }) })
    expect(unterschrieben.status).toBe(200)
    expect(unterschrieben.daten.status).toBe('Unterschrieben')
    expect((await hole(pfad, tokenInhaber, { method: 'POST', body: JSON.stringify({ owner_name: 'Jemand' }) })).status).toBe(409)
    expect((await hole(`${pfad}/sign`, tokenInhaber, { method: 'PATCH', body: JSON.stringify({ signature_data: png }) })).status).toBe(409)
  })

  it('setzt "Unterschrieben" nur mit Unterschrift und keine negative Vergütung', async () => {
    const motiv = (await db.run("INSERT INTO locations (project_id, name) VALUES (?, 'Halle')", [projektId])).id
    const pfad = `/api/locations/${motiv}/release`
    expect((await hole(pfad, tokenInhaber, { method: 'POST', body: JSON.stringify({ status: 'Unterschrieben' }) })).status).toBe(400)
    expect((await hole(pfad, tokenInhaber, { method: 'POST', body: JSON.stringify({ fee_cents: -100 }) })).status).toBe(400)
    expect(await db.get('SELECT id FROM location_releases WHERE location_id = ?', [motiv])).toBeUndefined()
  })
})

describe('Mahnwesen', () => {
  let firmaId = 0
  let kundeId = 0

  beforeAll(async () => {
    firmaId = (await hole('/api/companies', tokenInhaber, { method: 'POST', body: JSON.stringify({ name: 'Mahnfirma' }) })).daten.id
    kundeId = (await db.run("INSERT INTO company_clients (company_id, name) VALUES (?, 'Kunde')", [firmaId])).id
  }, 60_000)

  /** Eine versendete, seit August fällige Rechnung oder ein Angebot. */
  const offen = async (kind: string, nummer: string) => (await db.run(
    `INSERT INTO invoices (company_id, client_id, kind, status, number, gross_cents, issue_date, due_date)
     VALUES (?, ?, ?, 'versendet', ?, 100000, '2026-08-01', '2026-08-15')`,
    [firmaId, kundeId, kind, nummer]
  )).id

  it('nimmt auf ein Angebot keine Zahlung an', async () => {
    const angebot = await offen('angebot', 'A-1')
    const antwort = await hole(`/api/companies/${firmaId}/invoices/${angebot}/payments`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ amount_cents: 100000, paid_on: '2026-10-01' }),
    })
    expect(antwort.status).toBe(404)
    expect((await db.get('SELECT status FROM invoices WHERE id = ?', [angebot])).status).toBe('versendet')
  })

  it('mahnt bei gleichzeitigen Anfragen nur einmal', async () => {
    const rechnung = await offen('rechnung', 'R-1')
    const antworten = await Promise.all([1, 2, 3].map(() => hole(`/api/companies/${firmaId}/invoices/${rechnung}/mahnung`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ mail: false }),
    })))
    expect(antworten.filter((a) => a.status === 200)).toHaveLength(1)
    expect(Number((await db.get('SELECT COUNT(*) AS c FROM invoice_reminders WHERE invoice_id = ?', [rechnung])).c)).toBe(1)
  })

  it('mahnt nicht bei abgeschaltetem Mahnwesen und weist einen falschen Stichtag ab', async () => {
    const rechnung = await offen('rechnung', 'R-2')
    await db.run('UPDATE companies SET dunning_enabled = false WHERE id = ?', [firmaId])
    const antwort = await hole(`/api/companies/${firmaId}/invoices/${rechnung}/mahnung`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ mail: false }),
    })
    await db.run('UPDATE companies SET dunning_enabled = true WHERE id = ?', [firmaId])
    expect(antwort.status).toBe(409)
    expect(Number((await db.get('SELECT COUNT(*) AS c FROM invoice_reminders WHERE invoice_id = ?', [rechnung])).c)).toBe(0)
    expect((await hole(`/api/companies/${firmaId}/mahnlauf?stichtag=abc`, tokenInhaber)).status).toBe(400)
  })
})

describe('Musikliste', () => {
  it('zeigt die Szenennummer und lässt die Szene wieder lösen', async () => {
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '12', 'Hafen')", [projektId])).id
    const pfad = `/api/projects/${projektId}/music-cues`
    const cue = (await hole(pfad, tokenInhaber, { method: 'POST', body: JSON.stringify({ title: 'Lied', scene_id: szene }) })).daten
    const liste = (await hole(pfad, tokenInhaber)).daten
    expect(liste.find((c: any) => c.id === cue.id).scene_number).toBe('12')
    const geloest = await hole(`${pfad}/${cue.id}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ scene_id: null }) })
    expect(geloest.daten.scene_id).toBeNull()
    // Ohne scene_id im Rumpf bleibt die Szene, wie sie ist
    await hole(`${pfad}/${cue.id}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ scene_id: szene }) })
    expect((await hole(`${pfad}/${cue.id}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ title: 'Neu' }) })).daten.scene_id).toBe(szene)
  })
})

describe('Papierkorb', () => {
  /** Sichern und löschen, wie es der Wächter vor der Löschroute tut. */
  async function loesche(tabelle: string, id: number) {
    const { inDenPapierkorb } = await import('../lib/papierkorb')
    await inDenPapierkorb(tabelle, id, { userId: nutzerId })
    await db.run(`DELETE FROM ${tabelle === 'cast' ? '"cast"' : tabelle} WHERE id = ?`, [id])
    return (await db.get('SELECT id FROM deleted_items WHERE table_name = ? AND row_id = ? ORDER BY id DESC LIMIT 1', [tabelle, id])).id
  }

  it('holt einen Drehtag mit Dispo, Einträgen und Szenen zurück', async () => {
    const { ausDemPapierkorb } = await import('../lib/papierkorb')
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-11-02')", [projektId])).id
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number) VALUES (?, '1')", [projektId])).id
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag, szene])
    const dispo = (await db.run('INSERT INTO call_sheets (shoot_day_id) VALUES (?)', [tag])).id
    await db.run("INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time) VALUES (?, 'crew', 1, 420)", [dispo])

    const eintrag = await loesche('shoot_days', tag)
    expect(await db.get('SELECT id FROM call_sheets WHERE id = ?', [dispo])).toBeUndefined()
    const ergebnis = await ausDemPapierkorb(eintrag, projektId)

    expect(ergebnis).toMatchObject({ wiederhergestellt: true, ohne: 0 })
    expect(Number((await db.get('SELECT COUNT(*) AS c FROM shoot_day_scenes WHERE shoot_day_id = ?', [tag])).c)).toBe(1)
    expect(Number((await db.get('SELECT COUNT(*) AS c FROM call_sheet_entries WHERE call_sheet_id = ?', [dispo])).c)).toBe(1)
  })

  it('lässt weg, was auf inzwischen Gelöschtes zeigt, ohne das Zurückholen zu verhindern', async () => {
    const { ausDemPapierkorb } = await import('../lib/papierkorb')
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number) VALUES (?, '4')", [projektId])).id
    const rolle = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Ole')", [projektId])).id
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene, rolle])
    // Erst die Szene - ihre Sicherung enthält die Zuordnung -, dann die Rolle
    const szeneWeg = await loesche('scenes', szene)
    await loesche('characters', rolle)
    expect(await ausDemPapierkorb(szeneWeg, projektId)).toMatchObject({ wiederhergestellt: true, ohne: 1 })
    expect(await db.get('SELECT id FROM scenes WHERE id = ?', [szene])).toBeTruthy()
  })

  it('holt eine Zuordnung zurück, wenn in umgekehrter Reihenfolge zurückgeholt wird', async () => {
    const { ausDemPapierkorb } = await import('../lib/papierkorb')
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number) VALUES (?, '2')", [projektId])).id
    const rolle = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Jana')", [projektId])).id
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene, rolle])

    const rolleWeg = await loesche('characters', rolle)
    const szeneWeg = await loesche('scenes', szene)
    // Die Szene kommt zurück, ihre Rolle gibt es noch nicht wieder
    expect(await ausDemPapierkorb(szeneWeg, projektId)).toMatchObject({ wiederhergestellt: true })
    expect(Number((await db.get('SELECT COUNT(*) AS c FROM scene_characters WHERE scene_id = ?', [szene])).c)).toBe(0)
    // Mit der Rolle kommt die Zuordnung zurück
    expect(await ausDemPapierkorb(rolleWeg, projektId)).toMatchObject({ wiederhergestellt: true })
    expect(Number((await db.get('SELECT COUNT(*) AS c FROM scene_characters WHERE scene_id = ? AND character_id = ?', [szene, rolle])).c)).toBe(1)
  })

  it('knüpft gelöste Verweise wieder an', async () => {
    const { ausDemPapierkorb } = await import('../lib/papierkorb')
    const motiv = (await db.run("INSERT INTO locations (project_id, name) VALUES (?, 'Hafen')", [projektId])).id
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number, location_id) VALUES (?, '3', ?)", [projektId, motiv])).id
    const eintrag = await loesche('locations', motiv)
    expect((await db.get('SELECT location_id FROM scenes WHERE id = ?', [szene])).location_id).toBeNull()
    await ausDemPapierkorb(eintrag, projektId)
    expect((await db.get('SELECT location_id FROM scenes WHERE id = ?', [szene])).location_id).toBe(motiv)
  })
})

describe('Komparsen an Drehtagen', () => {
  it('trägt den Komparsen in die Dispo des Tages ein - die Jugendschutzprüfung sieht den Tag', async () => {
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 7, '2026-11-20')", [projektId])).id
    const stab = (await db.run("INSERT INTO crew (project_id, name, role) VALUES (?, 'Kim', 'Ton')", [projektId])).id
    const komparse = (await db.run(
      "INSERT INTO extras (project_id, name, tariff_group, birthdate) VALUES (?, 'Lio', 'Standard', '2016-03-01')", [projektId]
    )).id

    const zugeordnet = await hole(`/api/projects/${projektId}/extras/${komparse}/drehtage`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ drehtage: [tag] }) })
    expect(zugeordnet.status).toBe(200)
    expect(zugeordnet.daten.drehtage).toEqual([tag])
    // Die Dispo gab es noch nicht: angelegt wie von Hand, mit dem Stab
    const dispo = await db.get('SELECT id FROM call_sheets WHERE shoot_day_id = ?', [tag])
    const eintraege = await db.all('SELECT person_type, person_id FROM call_sheet_entries WHERE call_sheet_id = ?', [dispo.id])
    expect(eintraege).toEqual(expect.arrayContaining([
      { person_type: 'crew', person_id: stab },
      { person_type: 'extra', person_id: komparse },
    ]))

    const pruefung = await hole(`/api/projects/${projektId}/jugendschutz`, tokenInhaber)
    const lio = pruefung.daten.personen.find((p: any) => p.person_type === 'extra' && p.person_id === komparse)
    expect(lio.tage.map((t: any) => t.datum)).toEqual(['2026-11-20'])

    // Abwählen nimmt ihn aus der Dispo, Löschen räumt den Rest
    await hole(`/api/projects/${projektId}/extras/${komparse}/drehtage`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ drehtage: [] }) })
    expect(await db.get("SELECT id FROM call_sheet_entries WHERE person_type = 'extra' AND person_id = ?", [komparse])).toBeUndefined()
    await hole(`/api/projects/${projektId}/extras/${komparse}/drehtage`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ drehtage: [tag] }) })
    expect((await hole(`/api/projects/${projektId}/extras/${komparse}`, tokenInhaber, { method: 'DELETE' })).status).toBe(200)
    expect(await db.get("SELECT id FROM call_sheet_entries WHERE person_type = 'extra' AND person_id = ?", [komparse])).toBeUndefined()
  })

  it('nimmt keinen Drehtag eines anderen Projekts und keine Liste ohne Kennungen', async () => {
    const anderes = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Anderes', fremdeId])).id
    const fremderTag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '')", [anderes])).id
    const komparse = (await db.run("INSERT INTO extras (project_id, name) VALUES (?, 'Ida')", [projektId])).id
    const pfad = `/api/projects/${projektId}/extras/${komparse}/drehtage`
    expect((await hole(pfad, tokenInhaber, { method: 'PUT', body: JSON.stringify({ drehtage: [fremderTag] }) })).status).toBe(404)
    expect((await hole(pfad, tokenInhaber, { method: 'PUT', body: JSON.stringify({ drehtage: '1' }) })).status).toBe(400)
    expect(await db.get('SELECT id FROM call_sheets WHERE shoot_day_id = ?', [fremderTag])).toBeUndefined()
  })
})

describe('Kontakt-Export', () => {
  it('nimmt Komparsen und die Mail der Motiv-Kontakte mit und entschärft Formeln', async () => {
    await db.run("INSERT INTO crew (project_id, name, role) VALUES (?, '=1+1', 'Licht')", [projektId])
    await db.run("INSERT INTO extras (project_id, name, phone, tariff_group) VALUES (?, 'Kim Komparse', '0151 1', 'Standard')", [projektId])
    await db.run("INSERT INTO locations (project_id, name, contact_name, contact_email) VALUES (?, 'Hafen', 'Hanna Hafen', 'hanna@beispiel.de')", [projektId])

    const antwort = await fetch(`${basis}/api/projects/${projektId}/kontakte/export.csv`, { headers: { Authorization: `Bearer ${tokenInhaber}` } })
    expect(antwort.status).toBe(200)
    const zeilen = (await antwort.text()).split('\r\n')
    expect(zeilen).toContain("'=1+1;Licht;Stab;;")
    expect(zeilen).toContain('Kim Komparse;Komparse (Standard);Komparserie;;0151 1')
    expect(zeilen.find(z => z.startsWith('Hanna Hafen'))).toContain('hanna@beispiel.de')
  })
})

describe('Projektabschluss zurücknehmen', () => {
  it('stellt den Status von vor dem Abschluss wieder her und öffnet nur Abgeschlossenes', async () => {
    const projekt = (await db.run("INSERT INTO projects (title, owner_id, status) VALUES (?, ?, 'Drehphase')", ['Abschlussprobe', nutzerId])).id
    await db.run("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')", [projekt, nutzerId])

    const zu = await hole(`/api/projects/${projekt}/abschluss`, tokenInhaber, { method: 'POST', body: JSON.stringify({ trotzdem: true }) })
    expect(zu.status).toBe(200)
    expect((await db.get('SELECT status FROM projects WHERE id = ?', [projekt])).status).toBe('Abgeschlossen')

    const auf = await hole(`/api/projects/${projekt}/abschluss/zuruecknehmen`, tokenInhaber, { method: 'POST' })
    expect(auf.status).toBe(200)
    expect(auf.daten.status).toBe('Drehphase')
    expect(await db.get('SELECT status, archived FROM projects WHERE id = ?', [projekt])).toEqual({ status: 'Drehphase', archived: 0 })

    // Ein offenes Projekt lässt sich nicht "wieder öffnen" - vorher wurde es still Postproduktion
    const nochmal = await hole(`/api/projects/${projekt}/abschluss/zuruecknehmen`, tokenInhaber, { method: 'POST' })
    expect(nochmal.status).toBe(409)
    expect((await db.get('SELECT status FROM projects WHERE id = ?', [projekt])).status).toBe('Drehphase')
  })
})

describe('Suche: alles zur Figur', () => {
  it('findet über die Darstellerin die Figur, ihre Szenen und Drehtage - und nichts aus fremden Projekten', async () => {
    const figur = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Wanda')", [projektId])).id
    await db.run("INSERT INTO cast (project_id, character_id, actor_name) VALUES (?, ?, 'Greta Gans')", [projektId, figur])
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '12', 'Am Hafen')", [projektId])).id
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene, figur])
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 4, '2026-12-01')", [projektId])).id
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id) VALUES (?, ?)', [tag, szene])
    // Gleichnamige Figur in einem fremden Projekt darf nicht auftauchen
    const fremdes = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Fremd', fremdeId])).id
    await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Wanda')", [fremdes])

    const ueberDarstellerin = await hole(`/api/projects/${projektId}/search?q=greta`, tokenInhaber)
    expect(ueberDarstellerin.status).toBe(200)
    const arten = ueberDarstellerin.daten.map((r: any) => r.type)
    expect(arten).toEqual(['character', 'cast', 'shoot_day', 'scene'])
    expect(ueberDarstellerin.daten[0]).toMatchObject({ id: figur, title: 'Wanda', darsteller: ['Greta Gans'] })
    expect(ueberDarstellerin.daten[1]).toMatchObject({ title: 'Greta Gans', figur: 'Wanda' })
    expect(ueberDarstellerin.daten[2]).toMatchObject({ id: tag, day_number: 4, figuren: ['Wanda'], szenen: ['12'], url: `/projects/${projektId}/tagesdispo/${tag}` })
    expect(ueberDarstellerin.daten[3]).toMatchObject({ id: szene, scene_number: '12', figur: 'Wanda' })

    const ueberFigur = await hole(`/api/projects/${projektId}/search?q=wanda`, tokenInhaber)
    expect(ueberFigur.daten.filter((r: any) => r.type === 'character').map((r: any) => r.id)).toEqual([figur])
    expect(ueberFigur.daten.some((r: any) => r.type === 'shoot_day' && r.id === tag)).toBe(true)
  })
})

describe('Motive aus der Szenenüberschrift', () => {
  const szene = async (titel: string) => (await db.run(
    "INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '1', ?)", [projektId, titel]
  )).id

  it('legt das Motiv an und findet es ohne Groß- und Kleinschreibung wieder', async () => {
    const { motivVerknuepfen } = await import('../lib/motive')
    const erste = await szene('LEUCHTTURM')
    const neu = await motivVerknuepfen(db, projektId, erste, 'LEUCHTTURM - TREPPE')
    expect(neu).toMatchObject({ name: 'Leuchtturm', neu: true })
    const zweite = await szene('leuchtturm')
    expect(await motivVerknuepfen(db, projektId, zweite, 'leuchtturm')).toMatchObject({ id: neu!.id, neu: false })
    expect((await db.get('SELECT location_id FROM scenes WHERE id = ?', [zweite])).location_id).toBe(neu!.id)
  })

  it('lässt ein ausgefülltes Motiv stehen - dort steht der reale Drehort', async () => {
    const { motivVerknuepfen } = await import('../lib/motive')
    const halle = (await db.run("INSERT INTO locations (project_id, name, address) VALUES (?, 'Lagerhalle', 'Hafenstr. 9')", [projektId])).id
    const id = await szene('WERFT')
    await db.run('UPDATE scenes SET location_id = ? WHERE id = ?', [halle, id])
    expect(await motivVerknuepfen(db, projektId, id, 'WERFT')).toBeNull()
    expect((await db.get('SELECT location_id FROM scenes WHERE id = ?', [id])).location_id).toBe(halle)
    expect(await db.get("SELECT id FROM locations WHERE project_id = ? AND name = 'Werft'", [projektId])).toBeUndefined()
  })

  it('heilt einen Tippfehler: die leere Hülle wird umbenannt oder geht', async () => {
    const { motivVerknuepfen } = await import('../lib/motive')
    const id = await szene('KAPELLLE')
    const huelle = await motivVerknuepfen(db, projektId, id, 'KAPELLLE')
    expect(await motivVerknuepfen(db, projektId, id, 'KAPELLE')).toMatchObject({ id: huelle!.id, name: 'Kapelle' })

    // Das richtige Motiv gibt es schon: Die Szene wechselt, die Hülle geht
    const andere = await szene('KAPELLE ZWEI')
    const tippfehler = await motivVerknuepfen(db, projektId, andere, 'KAPPELE')
    const richtig = await motivVerknuepfen(db, projektId, andere, 'KAPELLE')
    expect(richtig!.id).toBe(huelle!.id)
    expect(await db.get('SELECT id FROM locations WHERE id = ?', [tippfehler!.id])).toBeUndefined()
  })
})

describe('Zweite Überschrift in einer Szene', () => {
  it('lässt den Datensatz der Szene stehen - nur die erste Überschrift führt ihn nach', async () => {
    const szene = (await db.run(
      "INSERT INTO scenes (project_id, scene_number, title, int_ext, day_night) VALUES (?, '1', 'KÜCHE', 'INT', 'TAG')", [projektId]
    )).id
    const zeile = async (platz: number, inhalt: string) => (await db.run(
      "INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content) VALUES (?, ?, ?, 'scene_heading', ?)",
      [szene, projektId, platz, inhalt]
    )).id
    const erste = await zeile(0, 'INT. KÜCHE - TAG')
    const zweite = await zeile(2, '')

    const antwort = await hole(`/api/blocks/${zweite}`, tokenInhaber, {
      method: 'PUT', body: JSON.stringify({ content: 'EXT. HAFEN - NACHT', motiv_fertig: true }),
    })
    expect(antwort.status).toBe(200)
    expect(antwort.daten.szene).toBeUndefined()
    expect(antwort.daten.motiv).toBeUndefined()
    expect(await db.get('SELECT int_ext, title, day_night, location_id FROM scenes WHERE id = ?', [szene]))
      .toEqual({ int_ext: 'INT', title: 'KÜCHE', day_night: 'TAG', location_id: null })

    const kopf = await hole(`/api/blocks/${erste}`, tokenInhaber, {
      method: 'PUT', body: JSON.stringify({ content: 'INT. KÜCHE - NACHT' }),
    })
    expect(kopf.daten.szene).toMatchObject({ title: 'KÜCHE', day_night: 'NACHT' })
  })
})

describe('Dispo aus dem Projekt', () => {
  it('ruft die Besetzung der Szenen des Tages, nicht alle Darsteller, und zieht sie nach', async () => {
    const { dispoFuerDrehtag, besetzungNachziehen, drehortDesTages } = await import('../lib/dispo')
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 8, '2026-11-21')", [projektId])).id
    const motiv = (await db.run("INSERT INTO locations (project_id, name) VALUES (?, 'Mole')", [projektId])).id
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number, location_id) VALUES (?, '30', ?)", [projektId, motiv])).id
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag, szene])
    const rolle = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Fischer')", [projektId])).id
    const andere = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Wirtin')", [projektId])).id
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene, rolle])
    const fischer = (await db.run("INSERT INTO \"cast\" (project_id, character_id, actor_name) VALUES (?, ?, 'Ole')", [projektId, rolle])).id
    const wirtin = (await db.run("INSERT INTO \"cast\" (project_id, character_id, actor_name) VALUES (?, ?, 'Gesa')", [projektId, andere])).id

    const dispo = await dispoFuerDrehtag(tag)
    const besetzung = async () => (await db.all(
      "SELECT person_id FROM call_sheet_entries WHERE call_sheet_id = ? AND person_type = 'cast'", [dispo!.id]
    )).map((e: any) => e.person_id)
    expect(await besetzung()).toEqual([fischer])
    expect((await drehortDesTages(tag, null))?.name).toBe('Mole')

    // Die Wirtin kommt in die Szene: Ihre Darstellerin kommt nach, einmal
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene, andere])
    expect(await besetzungNachziehen(db, { szene })).toBe(1)
    expect(await besetzungNachziehen(db, { rolle: andere })).toBe(0)
    expect((await besetzung()).sort()).toEqual([fischer, wirtin].sort())
  })
})

describe('Drehtage je Person - eine Zählung für Kalkulation, DOOD und Besetzung', () => {
  it('zählt Szenen der Rolle und Dispo-Einträge, beim Stab auch Tage ohne Dispo', async () => {
    const { drehtageBesetzung, drehtageStab } = await import('../lib/drehtage')
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Zählprobe', nutzerId])).id
    const tag = async (n: number) => (await db.run(
      "INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, ?, ?)", [projekt, n, `2026-12-0${n}`])).id
    const [t1, t2, t3] = [await tag(1), await tag(2), await tag(3)]
    const rolle = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Kapitänin')", [projekt])).id
    const darstellerin = (await db.run('INSERT INTO "cast" (project_id, character_id, actor_name) VALUES (?, ?, ?)', [projekt, rolle, 'Rike'])).id
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number) VALUES (?, '1')", [projekt])).id
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene, rolle])
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [t1, szene])
    const stab = (await db.run("INSERT INTO crew (project_id, name, role) VALUES (?, 'Ton', 'Ton')", [projekt])).id

    // Tag 2 hat eine Dispo: Rike von Hand dazugesetzt, der Stab gestrichen
    const dispo = (await db.run('INSERT INTO call_sheets (shoot_day_id) VALUES (?)', [t2])).id
    await db.run("INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id) VALUES (?, 'cast', ?)", [dispo, darstellerin])

    // Rike: Tag 1 über die Szene (ohne Dispo), Tag 2 über die Dispo
    expect([...(await drehtageBesetzung(db, projekt)).get(darstellerin)!].sort()).toEqual([t1, t2].sort())
    // Stab: Tag 1 und 3 haben keine Dispo - eine neue riefe den ganzen Stab;
    // auf der Dispo von Tag 2 steht er nicht
    expect([...(await drehtageStab(db, projekt)).get(stab)!].sort()).toEqual([t1, t3].sort())
  })
})

describe('Anonymisierung nach DSGVO', () => {
  it('entfernt auch Geburtsdatum und Erziehungsberechtigte und nennt die Funktion', async () => {
    const { anonymisiere } = await import('../lib/datenschutz')
    const kind = (await db.run(
      `INSERT INTO extras (project_id, name, email, birthdate, guardian_name, guardian_email, notes)
       VALUES (?, 'Lina Probe', 'l@example.com', '2014-05-02', 'Petra Probe', 'petra@example.com', 'Brille')`, [projektId]
    )).id
    const ergebnis = await anonymisiere(projektId, 'extra', kind, 'Test')
    expect(ergebnis?.ersatzname).toBe('Komparse (entfernt)')
    expect(await db.get('SELECT name, email, birthdate, guardian_name, guardian_email, notes FROM extras WHERE id = ?', [kind]))
      .toEqual({ name: 'Komparse (entfernt)', email: '', birthdate: null, guardian_name: '', guardian_email: '', notes: '' })

    const figur = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Lotsin')", [projektId])).id
    const darstellerin = (await db.run(
      `INSERT INTO "cast" (project_id, character_id, actor_name, agent, guardian_phone, birthdate)
       VALUES (?, ?, 'Mara Probe', 'Agent Pohl', '0170 9', '2012-01-01')`, [projektId, figur]
    )).id
    expect((await anonymisiere(projektId, 'cast', darstellerin))?.ersatzname).toBe('Lotsin (entfernt)')
    expect(await db.get('SELECT agent, guardian_phone, birthdate FROM "cast" WHERE id = ?', [darstellerin]))
      .toEqual({ agent: '', guardian_phone: '', birthdate: null })
  })
})

describe('Einladung annehmen', () => {
  it('stuft niemanden herab, der schon mehr Rechte hat - und hebt an, wenn die Einladung mehr gibt', async () => {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Einladungsprobe', nutzerId])).id
    await db.run("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'producer')", [projekt, fremdeId])
    await db.run("INSERT INTO project_invites (project_id, token, role) VALUES (?, 'lese-link', 'read_only')", [projekt])
    await db.run("INSERT INTO project_invites (project_id, token, role) VALUES (?, 'admin-link', 'admin')", [projekt])
    const rolle = async () => (await db.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [projekt, fremdeId])).role

    // Die Seite nimmt angemeldet automatisch an - ein weitergeleiteter
    // Lese-Link machte so aus der Produktion still einen Lesezugriff
    const lesen = await hole('/api/invites/lese-link/accept', tokenFremd, { method: 'POST' })
    expect(lesen.status).toBe(200)
    expect(await rolle()).toBe('producer')
    expect(lesen.daten.role).toBe('producer')

    const mehr = await hole('/api/invites/admin-link/accept', tokenFremd, { method: 'POST' })
    expect(mehr.status).toBe(200)
    expect(await rolle()).toBe('admin')
  })
})

describe('Dispo-Link mit vorhandenem Konto', () => {
  it('bringt die angemeldete Person mit der E-Mail des Eintrags ins Projekt - sonst niemanden', async () => {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Dispoprobe', nutzerId])).id
    const person = (await db.run("INSERT INTO crew (project_id, name, role, email) VALUES (?, 'Fremde Person', 'Ton', 'Fremde@Example.com')", [projekt])).id
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-12-02')", [projekt])).id
    const dispo = (await db.run('INSERT INTO call_sheets (shoot_day_id) VALUES (?)', [tag])).id
    await db.run("INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, public_token) VALUES (?, 'crew', ?, 'dispo-link-0123456789')", [dispo, person])

    // Die Seite sagt "hier anmelden, um das ganze Projekt zu sehen" - das muss stimmen
    const ansicht = await hole('/api/cse/t/dispo-link-0123456789', tokenFremd)
    expect(ansicht.daten.has_account).toBe(true)

    // Wer den Link nur weitergeleitet bekommen hat, kommt nicht hinein
    const falsch = await hole('/api/cse/t/dispo-link-0123456789/beitreten', tokenInhaber, { method: 'POST' })
    expect(falsch.status).toBe(403)

    const rein = await hole('/api/cse/t/dispo-link-0123456789/beitreten', tokenFremd, { method: 'POST' })
    expect(rein.status).toBe(200)
    expect(rein.daten.project_id).toBe(projekt)
    expect((await db.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [projekt, fremdeId])).role).toBe('read_only')
  })
})

describe('Offene Szenenkommentare je Szene', () => {
  it('zählt in einer Abfrage nur offene Kommentare und nur im eigenen Projekt', async () => {
    const a = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '30', 'Kommentarprobe A')", [projektId])).id
    const b = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '31', 'Kommentarprobe B')", [projektId])).id
    const neu = (szene: number, erledigt: number) => db.run(
      "INSERT INTO comments (project_id, entity_type, entity_id, author, content, resolved) VALUES (?, 'scene', ?, 'Probe', 'Text', ?)",
      [projektId, szene, erledigt])
    await neu(a, 0); await neu(a, 0); await neu(a, 1); await neu(b, 1)

    const antwort = await hole(`/api/projects/${projektId}/scene-comments/open`, tokenInhaber)
    expect(antwort.status).toBe(200)
    expect(antwort.daten[a]).toBe(2)
    expect(antwort.daten[b]).toBeUndefined()

    // Fremde sehen nichts
    const fremd = await hole(`/api/projects/${projektId}/scene-comments/open`, tokenFremd)
    expect(fremd.status).toBe(403)
  })
})

describe('Drehplan-Version wiederherstellen', () => {
  it('sichert den aktuellen Plan vorher und behält gemessene Minuten', async () => {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Versionsprobe', nutzerId])).id
    await db.run("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')", [projekt, nutzerId])
    const a = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '1', 'A')", [projekt])).id
    const b = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '2', 'B')", [projekt])).id
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-11-02')", [projekt])).id
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag, a])
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 1)', [tag, b])

    const version = await hole(`/api/projects/${projekt}/drehplan/snapshot`, tokenInhaber, { method: 'POST', body: JSON.stringify({ name: 'Stand A+B' }) })
    expect(version.status).toBe(201)

    // Danach gedreht und gemessen, Szene B verschoben
    await db.run('UPDATE shoot_day_scenes SET actual_minutes = 75 WHERE shoot_day_id = ? AND scene_id = ?', [tag, a])
    await db.run('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ? AND scene_id = ?', [tag, b])

    const zurueck = await hole(`/api/projects/${projekt}/drehplan/restore/${version.daten.id}`, tokenInhaber, { method: 'POST' })
    expect(zurueck.status).toBe(200)

    const zeilen = await db.all('SELECT scene_id, actual_minutes FROM shoot_day_scenes WHERE shoot_day_id = ? ORDER BY scene_id', [tag]) as any[]
    expect(zeilen.map(z => Number(z.scene_id))).toEqual([a, b])
    // Die Messung vom Set geht beim Zurückholen nicht verloren
    expect(zeilen.find(z => Number(z.scene_id) === a)?.actual_minutes).toBe(75)
    // Der Stand vor dem Zurückholen liegt als Version bereit
    const versionen = await db.all('SELECT name FROM drehplan_versions WHERE project_id = ? ORDER BY id', [projekt]) as any[]
    expect(versionen.length).toBe(2)
    expect(versionen[1].name).toContain('Stand A+B')
  })
})

describe('Sicherung vor KI-Optimierung wiederherstellen', () => {
  it('liest auch das ältere Format { shoot_days, scenes }', async () => {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['KI-Sicherungsprobe', nutzerId])).id
    await db.run("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')", [projekt, nutzerId])
    const a = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '1', 'A')", [projekt])).id
    const tag1 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-11-02')", [projekt])).id
    const tag2 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 2, '2026-11-03')", [projekt])).id
    // So legte die KI-Optimierung ihre Sicherung an: Szene A an Tag 1
    const alt = JSON.stringify({
      shoot_days: [{ id: tag1, day_number: 1 }, { id: tag2, day_number: 2 }],
      scenes: [{ id: a, shoot_day_id: tag1, day_sort_order: 0 }],
      created_at: '2026-10-31T12:00:00Z',
    })
    const version = (await db.run('INSERT INTO drehplan_versions (project_id, name, snapshot_json) VALUES (?, ?, ?)', [projekt, 'Vor KI-Optimierung', alt])).id
    // Die KI hatte A an Tag 2 gelegt
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag2, a])

    const zurueck = await hole(`/api/projects/${projekt}/drehplan/restore/${version}`, tokenInhaber, { method: 'POST' })
    expect(zurueck.status).toBe(200)
    const zeilen = await db.all('SELECT shoot_day_id FROM shoot_day_scenes WHERE scene_id = ?', [a]) as any[]
    expect(zeilen.map(z => Number(z.shoot_day_id))).toEqual([tag1])
  })
})
