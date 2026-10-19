/**
 * Zugriffsscan: Darf eine fremde Person lesen, was ihr nicht gehört?
 *
 *   npx ts-node --transpile-only src/scripts/zugriffsscan.ts
 *
 * Startet eine Wegwerf-PostgreSQL, den echten Server und legt eine
 * Großproduktion für eine Inhaberin an. Dann ruft jede GET-Route einmal die
 * Inhaberin und einmal eine fremde Person auf - einmal ohne eigenes Projekt,
 * einmal mit eigenem Projekt im Pfad und fremder Kind-ID dahinter.
 *
 * Gemeldet wird jede Route, die der Fremden 200 liefert, obwohl die Inhaberin
 * dort Daten bekommt. Eine Route, auf der schon die Inhaberin nichts bekommt,
 * ist nicht gemessen und steht getrennt da.
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

async function main() {
  const pgPort = await freierPort()
  const appPort = await freierPort()
  const verzeichnis = path.join(os.tmpdir(), `cutsheet-scan-${Date.now()}`)
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
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'scan-geheimnis-0123456789-0123456789-0123456789'
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

  const inhaberin = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES (?, 'x', 'Inhaberin', 'user')", ['inhaberin@scan.test'])
  const fremde = await db.run("INSERT INTO users (email, password_hash, name, role) VALUES (?, 'x', 'Fremde', 'user')", ['fremde@scan.test'])
  const seed = await seedGrossproduktion(inhaberin.id, { ohneTeam: true })
  const firma = await db.run('INSERT INTO companies (name, owner_id) VALUES (?, ?)', ['Firma der Inhaberin', inhaberin.id])
  await db.run('UPDATE projects SET company_id = ? WHERE id = ?', [firma.id, seed.projectId])
  const fremdesProjekt = await db.run('INSERT INTO projects (title, owner_id) VALUES (?, ?)', ['Projekt der Fremden', fremde.id])
  const fremdeFirma = await db.run('INSERT INTO companies (name, owner_id) VALUES (?, ?)', ['Firma der Fremden', fremde.id])

  // Die Großproduktion kennt die Oktober-Module nicht: je eine Zeile von Hand.
  // Ein fehlgeschlagener INSERT bricht den Scan nicht ab, er wird gemeldet.
  const zeile = async (sql: string, werte: unknown[]) =>
    db.run(sql, werte).catch((e: any) => { console.warn(`ZEILE FEHLT: ${e.message} - ${sql.slice(0, 60)}`); return { id: 0 } as any })
  const p = seed.projectId
  const f = firma.id
  const gestern = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const kunde = await zeile("INSERT INTO company_clients (company_id, name) VALUES (?, 'Kunde')", [f])
  const rechnung = await zeile("INSERT INTO invoices (company_id, project_id, client_id, number, status) VALUES (?, ?, ?, 'R-1', 'offen')", [f, p, kunde.id])
  await zeile("INSERT INTO invoices (company_id, project_id, client_id, kind) VALUES (?, ?, ?, 'angebot')", [f, p, kunde.id])
  await zeile("INSERT INTO invoice_payments (invoice_id, amount_cents, paid_on) VALUES (?, 100, ?)", [rechnung.id, gestern])
  await zeile("INSERT INTO company_contacts (company_id, name) VALUES (?, 'Kontakt')", [f])
  await zeile("INSERT INTO agencies (company_id, name) VALUES (?, 'Agentur')", [f])
  const darsteller = await db.get('SELECT MIN(id) AS id FROM "cast" WHERE project_id = ?', [p]) as any
  await zeile("INSERT INTO contracts (project_id, person_type, person_id, title) VALUES (?, 'cast', ?, 'Vertrag')", [p, darsteller?.id ?? 1])
  await zeile("INSERT INTO trips (project_id, person_name, from_date, to_date) VALUES (?, 'Reisende', ?, ?)", [p, gestern, gestern])
  await zeile("INSERT INTO accommodations (project_id, name) VALUES (?, 'Hotel')", [p])
  await zeile("INSERT INTO project_files (project_id, filename, content, bytes, valid_until, title) VALUES (?, 'genehmigung.pdf', ?, 4, ?, 'Drehgenehmigung')", [p, Buffer.from('test'), gestern])
  await zeile("INSERT INTO cuts (project_id, label) VALUES (?, 'Rohschnitt')", [p])
  const schnitt = await db.get('SELECT MIN(id) AS id FROM cuts WHERE project_id = ?', [p]) as any
  await zeile("INSERT INTO reviews (project_id, cut_id, recipient_name) VALUES (?, ?, 'Kundin')", [p, schnitt?.id ?? null])
  await zeile("INSERT INTO casting_requests (project_id, subject) VALUES (?, 'Anfrage')", [p])
  await zeile("INSERT INTO floorplans (project_id, name) VALUES (?, 'Grundriss')", [p])
  await zeile("INSERT INTO creator_videos (project_id, title) VALUES (?, 'Video')", [p])
  await zeile("INSERT INTO drehplan_versions (project_id, name) VALUES (?, 'Stand 1')", [p])

  // Kind-ID je Pfadabschnitt: kleinste Zeile, die der Inhaberin gehört
  const tabellen: Record<string, [string, 'project_id' | 'company_id']> = {
    'shoot-days': ['shoot_days', 'project_id'], scenes: ['scenes', 'project_id'], locations: ['locations', 'project_id'],
    'call-sheets': ['call_sheets', 'project_id'], 'budget-versions': ['budget_versions', 'project_id'],
    'equipment-lists': ['equipment_lists', 'project_id'], 'financing-versions': ['financing_plan_versions', 'project_id'],
    floorplans: ['floorplans', 'project_id'], invoices: ['invoices', 'company_id'], quotes: ['invoices', 'company_id'],
    contacts: ['company_contacts', 'company_id'], agenturen: ['agencies', 'company_id'], clients: ['company_clients', 'company_id'],
    vertraege: ['contracts', 'project_id'], reisen: ['trips', 'project_id'], unterkuenfte: ['accommodations', 'project_id'],
    dateien: ['project_files', 'project_id'], abnahmen: ['reviews', 'project_id'], 'casting-anfragen': ['casting_requests', 'project_id'],
    videos: ['creator_videos', 'project_id'], cast: ['"cast"', 'project_id'], crew: ['crew', 'project_id'],
    groups: ['email_groups', 'project_id'],
    'drehplan-versions': ['drehplan_versions', 'project_id'],
  }
  const idFuer: Record<string, string> = {}
  for (const [abschnitt, [tabelle, spalte]] of Object.entries(tabellen)) {
    const z = await db.get(`SELECT MIN(id) AS id FROM ${tabelle} WHERE ${spalte} = ?`, [spalte === 'project_id' ? p : f]).catch(() => null) as any
    if (z?.id) idFuer[abschnitt] = String(z.id)
  }

  const tokI = signToken({ id: inhaberin.id, email: 'inhaberin@scan.test', name: 'Inhaberin', role: 'user' })
  const tokF = signToken({ id: fremde.id, email: 'fremde@scan.test', name: 'Fremde', role: 'user' })

  // Alle GET-Routen aus allen Routern einsammeln
  const routenDir = path.join(__dirname, '..', 'routes')
  const routen = new Set<string>()
  const schreibRouten = new Set<string>()
  for (const datei of fs.readdirSync(routenDir).filter((d) => d.endsWith('.ts'))) {
    const modul = require(path.join(routenDir, datei))
    const router = modul.default
    if (!router?.stack) continue
    const praefix = datei === 'projects.ts' ? '/projects' : datei === 'admin.ts' ? '/admin' : datei === 'auth.ts' ? '/auth' : ''
    for (const schicht of router.stack) {
      if (typeof schicht.route?.path !== 'string') continue
      if (schicht.route.methods?.get) routen.add(praefix + schicht.route.path)
      for (const m of ['post', 'put', 'patch', 'delete']) {
        if (schicht.route.methods?.[m]) schreibRouten.add(`${m.toUpperCase()} ${praefix}${schicht.route.path}`)
      }
    }
  }

  // Für jede ID die kleinste Zeile im Projekt der Inhaberin - frische Datenbank, also meist 1
  const fuelle = (roh: string, projekt: number, firmaId: number) => {
    const teile = roh.split('/')
    return teile.map((t, i) => {
      if (!t.startsWith(':')) return t
      if (t === ':projectId' || t === ':pid') return String(projekt)
      if (t === ':companyId') return String(firmaId)
      if (t === ':id' && teile[i - 1] === 'projects') return String(projekt)
      if (t.startsWith(':art')) return t.replace(/:art/, 'crew')
      return idFuer[teile[i - 1]] ?? '1'
    }).join('/')
  }

  async function hole(pfad: string, token: string) {
    const r = await fetch(`${basis}/api${pfad}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
    if (!r) return { status: 0, laenge: 0 }
    const text = await r.text()
    let laenge = text.length
    try {
      const j = JSON.parse(text)
      const d = j?.data
      laenge = d == null ? 0 : Array.isArray(d) ? d.length : Object.keys(d).length
    } catch { /* CSV, PDF */ }
    return { status: r.status, laenge }
  }

  // Bewusst offen oder die eigene Liste der Fremden: kein Leck
  const harmlos = new Set(['/companies', '/projects/', '/push/vapid-public-key', '/import/:art/vorlage.csv'])

  const lecks: string[] = []
  const ungemessen: string[] = []
  for (const roh of [...routen].sort()) {
    if (roh.includes(':token') || roh.startsWith('/auth') || roh.startsWith('/admin')) continue
    if (/pdf|stream|sse|events/i.test(roh)) continue
    const eigen = fuelle(roh, seed.projectId, firma.id)
    const a = await hole(eigen, tokI)
    if (a.status !== 200 || a.laenge === 0) { ungemessen.push(`${a.status} ${roh}`); continue }
    const b = await hole(eigen, tokF)
    if (b.status === 200 && b.laenge > 0 && !harmlos.has(roh)) lecks.push(`FREMD LIEST     ${roh}  (${b.laenge})`)
    if (roh.includes(':projectId') || roh.includes(':companyId')) {
      const quer = fuelle(roh, fremdesProjekt.id, fremdeFirma.id)
      if (quer !== eigen && /:[A-Za-z]+/.test(roh.replace(/:projectId|:companyId|:pid|:art/g, ''))) {
        const c = await hole(quer, tokF)
        if (c.status === 200 && c.laenge > 0) lecks.push(`QUER ÜBER EIGENES  ${roh}  (${c.laenge})`)
      }
    }
  }

  // ─── Schreibend ───────────────────────────────────────────────────────────
  // Ein Leck zeigt sich hier nicht am Status allein: Ob die Daten der
  // Inhaberin sich geändert haben, sagt der Fingerabdruck ihrer Zeilen.
  // Kind-Tabellen ohne project_id/company_id sieht er nicht.
  const eigeneTabellen = (await db.all(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name IN ('project_id', 'company_id')
        AND table_name NOT IN ('audit_log', 'email_outbox', 'email_log')`
  )) as Array<{ table_name: string; column_name: string }>
  async function fingerabdruck(): Promise<Map<string, string>> {
    const m = new Map<string, string>()
    for (const { table_name, column_name } of eigeneTabellen) {
      const wert = column_name === 'project_id' ? p : f
      const z = (await db.get(
        `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS h FROM "${table_name}" t WHERE ${column_name} = ?`,
        [wert]
      ).catch(() => null)) as any
      m.set(`${table_name}.${column_name}`, z?.h ?? '')
    }
    return m
  }
  const unterschied = (a: Map<string, string>, b: Map<string, string>) =>
    [...a].filter(([k, v]) => b.get(k) !== v).map(([k]) => k)

  // Textfelder mit Kennung: Ein erlaubtes PUT ändert sonst nichts Sichtbares
  const koerper = JSON.stringify({
    name: 'SCAN', title: 'SCAN', label: 'SCAN', notes: 'SCAN', description: 'SCAN',
    subject: 'SCAN', body: 'SCAN', text: 'SCAN', comment: 'SCAN', content: 'SCAN',
  })
  async function schicke(methode: string, pfad: string, token: string) {
    const r = await fetch(`${basis}/api${pfad}`, {
      method: methode,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: methode === 'DELETE' ? undefined : koerper,
    }).catch(() => null)
    return r?.status ?? 0
  }

  // Gegenprobe: Sieht der Fingerabdruck eine erlaubte Änderung der Inhaberin
  // nicht, ist der ganze schreibende Teil blind und sein "0" nichts wert.
  const opfer = await db.run("INSERT INTO floorplans (project_id, name) VALUES (?, 'Gegenprobe')", [p])
  const probeVorher = await fingerabdruck()
  const probeStatus = await schicke('DELETE', `/floorplans/${opfer.id}`, tokI)
  const probe = unterschied(probeVorher, await fingerabdruck())
  console.log(`GEGENPROBE DELETE /floorplans/${opfer.id} als Inhaberin: ${probeStatus}, geändert: ${probe.join(', ') || 'NICHTS - MESSUNG BLIND'}`)

  const harmlosSchreibend = new Set(['POST /companies', 'POST /projects/'])
  const schreibLecks: string[] = []
  let geprueft = 0
  const verdeckt: string[] = []
  let vorher = await fingerabdruck()
  for (const eintrag of [...schreibRouten].sort()) {
    const [methode, roh] = eintrag.split(' ')
    if (roh.includes(':token') || roh.startsWith('/auth') || roh.startsWith('/admin')) continue
    if (/push|ai-|optimize|email\/send|email\/test/.test(roh)) continue
    const ziele = [{ art: 'FREMD', pfad: fuelle(roh, p, f) }]
    const mitKind = /:[A-Za-z]+/.test(roh.replace(/:projectId|:companyId|:pid|:art/g, ''))
    if (mitKind && /:projectId|:companyId|:pid/.test(roh)) {
      ziele.push({ art: 'QUER', pfad: fuelle(roh, fremdesProjekt.id, fremdeFirma.id) })
    }
    for (const ziel of ziele) {
      const status = await schicke(methode, ziel.pfad, tokF)
      geprueft++
      const nachher = await fingerabdruck()
      const geaendert = unterschied(vorher, nachher)
      if (geaendert.length > 0) {
        schreibLecks.push(`${ziel.art} ÄNDERT  ${methode} ${roh}  (${status}) ${geaendert.join(', ')}`)
        vorher = nachher
      } else if (ziel.art === 'QUER' && status === 400) {
        verdeckt.push(`${methode} ${roh}`)
      } else if (ziel.art === 'FREMD' && status >= 200 && status < 300 && !harmlosSchreibend.has(eintrag)) {
        schreibLecks.push(`FREMD ${status}  ${methode} ${roh}  (keine Änderung an Daten der Inhaberin gesehen)`)
      }
    }
  }
  console.log(`\n${schreibRouten.size} schreibende Routen, ${geprueft} Aufrufe, ${schreibLecks.length} Verdachtsfälle\n`)
  for (const l of schreibLecks) console.log(l)
  console.log(`VERDECKT ${verdeckt.length} Querzugriffe scheiterten an der Eingabeprüfung (400), bevor die Zugehörigkeit geprüft wurde`)
  fs.writeFileSync(path.join(os.tmpdir(), 'cutsheet-scan-verdeckt.txt'), verdeckt.join('\n'))

  console.log(`\n${routen.size} GET-Routen,${lecks.length} Verdachtsfälle, ${ungemessen.length} ungemessen\n`)
  for (const l of lecks) console.log(l)
  fs.writeFileSync(path.join(os.tmpdir(), 'cutsheet-scan-ungemessen.txt'), ungemessen.join('\n'))
  console.log(`\nUngemessen: ${path.join(os.tmpdir(), 'cutsheet-scan-ungemessen.txt')}`)
  await pg.stop().catch(() => undefined)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
