/**
 * PDF-Probe: Jedes Dokument einmal erzeugen und zum Ansehen ablegen.
 *
 *   npx ts-node --transpile-only src/scripts/pdfprobe.ts
 *
 * Startet eine Wegwerf-PostgreSQL und den echten Server, legt die
 * Großproduktion an und dazu über die echten Routen eine Rechnung, ein
 * Angebot, eine Mahnung, einen Vertrag und eine Abnahme - mit langen Texten,
 * Umlauten und krummen Beträgen, weil genau dort Dokumente brechen.
 *
 * Ergebnis: %TEMP%\cutsheet-pdfs\*.pdf und eine Zeile je Dokument mit Status,
 * Größe und Seitenzahl. Ansehen muss sie danach ein Mensch oder Claude.
 */
import path from 'path'
import os from 'os'
import fs from 'fs'
import net from 'net'

async function freierPort(): Promise<number> {
  return new Promise((ok, fail) => {
    const h = net.createServer()
    h.unref()
    h.on('error', fail)
    h.listen(0, '127.0.0.1', () => {
      const p = (h.address() as any).port
      h.close(() => ok(p))
    })
  })
}

const LANG = 'Die Produktion übernimmt die vollständige Organisation der Dreharbeiten einschließlich Motivsuche, ' +
  'Genehmigungen, Catering und Versicherung. Änderungen am Drehplan werden spätestens 48 Stunden vorher mitgeteilt; ' +
  'Mehraufwand durch kurzfristige Umplanungen wird nach tatsächlichem Aufwand abgerechnet. Größere Abweichungen ' +
  'vom Angebot (über 10 %) werden vorab schriftlich abgestimmt.'

async function main() {
  const pgPort = await freierPort()
  const appPort = await freierPort()
  const verzeichnis = path.join(os.tmpdir(), `cutsheet-pdfprobe-${Date.now()}`)
  // require statt import: unter der moduleResolution des Servers findet tsc die Typen nicht
  const EmbeddedPostgres = require('embedded-postgres').default
  const pg = new EmbeddedPostgres({ databaseDir: verzeichnis, user: 'cutsheet', password: 'cutsheet', port: pgPort, persistent: false })
  await pg.initialise()
  await pg.start()
  const { Client } = await import('pg')
  const v = new Client({ connectionString: `postgresql://cutsheet:cutsheet@localhost:${pgPort}/postgres` })
  await v.connect()
  await v.query(`CREATE DATABASE cutsheet WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`)
  await v.end()

  process.env.DATABASE_URL = `postgresql://cutsheet:cutsheet@localhost:${pgPort}/cutsheet`
  process.env.PORT = String(appPort)
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'probe-geheimnis-0123456789-0123456789-0123456789'
  process.env.NODE_ENV = 'development'

  require('../index')
  const basis = `http://127.0.0.1:${appPort}`
  for (let i = 0; i < 120; i++) {
    const r = await fetch(`${basis}/api/ready`).catch(() => null)
    if (r?.status === 200) break
    await new Promise((ok) => setTimeout(ok, 500))
  }

  const { db } = await import('../db')
  const { signToken } = await import('../middleware/auth')
  const { seedGrossproduktion } = await import('../db/grossproduktion')

  const inhaberin = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES (?, 'x', 'Jana Kühn', 'user')", ['jana@probe.test'])
  const seed = await seedGrossproduktion(inhaberin.id, { ohneTeam: true })
  const p = seed.projectId
  const firma = (await db.run(
    'INSERT INTO companies (name, owner_id) VALUES (?, ?)',
    ['RuhrCut Filmproduktion Müller & Söhne GmbH', inhaberin.id]
  )).id
  await db.run('UPDATE projects SET company_id = ? WHERE id = ?', [firma, p])
  const tok = signToken({ id: inhaberin.id, email: 'jana@probe.test', name: 'Jana Kühn', role: 'user' })

  async function api(methode: string, pfad: string, koerper?: unknown): Promise<any> {
    const r = await fetch(`${basis}/api${pfad}`, {
      method: methode,
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: koerper === undefined ? undefined : JSON.stringify(koerper),
    })
    const j: any = await r.json().catch(() => null)
    if (r.status >= 300) console.warn(`  ${methode} ${pfad} -> ${r.status} ${j?.error ?? ''}`)
    return j?.data
  }

  // ─── Geld ──────────────────────────────────────────────────────────────────
  const kunde = await api('POST', `/companies/${firma}/clients`, {
    name: 'Stadtwerke Gelsenkirchen-Bueraußen Öffentlichkeitsarbeit', contact_name: 'Dörte Weißgerber',
    address: 'Königsstraße 12', zip: '45879', city: 'Gelsenkirchen', is_business: true,
  })
  const positionen = [
    { description: 'Kamera inkl. Assistenz', quantity_milli: 2500, unit: 'Tag', unit_price_cents: 123456, tax_percent: 19 },
    { description: LANG, quantity_milli: 1000, unit: 'Pauschale', unit_price_cents: 99999, tax_percent: 19 },
    { description: 'Schnitt und Farbkorrektur (Überstunden)', quantity_milli: 7333, unit: 'Std.', unit_price_cents: 8500, tax_percent: 19 },
    { description: 'Fahrtkosten', quantity_milli: 312000, unit: 'km', unit_price_cents: 30, tax_percent: 19 },
    { description: 'Lizenz Musik (ermäßigt)', quantity_milli: 1000, unit: 'Stück', unit_price_cents: 1, tax_percent: 7 },
  ]
  const rechnung = await api('POST', `/companies/${firma}/invoices`, {
    client_id: kunde?.id, project_id: p, intro: LANG, outro: 'Vielen Dank für die gute Zusammenarbeit!',
  })
  await api('PUT', `/companies/${firma}/invoices/${rechnung?.id}/items`, { items: positionen })
  await api('POST', `/companies/${firma}/invoices/${rechnung?.id}/issue`, {})
  await api('POST', `/companies/${firma}/invoices/${rechnung?.id}/payments`, { amount_cents: 50000, paid_on: new Date().toISOString().slice(0, 10) })
  // Überfällig machen, damit eine Mahnung ansteht (das PDF ist die Vorschau der nächsten)
  await db.run("UPDATE invoices SET due_date = CURRENT_DATE - 45, issue_date = CURRENT_DATE - 60 WHERE id = ?", [rechnung?.id])

  const angebot = await api('POST', `/companies/${firma}/quotes`, { client_id: kunde?.id, project_id: p, intro: LANG })
  await api('PUT', `/companies/${firma}/quotes/${angebot?.id}/items`, { items: positionen })
  await api('POST', `/companies/${firma}/quotes/${angebot?.id}/issue`, {})

  // ─── Vertrag und Abnahme ───────────────────────────────────────────────────
  const darsteller = (await db.get('SELECT MIN(id) AS id FROM "cast" WHERE project_id = ?', [p])) as any
  const vertrag = await db.run(
    "INSERT INTO contracts (project_id, person_type, person_id, title, body) VALUES (?, 'cast', ?, ?, ?)",
    [p, darsteller?.id ?? 1, 'Darstellervertrag „Nordlicht" - Rolle Jördis', Array.from({ length: 14 }, (_, i) => `§ ${i + 1} ${LANG}`).join('\n\n')]
  )
  const schnitt = await db.run("INSERT INTO cuts (project_id, label, stage, version, duration_seconds) VALUES (?, 'Rohschnitt Größenwahn', 'rohschnitt', 2, 5432)", [p])
  const runde = await api('POST', `/projects/${p}/abnahmen`, {
    cut_id: schnitt.id, recipient_name: 'Dörte Weißgerber', recipient_email: 'doerte@probe.test', message: LANG,
  })
  for (let i = 0; i < 25; i++) {
    await db.run('INSERT INTO review_notes (review_id, at_seconds, body, author) VALUES (?, ?, ?, ?)',
      [runde?.id, i * 97, i % 3 === 0 ? LANG : `Anmerkung ${i + 1}: Farbe im Übergang prüfen`, 'Dörte'])
  }

  // ─── Abrufen ───────────────────────────────────────────────────────────────
  const tag = (await db.get('SELECT MIN(id) AS id FROM shoot_days WHERE project_id = ?', [p])) as any
  const version = (await db.get('SELECT MIN(id) AS id FROM budget_versions WHERE project_id = ?', [p])) as any
  const dokumente: Array<[string, string]> = [
    ['rechnung', `/companies/${firma}/invoices/${rechnung?.id}/pdf`],
    ['angebot', `/companies/${firma}/quotes/${angebot?.id}/pdf`],
    ['mahnung', `/companies/${firma}/invoices/${rechnung?.id}/mahnung.pdf`],
    ['vertrag', `/projects/${p}/vertraege/${vertrag.id}/pdf`],
    ['abnahmeprotokoll', `/projects/${p}/abnahmen/${runde?.id}/protokoll.pdf`],
    ['drehplan', `/projects/${p}/pdf/drehplan`],
    ['tagesdispo', `/shoot-days/${tag?.id}/pdf/tagesdispo`],
    ['tagesbericht', `/shoot-days/${tag?.id}/pdf/tagesbericht`],
    ['stabliste', `/projects/${p}/pdf/stabliste`],
    ['besetzungsliste', `/projects/${p}/pdf/besetzungsliste`],
    ['motivliste', `/projects/${p}/pdf/motivliste`],
    ['kalkulation', `/projects/${p}/pdf/kalkulation/${version?.id}`],
    ['shotlist', `/projects/${p}/pdf/shotlist`],
    ['equipment', `/projects/${p}/pdf/equipment`],
  ]
  const ziel = path.join(os.tmpdir(), 'cutsheet-pdfs')
  fs.mkdirSync(ziel, { recursive: true })
  console.log('')
  for (const [name, pfad] of dokumente) {
    const t0 = Date.now()
    const r = await fetch(`${basis}/api${pfad}`, { headers: { Authorization: `Bearer ${tok}` } })
    const puffer = Buffer.from(await r.arrayBuffer())
    const istPdf = puffer.subarray(0, 5).toString() === '%PDF-'
    const seiten = (puffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    if (istPdf) fs.writeFileSync(path.join(ziel, `${name}.pdf`), puffer)
    console.log(`PDF ${name.padEnd(17)} ${r.status} ${istPdf ? 'gültig' : 'KEIN PDF'} ${String(Math.round(puffer.length / 1024)).padStart(4)} KB ${seiten} S. ${Date.now() - t0} ms${istPdf ? '' : '  ' + puffer.toString('utf8').slice(0, 160)}`)
  }
  console.log(`\nAbgelegt in ${ziel}`)
  await pg.stop().catch(() => undefined)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
