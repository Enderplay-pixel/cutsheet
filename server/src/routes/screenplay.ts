import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import { leseUeberschrift, mitUeberschrift } from '../lib/szenenUeberschrift'
import { fountainZeilen } from '../lib/fountainExport'
import { figurVerknuepfen } from '../lib/figuren'

const router = Router()

// annotation_color legt db/index.ts an. Hier liefen bis zum 25.10.2026 dieselben
// ALTER TABLE noch einmal beim Laden des Moduls - ungeordnet neben initDatabase.

// All /projects/:projectId/* routes require membership
router.use('/projects/:projectId', requireMember)

// ─── Types ───────────────────────────────────────────────────────────────────

type BlockType = 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'note'

/**
 * Anmerkungsfarben sind #rrggbb - der Editor hängt für den Hintergrund zwei
 * Stellen Deckkraft an, und im PDF steht der Wert in einem style-Attribut.
 */
const istFarbe = (wert: unknown) => /^#[0-9a-f]{6}$/i.test(String(wert))
const FARBE_FEHLER = 'annotation_color ist eine Farbe (#rrggbb)'

// ─── GET /api/projects/:projectId/screenplay ──────────────────────────────────
// Returns all scenes with their blocks, ordered by sort_order
router.get('/projects/:projectId/screenplay', async (req, res) => {
  const { projectId } = req.params

  const scenes = await db.all(`
    SELECT s.*, l.name as location_name
    FROM scenes s
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE s.project_id = ?
    ORDER BY s.sort_order ASC, s.scene_number ASC
  `, [projectId])

  // Eine Abfrage fuer alle Bloecke statt eine je Szene - bei 300 Szenen sind
  // das 301 Netzrunden zur Datenbank gegen zwei.
  const ids = (scenes as any[]).map(s => s.id)
  const alleBloecke = ids.length ? await db.all(`
    SELECT * FROM screenplay_blocks
    WHERE scene_id = ANY(?)
    ORDER BY sort_order ASC
  `, [ids]) : []

  const bloeckeJeSzene = new Map<number, any[]>()
  for (const b of alleBloecke as any[]) {
    const liste = bloeckeJeSzene.get(Number(b.scene_id)) ?? []
    liste.push(b)
    bloeckeJeSzene.set(Number(b.scene_id), liste)
  }

  const result = (scenes as any[]).map(scene => ({
    scene,
    blocks: bloeckeJeSzene.get(Number(scene.id)) ?? [],
  }))

  res.json({ data: result, error: null })
})

// ─── GET /api/projects/:projectId/screenplay/export.fountain ─────────────────
// Drehbuch-Export im Fountain-Format (PreProducer-Parität: Export, nicht nur Import)
router.get('/projects/:projectId/screenplay/export.fountain', async (req, res) => {
  const project = await db.get('SELECT title, director FROM projects WHERE id = ?', [req.params.projectId]) as any
  if (!project) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })

  const scenes = await db.all(
    'SELECT * FROM scenes WHERE project_id = ? ORDER BY sort_order ASC, scene_number ASC',
    [req.params.projectId]
  ) as any[]

  const lines: string[] = [
    `Title: ${project.title}`,
    project.director ? `Author: ${project.director}` : '',
    `Draft date: ${new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}`,
    '',
  ].filter(l => l !== '')
  lines.push('')

  for (const scene of scenes) {
    const gespeichert = await db.all(
      'SELECT * FROM screenplay_blocks WHERE scene_id = ? ORDER BY sort_order ASC',
      [scene.id]
    ) as Array<{ block_type: BlockType; content: string }>

    // Fehlt die Überschrift, wird sie aus dem Datensatz ergänzt. Vorher fiel
    // jede Szene ohne Überschriftenblock kopflos aus dem Export - und einen
    // leeren Aktionsblock bekam bis zum 24.10.2026 jede neue Szene mit.
    const blocks = mitUeberschrift(scene, gespeichert)

    if (gespeichert.length === 0 && scene.description) {
      lines.push(blocks[0].content ?? '', '', scene.description, '')
      continue
    }

    for (const b of blocks) lines.push(...fountainZeilen(b))
  }

  const filename = `${(project.title || 'drehbuch').replace(/[^\w\säöüÄÖÜß-]/g, '').replace(/\s+/g, '-').toLowerCase()}.fountain`
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.send(lines.join('\n'))
})

// ─── GET /api/scenes/:sceneId/blocks ─────────────────────────────────────────
router.get('/scenes/:sceneId/blocks', requireMemberVia(projectIdFromTable('scenes', 'sceneId')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
  if (user.role !== 'admin') {
    const scene = await db.get('SELECT project_id FROM scenes WHERE id = ?', [req.params.sceneId]) as any
    if (!scene) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
    if ((await getUserProjectRole(user.id, scene.project_id)) === null)
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }
  const blocks = await db.all(`
    SELECT * FROM screenplay_blocks
    WHERE scene_id = ?
    ORDER BY sort_order ASC
  `, [req.params.sceneId])

  res.json({ data: blocks, error: null })
})

// ─── POST /api/scenes/:sceneId/blocks ────────────────────────────────────────
// Fehler gehen an den Übersetzer (middleware/eingabe.ts). Vorher ging die rohe
// Datenbankmeldung als 500 zurück, und jede Anlage schrieb zwei Debug-Zeilen
// ins Serverprotokoll.
router.post('/scenes/:sceneId/blocks', async (req, res) => {
  const { sceneId } = req.params
  const { block_type = 'action', content = '', sort_order = 0, annotation_color } = req.body
  if (annotation_color !== undefined && !istFarbe(annotation_color)) {
    return res.status(400).json({ data: null, error: FARBE_FEHLER })
  }

  // Get project_id from the scene
  const scene = await db.get('SELECT project_id FROM scenes WHERE id = ?', [sceneId]) as { project_id: number } | undefined
  if (!scene) {
    return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  }

  // sort_order is an INTEGER column, so fractional "insert between" values would
  // blow up in Postgres. Round up to the target slot and push the rest down.
  const requested = Number(sort_order)
  const targetSort = Math.max(0, Number.isFinite(requested) ? Math.ceil(requested) : 0)

  await db.run(`
    UPDATE screenplay_blocks SET sort_order = sort_order + 1
    WHERE scene_id = ? AND sort_order >= ?
  `, [sceneId, targetSort])

  const result = await db.run(`
    INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content)
    VALUES (?, ?, ?, ?, ?)
  `, [sceneId, scene.project_id, targetSort, block_type, content])

  if (annotation_color && annotation_color !== '#f59e0b') {
    await db.run(`UPDATE screenplay_blocks SET annotation_color = ? WHERE id = ?`, [annotation_color, result.id]).catch((e: any) => console.warn('[blocks POST] annotation_color update failed:', e?.message))
  }

  const block = await db.get('SELECT * FROM screenplay_blocks WHERE id = ?', [result.id])
  res.status(201).json({ data: block, error: null })
})

// ─── PUT /api/blocks/:blockId ─────────────────────────────────────────────────
router.put('/blocks/:blockId', async (req, res) => {
  const { blockId } = req.params
  const { content, sort_order, block_type, annotation_color } = req.body
  if (annotation_color !== undefined && annotation_color !== null && !istFarbe(annotation_color)) {
    return res.status(400).json({ data: null, error: FARBE_FEHLER })
  }

  const existing = await db.get('SELECT * FROM screenplay_blocks WHERE id = ?', [blockId]) as any
  if (!existing) {
    return res.status(404).json({ data: null, error: 'Block nicht gefunden' })
  }

  await db.run(`
    UPDATE screenplay_blocks
    SET
      content = COALESCE(?, content),
      sort_order = COALESCE(?, sort_order),
      block_type = COALESCE(?, block_type),
      annotation_color = COALESCE(?, annotation_color),
      updated_at = NOW()
    WHERE id = ?
  `, [
    content !== undefined ? content : null,
    sort_order !== undefined ? sort_order : null,
    block_type !== undefined ? block_type : null,
    annotation_color !== undefined ? annotation_color : null,
    blockId
  ])

  const block = await db.get('SELECT * FROM screenplay_blocks WHERE id = ?', [blockId]) as any

  // Die Überschrift ist der Ort, an dem beim Schreiben über Innen/Außen, Motiv
  // und Tageszeit entschieden wird. Bis zum 24.10.2026 blieb der Datensatz der
  // Szene dabei auf dem Gründungsstand stehen: Im Drehbuch stand "EXT. HAFEN -
  // NACHT", in Drehplan und Statistik weiter "INT / DAY". Deshalb folgt der
  // Datensatz jetzt der Zeile.
  let szene: any = null
  if (block?.block_type === 'scene_heading') {
    const kopf = leseUeberschrift(block.content || '')
    if (kopf && kopf.title) {
      await db.run(
        `UPDATE scenes SET int_ext = ?, title = ?,
           day_night = COALESCE(NULLIF(?, ''), day_night), updated_at = NOW()
         WHERE id = ?`,
        [kopf.int_ext, kopf.title, kopf.day_night, block.scene_id]
      ).catch((e: any) => console.warn('[blocks PUT] Szene nicht nachgefuehrt:', e?.message))
      // Mitschicken, damit der Editor seine Szenenleiste nachziehen kann -
      // sonst stand dort bis zum Neuladen weiter der alte Titel.
      szene = await db.get(
        'SELECT id, int_ext, title, day_night, updated_at FROM scenes WHERE id = ?',
        [block.scene_id]
      )
    }
  }

  // Eine fertig geschriebene Figur wird Rolle des Projekts und gehört zur
  // Szene (lib/figuren.ts). Erst auf `figur_fertig`: Der Editor speichert
  // beim Tippen alle 500 ms - sonst entstünden aus "JA" und "JAN" Rollen.
  // Der Editor schickt das Zeichen, wenn die Zeile verlassen wird.
  let figur: any = null
  if (req.body?.figur_fertig === true && block?.block_type === 'character') {
    figur = await figurVerknuepfen(db, Number(block.project_id), Number(block.scene_id), block.content)
  }

  res.json({ data: { ...block, ...(szene ? { szene } : {}), ...(figur ? { figur } : {}) }, error: null })
})

// ─── DELETE /api/blocks/:blockId ──────────────────────────────────────────────
router.delete('/blocks/:blockId', async (req, res) => {
  await db.run('DELETE FROM screenplay_blocks WHERE id = ?', [req.params.blockId])
  res.json({ data: { ok: true }, error: null })
})

// ─── PUT /api/scenes/:sceneId/blocks/reorder ─────────────────────────────────
router.put('/scenes/:sceneId/blocks/reorder', async (req, res) => {
  const { blocks } = req.body as { blocks: Array<{ id: number; sort_order: number }> }

  if (!Array.isArray(blocks)) {
    return res.status(400).json({ data: null, error: 'blocks muss ein Array sein' })
  }

  for (const b of blocks) {
    await db.run(`
      UPDATE screenplay_blocks SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND scene_id = ?
    `, [b.sort_order, b.id, req.params.sceneId])
  }

  res.json({ data: { ok: true }, error: null })
})

// ─── FDX/Celtx Parser ─────────────────────────────────────────────────────────

function parseFdxXml(xml: string): Array<{ type: BlockType; content: string }> {
  const blocks: Array<{ type: BlockType; content: string }> = []

  // Strip byte-order marks and normalize newlines
  const normalized = xml.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Map FDX paragraph types to our block types
  const typeMap: Record<string, BlockType> = {
    'Scene Heading': 'scene_heading',
    'Action': 'action',
    'Character': 'character',
    'Dialogue': 'dialogue',
    'Parenthetical': 'parenthetical',
    'Transition': 'transition',
    'General': 'action',
    'Note': 'note',
  }

  // Extract all text from Text elements within a Paragraph
  function extractText(paragraphXml: string): string {
    const textParts: string[] = []
    const textRegex = /<Text[^>]*>([\s\S]*?)<\/Text>/gi
    let textMatch: RegExpExecArray | null
    while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
      // Decode HTML entities
      const decoded = textMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      textParts.push(decoded)
    }
    return textParts.join('').trim()
  }

  // Try FDX format: <Paragraph Type="..."><Text>...</Text></Paragraph>
  const paragraphRegex = /<Paragraph\s[^>]*Type="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/gi
  let match: RegExpExecArray | null
  let foundFdx = false

  while ((match = paragraphRegex.exec(normalized)) !== null) {
    foundFdx = true
    const rawType = match[1]
    const paragraphContent = match[2]
    const blockType: BlockType = typeMap[rawType] || 'action'
    const content = extractText(paragraphContent)
    if (content) {
      blocks.push({ type: blockType, content })
    }
  }

  if (foundFdx) return blocks

  // Try Celtx format: <scene><sceneline>...</sceneline></scene>
  const celtxSceneRegex = /<scene[^>]*>([\s\S]*?)<\/scene>/gi
  let celtxMatch: RegExpExecArray | null
  let foundCeltx = false

  while ((celtxMatch = celtxSceneRegex.exec(normalized)) !== null) {
    foundCeltx = true
    const sceneContent = celtxMatch[1]

    // Extract scene heading from sceneline
    const scenelineMatch = sceneContent.match(/<sceneline[^>]*>([\s\S]*?)<\/sceneline>/i)
    if (scenelineMatch) {
      const headingText = scenelineMatch[1].replace(/<[^>]+>/g, '').trim()
      if (headingText) blocks.push({ type: 'scene_heading', content: headingText })
    }

    // Extract paragraphs inside scene
    const innerParaRegex = /<para[^>]*\s+element="([^"]*)"[^>]*>([\s\S]*?)<\/para>/gi
    let innerMatch: RegExpExecArray | null
    while ((innerMatch = innerParaRegex.exec(sceneContent)) !== null) {
      const elType = innerMatch[1].toLowerCase()
      const text = innerMatch[2].replace(/<[^>]+>/g, '').trim()
      if (!text) continue
      let blockType: BlockType = 'action'
      if (elType.includes('action') || elType.includes('slugline')) blockType = 'action'
      if (elType.includes('character')) blockType = 'character'
      if (elType.includes('dialog') || elType.includes('dialogue')) blockType = 'dialogue'
      if (elType.includes('parenthetical')) blockType = 'parenthetical'
      if (elType.includes('transition')) blockType = 'transition'
      if (elType.includes('note')) blockType = 'note'
      blocks.push({ type: blockType, content: text })
    }
  }

  if (foundCeltx) return blocks

  // Fallback: plain text / Fountain-like parsing
  return parsePlainText(normalized)
}

export function parsePlainText(text: string): Array<{ type: BlockType; content: string }> {
  const blocks: Array<{ type: BlockType; content: string }> = []
  let lines = text.split('\n')

  // Fountain-Titelblock ("Title: …", "Author: …") bis zur ersten Leerzeile.
  // Er gehört nicht ins Drehbuch - vorher wurde daraus eine Szene "Import".
  const erste = lines.findIndex((l) => l.trim() !== '')
  if (erste !== -1 && /^[A-Za-z][A-Za-z ]*:\s*\S/.test(lines[erste].trim()) && !/^(INT|EXT)\b/i.test(lines[erste].trim())) {
    const ende = lines.findIndex((l, i) => i > erste && l.trim() === '')
    lines = ende === -1 ? [] : lines.slice(ende + 1)
  }

  // Im Dialog ist, wer direkt (ohne Leerzeile) unter einer Rolle steht.
  // Vorher wurden Leerzeilen übersprungen, bevor der Typ feststand - so
  // wurde jeder Dialog zur Handlung.
  let imDialog = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      imDialog = false
      continue
    }

    let blockType: BlockType = 'action'

    if (/^(INT|EXT|INT\/EXT|I\/E)\b/i.test(line)) {
      blockType = 'scene_heading'
    } else if (/^(FADE|CUT|DISSOLVE|SMASH CUT|MATCH CUT)/i.test(line) || /\bTO:$/.test(line)) {
      blockType = 'transition'
    } else if (/^\(/.test(line)) {
      blockType = 'parenthetical'
    } else if (imDialog) {
      blockType = 'dialogue'
    } else if (line === line.toUpperCase() && line.length < 60 && /[A-ZÄÖÜ]/.test(line)) {
      blockType = 'character'
    }

    imDialog = blockType === 'character' || blockType === 'parenthetical' || blockType === 'dialogue'
    blocks.push({ type: blockType, content: line })
  }

  return blocks
}

function parseSceneHeading(heading: string): { int_ext: string; title: string; day_night: string } {
  const upper = heading.toUpperCase().trim()

  let int_ext = 'INT'
  if (/^EXT/.test(upper)) int_ext = 'EXT'
  else if (/^INT\/EXT/.test(upper) || /^I\/E/.test(upper)) int_ext = 'INT/EXT'

  let day_night = 'TAG'
  if (/\bNACHT\b|\bNIGHT\b/i.test(upper)) day_night = 'NACHT'
  else if (/\bDÄMMERUNG\b|\bDAWN\b|\bDUSK\b|\bGOLDEN HOUR\b/i.test(upper)) day_night = 'DÄMMERUNG'
  else if (/\bMORGEN\b|\bMORNING\b/i.test(upper)) day_night = 'MORGEN'

  // Extract location: "INT. LOCATION - DAY" → "LOCATION"
  let title = heading
    .replace(/^(INT\/EXT|INT|EXT|I\/E)[\s.]+/i, '')
    .replace(/\s*[-–]\s*(TAG|NACHT|DÄMMERUNG|MORGEN|DAY|NIGHT|DAWN|DUSK|MORNING|GOLDEN HOUR).*/i, '')
    .trim()

  if (!title) title = heading.trim()

  return { int_ext, title, day_night }
}

/**
 * Base64 nur entpacken, wenn der Text ausschließlich aus Base64-Zeichen
 * besteht. Vorher genügte "kein < und Länge durch 4 teilbar" - das traf jedes
 * vierte Fountain- oder TXT-Drehbuch und machte daraus Datenmüll.
 */
export function entpackeImport(text: string): string {
  const kompakt = text.replace(/\s+/g, '')
  if (kompakt.length === 0 || kompakt.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(kompakt)) return text
  const entpackt = Buffer.from(kompakt, 'base64').toString('utf-8')
  // Kein lesbarer Text dabei herausgekommen: dann war es doch keins
  return entpackt.includes('�') || entpackt.includes('\u0000') ? text : entpackt
}

// ─── POST /api/projects/:projectId/fdx-import ────────────────────────────────
router.post('/projects/:projectId/fdx-import', async (req, res) => {
  const { projectId } = req.params
  const { xml, filename = 'import' } = req.body

  if (!xml || typeof xml !== 'string') {
    return res.status(400).json({ data: null, error: 'Kein XML-Inhalt angegeben' })
  }

  const parsedBlocks = parseFdxXml(entpackeImport(xml))

  if (parsedBlocks.length === 0) {
    return res.status(400).json({ data: null, error: 'Keine Inhalte im Skript gefunden' })
  }

  // Alles oder nichts: Vorher ließ ein Abbruch mitten im Import halbe
  // Szenen zurück, und ein zweiter Versuch legte alles noch einmal an.
  let scenesCreated = 0
  let blocksCreated = 0
  await db.transaction(async (tx) => {
    // Get current max sort_order
    const maxSortRow = await tx.get('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?', [projectId]) as { m: number }
    let sortCounter = maxSortRow.m + 1
    // Weiterzählen hinter der höchsten vorhandenen Nummer, wie POST /scenes.
    // Vorher begann jeder Import bei 1, danach bei der Anzahl der Szenen -
    // gemessen am 25.10.2026: Szenen 1 und 3 vorhanden, der Import vergab
    // eine zweite 3. "12A" zählt als 12.
    const vorhanden = await tx.all('SELECT scene_number FROM scenes WHERE project_id = ?', [projectId]) as any[]
    const nummerBasis = vorhanden.reduce(
      (m, z) => Math.max(m, parseInt(String(z.scene_number ?? ''), 10) || 0), 0
    )

    let currentSceneId: number | null = null
    let blockSortOrder = 0

    for (const block of parsedBlocks) {
      if (block.type === 'scene_heading') {
        // Create a new scene
        const { int_ext, title, day_night } = parseSceneHeading(block.content)
        const sceneNumber = String(nummerBasis + scenesCreated + 1)

        const sceneResult = await tx.run(`
          INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [projectId, sceneNumber, sortCounter, title, int_ext, day_night, ''])

        currentSceneId = sceneResult.id
        sortCounter++
        scenesCreated++
        blockSortOrder = 0

        // Also store scene_heading as a block for display in editor
        await tx.run(`
          INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content)
          VALUES (?, ?, ?, ?, ?)
        `, [currentSceneId, projectId, blockSortOrder, 'scene_heading', block.content])
        blockSortOrder++
        blocksCreated++
      } else {
        // If no scene exists yet, create a default one
        if (currentSceneId === null) {
          const sceneResult = await tx.run(`
            INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [projectId, String(nummerBasis + scenesCreated + 1), sortCounter, 'Import', 'INT', 'TAG'])
          currentSceneId = sceneResult.id
          sortCounter++
          scenesCreated++
          blockSortOrder = 0
        }

        await tx.run(`
          INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content)
          VALUES (?, ?, ?, ?, ?)
        `, [currentSceneId, projectId, blockSortOrder, block.type, block.content])
        blockSortOrder++
        blocksCreated++
        // Jede Figur des eingelesenen Drehbuchs wird Rolle und gehört zur Szene
        if (block.type === 'character') {
          await figurVerknuepfen(tx, Number(projectId), Number(currentSceneId), block.content)
        }
      }
    }

    // Record the import
    await tx.run(`
      INSERT INTO fdx_imports (project_id, filename, scene_count)
      VALUES (?, ?, ?)
    `, [projectId, filename, scenesCreated])
  })

  res.json({ data: { scenes_created: scenesCreated, blocks_created: blocksCreated }, error: null })
})

export default router
