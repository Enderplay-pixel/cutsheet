import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole } from '../middleware/projectAuth'
import {
  DEFAULT_SECTIONS,
  DEFAULT_WPM,
  buildTimeline,
  buildChapters,
  renderCreatorScriptHtml,
} from '../lib/creatorScript'
import { generatePdf } from './pdf'

const router = Router()

/** Pipeline-Stufen eines Videos, in der Reihenfolge des Workflows. */
export const VIDEO_STATUS = ['Idee', 'Skript', 'Dreh', 'Schnitt', 'Thumbnail', 'Upload', 'Veröffentlicht'] as const

router.use('/projects/:projectId', requireMember)

/**
 * Zugriff über die Video-ID prüfen. Die Videorouten hängen nicht unter
 * /projects/:projectId, deshalb muss die Projektzugehörigkeit hier von Hand
 * aufgelöst werden — gleiche Logik wie requireMember.
 */
async function loadVideoForUser(req: Request, res: Response): Promise<any | null> {
  const user = (req as any).user
  if (!user) { res.status(401).json({ data: null, error: 'Nicht authentifiziert' }); return null }

  const video = await db.get('SELECT * FROM creator_videos WHERE id = ?', [req.params.videoId]) as any
  if (!video) { res.status(404).json({ data: null, error: 'Video nicht gefunden' }); return null }

  if (user.role !== 'admin' && getUserProjectRole(user.id, video.project_id) === null) {
    res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    return null
  }
  return video
}

// ─── Videos ───────────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/creator/videos
router.get('/projects/:projectId/creator/videos', async (req, res) => {
  const videos = await db.all(`
    SELECT * FROM creator_videos WHERE project_id = ?
    ORDER BY sort_order ASC, id ASC
  `, [req.params.projectId]) as any[]

  // Laufzeit und Wortzahl je Video mitliefern, damit die Übersicht sie ohne
  // Zusatz-Requests anzeigen kann
  const enriched = await Promise.all(videos.map(async v => {
    const sections = await db.all(
      'SELECT kind, heading, spoken, visuals, target_seconds FROM creator_script_sections WHERE video_id = ? ORDER BY sort_order ASC',
      [v.id]
    ) as any[]
    const t = buildTimeline(sections, v.wpm || DEFAULT_WPM)
    return { ...v, section_count: sections.length, total_seconds: t.totalSeconds, total_words: t.totalWords }
  }))

  res.json({ data: enriched, error: null })
})

// POST /api/projects/:projectId/creator/videos
router.post('/projects/:projectId/creator/videos', async (req, res) => {
  const { projectId } = req.params
  const { title = '', platform = 'YouTube', hook = '', target_seconds = 0, withTemplate = true } = req.body

  const maxRow = await db.get(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM creator_videos WHERE project_id = ?',
    [projectId]
  ) as { m: number }

  const result = await db.run(`
    INSERT INTO creator_videos (project_id, title, platform, hook, target_seconds, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [projectId, title, platform, hook, Math.max(0, Number(target_seconds) || 0), maxRow.m + 1])

  // Neues Video direkt mit der üblichen Gliederung befüllen — ein leeres
  // Skript hilft niemandem
  if (withTemplate) {
    let order = 0
    for (const s of DEFAULT_SECTIONS) {
      await db.run(`
        INSERT INTO creator_script_sections (video_id, project_id, kind, heading, target_seconds, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [result.id, projectId, s.kind, s.heading, s.target_seconds, order++])
    }
  }

  const video = await db.get('SELECT * FROM creator_videos WHERE id = ?', [result.id])
  res.status(201).json({ data: video, error: null })
})

const VIDEO_FIELDS = [
  'title', 'status', 'platform', 'hook', 'target_seconds', 'wpm', 'publish_at',
  'title_variants', 'thumbnail_ideas', 'description', 'tags', 'sort_order',
] as const

// PUT /api/creator/videos/:videoId
router.put('/creator/videos/:videoId', async (req, res) => {
  if (!await loadVideoForUser(req, res)) return

  const sets: string[] = []
  const params: any[] = []
  for (const f of VIDEO_FIELDS) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = ?`)
      params.push(req.body[f])
    }
  }
  if (sets.length === 0) return res.status(400).json({ data: null, error: 'Keine Felder zum Aktualisieren' })

  params.push(req.params.videoId)
  await db.run(`UPDATE creator_videos SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, params)

  const video = await db.get('SELECT * FROM creator_videos WHERE id = ?', [req.params.videoId])
  res.json({ data: video, error: null })
})

// DELETE /api/creator/videos/:videoId
router.delete('/creator/videos/:videoId', async (req, res) => {
  if (!await loadVideoForUser(req, res)) return
  await db.run('DELETE FROM creator_videos WHERE id = ?', [req.params.videoId])
  res.json({ data: { ok: true }, error: null })
})

// ─── Skript-Abschnitte ────────────────────────────────────────────────────────

// GET /api/creator/videos/:videoId — Video mit Abschnitten und Zeitachse
router.get('/creator/videos/:videoId', async (req, res) => {
  const video = await loadVideoForUser(req, res)
  if (!video) return

  const sections = await db.all(
    'SELECT * FROM creator_script_sections WHERE video_id = ? ORDER BY sort_order ASC, id ASC',
    [video.id]
  ) as any[]

  const wpm = video.wpm || DEFAULT_WPM
  const timeline = buildTimeline(sections, wpm)
  const chapters = buildChapters(sections, wpm)

  res.json({
    data: {
      video,
      sections: timeline.sections,
      total_seconds: timeline.totalSeconds,
      total_words: timeline.totalWords,
      target_seconds: timeline.targetSeconds,
      chapters,
    },
    error: null,
  })
})

// POST /api/creator/videos/:videoId/sections
router.post('/creator/videos/:videoId/sections', async (req, res) => {
  const video = await loadVideoForUser(req, res)
  if (!video) return

  const { kind = 'segment', heading = '', spoken = '', visuals = '', target_seconds = 0, sort_order } = req.body

  // Wie im Drehbuch-Editor: an eine Position einfügen und den Rest nachrücken
  const maxRow = await db.get(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM creator_script_sections WHERE video_id = ?',
    [video.id]
  ) as { m: number }
  const requested = Number(sort_order)
  const target = Number.isFinite(requested) ? Math.max(0, Math.ceil(requested)) : maxRow.m + 1

  await db.run(
    'UPDATE creator_script_sections SET sort_order = sort_order + 1 WHERE video_id = ? AND sort_order >= ?',
    [video.id, target]
  )

  const result = await db.run(`
    INSERT INTO creator_script_sections (video_id, project_id, kind, heading, spoken, visuals, target_seconds, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [video.id, video.project_id, kind, heading, spoken, visuals, Math.max(0, Number(target_seconds) || 0), target])

  const section = await db.get('SELECT * FROM creator_script_sections WHERE id = ?', [result.id])
  res.status(201).json({ data: section, error: null })
})

// PUT /api/creator/sections/:sectionId
router.put('/creator/sections/:sectionId', async (req, res) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM creator_script_sections WHERE id = ?', [req.params.sectionId]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Abschnitt nicht gefunden' })
  if (user.role !== 'admin' && getUserProjectRole(user.id, existing.project_id) === null) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const fields = ['kind', 'heading', 'spoken', 'visuals', 'target_seconds', 'sort_order'] as const
  const sets: string[] = []
  const params: any[] = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]) }
  }
  if (sets.length === 0) return res.status(400).json({ data: null, error: 'Keine Felder zum Aktualisieren' })

  params.push(req.params.sectionId)
  await db.run(`UPDATE creator_script_sections SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, params)

  const section = await db.get('SELECT * FROM creator_script_sections WHERE id = ?', [req.params.sectionId])
  res.json({ data: section, error: null })
})

// DELETE /api/creator/sections/:sectionId
router.delete('/creator/sections/:sectionId', async (req, res) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const existing = await db.get('SELECT * FROM creator_script_sections WHERE id = ?', [req.params.sectionId]) as any
  if (!existing) return res.status(404).json({ data: null, error: 'Abschnitt nicht gefunden' })
  if (user.role !== 'admin' && getUserProjectRole(user.id, existing.project_id) === null) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  await db.run('DELETE FROM creator_script_sections WHERE id = ?', [req.params.sectionId])
  res.json({ data: { ok: true }, error: null })
})

// PUT /api/creator/videos/:videoId/sections/reorder
router.put('/creator/videos/:videoId/sections/reorder', async (req, res) => {
  const video = await loadVideoForUser(req, res)
  if (!video) return

  const { sections } = req.body as { sections: Array<{ id: number; sort_order: number }> }
  if (!Array.isArray(sections)) return res.status(400).json({ data: null, error: 'sections muss ein Array sein' })

  for (const s of sections) {
    await db.run(
      'UPDATE creator_script_sections SET sort_order = ?, updated_at = NOW() WHERE id = ? AND video_id = ?',
      [Math.max(0, Math.floor(Number(s.sort_order) || 0)), s.id, video.id]
    )
  }
  res.json({ data: { ok: true }, error: null })
})

// ─── PDF ──────────────────────────────────────────────────────────────────────

// GET /api/creator/videos/:videoId/pdf
router.get('/creator/videos/:videoId/pdf', async (req, res) => {
  const video = await loadVideoForUser(req, res)
  if (!video) return

  const sections = await db.all(
    'SELECT * FROM creator_script_sections WHERE video_id = ? ORDER BY sort_order ASC, id ASC',
    [video.id]
  ) as any[]
  const project = await db.get('SELECT title FROM projects WHERE id = ?', [video.project_id]) as any

  const html = renderCreatorScriptHtml(video, sections, {
    wpm: video.wpm || DEFAULT_WPM,
    projectTitle: project?.title,
  })

  try {
    const pdf = await generatePdf(html)
    const slug = String(video.title || 'video').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="skript-${slug}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

export default router
