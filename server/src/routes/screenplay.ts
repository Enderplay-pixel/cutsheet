import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import { leseUeberschrift, mitUeberschrift } from '../lib/szenenUeberschrift'
import { motivVerknuepfen } from '../lib/motive'
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
      lines.push(...fountainZeilen(blocks[0], scene.scene_number), scene.description, '')
      continue
    }

    for (const b of blocks) lines.push(...fountainZeilen(b, b.block_type === 'scene_heading' ? scene.scene_number : null))
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
  //
  // Nur die erste Überschrift der Szene - sie ist die, die der Editor oben
  // zeigt. Eine weitere Überschriftenzeile in derselben Szene schrieb bis zum
  // 03.11.2026 ihre Angaben in den Datensatz: Szene 1 "INT. KÜCHE - TAG" stand
  // danach in Drehplan und Dispo als "EXT / HAFEN / NACHT" mit Motiv Hafen.
  let szene: any = null
  let motiv: any = null
  const ersteUeberschrift = block?.block_type === 'scene_heading'
    ? await db.get(
      `SELECT id FROM screenplay_blocks WHERE scene_id = ? AND block_type = 'scene_heading'
       ORDER BY sort_order, id LIMIT 1`, [block.scene_id]) as any
    : null
  if (ersteUeberschrift && Number(ersteUeberschrift.id) === Number(block.id)) {
    const kopf = leseUeberschrift(block.content || '')
    if (kopf && kopf.title) {
      await db.run(
        `UPDATE scenes SET int_ext = ?, title = ?,
           day_night = COALESCE(NULLIF(?, ''), day_night), updated_at = NOW()
         WHERE id = ?`,
        [kopf.int_ext, kopf.title, kopf.day_night, block.scene_id]
      ).catch((e: any) => console.warn('[blocks PUT] Szene nicht nachgefuehrt:', e?.message))
      // Das Motiv erst, wenn die Zeile fertig ist (`motiv_fertig`, wie bei
      // den Figuren): aus "INT. HA" entstünde sonst ein Motiv "Ha".
      if (req.body?.motiv_fertig === true) {
        motiv = await motivVerknuepfen(db, Number(block.project_id), Number(block.scene_id), kopf.title)
      }
      // Mitschicken, damit der Editor seine Szenenleiste nachziehen kann -
      // sonst stand dort bis zum Neuladen weiter der alte Titel.
      szene = await db.get(
        'SELECT id, int_ext, title, day_night, location_id, updated_at FROM scenes WHERE id = ?',
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

  res.json({ data: { ...block, ...(szene ? { szene } : {}), ...(figur ? { figur } : {}), ...(motiv ? { motiv } : {}) }, error: null })
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

/** Ein gelesener Absatz. `nummer` nur bei Szenenüberschriften mit eigener Nummer. */
type Gelesen = { type: BlockType; content: string; nummer?: string }

/**
 * XML-Entities auflösen. `&amp;` zuletzt - sonst würde aus "&amp;lt;" ein "<".
 * Vorher fehlten die hexadezimalen (`&#x27;` stand wörtlich im Drehbuch,
 * Testbericht SALZWIND vom 09.11.2026).
 */
export function entitaetenAufloesen(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function parseFdxXml(xml: string): Gelesen[] {
  const blocks: Gelesen[] = []

  // Strip byte-order marks and normalize newlines
  let normalized = xml.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

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
      textParts.push(entitaetenAufloesen(textMatch[1]))
    }
    return textParts.join('').trim()
  }

  // Titelseite, Kopf- und Fußzeilen tragen auch Absätze - die gehören nicht
  // ins Drehbuch. Vorher wurde daraus eine Szene "Import" (Testbericht
  // SALZWIND). Gelesen wird nur der Inhalt.
  normalized = normalized
    .replace(/<TitlePage\b[\s\S]*?<\/TitlePage>/gi, '')
    .replace(/<HeaderAndFooter\b[\s\S]*?<\/HeaderAndFooter>/gi, '')
    // Leere Absätze als <Paragraph .../> - sonst griffe der nächste Treffer
    // bis zum Ende des folgenden Absatzes
    .replace(/<Paragraph\b[^>]*\/>/gi, '')
  const inhalt = normalized.match(/<Content\b[^>]*>([\s\S]*)<\/Content>/i)
  if (inhalt) normalized = inhalt[1]

  // Try FDX format: <Paragraph Type="..." Number="13A"><Text>...</Text></Paragraph>
  const paragraphRegex = /<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi
  let match: RegExpExecArray | null
  let foundFdx = false

  while ((match = paragraphRegex.exec(normalized)) !== null) {
    const attribute = match[1]
    const rawType = (attribute.match(/\bType="([^"]*)"/) || [])[1]
    if (rawType === undefined) continue
    foundFdx = true
    const blockType: BlockType = typeMap[rawType] || 'action'
    const content = extractText(match[2])
    if (!content) continue
    const nummer = blockType === 'scene_heading' ? (attribute.match(/\bNumber="([^"]*)"/) || [])[1]?.trim() : undefined
    blocks.push(nummer ? { type: blockType, content, nummer } : { type: blockType, content })
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
      const headingText = entitaetenAufloesen(scenelineMatch[1].replace(/<[^>]+>/g, '')).trim()
      if (headingText) blocks.push({ type: 'scene_heading', content: headingText })
    }

    // Extract paragraphs inside scene
    const innerParaRegex = /<para[^>]*\s+element="([^"]*)"[^>]*>([\s\S]*?)<\/para>/gi
    let innerMatch: RegExpExecArray | null
    while ((innerMatch = innerParaRegex.exec(sceneContent)) !== null) {
      const elType = innerMatch[1].toLowerCase()
      const text = entitaetenAufloesen(innerMatch[2].replace(/<[^>]+>/g, '')).trim()
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

/**
 * Anfang einer Szenenüberschrift: INT, EXT, INT./EXT., EXT./INT., I/E und die
 * deutschen INNEN, AUSSEN, INNEN/AUSSEN. Vorher erkannte der Import
 * "INT./EXT." als INT (Testbericht SALZWIND).
 */
const UEBERSCHRIFT_ANFANG = /^(INT\.?\s*\/\s*EXT|EXT\.?\s*\/\s*INT|I\s*\/\s*E|INNEN\s*\/\s*AU(?:SS|ß)EN|INT|EXT|INNEN|AU(?:SS|ß)EN)\b\.?/i

export function parsePlainText(text: string): Gelesen[] {
  const blocks: Gelesen[] = []
  let lines = text.split('\n')

  // Fountain-Titelblock ("Title: …", "Author: …") bis zur ersten Leerzeile.
  // Er gehört nicht ins Drehbuch - vorher wurde daraus eine Szene "Import".
  const erste = lines.findIndex((l) => l.trim() !== '')
  if (erste !== -1 && /^[A-Za-z][A-Za-z ]*:\s*\S/.test(lines[erste].trim()) && !UEBERSCHRIFT_ANFANG.test(lines[erste].trim())) {
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

    if (UEBERSCHRIFT_ANFANG.test(line)) {
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
    if (blockType === 'scene_heading') {
      // Fountain trägt die Szenennummer am Ende: "INT. HAUS - TAG #13A#"
      const nummer = line.match(/\s#([^#\s]+)#\s*$/)
      if (nummer) {
        blocks.push({ type: blockType, content: line.slice(0, nummer.index).trim(), nummer: nummer[1] })
        continue
      }
    }
    blocks.push({ type: blockType, content: line })
  }

  return blocks
}

export function parseSceneHeading(heading: string): { int_ext: string; title: string; day_night: string } {
  const upper = heading.toUpperCase().trim()
  const anfang = (upper.match(UEBERSCHRIFT_ANFANG) || [])[1] ?? ''

  let int_ext = 'INT'
  if (anfang.includes('/')) int_ext = 'INT/EXT'
  else if (/^(EXT|AU)/.test(anfang)) int_ext = 'EXT'

  let day_night = 'TAG'
  if (/\bNACHT\b|\bNIGHT\b/i.test(upper)) day_night = 'NACHT'
  else if (/\bDÄMMERUNG\b|\bDAWN\b|\bDUSK\b|\bGOLDEN HOUR\b/i.test(upper)) day_night = 'DÄMMERUNG'
  else if (/\bMORGEN\b|\bMORNING\b/i.test(upper)) day_night = 'MORGEN'

  // Extract location: "INT./EXT. LOCATION - DAY" → "LOCATION"
  let title = heading
    .replace(UEBERSCHRIFT_ANFANG, '')
    .replace(/^[\s.]+/, '')
    .replace(/\s#[^#\s]+#\s*$/, '')
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
  const { xml, filename = 'import', anhaengen = false } = req.body

  if (!xml || typeof xml !== 'string') {
    return res.status(400).json({ data: null, error: 'Kein XML-Inhalt angegeben' })
  }

  const gelesen = parseFdxXml(entpackeImport(xml))
  if (gelesen.length === 0) {
    return res.status(400).json({ data: null, error: 'Keine Inhalte im Skript gefunden' })
  }

  // Was vor der ersten Szenenüberschrift steht ("FADE IN:", Titelzeilen),
  // gehört zu keiner Szene. Vorher entstand daraus eine Szene "Import"
  // (Testbericht SALZWIND). Gibt es gar keine Überschrift, wird der Text
  // eine Szene mit dem Dateinamen.
  const ersteUeberschrift = gelesen.findIndex((b) => b.type === 'scene_heading')
  const vorspann = ersteUeberschrift > 0 ? ersteUeberschrift : 0
  const parsedBlocks = ersteUeberschrift > 0 ? gelesen.slice(ersteUeberschrift) : gelesen
  const imImport = parsedBlocks.filter((b) => b.type === 'scene_heading').length || 1

  // Ein zweiter Import hängte alles noch einmal an - gemessen im Testbericht
  // SALZWIND: 20 Szenen wurden ohne Rückfrage 40. Hat das Projekt schon
  // Szenen, muss das Anhängen ausdrücklich gewollt sein.
  const bestand = (await db.get('SELECT COUNT(*) AS n FROM scenes WHERE project_id = ?', [projectId])) as any
  const vorhandenAnzahl = Number(bestand?.n ?? 0)
  if (vorhandenAnzahl > 0 && anhaengen !== true) {
    return res.status(409).json({
      data: { vorhanden: vorhandenAnzahl, im_import: imImport },
      error: `Das Projekt hat schon ${vorhandenAnzahl} Szenen. Der Import würde ${imImport} weitere anhängen.`,
    })
  }

  // Alles oder nichts: Vorher ließ ein Abbruch mitten im Import halbe
  // Szenen zurück, und ein zweiter Versuch legte alles noch einmal an.
  let scenesCreated = 0
  let blocksCreated = 0
  const uebernommeneNummern: string[] = []
  await db.transaction(async (tx) => {
    // Get current max sort_order
    const maxSortRow = await tx.get('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?', [projectId]) as { m: number }
    let sortCounter = maxSortRow.m + 1
    // Die Nummer aus dem Drehbuch (FDX `Number`, Fountain `#13A#`), solange
    // sie im Projekt frei ist - vorher wurde sie verworfen und neu gezählt.
    // Ohne eigene Nummer: weiterzählen hinter der höchsten vorhandenen, wie
    // POST /scenes. "12A" zählt dabei als 12.
    const vorhanden = await tx.all('SELECT scene_number FROM scenes WHERE project_id = ?', [projectId]) as any[]
    const vergeben = new Set(vorhanden.map((z) => String(z.scene_number ?? '').trim().toUpperCase()).filter(Boolean))
    let hoechste = vorhanden.reduce(
      (m, z) => Math.max(m, parseInt(String(z.scene_number ?? ''), 10) || 0), 0
    )
    const naechsteNummer = (eigene?: string): string => {
      const wunsch = eigene?.trim()
      let nummer: string
      if (wunsch && !vergeben.has(wunsch.toUpperCase())) {
        nummer = wunsch
        uebernommeneNummern.push(wunsch)
      } else {
        do { hoechste++ } while (vergeben.has(String(hoechste)))
        nummer = String(hoechste)
      }
      vergeben.add(nummer.toUpperCase())
      hoechste = Math.max(hoechste, parseInt(nummer, 10) || 0)
      return nummer
    }

    let currentSceneId: number | null = null
    let blockSortOrder = 0

    for (const block of parsedBlocks) {
      if (block.type === 'scene_heading') {
        // Create a new scene
        const { int_ext, title, day_night } = parseSceneHeading(block.content)
        const sceneNumber = naechsteNummer(block.nummer)

        const sceneResult = await tx.run(`
          INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [projectId, sceneNumber, sortCounter, title, int_ext, day_night, ''])

        currentSceneId = sceneResult.id
        sortCounter++
        scenesCreated++
        blockSortOrder = 0
        // Der Spielort der Überschrift wird Motiv des Projekts (lib/motive.ts)
        await motivVerknuepfen(tx, Number(projectId), sceneResult.id, title)

        // Also store scene_heading as a block for display in editor
        await tx.run(`
          INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content)
          VALUES (?, ?, ?, ?, ?)
        `, [currentSceneId, projectId, blockSortOrder, 'scene_heading', block.content])
        blockSortOrder++
        blocksCreated++
      } else {
        // Ein Drehbuch ganz ohne Szenenüberschrift: eine Szene, benannt nach der Datei
        if (currentSceneId === null) {
          const name = String(filename).replace(/\.[a-z0-9]+$/i, '').trim() || 'Drehbuch'
          const sceneResult = await tx.run(`
            INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [projectId, naechsteNummer(), sortCounter, name, 'INT', 'TAG'])
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

  res.json({
    data: {
      scenes_created: scenesCreated,
      blocks_created: blocksCreated,
      // Was vor der ersten Szene stand und nicht übernommen wurde
      vorspann_uebersprungen: vorspann,
      nummern_uebernommen: uebernommeneNummern.length,
    },
    error: null,
  })
})

export default router
