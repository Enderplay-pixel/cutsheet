import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import { leseUeberschrift, mitUeberschrift } from '../lib/szenenUeberschrift'
import { motivVerknuepfen } from '../lib/motive'
import { fountainZeilen } from '../lib/fountainExport'
import { figurVerknuepfen } from '../lib/figuren'
import { ordneZu, naechsteNummer as buchstabenNummer, farbeFuer, fassungsName, vergleiche, FARBSCHLUESSEL, drehbuchGesperrt, type SzenenText, type Vorhandene } from '../lib/fassungen'

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
    // Entfallen (AP A3): Nummer bleibt stehen, Inhalt nicht - so wie gedruckte
    // Drehbücher "OMITTED" führen
    if (scene.omitted) {
      const nr = String(scene.scene_number ?? '').trim()
      lines.push(/^[A-Za-z0-9.-]+$/.test(nr) ? `.OMITTED #${nr}#` : '.OMITTED', '')
      continue
    }
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

// ─── Drehbuch-Fassungen (Plan Kino-Ausbau, AP A3) ───────────────────────────

type Zugriff = { get: (s: string, w?: any[]) => Promise<any>; all: (s: string, w?: any[]) => Promise<any[]>; run: (s: string, w?: any[]) => Promise<{ id: number; changes: number }> }

type DateiSzene = SzenenText & { bloecke: Gelesen[] }

/** Die Szenen einer gelesenen Datei: je Überschrift ihre Blöcke. Was vor der ersten steht, fällt weg. */
function szenenAusDatei(gelesen: Gelesen[]): DateiSzene[] {
  const szenen: DateiSzene[] = []
  for (const b of gelesen) {
    if (b.type === 'scene_heading') szenen.push({ nummer: b.nummer ?? '', kopf: b.content, zeilen: [], bloecke: [b] })
    else if (szenen.length > 0) {
      szenen[szenen.length - 1].zeilen.push(b.content)
      szenen[szenen.length - 1].bloecke.push(b)
    }
  }
  return szenen
}

type ProjektSzene = Vorhandene & { bloecke: any[] }

/** Die Szenen des Projekts mit Überschrift und Textzeilen, in Drehbuchreihenfolge - auch entfallene. */
async function szenenDesProjekts(z: Zugriff, projectId: number | string): Promise<ProjektSzene[]> {
  const szenen = await z.all('SELECT * FROM scenes WHERE project_id = ? ORDER BY sort_order ASC, scene_number ASC', [projectId])
  const ids = szenen.map((s) => Number(s.id))
  const bloecke = ids.length
    ? await z.all('SELECT * FROM screenplay_blocks WHERE scene_id = ANY(?::int[]) ORDER BY sort_order ASC, id ASC', [ids])
    : []
  return szenen.map((s) => {
    const eigene = mitUeberschrift(s, bloecke.filter((b) => Number(b.scene_id) === Number(s.id)))
    const kopf = eigene.find((b: any) => b.block_type === 'scene_heading')
    return {
      id: Number(s.id),
      nummer: String(s.scene_number ?? ''),
      omitted: !!s.omitted,
      kopf: String(kopf?.content ?? ''),
      zeilen: eigene.filter((b: any) => b !== kopf).map((b: any) => String(b.content ?? '')),
      bloecke: eigene,
    }
  })
}

/**
 * Die Erstfassung sichern, bevor etwas geändert wird: Fassung 0, Weiß, mit
 * dem Text jeder Szene. Ohne sie gäbe es für die erste Änderung nichts zu
 * vergleichen.
 */
async function erstfassungSichern(tx: Zugriff, projectId: number, userId: number | null) {
  if (await tx.get('SELECT id FROM script_revisions WHERE project_id = ? AND number = 0', [projectId])) return
  const rev = (await tx.run(
    "INSERT INTO script_revisions (project_id, number, color, note, created_by) VALUES (?, 0, 'weiss', 'Erstfassung', ?)",
    [projectId, userId])).id
  for (const s of await szenenDesProjekts(tx, projectId)) {
    await tx.run(
      'INSERT INTO script_revision_scenes (project_id, revision_id, scene_id, scene_number, heading, body, change) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [projectId, rev, s.id, s.nummer, s.kopf, s.zeilen.join('\n'), s.omitted ? 'entfaellt' : 'unveraendert'])
  }
}

const kurz = (s: { nummer: string; kopf: string }) => ({ nummer: s.nummer, kopf: s.kopf })

/**
 * Eine Datei als neue Fassung einlesen (Soll 2 und 3). Mit `nurZeigen`
 * nur die vier Listen, sonst in einer Transaktion:
 * - geänderte Szene: Die Zeile in `scenes` bleibt (Drehplan, Breakdown,
 *   Shotlist, Kommentare hängen daran), ihre Blöcke werden ersetzt -
 *   gleich gebliebene behalten ihre Fassung, neue tragen die neue.
 * - neue Szene: hinter der vorangehenden zugeordneten, mit eigener Nummer
 *   aus der Datei oder der Buchstabennummer (13A).
 * - fehlende Szene: gesperrt "entfällt", sonst bleibt sie und wird genannt.
 * Ändert die Datei nichts, entsteht keine Fassung.
 */
async function alsFassungEinlesen(req: Request, res: Response, gelesen: Gelesen[]) {
  const projectId = Number(req.params.projectId)
  const userId = (req as any).user?.id ?? null
  const { filename = 'import', nurZeigen = false, farbe } = req.body
  const datei = szenenAusDatei(gelesen)
  if (datei.length === 0) return res.status(400).json({ data: null, error: 'Die Datei enthält keine Szenenüberschrift' })

  const vorhanden = await szenenDesProjekts(db, projectId)
  const gesperrt = await drehbuchGesperrt(db, projectId)
  const z = ordneZu(vorhanden, datei)
  const zahlen = { unveraendert: z.unveraendert.length, geaendert: z.geaendert.length, neu: z.neu.length, fehlt: z.fehlt.length }
  const antwort = {
    zahlen,
    gesperrt,
    geaendert: z.geaendert.map((g) => kurz(g.alt)),
    neu: z.neu.map((n) => kurz(n.neu)),
    fehlt: z.fehlt.map(kurz),
  }
  const nichts = z.geaendert.length === 0 && z.neu.length === 0 && (z.fehlt.length === 0 || !gesperrt)
  if (nurZeigen || nichts) {
    return res.json({ data: { ...antwort, nichts, fassung: null, entfallen: [] }, error: null })
  }
  if (farbe !== undefined && !FARBSCHLUESSEL.includes(String(farbe).split('-')[0])) {
    return res.status(400).json({ data: null, error: 'Unbekannte Farbe der Fassung' })
  }

  const fassung = await db.transaction(async (tx) => {
    await erstfassungSichern(tx, projectId, userId)
    const nummer = Number((await tx.get('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM script_revisions WHERE project_id = ?', [projectId])).n)
    const color = farbe !== undefined ? String(farbe) : farbeFuer(nummer)
    const rev = (await tx.run(
      'INSERT INTO script_revisions (project_id, number, color, filename, created_by) VALUES (?, ?, ?, ?, ?)',
      [projectId, nummer, color, String(filename).slice(0, 200), userId])).id
    const aenderung = new Map<number, string>()

    // Geänderte Szenen: Zeile bleibt, Blöcke neu
    for (const { alt, neu } of z.geaendert) {
      const vergleich = vergleiche(alt.bloecke.map((b: any) => String(b.content ?? '')), neu.bloecke.map((b) => b.content))
      const bleibt = new Map<number, number | null>()
      for (const v of vergleich) {
        if (v.art === 'gleich' && v.neu !== undefined && v.alt !== undefined) {
          const altRev = alt.bloecke[v.alt]?.revision_id
          bleibt.set(v.neu, altRev == null ? null : Number(altRev))
        }
      }
      await tx.run('DELETE FROM screenplay_blocks WHERE scene_id = ?', [alt.id])
      for (const [i, b] of neu.bloecke.entries()) {
        await tx.run(
          'INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content, revision_id) VALUES (?, ?, ?, ?, ?, ?)',
          [alt.id, projectId, i, b.type, b.content, bleibt.has(i) ? bleibt.get(i) : rev])
        if (b.type === 'character') await figurVerknuepfen(tx, projectId, alt.id, b.content)
      }
      const { int_ext, title, day_night } = parseSceneHeading(neu.kopf)
      await tx.run('UPDATE scenes SET int_ext = ?, title = ?, day_night = ?, omitted = false, updated_at = NOW() WHERE id = ?',
        [int_ext, title, day_night, alt.id])
      await motivVerknuepfen(tx, projectId, alt.id, title)
      aenderung.set(alt.id, 'geaendert')
    }

    // Neue Szenen: Nummer aus der Datei, wenn frei, sonst die Buchstabennummer
    const vergeben = new Set(vorhanden.map((v) => v.nummer.trim().toUpperCase()).filter(Boolean))
    const reihe: number[] = vorhanden.map((v) => v.id)
    const nummerVon = new Map<number, string>(vorhanden.map((v) => [v.id, v.nummer]))
    const zuletztNach = new Map<number | null, number>()
    for (const { neu, nach } of z.neu) {
      // Hinter der Vorgängerin - und hinter dem, was schon hinter ihr neu eingefügt wurde
      const hinter = zuletztNach.get(nach) ?? nach
      const stelle = hinter === null ? 0 : reihe.indexOf(hinter) + 1
      const davor = stelle > 0 ? nummerVon.get(reihe[stelle - 1]) ?? null : null
      const wunsch = neu.nummer.trim()
      const sceneNumber = wunsch && !vergeben.has(wunsch.toUpperCase())
        ? wunsch
        : buchstabenNummer(davor, vergeben, reihe.length > 0 ? nummerVon.get(reihe[0]) : '1')
      vergeben.add(sceneNumber.toUpperCase())
      const { int_ext, title, day_night } = parseSceneHeading(neu.kopf)
      const id = (await tx.run(
        'INSERT INTO scenes (project_id, scene_number, sort_order, title, int_ext, day_night, description) VALUES (?, ?, 0, ?, ?, ?, ?)',
        [projectId, sceneNumber, title, int_ext, day_night, ''])).id
      for (const [i, b] of neu.bloecke.entries()) {
        await tx.run(
          'INSERT INTO screenplay_blocks (scene_id, project_id, sort_order, block_type, content, revision_id) VALUES (?, ?, ?, ?, ?, ?)',
          [id, projectId, i, b.type, b.content, rev])
        if (b.type === 'character') await figurVerknuepfen(tx, projectId, id, b.content)
      }
      await motivVerknuepfen(tx, projectId, id, title)
      reihe.splice(stelle, 0, id)
      nummerVon.set(id, sceneNumber)
      zuletztNach.set(nach, id)
      aenderung.set(id, 'neu')
    }
    for (const [i, id] of reihe.entries()) await tx.run('UPDATE scenes SET sort_order = ? WHERE id = ?', [i, id])

    // Fehlende Szenen: im gesperrten Drehbuch entfallen sie
    if (gesperrt) {
      for (const f of z.fehlt) {
        await tx.run('UPDATE scenes SET omitted = true, updated_at = NOW() WHERE id = ?', [f.id])
        await tx.run('DELETE FROM shoot_day_scenes WHERE scene_id = ?', [f.id])
        aenderung.set(f.id, 'entfaellt')
      }
    }

    // Der Stand jeder Szene in dieser Fassung - Grundlage des Vergleichs
    for (const s of await szenenDesProjekts(tx, projectId)) {
      await tx.run(
        'INSERT INTO script_revision_scenes (project_id, revision_id, scene_id, scene_number, heading, body, change) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [projectId, rev, s.id, s.nummer, s.kopf, s.zeilen.join('\n'), aenderung.get(s.id) ?? (s.omitted ? 'entfaellt' : 'unveraendert')])
    }
    await tx.run('INSERT INTO fdx_imports (project_id, filename, scene_count) VALUES (?, ?, ?)', [projectId, filename, z.neu.length])
    return { id: rev, number: nummer, color }
  })

  res.json({
    data: { ...antwort, nichts: false, fassung: { ...fassung, name: fassungsName(fassung.color) }, entfallen: gesperrt ? z.fehlt.map(kurz) : [] },
    error: null,
  })
}

// POST /api/projects/:projectId/drehbuch/sperren - ab Produktion (ROUTE_OVERRIDES)
// Ab dann bleiben Szenennummern, neue bekommen einen Buchstaben, Löschen heißt
// "entfällt". Die Erstfassung wird dabei als Fassung 0 gesichert.
router.post('/projects/:projectId/drehbuch/sperren', async (req, res) => {
  const projectId = Number(req.params.projectId)
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO project_settings (project_id, script_locked_at) VALUES (?, NOW())
       ON CONFLICT (project_id) DO UPDATE SET script_locked_at = COALESCE(project_settings.script_locked_at, NOW())`,
      [projectId])
    await erstfassungSichern(tx, projectId, (req as any).user?.id ?? null)
  })
  const s = await db.get('SELECT script_locked_at FROM project_settings WHERE project_id = ?', [projectId])
  res.json({ data: { gesperrt: true, seit: s?.script_locked_at ?? null }, error: null })
})

// POST /api/projects/:projectId/drehbuch/entsperren - ab Produktion
router.post('/projects/:projectId/drehbuch/entsperren', async (req, res) => {
  await db.run('UPDATE project_settings SET script_locked_at = NULL WHERE project_id = ?', [req.params.projectId])
  res.json({ data: { gesperrt: false }, error: null })
})

// GET /api/projects/:projectId/drehbuch/fassungen - mit den vier Zahlen je Fassung
router.get('/projects/:projectId/drehbuch/fassungen', async (req, res) => {
  const fassungen = await db.all(
    `SELECT r.id, r.number, r.color, r.note, r.filename, r.created_at,
            COUNT(*) FILTER (WHERE s.change = 'unveraendert')::int AS unveraendert,
            COUNT(*) FILTER (WHERE s.change = 'geaendert')::int AS geaendert,
            COUNT(*) FILTER (WHERE s.change = 'neu')::int AS neu,
            COUNT(*) FILTER (WHERE s.change = 'entfaellt' AND r.number > 0
              AND NOT EXISTS (SELECT 1 FROM script_revision_scenes v JOIN script_revisions vr ON vr.id = v.revision_id
                               WHERE vr.project_id = r.project_id AND vr.number < r.number AND v.scene_id = s.scene_id AND v.change = 'entfaellt'))::int AS entfaellt
       FROM script_revisions r LEFT JOIN script_revision_scenes s ON s.revision_id = r.id
      WHERE r.project_id = ?
      GROUP BY r.id ORDER BY r.number ASC`,
    [req.params.projectId])
  const gesperrt = await drehbuchGesperrt(db, req.params.projectId)
  // Je Fassung die Szenen, die sich geändert haben - für den Dialog "Fassungen"
  const aenderungen = await db.all(
    `SELECT s.revision_id, s.scene_id, s.scene_number, s.heading, s.change FROM script_revision_scenes s
       JOIN script_revisions r ON r.id = s.revision_id
      WHERE r.project_id = ? AND r.number > 0 AND s.change <> 'unveraendert' ORDER BY s.id`,
    [req.params.projectId])
  res.json({
    data: fassungen.map((f: any) => ({
      ...f,
      name: fassungsName(f.color),
      aenderungen: aenderungen.filter((a: any) => Number(a.revision_id) === Number(f.id)),
    })),
    meta: { gesperrt },
    error: null,
  })
})

// GET /api/projects/:projectId/drehbuch/fassungen/:revisionId/szenen/:sceneId
// Die Szene in dieser Fassung gegen die Fassung davor, zeilenweise (Soll 5)
router.get('/projects/:projectId/drehbuch/fassungen/:revisionId/szenen/:sceneId', async (req, res) => {
  const fassung = await db.get('SELECT id, number FROM script_revisions WHERE id = ? AND project_id = ?', [req.params.revisionId, req.params.projectId])
  if (!fassung) return res.status(404).json({ data: null, error: 'Drehbuch-Fassung nicht gefunden' })
  const neu = await db.get('SELECT * FROM script_revision_scenes WHERE revision_id = ? AND scene_id = ?', [fassung.id, req.params.sceneId])
  if (!neu) return res.status(404).json({ data: null, error: 'Szene nicht gefunden' })
  const alt = await db.get(
    `SELECT s.* FROM script_revision_scenes s JOIN script_revisions r ON r.id = s.revision_id
      WHERE r.project_id = ? AND r.number < ? AND s.scene_id = ? ORDER BY r.number DESC LIMIT 1`,
    [req.params.projectId, fassung.number, req.params.sceneId])
  const zeilen = (x: any) => (x ? [String(x.heading ?? ''), ...String(x.body ?? '').split('\n').filter((z) => z !== '')] : [])
  res.json({
    data: { nummer: neu.scene_number, change: neu.change, alt: zeilen(alt), neu: zeilen(neu), zeilen: vergleiche(zeilen(alt), zeilen(neu)) },
    error: null,
  })
})

// ─── POST /api/projects/:projectId/fdx-import ────────────────────────────────
router.post('/projects/:projectId/fdx-import', async (req, res) => {
  const { projectId } = req.params
  const { xml, filename = 'import' } = req.body
  // `modus: 'anhaengen' | 'fassung'` (AP A3); `anhaengen: true` heißt wie bisher anhängen
  const modus = req.body.modus ?? (req.body.anhaengen === true ? 'anhaengen' : undefined)
  if (modus !== undefined && modus !== 'anhaengen' && modus !== 'fassung') {
    return res.status(400).json({ data: null, error: 'Der Modus ist "anhaengen" oder "fassung"' })
  }

  if (!xml || typeof xml !== 'string') {
    return res.status(400).json({ data: null, error: 'Kein XML-Inhalt angegeben' })
  }

  const gelesen = parseFdxXml(entpackeImport(xml))
  if (gelesen.length === 0) {
    return res.status(400).json({ data: null, error: 'Keine Inhalte im Skript gefunden' })
  }
  if (modus === 'fassung') return alsFassungEinlesen(req, res, gelesen)

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
  if (vorhandenAnzahl > 0 && modus !== 'anhaengen') {
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
  // Im gesperrten Drehbuch bekommt eine angehängte Szene ohne eigene freie
  // Nummer die Nummer der Szene davor plus Buchstaben (AP A3), keine neue Zahl.
  const gesperrt = await drehbuchGesperrt(db, projectId)
  await db.transaction(async (tx) => {
    // Get current max sort_order
    const maxSortRow = await tx.get('SELECT COALESCE(MAX(sort_order), -1) as m FROM scenes WHERE project_id = ?', [projectId]) as { m: number }
    let sortCounter = maxSortRow.m + 1
    // Die Nummer aus dem Drehbuch (FDX `Number`, Fountain `#13A#`), solange
    // sie im Projekt frei ist - vorher wurde sie verworfen und neu gezählt.
    // Ohne eigene Nummer: weiterzählen hinter der höchsten vorhandenen, wie
    // POST /scenes. "12A" zählt dabei als 12.
    const vorhanden = await tx.all('SELECT scene_number FROM scenes WHERE project_id = ? ORDER BY sort_order ASC, scene_number ASC', [projectId]) as any[]
    const vergeben = new Set(vorhanden.map((z) => String(z.scene_number ?? '').trim().toUpperCase()).filter(Boolean))
    let letzte: string | null = vorhanden.length ? String(vorhanden[vorhanden.length - 1].scene_number ?? '') : null
    let hoechste = vorhanden.reduce(
      (m, z) => Math.max(m, parseInt(String(z.scene_number ?? ''), 10) || 0), 0
    )
    const naechsteNummer = (eigene?: string): string => {
      const wunsch = eigene?.trim()
      let nummer: string
      if (wunsch && !vergeben.has(wunsch.toUpperCase())) {
        nummer = wunsch
        uebernommeneNummern.push(wunsch)
      } else if (gesperrt) {
        nummer = buchstabenNummer(letzte, vergeben)
      } else {
        do { hoechste++ } while (vergeben.has(String(hoechste)))
        nummer = String(hoechste)
      }
      vergeben.add(nummer.toUpperCase())
      letzte = nummer
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
