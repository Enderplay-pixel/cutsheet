import { Router, Request, Response } from 'express'
import { db } from '../db'
import { generatePdf } from './pdf'
import { requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import {
  layoutScreenplay, renderScreenplayHtml, type SceneInput,
} from '../lib/screenplayFormat'
import { mitUeberschrift } from '../lib/szenenUeberschrift'
import { istIsoDatum } from '../lib/datum'

const router = Router()

// Sides enthalten Drehbuchinhalt - nur für Projektbeteiligte
router.use('/shoot-days/:dayId', requireMemberVia(projectIdFromTable('shoot_days', 'dayId')))

/**
 * Sides sind Auszüge aus dem Drehbuch - also werden sie auch wie Drehbuch
 * gesetzt. Früher brachten sie eigenes CSS mit px-Größen und Prozenträndern
 * mit; Schriftbild und Zeilenraster wichen dadurch vom Drehbuch ab, aus dem sie
 * stammen. Jetzt läuft beides durch denselben Satz.
 */
function buildSidesHtml(shootDay: any, scenes: Array<{ scene: any; blocks: any[] }>): string {
  // Fehlt die Überschrift, ergänzt sie derselbe Helfer wie im Drehbuch-PDF.
  // Vorher nur bei Szenen ganz ohne Blöcke - gemessen am 25.10.2026 stand eine
  // Szene mit Aktionsblock, aber ohne Überschriftenblock kopflos in den Sides,
  // und die selbst gebaute Zeile trug einen Gedankenstrich.
  const sceneInputs: SceneInput[] = scenes.map(({ scene, blocks }) => ({
    scene_number: scene.scene_number,
    blocks: mitUeberschrift(scene, blocks) as SceneInput['blocks'],
  }))

  const datum = shootDay.date
    ? new Date(shootDay.date).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''
  const nummern = scenes.map(({ scene }) => scene.scene_number).filter(Boolean).join(', ')
  const kopf = [
    `Sides - Drehtag ${shootDay.day_number ?? '?'}`,
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
  // Das Datum ist Text; ein ungültiges warf vorher in toISOString() einen 500
  const dateStr = istIsoDatum(shootDay.date) ? String(shootDay.date) : `tag-${shootDay.day_number}`
  const filename = `sides-${dateStr}.pdf`

  try {
    // Sides bringen ihre Seitenzahlen im Drehbuchsatz selbst mit
    const pdfBuffer = await generatePdf(html, { footer: false })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(pdfBuffer)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

export default router
