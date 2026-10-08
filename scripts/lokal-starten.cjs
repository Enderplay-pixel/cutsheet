#!/usr/bin/env node
/**
 * Startet CutSheet lokal mit eigener Datenbank.
 *
 * Ohne Postgres auf dem Rechner lässt sich die Anwendung nicht bedienen, und
 * ohne Bedienung lässt sich nicht prüfen, ob eine neue Seite wirklich tut, was
 * sie soll. Dieses Skript nimmt die PostgreSQL-Instanz, die ohnehin für die
 * Tests im Projekt liegt, hängt den Server daran und startet den Client.
 *
 *   node scripts/lokal-starten.cjs
 *
 * Danach: Client auf http://localhost:5173, Server auf 3001.
 * Beenden mit Strg+C - die Datenbank wird mit heruntergefahren.
 *
 * Die Daten liegen in .lokale-datenbank/ und überleben einen Neustart. Wer
 * frisch anfangen will, löscht den Ordner.
 */
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const WURZEL = path.join(__dirname, '..')
const DATEN = path.join(WURZEL, '.lokale-datenbank')
const PORT_DB = 55432
const URL_DB = `postgresql://cutsheet:cutsheet@localhost:${PORT_DB}/cutsheet`

async function main() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres')
  const frisch = !fs.existsSync(DATEN)

  const postgres = new EmbeddedPostgres({
    databaseDir: DATEN,
    user: 'cutsheet',
    password: 'cutsheet',
    port: PORT_DB,
    persistent: true,
  })

  if (frisch) {
    console.log('[lokal] Datenbank wird zum ersten Mal eingerichtet …')
    await postgres.initialise()
  }
  await postgres.start()
  if (frisch) {
    await postgres.createDatabase('cutsheet')
    console.log('[lokal] Datenbank "cutsheet" angelegt')
  }
  console.log(`[lokal] PostgreSQL läuft auf Port ${PORT_DB}`)

  const umgebung = {
    ...process.env,
    DATABASE_URL: URL_DB,
    NODE_ENV: 'development',
    PORT: '3001',
    JWT_SECRET: process.env.JWT_SECRET || 'lokales-geheimnis-nur-fuer-die-entwicklung',
    APP_BASE_URL: 'http://localhost:5173',
  }

  const kinder = []
  const starte = (name, befehl, argumente) => {
    const kind = spawn(befehl, argumente, {
      cwd: WURZEL,
      env: umgebung,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    kind.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`))
    kind.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`))
    kinder.push(kind)
    return kind
  }

  starte('server', 'npm', ['run', 'dev', '--workspace=cutsheet-server'])
  starte('client', 'npm', ['run', 'dev', '--workspace=client'])

  const beenden = async () => {
    console.log('\n[lokal] wird beendet …')
    for (const kind of kinder) {
      try { kind.kill() } catch { /* war schon weg */ }
    }
    try { await postgres.stop() } catch { /* ebenso */ }
    process.exit(0)
  }
  process.on('SIGINT', beenden)
  process.on('SIGTERM', beenden)
}

main().catch((fehler) => {
  console.error('[lokal] Start fehlgeschlagen:', fehler?.message || fehler)
  process.exit(1)
})
