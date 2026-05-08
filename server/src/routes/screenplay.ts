import { Router } from 'express'
import { db } from '../db'

const router = Router()

// ─── Types ───────────────────────────────────────────────────────────────────

type BlockType = 'scene_heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'note'

// ─── GET /api/projects/:projectId/screenplay ──────────────────────────────────
// Returns all scenes with their blocks, ordered by sort_order
router.get('/projects/:projectId/screenplay', (req, res) => {
  const { projectId } = req.params

  const scenes = db.prepare(`
    SELECT s.*, l.name as location_name
    FROM scenes s
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE s.project_id = ?
    ORDER BY s.sort_order ASC, s.scene_number ASC
  `).all(projectId)

  const result = (scenes as any[]).map(scene => {
    const blocks = db.prepare(`
      SELECT * FROM screenplay_blocks
      WHERE scene_id = ?
      ORDER BY sort_order ASC
    `).all(scene.id)
    return { scene, blocks }
  })

  res.json({ data: result, error: null })
})

// ─── GET /api/scenes/:sceneId/blocks ─────────────────────────────────────────
router.get('/scenes/:sceneId/blocks', (req, res) => {
  const blocks = db.prepare(`
    SELECT * FROM screenplay_blocks
    WHERE scene_id = ?
    ORDER BY sort_order ASC
  `).all(req.params.sceneId)

  res.json({ data: blocks, error: null })
})

// ─── POST /api/scenes/:sceneId/blocks ────────────────────────────────────────
router.post('/scenes/:sceneId/blocks', (req, res) => {
  const { sceneId } = req.params
  const { block_type = 'action', content = '', sort_order = 0 } = req.body

  // Get project_id from the scene
  const scene = db.prepare('SELECT project_id FROM scenes WHERE id = ?').get(sceneId) as { project_id: number } | undefined
  if (!scene) {
    return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  }

  const result = db.prepare(`
    INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(sceneId, scene.project_id, sort_order, block_type, content)

  const block = db.prepare('SELECT * FROM screenplay_blocks WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ data: block, error: null })
})

// ─── PUT /api/blocks/:blockId ─────────────────────────────────────────────────
router.put('/blocks/:blockId', (req, res) => {
  const { blockId } = req.params
  const { content, sort_order, block_type } = req.body

  const existing = db.prepare('SELECT * FROM screenplay_blocks WHERE id = ?').get(blockId) as any
  if (!existing) {
    return res.status(404).json({ data: null, error: 'Block nicht gefunden' })
  }

  db.prepare(`
    UPDATE screenplay_blocks
    SET
      content = COALESCE(?, content),
      sort_order = COALESCE(?, sort_order),
      block_type = COALESCE(?, block_type),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    content !== undefined ? content : null,
    sort_order !== undefined ? sort_order : null,
    block_type !== undefined ? block_type : null,
    blockId
  )

  const block = db.prepare('SELECT * FROM screenplay_blocks WHERE id = ?').get(blockId)
  res.json({ data: block, error: null })
})

// ─── DELETE /api/blocks/:blockId ──────────────────────────────────────────────
router.delete('/blocks/:blockId', (req, res) => {
  db.prepare('DELETE FROM screenplay_blocks WHERE id = ?').run(req.params.blockId)
  res.json({ data: { ok: true }, error: null })
})

// ─── PUT /api/scenes/:sceneId/blocks/reorder ─────────────────────────────────
router.put('/scenes/:sceneId/blocks/reorder', (req, res) => {
  const { blocks } = req.body as { blocks: Array<{ id: number; sort_order: number }> }

  if (!Array.isArray(blocks)) {
    return res.status(400).json({ data: null, error: 'blocks muss ein Array sein' })
  }

  const updateStmt = db.prepare(`
    UPDATE screenplay_blocks SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND scene_id = ?
  `)

  for (const b of blocks) {
    updateStmt.run(b.sort_order, b.id, req.params.sceneId)
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

function parsePlainText(text: string): Array<{ type: BlockType; content: string }> {
  const blocks: Array<{ type: BlockType; content: string }> = []
  const lines = text.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    let blockType: BlockType = 'action'

    if (/^(INT|EXT|INT\/EXT|I\/E)\b/i.test(line)) {
      blockType = 'scene_heading'
    } else if (/^(FADE|CUT|DISSOLVE|SMASH CUT|MATCH CUT)/i.test(line) || /\bTO:$/.test(line)) {
      blockType = 'transition'
    } else if (/^\(/.test(line)) {
      blockType = 'parenthetical'
    } else if (line === line.toUpperCase() && line.length < 60 && /[A-Z]/.test(line)) {
      blockType = 'character'
    }

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

// ─── POST /api/projects/:projectId/fdx-import ────────────────────────────────
router.post('/projects/:projectId/fdx-import', (req, res) => {
  const { projectId } = req.params
  const { xml, filename = 'import' } = req.body

  if (!xml || typeof xml !== 'string') {
    return res.status(400).json({ data: null, error: 'Kein XML-Inhalt angegeben' })
  }

  // Decode base64 if necessary
  let xmlContent = xml
  if (!xml.includes('<') && xml.length % 4 === 0) {
    try {
      xmlContent = Buffer.from(xml, 'base64').toString('utf-8')
    } catch {
      xmlContent = xml
    }
  }

  const parsedBlocks = parseFdxXml(xmlContent)

  if (parsedBlocks.length === 0) {
    return res.status(400).json({ data: null, error: 'Keine Inhalte im Skript gefunden' })
  }

  // Get current max sort_order
  const maxSortRow = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?').get(projectId) as { m: number }
  let sortCounter = maxSortRow.m + 1

  let currentSceneId: number | null = null
  let blockSortOrder = 0
  let scenesCreated = 0
  let blocksCreated = 0

  for (const block of parsedBlocks) {
    if (block.type === 'scene_heading') {
      // Create a new scene
      const { int_ext, title, day_night } = parseSceneHeading(block.content)
      const sceneNumber = String(scenesCreated + 1)

      const sceneResult = db.prepare(`
        INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(projectId, sceneNumber, sortCounter, title, int_ext, day_night, '')

      currentSceneId = sceneResult.lastInsertRowid
      sortCounter++
      scenesCreated++
      blockSortOrder = 0

      // Also store scene_heading as a block for display in editor
      db.prepare(`
        INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content)
        VALUES (?, ?, ?, ?, ?)
      `).run(currentSceneId, projectId, blockSortOrder, 'scene_heading', block.content)
      blockSortOrder++
      blocksCreated++
    } else {
      // If no scene exists yet, create a default one
      if (currentSceneId === null) {
        const sceneResult = db.prepare(`
          INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(projectId, '1', sortCounter, 'Import', 'INT', 'TAG')
        currentSceneId = sceneResult.lastInsertRowid
        sortCounter++
        scenesCreated++
        blockSortOrder = 0
      }

      db.prepare(`
        INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content)
        VALUES (?, ?, ?, ?, ?)
      `).run(currentSceneId, projectId, blockSortOrder, block.type, block.content)
      blockSortOrder++
      blocksCreated++
    }
  }

  // Record the import
  db.prepare(`
    INSERT INTO fdx_imports (project_id, filename, scene_count)
    VALUES (?, ?, ?)
  `).run(projectId, filename, scenesCreated)

  res.json({ data: { scenes_created: scenesCreated, blocks_created: blocksCreated }, error: null })
})

export default router
