import { Router } from 'express'
import { db } from '../db'
import { besetzungNachziehen } from '../lib/dispo'
import { requireMember } from '../middleware/projectAuth'
import { baueUeberschrift, leseUeberschrift } from '../lib/szenenUeberschrift'
import { motivVerknuepfen } from '../lib/motive'

const router = Router()

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// GET /api/projects/:projectId/scenes
router.get('/projects/:projectId/scenes', async (req, res) => {
  const scenes = await db.all(`
    SELECT s.*, l.name as location_name
    FROM scenes s
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE s.project_id = ?
    ORDER BY s.sort_order ASC, s.scene_number ASC
  `, [req.params.projectId])

  // Zwei Abfragen fuer alle Szenen statt zwei je Szene.
  //
  // Gemessen am 26.09.2026 an einem Langfilm mit 300 Szenen: der alte Weg
  // stellte 601 Abfragen. Lokal faellt das kaum auf (Datenbank im selben
  // Prozessraum), auf Render liegt die Datenbank auf einem anderen Rechner -
  // dort kostet jede Abfrage eine Netzrunde, und aus Millisekunden wird eine
  // Sekunde Wartezeit auf der meistgenutzten Seite.
  const ids = (scenes as any[]).map(s => s.id)
  const figuren = ids.length ? await db.all(`
    SELECT sc.*, c.name as character_name
    FROM scene_characters sc
    JOIN characters c ON sc.character_id = c.id
    WHERE sc.scene_id = ANY(?)
  `, [ids]) : []
  const inventar = ids.length
    ? await db.all('SELECT * FROM scene_inventory WHERE scene_id = ANY(?)', [ids])
    : []

  const figurenJeSzene = new Map<number, any[]>()
  for (const f of figuren as any[]) {
    const liste = figurenJeSzene.get(Number(f.scene_id)) ?? []
    liste.push(f)
    figurenJeSzene.set(Number(f.scene_id), liste)
  }
  const inventarJeSzene = new Map<number, any[]>()
  for (const i of inventar as any[]) {
    const liste = inventarJeSzene.get(Number(i.scene_id)) ?? []
    liste.push(i)
    inventarJeSzene.set(Number(i.scene_id), liste)
  }

  const scenesWithDetails = (scenes as any[]).map(scene => ({
    ...scene,
    characters: figurenJeSzene.get(Number(scene.id)) ?? [],
    inventory: inventarJeSzene.get(Number(scene.id)) ?? [],
  }))

  res.json({ data: scenesWithDetails, error: null })
})

// POST /api/projects/:projectId/scenes
router.post('/projects/:projectId/scenes', async (req, res) => {
  const { scene_number = '', title = '', description = '', location_id = null, int_ext = 'INT', day_night = 'TAG', eighths = 8, estimated_minutes = 60, notes = '' } = req.body
  // Die Szenenliste holt den Motivnamen per JOIN - ein Motiv aus einem
  // fremden Projekt stünde sonst mit Namen in diesem Drehbuch.
  if (location_id) {
    const motiv = await db.get('SELECT id FROM locations WHERE id = ? AND project_id = ?', [location_id, req.params.projectId])
    if (!motiv) return res.status(404).json({ data: null, error: 'Motiv nicht gefunden' })
  }
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?', [req.params.projectId])
  const maxSort = (maxSortRow as any).m

  // Ohne Nummer vergibt der Server die nächste freie. Beide Oberflächen
  // zählten bisher die Szenen und addierten eins. Gemessen am 24.10.2026:
  // Nach dem Löschen einer Szene bekam die neue die Nummer einer
  // bestehenden - zweimal Szene 9 im Drehbuch, im Drehplan, auf der Dispo.
  let nummer = String(scene_number ?? '').trim()
  if (!nummer) {
    const vorhandene = await db.all(
      'SELECT scene_number FROM scenes WHERE project_id = ?', [req.params.projectId]
    ) as any[]
    // "12A" zählt als 12: Die nächste ganze Szene kommt nach den Einschüben.
    const hoechste = vorhandene.reduce(
      (m, z) => Math.max(m, parseInt(String(z.scene_number ?? ''), 10) || 0), 0
    )
    nummer = String(hoechste + 1)
  }

  const result = await db.run(`
    INSERT INTO scenes (project_id, scene_number, sort_order, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.projectId, nummer, maxSort + 1, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes])

  const scene = await db.get('SELECT *, null as location_name FROM scenes WHERE id = ?', [result.id]) as any

  // Der erste Block ist die Überschrift, nicht ein leerer Aktionsblock.
  // Vorher galt eine frische Szene als "hat Blöcke" und fiel damit aus der
  // Ergänzung im Export heraus: Sie stand ohne INT/EXT, ohne Titel und ohne
  // Tageszeit im Drehbuch. Gemessen am 24.10.2026.
  const kopf = await db.run(
    `INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content)
     VALUES (?, ?, 0, 'scene_heading', ?)`,
    [result.id, req.params.projectId, baueUeberschrift(scene)]
  )
  const kopfBlock = await db.get('SELECT * FROM screenplay_blocks WHERE id = ?', [kopf.id])

  // Der Drehbuch-Editor setzt den Block sofort, ohne zweite Runde zum Server.
  res.status(201).json({
    data: { ...scene as object, characters: [], inventory: [], blocks: [kopfBlock] },
    error: null,
  })
})

// PUT /api/scenes/:id
router.put('/scenes/:id', async (req, res) => {
  const { scene_number, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes, sort_order, shot_status, updated_at } = req.body

  // Gemessen am 25.10.2026: Eine Szene, die es nicht gibt, ergab 200 ohne Daten.
  if (!(await db.get('SELECT id FROM scenes WHERE id = ?', [req.params.id]))) {
    return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  }

  // Nur ein Motiv aus dem Projekt der Szene
  if (location_id) {
    const motiv = await db.get(
      'SELECT l.id FROM locations l JOIN scenes s ON s.project_id = l.project_id WHERE l.id = ? AND s.id = ?',
      [location_id, req.params.id]
    )
    if (!motiv) return res.status(404).json({ data: null, error: 'Motiv nicht gefunden' })
  }

  // Optimistisches Sperren. Ohne das ueberschreibt der zweite Speichervorgang
  // den ersten stillschweigend: nachgemessen am 23.09.2026 - A aenderte den
  // Titel, B die Notizen auf altem Stand, danach war A's Titel weg und niemand
  // hat es gemerkt. Wer kein updated_at mitschickt, wird nicht geprueft, damit
  // Aufrufe ohne Vorlesen weiter funktionieren.
  if (updated_at) {
    const stand = await db.get('SELECT updated_at FROM scenes WHERE id = ?', [req.params.id]) as any
    if (!stand) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
    const gespeichert = new Date(stand.updated_at).getTime()
    const mitgebracht = new Date(updated_at).getTime()
    // Eine Sekunde Spielraum: manche Treiber runden Zeitstempel.
    if (Number.isFinite(gespeichert) && Number.isFinite(mitgebracht)
        && gespeichert - mitgebracht > 1000) {
      return res.status(409).json({
        data: null,
        error: 'Diese Szene wurde inzwischen von jemand anderem geändert. Bitte neu laden.',
      })
    }
  }

  await db.run(`
    UPDATE scenes SET scene_number=?, title=?, description=?, location_id=?, int_ext=?, day_night=?, eighths=?, estimated_minutes=?, notes=?, sort_order=COALESCE(?,sort_order), shot_status=COALESCE(?,shot_status), updated_at=datetime('now')
    WHERE id=?
  `, [scene_number, title, description, location_id, int_ext, day_night, eighths, estimated_minutes, notes, sort_order ?? null, shot_status ?? null, req.params.id])

  const scene = await db.get(`
    SELECT s.*, l.name as location_name FROM scenes s LEFT JOIN locations l ON s.location_id = l.id WHERE s.id = ?
  `, [req.params.id]) as any

  // Wer hier Innen/Außen, Titel oder Tageszeit ändert, ändert damit die
  // Szenenüberschrift - sonst steht im exportierten Drehbuch weiter die alte
  // Zeile. Angefasst wird nur eine Überschrift im Standardformat; eine von
  // Hand geschriebene Zeile, die sich nicht lesen lässt, bleibt stehen.
  const kopfBlock = await db.get(
    `SELECT id, content FROM screenplay_blocks
      WHERE scene_id = ? AND block_type = 'scene_heading'
      ORDER BY sort_order ASC LIMIT 1`,
    [req.params.id]
  ) as any
  if (kopfBlock) {
    const neu = baueUeberschrift(scene)
    const lesbar = String(kopfBlock.content ?? '').trim() === ''
      || leseUeberschrift(kopfBlock.content || '') !== null
    if (lesbar && kopfBlock.content !== neu) {
      await db.run(
        'UPDATE screenplay_blocks SET content = ?, updated_at = NOW() WHERE id = ?',
        [neu, kopfBlock.id]
      ).catch((e: any) => console.warn('[scenes PUT] Ueberschrift nicht nachgefuehrt:', e?.message))
    }
  }
  const characters = await db.all(`SELECT sc.*, c.name as character_name FROM scene_characters sc JOIN characters c ON sc.character_id = c.id WHERE sc.scene_id = ?`, [req.params.id])
  const inventory = await db.all('SELECT * FROM scene_inventory WHERE scene_id = ?', [req.params.id])
  res.json({ data: { ...scene as object, characters, inventory }, error: null })
})

// DELETE /api/scenes/:id
router.delete('/scenes/:id', async (req, res) => {
  // Die Tagesberichte fuehren abgedrehte Szenen als JSON-Liste von Kennungen,
  // nicht als Fremdschluessel - die Datenbank raeumt sie also nicht mit weg.
  // Gemessen am 26.09.2026: eine geloeschte Szene blieb in der Liste stehen,
  // bekam in der Zeitanalyse weiter einen Anteil der Tagesdrehzeit zugeteilt,
  // und dieser Anteil verschwand aus der Summe - der Tag wirkte kuerzer, als
  // er war.
  const szene = await db.get('SELECT shoot_day_id FROM shoot_day_scenes WHERE scene_id = ?', [req.params.id]) as any
  await db.run('DELETE FROM scenes WHERE id = ?', [req.params.id])
  if (szene?.shoot_day_id) {
    const bericht = await db.get(
      'SELECT id, scenes_completed, scenes_partial FROM daily_reports WHERE shoot_day_id = ?',
      [szene.shoot_day_id]
    ) as any
    if (bericht) {
      const ohne = (roh: unknown) => {
        try {
          const liste = JSON.parse(String(roh ?? '[]'))
          return JSON.stringify(Array.isArray(liste)
            ? liste.filter((x: unknown) => Number(x) !== Number(req.params.id))
            : [])
        } catch { return '[]' }
      }
      await db.run(
        'UPDATE daily_reports SET scenes_completed = ?, scenes_partial = ? WHERE id = ?',
        [ohne(bericht.scenes_completed), ohne(bericht.scenes_partial), bericht.id]
      )
    }
  }
  res.json({ data: { ok: true }, error: null })
})

// POST /api/scenes/:id/characters
router.post('/scenes/:id/characters', async (req, res) => {
  const { character_id, role_in_scene = '' } = req.body
  // Die Antwort und die Szenenliste holen den Figurennamen per JOIN dazu
  const figur = await db.get(
    'SELECT ch.id FROM characters ch JOIN scenes s ON s.project_id = ch.project_id WHERE ch.id = ? AND s.id = ?',
    [character_id, req.params.id]
  )
  if (!figur) return res.status(404).json({ data: null, error: 'Figur nicht gefunden' })
  await db.run('INSERT INTO scene_characters (scene_id, character_id, role_in_scene) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [req.params.id, character_id, role_in_scene])
  // Wer die Rolle spielt, kommt in die Dispos der Tage dieser Szene (lib/dispo.ts)
  await besetzungNachziehen(db, { szene: Number(req.params.id) })
  const chars = await db.all(`SELECT sc.*, c.name as character_name FROM scene_characters sc JOIN characters c ON sc.character_id = c.id WHERE sc.scene_id = ?`, [req.params.id])
  res.json({ data: chars, error: null })
})

// DELETE /api/scenes/:id/characters/:characterId
router.delete('/scenes/:id/characters/:characterId', async (req, res) => {
  await db.run('DELETE FROM scene_characters WHERE scene_id = ? AND character_id = ?', [req.params.id, req.params.characterId])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/scenes/:id/inventory
router.post('/scenes/:id/inventory', async (req, res) => {
  const { item, category = 'Requisite', quantity = 1, notes = '' } = req.body
  const result = await db.run('INSERT INTO scene_inventory (scene_id, item, category, quantity, notes) VALUES (?, ?, ?, ?, ?)', [req.params.id, item, category, quantity, notes])
  const row = await db.get('SELECT * FROM scene_inventory WHERE id = ?', [result.id])
  res.status(201).json({ data: row, error: null })
})

// DELETE /api/scenes/:id/inventory/:itemId
router.delete('/scenes/:id/inventory/:itemId', async (req, res) => {
  await db.run('DELETE FROM scene_inventory WHERE id = ? AND scene_id = ?', [req.params.itemId, req.params.id])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/projects/:projectId/scenes/import
router.post('/projects/:projectId/scenes/import', async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ data: null, error: 'Kein Text angegeben' })

  const lines = (text as string).split('\n').filter((l: string) => l.trim())
  const sceneRegex = /^(\d+[A-Z]?)\s+(INT|EXT|INT\/EXT)[\s.]+(.+?)\s+(TAG|NACHT|DÄMMERUNG|MORGEN)/i

  const created: any[] = []
  const maxSortRow = await db.get('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?', [req.params.projectId])
  const maxSort = (maxSortRow as any).m

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(sceneRegex)
    if (match) {
      const [, num, intExt, titelRoh, dayNight] = match
      // Ohne den Trenner vor der Tageszeit: Aus "41 INT. HAFEN - NACHT"
      // wurde vorher der Titel "HAFEN -" (gemessen am 26.10.2026).
      const title = titelRoh.replace(/[\s\-–—]+$/, '').trim()
      const result = await db.run(`
        INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [req.params.projectId, num, maxSort + 1 + i, title, intExt.toUpperCase(), dayNight.toUpperCase()])
      // Der Spielort wird Motiv des Projekts (lib/motive.ts)
      await motivVerknuepfen(db, Number(req.params.projectId), result.id, title)
      created.push(await db.get('SELECT * FROM scenes WHERE id = ?', [result.id]))
    }
  }

  res.json({ data: created, error: null })
})

export default router
