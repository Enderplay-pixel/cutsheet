/**
 * Die Firmenlogik gegen eine echte PostgreSQL-Instanz und über echte Routen.
 *
 * Die wichtigste Zusage dieses Teils steht nicht im Code, sondern hier:
 * **Die Zugehörigkeit zu einer Firma öffnet kein fremdes Projekt.** Sie öffnet
 * die Stammdaten der Firma - Adressbuch, Gagensätze - und sonst nichts. Der
 * Test unten weist das nach, statt es zu behaupten.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'http'
import path from 'path'
import os from 'os'
import fs from 'fs'

const PORT = 55441
const datenverzeichnis = path.join(os.tmpdir(), `cutsheet-firmatest-${process.pid}`)

let postgres: any
let db: any
let server: http.Server
let basis = ''
let tokenInhaber = ''
let tokenFremd = ''
let nutzerId = 0
let fremdeId = 0
let projektId = 0

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

  process.env.DATABASE_URL = `postgresql://cutsheet:cutsheet@localhost:${PORT}/cutsheet`
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-geheimnis-fuer-den-firmentest-0123456789'

  const modul = await import('../db')
  db = modul.db
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
  const projekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Firmenprojekt', nutzerId])
  projektId = projekt.id

  const { signToken } = await import('../middleware/auth')
  const { default: companiesRouter } = await import('../routes/companies')
  const app = express()
  app.use(express.json())
  app.use('/api', companiesRouter)
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
  server?.close()
  try {
    const modul = await import('../db')
    await modul.pool.end()
  } catch { /* schon zu */ }
  try { await postgres?.stop() } catch { /* egal */ }
  try { fs.rmSync(datenverzeichnis, { recursive: true, force: true }) } catch { /* egal */ }
})

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
