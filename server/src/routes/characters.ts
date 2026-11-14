import { Router } from 'express'
import { db } from '../db'
import { besetzungNachziehen } from '../lib/dispo'
import { requireMember } from '../middleware/projectAuth'
import { loeschePersonenspuren } from '../lib/person'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/characters
router.get('/projects/:projectId/characters', async (req, res) => {
  const chars = await db.all('SELECT * FROM characters WHERE project_id = ? ORDER BY sort_order ASC, name ASC', [req.params.projectId])
  res.json({ data: chars, error: null })
})

// POST /api/projects/:projectId/characters
router.post('/projects/:projectId/characters', async (req, res) => {
  const { name = '', description = '', age_range = '', gender = '' } = req.body
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), 0) as m FROM characters WHERE project_id = ?', [req.params.projectId])
  const maxSort = (maxSortRow as any).m
  const result = await db.run('INSERT INTO characters (project_id, name, description, age_range, gender, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [req.params.projectId, name, description, age_range, gender, maxSort + 1])
  res.status(201).json({ data: await db.get('SELECT * FROM characters WHERE id = ?', [result.id]), error: null })
})

// PUT /api/characters/:id
router.put('/characters/:id', async (req, res) => {
  // Gemessen am 25.10.2026: Eine Figur, die es nicht gibt, ergab 200 ohne Daten.
  if (!(await db.get('SELECT id FROM characters WHERE id = ?', [req.params.id]))) {
    return res.status(404).json({ data: null, error: 'Figur nicht gefunden' })
  }
  const { name, description, age_range, gender, sort_order } = req.body
  await db.run('UPDATE characters SET name=?, description=?, age_range=?, gender=?, sort_order=COALESCE(?,sort_order) WHERE id=?', [name, description, age_range, gender, sort_order ?? null, req.params.id])
  res.json({ data: await db.get('SELECT * FROM characters WHERE id = ?', [req.params.id]), error: null })
})

// DELETE /api/characters/:id
router.delete('/characters/:id', async (req, res) => {
  await db.run('DELETE FROM characters WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// GET /api/projects/:projectId/cast
router.get('/projects/:projectId/cast', async (req, res) => {
  const cast = await db.all(`
    SELECT c.*, ch.name as character_name
    FROM cast c
    LEFT JOIN characters ch ON c.character_id = ch.id
    WHERE c.project_id = ?
    ORDER BY ch.sort_order ASC, c.actor_name ASC
  `, [req.params.projectId])
  res.json({ data: cast, error: null })
})

// POST /api/projects/:projectId/cast
router.post('/projects/:projectId/cast', async (req, res) => {
  const { character_id = null, actor_name = '', email = '', phone = '', agent = '', agent_email = '', agency = '', fee_per_day = 0, contract_type = 'Tagesgage', availability_notes = '', notes = '' } = req.body
  // Die Besetzungsliste holt den Figurennamen per JOIN - eine Figur aus einem
  // fremden Projekt stünde sonst mit Namen in dieser Besetzung.
  if (character_id) {
    const figur = await db.get('SELECT id FROM characters WHERE id = ? AND project_id = ?', [character_id, req.params.projectId])
    if (!figur) return res.status(404).json({ data: null, error: 'Figur nicht gefunden' })
  }
  const result = await db.run(`
    INSERT INTO cast (project_id, character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.projectId, character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes])

  // Die Rolle hat Drehtage: Der Darsteller kommt in deren Dispos (lib/dispo.ts)
  if (character_id) await besetzungNachziehen(db, { rolle: Number(character_id) })
  const row = await db.get('SELECT c.*, ch.name as character_name FROM cast c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?', [result.id])
  res.status(201).json({ data: row, error: null })
})

// PUT /api/cast/:id
router.put('/cast/:id', async (req, res) => {
  // Wie bei der Figur: vorher 200 ohne Daten.
  if (!(await db.get('SELECT id FROM "cast" WHERE id = ?', [req.params.id]))) {
    return res.status(404).json({ data: null, error: 'Darsteller nicht gefunden' })
  }
  const { character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes } = req.body
  // Haltetage und Drop (DOOD, seit 13.11.2026). Nicht geschickt heißt: bleibt,
  // wie es ist - eine ältere Seite oder ein Regie-Konto (die Haltegage kommt
  // dort durch den Gagenschutz als null an) löscht beim Speichern nichts.
  const { hold_allowed, hold_fee_per_day, drop_allowed, drop_min_days } = req.body
  if (drop_min_days !== undefined && drop_min_days !== null
      && !(Number.isInteger(drop_min_days) && drop_min_days >= 0 && drop_min_days <= 366)) {
    return res.status(400).json({ data: null, error: 'Die Mindestzahl für einen Drop liegt zwischen 0 und 366 Tagen.' })
  }
  if (hold_fee_per_day !== undefined && hold_fee_per_day !== null
      && !(Number.isInteger(hold_fee_per_day) && hold_fee_per_day >= 0)) {
    return res.status(400).json({ data: null, error: 'Die Haltegage ist ein Betrag in ganzen Cent ab 0.' })
  }
  if (drop_allowed === true) {
    const jetzt = await db.get('SELECT hold_allowed, drop_min_days FROM "cast" WHERE id = ?', [req.params.id]) as any
    const halt = hold_allowed ?? jetzt.hold_allowed
    const tage = drop_min_days ?? jetzt.drop_min_days
    if (!halt) return res.status(400).json({ data: null, error: 'Drop und Pickup gibt es nur, wenn Haltetage gezählt werden.' })
    if (!(Number(tage) > 0)) return res.status(400).json({ data: null, error: 'Für Drop und Pickup fehlt die Mindestzahl an Kalendertagen.' })
  }
  // Nur eine Figur aus dem Projekt dieses Besetzungseintrags
  if (character_id) {
    const figur = await db.get(
      'SELECT ch.id FROM characters ch JOIN "cast" c ON c.project_id = ch.project_id WHERE ch.id = ? AND c.id = ?',
      [character_id, req.params.id]
    )
    if (!figur) return res.status(404).json({ data: null, error: 'Figur nicht gefunden' })
  }
  await db.run(`
    UPDATE cast SET character_id=?, actor_name=?, email=?, phone=?, agent=?, agent_email=?, agency=?, fee_per_day=COALESCE(?, fee_per_day), contract_type=?, availability_notes=?, notes=?,
      hold_allowed=COALESCE(?, hold_allowed), hold_fee_per_day=COALESCE(?, hold_fee_per_day),
      drop_allowed=COALESCE(?, drop_allowed), drop_min_days=COALESCE(?, drop_min_days)
    WHERE id=?
  `, [character_id, actor_name, email, phone, agent, agent_email, agency, fee_per_day, contract_type, availability_notes, notes,
      typeof hold_allowed === 'boolean' ? hold_allowed : null, hold_fee_per_day ?? null,
      typeof drop_allowed === 'boolean' ? drop_allowed : null, drop_min_days ?? null, req.params.id])
  // Haltetage ausgeschaltet: Drop hat ohne sie keinen Sinn und bleibt nicht stehen
  if (hold_allowed === false) await db.run('UPDATE "cast" SET drop_allowed = false WHERE id = ?', [req.params.id])
  if (character_id) await besetzungNachziehen(db, { rolle: Number(character_id) })
  const row = await db.get('SELECT c.*, ch.name as character_name FROM cast c LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.id = ?', [req.params.id])
  res.json({ data: row, error: null })
})

// DELETE /api/cast/:id
router.delete('/cast/:id', async (req, res) => {
  await loeschePersonenspuren('cast', req.params.id)
  await db.run('DELETE FROM cast WHERE id = ?', [req.params.id])
  res.json({ data: { ok: true }, error: null })
})

export default router
