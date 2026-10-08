/**
 * Großproduktion "Nordlicht" per Kommandozeile anlegen.
 *
 *   npm run seed:gross --workspace=server -- admin@beispiel.de
 *
 * Ohne E-Mail: für den ersten Admin. Teamkonten bekommen zufällige
 * Passwörter, die hier einmalig ausgegeben werden (oder SEED_TEAM_PASSWORD).
 */
import { initDatabase, db, pool } from '../db'
import { seedGrossproduktion } from '../db/grossproduktion'

async function main() {
  await initDatabase()
  const email = process.argv[2]
  const owner = email
    ? await db.get('SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)', [email])
    : await db.get("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
  if (!owner) throw new Error(email ? `Kein Konto mit ${email}` : 'Kein Admin-Konto gefunden')
  const t0 = Date.now()
  const r = await seedGrossproduktion(owner.id, { teamPasswort: process.env.SEED_TEAM_PASSWORD })
  console.log(`\nProjekt ${r.projectId} für ${owner.email} in ${((Date.now() - t0) / 1000).toFixed(1)} s angelegt.`)
  console.table(r.zahlen)
  console.log('Teamkonten:')
  console.table(r.team)
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
