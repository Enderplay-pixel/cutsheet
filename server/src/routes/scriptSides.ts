import { Router, Request, Response } from 'express'
import { db } from '../db'
import { generatePdf } from './pdf'
import { requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import {
  layoutScreenplay, renderScreenplayHtml, type SceneInput,
} from '../lib/screenplayFormat'

const router = Router()

// Sides enthalten Drehbuchinhalt — nur fuer Projektbeteiligte
router.use('/shoot-days/:dayId', requireMemberVia(projectIdFromTable('shoot_days', 'dayId')))

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



/**
 * Sides sind Auszuege aus dem Drehbuch — also werden sie auch wie Drehbuch
 * gesetzt. Frueher brachten sie eigenes CSS mit px-Groessen und Prozentraendern
 * mit; Schriftbild und Zeilenraster wichen dadurch vom Drehbuch ab, aus dem sie
 * stammen. Jetzt laeuft beides durch denselben Satz.
 */
function buildSidesHtml(shootDay: any, scenes: Array<{ scene: any; blocks: any[] }>): string {
  const sceneInputs: SceneInput[] = scenes.map(({ scene, blocks }) => {
    if (blocks.length > 0) return { scene_number: scene.scene_number, blocks }

    // Szene ohne Bloecke: Ueberschrift aus den Metadaten bauen, damit sie nicht
    // stillschweigend fehlt
    const intExt = String(scene.int_ext || 'INT').toUpperCase()
    const heading = [
      `${intExt}.`,
      String(scene.title || `SZENE ${scene.scene_number}`).toUpperCase(),
      scene.day_night ? `\u2013 ${String(scene.day_night).toUpperCase()}` : '',
    ].filter(Boolean).join(' ')
    return { scene_number: scene.scene_number, blocks: [{ block_type: 'scene_heading', content: heading }] }
  })

  const datum = shootDay.date
    ? new Date(shootDay.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''
  const nummern = scenes.map(({ scene }) => scene.scene_number).filter(Boolean).join(', ')
  const kopf = [
    `Sides \u2013 Drehtag ${shootDay.day_number ?? '?'}`,
    datum,
    nummern ? `Sz. ${nummern}` : '',
  ].filter(Boolean).join('  \u00b7  ')

  return renderScreenplayHtml(layoutScreenplay(sceneInputs), {
    paper: 'a4',
    docTitle: kopf,
    header: kopf,
  })
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
