import { Router, Request, Response } from 'express'
import { db } from '../db'
import { generatePdf } from './pdf'

const router = Router()

function resolveChromium(): string | undefined {
  const fs = require('fs')
  const { execSync } = require('child_process')

  try {
    const found = execSync(
      'which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || which google-chrome 2>/dev/null',
      { encoding: 'utf8', timeout: 3000 }
    ).trim().split('\n')[0]
    if (found) return found
  } catch { /* shell not available */ }

  const exists = (p: string) => { try { return fs.existsSync(p) } catch { return false } }
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/root/.nix-profile/bin/chromium',
    '/nix/var/nix/profiles/default/bin/chromium',
    '/run/current-system/sw/bin/chromium',
  ].filter(Boolean) as string[]
  return candidates.find(exists)
}


function blockTypeLabel(blockType: string): string {
  switch (blockType) {
    case 'scene_heading': return 'scene_heading'
    case 'action': return 'action'
    case 'character': return 'character'
    case 'dialogue': return 'dialogue'
    case 'parenthetical': return 'parenthetical'
    case 'transition': return 'transition'
    default: return blockType
  }
}

function renderBlock(block: any): string {
  const content = (block.content || '').replace(/\n/g, '<br>')
  switch (block.block_type) {
    case 'scene_heading':
      return `<p class="scene-heading">${content}</p>`
    case 'action':
      return `<p class="action">${content}</p>`
    case 'character':
      return `<p class="character">${content}</p>`
    case 'dialogue':
      return `<p class="dialogue">${content}</p>`
    case 'parenthetical':
      return `<p class="parenthetical">${content}</p>`
    case 'transition':
      return `<p class="transition">${content}</p>`
    default:
      return `<p>${content}</p>`
  }
}

function buildSidesHtml(shootDay: any, scenes: Array<{ scene: any; blocks: any[] }>): string {
  const dateStr = shootDay.date
    ? new Date(shootDay.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
  const dayNum = shootDay.day_number ?? '?'

  const sceneHtml = scenes.map(({ scene, blocks }) => {
    const heading = `${scene.int_ext || ''} ${scene.title || ''} — ${scene.day_night || ''}`.trim().toUpperCase()
    const blockHtml = blocks.map(renderBlock).join('\n')
    return `
      <div class="scene">
        <div class="scene-number">Szene ${scene.scene_number || ''}</div>
        <div class="scene-title">${heading}</div>
        ${blockHtml}
      </div>
    `
  }).join('<hr class="scene-divider">')

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; background: #fff; }
  .watermark-header {
    text-align: center;
    font-weight: bold;
    font-size: 13px;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
    margin-bottom: 16px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .scene { margin-bottom: 16px; }
  .scene-number { font-size: 10px; color: #555; margin-bottom: 2px; }
  .scene-title { font-weight: bold; text-transform: uppercase; margin-bottom: 8px; }
  .scene-heading { font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
  .action { margin-bottom: 6px; }
  .character { text-align: center; font-weight: bold; margin-bottom: 2px; margin-top: 8px; }
  .dialogue { margin: 0 20% 6px; }
  .parenthetical { margin: 0 25% 2px; font-style: italic; }
  .transition { text-align: right; font-weight: bold; margin-bottom: 8px; }
  hr.scene-divider { border: none; border-top: 1px dashed #ccc; margin: 16px 0; }
</style>
</head>
<body>
  <div class="watermark-header">SIDES — ${dateStr} — DREHTAG ${dayNum}</div>
  ${sceneHtml}
</body>
</html>`
}

// GET /api/shoot-days/:dayId/script-sides/pdf?cast_id=X
router.get('/shoot-days/:dayId/script-sides/pdf', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

    const { dayId } = req.params
    const castId = req.query.cast_id ? Number(req.query.cast_id) : null

    // 1. Get shoot day
    const shootDay = await db.get('SELECT * FROM shoot_days WHERE id = ?', [dayId]) as any
    if (!shootDay) return res.status(404).json({ data: null, error: 'Drehtag nicht gefunden' })

    // 2. Get scenes for this shoot day
    let scenes = await db.all(`
      SELECT s.* FROM shoot_day_scenes sds
      JOIN scenes s ON s.id = sds.scene_id
      WHERE sds.shoot_day_id = ?
      ORDER BY sds.sort_order ASC
    `, [dayId]) as any[]

    // 3. If cast_id provided, filter to scenes where that cast member's character appears
    if (castId) {
      const castMember = await db.get(`
        SELECT c.*, ch.id as char_id FROM "cast" c
        LEFT JOIN characters ch ON ch.id = c.character_id
        WHERE c.id = ?
      `, [castId]) as any

      if (castMember?.char_id) {
        const castSceneIds = await db.all(`
          SELECT scene_id FROM scene_characters WHERE character_id = ?
        `, [castMember.char_id]) as any[]
        const sceneIdSet = new Set(castSceneIds.map((r: any) => r.scene_id))
        scenes = scenes.filter((s: any) => sceneIdSet.has(s.id))
      }
    }

    if (scenes.length === 0) {
      return res.status(404).json({ data: null, error: 'Keine Szenen für diese Seite gefunden' })
    }

    // 4. Load screenplay blocks for each scene
    const scenesWithBlocks = await Promise.all(scenes.map(async (scene: any) => {
      const blocks = await db.all(`
        SELECT * FROM screenplay_blocks WHERE scene_id = ? ORDER BY sort_order ASC
      `, [scene.id]) as any[]
      return { scene, blocks }
    }))

    // 5. Generate HTML and PDF
    const html = buildSidesHtml(shootDay, scenesWithBlocks)
    // Sides bringen ihre Seitenzahlen im Drehbuchsatz selbst mit
    const pdfBuffer = await generatePdf(html, { footer: false })

    const dateStr = shootDay.date
      ? new Date(shootDay.date).toISOString().slice(0, 10)
      : `tag-${shootDay.day_number}`
    const filename = `sides-${dateStr}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdfBuffer)
  } catch (err: any) {
    console.error('[scriptSides GET pdf]', err)
    res.status(500).json({ data: null, error: err.message || 'Interner Serverfehler' })
  }
})

export default router
