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
  const { default: einstellungenRouter } = await import('../routes/einstellungen')
  app.use('/api', einstellungenRouter)
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
  const { default: belegeRouter } = await import('../routes/expenses')
  const { default: auswertungenRouter } = await import('../routes/auswertungen')
  app.use('/api', optionalAuth, belegeRouter, auswertungenRouter)
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
  // Szenen anlegen, ändern, entfallen lassen (AP A3)
  const { default: szenenRouter } = await import('../routes/scenes')
  app.use('/api', optionalAuth, szenenRouter)
  // Arbeitszeit-Prüfung (AP B3)
  const { default: stundenzettelRouter } = await import('../routes/timesheets')
  const { default: lohnRouter } = await import('../routes/payroll')
  const { default: dispoRouter } = await import('../routes/callsheets')
  app.use('/api', optionalAuth, stundenzettelRouter, lohnRouter, dispoRouter)
  const { default: drehplanRouter } = await import('../routes/drehplan')
  app.use('/api', optionalAuth, drehplanRouter)
  const { default: konfliktRouter } = await import('../routes/conflicts')
  app.use('/api', optionalAuth, konfliktRouter)
  const { default: tagesberichtRouter } = await import('../routes/dailyreports')
  app.use('/api', optionalAuth, tagesberichtRouter)
  const { default: kalkulationRouter } = await import('../routes/budget')
  app.use('/api', optionalAuth, kalkulationRouter)
  const { default: doodRouter } = await import('../routes/dood')
  const { default: kalenderRouter } = await import('../routes/calendar')
  const { default: besetzungRouter } = await import('../routes/characters')
  app.use('/api', optionalAuth, doodRouter, kalenderRouter, besetzungRouter)
  // Förderantrag und Projektübersicht rechnen die Finanzierung mit (AP E4)
  const { default: foerderRouter } = await import('../routes/foerderantrag')
  app.use('/api', optionalAuth, foerderRouter)
  // Check-in und Verpflegung zählen Köpfe (AP C1)
  const { default: checkinRouter } = await import('../routes/checkin')
  const { default: cateringRouter } = await import('../routes/catering')
  app.use('/api', optionalAuth, checkinRouter, cateringRouter)
  // Units und Stab je Unit (AP C2)
  const { default: unitsRouter } = await import('../routes/units')
  const { default: stabRouter } = await import('../routes/crew')
  app.use('/api', optionalAuth, unitsRouter, stabRouter)
  // Motive, Sets und Genehmigungen (AP C3)
  const { default: motivRouter } = await import('../routes/locations')
  const { default: genehmigungRouter } = await import('../routes/permits')
  app.use('/api', optionalAuth, motivRouter, genehmigungRouter)
  const { default: projekteRouter } = await import('../routes/projects')
  app.use('/api/projects', optionalAuth, projekteRouter)
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
  async function entwurfMitPosition(betragCents = 10000, leistung: string | null = '2026-10-01'): Promise<number> {
    const entwurf = await hole(`/api/companies/${firmaId}/invoices`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ client_id: kundeId, issue_date: '2026-10-08', service_from: leistung }),
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

  it('schreibt ohne Leistungsdatum nicht fest (§ 14 Abs. 4 Nr. 6 UStG)', async () => {
    // Testbericht SALZWIND: Entwurf ohne "Leistung von" bekam Nummer 2026-0001
    const id = await entwurfMitPosition(10000, null)
    const antwort = await hole(`/api/companies/${firmaId}/invoices/${id}/issue`, tokenInhaber, { method: 'POST' })
    expect(antwort.status).toBe(400)
    expect(antwort.fehler).toContain('Leistungsdatum')
    const gelesen = await hole(`/api/companies/${firmaId}/invoices/${id}`, tokenInhaber)
    expect(gelesen.daten.status).toBe('entwurf')
    expect(gelesen.daten.number ?? '').toBe('')
  })

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
      body: JSON.stringify({ client_id: kundeId, issue_date: '2027-01-03', service_from: '2026-12-20' }),
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


describe('Persönliche Einstellungen', () => {
  // Florian (03.11.2026): je Nutzer gespeichert und sicher voneinander getrennt
  it('trennt die Einstellungen zweier Konten', async () => {
    const anordnung = { kategorien: [{ id: 'planung', bereiche: ['drehplan', 'motive'] }], ausgeblendet: [] }
    expect((await hole('/api/einstellungen/arbeitsplatz:film', tokenInhaber, { method: 'PUT', body: JSON.stringify({ wert: anordnung }) })).status).toBe(200)
    expect((await hole('/api/einstellungen', tokenInhaber)).daten['arbeitsplatz:film']).toEqual(anordnung)
    // Die andere Person sieht nichts davon und überschreibt nur ihre eigene
    expect((await hole('/api/einstellungen', tokenFremd)).daten['arbeitsplatz:film']).toBeUndefined()
    await hole('/api/einstellungen/arbeitsplatz:film', tokenFremd, { method: 'PUT', body: JSON.stringify({ wert: { kategorien: [] } }) })
    expect((await hole('/api/einstellungen', tokenInhaber)).daten['arbeitsplatz:film']).toEqual(anordnung)
    expect((await hole('/api/einstellungen', tokenFremd)).daten['arbeitsplatz:film']).toEqual({ kategorien: [] })
    // Ohne Anmeldung nichts
    expect((await hole('/api/einstellungen', '')).status).toBe(401)
  })

  it('weist unbrauchbare Namen und zu große Werte ab und löscht auf Wunsch', async () => {
    expect((await hole('/api/einstellungen/Mit%20Leerzeichen', tokenInhaber, { method: 'PUT', body: JSON.stringify({ wert: 1 }) })).status).toBe(400)
    expect((await hole('/api/einstellungen/leer', tokenInhaber, { method: 'PUT', body: '{}' })).status).toBe(400)
    expect((await hole('/api/einstellungen/gross', tokenInhaber, { method: 'PUT', body: JSON.stringify({ wert: 'x'.repeat(40_000) }) })).status).toBe(413)
    await hole('/api/einstellungen/einfuehrungen', tokenInhaber, { method: 'PUT', body: JSON.stringify({ wert: { drehplan: true } }) })
    expect((await hole('/api/einstellungen/einfuehrungen', tokenInhaber, { method: 'DELETE' })).status).toBe(200)
    expect((await hole('/api/einstellungen', tokenInhaber)).daten.einfuehrungen).toBeUndefined()
  })

  it('verschwindet mit dem Konto', async () => {
    const konto = await hole('/api/auth/register', '', {
      method: 'POST', body: JSON.stringify({ name: 'Geht', email: 'einstellung-weg@example.com', password: 'Einstellung-123' }),
    })
    await hole('/api/einstellungen/arbeitsplatz:film', konto.daten.token, { method: 'PUT', body: JSON.stringify({ wert: { kategorien: [] } }) })
    await hole('/api/auth/me', konto.daten.token, { method: 'DELETE', body: JSON.stringify({ password: 'Einstellung-123' }) })
    expect(await db.get('SELECT id FROM user_einstellungen WHERE user_id = ?', [konto.daten.user.id])).toBeUndefined()
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

describe('Sperrtage im Konfliktradar', () => {
  // Bis 03.11.2026 prüfte nur die Sperrtage-Seite, und nur über die Szenen
  // der Rolle. Der Radar - Seitenleiste, Hauptseite - schwieg.
  let projekt = 0
  beforeAll(async () => {
    projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Mit Sperrtagen', nutzerId])).id
    const figur = await db.run('INSERT INTO characters (project_id, name) VALUES (?, ?)', [projekt, 'Kommissarin'])
    const szene = await db.run('INSERT INTO scenes (project_id, scene_number) VALUES (?, ?)', [projekt, '1'])
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene.id, figur.id])
    const ueberRolle = await db.run('INSERT INTO "cast" (project_id, actor_name, character_id) VALUES (?, ?, ?)', [projekt, 'Jana Petersen', figur.id])
    const vonHand = await db.run('INSERT INTO "cast" (project_id, actor_name) VALUES (?, ?)', [projekt, 'Tom Berger'])
    const frei = await db.run('INSERT INTO "cast" (project_id, actor_name) VALUES (?, ?)', [projekt, 'Ohne Drehtag'])

    const tag = await db.run("INSERT INTO shoot_days (project_id, day_number, date, status) VALUES (?, 1, '2026-12-01', 'Geplant')", [projekt])
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id) VALUES (?, ?)', [tag.id, szene.id])
    const dispo = await db.run('INSERT INTO call_sheets (shoot_day_id) VALUES (?)', [tag.id])
    await db.run("INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id) VALUES (?, 'cast', ?)", [dispo.id, vonHand.id])
    // Ausgefallen: niemand wird gebraucht
    const ausgefallen = await db.run("INSERT INTO shoot_days (project_id, day_number, date, status) VALUES (?, 2, '2026-12-02', 'Ausgefallen')", [projekt])
    const szene2 = await db.run('INSERT INTO scenes (project_id, scene_number) VALUES (?, ?)', [projekt, '2'])
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene2.id, figur.id])
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id) VALUES (?, ?)', [ausgefallen.id, szene2.id])

    const sperre = 'INSERT INTO cast_blackout_dates (project_id, cast_id, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)'
    await db.run(sperre, [projekt, ueberRolle.id, '2026-11-30', '2026-12-02', 'Theaterpremiere'])
    await db.run(sperre, [projekt, vonHand.id, '2026-12-01', '', ''])
    await db.run(sperre, [projekt, frei.id, '2026-12-01', '2026-12-01', ''])
  })

  it('meldet Sperrtage über die Rolle und über die Dispo, sonst keine', async () => {
    const antwort = await hole(`/api/projects/${projekt}/conflicts`, tokenInhaber)
    expect(antwort.status).toBe(200)
    const sperrtage = antwort.daten.filter((k: any) => k.link === 'sperrtage')
    expect(sperrtage.map((k: any) => k.message).sort()).toEqual([
      'Jana Petersen ist am 01.12.2026 gesperrt',
      'Tom Berger ist am 01.12.2026 gesperrt',
    ])
    expect(sperrtage.every((k: any) => k.severity === 'error')).toBe(true)
    expect(sperrtage.find((k: any) => k.message.startsWith('Jana')).detail).toBe('Drehtag 1 - Theaterpremiere')
    expect(antwort.daten.some((k: any) => k.category === 'Prüfung')).toBe(false)
  })

  it('zeigt der Sperrtage-Seite dieselben Konflikte', async () => {
    const antwort = await hole(`/api/projects/${projekt}/blackout-dates/conflicts`, tokenInhaber)
    expect(antwort.status).toBe(200)
    expect(antwort.daten.map((k: any) => k.cast_name).sort()).toEqual(['Jana Petersen', 'Tom Berger'])
  })
})

describe('Abgedreht im Tagesbericht', () => {
  // Fund 264: Der Bericht führte eine eigene Liste, Hauptseite und
  // Szenenliste lasen den Haken an der Szene - abgehakt am Set, und der
  // Fortschritt des Projekts blieb stehen.
  it('setzt den Haken an der Szene und nimmt ihn nur weg, wenn kein Bericht sie mehr führt', async () => {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Mit Bericht', nutzerId])).id
    const szene = (await db.run('INSERT INTO scenes (project_id, scene_number) VALUES (?, ?)', [projekt, '1'])).id
    const andere = (await db.run('INSERT INTO scenes (project_id, scene_number) VALUES (?, ?)', [projekt, '2'])).id
    const tag1 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-12-01')", [projekt])).id
    const tag2 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 2, '2026-12-02')", [projekt])).id
    const status = async (id: number) => (await db.get('SELECT shot_status FROM scenes WHERE id = ?', [id])).shot_status
    const bericht = (tag: number, fertig: number[]) => hole(`/api/shoot-days/${tag}/daily-report`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ scenes_completed: fertig, scenes_partial: [] }),
    })

    expect((await bericht(tag1, [szene])).status).toBe(200)
    expect(await status(szene)).toBe('abgedreht')
    expect(await status(andere)).not.toBe('abgedreht')

    // An Tag 2 ein zweites Mal abgedreht, an Tag 1 zurückgenommen: bleibt abgedreht
    await bericht(tag2, [szene])
    await bericht(tag1, [])
    expect(await status(szene)).toBe('abgedreht')

    // Kein Bericht führt sie mehr: wieder offen
    await bericht(tag2, [])
    expect(await status(szene)).toBe('offen')

    // Eine Szene eines anderen Projekts bleibt unberührt
    const fremd = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Fremd', fremdeId])).id
    const fremdeSzene = (await db.run('INSERT INTO scenes (project_id, scene_number) VALUES (?, ?)', [fremd, '9'])).id
    await bericht(tag1, [fremdeSzene])
    expect(await status(fremdeSzene)).not.toBe('abgedreht')
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

describe('Debitorennummer (AP B4)', () => {
  it('ohne Nummer nennt die Prüfung, wo sie hingehört; mit Nummer steht die Rechnung im Export', async () => {
    const firma = (await db.run(
      "INSERT INTO companies (name, owner_id, datev_berater, datev_mandant) VALUES ('Debitor GmbH', ?, 1001, 1)", [nutzerId])).id
    const kunde = await db.run("INSERT INTO company_clients (company_id, name) VALUES (?, 'Nordlicht')", [firma])
    const r = await db.run(
      "INSERT INTO invoices (company_id, client_id, number, status, issue_date, tax_mode) VALUES (?, ?, 'D-1', 'versendet', '2026-09-15', 'regel')",
      [firma, kunde.id])
    await db.run('INSERT INTO invoice_items (invoice_id, quantity_milli, unit_price_cents, tax_percent) VALUES (?, 1000, 10000, 19)', [r.id])
    const { buchungenBauen } = await import('../routes/buchhaltung')
    const ohne = await buchungenBauen(firma, '2026-09-01', '2026-09-30')
    expect(ohne.buchungen).toHaveLength(0)
    expect(ohne.fehlt).toContain('Debitorennummer für: Nordlicht - einzutragen unter Rechnungen, Reiter Auftraggeber')
    // Eintragen über die Route, die die Seite benutzt
    const antwort = await hole(`/api/companies/${firma}/clients/${kunde.id}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ debitor_number: '10001' }) })
    expect(antwort.status).toBe(200)
    const mit = await buchungenBauen(firma, '2026-09-01', '2026-09-30')
    expect(mit.buchungen.map((b: any) => [b.konto, b.belegfeld1])).toEqual([['10001', 'D-1']])
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

  it('fragt vor einem zweiten Import, statt still alles doppelt anzulegen', async () => {
    // Testbericht SALZWIND: 20 Szenen wurden ohne Rückfrage 40
    const ohne = await hole(`/api/projects/${projekt}/fdx-import`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ xml: fountain, filename: 'nochmal.fountain' }),
    })
    expect(ohne.status).toBe(409)
    expect(ohne.daten).toEqual({ vorhanden: 2, im_import: 2 })
    const anzahl = (await db.get('SELECT COUNT(*) AS c FROM scenes WHERE project_id = ?', [projekt])) as any
    expect(Number(anzahl.c)).toBe(2)
  })

  it('nummeriert einen gewollten zweiten Import weiter statt doppelt', async () => {
    const mit = await hole(`/api/projects/${projekt}/fdx-import`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ xml: fountain, filename: 'nochmal.fountain', anhaengen: true }),
    })
    expect(mit.status).toBe(200)
    const nummern = ((await db.all('SELECT scene_number FROM scenes WHERE project_id = ? ORDER BY sort_order', [projekt])) as any[])
      .map((z) => z.scene_number)
    expect(nummern).toEqual(['1', '2', '3', '4'])
  })

  it('übernimmt Nummern, INT./EXT. und Sonderzeichen aus Final Draft, ohne Titelseite als Szene', async () => {
    const leer = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Salzwind', nutzerId])).id
    const fdx = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="5">
  <Content>
    <Paragraph Type="Transition"><Text>FADE IN:</Text></Paragraph>
    <Paragraph Number="13" Type="Scene Heading"><Text>EXT. DEICH - NACHT</Text></Paragraph>
    <Paragraph Type="Action"><Text>Johanna&#x27;s Lampe flackert. Wasser &amp; Wind.</Text></Paragraph>
    <Paragraph Type="Action"/>
    <Paragraph Number="13A" Type="Scene Heading"><Text>INT./EXT. LKW - NACHT</Text></Paragraph>
    <Paragraph Type="Character"><Text>JOHANNA</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Fahr!</Text></Paragraph>
  </Content>
  <TitlePage><Content><Paragraph Type="Text"><Text>SALZWIND</Text></Paragraph></Content></TitlePage>
</FinalDraft>`
    const antwort = await hole(`/api/projects/${leer}/fdx-import`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ xml: fdx, filename: 'salzwind.fdx' }),
    })
    expect(antwort.status).toBe(200)
    expect(antwort.daten).toMatchObject({ scenes_created: 2, vorspann_uebersprungen: 1, nummern_uebernommen: 2 })
    const szenen = (await db.all('SELECT scene_number, int_ext, day_night, title FROM scenes WHERE project_id = ? ORDER BY sort_order', [leer])) as any[]
    expect(szenen).toEqual([
      { scene_number: '13', int_ext: 'EXT', day_night: 'NACHT', title: 'DEICH' },
      { scene_number: '13A', int_ext: 'INT/EXT', day_night: 'NACHT', title: 'LKW' },
    ])
    const text = (await db.all("SELECT content FROM screenplay_blocks WHERE project_id = ? AND block_type = 'action'", [leer])) as any[]
    expect(text.map((z) => z.content)).toEqual(["Johanna's Lampe flackert. Wasser & Wind."])
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

describe('Auswertung: Kosten wie im Kostenstand', () => {
  // Testbericht SALZWIND 09.11.2026: Belege erfasst, Rechnung festgeschrieben,
  // Auswertung "Kosten 0 €, Marge 100 %". Der Kostenstand speichert einen Beleg
  // ohne Datum, wenn das Feld leer bleibt - die Auswertung filterte nach Datum.
  // Und Umsatz zählte über die Rechnung, Kosten nur bei Projekten der Firma.
  it('zählt Belege ohne Datum und Projekte, die nur über die Rechnung zur Firma gehören', async () => {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Kosten GmbH', ?)", [nutzerId])).id
    const kunde = (await db.run("INSERT INTO company_clients (company_id, name) VALUES (?, 'Sender')", [firma])).id
    const projekt = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Ohne Firma', ?)", [nutzerId])).id
    const heute = new Date().toISOString().slice(0, 10)
    const rechnung = (await db.run(
      "INSERT INTO invoices (company_id, client_id, project_id, number, status, issue_date, tax_mode, net_cents) VALUES (?, ?, ?, ?, 'versendet', ?, 'regel', 100000)",
      [firma, kunde, projekt, `K-${Math.random()}`, heute]
    )).id
    expect(rechnung).toBeGreaterThan(0)
    const beleg = await hole(`/api/projects/${projekt}/expenses`, tokenInhaber, {
      method: 'POST', body: JSON.stringify({ description: 'Kamera', category: 'Equipment', amount_cents: 22190 }),
    })
    expect(beleg.status).toBe(201)

    const auswertung = await hole(`/api/companies/${firma}/auswertungen`, tokenInhaber)
    expect(auswertung.status).toBe(200)
    expect(auswertung.daten.kosten_cents).toBe(22190)
    const zeile = auswertung.daten.je_projekt.find((p: any) => Number(p.id) === projekt)
    expect(zeile.kosten_cents).toBe(22190)
    expect(zeile.marge_promille).toBe(778)
  })
})

describe('Kostenstand gegen die maßgebliche Kalkulation', () => {
  // Testbericht SALZWIND: Kalkulation gefüllt, aber als "Entwurf" -
  // Kostenstand "Kalkuliert 0,00 €" und "Überzogen".
  it('rechnet ohne aktive Fassung gegen die neueste und sagt, welche', async () => {
    const projekt = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Soll', ?)", [nutzerId])).id
    const alt = (await db.run("INSERT INTO budget_versions (project_id, name, created_at) VALUES (?, 'Erste', NOW() - interval '1 day')", [projekt])).id
    const neu = (await db.run("INSERT INTO budget_versions (project_id, name) VALUES (?, 'Zweite')", [projekt])).id
    await db.run("INSERT INTO budget_lines (budget_version_id, category, description, total_cents) VALUES (?, 'Equipment', 'alt', 100)", [alt])
    await db.run("INSERT INTO budget_lines (budget_version_id, category, description, total_cents) VALUES (?, 'Equipment', 'Kamera', 7418000)", [neu])
    const stand = await hole(`/api/projects/${projekt}/kostenstand`, tokenInhaber)
    expect(stand.status).toBe(200)
    expect(stand.daten.budget_version).toMatchObject({ id: neu, name: 'Zweite', status: 'Entwurf' })
    expect(stand.daten.totals.soll_cents).toBe(7418000)

    // Ist eine Fassung aktiv, zählt sie - auch wenn sie älter ist
    await db.run("UPDATE budget_versions SET status = 'Aktiv' WHERE id = ?", [alt])
    const aktiv = await hole(`/api/projects/${projekt}/kostenstand`, tokenInhaber)
    expect(aktiv.daten.budget_version.id).toBe(alt)
    expect(aktiv.daten.totals.soll_cents).toBe(100)
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

  it('fragt das fehlende Geburtsdatum mit Namen ab und prüft, was eingetragen wird (Fund 263)', async () => {
    // Vorher lieferte die Prüfung nur eine Zahl, und keine Seite hatte ein
    // Feld für das Datum - ein Kind im Projekt blieb unsichtbar.
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Mit Kind', nutzerId])).id
    const kind = (await db.run('INSERT INTO "cast" (project_id, actor_name) VALUES (?, ?)', [projekt, 'Mila Brandt'])).id
    const pfad = `/api/projects/${projekt}/jugendschutz/cast/${kind}`

    const vorher = await hole(`/api/projects/${projekt}/jugendschutz`, tokenInhaber)
    expect(vorher.daten.ohne_geburtsdatum).toBe(1)
    expect(vorher.daten.ohne_geburtsdatum_liste).toEqual([{ person_type: 'cast', person_id: kind, name: 'Mila Brandt' }])

    for (const falsch of [{ birthdate: 'abc' }, { birthdate: '2999-01-01' }, { birthdate: '2015-02-30' },
      { guardian_email: 'keine adresse' }, { permit_granted: 'ja' }, { school_bound: 'vielleicht' }]) {
      expect((await hole(pfad, tokenInhaber, { method: 'PUT', body: JSON.stringify(falsch) })).status).toBe(400)
    }
    expect((await db.get('SELECT birthdate FROM "cast" WHERE id = ?', [kind])).birthdate).toBeNull()

    expect((await hole(pfad, tokenInhaber, { method: 'PUT', body: JSON.stringify({ birthdate: '2015-06-01' }) })).status).toBe(200)
    const nachher = await hole(`/api/projects/${projekt}/jugendschutz`, tokenInhaber)
    expect(nachher.daten.ohne_geburtsdatum_liste).toEqual([])
    expect(nachher.daten.personen.map((p: any) => p.name)).toEqual(['Mila Brandt'])

    // Ein Kind eines anderen Projekts lässt sich über diesen Pfad nicht ändern
    const fremdes = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Fremd', fremdeId])).id
    const fremdesKind = (await db.run('INSERT INTO "cast" (project_id, actor_name) VALUES (?, ?)', [fremdes, 'Fremdes Kind'])).id
    const quer = await hole(`/api/projects/${projekt}/jugendschutz/cast/${fremdesKind}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ birthdate: '2015-06-01' }) })
    expect(quer.status).toBe(404)
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

    // Ein Sperrtag ist kein Drehtag - auch nicht für den Stab (Testbericht SALZWIND)
    await db.run("UPDATE shoot_days SET status = 'Sperrtag' WHERE id = ?", [t3])
    expect([...(await drehtageStab(db, projekt)).get(stab)!]).toEqual([t1])

    // Der Vertrag zählt genauso - ohne jede Dispo für Tag 1 stand dort vorher
    // "im Zeitraum ." und "insgesamt ."
    await db.run('UPDATE "cast" SET fee_per_day = 60000 WHERE id = ?', [darstellerin])
    const firma = (await db.run(
      "INSERT INTO companies (name, legal_name, owner_id) VALUES ('Nordlicht Film', 'Nordlicht Filmproduktion GmbH', ?)", [nutzerId])).id
    await db.run('UPDATE projects SET company_id = ? WHERE id = ?', [firma, projekt])
    const vorschau = await hole(`/api/projects/${projekt}/vertraege/vorschau`, tokenInhaber, {
      method: 'POST',
      body: JSON.stringify({ person_type: 'cast', person_id: darstellerin, body: '{{drehtage}} Tage, {{drehzeitraum}}, {{gage_gesamt}}, {{produktion}}' }),
    })
    expect(vorschau.status).toBe(200)
    expect(vorschau.daten.text).toBe('2 Tage, 01.12.2026 bis 02.12.2026, 1.200,00\u00a0€, Nordlicht Filmproduktion GmbH')
    expect(vorschau.daten.fehlt).toEqual([])
  })
})

describe('Vertrag als PDF-Text', () => {
  it('hält einen Listenpunkt über mehrere Zeilen zusammen und zählt über Absätze weiter', async () => {
    const { listenpunkte } = await import('../routes/vertraege')
    expect(listenpunkte('1. Die Mitwirkung bedarf zusätzlich der Bewilligung der zuständigen\n   Aufsichtsbehörde nach § 6 JArbSchG.'))
      .toEqual(['Die Mitwirkung bedarf zusätzlich der Bewilligung der zuständigen Aufsichtsbehörde nach § 6 JArbSchG.'])
    expect(listenpunkte('- eins\n- zwei\n  weiter')).toEqual(['eins', 'zwei weiter'])
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

describe('Geld über der alten Grenze von INTEGER', () => {
  // Gemessen am 12.11.2026: Alle Geldspalten waren INTEGER. Über
  // 21.474.836,47 € Summe antwortete die Kalkulation mit 400, hatte die Zeile
  // aber gespeichert, und die Summe der Fassung blieb falsch.
  const sende = (pfad: string, koerper: any, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  const zeile = (extra: Record<string, any> = {}) =>
    ({ category: 'Gagen', description: 'Probe', unit: 'pauschal', quantity: 1, unit_price_cents: 2_000_000_000, ...extra })

  it('jede Geldspalte ist BIGINT, auch eine, die jemand neu anlegt', async () => {
    const { GELDSPALTEN } = await import('../lib/geld')
    const spalten = await db.all(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_schema = current_schema()`
    ) as Array<{ table_name: string; column_name: string; data_type: string }>
    const typ = new Map(spalten.map(s => [`${s.table_name}.${s.column_name}`, s.data_type]))

    const falsch: string[] = []
    for (const [tabelle, namen] of Object.entries(GELDSPALTEN)) {
      for (const name of namen) {
        if (typ.get(`${tabelle}.${name}`) !== 'bigint') falsch.push(`${tabelle}.${name}: ${typ.get(`${tabelle}.${name}`)}`)
      }
    }
    expect(falsch).toEqual([])

    // Eine neue Spalte mit _cents im Namen, die nicht in der Liste steht,
    // bliebe INTEGER und fiele erst bei einem großen Film auf.
    const vergessen = spalten
      .filter(s => s.column_name.endsWith('_cents') && s.data_type !== 'bigint')
      .map(s => `${s.table_name}.${s.column_name}`)
    expect(vergessen).toEqual([])
  })

  it('Summen und Zählungen kommen als Zahl, nicht als Text', async () => {
    const z = await db.get('SELECT COUNT(*) AS c, COALESCE(SUM(total_cents), 0) AS s FROM budget_lines') as any
    expect(typeof z.c).toBe('number')
    expect(typeof z.s).toBe('number')
  })

  it('zwei Zeilen zu je 20 Mio. € ergeben 40 Mio. €', async () => {
    const projekt = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Groß', ?)", [nutzerId])).id
    const fassung = (await sende(`/api/projects/${projekt}/budget-versions`, { name: 'Groß', schema: 'frei' })).daten.id
    const a = await sende(`/api/budget-versions/${fassung}/lines`, zeile())
    const b = await sende(`/api/budget-versions/${fassung}/lines`, zeile({ description: 'Probe 2' }))
    expect([a.status, b.status]).toEqual([201, 201])
    expect(b.daten.total_cents).toBe(2_000_000_000)

    const fassungen = await hole(`/api/projects/${projekt}/budget-versions`, tokenInhaber)
    expect(fassungen.daten.find((f: any) => f.id === fassung).total_cents).toBe(4_000_000_000)

    // Belege über der alten Grenze: die Übersicht rechnet und liefert Zahlen
    await db.run("INSERT INTO expenses (project_id, description, amount_cents) VALUES (?, 'A', 2000000000), (?, 'B', 2000000000)", [projekt, projekt])
    const uebersicht = await hole(`/api/projects/${projekt}/budget-summary`, tokenInhaber)
    expect(uebersicht.daten.total_spent_cents).toBe(4_000_000_000)
    expect(uebersicht.daten.budget_total_cents).toBe(4_000_000_000)
  })

  it('eine abgelehnte Zeile ist nicht gespeichert', async () => {
    const projekt = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Unsinn', ?)", [nutzerId])).id
    const fassung = (await sende(`/api/projects/${projekt}/budget-versions`, { name: 'Unsinn', schema: 'frei' })).daten.id
    const pfad = `/api/budget-versions/${fassung}/lines`

    const zuGross = await sende(pfad, zeile({ quantity: 3, unit_price_cents: 99_999_999_999 }))
    expect(zuGross.status).toBe(400)
    expect(zuGross.fehler).toContain('999.999.999,99 €')

    const negativ = await sende(pfad, zeile({ quantity: -5, unit_price_cents: 10000 }))
    expect(negativ.status).toBe(400)
    expect(negativ.fehler).toBe('Die Menge muss eine Zahl ab 0 sein.')

    // Vorher HTTP 500 "Unerwarteter Serverfehler"
    const text = await sende(pfad, zeile({ quantity: 'abc' }))
    expect(text.status).toBe(400)
    expect(text.fehler).toBe('Die Menge muss eine Zahl ab 0 sein.')

    // Vorher 400 mit dem falschen Grund "Eine Zahl wurde als Text übergeben."
    const krumm = await sende(pfad, zeile({ unit_price_cents: 100.5 }))
    expect(krumm.status).toBe(400)
    expect(krumm.fehler).toBe('Der Preis muss ein Betrag in ganzen Cent sein.')

    const gespeichert = await db.get('SELECT COUNT(*) AS c FROM budget_lines WHERE budget_version_id = ?', [fassung]) as any
    expect(gespeichert.c).toBe(0)

    // Ändern einer vorhandenen Zeile auf Unsinn lässt sie, wie sie war
    const gut = await sende(pfad, zeile({ unit_price_cents: 10000 }))
    const geaendert = await sende(`/api/budget-lines/${gut.daten.id}`, { ...gut.daten, quantity: -1 }, 'PUT')
    expect(geaendert.status).toBe(400)
    const danach = await db.get('SELECT quantity, total_cents FROM budget_lines WHERE id = ?', [gut.daten.id]) as any
    expect(danach).toMatchObject({ quantity: 1, total_cents: 10000 })
  })

  it('ein Abzug mit negativem Preis bleibt möglich', async () => {
    const projekt = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Abzug', ?)", [nutzerId])).id
    const fassung = (await sende(`/api/projects/${projekt}/budget-versions`, { name: 'Abzug', schema: 'frei' })).daten.id
    await sende(`/api/budget-versions/${fassung}/lines`, zeile({ unit_price_cents: 50000 }))
    const abzug = await sende(`/api/budget-versions/${fassung}/lines`, zeile({ description: 'Rabatt', quantity: 2, unit_price_cents: -10000 }))
    expect(abzug.status).toBe(201)
    const f = await db.get('SELECT total_cents FROM budget_versions WHERE id = ?', [fassung]) as any
    expect(f.total_cents).toBe(30000)

    // Löschen rechnet die Summe in derselben Transaktion neu
    const weg = await hole(`/api/budget-lines/${abzug.daten.id}`, tokenInhaber, { method: 'DELETE' })
    expect(weg.status).toBe(200)
    const g = await db.get('SELECT total_cents FROM budget_versions WHERE id = ?', [fassung]) as any
    expect(g.total_cents).toBe(50000)
  })

  it('Geldgeber: große Beträge ja, negative nein', async () => {
    const projekt = (await db.run("INSERT INTO projects (title, owner_id) VALUES ('Geldgeber', ?)", [nutzerId])).id
    const plan = (await sende(`/api/projects/${projekt}/financing-versions`, { name: 'Plan' })).daten.id
    const pfad = `/api/financing-versions/${plan}/entries`
    const a = await sende(pfad, { source: 'Förderung A', amount_cents: 2_000_000_000 })
    const b = await sende(pfad, { source: 'Förderung B', amount_cents: 2_000_000_000 })
    expect([a.status, b.status]).toEqual([201, 201])

    const negativ = await sende(pfad, { source: 'Minus', amount_cents: -500000 })
    expect(negativ.status).toBe(400)
    expect(negativ.fehler).toBe('Der Betrag eines Geldgebers kann nicht negativ sein.')

    const geaendert = await sende(`/api/financing-entries/${a.daten.id}`, { ...a.daten, amount_cents: -1 }, 'PUT')
    expect(geaendert.status).toBe(400)

    const stand = await db.get(
      'SELECT total_cents, (SELECT COUNT(*) FROM financing_entries WHERE financing_version_id = ?) AS zahl FROM financing_plan_versions WHERE id = ?',
      [plan, plan]) as any
    expect(stand).toMatchObject({ total_cents: 4_000_000_000, zahl: 2 })
  })
})

describe('DOOD nach Branchenregel und Haltetage (AP A1)', () => {
  const sende = (pfad: string, koerper: any, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })

  /** Projekt mit einer Darstellerin, die an den genannten Tagen einer Woche (Mo = 0) spielt. */
  async function woche(titel: string, tage: number, spielt: number[], darstellerin: Record<string, any>) {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', [titel, nutzerId])).id
    const figur = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Johanna')", [projekt])).id
    const spalten = Object.keys(darstellerin)
    const cast = (await db.run(
      `INSERT INTO "cast" (project_id, character_id, actor_name${spalten.map(s => ', ' + s).join('')})
       VALUES (?, ?, 'Mara Lind'${spalten.map(() => ', ?').join('')})`,
      [projekt, figur, ...spalten.map(s => darstellerin[s])])).id
    const ids: number[] = []
    for (let i = 0; i < tage; i++) {
      const datum = `2026-11-${String(16 + i).padStart(2, '0')}`
      ids.push((await db.run("INSERT INTO shoot_days (project_id, day_number, date, status) VALUES (?, ?, ?, 'Geplant')", [projekt, i + 1, datum])).id)
      if (spielt.includes(i)) {
        const szene = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, ?, 'DEICH')", [projekt, String(i + 1)])).id
        await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene, figur])
        await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [ids[i], szene])
      }
    }
    return { projekt, cast, ids }
  }

  it('Kürzel, Sperr- und Reservetage, Reise und Probe', async () => {
    const { projekt, cast, ids } = await woche('DOOD', 5, [0, 4], { fee_per_day: 60000, hold_allowed: true, hold_fee_per_day: 30000 })
    const bericht = async () => (await hole(`/api/projects/${projekt}/dood-report`, tokenInhaber)).daten
    let r = await bericht()
    expect(r.cast[0].days.map((d: any) => d.code)).toEqual(['SW', 'H', 'H', 'H', 'WF'])
    expect(r.cast[0]).toMatchObject({ total_work_days: 2, total_hold_days: 3, total_hold_cost_cents: 90000, total_cost_cents: 210000 })

    // Sperrtag und Reservetag sind frei: kein Halt, keine Zählung
    await db.run("UPDATE shoot_days SET status = 'Sperrtag' WHERE id = ?", [ids[2]])
    await db.run("UPDATE shoot_days SET status = 'Reserve' WHERE id = ?", [ids[1]])
    r = await bericht()
    expect(r.cast[0].days.map((d: any) => d.code)).toEqual(['SW', '', '', 'H', 'WF'])
    expect(r.spalten.map((s: any) => s.frei)).toEqual([false, true, true, false, false])
    expect(r.cast[0].total_hold_days).toBe(1)

    // Anreise am Sonntag davor und eine Probe am Samstag erweitern die Spalten
    const reise = (await db.run(
      "INSERT INTO trips (project_id, person_type, person_id, from_date, to_date) VALUES (?, 'cast', ?, '2026-11-15', '2026-11-15')",
      [projekt, cast])).id
    await db.run("INSERT INTO trip_days (trip_id, day_date, kind) VALUES (?, '2026-11-15', 'anreise')", [reise])
    const probe = await sende(`/api/projects/${projekt}/events`, { title: 'Leseprobe', start_date: '2026-11-14', type: 'Probe', cast_ids: [cast] })
    expect(probe.status).toBe(201)
    expect(probe.daten.cast_ids).toEqual([cast])
    r = await bericht()
    expect(r.spalten[0].datum).toBe('2026-11-14')
    expect(r.cast[0].days.slice(0, 3).map((d: any) => d.code)).toEqual(['R', 'TR', 'SW'])
    expect(r.cast[0]).toMatchObject({ total_work_days: 2, total_worked_days: 4, total_travel_days: 1, total_rehearsal_days: 1 })
  })

  it('Termine nehmen nur Darsteller aus dem eigenen Projekt', async () => {
    const eigen = await woche('Eigen', 1, [0], {})
    const fremd = await woche('Fremd', 1, [0], {})
    const vorher = await db.get('SELECT COUNT(*) AS c FROM project_events WHERE project_id = ?', [eigen.projekt]) as any
    const r = await sende(`/api/projects/${eigen.projekt}/events`, { title: 'Probe', start_date: '2026-11-14', type: 'Probe', cast_ids: [eigen.cast, fremd.cast] })
    expect(r.status).toBe(404)
    const nachher = await db.get('SELECT COUNT(*) AS c FROM project_events WHERE project_id = ?', [eigen.projekt]) as any
    expect(nachher.c).toBe(vorher.c)
  })

  it('Drop nur mit Haltetagen und mit Mindestzahl', async () => {
    const { cast } = await woche('Drop', 1, [0], {})
    // Die Seite schickt immer die ganze Zeile; ohne die neuen Felder bleiben sie, wie sie sind
    const zeile = async () => {
      const z = await db.get('SELECT * FROM "cast" WHERE id = ?', [cast]) as any
      const { hold_allowed, hold_fee_per_day, drop_allowed, drop_min_days, ...rest } = z
      return rest
    }
    const speichere = async (aenderung: Record<string, any>) => sende(`/api/cast/${cast}`, { ...(await zeile()), ...aenderung }, 'PUT')

    expect((await speichere({ drop_allowed: true, drop_min_days: 10 })).status).toBe(400)
    const ohneTage = await speichere({ hold_allowed: true, drop_allowed: true })
    expect(ohneTage.fehler).toBe('Für Drop und Pickup fehlt die Mindestzahl an Kalendertagen.')
    const gut = await speichere({ hold_allowed: true, drop_allowed: true, drop_min_days: 10, hold_fee_per_day: 25000 })
    expect(gut.fehler ?? '').toBe('')
    expect(gut.daten).toMatchObject({ hold_allowed: true, drop_allowed: true, drop_min_days: 10, hold_fee_per_day: 25000 })
    const ohneFelder = await speichere({ actor_name: 'Mara L.' })
    expect(ohneFelder.daten).toMatchObject({ actor_name: 'Mara L.', hold_allowed: true, drop_allowed: true, drop_min_days: 10, hold_fee_per_day: 25000 })
    // Haltetage aus nimmt den Drop mit
    const aus = await speichere({ hold_allowed: false })
    expect(aus.daten).toMatchObject({ hold_allowed: false, drop_allowed: false })
  })

  it('Kosten übernehmen: Haltetage als eigener Posten, Reservetage zählen für niemanden', async () => {
    const { projekt, cast, ids } = await woche('Kalkulation Halt', 4, [0, 2], { fee_per_day: 60000, hold_allowed: true, hold_fee_per_day: 30000 })
    const stab = (await db.run("INSERT INTO crew (project_id, name, role, fee_per_day) VALUES (?, 'Kai Brehm', 'Kamera', 10000)", [projekt])).id
    const fassung = (await db.run("INSERT INTO budget_versions (project_id, name) VALUES (?, 'K')", [projekt])).id
    const uebernehmen = async () => (await sende(`/api/budget-versions/${fassung}/kosten-uebernehmen`, {})).daten
    const zeile = async (schluessel: string) =>
      await db.get('SELECT quantity, total_cents FROM budget_lines WHERE budget_version_id = ? AND source_key = ?', [fassung, schluessel]) as any

    const erst = await uebernehmen()
    expect(await zeile(`cast:${cast}`)).toMatchObject({ quantity: 2, total_cents: 120000 })
    expect(await zeile(`cast-halt:${cast}`)).toMatchObject({ quantity: 1, total_cents: 30000 })
    // Tag 2 und 4 haben keine Szene und keine Dispo: Sie zählen für den Stab und werden genannt
    expect(await zeile(`crew:${stab}`)).toMatchObject({ quantity: 4 })
    expect(erst.leere_drehtage).toEqual([2, 4])

    // Ein zweiter Lauf ändert nichts
    const zweit = await uebernehmen()
    expect([zweit.neu, zweit.geaendert, zweit.entfallen]).toEqual([0, 0, 0])

    // Tag 4 als Reserve: zählt für niemanden, der Hinweis nennt ihn nicht mehr
    await db.run("UPDATE shoot_days SET status = 'Reserve' WHERE id = ?", [ids[3]])
    const reserve = await uebernehmen()
    expect(await zeile(`crew:${stab}`)).toMatchObject({ quantity: 3 })
    expect(reserve.leere_drehtage).toEqual([2])

    // Haltegage 0: kein Posten mehr
    await db.run('UPDATE "cast" SET hold_fee_per_day = 0 WHERE id = ?', [cast])
    const ohne = await uebernehmen()
    expect(ohne.entfallen).toBe(1)
    expect(await zeile(`cast-halt:${cast}`)).toBeUndefined()
  })
})

describe('Vertrag vor dem Versand prüfen und danach (AP A4, A5)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  const VORLAGE = '# Darstellervertrag\n\nRolle: {{rolle}}. Gage je Drehtag: **{{gage}}**, insgesamt {{gage_gesamt}}.'

  async function projektMitDarstellerin(gage: number | null) {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Verträge A4', nutzerId])).id
    const figur = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Johanna')", [projekt])).id
    const cast = (await db.run(
      `INSERT INTO "cast" (project_id, character_id, actor_name, email, fee_per_day) VALUES (?, ?, 'Mara Lind', 'mara@demo.test', ?)`,
      [projekt, figur, gage ?? 0])).id
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date, status) VALUES (?, 1, '2026-11-16', 'Geplant')", [projekt])).id
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '1', 'DEICH')", [projekt])).id
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene, figur])
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag, szene])
    return { projekt, cast }
  }

  it('merkt sich die Lücken, sendet nicht still und füllt neu', async () => {
    const { projekt, cast } = await projektMitDarstellerin(null)
    // Wie die Seite: erst die Vorschau, dann der gefüllte Text samt Vorlage
    const vorschau = await sende(`/api/projects/${projekt}/vertraege/vorschau`, { person_type: 'cast', person_id: cast, body: VORLAGE })
    expect(vorschau.daten.text).not.toContain('{{')
    const angelegt = await sende(`/api/projects/${projekt}/vertraege`,
      { person_type: 'cast', person_id: cast, body: vorschau.daten.text, vorlage: VORLAGE, kind: 'darsteller' })
    expect(angelegt.status).toBe(200)
    expect(angelegt.daten.fehlt).toEqual(['gage', 'gage_gesamt'])
    const id = angelegt.daten.id

    const gesperrt = await sende(`/api/projects/${projekt}/vertraege/${id}/senden`)
    expect(gesperrt.status).toBe(409)
    expect(gesperrt.fehler).toContain('Gage je Drehtag')
    expect((await db.get('SELECT status FROM contracts WHERE id = ?', [id])).status).toBe('entwurf')

    await db.run('UPDATE "cast" SET fee_per_day = 60000 WHERE id = ?', [cast])
    const neu = await sende(`/api/projects/${projekt}/vertraege/${id}/neu-fuellen`)
    expect(neu.status).toBe(200)
    expect(neu.daten.fehlt).toEqual([])
    expect(neu.daten.body).toContain('600,00 €')

    const gesendet = await sende(`/api/projects/${projekt}/vertraege/${id}/senden`)
    expect(gesendet.status).toBe(200)
    // Ein verschickter Vertrag wird nicht neu gefüllt
    expect((await sende(`/api/projects/${projekt}/vertraege/${id}/neu-fuellen`)).status).toBe(400)
  })

  it('mit "trotzdem" geht es sofort und steht im Protokoll', async () => {
    const { projekt, cast } = await projektMitDarstellerin(null)
    const id = (await sende(`/api/projects/${projekt}/vertraege`, { person_type: 'cast', person_id: cast, body: VORLAGE })).daten.id
    const r = await sende(`/api/projects/${projekt}/vertraege/${id}/senden`, { trotzdem: true })
    expect(r.status).toBe(200)
    // Das Protokoll wird ohne Warten geschrieben (routes/audit.ts)
    let eintrag: any
    for (let i = 0; i < 20 && !eintrag; i++) {
      eintrag = await db.get(
        "SELECT new_value FROM audit_log WHERE project_id = ? AND action = 'vertrag versendet' AND entity_id = ?", [projekt, id])
      if (!eintrag) await new Promise(r => setTimeout(r, 50))
    }
    expect(String(eintrag?.new_value)).toContain('gage_gesamt')
  })

  it('Liste mit Link und unterschriebenem Exemplar, Text ohne Auszeichnung, Vermerk im Blatt', async () => {
    const { projekt, cast } = await projektMitDarstellerin(50000)
    const id = (await sende(`/api/projects/${projekt}/vertraege`, { person_type: 'cast', person_id: cast, body: VORLAGE })).daten.id
    const liste = async () => (await hole(`/api/projects/${projekt}/vertraege`, tokenInhaber)).daten.personen
      .flatMap((p: any) => p.vertraege).find((v: any) => v.id === id)

    expect((await liste()).link).toBeNull()
    await sende(`/api/projects/${projekt}/vertraege/${id}/senden`)
    const v = await liste()
    expect(v.link).toMatch(/\/vertrag\/[0-9a-f]{48}$/)
    expect(v.unterschrieben).toBeNull()

    await db.run(
      "INSERT INTO project_files (project_id, kind, filename, mime, bytes, content, entity_type, entity_id) VALUES (?, 'vertrag', 'scan.pdf', 'application/pdf', 3, ?, 'contract', ?)",
      [projekt, Buffer.from('pdf'), id])
    expect((await liste()).unterschrieben).toMatchObject({ dateiname: 'scan.pdf' })

    const text = await hole(`/api/projects/${projekt}/vertraege/${id}/text`, tokenInhaber)
    expect(text.status).toBe(200)
    expect(text.daten.text).toContain('Gage je Drehtag: 500,00 €')
    expect(text.daten.text).not.toContain('**')

    // Bestätigt über den Link: der Vermerk steht im Text des Blatts
    const token = (await db.get('SELECT token FROM contracts WHERE id = ?', [id])).token
    await hole(`/api/vertrag/${token}/bestaetigen`, '', { method: 'POST', body: JSON.stringify({ name: 'Mara Lind' }) })
    const { vertragsBlatt } = await import('../routes/vertraege')
    expect(await vertragsBlatt(id)).toContain('von Mara Lind über den persönlichen Link')
  })

  it('Abschluss zählt einen Vertrag mit unterschriebenem Exemplar nicht als offen', async () => {
    const { projekt, cast } = await projektMitDarstellerin(50000)
    const id = (await sende(`/api/projects/${projekt}/vertraege`, { person_type: 'cast', person_id: cast, body: VORLAGE })).daten.id
    await sende(`/api/projects/${projekt}/vertraege/${id}/senden`)
    const offen = async () => ((await hole(`/api/projects/${projekt}/abschluss`, tokenInhaber)).daten.punkte as any[])
      .find((p: any) => p.schluessel === 'vertraege')?.anzahl ?? 0
    expect(await offen()).toBe(1)
    await db.run(
      "INSERT INTO project_files (project_id, kind, filename, mime, bytes, content, entity_type, entity_id) VALUES (?, 'vertrag', 'scan.pdf', 'application/pdf', 3, ?, 'contract', ?)",
      [projekt, Buffer.from('pdf'), id])
    expect(await offen()).toBe(0)
  })
})

describe('Stäbchenplan als Board (AP A2)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  const anzahl = async (sql: string, werte: any[]) => Number(((await db.get(sql, werte)) as any).n)

  /** Projekt mit Drehtagen (Datum, Szenennummern, Status). Szenen ohne Tag liegen in der Ablage. */
  async function plan(titel: string, tage: Array<{ datum: string; szenen: string[]; status?: string }>, ablage: string[] = []) {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', [titel, nutzerId])).id
    const szene: Record<string, number> = {}
    const neu = async (nr: string) => {
      szene[nr] = (await db.run(
        "INSERT INTO scenes (project_id, scene_number, title, eighths, estimated_minutes) VALUES (?, ?, 'DEICH', 8, 60)",
        [projekt, nr])).id
    }
    const tag: number[] = []
    for (const [i, t] of tage.entries()) {
      const id = (await db.run('INSERT INTO shoot_days (project_id, day_number, date, status) VALUES (?, ?, ?, ?)',
        [projekt, i + 1, t.datum, t.status ?? 'Geplant'])).id
      tag.push(id)
      for (const [j, nr] of t.szenen.entries()) {
        await neu(nr)
        await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, ?)', [id, szene[nr], j])
      }
    }
    for (const nr of ablage) await neu(nr)
    return { projekt, szene, tag }
  }

  /** Was in einem Tag steht, in seiner Reihenfolge: Szenennummern, Banner als "B:Text". */
  async function reihe(tagId: number) {
    const zeilen = (await db.all(
      `SELECT sds.sort_order, 'S' AS art, s.scene_number AS wert
         FROM shoot_day_scenes sds JOIN scenes s ON s.id = sds.scene_id WHERE sds.shoot_day_id = ?
       UNION ALL
       SELECT sort_order, 'B', text FROM shoot_day_banners WHERE shoot_day_id = ?
       ORDER BY 1`, [tagId, tagId])) as any[]
    return {
      werte: zeilen.map((z) => (z.art === 'B' ? `B:${z.wert}` : z.wert)),
      ordnung: zeilen.map((z) => Number(z.sort_order)),
    }
  }
  const daten = async (projekt: number) =>
    ((await db.all('SELECT date FROM shoot_days WHERE project_id = ? ORDER BY day_number', [projekt])) as any[]).map((t) => t.date)

  it('verschiebt mehrere Szenen in ihrer Reihenfolge an eine Stelle und nummeriert beide Tage neu', async () => {
    const { projekt, szene, tag } = await plan('Board verschieben', [
      { datum: '2026-11-16', szenen: ['1', '2', '3'] },
      { datum: '2026-11-17', szenen: ['4', '5'] },
    ], ['6'])
    const banner = await sende(`/api/shoot-days/${tag[1]}/banner`, { text: 'Umzug zum Hafen', minutes: 45 })
    expect(banner.status).toBe(201)

    const pfad = `/api/projects/${projekt}/drehplan/verschieben`
    const r = await sende(pfad, { szenen: [szene['6'], szene['1'], szene['3']], zielTag: tag[1], vor: { art: 'szene', id: szene['5'] } })
    expect(r.status).toBe(200)
    expect(await reihe(tag[1])).toEqual({ werte: ['4', '6', '1', '3', '5', 'B:Umzug zum Hafen'], ordnung: [0, 1, 2, 3, 4, 5] })
    expect(await reihe(tag[0])).toEqual({ werte: ['2'], ordnung: [0] })

    // Vor einen Banner, dann zurück in die Ablage
    expect((await sende(pfad, { szenen: [szene['2']], zielTag: tag[1], vor: { art: 'banner', id: banner.daten.id } })).status).toBe(200)
    expect((await reihe(tag[1])).werte).toEqual(['4', '6', '1', '3', '5', '2', 'B:Umzug zum Hafen'])
    expect((await sende(pfad, { szenen: [szene['6']], zielTag: null, vor: null })).status).toBe(200)
    expect(await reihe(tag[1])).toEqual({ werte: ['4', '1', '3', '5', '2', 'B:Umzug zum Hafen'], ordnung: [0, 1, 2, 3, 4, 5] })
    expect(await anzahl('SELECT COUNT(*) AS n FROM shoot_day_scenes WHERE scene_id = ?', [szene['6']])).toBe(0)
  })

  it('verschieben behält die Messung vom Set, wenn eine Szene im selben Tag bleibt', async () => {
    const { projekt, szene, tag } = await plan('Board Messung', [{ datum: '2026-11-16', szenen: ['1', '2'] }])
    await db.run('UPDATE shoot_day_scenes SET actual_minutes = 75 WHERE scene_id = ?', [szene['2']])
    await sende(`/api/projects/${projekt}/drehplan/verschieben`, { szenen: [szene['2']], zielTag: tag[0], vor: { art: 'szene', id: szene['1'] } })
    expect((await reihe(tag[0])).werte).toEqual(['2', '1'])
    expect(Number(((await db.get('SELECT actual_minutes FROM shoot_day_scenes WHERE scene_id = ?', [szene['2']])) as any).actual_minutes)).toBe(75)
  })

  it('lehnt fremde Szenen und Tage mit 404, einen Sperrtag und eine leere Auswahl mit 400 ab', async () => {
    const eigen = await plan('Board eigen', [
      { datum: '2026-11-16', szenen: ['1'] },
      { datum: '2026-11-17', szenen: [], status: 'Sperrtag' },
    ])
    const fremd = await plan('Board fremd', [{ datum: '2026-11-16', szenen: ['9'] }])
    const pfad = `/api/projects/${eigen.projekt}/drehplan/verschieben`
    expect((await sende(pfad, { szenen: [fremd.szene['9']], zielTag: eigen.tag[0], vor: null })).status).toBe(404)
    expect((await sende(pfad, { szenen: [eigen.szene['1']], zielTag: fremd.tag[0], vor: null })).status).toBe(404)
    expect((await sende(pfad, { szenen: [eigen.szene['1']], zielTag: eigen.tag[1], vor: null })).status).toBe(400)
    expect((await sende(pfad, { szenen: [], zielTag: eigen.tag[0], vor: null })).status).toBe(400)
    expect((await reihe(eigen.tag[0])).werte).toEqual(['1'])
    expect((await reihe(fremd.tag[0])).werte).toEqual(['9'])
  })

  it('verschieben zieht die Besetzung in die Dispo des Zieltags nach', async () => {
    const { dispoFuerDrehtag } = await import('../lib/dispo')
    const { projekt, szene, tag } = await plan('Board Dispo', [{ datum: '2026-11-16', szenen: ['1'] }], ['2'])
    const rolle = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Fischer')", [projekt])).id
    await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [szene['2'], rolle])
    const ole = (await db.run('INSERT INTO "cast" (project_id, character_id, actor_name) VALUES (?, ?, \'Ole\')', [projekt, rolle])).id
    const dispo = await dispoFuerDrehtag(tag[0])
    await sende(`/api/projects/${projekt}/drehplan/verschieben`, { szenen: [szene['2']], zielTag: tag[0], vor: null })
    const besetzung = ((await db.all("SELECT person_id FROM call_sheet_entries WHERE call_sheet_id = ? AND person_type = 'cast'", [dispo!.id])) as any[])
      .map((e) => Number(e.person_id))
    expect(besetzung).toEqual([Number(ole)])
  })

  it('zählt einen Banner zur Drehzeit des Tages und liefert ihn mit dem Tag', async () => {
    const { projekt, tag } = await plan('Board Banner', [{ datum: '2026-11-16', szenen: ['1', '2'] }])
    expect((await sende(`/api/shoot-days/${tag[0]}/banner`, { text: ' ', minutes: 10 })).status).toBe(400)
    expect((await sende(`/api/shoot-days/${tag[0]}/banner`, { text: 'Umzug', minutes: -5 })).status).toBe(400)
    const b = await sende(`/api/shoot-days/${tag[0]}/banner`, { text: 'Umzug', minutes: 45 })
    expect(b.status).toBe(201)
    const tagLesen = async () => (await hole(`/api/projects/${projekt}/shoot-days`, tokenInhaber)).daten[0]
    let t = await tagLesen()
    expect(t.estimated_minutes).toBe(165)
    expect(t.banner).toEqual([expect.objectContaining({ id: b.daten.id, text: 'Umzug', minutes: 45, sort_order: 2 })])
    expect((await sende(`/api/shoot-day-banners/${b.daten.id}`, { minutes: 30 }, 'PUT')).status).toBe(200)
    t = await tagLesen()
    expect(t.estimated_minutes).toBe(150)
    expect(t.banner[0].text).toBe('Umzug')
    expect((await sende(`/api/shoot-day-banners/${b.daten.id}`, {}, 'DELETE')).status).toBe(200)
    t = await tagLesen()
    expect(t.banner).toEqual([])
    expect(t.estimated_minutes).toBe(120)
  })

  it('Tagesgrenze einfügen: der Rest des Tages kommt auf den nächsten freien Arbeitstag', async () => {
    // Fr 20.11. und Di 24.11. - der nächste Arbeitstag nach dem Freitag ist Montag, der 23.
    const { projekt, szene } = await plan('Board teilen', [
      { datum: '2026-11-20', szenen: ['1', '2', '3'] },
      { datum: '2026-11-24', szenen: ['4'] },
    ])
    const r = await sende(`/api/projects/${projekt}/drehplan/tagesgrenze`, { nachSzene: szene['1'] })
    expect(r.status).toBe(201)
    const tage = (await db.all('SELECT id, day_number, date FROM shoot_days WHERE project_id = ? ORDER BY day_number', [projekt])) as any[]
    expect(tage.map((t) => [t.day_number, t.date])).toEqual([[1, '2026-11-20'], [2, '2026-11-23'], [3, '2026-11-24']])
    expect((await reihe(tage[0].id)).werte).toEqual(['1'])
    expect(await reihe(tage[1].id)).toEqual({ werte: ['2', '3'], ordnung: [0, 1] })
    expect(Number(r.daten.id)).toBe(Number(tage[1].id))
  })

  it('Tagesgrenze einfügen: einen belegten Folgetag nur auf Nachfrage verschieben, Abgedrehtes und verschickte Dispo nie', async () => {
    const { projekt, szene, tag } = await plan('Board schieben', [
      { datum: '2026-11-16', szenen: ['1', '2'] },
      { datum: '2026-11-17', szenen: ['3'] },
      { datum: '2026-11-18', szenen: ['4'] },
    ])
    const pfad = `/api/projects/${projekt}/drehplan/tagesgrenze`
    const frage = await sende(pfad, { nachSzene: szene['1'] })
    expect(frage.status).toBe(409)
    expect(frage.fehler).toContain('Drehtag 2')
    expect(frage.daten).toEqual(expect.objectContaining({ belegt: true, verschiebbar: true }))
    expect(await anzahl('SELECT COUNT(*) AS n FROM shoot_days WHERE project_id = ?', [projekt])).toBe(3)

    // Ein abgedrehter Tag steht im Weg
    await db.run("UPDATE shoot_days SET status = 'Abgedreht' WHERE id = ?", [tag[2]])
    const abgedreht = await sende(pfad, { nachSzene: szene['1'], folgetageVerschieben: true })
    expect(abgedreht.status).toBe(409)
    expect(abgedreht.fehler).toContain('Drehtag 3')
    expect(abgedreht.daten).toEqual(expect.objectContaining({ verschiebbar: false }))

    // Eine verschickte Dispo genauso
    await db.run("UPDATE shoot_days SET status = 'Geplant' WHERE id = ?", [tag[2]])
    const dispo = (await db.run('INSERT INTO call_sheets (shoot_day_id) VALUES (?)', [tag[2]])).id
    await db.run("INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, sent_at) VALUES (?, 'crew', 1, NOW())", [dispo])
    const verschickt = await sende(pfad, { nachSzene: szene['1'], folgetageVerschieben: true })
    expect(verschickt.status).toBe(409)
    expect(verschickt.fehler).toContain('Drehtag 3')
    expect(await daten(projekt)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18'])

    await db.run('UPDATE call_sheet_entries SET sent_at = NULL WHERE call_sheet_id = ?', [dispo])
    const ok = await sende(pfad, { nachSzene: szene['1'], folgetageVerschieben: true })
    expect(ok.status).toBe(201)
    const tage = (await db.all('SELECT id, date FROM shoot_days WHERE project_id = ? ORDER BY day_number', [projekt])) as any[]
    expect(tage.map((t) => t.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'])
    expect((await reihe(tage[1].id)).werte).toEqual(['2'])
    expect(Number(tage[2].id)).toBe(Number(tag[1]))
    expect(Number(tage[3].id)).toBe(Number(tag[2]))
  })

  it('Tagesgrenze entfernen: der folgende Tag geht im Tag auf, bei Dispo erst nach Rückfrage', async () => {
    const { projekt, tag } = await plan('Board zusammen', [
      { datum: '2026-11-16', szenen: ['1'] },
      { datum: '2026-11-17', szenen: ['2', '3'] },
    ])
    await sende(`/api/shoot-days/${tag[1]}/banner`, { text: 'Umzug', minutes: 30 })
    await db.run('INSERT INTO call_sheets (shoot_day_id) VALUES (?)', [tag[1]])
    const pfad = `/api/projects/${projekt}/drehplan/tagesgrenze/${tag[0]}`

    const frage = await hole(pfad, tokenInhaber, { method: 'DELETE' })
    expect(frage.status).toBe(409)
    expect(frage.daten).toEqual(expect.objectContaining({ folgen: ['dispo'] }))
    expect((await reihe(tag[0])).werte).toEqual(['1'])

    const ok = await hole(`${pfad}?bestaetigt=1`, tokenInhaber, { method: 'DELETE' })
    expect(ok.status).toBe(200)
    expect(await reihe(tag[0])).toEqual({ werte: ['1', '2', '3', 'B:Umzug'], ordnung: [0, 1, 2, 3] })
    expect(await db.get('SELECT id FROM shoot_days WHERE id = ?', [tag[1]])).toBeFalsy()
    // Der aufgelöste Tag liegt im Papierkorb, ohne die Szenen, die jetzt im ersten Tag stehen
    const korb = (await db.get("SELECT dependents FROM deleted_items WHERE table_name = 'shoot_days' AND row_id = ?", [tag[1]])) as any
    expect(korb).toBeTruthy()
    expect(korb.dependents).not.toContain('shoot_day_scenes')

    // Nach dem letzten Tag gibt es nichts zum Zusammenlegen
    expect((await hole(pfad, tokenInhaber, { method: 'DELETE' })).status).toBe(400)
  })

  it('Automatisch einteilen: nurZeigen schreibt nichts, danach Tage an Arbeitstagen und eine Sicherung', async () => {
    // Start Do 19.11.; Fr 20.11. ist ein leerer Tag, Mo 23.11. ein Reservetag
    const { projekt, tag } = await plan('Board einteilen', [
      { datum: '2026-11-20', szenen: [] },
      { datum: '2026-11-23', szenen: [], status: 'Reserve' },
    ], ['1', '2', '3', '4', '5', '6'])
    const pfad = `/api/projects/${projekt}/drehplan/einteilen`
    const koerper = { nach: 'achtel', hoechstens: 16, start: '2026-11-19' }

    const vorschau = await sende(pfad, { ...koerper, nurZeigen: true })
    expect(vorschau.status).toBe(200)
    expect(vorschau.daten).toEqual(expect.objectContaining({ tage: 3, neu: 2, von: '2026-11-19', bis: '2026-11-24' }))
    expect(await anzahl('SELECT COUNT(*) AS n FROM shoot_days WHERE project_id = ?', [projekt])).toBe(2)
    expect(await anzahl('SELECT COUNT(*) AS n FROM shoot_day_scenes sds JOIN shoot_days d ON d.id = sds.shoot_day_id WHERE d.project_id = ?', [projekt])).toBe(0)
    expect(await anzahl('SELECT COUNT(*) AS n FROM drehplan_versions WHERE project_id = ?', [projekt])).toBe(0)

    expect((await sende(pfad, koerper)).status).toBe(200)
    const tage = (await db.all('SELECT id, date, status FROM shoot_days WHERE project_id = ? ORDER BY day_number', [projekt])) as any[]
    expect(tage.map((t) => t.date)).toEqual(['2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24'])
    expect(Number(tage[1].id)).toBe(Number(tag[0]))
    expect((await reihe(tage[0].id)).werte).toEqual(['1', '2'])
    expect((await reihe(tage[1].id)).werte).toEqual(['3', '4'])
    expect((await reihe(tage[2].id)).werte).toEqual([])
    expect((await reihe(tage[3].id)).werte).toEqual(['5', '6'])
    const versionen = (await db.all('SELECT name FROM drehplan_versions WHERE project_id = ?', [projekt])) as any[]
    expect(versionen.length).toBe(1)
    expect(versionen[0].name).toContain('Vor dem automatischen Einteilen')
  })

  it('Automatisch einteilen nimmt die Ablage in der übergebenen Reihenfolge und rechnet auch nach Minuten', async () => {
    const { projekt, szene } = await plan('Board Reihenfolge', [], ['1', '2', '3'])
    const r = await sende(`/api/projects/${projekt}/drehplan/einteilen`,
      { nach: 'minuten', hoechstens: 120, start: '2026-11-16', szenen: [szene['3'], szene['1']], nurZeigen: true })
    expect(r.status).toBe(200)
    expect(r.daten.verteilung.map((t: any) => t.szenen.map(Number))).toEqual([[Number(szene['3']), Number(szene['1'])]])
  })

  it('Automatisch einteilen: Feiertage kommen aus dem Bundesland des Projekts', async () => {
    // Fronleichnam, Do 04.06.2026, ist in Nordrhein-Westfalen frei, in Niedersachsen nicht
    const { projekt } = await plan('Board Feiertag', [], ['1', '2'])
    const pfad = `/api/projects/${projekt}/drehplan/einteilen`
    const koerper = { nach: 'achtel', hoechstens: 8, start: '2026-06-03', nurZeigen: true }
    await db.run("INSERT INTO project_settings (project_id, state) VALUES (?, 'NI')", [projekt])
    expect((await sende(pfad, koerper)).daten.bis).toBe('2026-06-04')
    await db.run("UPDATE project_settings SET state = 'NW' WHERE project_id = ?", [projekt])
    expect((await sende(pfad, koerper)).daten.bis).toBe('2026-06-05')
    // Nur Montag bis Mittwoch: aus dem Donnerstag wird der Montag danach
    await db.run("UPDATE project_settings SET state = 'NI', work_weekdays = '1,2,3' WHERE project_id = ?", [projekt])
    expect((await sende(pfad, koerper)).daten.bis).toBe('2026-06-08')
  })

  it('Zeitraum anlegen schlägt die Arbeitstage des Projekts vor, auf Wunsch mit Wochenenden', async () => {
    const { projekt } = await plan('Board Zeitraum', [])
    const tage = (von: string, bis: string, mehr = '') =>
      hole(`/api/projects/${projekt}/drehplan/arbeitstage?von=${von}&bis=${bis}${mehr}`, tokenInhaber)
    // Montag bis Freitag der Folgewoche: 10 Tage, nicht 12 (Nachtrag zu AP A2)
    const zwei = await tage('2026-11-16', '2026-11-27')
    expect(zwei.status).toBe(200)
    expect(zwei.daten.length).toBe(10)
    expect([zwei.daten[0], zwei.daten[9]]).toEqual(['2026-11-16', '2026-11-27'])
    expect((await tage('2026-11-16', '2026-11-27', '&wochenenden=1')).daten.length).toBe(12)
    // Feiertage fallen auch mit Wochenenden weg: 21. bis 31.12. ohne den 25. und 26.
    expect((await tage('2026-12-21', '2026-12-31', '&wochenenden=1')).daten.length).toBe(9)
    expect((await tage('2026-11-27', '2026-11-16')).status).toBe(400)
    expect((await tage('gestern', '2026-11-16')).status).toBe(400)
  })

  it('Automatisch einteilen lehnt Unsinn ab', async () => {
    const { projekt } = await plan('Board Unsinn', [], ['1'])
    const pfad = `/api/projects/${projekt}/drehplan/einteilen`
    expect((await sende(pfad, { nach: 'achtel', hoechstens: 0, start: '2026-06-03' })).status).toBe(400)
    expect((await sende(pfad, { nach: 'seiten', hoechstens: 8, start: '2026-06-03' })).status).toBe(400)
    expect((await sende(pfad, { nach: 'achtel', hoechstens: 8, start: 'morgen' })).status).toBe(400)
  })
})

describe('Drehbuch-Fassungen mit gesperrten Nummern (AP A3)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  const anzahl = async (sql: string, werte: any[]) => Number(((await db.get(sql, werte)) as any).n)

  type Szene = [string | null, string, string]
  /** Ein Drehbuch als Fountain-Text: Überschrift (mit Nummer, wenn angegeben) und eine Zeile Handlung. */
  const drehbuch = (szenen: Szene[]) =>
    szenen.map(([nr, kopf, text]) => `${kopf}${nr ? ` #${nr}#` : ''}\n\n${text}\n`).join('\n')
  const ERSTE: Szene[] = [
    ['1', 'INT. KÜCHE - TAG', 'Mara kocht.'],
    ['2', 'EXT. HOF - NACHT', 'Ole raucht.'],
    ['3', 'INT. FLUR - TAG', 'Jemand klingelt.'],
    ['4', 'EXT. STRASSE - TAG', 'Ein Bus fährt vorbei.'],
    ['5', 'INT. KELLER - NACHT', 'Licht geht aus.'],
  ]
  const mit = (aendern: (s: Szene[]) => Szene[]) => drehbuch(aendern(ERSTE.map((s) => [...s] as Szene)))

  async function projektMitDrehbuch(titel: string) {
    const projekt = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', [titel, nutzerId])).id
    const r = await sende(`/api/projects/${projekt}/fdx-import`, { xml: drehbuch(ERSTE), filename: 'erste.fountain' })
    expect(r.status).toBe(200)
    const szenen = (await db.all('SELECT id, scene_number FROM scenes WHERE project_id = ? ORDER BY sort_order', [projekt])) as any[]
    const id: Record<string, number> = Object.fromEntries(szenen.map((s) => [s.scene_number, Number(s.id)]))
    return { projekt, id }
  }
  const einlesen = (projekt: number, xml: string, mehr: Record<string, any> = {}) =>
    sende(`/api/projects/${projekt}/fdx-import`, { xml, filename: 'zweite.fountain', modus: 'fassung', ...mehr })
  const reihenfolge = async (projekt: number) =>
    ((await db.all('SELECT scene_number FROM scenes WHERE project_id = ? ORDER BY sort_order', [projekt])) as any[]).map((s) => s.scene_number)

  it('ohne Modus bleibt die Rückfrage, "Anhängen" hängt an wie bisher', async () => {
    const { projekt } = await projektMitDrehbuch('Fassung Rückfrage')
    const frage = await sende(`/api/projects/${projekt}/fdx-import`, { xml: drehbuch(ERSTE), filename: 'x.fountain' })
    expect(frage.status).toBe(409)
    const dran = await sende(`/api/projects/${projekt}/fdx-import`, { xml: drehbuch([[null, 'INT. DACH - TAG', 'Oben.']]), filename: 'x.fountain', modus: 'anhaengen' })
    expect(dran.status).toBe(200)
    expect((await reihenfolge(projekt)).length).toBe(6)
  })

  it('eine geänderte Szene behält ihre Zeile und ihren Drehtag, die Blöcke sind neu und tragen die Fassung', async () => {
    const { projekt, id } = await projektMitDrehbuch('Fassung geändert')
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-11-16')", [projekt])).id
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag, id['2']])
    const xml = mit((s) => { s[1][2] = 'Ole raucht nicht mehr.'; return s })

    const vorschau = await einlesen(projekt, xml, { nurZeigen: true })
    expect(vorschau.status).toBe(200)
    expect(vorschau.daten.zahlen).toEqual({ unveraendert: 4, geaendert: 1, neu: 0, fehlt: 0 })
    expect(vorschau.daten.geaendert.map((g: any) => g.nummer)).toEqual(['2'])
    expect(await anzahl('SELECT COUNT(*) AS n FROM script_revisions WHERE project_id = ?', [projekt])).toBe(0)
    expect(await anzahl("SELECT COUNT(*) AS n FROM screenplay_blocks WHERE scene_id = ? AND content = 'Ole raucht nicht mehr.'", [id['2']])).toBe(0)

    const r = await einlesen(projekt, xml)
    expect(r.status).toBe(200)
    expect(r.daten.fassung).toEqual(expect.objectContaining({ number: 1, color: 'blau' }))
    expect(Number(((await db.get("SELECT id FROM scenes WHERE project_id = ? AND scene_number = '2'", [projekt])) as any).id)).toBe(id['2'])
    expect(await anzahl('SELECT COUNT(*) AS n FROM shoot_day_scenes WHERE scene_id = ?', [id['2']])).toBe(1)
    const bloecke = (await db.all('SELECT block_type, content, revision_id FROM screenplay_blocks WHERE scene_id = ? ORDER BY sort_order', [id['2']])) as any[]
    expect(bloecke.map((b) => b.content)).toEqual(['EXT. HOF - NACHT', 'Ole raucht nicht mehr.'])
    // Nur der geänderte Block trägt die neue Fassung, die Überschrift blieb gleich
    expect(bloecke.map((b) => b.revision_id === null ? null : Number(b.revision_id))).toEqual([null, Number(r.daten.fassung.id)])
    const fassungen = (await db.all('SELECT number, color FROM script_revisions WHERE project_id = ? ORDER BY number', [projekt])) as any[]
    expect(fassungen.map((f) => [f.number, f.color])).toEqual([[0, 'weiss'], [1, 'blau']])
  })

  it('eine neue Szene ohne Nummer steht hinter ihrer Vorgängerin und bekommt deren Nummer mit Buchstaben', async () => {
    const { projekt } = await projektMitDrehbuch('Fassung neu')
    const xml = drehbuch([
      ...ERSTE.slice(0, 3).map(([, k, t]) => [null, k, t] as Szene),
      [null, 'EXT. GARTEN - TAG', 'Ein neuer Ort.'],
      ...ERSTE.slice(3).map(([, k, t]) => [null, k, t] as Szene),
    ])
    const r = await einlesen(projekt, xml)
    expect(r.status).toBe(200)
    expect(r.daten.zahlen).toEqual({ unveraendert: 5, geaendert: 0, neu: 1, fehlt: 0 })
    expect(await reihenfolge(projekt)).toEqual(['1', '2', '3', '3A', '4', '5'])
    const neu = (await db.get("SELECT title, int_ext, day_night FROM scenes WHERE project_id = ? AND scene_number = '3A'", [projekt])) as any
    expect([neu.title, neu.int_ext, neu.day_night]).toEqual(['GARTEN', 'EXT', 'TAG'])
  })

  it('eine fehlende Szene bleibt im offenen Drehbuch stehen und wird genannt', async () => {
    const { projekt, id } = await projektMitDrehbuch('Fassung fehlt offen')
    const r = await einlesen(projekt, mit((s) => s.filter(([nr]) => nr !== '4')))
    expect(r.status).toBe(200)
    expect(r.daten.fehlt.map((f: any) => f.nummer)).toEqual(['4'])
    const vier = (await db.get('SELECT omitted FROM scenes WHERE id = ?', [id['4']])) as any
    expect(vier.omitted).toBe(false)
  })

  it('im gesperrten Drehbuch entfällt eine fehlende Szene: Nummer bleibt, aus Plan und Prüfungen heraus', async () => {
    const { projekt, id } = await projektMitDrehbuch('Fassung fehlt gesperrt')
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-11-16')", [projekt])).id
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id, sort_order) VALUES (?, ?, 0)', [tag, id['4']])
    expect((await sende(`/api/projects/${projekt}/drehbuch/sperren`)).status).toBe(200)

    const r = await einlesen(projekt, mit((s) => s.filter(([nr]) => nr !== '4')))
    expect(r.status).toBe(200)
    expect(r.daten.entfallen.map((f: any) => f.nummer)).toEqual(['4'])
    const vier = (await db.get('SELECT scene_number, omitted FROM scenes WHERE id = ?', [id['4']])) as any
    expect([vier.scene_number, vier.omitted]).toEqual(['4', true])
    expect(await anzahl('SELECT COUNT(*) AS n FROM shoot_day_scenes WHERE scene_id = ?', [id['4']])).toBe(0)

    // Nicht mehr in der Prüfung "Nicht eingeplante Szenen", nicht in der Ablage, nicht planbar
    const konflikte = (await hole(`/api/projects/${projekt}/conflicts`, tokenInhaber)).daten as any[]
    const ungeplant = konflikte.find((k) => /noch nicht im Drehplan/.test(k.message))
    expect(ungeplant).toBeTruthy()
    expect(ungeplant?.detail ?? '').not.toMatch(/\b4\b/)
    const vorschau = await sende(`/api/projects/${projekt}/drehplan/einteilen`, { nach: 'achtel', hoechstens: 80, start: '2026-11-23', nurZeigen: true })
    expect(vorschau.daten.verteilung.flatMap((t: any) => t.szenen).map(Number)).not.toContain(id['4'])
    expect((await sende(`/api/projects/${projekt}/drehplan/verschieben`, { szenen: [id['4']], zielTag: tag, vor: null })).status).toBe(400)
  })

  it('dieselbe Datei zweimal: beim zweiten Mal nichts zu übernehmen, keine neue Fassung', async () => {
    const { projekt } = await projektMitDrehbuch('Fassung doppelt')
    const xml = mit((s) => { s[4][2] = 'Licht flackert.'; return s })
    expect((await einlesen(projekt, xml)).status).toBe(200)
    const zweites = await einlesen(projekt, xml)
    expect(zweites.status).toBe(200)
    expect(zweites.daten.nichts).toBe(true)
    expect(zweites.daten.zahlen).toEqual({ unveraendert: 5, geaendert: 0, neu: 0, fehlt: 0 })
    expect(await anzahl('SELECT COUNT(*) AS n FROM script_revisions WHERE project_id = ?', [projekt])).toBe(2)
  })

  it('gesperrt: Nummer ändern abgelehnt, Löschen heißt entfällt, neue Szene bekommt einen Buchstaben, Zurückholen geht', async () => {
    const { projekt, id } = await projektMitDrehbuch('Fassung Sperre')
    expect((await sende(`/api/projects/${projekt}/drehbuch/sperren`)).status).toBe(200)
    // Ohne updated_at: Der zweite PUT unten käme sonst als veralteter Stand (409)
    const { updated_at: _stand, ...zwei } = (await db.get('SELECT * FROM scenes WHERE id = ?', [id['2']])) as any

    const umbenannt = await sende(`/api/scenes/${id['2']}`, { ...zwei, scene_number: '99' }, 'PUT')
    expect(umbenannt.status).toBe(400)
    expect(umbenannt.fehler).toMatch(/gesperrt/)
    expect((await sende(`/api/scenes/${id['2']}`, { ...zwei, title: 'HOF HINTEN' }, 'PUT')).status).toBe(200)

    expect((await sende(`/api/scenes/${id['3']}`, {}, 'DELETE')).status).toBe(200)
    const drei = (await db.get('SELECT omitted FROM scenes WHERE id = ?', [id['3']])) as any
    expect(drei.omitted).toBe(true)

    const neu = await sende(`/api/projects/${projekt}/scenes`, { title: 'DACH' })
    expect(neu.status).toBe(201)
    expect(neu.daten.scene_number).toBe('5A')

    expect((await sende(`/api/scenes/${id['3']}`, { omitted: false }, 'PUT')).status).toBe(200)
    const zurueck = (await db.get('SELECT omitted, title FROM scenes WHERE id = ?', [id['3']])) as any
    expect([zurueck.omitted, zurueck.title]).toEqual([false, 'FLUR'])

    expect((await sende(`/api/projects/${projekt}/drehbuch/entsperren`)).status).toBe(200)
    expect((await sende(`/api/scenes/${id['2']}`, { ...zwei, scene_number: '99' }, 'PUT')).status).toBe(200)
  })

  it('der Fountain-Export schreibt eine entfallene Szene als OMITTED mit Nummer, ohne Inhalt', async () => {
    const { projekt, id } = await projektMitDrehbuch('Fassung Export')
    await sende(`/api/projects/${projekt}/drehbuch/sperren`)
    await sende(`/api/scenes/${id['3']}`, {}, 'DELETE')
    const antwort = await fetch(`${basis}/api/projects/${projekt}/screenplay/export.fountain`, { headers: { Authorization: `Bearer ${tokenInhaber}` } })
    const text = await antwort.text()
    expect(text).toContain('.OMITTED #3#')
    expect(text).not.toContain('Jemand klingelt.')
    expect(text).toContain('INT. KÜCHE - TAG #1#')
  })

  it('Liste der Fassungen mit Zahlen und Vergleich einer Szene alt gegen neu', async () => {
    const { projekt, id } = await projektMitDrehbuch('Fassung Vergleich')
    const r = await einlesen(projekt, mit((s) => { s[1][2] = 'Ole raucht nicht mehr.'; return s }))
    const liste = await hole(`/api/projects/${projekt}/drehbuch/fassungen`, tokenInhaber)
    expect(liste.status).toBe(200)
    expect(liste.daten.map((f: any) => [f.number, f.color, f.geaendert, f.neu, f.entfaellt])).toEqual([[0, 'weiss', 0, 0, 0], [1, 'blau', 1, 0, 0]])
    expect(liste.daten[1].name).toBe('Blaue Fassung')
    expect(liste.daten[1].aenderungen.map((a: any) => [a.scene_number, a.change])).toEqual([['2', 'geaendert']])

    const v = await hole(`/api/projects/${projekt}/drehbuch/fassungen/${r.daten.fassung.id}/szenen/${id['2']}`, tokenInhaber)
    expect(v.status).toBe(200)
    expect(v.daten.zeilen.filter((z: any) => z.art !== 'gleich').map((z: any) => `${z.art}:${z.zeile}`))
      .toEqual(['weg:Ole raucht.', 'neu:Ole raucht nicht mehr.'])
  })
})

describe('Arbeitszeit-Prüfung und Überstunden in Euro (AP B3)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })

  /** Projekt mit Regel, einem Stabmitglied (400 € Tagesgage) und zwei Drehtagen Mo/Di. */
  async function projekt(regel: 'gesetz' | 'tarif', saetze: Record<string, number> = {}) {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', [`Arbeitszeit ${regel}`, nutzerId])).id
    await db.run("INSERT INTO project_settings (project_id, default_call_time, default_wrap_time, state, worktime_rule, surcharges) VALUES (?, 420, 1140, 'NW', ?, ?)",
      [p, regel, JSON.stringify(saetze)])
    const kamera = (await db.run("INSERT INTO crew (project_id, name, role, fee_per_day) VALUES (?, 'Ida Kamera', 'Kamera', 40000)", [p])).id
    const tag1 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-11-16')", [p])).id
    const tag2 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 2, '2026-11-17')", [p])).id
    return { p, kamera, tag1, tag2 }
  }

  it('der Konfliktradar meldet eine Dispo mit 13 Stunden nach eingestellter Regel, mit Fundstelle', async () => {
    const { p, kamera, tag1 } = await projekt('gesetz')
    const dispo = (await db.run('INSERT INTO call_sheets (shoot_day_id, general_call, planned_wrap) VALUES (?, 420, 1200)', [tag1])).id
    await db.run("INSERT INTO call_sheet_entries (call_sheet_id, person_type, person_id, call_time) VALUES (?, 'crew', ?, 420)", [dispo, kamera])
    const konflikte = (await hole(`/api/projects/${p}/conflicts`, tokenInhaber)).daten as any[]
    const az = konflikte.find((k) => k.category === 'Arbeitszeit')
    expect(az).toBeTruthy()
    expect(`${az.message} ${az.detail}`).toMatch(/§ 3 ArbZG/)
    expect(`${az.message} ${az.detail}`).toMatch(/Ida Kamera/)
    // Die Dispo selbst nennt den Befund im Kopf
    const blatt = (await hole(`/api/shoot-days/${tag1}/call-sheet`, tokenInhaber)).daten
    expect(blatt.planned_wrap).toBe(1200)
    expect(blatt.arbeitszeit.befunde.map((b: any) => b.quelle)).toContain('§ 3 ArbZG')
  })

  it('geplanter Drehschluss lässt sich an der Dispo setzen und bleibt bei einer Änderung ohne ihn stehen', async () => {
    const { tag1 } = await projekt('gesetz')
    expect((await sende(`/api/shoot-days/${tag1}/call-sheet`, { general_call: 420, planned_wrap: 1110 })).daten.planned_wrap).toBe(1110)
    expect((await sende(`/api/shoot-days/${tag1}/call-sheet`, { general_call: 450 })).daten.planned_wrap).toBe(1110)
  })

  it('Stundenzettel: Pause wird abgezogen, Befunde je Zeile, Zuschlag in Euro für die Produktion', async () => {
    const { kamera, tag1 } = await projekt('tarif', { elfte: 25, ab_zwoelfte: 50 })
    const r = await sende(`/api/shoot-days/${tag1}/timesheets`, { person_type: 'crew', person_id: kamera, call_time: 420, wrap_time: 1140, break_minutes: 45 })
    expect(r.status).toBe(201)
    expect(r.daten.break_minutes).toBe(45)
    // 07:00 bis 19:00 mit 45 Minuten Pause: 11,25 Stunden, 1,25 über zehn
    expect(Number(r.daten.overtime_hours)).toBeCloseTo(1.25, 5)
    expect(r.daten.befunde.map((b: any) => `${b.art}:${b.quelle}`)).toContain('zuschlag:TV FFS')
    expect(r.daten.surcharge_cents).toBe(6500)
    const liste = (await hole(`/api/shoot-days/${tag1}/timesheets`, tokenInhaber)).daten
    expect(liste[0].surcharge_cents).toBe(6500)
  })

  it('Ruhezeit unter elf Stunden zwischen zwei Stundenzetteln wird gemeldet', async () => {
    const { kamera, tag1, tag2 } = await projekt('gesetz')
    await sende(`/api/shoot-days/${tag1}/timesheets`, { person_type: 'crew', person_id: kamera, call_time: 420, wrap_time: 1140, break_minutes: 45 })
    const r = await sende(`/api/shoot-days/${tag2}/timesheets`, { person_type: 'crew', person_id: kamera, call_time: 300, wrap_time: 900, break_minutes: 30 })
    expect(r.daten.befunde.map((b: any) => b.quelle)).toContain('§ 5 ArbZG')
  })

  it('der Lohnexport enthält die Zuschlagsstunden je Art und den Betrag', async () => {
    const { p, kamera, tag1 } = await projekt('tarif', { elfte: 25, ab_zwoelfte: 50 })
    const z = await sende(`/api/shoot-days/${tag1}/timesheets`, { person_type: 'crew', person_id: kamera, call_time: 420, wrap_time: 1140, break_minutes: 45 })
    // Seit AP E8 nimmt der Lohnexport nur freigegebene Zettel
    expect((await sende(`/api/timesheets/${z.daten.id}/stand`, { status: 'freigegeben' })).status).toBe(200)
    const antwort = await fetch(`${basis}/api/projects/${p}/payroll/export.csv?type=crew`, { headers: { Authorization: `Bearer ${tokenInhaber}` } })
    const text = await antwort.text()
    const [kopf, zeile] = text.replace(/^\ufeff/, '').split(/\r?\n/)
    const spalten = kopf.split(';')
    const werte = zeile.split(';')
    const wert = (name: string) => werte[spalten.indexOf(name)]
    expect(spalten).toContain('Zuschlag Überstunden und Zeiten')
    expect(wert('Std. erste Überstunde')).toBe('1,00')
    expect(wert('Std. ab zweiter Überstunde')).toBe('0,25')
    expect(wert('Zuschlag Überstunden und Zeiten')).toBe('65,00')
  })

  it('Gesetz: keine Sätze eingetragen heißt Zuschläge 0, die Überstunde zahlt den Stundensatz', async () => {
    const { kamera, tag1 } = await projekt('gesetz')
    const r = await sende(`/api/shoot-days/${tag1}/timesheets`, { person_type: 'crew', person_id: kamera, call_time: 420, wrap_time: 1140, break_minutes: 45 })
    expect(r.daten.befunde.map((b: any) => `${b.art}:${b.quelle}`)).toContain('verstoss:§ 3 ArbZG')
    // 75 Minuten zu je 40 €/Stunde ohne Zuschlag
    expect(r.daten.surcharge_cents).toBe(5000)
  })

  /** Drehtage ab Montag, 02.11.2026, je einer pro Kalendertag, mit Stundenzettel. */
  async function drehtageMitZettel(p: number, kamera: number, anzahl: number, wrap: number) {
    const tage: number[] = []
    for (let i = 0; i < anzahl; i++) {
      const datum = new Date(Date.UTC(2026, 10, 2 + i)).toISOString().slice(0, 10)
      const tag = (await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, ?, ?)', [p, 10 + i, datum])).id
      await db.run("INSERT INTO timesheets (project_id, shoot_day_id, person_type, person_id, call_time, wrap_time, break_minutes) VALUES (?, ?, 'crew', ?, 420, ?, 45)",
        [p, tag, kamera, wrap])
      tage.push(tag)
    }
    return tage
  }

  it('Tarifvertrag: eine Woche über 50 Stunden steht am letzten Zettel der Woche', async () => {
    const { p, kamera } = await projekt('tarif')
    // Montag bis Freitag je 11 Stunden: 07:00 bis 18:45 mit 45 Minuten Pause
    const tage = await drehtageMitZettel(p, kamera, 5, 1125)
    const quellenAm = async (tag: number) => ((await hole(`/api/shoot-days/${tag}/timesheets`, tokenInhaber)).daten[0].befunde as any[])
      .filter((b) => /^Woche/.test(b.text))
    expect(await quellenAm(tage[0])).toEqual([])
    const freitag = await quellenAm(tage[4])
    expect(freitag.map((b) => `${b.art}:${b.quelle}`)).toEqual(['zuschlag:TV FFS'])
    expect(freitag[0].text).toMatch(/55 Stunden/)
  })

  it('Tarifvertrag: am 20. Drehtag einer Person der Hinweis auf den freien Tag', async () => {
    const { p, kamera } = await projekt('tarif')
    const tage = await drehtageMitZettel(p, kamera, 20, 1005)
    const freiAm = async (tag: number) => ((await hole(`/api/shoot-days/${tag}/timesheets`, tokenInhaber)).daten[0].befunde as any[])
      .filter((b) => /freier Tag/.test(b.text))
    expect(await freiAm(tage[18])).toEqual([])
    const zwanzig = await freiAm(tage[19])
    expect(zwanzig.map((b) => `${b.art}:${b.quelle}`)).toEqual(['hinweis:TV FFS'])
    expect(zwanzig[0].text).toMatch(/^20\. Drehtag/)
  })
})

describe('Kalkulation nach FFA-Schema (AP B1)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  const projekt = async () => (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Kalkulation FFA', nutzerId])).id

  it('eine neue Fassung eines Films beginnt im FFA-Schema; die Sätze sind änderbar und geprüft', async () => {
    const p = await projekt()
    const f = await sende(`/api/projects/${p}/budget-versions`, { name: 'Fassung 1' })
    expect(f.status).toBe(201)
    expect(f.daten.schema).toBe('ffa')
    expect(f.daten.reserve_percent_bp).toBe(800)
    expect((await sende(`/api/projects/${p}/budget-versions`, { name: 'Frei', schema: 'frei' })).daten.schema).toBe('frei')
    const geaendert = await sende(`/api/budget-versions/${f.daten.id}`, { reserve_percent_bp: 1000, social_percent_bp: 2100 }, 'PUT')
    expect(geaendert.status).toBe(200)
    expect(geaendert.daten).toMatchObject({ reserve_percent_bp: 1000, social_percent_bp: 2100 })
    expect((await sende(`/api/budget-versions/${f.daten.id}`, { producer_fee_percent_bp: 10_000 }, 'PUT')).status).toBe(400)
  })

  it('Summe der Fassung sind die Herstellungskosten; die Auswertung nennt Rechenwerk und Hinweise', async () => {
    const p = await projekt()
    const f = (await sende(`/api/projects/${p}/budget-versions`, { name: 'F' })).daten
    await sende(`/api/budget-versions/${f.id}/lines`, { description: 'Kamera', cost_group: 5, quantity: 1, unit_price_cents: 300_000_000 })
    const z = await sende(`/api/budget-versions/${f.id}/lines`, { description: 'Regie', cost_group: 3, social: true, quantity: 1, unit_price_cents: 100 })
    expect(z.daten).toMatchObject({ cost_group: 3, social: true })
    expect((await sende(`/api/budget-versions/${f.id}/lines`, { description: 'x', cost_group: 12, quantity: 1, unit_price_cents: 1 })).status).toBe(400)
    const a = (await hole(`/api/budget-versions/${f.id}/auswertung`, tokenInhaber)).daten
    expect(a.rechenwerk.fertigungskosten).toBe(300_000_100)
    expect(a.hinweise).toContain('Zusatzkosten Gagen fehlen')
    const version = await db.get('SELECT total_cents FROM budget_versions WHERE id = ?', [f.id])
    expect(Number(version.total_cents)).toBe(a.rechenwerk.herstellungskosten)
  })

  it('Umstellen von "frei" auf "FFA" behält alle Zeilen und ordnet Kategorien zu', async () => {
    const p = await projekt()
    const f = (await sende(`/api/projects/${p}/budget-versions`, { name: 'Alt', schema: 'frei' })).daten
    for (const [kategorie, cent] of [['2000 - Kamera', 50_000], ['1000 - Stab', 70_000], ['Sonstiges', 5_000]] as const) {
      await sende(`/api/budget-versions/${f.id}/lines`, { category: kategorie, description: kategorie, quantity: 1, unit_price_cents: cent })
    }
    const um = await sende(`/api/budget-versions/${f.id}/schema`, { schema: 'ffa', zuordnung: { '2000 - Kamera': 5, '1000 - Stab': 3 } })
    expect(um.status).toBe(200)
    expect(um.daten.schema).toBe('ffa')
    const zeilen = (await hole(`/api/budget-versions/${f.id}/lines`, tokenInhaber)).daten as any[]
    expect(zeilen).toHaveLength(3)
    expect(zeilen.map((z) => [z.category, z.cost_group])).toEqual([['2000 - Kamera', 5], ['1000 - Stab', 3], ['Sonstiges', null]])
    expect((await hole(`/api/budget-versions/${f.id}/auswertung`, tokenInhaber)).daten.hinweise).toContain('1 Zeile ohne Kostenart')
  })

  it('Kosten übernehmen ordnet in Kostenarten: Wochengage mit Vorbereitung, Verleih je Woche, Motivmiete', async () => {
    const p = await projekt()
    await db.run("INSERT INTO project_settings (project_id, work_weekdays) VALUES (?, '1,2,3,4,5')", [p])
    const ole = (await db.run("INSERT INTO crew (project_id, name, role, contract_type, fee_per_week, prep_days) VALUES (?, 'Ole', 'Szenenbild', 'Wochengage', 250000, 5)", [p])).id
    const motiv = (await db.run("INSERT INTO locations (project_id, name, rental_fee) VALUES (?, 'Mole', 50000)", [p])).id
    // Zwei Drehtage am Motiv, je mit einer eigenen Szene (eine Szene steht an genau einem Tag)
    for (let i = 0; i < 20; i++) {
      const tag = (await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, ?, ?)', [p, i + 1, `2026-12-${String(i + 1).padStart(2, '0')}`])).id
      if (i < 2) {
        const szene = (await db.run('INSERT INTO scenes (project_id, scene_number, location_id) VALUES (?, ?, ?)', [p, String(i + 1), motiv])).id
        await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id) VALUES (?, ?)', [tag, szene])
      }
    }
    const liste = (await db.run("INSERT INTO equipment_lists (project_id, name) VALUES (?, 'Kamera')", [p])).id
    await db.run("INSERT INTO equipment_items (equipment_list_id, item, quantity, rental_per_day_cents, total_days, total_cents, rate_unit) VALUES (?, 'Kamerapaket', 1, 420000, 3, 1260000, 'woche')", [liste])
    const f = (await sende(`/api/projects/${p}/budget-versions`, { name: 'F' })).daten
    expect((await sende(`/api/budget-versions/${f.id}/kosten-uebernehmen`, {})).status).toBe(200)
    const zeilen = (await hole(`/api/budget-versions/${f.id}/lines`, tokenInhaber)).daten as any[]
    const zu = (schluessel: string) => zeilen.find((z) => z.source_key === schluessel)
    // 20 Drehtage plus 5 Vorbereitung: 5 Wochen zu 2.500 €
    expect(zu(`crew:${ole}`)).toMatchObject({ cost_group: 3, unit: 'Woche', total_cents: 1_250_000 })
    expect(zu(`crew:${ole}`).description).toBe('Ole (Szenenbild), Vorbereitung 5 Tage')
    expect(zu(`motiv:${motiv}`)).toMatchObject({ cost_group: 4, unit: 'Tag', total_cents: 100_000 })
    const kamera = zeilen.find((z) => String(z.source_key).startsWith('equipment:'))
    expect(kamera).toMatchObject({ cost_group: 5, description: 'Kamerapaket, 3 Wochen zu 4.200,00 €', total_cents: 1_260_000 })
    // Ein zweiter Lauf ändert nichts
    const zweimal = await sende(`/api/budget-versions/${f.id}/kosten-uebernehmen`, {})
    expect(zweimal.daten).toMatchObject({ neu: 0, geaendert: 0, entfallen: 0 })
  })

  it('die CSV hat den Aufbau des Schemas und dieselbe Summe wie die Fassung', async () => {
    const p = await projekt()
    const f = (await sende(`/api/projects/${p}/budget-versions`, { name: 'F' })).daten
    await sende(`/api/budget-versions/${f.id}/lines`, { description: 'Kamera', cost_group: 5, quantity: 2, unit_price_cents: 150_000_000 })
    await sende(`/api/budget-versions/${f.id}/lines`, { description: 'Verkauf Requisiten', cost_group: 11, quantity: 1, unit_price_cents: 1_000_000 })
    const antwort = await fetch(`${basis}/api/budget-versions/${f.id}/export.csv`, { headers: { Authorization: `Bearer ${tokenInhaber}` } })
    expect(antwort.status).toBe(200)
    const zeilen = (await antwort.text()).replace(/^\ufeff/, '').split(/\r?\n/).map((z) => z.split(';'))
    expect(zeilen[0]).toEqual(['Kostenart', 'Konto', 'Bezeichnung', 'Einheit', 'Menge', 'Einzelpreis', 'Gesamt', 'Hinweis'])
    // Die elf Kostenarten in ihrer Reihenfolge, je mit Summe; Erträge abgezogen
    const summen = zeilen.filter((z) => z[2]?.startsWith('Summe '))
    expect(summen.map((z) => z[0])).toEqual(['1 Vorkosten', '2 Rechte und Manuskript', '3 Gagen', '4 Atelier', '5 Ausstattung und Technik',
      '6 Reise- und Transportkosten', '7 Filmmaterial und Bearbeitung', '8 Endfertigung', '9 Versicherungen', '10 Allgemeine Kosten', '11 Kostenmindernde Erträge'])
    expect(summen.find((z) => z[0] === '11 Kostenmindernde Erträge')![6]).toBe('-10000,00')
    const rechenwerk = zeilen.filter((z) => z[0] === 'Rechenwerk').map((z) => [z[2], z[6]])
    expect(rechenwerk[0]).toEqual(['Fertigungskosten', '2990000,00'])
    const fassung = await db.get('SELECT total_cents FROM budget_versions WHERE id = ?', [f.id])
    expect(rechenwerk[4]).toEqual(['Herstellungskosten', (Number(fassung.total_cents) / 100).toFixed(2).replace('.', ',')])
  })

  it('Endstand (AP E1): 100.000 € kalkuliert, 60.000 € Ist; Rest setzen, abschließen; wer und wann', async () => {
    const p = await projekt()
    const f = (await sende(`/api/projects/${p}/budget-versions`, { name: 'F' })).daten
    const z = (await sende(`/api/budget-versions/${f.id}/lines`, { description: 'Kamera', cost_group: 5, quantity: 1, unit_price_cents: 10_000_000 })).daten
    await sende(`/api/projects/${p}/expenses`, { description: 'Verleih', amount_cents: 6_000_000, budget_line_id: z.id })
    const zeileVon = async () => ((await hole(`/api/projects/${p}/kostenstand`, tokenInhaber)).daten.rows as any[]).find((r) => r.cost_group === 5).zeilen[0]
    expect(await zeileVon()).toMatchObject({ rest_cents: 4_000_000, endstand_cents: 10_000_000, abweichung_cents: 0, ueber: false })
    expect((await sende(`/api/budget-lines/${z.id}/prognose`, { rest_cents: 5_500_000 }, 'PUT')).status).toBe(200)
    expect(await zeileVon()).toMatchObject({ rest_cents: 5_500_000, endstand_cents: 11_500_000, abweichung_cents: 1_500_000, abweichung_prozent: 15, ueber: true, rest_gesetzt: true, gesetzt_von: 'Inhaberin' })
    expect((await zeileVon()).gesetzt_am).toBeTruthy()
    await sende(`/api/budget-lines/${z.id}/prognose`, { abgeschlossen: true }, 'PUT')
    expect(await zeileVon()).toMatchObject({ rest_cents: 0, endstand_cents: 6_000_000, abgeschlossen: true })
    // Zurück auf die Vorgabe
    await sende(`/api/budget-lines/${z.id}/prognose`, { rest_cents: null, abgeschlossen: false }, 'PUT')
    expect(await zeileVon()).toMatchObject({ rest_cents: 4_000_000, rest_gesetzt: false, gesetzt_von: null })
    expect((await sende(`/api/budget-lines/${z.id}/prognose`, { rest_cents: -1 }, 'PUT')).status).toBe(400)
  })

  it('Fassung kopieren, eine Zeile ändern, eine löschen: der Vergleich zeigt genau diese zwei', async () => {
    const p = await projekt()
    const f = (await sende(`/api/projects/${p}/budget-versions`, { name: 'Vorkalkulation' })).daten
    for (const [d, art, cent] of [['Kamera', 5, 3_000_000], ['Regie', 3, 8_000_000], ['Büro', 10, 400_000]] as const) {
      await sende(`/api/budget-versions/${f.id}/lines`, { description: d, cost_group: art, quantity: 1, unit_price_cents: cent })
    }
    const kopie = await sende(`/api/budget-versions/${f.id}/kopie`, { name: 'Abschlusskalkulation' })
    expect(kopie.status).toBe(201)
    expect(kopie.daten).toMatchObject({ name: 'Abschlusskalkulation', schema: 'ffa', status: 'Entwurf' })
    const zeilen = (await hole(`/api/budget-versions/${kopie.daten.id}/lines`, tokenInhaber)).daten as any[]
    expect(zeilen).toHaveLength(3)
    const kamera = zeilen.find((z) => z.description === 'Kamera')
    await sende(`/api/budget-lines/${kamera.id}`, { ...kamera, unit_price_cents: 3_500_000 }, 'PUT')
    await hole(`/api/budget-lines/${zeilen.find((z) => z.description === 'Büro').id}`, tokenInhaber, { method: 'DELETE' })
    const v = (await hole(`/api/projects/${p}/budget-versions/vergleich?a=${f.id}&b=${kopie.daten.id}`, tokenInhaber)).daten
    expect(v.unterschiede).toBe(2)
    const alle = v.gruppen.flatMap((g: any) => g.zeilen)
    expect(alle.filter((z: any) => z.art !== 'beide' || z.diff_cents !== 0).map((z: any) => [z.description, z.art, z.diff_cents]))
      .toEqual([['Kamera', 'beide', 500_000], ['Büro', 'nur_a', -400_000]])
    // CSV im selben Aufbau, und eine fremde Fassung ergibt 404
    const csv = await (await fetch(`${basis}/api/projects/${p}/budget-versions/vergleich?a=${f.id}&b=${kopie.daten.id}&format=csv`, { headers: { Authorization: `Bearer ${tokenInhaber}` } })).text()
    expect(csv.replace(/^\ufeff/, '').split(/\r?\n/)[0]).toBe('Kostenart;Zeile;Vorkalkulation;Abschlusskalkulation;Differenz;Stand')
    expect(csv).toContain('10 Allgemeine Kosten;Büro;4000,00;;-4000,00;nur in A')
    const anderes = await projekt()
    const fremd = (await sende(`/api/projects/${anderes}/budget-versions`, { name: 'Fremd' })).daten
    expect((await hole(`/api/projects/${p}/budget-versions/vergleich?a=${f.id}&b=${fremd.id}`, tokenInhaber)).status).toBe(404)
  })

  it('Kostenstand je Kostenart, Belege ohne Kostenart in ihrer eigenen Zeile', async () => {
    const p = await projekt()
    const f = (await sende(`/api/projects/${p}/budget-versions`, { name: 'F' })).daten
    const technik = await sende(`/api/budget-versions/${f.id}/lines`, { description: 'Kamera', cost_group: 5, quantity: 1, unit_price_cents: 3_000_000 })
    await sende(`/api/budget-versions/${f.id}/lines`, { description: 'Gagen', cost_group: 3, quantity: 1, unit_price_cents: 10_000_000 })
    // Zwei Belege über zusammen 22.190 € in Kostenart 5 - einer über die Zeile, einer direkt
    await sende(`/api/projects/${p}/expenses`, { description: 'Verleih Rechnung 1', amount_cents: 1_500_000, budget_line_id: technik.daten.id })
    await sende(`/api/projects/${p}/expenses`, { description: 'Verleih Rechnung 2', amount_cents: 719_000, cost_group: 5 })
    await sende(`/api/projects/${p}/expenses`, { description: 'Taxi', amount_cents: 4_200 })
    expect((await sende(`/api/projects/${p}/expenses`, { description: 'x', amount_cents: 1, cost_group: 0 })).status).toBe(400)
    const k = (await hole(`/api/projects/${p}/kostenstand`, tokenInhaber)).daten
    expect(k.budget_version.schema).toBe('ffa')
    const art5 = k.rows.find((r: any) => r.cost_group === 5)
    expect(art5).toMatchObject({ soll_cents: 3_000_000, ist_cents: 2_219_000, diff_cents: 781_000 })
    // Seit AP E1 steht der Beleg ohne Zeile als eigene Zeile der Kostenart
    expect(art5.zeilen).toEqual([
      expect.objectContaining({ description: 'Kamera', soll_cents: 3_000_000, ist_cents: 1_500_000, rest_cents: 1_500_000 }),
      expect.objectContaining({ description: 'Belege ohne Zeile', soll_cents: 0, ist_cents: 719_000, rest_cents: 0 }),
    ])
    expect(k.rows.find((r: any) => r.category === 'Ohne Kostenart')).toMatchObject({ soll_cents: 0, ist_cents: 4_200 })
    expect(k.rows.filter((r: any) => r.cost_group !== null)).toHaveLength(11)
    expect(k.rechenwerk.fertigungskosten).toBe(13_000_000)
  })
})

describe('Finanzierungsplan mit Status, Lücke und Raten (AP B2)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })

  /** Firma, Projekt, freie Kalkulation über 430.000 € und ein Finanzierungsplan mit sieben Geldgebern. */
  async function aufbau() {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Finanzierung GmbH', ?)", [nutzerId])).id
    const p = (await db.run('INSERT INTO projects (title, owner_id, company_id) VALUES (?, ?, ?)', ['Finanzierung B2', nutzerId, firma])).id
    const k = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K', schema: 'frei' })).daten
    await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Alles', description: 'Alles', quantity: 1, unit_price_cents: 43_000_000 })
    const plan = (await sende(`/api/projects/${p}/financing-versions`, { name: 'Plan' })).daten
    const geldgeber: any[] = []
    for (const [quelle, cent, status] of [['FFA', 10_000_000, 'zugesagt'], ['DFFF', 8_500_000, 'ausgezahlt'], ['Sender', 12_000_000, 'zugesagt'],
      ['Nordmedia', 3_000_000, 'beantragt'], ['Verleih', 4_500_000, 'beantragt'], ['Weltvertrieb', 2_000_000, 'geplant'], ['Eigenmittel', 3_000_000, 'geplant']] as const) {
      geldgeber.push((await sende(`/api/financing-versions/${plan.id}/entries`, { source: quelle, type: 'Förderung', amount_cents: cent, status })).daten)
    }
    return { firma, p, plan, geldgeber }
  }

  it('sieben Geldgeber decken die Kalkulation: Lücke 0, zugesagt, ausgezahlt, nicht zugesagt; kein Konflikt', async () => {
    const a = await aufbau()
    expect(a.geldgeber[0]).toMatchObject({ status: 'zugesagt', confirmed: true })
    expect(a.geldgeber[3]).toMatchObject({ status: 'beantragt', confirmed: false })
    const stand = (await hole(`/api/financing-versions/${a.plan.id}/stand`, tokenInhaber)).daten
    expect(stand).toMatchObject({
      herstellungskosten_cents: 43_000_000, summe_cents: 43_000_000, luecke_cents: 0,
      zugesagt_cents: 30_500_000, ausgezahlt_cents: 8_500_000, nicht_zugesagt_cents: 12_500_000, ueberfinanziert_cents: 0,
    })
    const konflikte = (await hole(`/api/projects/${a.p}/conflicts`, tokenInhaber)).daten as any[]
    expect(konflikte.some((k) => /Finanzierungslücke/.test(k.message))).toBe(false)
    // Um 10.000 € erhöht: überfinanziert
    await sende(`/api/financing-entries/${a.geldgeber[6].id}`, { ...a.geldgeber[6], amount_cents: 4_000_000 }, 'PUT')
    expect((await hole(`/api/financing-versions/${a.plan.id}/stand`, tokenInhaber)).daten.ueberfinanziert_cents).toBe(1_000_000)
    // Unbekannter Stand und falsches Datum werden abgelehnt
    expect((await sende(`/api/financing-entries/${a.geldgeber[6].id}`, { ...a.geldgeber[6], status: 'erledigt' }, 'PUT')).status).toBe(400)
    expect((await sende(`/api/financing-entries/${a.geldgeber[6].id}`, { ...a.geldgeber[6], granted_on: '15.11.2026' }, 'PUT')).status).toBe(400)
  })

  it('der alte Schalter "bestätigt" wird "zugesagt"', async () => {
    const a = await aufbau()
    // Wie die Seite vor AP B2: der ganze Eintrag, mit dem Schalter statt des Stands
    const { status: _status, ...ohneStand } = a.geldgeber[5]
    const alt = await sende(`/api/financing-entries/${a.geldgeber[5].id}`, { ...ohneStand, confirmed: true }, 'PUT')
    expect(alt.daten).toMatchObject({ status: 'zugesagt', confirmed: true })
  })

  it('Raten: über dem Betrag meldet sich; eine überfällige Rate steht in Abschlussprüfung und "Was anliegt"', async () => {
    const a = await aufbau()
    const ffa = a.geldgeber[0]
    expect((await sende(`/api/financing-entries/${ffa.id}/raten`, { label: 'Drehbeginn', due_on: '2026-03-01', amount_cents: 6_000_000, received_on: '2026-03-05' })).status).toBe(201)
    const ueberfaellig = await sende(`/api/financing-entries/${ffa.id}/raten`, { label: 'Rohschnittabnahme', due_on: '2026-06-01', amount_cents: 4_000_000 })
    expect(ueberfaellig.status).toBe(201)
    let liste = (await hole(`/api/financing-versions/${a.plan.id}/entries`, tokenInhaber)).daten as any[]
    expect(liste[0]).toMatchObject({ raten_summe_cents: 10_000_000, raten_ueber_betrag: false })
    expect(liste[0].raten.map((r: any) => r.label)).toEqual(['Drehbeginn', 'Rohschnittabnahme'])
    await sende(`/api/financing-entries/${ffa.id}/raten`, { label: 'Schluss', amount_cents: 100 })
    liste = (await hole(`/api/financing-versions/${a.plan.id}/entries`, tokenInhaber)).daten as any[]
    expect(liste[0].raten_ueber_betrag).toBe(true)
    expect((await hole(`/api/financing-versions/${a.plan.id}/stand`, tokenInhaber)).daten.ausgezahlt_cents).toBe(8_500_000 + 6_000_000)

    const abschluss = (await hole(`/api/projects/${a.p}/abschluss`, tokenInhaber)).daten
    const raten = (abschluss.punkte ?? abschluss.offen ?? []).find((x: any) => x.schluessel === 'raten')
    expect(raten).toMatchObject({ anzahl: 1, blockiert: true })
    const anliegen = (await hole(`/api/companies/${a.firma}/anliegen`, tokenInhaber)).daten.punkte as any[]
    expect(anliegen.find((x) => x.art === 'rate')).toMatchObject({ titel: 'Rate von FFA überfällig', stufe: 'dringend' })
    // Eingegangen: nicht mehr überfällig
    await sende(`/api/financing-raten/${ueberfaellig.daten.id}`, { received_on: '2026-06-10' }, 'PUT')
    expect(((await hole(`/api/companies/${a.firma}/anliegen`, tokenInhaber)).daten.punkte as any[]).some((x) => x.art === 'rate')).toBe(false)
    expect((await sende(`/api/financing-raten/${ueberfaellig.daten.id}`, { due_on: 'Drehbeginn' }, 'PUT')).status).toBe(400)
  })
})

describe('Cashflowplan (AP E2)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })

  it('zwei Zeilen auf "Drehzeit", eine ohne Zeitraum; zweite Rate nach Drehende - Unterdeckung, vorgezogen keine', async () => {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Cashflow GmbH', ?)", [nutzerId])).id
    const p = (await db.run('INSERT INTO projects (title, owner_id, company_id) VALUES (?, ?, ?)', ['Cashflow E2', nutzerId, firma])).id
    // Drehzeit 02.03. bis 13.03.2026; der Reservetag am 15.03. zählt nicht
    for (const [nr, datum, stand] of [[1, '2026-03-02', 'Geplant'], [2, '2026-03-13', 'Geplant'], [3, '2026-03-15', 'Reserve']] as const) {
      await db.run('INSERT INTO shoot_days (project_id, day_number, date, status) VALUES (?, ?, ?, ?)', [p, nr, datum, stand])
    }
    await db.run("INSERT INTO project_events (project_id, title, start_date, type) VALUES (?, 'Rohschnittabnahme', '2026-03-27', 'Meilenstein')", [p])
    const k = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K', schema: 'frei' })).daten
    const kamera = (await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Technik', description: 'Kamera', quantity: 1, unit_price_cents: 3_000_000 })).daten
    const gagen = (await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Gagen', description: 'Gagen', quantity: 1, unit_price_cents: 6_000_000 })).daten
    await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Versicherung', description: 'Versicherung', quantity: 1, unit_price_cents: 500_000 })
    const gesetzt = await sende(`/api/budget-versions/${k.id}/zeitraum`, { ids: [kamera.id, gagen.id], phase: 'drehzeit' })
    expect(gesetzt.daten).toEqual({ geaendert: 2, von: '2026-03-02', bis: '2026-03-13' })

    const plan = (await sende(`/api/projects/${p}/financing-versions`, { name: 'Plan' })).daten
    const sender = (await sende(`/api/financing-versions/${plan.id}/entries`, { source: 'Sender', type: 'Förderung', amount_cents: 10_000_000, status: 'zugesagt' })).daten
    await sende(`/api/financing-entries/${sender.id}/raten`, { label: 'Drehbeginn', due_on: '2026-03-02', amount_cents: 4_000_000 })
    const zweite = (await sende(`/api/financing-entries/${sender.id}/raten`, { label: 'Abnahme', due_on: '2026-04-01', amount_cents: 6_000_000 })).daten

    const cf = (await hole(`/api/projects/${p}/cashflow?raster=woche`, tokenInhaber)).daten
    // 90.000 € über 12 Tage: 7 Tage in der ersten Woche, 5 in der zweiten
    expect(cf.perioden.map((x: any) => [x.schluessel, x.einnahmen_cents, x.ausgaben_plan_cents, x.saldo_aufgelaufen_cents, x.unterdeckung])).toEqual([
      ['2026-03-02', 4_000_000, 5_250_000, -1_250_000, true],
      ['2026-03-09', 0, 3_750_000, -5_000_000, true],
      ['2026-03-16', 0, 0, -5_000_000, true],
      ['2026-03-23', 0, 0, -5_000_000, true],
      ['2026-03-30', 6_000_000, 0, 1_000_000, false],
    ])
    expect(cf.perioden[0].ereignisse.map((x: any) => x.titel)).toEqual(['Drehbeginn'])
    expect(cf.perioden[1].ereignisse.map((x: any) => x.titel)).toEqual(['Drehende'])
    expect(cf.perioden[3].ereignisse.map((x: any) => x.titel)).toEqual(['Rohschnittabnahme'])
    expect(cf.nicht_terminiert.ausgaben).toEqual([{ bezeichnung: 'Versicherung', cents: 500_000 }])
    expect(cf.drehzeit).toEqual({ von: '2026-03-02', bis: '2026-03-13' })
    // Im Monatsraster dieselben Summen
    const monat = (await hole(`/api/projects/${p}/cashflow?raster=monat`, tokenInhaber)).daten
    expect(monat.perioden.map((x: any) => x.schluessel)).toEqual(['2026-03', '2026-04'])
    expect(monat.summen).toEqual(cf.summen)

    // Zweite Rate vorziehen: das Minus verschwindet
    expect((await sende(`/api/financing-raten/${zweite.id}`, { due_on: '2026-03-02' }, 'PUT')).status).toBe(200)
    const danach = (await hole(`/api/projects/${p}/cashflow?raster=woche`, tokenInhaber)).daten
    expect(danach.erste_unterdeckung).toBeNull()

    // CSV im Aufbau der Tabelle
    const csv = await (await fetch(`${basis}/api/projects/${p}/cashflow?raster=woche&format=csv`, { headers: { Authorization: `Bearer ${tokenInhaber}` } })).text()
    const zeilen = csv.replace(/^\ufeff/, '').split(/\r?\n/)
    expect(zeilen[0]).toBe('Woche;Ereignisse;Einnahmen;Ausgaben laut Plan;Ausgaben laut Belegen;Saldo;Saldo aufgelaufen;Stand')
    expect(zeilen[1]).toBe('2026-03-02 bis 2026-03-08;Drehbeginn;100000,00;52500,00;0,00;47500,00;47500,00;')
    expect(csv).toContain('Nicht terminiert;Versicherung;;5000,00;;;;')
  })

  it('der Zeitraum einer Zeile: beide Enden oder keins, Ende nicht vor Anfang; wer ihn nicht schickt, behält ihn', async () => {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Zeitraum GmbH', ?)", [nutzerId])).id
    const p = (await db.run('INSERT INTO projects (title, owner_id, company_id) VALUES (?, ?, ?)', ['Zeitraum E2', nutzerId, firma])).id
    const k = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K', schema: 'frei' })).daten
    const z = (await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Technik', description: 'Licht', quantity: 1, unit_price_cents: 100_000 })).daten
    expect((await sende(`/api/budget-lines/${z.id}`, { ...z, spend_from: '2026-05-04' }, 'PUT')).status).toBe(400)
    expect((await sende(`/api/budget-lines/${z.id}`, { ...z, spend_from: '2026-05-10', spend_until: '2026-05-04' }, 'PUT')).status).toBe(400)
    expect((await sende(`/api/budget-lines/${z.id}`, { ...z, spend_from: '04.05.2026', spend_until: '2026-05-10' }, 'PUT')).status).toBe(400)
    const ok = await sende(`/api/budget-lines/${z.id}`, { ...z, spend_from: '2026-05-04', spend_until: '2026-05-10' }, 'PUT')
    expect(ok.daten).toMatchObject({ spend_from: '2026-05-04', spend_until: '2026-05-10' })
    // Wie die Zeile vor AP E2: ohne die zwei Felder - der Zeitraum bleibt
    const { spend_from: _a, spend_until: _b, ...ohne } = ok.daten
    expect((await sende(`/api/budget-lines/${z.id}`, { ...ohne, description: 'Licht und Strom' }, 'PUT')).daten).toMatchObject({ description: 'Licht und Strom', spend_from: '2026-05-04' })
    // Die Kopie einer Fassung übernimmt den Zeitraum
    const kopie = (await sende(`/api/budget-versions/${k.id}/kopie`, {})).daten
    const zeilen = (await hole(`/api/budget-versions/${kopie.id}/lines`, tokenInhaber)).daten as any[]
    expect(zeilen[0]).toMatchObject({ spend_from: '2026-05-04', spend_until: '2026-05-10' })
    // Leeren geht; ohne Drehtag gibt es keine Drehzeit
    expect((await sende(`/api/budget-lines/${z.id}`, { ...ohne, spend_from: null, spend_until: '' }, 'PUT')).daten).toMatchObject({ spend_from: null, spend_until: null })
    const ohneDreh = await sende(`/api/budget-versions/${k.id}/zeitraum`, { ids: [z.id], phase: 'drehzeit' })
    expect(ohneDreh.status).toBe(400)
    expect(ohneDreh.fehler).toMatch(/kein Drehtag/)
  })
})

describe('Rückstellungen, Beistellungen, Rückflussrang (AP E4)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  async function projektMitFirma(titel: string) {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Rückstellung GmbH', ?)", [nutzerId])).id
    return (await db.run('INSERT INTO projects (title, owner_id, company_id) VALUES (?, ?, ?)', [titel, nutzerId, firma])).id
  }

  it('50.000 €, davon 20.000 € zurückgestellt: Finanzierungsplan, Lücke, Kostenstand, Cashflow; 60.000 € abgelehnt', async () => {
    const p = await projektMitFirma('Rückstellung E4')
    const k = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K', schema: 'frei' })).daten
    const z = (await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Gagen', description: 'Regie', quantity: 1, unit_price_cents: 5_000_000 })).daten
    const plan = (await sende(`/api/projects/${p}/financing-versions`, { name: 'Plan' })).daten
    await sende(`/api/financing-versions/${plan.id}/entries`, { source: 'Sender', type: 'Förderung', amount_cents: 1_000_000, status: 'zugesagt' })
    const vorher = (await hole(`/api/financing-versions/${plan.id}/stand`, tokenInhaber)).daten
    expect(vorher.luecke_cents).toBe(4_000_000)

    const gesetzt = await sende(`/api/budget-lines/${z.id}`, { ...z, deferred_cents: 2_000_000 }, 'PUT')
    expect(gesetzt.daten).toMatchObject({ deferred_cents: 2_000_000, in_kind_cents: 0 })
    const stand = (await hole(`/api/financing-versions/${plan.id}/stand`, tokenInhaber)).daten
    expect(stand.aus_kalkulation).toEqual([{ art: 'rueckstellungen', source: 'Rückstellungen (aus der Kalkulation)', amount_cents: 2_000_000 }])
    expect(stand).toMatchObject({ luecke_cents: 2_000_000, summe_cents: 3_000_000, zugesagt_cents: 3_000_000 })
    // Dashboard und Konfliktradar rechnen genauso
    expect((await hole(`/api/projects/${p}/stats`, tokenInhaber)).daten.financing_total_cents).toBe(3_000_000)

    // Zusammen mehr als die Zeile: abgelehnt, auch über die Beistellung
    expect((await sende(`/api/budget-lines/${z.id}`, { ...z, deferred_cents: 6_000_000 }, 'PUT')).status).toBe(400)
    // 20.000 € zurückgestellt plus 35.000 € beigestellt sind mehr als 50.000 €
    expect((await sende(`/api/budget-lines/${z.id}`, { ...gesetzt.daten, in_kind_cents: 3_500_000 }, 'PUT')).status).toBe(400)
    expect((await sende(`/api/budget-lines/${z.id}`, { ...z, deferred_cents: -1 }, 'PUT')).status).toBe(400)
    // Wer die Felder nicht schickt, behält sie
    const { deferred_cents: _r, in_kind_cents: _b, ...ohne } = gesetzt.daten
    expect((await sende(`/api/budget-lines/${z.id}`, { ...ohne, description: 'Regie und Buch' }, 'PUT')).daten.deferred_cents).toBe(2_000_000)
    // Die Zeilensumme unter die Rückstellung senken geht nicht
    expect((await sende(`/api/budget-lines/${z.id}`, { ...ohne, unit_price_cents: 1_000_000 }, 'PUT')).status).toBe(400)

    // Kostenstand: noch zu erwarten 30.000 €, Endstand bleibt 50.000 €
    const ks = (await hole(`/api/projects/${p}/kostenstand`, tokenInhaber)).daten
    const zeile = ks.rows.flatMap((r: any) => r.zeilen).find((x: any) => x.id === z.id)
    expect(zeile).toMatchObject({ rest_cents: 3_000_000, zurueckgestellt_cents: 2_000_000, endstand_cents: 5_000_000, abweichung_cents: 0 })
    expect(ks.totals).toMatchObject({ rest_cents: 3_000_000, endstand_cents: 5_000_000 })

    // Cashflow: 30.000 € fließen
    await sende(`/api/budget-lines/${z.id}`, { ...ohne, description: 'Regie', spend_from: '2027-01-04', spend_until: '2027-01-10' }, 'PUT')
    const cf = (await hole(`/api/projects/${p}/cashflow?raster=woche`, tokenInhaber)).daten
    expect(cf.summen.ausgaben_plan_cents).toBe(3_000_000)
  })

  it('Rückflussrang je Geldgeber: Zahl und Bedingungen, im Förderantrag; ungültig abgelehnt', async () => {
    const p = await projektMitFirma('Rang E4')
    const plan = (await sende(`/api/projects/${p}/financing-versions`, { name: 'Plan' })).daten
    const g = (await sende(`/api/financing-versions/${plan.id}/entries`, { source: 'Verleih', type: 'Verleih', amount_cents: 500_000, recoupment_rank: 1, recoupment_terms: 'Vorkosten zuerst' })).daten
    expect(g).toMatchObject({ recoupment_rank: 1, recoupment_terms: 'Vorkosten zuerst' })
    expect((await sende(`/api/financing-entries/${g.id}`, { ...g, recoupment_rank: 0 }, 'PUT')).status).toBe(400)
    expect((await sende(`/api/financing-entries/${g.id}`, { ...g, recoupment_rank: 1.5 }, 'PUT')).status).toBe(400)
    // Wer den Rang nicht schickt, behält ihn
    const { recoupment_rank: _r, recoupment_terms: _t, ...ohne } = g
    expect((await sende(`/api/financing-entries/${g.id}`, { ...ohne, amount_cents: 600_000 }, 'PUT')).daten).toMatchObject({ recoupment_rank: 1, recoupment_terms: 'Vorkosten zuerst' })
    expect((await sende(`/api/financing-entries/${g.id}`, { ...g, recoupment_rank: null }, 'PUT')).daten.recoupment_rank).toBeNull()
    await sende(`/api/financing-entries/${g.id}`, { ...g, recoupment_rank: 2 }, 'PUT')
    const antrag = (await hole(`/api/projects/${p}/foerderantrag/export`, tokenInhaber)).daten
    expect(antrag.financing.entries[0]).toMatchObject({ source: 'Verleih', recoupment_rank: 2, recoupment_terms: 'Vorkosten zuerst' })
  })

  it('Kosten übernehmen kürzt eine Rückstellung, die nicht mehr in die Zeile passt', async () => {
    const p = await projektMitFirma('Kürzen E4')
    const motiv = (await db.run("INSERT INTO locations (project_id, name, rental_fee) VALUES (?, 'Hafen', 50000)", [p])).id
    const tage: number[] = []
    for (let i = 0; i < 2; i++) {
      const tag = (await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, ?, ?)', [p, i + 1, `2027-02-0${i + 1}`])).id
      const szene = (await db.run('INSERT INTO scenes (project_id, scene_number, location_id) VALUES (?, ?, ?)', [p, String(i + 1), motiv])).id
      await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id) VALUES (?, ?)', [tag, szene])
      tage.push(tag)
    }
    const k = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K' })).daten
    await sende(`/api/budget-versions/${k.id}/kosten-uebernehmen`, {})
    let zeile = ((await hole(`/api/budget-versions/${k.id}/lines`, tokenInhaber)).daten as any[]).find((x) => x.source_key === `motiv:${motiv}`)
    expect(zeile.total_cents).toBe(100_000)
    await sende(`/api/budget-lines/${zeile.id}`, { ...zeile, deferred_cents: 70_000, in_kind_cents: 30_000 }, 'PUT')
    // Ein Drehtag fällt weg: 50.000 Cent - die Rückstellung passt noch, die Beistellung nicht mehr
    await db.run('DELETE FROM shoot_day_scenes WHERE shoot_day_id = ?', [tage[1]])
    await sende(`/api/budget-versions/${k.id}/kosten-uebernehmen`, {})
    zeile = ((await hole(`/api/budget-versions/${k.id}/lines`, tokenInhaber)).daten as any[]).find((x) => x.source_key === `motiv:${motiv}`)
    expect(zeile).toMatchObject({ total_cents: 50_000, deferred_cents: 50_000, in_kind_cents: 0 })
  })
})

describe('Regionaleffekt und deutsche Kosten (AP E3)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  async function projektMitFirma(titel: string) {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Region GmbH', ?)", [nutzerId])).id
    return (await db.run('INSERT INTO projects (title, owner_id, company_id) VALUES (?, ?, ?)', [titel, nutzerId, firma])).id
  }

  it('Förderung 200.000 € mit 150 % in NRW: 250.000 € zugeordnet nicht erfüllt, weitere 50.000 € erfüllt', async () => {
    const p = await projektMitFirma('Region E3')
    const nrw = (await sende(`/api/projects/${p}/regionen`, { name: 'NRW' })).daten
    const hh = (await sende(`/api/projects/${p}/regionen`, { name: 'Hamburg' })).daten
    expect((await sende(`/api/projects/${p}/regionen`, { name: 'nrw' })).status).toBe(400)
    const k = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K', schema: 'frei' })).daten
    const a = (await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Gagen', description: 'Stab Köln', quantity: 1, unit_price_cents: 25_000_000 })).daten
    const b = (await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Technik', description: 'Licht', quantity: 1, unit_price_cents: 10_000_000 })).daten
    expect((await sende(`/api/budget-lines/${a.id}/regionen`, { anteile: [{ region_id: nrw.id, share_bp: 10_000 }] }, 'PUT')).status).toBe(200)
    // 60 % NRW und 50 % Hamburg: abgelehnt, mit Grund
    const zuviel = await sende(`/api/budget-lines/${b.id}/regionen`, { anteile: [{ region_id: nrw.id, share_bp: 6_000 }, { region_id: hh.id, share_bp: 5_000 }] }, 'PUT')
    expect(zuviel.status).toBe(400)
    expect(zuviel.fehler).toBe('Die Anteile ergeben zusammen 110 % - höchstens 100 %')
    // Eine Region aus einem fremden Projekt gilt nicht
    const fremd = await projektMitFirma('Fremd E3')
    const fremdeRegion = (await sende(`/api/projects/${fremd}/regionen`, { name: 'Bayern' })).daten
    expect((await sende(`/api/budget-lines/${b.id}/regionen`, { anteile: [{ region_id: fremdeRegion.id, share_bp: 1_000 }] }, 'PUT')).status).toBe(400)

    const plan = (await sende(`/api/projects/${p}/financing-versions`, { name: 'Plan' })).daten
    const foerderung = (await sende(`/api/financing-versions/${plan.id}/entries`, { source: 'Film- und Medienstiftung NRW', type: 'Förderung', amount_cents: 20_000_000, region_id: nrw.id, regional_effect_bp: 15_000 })).daten
    expect(foerderung).toMatchObject({ region_id: nrw.id, regional_effect_bp: 15_000 })
    expect((await sende(`/api/financing-entries/${foerderung.id}`, { ...foerderung, region_id: fremdeRegion.id }, 'PUT')).status).toBe(400)

    let u = (await hole(`/api/projects/${p}/regionen`, tokenInhaber)).daten.uebersicht
    expect(u.regionen.find((r: any) => r.name === 'NRW')).toMatchObject({ geplant_cents: 25_000_000, gefordert_cents: 30_000_000, differenz_cents: -5_000_000, erfuellt: false })
    expect(u.ohne_region.geplant_cents).toBe(10_000_000)
    // Weitere 50.000 € nach NRW: erfüllt
    await sende(`/api/budget-lines/${b.id}/regionen`, { anteile: [{ region_id: nrw.id, share_bp: 5_000 }, { region_id: hh.id, share_bp: 2_000 }] }, 'PUT')
    u = (await hole(`/api/projects/${p}/regionen`, tokenInhaber)).daten.uebersicht
    expect(u.regionen.map((r: any) => [r.name, r.geplant_cents, r.erfuellt])).toEqual([['NRW', 30_000_000, true], ['Hamburg', 2_000_000, null]])
    // Ein Beleg erbt die Aufteilung seiner Zeile
    await sende(`/api/projects/${p}/expenses`, { description: 'Lampen', amount_cents: 1_000_000, budget_line_id: b.id })
    u = (await hole(`/api/projects/${p}/regionen`, tokenInhaber)).daten.uebersicht
    expect(u.regionen.map((r: any) => r.bisher_cents)).toEqual([500_000, 200_000])
    expect(u.ohne_region.bisher_cents).toBe(300_000)

    // Die Zeilenliste trägt die Anteile, die Kopie nimmt sie und die Kennzeichen mit
    await sende(`/api/budget-lines/${b.id}`, { ...b, german_spend: false, internal: true }, 'PUT')
    const zeilen = (await hole(`/api/budget-versions/${k.id}/lines`, tokenInhaber)).daten as any[]
    expect(zeilen.find((z) => z.id === b.id)).toMatchObject({ german_spend: false, internal: true, regionen: [{ region_id: nrw.id, share_bp: 5_000 }, { region_id: hh.id, share_bp: 2_000 }] })
    expect(zeilen.find((z) => z.id === a.id)).toMatchObject({ german_spend: true, internal: false })
    const kopie = (await sende(`/api/budget-versions/${k.id}/kopie`, {})).daten
    const kopierte = (await hole(`/api/budget-versions/${kopie.id}/lines`, tokenInhaber)).daten as any[]
    expect(kopierte.find((z) => z.description === 'Licht')).toMatchObject({ german_spend: false, internal: true, regionen: [{ region_id: nrw.id, share_bp: 5_000 }, { region_id: hh.id, share_bp: 2_000 }] })
    // Wer die Kennzeichen nicht schickt, behält sie
    const { german_spend: _d, internal: _i, regionen: _r, ...ohne } = zeilen.find((z) => z.id === b.id)
    expect((await sende(`/api/budget-lines/${b.id}`, { ...ohne, description: 'Licht und Strom' }, 'PUT')).daten).toMatchObject({ german_spend: false, internal: true })

    // Region löschen: Anteile gehen mit, der Geldgeber verliert die Region
    expect((await hole(`/api/regionen/${hh.id}`, tokenInhaber, { method: 'DELETE' })).status).toBe(200)
    expect((await db.all('SELECT * FROM budget_line_regions WHERE region_id = ?', [hh.id])).length).toBe(0)
  })

  it('Papierkorb: eine zurückgeholte Budgetzeile hat ihre Anteile wieder', async () => {
    const papierkorb = await import('../lib/papierkorb')
    const p = await projektMitFirma('Papierkorb E3')
    const nrw = (await sende(`/api/projects/${p}/regionen`, { name: 'NRW' })).daten
    const k = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K', schema: 'frei' })).daten
    const z = (await sende(`/api/budget-versions/${k.id}/lines`, { category: 'Gagen', description: 'Regie', quantity: 1, unit_price_cents: 1_000_000 })).daten
    await sende(`/api/budget-lines/${z.id}/regionen`, { anteile: [{ region_id: nrw.id, share_bp: 7_500 }] }, 'PUT')
    await papierkorb.inDenPapierkorb('budget_lines', z.id, { userId: nutzerId })
    await db.run('DELETE FROM budget_lines WHERE id = ?', [z.id])
    expect((await db.all('SELECT * FROM budget_line_regions WHERE budget_line_id = ?', [z.id])).length).toBe(0)
    const eintrag = (await papierkorb.inhalt(p)).find((e: any) => e.row_id === z.id)
    expect((await papierkorb.ausDemPapierkorb(eintrag.id, p)).wiederhergestellt).toBe(true)
    expect(await db.all('SELECT region_id, share_bp FROM budget_line_regions WHERE budget_line_id = ?', [z.id])).toEqual([{ region_id: nrw.id, share_bp: 7_500 }])
  })
})

describe('Motiv und Sets, Drehort-Angaben, Genehmigungen (AP C3)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  const inTagen = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
  async function projektMitFirma(titel: string) {
    const firma = (await db.run("INSERT INTO companies (name, owner_id) VALUES ('Motiv GmbH', ?)", [nutzerId])).id
    return (await db.run('INSERT INTO projects (title, owner_id, company_id) VALUES (?, ?, ?)', [titel, nutzerId, firma])).id
  }

  it('die Überschrift legt Motiv und Set an, findet das Set wieder und heilt einen Tippfehler', async () => {
    const { motivVerknuepfen } = await import('../lib/motive')
    const p = await projektMitFirma('Sets C3')
    const szene = async (titel: string) => {
      const id = (await db.run('INSERT INTO scenes (project_id, scene_number, title) VALUES (?, ?, ?)', [p, String(Math.random()).slice(2, 6), titel])).id
      await motivVerknuepfen(db, p, id, titel)
      return db.get('SELECT s.location_id, s.set_id, l.name AS motiv, st.name AS set_name FROM scenes s LEFT JOIN locations l ON l.id = s.location_id LEFT JOIN location_sets st ON st.id = s.set_id WHERE s.id = ?', [id]) as Promise<any>
    }
    const a = await szene('DEICH - KRONE')
    expect(a).toMatchObject({ motiv: 'Deich', set_name: 'Krone' })
    const b = await szene('Deich - krone')
    expect(b.set_id).toBe(a.set_id)
    // Tippfehler im Set einer Szene, die es allein benutzt: das Set folgt
    const c = await szene('DEICH - FUSS')
    const cId = (await db.get('SELECT id FROM scenes WHERE set_id = ?', [c.set_id]) as any).id
    await db.run('UPDATE scenes SET title = ? WHERE id = ?', ['DEICH - FUSSWEG', cId])
    await motivVerknuepfen(db, p, cId, 'DEICH - FUSSWEG')
    expect((await db.get('SELECT name FROM location_sets WHERE id = ?', [c.set_id]) as any).name).toBe('Fussweg')
    // Auf ein vorhandenes Set korrigiert: die Szene wechselt, das leere Set geht
    await motivVerknuepfen(db, p, cId, 'DEICH - KRONE')
    expect((await db.get('SELECT set_id FROM scenes WHERE id = ?', [cId]) as any).set_id).toBe(a.set_id)
    expect(await db.get('SELECT id FROM location_sets WHERE id = ?', [c.set_id])).toBeUndefined()
    // In der Szenenliste steht das Set
    const liste = (await hole(`/api/projects/${p}/scenes`, tokenInhaber)).daten as any[]
    expect(liste.every((x) => x.set_name === 'Krone')).toBe(true)
    // Ein Motiv mit Krankenhaus ist keine leere Hülle mehr: Es bleibt, wenn die Überschrift wechselt
    const einzeln = (await db.run('INSERT INTO scenes (project_id, scene_number, title) VALUES (?, ?, ?)', [p, '99', 'MOLE - ENDE'])).id
    await motivVerknuepfen(db, p, einzeln, 'MOLE - ENDE')
    const mole = (await db.get('SELECT location_id FROM scenes WHERE id = ?', [einzeln]) as any).location_id
    await db.run("UPDATE locations SET hospital_name = 'Klinikum Nord' WHERE id = ?", [mole])
    await motivVerknuepfen(db, p, einzeln, 'HAFENMOLE - ENDE')
    expect((await db.get('SELECT name FROM locations WHERE id = ?', [mole]) as any).name).toBe('Mole')
  })

  it('Sets von Hand: doppelt abgelehnt, umbenennen, löschen löst die Szenen; Drehort-Angaben bleiben, wenn sie nicht mitkommen', async () => {
    const p = await projektMitFirma('Sets Hand C3')
    const motiv = (await sende(`/api/projects/${p}/locations`, { name: 'Villa', hospital_name: 'St. Marien', basecamp: 'Parkplatz Süd', permit_required: true })).daten
    expect(motiv).toMatchObject({ hospital_name: 'St. Marien', basecamp: 'Parkplatz Süd', permit_required: true })
    const garten = (await sende(`/api/locations/${motiv.id}/sets`, { name: 'Garten' })).daten
    expect((await sende(`/api/locations/${motiv.id}/sets`, { name: 'garten' })).status).toBe(400)
    expect((await sende(`/api/location-sets/${garten.id}`, { name: 'Wintergarten', notes: 'Glasdach' }, 'PUT')).daten).toMatchObject({ name: 'Wintergarten', notes: 'Glasdach' })
    const szene = (await db.run('INSERT INTO scenes (project_id, scene_number, title, location_id, set_id) VALUES (?, ?, ?, ?, ?)', [p, '1', 'VILLA', motiv.id, garten.id])).id
    // Die alte Seite schickt die neuen Felder nicht mit - sie bleiben
    const { hospital_name: _h, basecamp: _b, permit_required: _g, sets: _s, ...alt } = motiv
    const geaendert = (await sende(`/api/locations/${motiv.id}`, { ...alt, notes: 'Schlüssel beim Nachbarn' }, 'PUT')).daten
    expect(geaendert).toMatchObject({ hospital_name: 'St. Marien', basecamp: 'Parkplatz Süd', permit_required: true, notes: 'Schlüssel beim Nachbarn' })
    const liste = (await hole(`/api/projects/${p}/locations`, tokenInhaber)).daten as any[]
    expect(liste[0]).toMatchObject({ szenen_anzahl: 1, sets: [expect.objectContaining({ name: 'Wintergarten', szenen: 1 })] })
    expect((await hole(`/api/location-sets/${garten.id}`, tokenInhaber, { method: 'DELETE' })).status).toBe(200)
    expect((await db.get('SELECT set_id FROM scenes WHERE id = ?', [szene]) as any).set_id).toBeNull()
  })

  it('Genehmigung: Drehtag in zehn Tagen warnt, eine vorliegende über das Datum beendet es, gekürzt kommt es wieder', async () => {
    const p = await projektMitFirma('Genehmigung C3')
    const deich = (await sende(`/api/projects/${p}/locations`, { name: 'Deich', permit_required: true })).daten
    const ohne = (await sende(`/api/projects/${p}/locations`, { name: 'Küche' })).daten
    const tag = (await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, ?)', [p, inTagen(10)])).id
    for (const [nr, loc] of [['1', deich.id], ['2', ohne.id]] as const) {
      const sz = (await db.run('INSERT INTO scenes (project_id, scene_number, title, location_id) VALUES (?, ?, ?, ?)', [p, nr, 'X', loc])).id
      await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id) VALUES (?, ?)', [tag, sz])
    }
    const meldungen = async () => ((await hole(`/api/projects/${p}/conflicts`, tokenInhaber)).daten as any[]).filter((k) => /Genehmigung/.test(k.message))
    expect((await meldungen()).map((k) => [k.severity, k.message])).toEqual([['warning', `Keine Genehmigung für „Deich" am ${inTagen(10).split('-').reverse().join('.')}`]])

    const g = (await sende(`/api/projects/${p}/genehmigungen`, { location_id: deich.id, title: 'Sondernutzung Deich', authority: 'Deichverband', status: 'liegt vor', valid_from: inTagen(5), valid_until: inTagen(15) })).daten
    expect(g).toMatchObject({ status: 'liegt vor', authority: 'Deichverband' })
    expect(await meldungen()).toEqual([])
    await sende(`/api/genehmigungen/${g.id}`, { valid_until: inTagen(8) }, 'PUT')
    expect((await meldungen()).map((k) => k.severity)).toEqual(['warning'])
    // Ungültiges abgelehnt: Status, Ende vor Beginn, Motiv eines anderen Projekts
    expect((await sende(`/api/genehmigungen/${g.id}`, { status: 'erledigt' }, 'PUT')).status).toBe(400)
    expect((await sende(`/api/genehmigungen/${g.id}`, { valid_from: inTagen(9) }, 'PUT')).status).toBe(400)
    const fremd = await projektMitFirma('Fremd C3')
    const fremdesMotiv = (await sende(`/api/projects/${fremd}/locations`, { name: 'Fremd' })).daten
    expect((await sende(`/api/projects/${p}/genehmigungen`, { location_id: fremdesMotiv.id, title: 'X' })).status).toBe(400)
    // Am Drehtag ohne Genehmigung: Fehler; im Abschluss steht ein gedrehter Tag ohne Genehmigung
    await db.run('UPDATE shoot_days SET date = ? WHERE id = ?', [inTagen(-2), tag])
    expect((await meldungen()).map((k) => k.severity)).toEqual(['error'])
    const abschluss = (await hole(`/api/projects/${p}/abschluss`, tokenInhaber)).daten
    expect(abschluss.punkte.find((x: any) => x.schluessel === 'genehmigungen')).toMatchObject({ anzahl: 1, blockiert: false })
  })
})

describe('Dispo-Kopf vollständig, Breakdown in die Dispo (AP C4)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST', token = tokenInhaber) =>
    hole(pfad, token, { method: methode, body: JSON.stringify(koerper) })

  it('neue Dispo trägt Krankenhaus, Basecamp und Parken des Motivs; später am Motiv geändert, bleibt die Dispo', async () => {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Dispo C4', nutzerId])).id
    const deich = (await db.run(
      "INSERT INTO locations (project_id, name, hospital_name, hospital_address, basecamp, parking_info) VALUES (?, 'Deich', 'Klinikum Husum', 'Erichsenweg 16', 'Deichtor', 'Wiese am Sielzug') RETURNING id", [p])).id
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2027-03-01')", [p])).id
    const szene = (await db.run("INSERT INTO scenes (project_id, scene_number, title, location_id) VALUES (?, '12', 'DEICH', ?)", [p, deich])).id
    await db.run('INSERT INTO shoot_day_scenes (shoot_day_id, scene_id) VALUES (?, ?)', [tag, szene])
    for (const [ding, art, menge] of [['Sturmlaterne', 'Requisite', 1], ['Sandsäcke', 'Requisite', 40], ['Ölzeug', 'Kostüm', 2]] as const) {
      await db.run('INSERT INTO scene_inventory (scene_id, item, category, quantity) VALUES (?, ?, ?, ?)', [szene, ding, art, menge])
    }
    // Wie die Seite: nur die Felder, die sie kennt
    const dispo = (await sende(`/api/shoot-days/${tag}/call-sheet`, { general_call: 420, shooting_call: 450 })).daten
    expect(dispo).toMatchObject({ hospital_name: 'Klinikum Husum', hospital_address: 'Erichsenweg 16', basecamp: 'Deichtor', crew_parking: 'Wiese am Sielzug' })
    expect(dispo.vom_motiv).toMatchObject({ motiv: 'Deich', hospital_name: 'Klinikum Husum' })
    expect(dispo.dept_vorschlag).toEqual({ PROPS: 'Sturmlaterne (Sz. 12), Sandsäcke ×40 (Sz. 12)', KOSTÜM: 'Ölzeug ×2 (Sz. 12)' })
    // Am Tag geändert bleibt am Tag; ein Speichern ohne das Feld löscht es nicht
    await sende(`/api/shoot-days/${tag}/call-sheet`, { hospital_name: 'Notaufnahme Nord', breakfast_call: 390, walkie_channels: '1 Regie, 2 Technik' })
    const nachher = (await sende(`/api/shoot-days/${tag}/call-sheet`, { general_call: 430 })).daten
    expect(nachher).toMatchObject({ hospital_name: 'Notaufnahme Nord', basecamp: 'Deichtor', breakfast_call: 390, walkie_channels: '1 Regie, 2 Technik', general_call: 430 })
    // Später am Motiv geändert: die Dispo bleibt
    await db.run("UPDATE locations SET basecamp = 'Hafen' WHERE id = ?", [deich])
    expect((await hole(`/api/shoot-days/${tag}/call-sheet`, tokenInhaber)).daten).toMatchObject({ basecamp: 'Deichtor', vom_motiv: expect.objectContaining({ basecamp: 'Hafen' }) })
    expect((await sende(`/api/shoot-days/${tag}/call-sheet`, { lunch_call: 2000 })).status).toBe(400)
  })

  it('Bestätigungslink je Person ohne Versand; ein Nur-lesen-Mitglied bekommt keine Links', async () => {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Link C4', nutzerId])).id
    await db.run("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'read_only')", [p, fremdeId])
    const tag = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2027-03-02')", [p])).id
    await db.run("INSERT INTO crew (project_id, name, role) VALUES (?, 'Mia Licht', 'Oberbeleuchterin')", [p])
    const dispo = (await sende(`/api/shoot-days/${tag}/call-sheet`, {})).daten
    const eintrag = dispo.entries[0]
    expect(eintrag.public_token ?? null).toBeNull()
    const link = (await sende(`/api/call-sheet-entries/${eintrag.id}/link`)).daten
    expect(link.pfad).toBe(`/dispo/${link.token}`)
    expect(link.token).toMatch(/^[0-9a-f]{40}$/)
    // Ein zweites Mal derselbe Link
    expect((await sende(`/api/call-sheet-entries/${eintrag.id}/link`)).daten.token).toBe(link.token)
    // Die Bestätigungsseite kennt ihn
    expect((await hole(`/api/cse/t/${link.token}`, '')).status).toBe(200)
    // Lesen: Inhaber mit Token, Nur-lesen ohne
    expect((await hole(`/api/shoot-days/${tag}/call-sheet`, tokenInhaber)).daten.entries[0].public_token).toBe(link.token)
    const leser = (await hole(`/api/shoot-days/${tag}/call-sheet`, tokenFremd)).daten
    expect(leser.entries).toHaveLength(1)
    expect('public_token' in leser.entries[0]).toBe(false)
  })
})

describe('Cover-Sets und Tag-für-Nacht (AP C5)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })

  it('Dispo nennt die Ausweichszene, ohne Markierung meldet der Radar den Tag, Tag-für-Nacht trägt T/N', async () => {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Cover C5', nutzerId])).id
    const deich = (await db.run("INSERT INTO locations (project_id, name) VALUES (?, 'Deich')", [p])).id
    const szene = async (nr: string, int_ext: string, day_night = 'TAG') =>
      (await db.run('INSERT INTO scenes (project_id, scene_number, title, int_ext, day_night, location_id) VALUES (?, ?, ?, ?, ?, ?)',
        [p, nr, `Szene ${nr}`, int_ext, day_night, deich])).id
    const [aussen, innen, nacht] = [await szene('20', 'EXT'), await szene('21', 'INT'), await szene('22', 'EXT', 'NACHT')]
    const tag = (await sende(`/api/projects/${p}/shoot-days`, { date: '2027-06-01' })).daten
    await sende(`/api/projects/${p}/drehplan/verschieben`, { szenen: [aussen, nacht], zielTag: tag.id })
    const szeneAendern = async (id: number, mehr: any) => {
      const vorher = (await hole(`/api/projects/${p}/scenes`, tokenInhaber)).daten.find((x: any) => x.id === id)
      return sende(`/api/scenes/${id}`, { ...vorher, ...mehr, updated_at: undefined }, 'PUT')
    }

    // Innenszene als Cover-Set: Der Tag mit Außenszenen nennt sie
    expect((await szeneAendern(innen, { cover_set: true })).daten).toMatchObject({ cover_set: true, day_for_night: false })
    const tage = (await hole(`/api/projects/${p}/shoot-days`, tokenInhaber)).daten as any[]
    expect(tage[0].cover_sets.map((k: any) => k.scene_number)).toEqual(['21'])
    const { buildTagesdispoHtml } = await import('../routes/pdf')
    let html = (await buildTagesdispoHtml(tag.id))!.html
    expect(html).toContain('Bei Schlechtwetter')
    expect(html).toContain('INT. SZENE 21')
    const radar = async () => (await hole(`/api/projects/${p}/conflicts`, tokenInhaber)).daten as any[]
    expect((await radar()).some((k) => k.message.includes('kein Cover-Set'))).toBe(false)

    // Markierung weg: Hinweis im Konfliktradar
    await szeneAendern(innen, { cover_set: false })
    expect((await radar()).find((k) => k.message === 'Drehtag 1 (01.06.2027) hat nur Außenszenen und kein Cover-Set')).toMatchObject({ severity: 'info' })

    // Tag-für-Nacht: die Nachtszene trägt im PDF T/N
    // Der Spaltenkopf heißt auch T/N - gezählt wird die Zelle der Szene
    expect((await buildTagesdispoHtml(tag.id))!.html.includes('<td class="c">T/N</td>')).toBe(false)
    expect((await szeneAendern(nacht, { day_for_night: true })).daten).toMatchObject({ day_for_night: true, day_night: 'NACHT' })
    html = (await buildTagesdispoHtml(tag.id))!.html
    expect(html).toContain('<td class="c">T/N</td>')
    expect(html).not.toContain('Bei Schlechtwetter')
  })

  it('das Drehbuch schickt die ganze Szene mit omitted: false - kein Konflikt, der keiner ist', async () => {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Konflikt C5', nutzerId])).id
    const id = (await db.run("INSERT INTO scenes (project_id, scene_number, title) VALUES (?, '1', 'Stube')", [p])).id
    const geladen = (await hole(`/api/projects/${p}/scenes`, tokenInhaber)).daten.find((x: any) => x.id === id)
    expect(geladen.omitted).toBe(false)
    // Mehr als eine Sekunde nach dem Laden: Vorher setzte omitted: false den
    // Zeitstempel neu, und die Prüfung meldete 409
    await new Promise((r) => setTimeout(r, 1200))
    const antwort = await sende(`/api/scenes/${id}`, { ...geladen, cover_set: true }, 'PUT')
    expect(antwort.status).toBe(200)
    expect(antwort.daten.cover_set).toBe(true)
  })
})

describe('Units und parallele Drehtage (AP C2)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  const neuesProjekt = async (titel: string) => {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', [titel, nutzerId])).id
    const units = (await hole(`/api/projects/${p}/units`, tokenInhaber)).daten
    const zweite = (await sende(`/api/projects/${p}/units`, { name: '2. Unit', short: '2U', color: '#0ea5e9' })).daten
    const tag = async (date: string, unit_id?: number) => (await sende(`/api/projects/${p}/shoot-days`, { date, ...(unit_id ? { unit_id } : {}) })).daten
    return { p, haupt: units[0], zweite, tag }
  }
  const radar = async (p: number) => (await hole(`/api/projects/${p}/conflicts`, tokenInhaber)).daten as any[]

  it('zwei Units am selben Datum: keine Warnung, dieselbe Figur ist ein Fehler, Nummern je Unit, DOOD ein Arbeitstag', async () => {
    const { p, haupt, zweite, tag } = await neuesProjekt('Units C2')
    expect(haupt).toMatchObject({ name: 'Haupteinheit', is_main: true })
    expect(zweite).toMatchObject({ name: '2. Unit', short: '2U', is_main: false })
    expect((await sende(`/api/projects/${p}/units`, { name: '2. unit' })).status).toBe(400)
    expect((await sende(`/api/projects/${p}/units`, { name: 'Dritte', color: 'blau' })).status).toBe(400)

    // Vier Tage der Haupteinheit, ein Tag der 2. Unit am Datum von Tag 4
    const h = [await tag('2027-03-01'), await tag('2027-03-02'), await tag('2027-03-03'), await tag('2027-03-04')]
    const z = await tag('2027-03-04', zweite.id)
    expect(z).toMatchObject({ day_number: 1, unit: '2. Unit', unit_name: '2. Unit', unit_short: '2U', unit_is_main: false })
    const liste = (await hole(`/api/projects/${p}/shoot-days`, tokenInhaber)).daten as any[]
    expect(liste.map((d) => [d.day_number, d.unit_is_main])).toEqual([[1, true], [2, true], [3, true], [4, true], [1, false]])
    expect((await sende(`/api/projects/${p}/shoot-days`, { date: '2027-03-05', unit_id: 999_999 })).status).toBe(400)

    // Eine Szene mit der Hauptfigur in Tag 4, eine in den Tag der 2. Unit
    const figur = (await db.run("INSERT INTO characters (project_id, name) VALUES (?, 'Hauke')", [p])).id
    await db.run('INSERT INTO "cast" (project_id, character_id, actor_name) VALUES (?, ?, ?)', [p, figur, 'Jan Brandt'])
    const motiv = (await db.run("INSERT INTO locations (project_id, name) VALUES (?, 'Deich')", [p])).id
    const szene = async (nr: string, mitFigur: boolean) => {
      const id = (await db.run('INSERT INTO scenes (project_id, scene_number, location_id) VALUES (?, ?, ?)', [p, nr, motiv])).id
      if (mitFigur) await db.run('INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)', [id, figur])
      return id
    }
    const [s1, s2, s3] = [await szene('1', true), await szene('2', true), await szene('3', false)]
    await sende(`/api/projects/${p}/drehplan/verschieben`, { szenen: [s1], zielTag: h[3].id })
    await sende(`/api/projects/${p}/drehplan/verschieben`, { szenen: [s2], zielTag: z.id })

    let k = await radar(p)
    expect(k.filter((x) => x.message.startsWith('Mehrere Drehtage'))).toEqual([])
    const figurDoppelt = k.find((x) => x.message === 'Hauke dreht am 04.03.2027 in zwei Units')
    expect(figurDoppelt).toMatchObject({ severity: 'error' })
    expect(figurDoppelt.detail).toContain('Drehtag 4')
    expect(figurDoppelt.detail).toContain('2U Tag 1')
    expect(k.find((x) => x.message === 'Motiv „Deich" am 04.03.2027 in zwei Units')).toMatchObject({ severity: 'info' })

    // DOOD: Am 04.03. arbeitet Hauke in beiden Units - ein Arbeitstag
    const dood = (await hole(`/api/projects/${p}/dood-report`, tokenInhaber)).daten
    const spalte = dood.spalten.findIndex((x: any) => x.datum === '2027-03-04')
    expect(dood.spalten[spalte].bezeichnung).toBe('4 · 2U 1')
    expect(dood.cast[0]).toMatchObject({ total_work_days: 1 })
    expect(dood.cast[0].days[spalte].code).toBe('SWF')

    // Die Szene der 2. Unit durch eine ohne Hauke ersetzen: Meldung weg
    await sende(`/api/projects/${p}/drehplan/verschieben`, { szenen: [s3], zielTag: z.id })
    await sende(`/api/projects/${p}/drehplan/verschieben`, { szenen: [s2], zielTag: null })
    k = await radar(p)
    expect(k.some((x) => x.message.startsWith('Hauke dreht'))).toBe(false)

    // Zwei Tage derselben Unit am selben Datum bleiben eine Warnung
    const z2 = await tag('2027-03-04', zweite.id)
    expect(z2.day_number).toBe(2)
    k = await radar(p)
    expect(k.find((x) => x.message === 'Mehrere Drehtage am 04.03.2027 (2. Unit)')).toMatchObject({ severity: 'warning' })

    // Einen Tag in die andere Unit legen: Nummern zählen neu
    await sende(`/api/shoot-days/${z2.id}`, { unit_id: haupt.id }, 'PUT')
    const neu = (await hole(`/api/projects/${p}/shoot-days`, tokenInhaber)).daten as any[]
    expect(neu.filter((d) => d.unit_is_main).map((d) => d.day_number)).toEqual([1, 2, 3, 4, 5])
  })

  it('Stab je Unit: die Dispo der 2. Unit ruft ihren Stab, die Kalkulation zählt einen Tag, zwei Dispos am selben Datum sind ein Fehler', async () => {
    const { p, zweite, tag } = await neuesProjekt('Stab C2')
    const h = [await tag('2027-04-01'), await tag('2027-04-02'), await tag('2027-04-03')]
    const z = await tag('2027-04-01', zweite.id)
    const stab = async (name: string, mehr: any = {}) => (await sende(`/api/projects/${p}/crew`, { name, role: name, fee_per_day: 30_000, ...mehr })).daten
    const kameraHaupt = await stab('Kamera A')
    const kamera2 = await stab('Kamera B', { unit_id: zweite.id })
    const produktion = await stab('Produktion', { all_units: true })
    expect(kamera2).toMatchObject({ unit_id: zweite.id, all_units: false })
    expect(produktion).toMatchObject({ unit_id: null, all_units: true })
    expect((await sende(`/api/projects/${p}/crew`, { name: 'Fremd', unit_id: 999_999 })).status).toBe(400)

    const { drehtageStab } = await import('../lib/drehtage')
    const tage = await drehtageStab(db, p)
    expect([...tage.get(kameraHaupt.id)!].sort()).toEqual(h.map((t) => t.id).sort())
    expect([...tage.get(kamera2.id)!]).toEqual([z.id])
    expect(tage.get(produktion.id)!.size).toBe(4)

    // Die Dispo der 2. Unit ruft nur ihren Stab und wer zu allen gehört
    const dispo = (await sende(`/api/shoot-days/${z.id}/call-sheet`, {})).daten
    expect(dispo.entries.filter((e: any) => e.person_type === 'crew').map((e: any) => e.person_name).sort()).toEqual(['Kamera B', 'Produktion'])

    // Kalkulation: Kamera B mit einem Tag
    const v = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K' })).daten
    await sende(`/api/budget-versions/${v.id}/kosten-uebernehmen`, {})
    const zeilen = (await hole(`/api/budget-versions/${v.id}/lines`, tokenInhaber)).daten as any[]
    expect(zeilen.find((x) => x.source_key === `crew:${kamera2.id}`)).toMatchObject({ quantity: 1, total_cents: 30_000 })
    expect(zeilen.find((x) => x.source_key === `crew:${kameraHaupt.id}`)).toMatchObject({ quantity: 3 })

    // Produktion steht auf der Dispo von Drehtag 1 und der von 2U Tag 1 - am selben Datum
    await sende(`/api/shoot-days/${h[0].id}/call-sheet`, {})
    const k = await radar(p)
    const doppelt = k.find((x) => x.message === 'Produktion steht am 01.04.2027 auf zwei Dispos')
    expect(doppelt).toMatchObject({ severity: 'error' })
    expect(k.some((x) => x.message.startsWith('Kamera'))).toBe(false)

    // Kopf der Dispo nennt die Unit
    const { buildTagesdispoHtml } = await import('../routes/pdf')
    const html = (await buildTagesdispoHtml(z.id))!.html
    expect(html).toContain('2. Unit')
    expect(html).toContain('2U Tag 1 von 1')
    // Die Crew auf dem Blatt ist die der Unit, nicht die der Haupteinheit
    expect(html).toContain('Kamera B')
    expect(html).not.toContain('Kamera A')
  })

  it('Unit löschen: die Haupteinheit nie, mit Tagen erst nach Rückfrage - die Tage wandern zur Haupteinheit', async () => {
    const { p, haupt, zweite, tag } = await neuesProjekt('Löschen C2')
    await tag('2027-05-01')
    await tag('2027-05-01', zweite.id)
    expect((await hole(`/api/units/${haupt.id}`, tokenInhaber, { method: 'DELETE' })).status).toBe(400)
    const rueckfrage = await hole(`/api/units/${zweite.id}`, tokenInhaber, { method: 'DELETE' })
    expect(rueckfrage.status).toBe(409)
    expect(rueckfrage.daten).toEqual({ tage: 1 })
    // Umbenennen zieht den Text der Tage mit
    expect((await sende(`/api/units/${zweite.id}`, { name: 'Second Unit' }, 'PUT')).daten).toMatchObject({ name: 'Second Unit', tage_anzahl: 1 })
    expect((await db.get('SELECT unit FROM shoot_days WHERE unit_id = ?', [zweite.id])).unit).toBe('Second Unit')
    expect((await hole(`/api/units/${zweite.id}?bestaetigt=1`, tokenInhaber, { method: 'DELETE' })).status).toBe(200)
    const tage = (await hole(`/api/projects/${p}/shoot-days`, tokenInhaber)).daten as any[]
    expect(tage.map((d) => [d.day_number, d.unit_id, d.unit])).toEqual([[1, haupt.id, 'Haupteinheit'], [2, haupt.id, 'Haupteinheit']])
  })
})

describe('Komparserie als Gruppen mit Anzahl, Satz und Abruf (AP C1)', () => {
  const sende = (pfad: string, koerper: any = {}, methode = 'POST') =>
    hole(pfad, tokenInhaber, { method: methode, body: JSON.stringify(koerper) })
  const heute = () => new Date().toISOString().slice(0, 10)

  it('Gruppe mit 40 Köpfen an zwei Tagen (40 und 12), 100 €: Kalkulation 5.200 €, Catering 12, Abruf 50 abgelehnt, Check-in 38 von 40', async () => {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Komparserie C1', nutzerId])).id
    const t1 = (await db.run('INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, ?)', [p, heute()])).id
    const t2 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 2, '2027-05-02')", [p])).id
    const gruppe = (await sende(`/api/projects/${p}/extras`, { name: 'Deicharbeiter', is_group: true, headcount: 40, fee_per_day: 10_000, agency: 'Komparsen Nord', tariff_group: 'Komparse' })).daten
    expect(gruppe).toMatchObject({ is_group: true, headcount: 40, fee_per_day: 10_000, agency: 'Komparsen Nord' })
    expect((await sende(`/api/projects/${p}/extras/${gruppe.id}/drehtage`, { drehtage: [{ tag: t1, anzahl: 50 }] }, 'PUT')).status).toBe(400)
    const abgerufen = (await sende(`/api/projects/${p}/extras/${gruppe.id}/drehtage`, { drehtage: [{ tag: t1, anzahl: 40 }, { tag: t2, anzahl: 12 }] }, 'PUT')).daten
    expect(abgerufen.abrufe.map((x: any) => [x.tag, x.anzahl])).toEqual([[t1, 40], [t2, 12]])
    // Weniger Köpfe als abgerufen: abgelehnt
    expect((await sende(`/api/projects/${p}/extras/${gruppe.id}`, { headcount: 30 }, 'PUT')).status).toBe(400)

    // Kalkulation: (40 + 12) Kopftage mal 100 €
    const k = (await sende(`/api/projects/${p}/budget-versions`, { name: 'K' })).daten
    await sende(`/api/budget-versions/${k.id}/kosten-uebernehmen`, {})
    const zeile = ((await hole(`/api/budget-versions/${k.id}/lines`, tokenInhaber)).daten as any[]).find((z) => z.source_key === `extra:${gruppe.id}`)
    expect(zeile).toMatchObject({ total_cents: 520_000, quantity: 52, unit: 'Kopftag', cost_group: 3 })

    // Verpflegung: Tag 2 zählt 12
    const catering = (await hole(`/api/shoot-days/${t2}/catering-list`, tokenInhaber)).daten
    expect(catering.entries.find((e: any) => e.person_type === 'extra')).toMatchObject({ anzahl: 12, gruppe: true })
    expect(Object.values(catering.summary).reduce((a: number, b: any) => a + Number(b), 0)).toBe(12)

    // Dispo von Tag 1: ein Eintrag mit 40 Köpfen; Check-in am Drehtag mit Zahl
    const dispo = (await hole(`/api/shoot-days/${t1}/call-sheet`, tokenInhaber)).daten
    const eintrag = dispo.entries.find((e: any) => e.person_type === 'extra')
    expect(eintrag).toMatchObject({ headcount: 40, gruppe: true, person_name: 'Deicharbeiter' })
    expect((await sende(`/api/call-sheet-entries/${eintrag.id}/checkin`, { checked_in: true, anzahl: 41 })).status).toBe(400)
    expect((await sende(`/api/call-sheet-entries/${eintrag.id}/checkin`, { checked_in: true, anzahl: 38 })).daten).toMatchObject({ checked_in: true, checked_in_count: 38 })
    const stand = (await hole(`/api/call-sheets/${dispo.id}/checkin-status`, tokenInhaber)).daten
    expect(stand.summary).toMatchObject({ total: 40, checked_in: 38 })

    // Für eine Gruppe gibt es keinen Vertrag
    expect((await sende(`/api/projects/${p}/vertraege`, { person_type: 'extra', person_id: gruppe.id, body: 'Vertrag' })).status).toBe(400)
  })

  it('zehn Namen auf einmal: zehn Personen; eine Gruppe mit Minderjährigen meldet sich im Jugendschutz', async () => {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Namen C1', nutzerId])).id
    const namen = ['Anna', 'Ben', ' ', 'Cem', 'Dana', 'Emil', 'Fiona', 'Gero', 'Hanna', 'Ilse', 'Jonas']
    const neu = await sende(`/api/projects/${p}/extras/mehrere`, { namen, agency: 'Komparsen Nord' })
    expect(neu.status).toBe(201)
    expect(neu.daten).toHaveLength(10)
    expect(neu.daten.every((e: any) => e.is_group === false && e.headcount === 1 && e.agency === 'Komparsen Nord')).toBe(true)
    // Eine Person zählt immer 1, auch wenn mehr geschickt wird
    const person = neu.daten[0]
    expect((await sende(`/api/projects/${p}/extras/${person.id}`, { headcount: 5 }, 'PUT')).daten.headcount).toBe(1)
    await sende(`/api/projects/${p}/extras`, { name: 'Schulklasse', is_group: true, headcount: 25, minors_included: true })
    const js = (await hole(`/api/projects/${p}/jugendschutz`, tokenInhaber)).daten
    expect(js.gruppen_mit_minderjaehrigen).toEqual([expect.objectContaining({ name: 'Schulklasse', headcount: 25 })])
    expect(js.ohne_geburtsdatum_liste.some((x: any) => x.name === 'Schulklasse')).toBe(false)
  })
})

describe('Stundenzettel: Freigabe in Stufen (AP E8)', () => {
  /** Konto mit Rolle im Projekt; mit Abteilung steht es mit seiner E-Mail im Stab. */
  async function konto(p: number, rolle: string, abteilung = '') {
    const mail = `e8-${rolle}-${abteilung || 'ohne'}-${p}@example.com`
    const id = (await db.run("INSERT INTO users (email, password_hash, name, role) VALUES (?, 'x', ?, 'user')", [mail, `${rolle} ${abteilung}`])).id
    await db.run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [p, id, rolle])
    if (abteilung) await db.run("INSERT INTO crew (project_id, name, department, email) VALUES (?, ?, ?, ?)", [p, `Leitung ${abteilung}`, abteilung, mail.toUpperCase()])
    const { signToken } = await import('../middleware/auth')
    return signToken({ id, email: mail, name: `${rolle} ${abteilung}`, role: 'user' })
  }

  /** Projekt mit Ida (Kamera), Tom (Licht) und Anna (Besetzung), je ein Zettel an Tag 1. */
  async function aufbau() {
    const p = (await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Freigabe E8', nutzerId])).id
    await db.run("INSERT INTO project_settings (project_id, default_call_time, default_wrap_time, state) VALUES (?, 420, 1140, 'NW')", [p])
    const ida = (await db.run("INSERT INTO crew (project_id, name, department, fee_per_day) VALUES (?, 'Ida', 'Kamera', 40000)", [p])).id
    const tom = (await db.run("INSERT INTO crew (project_id, name, department, fee_per_day) VALUES (?, 'Tom', 'Licht', 30000)", [p])).id
    const anna = (await db.run("INSERT INTO \"cast\" (project_id, actor_name, fee_per_day) VALUES (?, 'Anna', 80000)", [p])).id
    const tag1 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 1, '2026-11-16')", [p])).id
    const tag2 = (await db.run("INSERT INTO shoot_days (project_id, day_number, date) VALUES (?, 2, '2026-11-17')", [p])).id
    const zettel = async (art: string, person: number, tag = tag1) =>
      (await db.run("INSERT INTO timesheets (project_id, shoot_day_id, person_type, person_id, call_time, wrap_time, break_minutes, overtime_hours) VALUES (?, ?, ?, ?, 420, 1170, 45, 1.75)", [p, tag, art, person])).id
    return { p, ida, tom, anna, tag1, tag2, zIda: await zettel('crew', ida), zTom: await zettel('crew', tom), zAnna: await zettel('cast', anna), zettel }
  }
  const stand = (id: number, status: string, token: string) =>
    hole(`/api/timesheets/${id}/stand`, token, { method: 'POST', body: JSON.stringify({ status }) })
  const sammel = (p: number, koerper: any, token: string) =>
    hole(`/api/projects/${p}/timesheets/stand`, token, { method: 'POST', body: JSON.stringify(koerper) })

  it('die Abteilungsleitung prüft die eigene Abteilung, keine fremde, und gibt nicht frei', async () => {
    const a = await aufbau()
    const kamera = await konto(a.p, 'dept_head', 'Kamera')
    expect((await stand(a.zIda, 'geprueft', kamera)).status).toBe(200)
    expect((await stand(a.zTom, 'geprueft', kamera)).status).toBe(403)
    expect((await stand(a.zAnna, 'geprueft', kamera)).status).toBe(403)
    const frei = await stand(a.zIda, 'freigegeben', kamera)
    expect(frei.status).toBe(403)
    // Was die Seite anbietet, sagt der Server je Zeile
    const liste = (await hole(`/api/shoot-days/${a.tag1}/timesheets`, kamera)).daten as any[]
    const zeileIda = liste.find((z) => z.id === a.zIda)
    expect(zeileIda.status).toBe('geprueft')
    expect(zeileIda.staende).toEqual(['erfasst', 'geprueft'])
    expect(liste.find((z) => z.id === a.zTom).staende).toEqual(['erfasst'])
    // Regie prüft alle, gibt aber auch nicht frei
    const regie = await konto(a.p, 'director')
    expect((await stand(a.zTom, 'geprueft', regie)).status).toBe(200)
    expect((await stand(a.zTom, 'freigegeben', regie)).status).toBe(403)
  })

  it('nach der Freigabe ändert nur die Produktion, mit altem und neuem Wert im Protokoll', async () => {
    const a = await aufbau()
    const kamera = await konto(a.p, 'dept_head', 'Kamera')
    const frei = await stand(a.zIda, 'freigegeben', tokenInhaber)
    expect(frei.status).toBe(200)
    expect(frei.daten.status).toBe('freigegeben')
    expect(frei.daten.approved_by).toBe(nutzerId)
    expect(frei.daten.approved_at).toBeTruthy()
    // Die Abteilungsleitung ändert und löscht nicht mehr, und setzt nicht zurück
    expect((await hole(`/api/timesheets/${a.zIda}`, kamera, { method: 'PUT', body: JSON.stringify({ call_time: 450 }) })).status).toBe(403)
    expect((await hole(`/api/timesheets/${a.zIda}`, kamera, { method: 'DELETE' })).status).toBe(403)
    expect((await stand(a.zIda, 'erfasst', kamera)).status).toBe(403)
    // Die Produktion korrigiert: 200 und eine Zeile mit alt und neu
    const korrektur = await hole(`/api/timesheets/${a.zIda}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ call_time: 450 }) })
    expect(korrektur.status).toBe(200)
    expect(korrektur.daten.status).toBe('freigegeben')
    let zeile: any
    for (let i = 0; i < 20 && !zeile; i++) {
      zeile = await db.get("SELECT * FROM audit_log WHERE project_id = ? AND entity_id = ? AND action = 'nach Freigabe geändert'", [a.p, a.zIda])
      if (!zeile) await new Promise((r) => setTimeout(r, 50))
    }
    expect(zeile).toBeTruthy()
    expect(zeile.user_id).toBe(nutzerId)
    expect(JSON.parse(zeile.old_value)).toEqual({ Call: '07:00' })
    expect(JSON.parse(zeile.new_value)).toEqual({ Call: '07:30' })
    const { kurzfassung } = await import('../routes/audit')
    expect(kurzfassung(zeile)).toBe('Call: 07:00 → 07:30')
  })

  it('Sammelfreigabe eines Drehtags nennt die Zahl, die Abteilungsleitung trifft nur die eigene Abteilung', async () => {
    const a = await aufbau()
    const kamera = await konto(a.p, 'dept_head', 'Kamera')
    const pruefen = await sammel(a.p, { status: 'geprueft', shoot_day_id: a.tag1 }, kamera)
    expect(pruefen.status).toBe(200)
    expect(pruefen.daten).toMatchObject({ geaendert: 1, schon: 0, ohne_recht: 2 })
    expect((await sammel(a.p, { status: 'freigegeben', shoot_day_id: a.tag1 }, kamera)).status).toBe(403)
    const frei = await sammel(a.p, { status: 'freigegeben', shoot_day_id: a.tag1 }, tokenInhaber)
    expect(frei.daten).toMatchObject({ geaendert: 3, schon: 0, ohne_recht: 0 })
    expect((await sammel(a.p, { status: 'freigegeben', shoot_day_id: a.tag1 }, tokenInhaber)).daten).toMatchObject({ geaendert: 0, schon: 3 })
    // Eine Abteilung über alle Tage
    await a.zettel('crew', a.tom, a.tag2)
    const licht = await sammel(a.p, { status: 'abgerechnet', department: 'licht' }, tokenInhaber)
    expect(licht.daten).toMatchObject({ geaendert: 2 })
    expect((await sammel(a.p, { status: 'freigegeben' }, tokenInhaber)).status).toBe(400)
  })

  it('der Lohnexport nimmt nur freigegebene Zettel, die Zahl der offenen steht daneben', async () => {
    const a = await aufbau()
    const offen = await a.zettel('crew', a.ida, a.tag2)
    await stand(a.zIda, 'freigegeben', tokenInhaber)
    const staende = (await hole(`/api/projects/${a.p}/timesheets/staende`, tokenInhaber)).daten
    expect(staende).toMatchObject({ erfasst: 3, freigegeben: 1, nicht_freigegeben: 3 })
    const export_ = async () => {
      const text = await (await fetch(`${basis}/api/projects/${a.p}/payroll/export.csv`, { headers: { Authorization: `Bearer ${tokenInhaber}` } })).text()
      const [kopf, ...zeilen] = text.replace(/^\ufeff/, '').split(/\r?\n/)
      const spalten = kopf.split(';')
      return (name: string, spalte: string) => zeilen.find((z) => z.split(';')[1] === name)!.split(';')[spalten.indexOf(spalte)]
    }
    let wert = await export_()
    // Zwei Zettel von Ida mit je 1,75 Überstunden, nur der freigegebene zählt
    expect(wert('Ida', 'Überstunden')).toBe('1,75')
    // Anna hat keine Szene und keine Dispo: Ihr Drehtag kommt allein vom Zettel
    // und zählt erst nach der Freigabe (der Stab zählt ohne Dispo jeden Drehtag)
    expect(wert('Anna', 'Drehtage')).toBe('0')
    await stand(a.zAnna, 'freigegeben', tokenInhaber)
    wert = await export_()
    expect(wert('Anna', 'Drehtage')).toBe('1')
    expect(offen).toBeGreaterThan(0)
  })

  it('je Person: alle Tage einer Person mit Datum', async () => {
    const a = await aufbau()
    await a.zettel('crew', a.ida, a.tag2)
    const r = await hole(`/api/projects/${a.p}/timesheets?person_type=crew&person_id=${a.ida}`, tokenInhaber)
    expect(r.status).toBe(200)
    expect((r.daten as any[]).map((z) => String(z.date).slice(0, 10))).toEqual(['2026-11-16', '2026-11-17'])
    expect((r.daten as any[]).every((z) => z.person_name === 'Ida')).toBe(true)
    expect((await hole(`/api/projects/${a.p}/timesheets?person_type=x&person_id=1`, tokenInhaber)).status).toBe(400)
  })

  it('Fahrzeit zählt nur, wenn die Regel des Projekts es sagt', async () => {
    const a = await aufbau()
    const z = await hole(`/api/shoot-days/${a.tag2}/timesheets`, tokenInhaber, { method: 'POST',
      body: JSON.stringify({ person_type: 'crew', person_id: a.ida, call_time: 420, wrap_time: 1065, break_minutes: 45, travel_minutes: 60 }) })
    expect(z.status).toBe(201)
    // 07:00 bis 17:45 mit 45 Minuten Pause: 10 Stunden, die Fahrt zählt nicht
    expect(Number(z.daten.overtime_hours)).toBe(0)
    expect(z.daten.arbeitszeit_minuten).toBe(600)
    await db.run('UPDATE project_settings SET travel_counts = true WHERE project_id = ?', [a.p])
    const mit = await hole(`/api/timesheets/${z.daten.id}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ notes: 'mit Fahrt' }) })
    expect(Number(mit.daten.overtime_hours)).toBe(1)
    expect(mit.daten.arbeitszeit_minuten).toBe(660)
    expect((await hole(`/api/timesheets/${z.daten.id}`, tokenInhaber, { method: 'PUT', body: JSON.stringify({ travel_minutes: 2000 }) })).status).toBe(400)
    // Umschalten der Regel rechnet die gespeicherten Überstunden aller Zettel neu
    const { ueberstundenNeuRechnen } = await import('../lib/arbeitszeitProjekt')
    expect(await ueberstundenNeuRechnen(db, a.p, false)).toBe(1)
    expect(Number((await db.get('SELECT overtime_hours FROM timesheets WHERE id = ?', [z.daten.id])).overtime_hours)).toBe(0)
    expect(await ueberstundenNeuRechnen(db, a.p, false)).toBe(0)
  })
})
