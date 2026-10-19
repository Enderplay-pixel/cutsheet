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
 *
 * Jeder Pfadparameter bekommt eine echte ID der Inhaberin: Abschnitt → Tabelle
 * aus dem Schema (plus Ausnahmenliste), fehlt eine Zeile, wird eine angelegt.
 * Was sich nicht auflösen lässt, steht unter NICHT GETROFFEN.
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


  // Fremdes Projekt in die fremde Firma: Tabellen mit company_id und project_id
  // (z. B. Vertragsvorlagen) bekommen so auch auf der fremden Seite echte Zeilen.
  await db.run('UPDATE projects SET company_id = ? WHERE id = ?', [fremdeFirma.id, fremdesProjekt.id])

  // ─── Schema: Spalten, Fremdschlüssel, CHECK-Literale ──────────────────────
  type Spalte = { name: string; pflicht: boolean; typ: string }
  const spalten = new Map<string, Spalte[]>()
  for (const z of (await db.all(
    `SELECT table_name, column_name, is_nullable, column_default, data_type FROM information_schema.columns
      WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`
  )) as any[]) {
    if (!spalten.has(z.table_name)) spalten.set(z.table_name, [])
    spalten.get(z.table_name)!.push({ name: z.column_name, pflicht: z.is_nullable === 'NO' && z.column_default == null, typ: z.data_type })
  }
  const fks = new Map<string, Array<{ spalte: string; ziel: string }>>()
  for (const z of (await db.all(
    `SELECT tc.table_name, kcu.column_name, ccu.table_name AS ziel
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
  )) as any[]) {
    if (!fks.has(z.table_name)) fks.set(z.table_name, [])
    fks.get(z.table_name)!.push({ spalte: z.column_name, ziel: z.ziel })
  }
  const checks = (await db.all(
    `SELECT replace(conrelid::regclass::text, '"', '') AS tabelle, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE contype = 'c'`
  )) as Array<{ tabelle: string; def: string }>
  const q = (name: string) => `"${name}"`

  type Eigner = { name: string; p: number; f: number; user: number }
  const INH: Eigner = { name: 'Inhaberin', p, f, user: inhaberin.id }
  const FRE: Eigner = { name: 'Fremde', p: fremdesProjekt.id, f: fremdeFirma.id, user: fremde.id }

  // Wann gehört eine Zeile einem Eigner? Direkt über project_id/company_id,
  // sonst über die Fremdschlüssel-Kette (z. B. call_sheet_entries → call_sheets → shoot_days).
  function bedingung(t: string, o: Eigner, tiefe = 0): string | null {
    if (t === 'projects') return `id = ${o.p}`
    if (t === 'companies') return `id = ${o.f}`
    const namen = new Set((spalten.get(t) ?? []).map((s) => s.name))
    const teile: string[] = []
    if (namen.has('project_id')) teile.push(`project_id = ${o.p}`)
    if (namen.has('company_id')) teile.push(`company_id = ${o.f}`)
    if (teile.length === 0 && tiefe < 3) {
      for (const fk of fks.get(t) ?? []) {
        if (fk.ziel === 'users' || fk.ziel === t) continue
        const b = bedingung(fk.ziel, o, tiefe + 1)
        if (b) teile.push(`${q(fk.spalte)} IN (SELECT id FROM ${q(fk.ziel)} WHERE ${b})`)
      }
    }
    return teile.length ? `(${teile.join(' OR ')})` : null
  }

  function platzhalter(t: string, s: Spalte): unknown {
    const typ = s.typ.toLowerCase()
    if (/int|numeric|real|double/.test(typ)) return 1
    if (typ === 'boolean') return false
    if (typ === 'date') return gestern
    if (typ.startsWith('timestamp')) return new Date().toISOString()
    if (typ.startsWith('time')) return '08:00'
    if (typ.startsWith('json')) return '{}'
    if (typ === 'bytea') return Buffer.from('SCAN')
    if (typ === 'array') return '{}'
    // Textspalte mit CHECK (... IN ('a', 'b')): das erste erlaubte Literal
    const c = checks.find((k) => k.tabelle === t && new RegExp(`\\b${s.name}\\b`).test(k.def) && /'[^']*'/.test(k.def))
    return c ? c.def.match(/'([^']*)'/)![1] : 'SCAN'
  }

  // Eine Zeile je Tabelle und Eigner, nötigenfalls angelegt. Fehlschläge werden gemeldet, nicht abgebrochen.
  const fehlgeschlagen = new Set<string>()
  const cache = new Map<string, number | null>()
  let inhaberinAngelegt = 0
  async function besitzId(t: string, o: Eigner, tiefe = 0): Promise<number | null> {
    const schluessel = `${o.name}:${t}`
    if (cache.has(schluessel)) return cache.get(schluessel)!
    const b = bedingung(t, o)
    if (!b || !(spalten.get(t) ?? []).some((s) => s.name === 'id')) { cache.set(schluessel, null); return null }
    const z = (await db.get(`SELECT MIN(id) AS id FROM ${q(t)} WHERE ${b}`).catch(() => null)) as any
    let id: number | null = z?.id ?? null
    if (id == null && tiefe < 4) id = await minimalzeile(t, o, tiefe)
    cache.set(schluessel, id)
    return id
  }
  async function minimalzeile(t: string, o: Eigner, tiefe: number): Promise<number | null> {
    if (fehlgeschlagen.has(`${o.name}:${t}`)) return null
    const namen: string[] = []
    const werte: unknown[] = []
    for (const s of spalten.get(t) ?? []) {
      if (s.name === 'id') continue
      const fk = (fks.get(t) ?? []).find((x) => x.spalte === s.name)
      let wert: unknown
      if (s.name === 'project_id') wert = o.p
      else if (s.name === 'company_id') wert = o.f
      else if (fk?.ziel === 'users') wert = s.pflicht ? o.user : undefined
      else if (fk && fk.ziel !== t && bedingung(fk.ziel, o)) wert = await besitzId(fk.ziel, o, tiefe + 1)
      else if (fk && s.pflicht) wert = ((await db.get(`SELECT MIN(id) AS id FROM ${q(fk.ziel)}`).catch(() => null)) as any)?.id
      else if (s.pflicht) wert = platzhalter(t, s)
      if (wert !== undefined && wert !== null) { namen.push(q(s.name)); werte.push(wert) }
    }
    try {
      const z = (await db.get(
        `INSERT INTO ${q(t)} (${namen.join(', ')}) VALUES (${werte.map(() => '?').join(', ')}) RETURNING id`, werte
      )) as any
      if (o === INH) inhaberinAngelegt++
      return z?.id ?? null
    } catch (e: any) {
      fehlgeschlagen.add(`${o.name}:${t}`)
      console.warn(`ZEILE FEHLT: ${t} (${o.name}): ${e.message}`)
      return null
    }
  }

  // ─── Pfadabschnitt → Tabelle ──────────────────────────────────────────────
  // Meist englisch-kebab und direkt aus dem Schema ableitbar. Nur was dort
  // nicht steht, kommt aus dieser Liste.
  const ausnahmen: Record<string, string> = {
    vfx: 'vfx_shots', vertragsvorlagen: 'contract_templates', reisen: 'trips', unterkuenfte: 'accommodations',
    abnahmen: 'reviews', fassungen: 'cuts', dateien: 'project_files', 'financing-versions': 'financing_plan_versions',
    quotes: 'invoices', angebote: 'invoices', contacts: 'company_contacts', agenturen: 'agencies', clients: 'company_clients',
    vertraege: 'contracts', 'casting-anfragen': 'casting_requests', videos: 'creator_videos', groups: 'email_groups',
    'casting-vorschlaege': 'casting_proposals', restore: 'drehplan_versions', papierkorb: 'deleted_items',
    blocks: 'screenplay_blocks', templates: 'email_templates', continuity: 'continuity_notes', events: 'project_events',
    moodboard: 'moodboard_items', anmerkungen: 'review_notes', tage: 'trip_days', tasks: 'project_tasks',
    'blackout-dates': 'cast_blackout_dates', sections: 'creator_script_sections',
  }
  const einzahl = (w: string) => w.replace(/ies$/, 'y').replace(/s$/, '')
  function tabelleFuer(teile: string[], i: number): string | null {
    const abschnitte = teile.slice(0, i).filter((t) => t && !t.startsWith(':'))
    const vor = teile[i - 1] && !teile[i - 1].startsWith(':') ? teile[i - 1] : null
    const eltern = abschnitte[abschnitte.length - (vor ? 2 : 1)]
    const kandidaten: string[] = []
    // Person hinter :art (ksk, jugendschutz): :art wird mit 'crew' gefüllt
    if (teile[i - 1]?.startsWith(':art')) kandidaten.push('crew')
    if (vor) {
      if (ausnahmen[vor]) kandidaten.push(ausnahmen[vor])
      const x = vor.replace(/-/g, '_')
      kandidaten.push(x, `${x}s`, `${x}es`)
      if (eltern) kandidaten.push(`${einzahl(eltern.replace(/-/g, '_'))}_${x}`)
    }
    // Parametername als letzter Hinweis: :sceneId → scenes
    const stamm = teile[i].slice(1).replace(/Id$/, '').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
    if (stamm && stamm !== 'id') kandidaten.push(stamm, `${stamm}s`)
    return kandidaten.find((k) => spalten.has(k)) ?? null
  }

  // Setzt jeden Parameter: Projekt/Firma (und ohne Projekt im Pfad die erste
  // Kind-ID) vom Eigner "kopf", alle weiteren Kind-IDs vom Eigner "rest".
  // Nicht auflösbare Parameter bekommen '1' und stehen in "fehlend".
  async function fuelle(roh: string, kopf: Eigner, rest: Eigner) {
    const teile = roh.split('/')
    const fehlend: string[] = []
    const mitKopf = /:projectId|:companyId|:pid/.test(roh) || /^\/(projects|companies)\/:id/.test(roh)
    let ersteKind = !mitKopf
    const aufgeloest: Array<{ tabelle: string; id: number; eigner: Eigner }> = []
    const aus: string[] = []
    for (let i = 0; i < teile.length; i++) {
      const t = teile[i]
      if (!t.startsWith(':')) { aus.push(t); continue }
      if (t === ':projectId' || t === ':pid' || (t === ':id' && teile[i - 1] === 'projects')) { aus.push(String(kopf.p)); continue }
      if (t === ':companyId' || (t === ':id' && teile[i - 1] === 'companies')) { aus.push(String(kopf.f)); continue }
      if (t.startsWith(':art')) { aus.push(t.replace(/:art/, 'crew')); continue }
      const o = ersteKind ? kopf : rest
      ersteKind = false
      const tabelle = tabelleFuer(teile, i)
      let id: number | null = null
      if (tabelle) {
        // Gehört die Tabelle an eine vorher aufgelöste (z. B. Eintrag an Dispo), eine passende Zeile nehmen
        for (const a of aufgeloest) {
          if (a.eigner !== o) continue
          const fk = (fks.get(tabelle) ?? []).find((x) => x.ziel === a.tabelle)
          const b = bedingung(tabelle, o)
          if (!fk || !b) continue
          const z = (await db.get(`SELECT MIN(id) AS id FROM ${q(tabelle)} WHERE ${b} AND ${q(fk.spalte)} = ${a.id}`).catch(() => null)) as any
          if (z?.id) id = z.id
        }
        if (id == null) id = await besitzId(tabelle, o)
      }
      if (id == null) { fehlend.push(`${t}${tabelle ? ` (${tabelle}: keine Zeile)` : ' (keine Tabelle)'}`); aus.push('1'); continue }
      aufgeloest.push({ tabelle: tabelle!, id, eigner: o })
      aus.push(String(id))
    }
    return { pfad: aus.join('/'), fehlend }
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

  const nichtGetroffen: string[] = []
  let getroffenGet = 0
  let getroffenSchreibend = 0

  async function hole(pfad: string, token: string) {
    // Umleitungen nicht folgen: Der YouTube-Rücksprung leitet auf die App um,
    // und mit laufendem Vite-Server sah dessen index.html wie ein Leck aus.
    const r = await fetch(`${basis}/api${pfad}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'manual' }).catch(() => null)
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
    const { pfad: eigen, fehlend } = await fuelle(roh, INH, INH)
    if (fehlend.length) nichtGetroffen.push(`GET ${roh}  ${fehlend.join(', ')}`)
    else getroffenGet++
    const a = await hole(eigen, tokI)
    if (a.status !== 200 || a.laenge === 0) { ungemessen.push(`${a.status} ${roh}`); continue }
    const b = await hole(eigen, tokF)
    if (b.status === 200 && b.laenge > 0 && !harmlos.has(roh)) lecks.push(`FREMD LIEST     ${roh}  (${b.laenge})`)
    if (roh.includes(':projectId') || roh.includes(':companyId')) {
      const { pfad: quer } = await fuelle(roh, FRE, INH)
      if (quer !== eigen && /:[A-Za-z]+/.test(roh.replace(/:projectId|:companyId|:pid|:art/g, ''))) {
        const c = await hole(quer, tokF)
        if (c.status === 200 && c.laenge > 0) lecks.push(`QUER ÜBER EIGENES  ${roh}  (${c.laenge})`)
      }
    }
  }

  // ─── Schreibend ───────────────────────────────────────────────────────────
  // Ein Leck zeigt sich hier nicht am Status allein: Ob die Daten der
  // Inhaberin sich geändert haben, sagt der Fingerabdruck ihrer Zeilen - in
  // jeder Tabelle, die ihr direkt oder über die Fremdschlüssel-Kette gehört.
  const eigeneTabellen = [...spalten.keys()]
    .filter((t) => !['audit_log', 'email_outbox', 'email_log'].includes(t))
    .map((t) => ({ tabelle: t, b: bedingung(t, INH) }))
    .filter((x): x is { tabelle: string; b: string } => x.b !== null)
  async function fingerabdruck(): Promise<Map<string, string>> {
    const m = new Map<string, string>()
    for (const { tabelle, b } of eigeneTabellen) {
      const z = (await db.get(
        `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS h FROM ${q(tabelle)} t WHERE ${b}`
      ).catch(() => null)) as any
      m.set(tabelle, z?.h ?? '')
    }
    return m
  }
  const unterschied = (a: Map<string, string>, b: Map<string, string>) =>
    [...a].filter(([k, v]) => b.get(k) !== v).map(([k]) => k)

  // Textfelder mit Kennung: Ein erlaubtes PUT ändert sonst nichts Sichtbares.
  // "entries" trägt eine Eintrags-ID der Inhaberin (PUT /call-sheets/:id/entries).
  async function koerper() {
    const eintrag = await besitzId('call_sheet_entries', INH)
    return JSON.stringify({
      name: 'SCAN', title: 'SCAN', label: 'SCAN', notes: 'SCAN', description: 'SCAN',
      subject: 'SCAN', body: 'SCAN', text: 'SCAN', comment: 'SCAN', content: 'SCAN',
      entries: eintrag ? [{ id: eintrag, call_time: 333, pickup_location: 'SCAN', notes: 'SCAN' }] : [],
    })
  }
  async function schicke(methode: string, pfad: string, token: string) {
    const r = await fetch(`${basis}/api${pfad}`, {
      method: methode,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: methode === 'DELETE' ? undefined : await koerper(),
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

  // Löschen zuletzt, Projekt und Firma ganz zuletzt: ein gelungenes DELETE
  // nähme den folgenden PUTs sonst die Zeile, an der sie sich zeigen.
  const rang = (e: string) => (/^DELETE \/(projects|companies)\/:(id|projectId|companyId)$/.test(e) ? 2 : e.startsWith('DELETE') ? 1 : 0)
  const harmlosSchreibend = new Set(['POST /companies', 'POST /projects/'])
  const schreibLecks: string[] = []
  let geprueft = 0
  const verdeckt: string[] = []
  let vorher = await fingerabdruck()
  let stand = inhaberinAngelegt
  for (const eintrag of [...schreibRouten].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))) {
    const [methode, roh] = eintrag.split(' ')
    if (roh.includes(':token') || roh.startsWith('/auth') || roh.startsWith('/admin')) continue
    if (/push|ai-|optimize|email\/send|email\/test/.test(roh)) continue
    const fremd = await fuelle(roh, INH, INH)
    if (fremd.fehlend.length) nichtGetroffen.push(`${eintrag}  ${fremd.fehlend.join(', ')}`)
    else getroffenSchreibend++
    const ziele = [{ art: 'FREMD', pfad: fremd.pfad }]
    // Quer: Projekt, Firma oder erstes Objekt gehört der Fremden, alles dahinter (und im Körper) der Inhaberin
    const kinder = (roh.match(/:[A-Za-z]+/g) ?? []).filter((t) => !/^:(projectId|companyId|pid|art)/.test(t))
    if (kinder.length > 0) {
      ziele.push({ art: 'QUER', pfad: (await fuelle(roh, FRE, INH)).pfad })
    }
    // Neu angelegte Zeilen der Inhaberin sind keine Änderung durch die Fremde
    if (inhaberinAngelegt !== stand) { vorher = await fingerabdruck(); stand = inhaberinAngelegt }
    for (const ziel of ziele) {
      const status = await schicke(methode, ziel.pfad, tokF)
      geprueft++
      const nachher = await fingerabdruck()
      const geaendert = unterschied(vorher, nachher)
      if (geaendert.length > 0) {
        schreibLecks.push(`${ziel.art} ÄNDERT  ${methode} ${roh}  (${status}) ${geaendert.join(', ')}`)
        vorher = nachher
        // Gelöschtes neu besorgen: die nächsten Routen brauchen wieder echte Zeilen
        for (const k of [...cache.keys()]) if (k.startsWith('Inhaberin:')) cache.delete(k)
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

  // Ohne echte ID ist eine Route nicht gemessen, auch wenn sie nichts meldet
  const ngDatei = path.join(os.tmpdir(), 'cutsheet-scan-nicht-getroffen.txt')
  fs.writeFileSync(ngDatei, nichtGetroffen.join('\n'))
  const ngGet = nichtGetroffen.filter((l) => l.startsWith('GET ')).length
  console.log(`${getroffenGet} GET getroffen, ${ngGet} nicht getroffen; ${getroffenSchreibend} schreibend getroffen, ${nichtGetroffen.length - ngGet} nicht getroffen`)
  console.log(`NICHT GETROFFEN ${nichtGetroffen.length}  (${ngDatei})`)
  await pg.stop().catch(() => undefined)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
