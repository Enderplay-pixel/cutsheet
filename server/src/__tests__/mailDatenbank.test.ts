/**
 * Der Mailbetrieb gegen eine echte PostgreSQL-Instanz.
 *
 * Die übrigen Tests fälschen die Datenbank - schnell, aber blind für alles,
 * was erst Postgres entscheidet: `ON CONFLICT`, `::interval`, der Umgang mit
 * BYTEA, und ob `toPg` die Abfrage überhaupt heil lässt. Genau dort sind in
 * diesem Projekt schon zweimal Fehler erst in der Produktion aufgefallen.
 *
 * Darum startet dieser Test eine eigene Instanz, legt das echte Schema an und
 * lässt jede Mail-Abfrage einmal wirklich laufen.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

const PORT = 55439
const datenverzeichnis = path.join(os.tmpdir(), `cutsheet-mailtest-${process.pid}`)

let postgres: any
let db: any
let initDatabase: any
let mailversand: typeof import('../lib/mailversand')
let aufbewahrung: typeof import('../lib/mailaufbewahrung')
let projektId: number
let nutzerId: number

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
  await postgres.createDatabase('cutsheet')

  // Muss vor dem Import stehen: der Pool entsteht beim Laden des Moduls.
  process.env.DATABASE_URL = `postgresql://cutsheet:cutsheet@localhost:${PORT}/cutsheet`
  process.env.NODE_ENV = 'test'

  const modul = await import('../db')
  db = modul.db
  initDatabase = modul.initDatabase
  mailversand = await import('../lib/mailversand')
  aufbewahrung = await import('../lib/mailaufbewahrung')

  await initDatabase()

  const nutzer = await db.run(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'user')",
    ['mailtest@example.com', 'x', 'Mail Test']
  )
  nutzerId = nutzer.id
  const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Mailprojekt', nutzerId])
  projektId = projekt.id
}, 180_000)

afterAll(async () => {
  // Erst den Pool schliessen, dann die Instanz anhalten - sonst meldet pg
  // abgerissene Verbindungen, und vitest zaehlt das als Fehler im Lauf.
  try { const modul = await import('../db'); await modul.pool.end() } catch { /* schon zu */ }
  try { await postgres?.stop() } catch { /* egal, der Ordner faellt gleich weg */ }
  try { fs.rmSync(datenverzeichnis, { recursive: true, force: true }) } catch { /* ebenso */ }
})

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
