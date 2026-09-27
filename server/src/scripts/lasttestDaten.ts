/**
 * Lasttest-Daten: N Nutzer mit je einer Großproduktion.
 *
 *   npm run seed:last --workspace=server -- 150
 *
 * Nur für Test- und Staging-Datenbanken gedacht. Nutzer heißen
 * last<N>@cutsheet.test, Passwort aus LASTTEST_PASSWORT (Pflicht).
 */
import { initDatabase, db, pool } from '../db'
import { seedGrossproduktion } from '../db/grossproduktion'

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.LASTTEST_ERLAUBT !== '1') {
    throw new Error('In der Produktion nur mit LASTTEST_ERLAUBT=1')
  }
  const passwort = process.env.LASTTEST_PASSWORT
  if (!passwort || passwort.length < 12) throw new Error('LASTTEST_PASSWORT (mind. 12 Zeichen) setzen')
  const anzahl = Number(process.argv[2] || 50)
  await initDatabase()
  const bcrypt = await import('bcryptjs')
  const hash = await bcrypt.hash(passwort, 10)
  const t0 = Date.now()
  for (let i = 1; i <= anzahl; i++) {
    const email = `last${i}@cutsheet.test`
    let u = await db.get('SELECT id FROM users WHERE email = ?', [email]) as any
    if (!u) u = await db.run('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)', [email, hash, `Lasttest ${i}`, 'user'])
    await seedGrossproduktion(u.id, { teamPasswort: passwort })
    if (i % 10 === 0) console.log(`${i}/${anzahl} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  }
  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
