#!/usr/bin/env node
// Aufruf: LASTTEST_PASSWORT=... BASE=https://... node scripts/lasttest.cjs <nutzer> <sekunden>
// Vorher Testdaten anlegen: npm run seed:last --workspace=server -- <nutzer>
// Lasttest: N virtuelle Nutzer, jeder mit eigener Großproduktion, klicken mit
// Bedenkzeit durch die Seiten; jede Seite feuert ihre API-Aufrufe parallel.
const BASE = process.env.BASE || 'http://localhost:3055'
const N = +(process.argv[2] || 50), DAUER = +(process.argv[3] || 60) * 1000
const DENK = (process.env.DENK || '1000-3000').split('-').map(Number)
const PW = process.env.LASTTEST_PASSWORT
const SEITEN = {
  dashboard: ['/projects/{P}', '/projects/{P}/stats', '/projects/{P}/conflicts'],
  drehplan: ['/projects/{P}', '/projects/{P}/shoot-days', '/projects/{P}/scenes', '/projects/{P}/conflicts'],
  dispo: ['/projects/{P}', '/shoot-days/{D}/call-sheet', '/projects/{P}/crew', '/projects/{P}/cast', '/projects/{P}/shoot-days'],
  drehbuch: ['/projects/{P}', '/projects/{P}/scenes', '/projects/{P}/locations', '/projects/{P}/characters'],
  stab: ['/projects/{P}', '/projects/{P}/crew'],
  besetzung: ['/projects/{P}', '/projects/{P}/characters', '/projects/{P}/cast', '/projects/{P}/scenes'],
  budget: ['/projects/{P}', '/projects/{P}/budget-versions', '/budget-versions/{B}/lines', '/projects/{P}/financing-versions', '/financing-versions/{F}/entries', '/projects/{P}/budget-alerts'],
  shotlist: ['/projects/{P}', '/projects/{P}/scenes', '/projects/{P}/shots', '/projects/{P}/shoot-days'],
  kostenstand: ['/projects/{P}', '/projects/{P}/kostenstand', '/projects/{P}/expenses', '/projects/{P}/budget-versions'],
  dood: ['/projects/{P}', '/projects/{P}/dood-report'],
}
const namen = Object.keys(SEITEN)
const lat = {}; let fehler = 0, anfragen = 0, seitenAufrufe = 0; const fehlerArten = {}
const rec = (k, ms) => ((lat[k] ||= []).push(ms))
let wiederholt = 0
async function holen(url, opt) {
  // wie der Client: bei 503 bis zu dreimal mit Retry-After wiederholen
  for (let v = 0; ; v++) {
    const r = await fetch(url, opt)
    if (r.status === 503 && v < 3) { wiederholt++; await r.arrayBuffer(); await new Promise(z => setTimeout(z, (+r.headers.get('retry-after') || 1) * 1000 * (1 + v) * (0.75 + Math.random() * 0.5))); continue }
    return r
  }
}
async function get(path, token) {
  const t = performance.now()
  try {
    const r = await holen(BASE + '/api' + path, { headers: { Authorization: 'Bearer ' + token, 'Accept-Encoding': 'gzip' } })
    await r.arrayBuffer(); anfragen++
    if (!r.ok) { fehler++; fehlerArten[r.status + ' ' + path.replace(/\d+/g, ':id')] = (fehlerArten[r.status + ' ' + path.replace(/\d+/g, ':id')] || 0) + 1 }
  } catch (e) { fehler++; fehlerArten[e.cause?.code || e.message] = (fehlerArten[e.cause?.code || e.message] || 0) + 1 }
  return performance.now() - t
}
async function nutzer(i, ende) {
  const t0 = performance.now(); const r = await holen(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `last${i}@cutsheet.test`, password: PW }) })
  const j = await r.json(); if (!r.ok) { console.error('login', i, j.error); return }
  const token = j.data.token; rec('LOGIN', performance.now() - t0)
  const projekte = await (await fetch(BASE + '/api/projects', { headers: { Authorization: 'Bearer ' + token } })).json()
  if (!projekte.data) { console.error('projects', i, projekte.error); return }
  const P = projekte.data.find(p => p.title.startsWith('Nordlicht')).id
  const D = (await (await fetch(BASE + `/api/projects/${P}/shoot-days`, { headers: { Authorization: 'Bearer ' + token } })).json()).data[5].id
  const B = (await (await fetch(BASE + `/api/projects/${P}/budget-versions`, { headers: { Authorization: 'Bearer ' + token } })).json()).data.find(v => v.status === 'Aktiv').id
  const F = (await (await fetch(BASE + `/api/projects/${P}/financing-versions`, { headers: { Authorization: 'Bearer ' + token } })).json()).data[0].id
  while (Date.now() < ende) {
    const s = namen[Math.floor(Math.random() * namen.length)]
    const t = performance.now()
    const ms = await Promise.all(SEITEN[s].map(p => get(p.replace('{P}', P).replace('{D}', D).replace('{B}', B).replace('{F}', F), token)))
    SEITEN[s].forEach((p, k) => rec(p.replace(/\{.\}/g, ':id'), ms[k]))
    rec('SEITE ' + s, performance.now() - t); seitenAufrufe++
    await new Promise(r => setTimeout(r, DENK[0] + Math.random() * (DENK[1] - DENK[0])))
  }
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
;(async () => {
  const start = Date.now(), ende = start + DAUER
  await Promise.all(Array.from({ length: N }, (_, i) => nutzer(i + 1, ende)))
  const sek = (Date.now() - start) / 1000
  console.log(`\n${N} Nutzer, ${sek.toFixed(0)} s: ${seitenAufrufe} Seitenaufrufe, ${anfragen} Anfragen (${(anfragen / sek).toFixed(0)}/s), Fehler: ${fehler}, 503-Wiederholungen: ${wiederholt}`)
  if (fehler) console.log('Fehlerarten:', fehlerArten)
  const rows = Object.entries(lat).map(([k, a]) => ({ endpunkt: k, n: a.length, p50: Math.round(q(a, .5)), p95: Math.round(q(a, .95)), p99: Math.round(q(a, .99)), max: Math.round(Math.max(...a)) }))
  rows.sort((a, b) => b.p95 - a.p95); console.table(rows)
})()
