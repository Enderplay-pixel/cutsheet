import { dateiname } from '../lib/dateiname'
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
import {
  UPLOAD_CHECKLIST,
  ideaScore,
  checkClip,
  assessRights,
  analysePerformance,
  analyseCadence,
} from '../lib/creatorInsights'
import { generatePdf } from './pdf'
import * as areas from '../lib/creatorAreas'

const router = Router()

/** Pipeline-Stufen eines Videos, in der Reihenfolge des Workflows. */
export const VIDEO_STATUS = ['Idee', 'Skript', 'Dreh', 'Schnitt', 'Thumbnail', 'Upload', 'Veröffentlicht'] as const

router.use('/projects/:projectId', requireMember)

/**
 * Zugriff über die Video-ID prüfen. Die Videorouten hängen nicht unter
 * /projects/:projectId, deshalb muss die Projektzugehörigkeit hier von Hand
 * aufgelöst werden - gleiche Logik wie requireMember.
 */
async function loadVideoForUser(req: Request, res: Response): Promise<any | null> {
  const user = (req as any).user
  if (!user) { res.status(401).json({ data: null, error: 'Nicht authentifiziert' }); return null }

  const video = await db.get('SELECT * FROM creator_videos WHERE id = ?', [req.params.videoId]) as any
  if (!video) { res.status(404).json({ data: null, error: 'Video nicht gefunden' }); return null }

  // await ist hier nicht optional: ohne es vergleicht der Ausdruck ein
  // Promise mit null, wird nie wahr, und die Pruefung laesst jeden durch.
  if (user.role !== 'admin' && (await getUserProjectRole(user.id, video.project_id)) === null) {
    res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    return null
  }
  return video
}


/**
 * Befüllt ein frisch angelegtes Video mit der üblichen Gliederung und der
 * Upload-Checkliste. Beides soll da sein, bevor es gebraucht wird - ein leeres
 * Skript hilft niemandem, und eine Checkliste kommt zu spät, wenn schon etwas
 * vergessen wurde.
 */
async function seedVideoDefaults(videoId: number, projectId: number, withSections = true): Promise<void> {
  if (withSections) {
    let order = 0
    for (const sec of DEFAULT_SECTIONS) {
      await db.run(
        'INSERT INTO creator_script_sections (video_id, project_id, kind, heading, target_seconds, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [videoId, projectId, sec.kind, sec.heading, sec.target_seconds, order++]
      )
    }
  }
  let checkOrder = 0
  for (const label of UPLOAD_CHECKLIST) {
    await db.run(
      'INSERT INTO creator_checklist (video_id, project_id, label, sort_order) VALUES (?, ?, ?, ?)',
      [videoId, projectId, label, checkOrder++]
    )
  }
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

  await seedVideoDefaults(result.id, Number(projectId), withTemplate)

  const video = await db.get('SELECT * FROM creator_videos WHERE id = ?', [result.id])
  res.status(201).json({ data: video, error: null })
})

const VIDEO_FIELDS = [
  'title', 'status', 'platform', 'hook', 'target_seconds', 'wpm', 'publish_at',
  'title_variants', 'thumbnail_ideas', 'description', 'tags', 'sort_order',
  'series', 'keyword', 'video_url', 'published_at', 'youtube_video_id',
  'views', 'impressions', 'avg_view_seconds', 'likes', 'comments', 'subs_gained',
  // duration_seconds fehlte hier, obwohl die Spalte existiert und die
  // Performance-Auswertung damit die Haltequote rechnet. Gemessen am
  // 27.09.2026: 310 Sekunden gesehen bei Videolaenge 0 - die Haltequote war
  // fuer jedes von Hand gepflegte Video leer, weil die Laenge nur ueber die
  // YouTube-Anbindung hereinkam.
  'duration_seconds',
  'sponsor_brand', 'sponsor_fee_cents', 'sponsor_deliverables', 'sponsor_deadline', 'sponsor_disclosed',
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
  const video = await loadVideoForUser(req, res)
  if (!video) return

  // Ein geloeschtes YouTube-Video soll beim naechsten Abgleich nicht wieder
  // auftauchen - die Loeschung ist eine Entscheidung, kein Versehen.
  if (video.youtube_video_id) {
    await db.run(
      // RETURNING ausdruecklich: db.run haengt sonst "RETURNING id" an, und
      // diese Tabelle hat keine Spalte id.
      'INSERT INTO creator_youtube_ignored (project_id, youtube_video_id) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING project_id',
      [video.project_id, video.youtube_video_id]
    )
  }

  await db.run('DELETE FROM creator_videos WHERE id = ?', [req.params.videoId])
  res.json({ data: { ok: true }, error: null })
})

// ─── Skript-Abschnitte ────────────────────────────────────────────────────────

// GET /api/creator/videos/:videoId - Video mit Abschnitten und Zeitachse
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

  const [assets, clips, checklist] = await Promise.all([
    db.all('SELECT * FROM creator_assets WHERE video_id = ? ORDER BY id ASC', [video.id]) as Promise<any[]>,
    db.all('SELECT * FROM creator_clips WHERE video_id = ? ORDER BY sort_order ASC, id ASC', [video.id]) as Promise<any[]>,
    db.all('SELECT * FROM creator_checklist WHERE video_id = ? ORDER BY sort_order ASC, id ASC', [video.id]) as Promise<any[]>,
  ])

  res.json({
    data: {
      video,
      sections: timeline.sections,
      total_seconds: timeline.totalSeconds,
      total_words: timeline.totalWords,
      target_seconds: timeline.targetSeconds,
      chapters,
      assets,
      // Jeder Clip bringt seine Pruefung mit, damit die Oberflaeche die Regeln
      // nicht doppelt kennen muss
      clips: clips.map(c => ({ ...c, check: checkClip(c, timeline.totalSeconds) })),
      checklist,
      checklist_done: checklist.filter(c => c.done).length,
      rights: assessRights(assets),
      performance: analysePerformance(video, timeline.totalSeconds),
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
  if (user.role !== 'admin' && (await getUserProjectRole(user.id, existing.project_id)) === null) {
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
  if (user.role !== 'admin' && (await getUserProjectRole(user.id, existing.project_id)) === null) {
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


// ─── Ideen-Backlog ────────────────────────────────────────────────────────────

/** Wirkung und Aufwand liegen zwischen 1 und 5. */
function clampScore(n: any): number {
  const v = Math.round(Number(n))
  return Math.min(5, Math.max(1, Number.isFinite(v) ? v : 3))
}

/** Idee laden und Zugriff prüfen - Ideen hängen am Projekt, nicht am Video. */
async function loadIdeaForUser(req: Request, res: Response): Promise<any | null> {
  const user = (req as any).user
  if (!user) { res.status(401).json({ data: null, error: 'Nicht authentifiziert' }); return null }

  const idea = await db.get('SELECT * FROM creator_ideas WHERE id = ?', [req.params.ideaId]) as any
  if (!idea) { res.status(404).json({ data: null, error: 'Idee nicht gefunden' }); return null }
  if (user.role !== 'admin' && (await getUserProjectRole(user.id, idea.project_id)) === null) {
    res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    return null
  }
  return idea
}

/** Gemeinsamer Zugriffscheck für Unter-Objekte eines Videos. */
async function loadOwnedRow(req: Request, res: Response, table: string, idParam: string): Promise<any | null> {
  const user = (req as any).user
  if (!user) { res.status(401).json({ data: null, error: 'Nicht authentifiziert' }); return null }

  // table stammt ausschließlich aus festen Literalen unten, nie aus Nutzereingaben
  const row = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [req.params[idParam]]) as any
  if (!row) { res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' }); return null }
  if (user.role !== 'admin' && (await getUserProjectRole(user.id, row.project_id)) === null) {
    res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
    return null
  }
  return row
}

// GET /api/projects/:projectId/creator/ideas
router.get('/projects/:projectId/creator/ideas', async (req, res) => {
  const ideas = await db.all(
    'SELECT * FROM creator_ideas WHERE project_id = ? ORDER BY id DESC',
    [req.params.projectId]
  ) as any[]

  // Offene zuerst, darin die mit dem besten Verhältnis aus Wirkung und Aufwand
  const scored = ideas.map(i => ({ ...i, score: ideaScore(i.impact, i.effort) }))
  const rank = (s: string) => (s === 'offen' ? 0 : s === 'geplant' ? 1 : 2)
  scored.sort((a, b) => (a.status !== b.status ? rank(a.status) - rank(b.status) : b.score - a.score))

  res.json({ data: scored, error: null })
})

// POST /api/projects/:projectId/creator/ideas
router.post('/projects/:projectId/creator/ideas', async (req, res) => {
  const { title = '', note = '', impact = 3, effort = 3 } = req.body
  if (!String(title).trim()) return res.status(400).json({ data: null, error: 'Titel erforderlich' })

  const result = await db.run(
    'INSERT INTO creator_ideas (project_id, title, note, impact, effort) VALUES (?, ?, ?, ?, ?)',
    [req.params.projectId, String(title).trim(), note, clampScore(impact), clampScore(effort)]
  )
  const idea = await db.get('SELECT * FROM creator_ideas WHERE id = ?', [result.id]) as any
  res.status(201).json({ data: { ...idea, score: ideaScore(idea.impact, idea.effort) }, error: null })
})

// PUT /api/creator/ideas/:ideaId
router.put('/creator/ideas/:ideaId', async (req, res) => {
  if (!await loadIdeaForUser(req, res)) return

  const sets: string[] = []
  const params: any[] = []
  for (const f of ['title', 'note', 'status'] as const) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]) }
  }
  for (const f of ['impact', 'effort'] as const) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(clampScore(req.body[f])) }
  }
  if (sets.length === 0) return res.status(400).json({ data: null, error: 'Keine Felder zum Aktualisieren' })

  params.push(req.params.ideaId)
  await db.run(`UPDATE creator_ideas SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, params)

  const idea = await db.get('SELECT * FROM creator_ideas WHERE id = ?', [req.params.ideaId]) as any
  res.json({ data: { ...idea, score: ideaScore(idea.impact, idea.effort) }, error: null })
})

// DELETE /api/creator/ideas/:ideaId
router.delete('/creator/ideas/:ideaId', async (req, res) => {
  if (!await loadIdeaForUser(req, res)) return
  await db.run('DELETE FROM creator_ideas WHERE id = ?', [req.params.ideaId])
  res.json({ data: { ok: true }, error: null })
})

// POST /api/creator/ideas/:ideaId/convert - aus der Idee ein Video machen
router.post('/creator/ideas/:ideaId/convert', async (req, res) => {
  const idea = await loadIdeaForUser(req, res)
  if (!idea) return
  if (idea.video_id) return res.status(409).json({ data: null, error: 'Aus dieser Idee wurde bereits ein Video' })

  const maxRow = await db.get(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM creator_videos WHERE project_id = ?',
    [idea.project_id]
  ) as { m: number }

  const result = await db.run(
    'INSERT INTO creator_videos (project_id, title, hook, sort_order) VALUES (?, ?, ?, ?)',
    [idea.project_id, idea.title, idea.note, maxRow.m + 1]
  )
  await seedVideoDefaults(result.id, idea.project_id)

  await db.run(
    'UPDATE creator_ideas SET status = ?, video_id = ?, updated_at = NOW() WHERE id = ?',
    ['geplant', result.id, idea.id]
  )

  const video = await db.get('SELECT * FROM creator_videos WHERE id = ?', [result.id])
  res.status(201).json({ data: video, error: null })
})

// ─── Material und Rechte ──────────────────────────────────────────────────────

// POST /api/creator/videos/:videoId/assets
router.post('/creator/videos/:videoId/assets', async (req, res) => {
  const video = await loadVideoForUser(req, res)
  if (!video) return

  const { kind = 'musik', name = '', source = '', license = '', url = '', claim_risk = 'keins' } = req.body
  const result = await db.run(
    'INSERT INTO creator_assets (video_id, project_id, kind, name, source, license, url, claim_risk) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [video.id, video.project_id, kind, name, source, license, url, claim_risk]
  )
  res.status(201).json({ data: await db.get('SELECT * FROM creator_assets WHERE id = ?', [result.id]), error: null })
})

// PUT /api/creator/assets/:assetId
router.put('/creator/assets/:assetId', async (req, res) => {
  if (!await loadOwnedRow(req, res, 'creator_assets', 'assetId')) return

  const sets: string[] = []
  const params: any[] = []
  for (const f of ['kind', 'name', 'source', 'license', 'url', 'claim_risk'] as const) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]) }
  }
  if (sets.length === 0) return res.status(400).json({ data: null, error: 'Keine Felder zum Aktualisieren' })

  params.push(req.params.assetId)
  await db.run(`UPDATE creator_assets SET ${sets.join(', ')} WHERE id = ?`, params)
  res.json({ data: await db.get('SELECT * FROM creator_assets WHERE id = ?', [req.params.assetId]), error: null })
})

// DELETE /api/creator/assets/:assetId
router.delete('/creator/assets/:assetId', async (req, res) => {
  if (!await loadOwnedRow(req, res, 'creator_assets', 'assetId')) return
  await db.run('DELETE FROM creator_assets WHERE id = ?', [req.params.assetId])
  res.json({ data: { ok: true }, error: null })
})

// ─── Auskopplungen (Shorts, Reels, TikTok) ────────────────────────────────────

// POST /api/creator/videos/:videoId/clips
router.post('/creator/videos/:videoId/clips', async (req, res) => {
  const video = await loadVideoForUser(req, res)
  if (!video) return

  const { title = '', start_seconds = 0, end_seconds = 0, platform = 'YouTube Shorts', note = '' } = req.body
  const maxRow = await db.get(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM creator_clips WHERE video_id = ?',
    [video.id]
  ) as { m: number }

  const result = await db.run(
    'INSERT INTO creator_clips (video_id, project_id, title, start_seconds, end_seconds, platform, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      video.id, video.project_id, title,
      Math.max(0, Math.floor(Number(start_seconds) || 0)),
      Math.max(0, Math.floor(Number(end_seconds) || 0)),
      platform, note, maxRow.m + 1,
    ]
  )
  res.status(201).json({ data: await db.get('SELECT * FROM creator_clips WHERE id = ?', [result.id]), error: null })
})

// PUT /api/creator/clips/:clipId
router.put('/creator/clips/:clipId', async (req, res) => {
  if (!await loadOwnedRow(req, res, 'creator_clips', 'clipId')) return

  const sets: string[] = []
  const params: any[] = []
  for (const f of ['title', 'platform', 'status', 'note'] as const) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(req.body[f]) }
  }
  for (const f of ['start_seconds', 'end_seconds', 'sort_order'] as const) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); params.push(Math.max(0, Math.floor(Number(req.body[f]) || 0))) }
  }
  if (sets.length === 0) return res.status(400).json({ data: null, error: 'Keine Felder zum Aktualisieren' })

  params.push(req.params.clipId)
  await db.run(`UPDATE creator_clips SET ${sets.join(', ')} WHERE id = ?`, params)
  res.json({ data: await db.get('SELECT * FROM creator_clips WHERE id = ?', [req.params.clipId]), error: null })
})

// DELETE /api/creator/clips/:clipId
router.delete('/creator/clips/:clipId', async (req, res) => {
  if (!await loadOwnedRow(req, res, 'creator_clips', 'clipId')) return
  await db.run('DELETE FROM creator_clips WHERE id = ?', [req.params.clipId])
  res.json({ data: { ok: true }, error: null })
})

// ─── Upload-Checkliste ────────────────────────────────────────────────────────

// PUT /api/creator/checklist/:itemId
router.put('/creator/checklist/:itemId', async (req, res) => {
  if (!await loadOwnedRow(req, res, 'creator_checklist', 'itemId')) return

  const sets: string[] = []
  const params: any[] = []
  if (req.body.done !== undefined) { sets.push('done = ?'); params.push(Boolean(req.body.done)) }
  if (req.body.label !== undefined) { sets.push('label = ?'); params.push(req.body.label) }
  if (sets.length === 0) return res.status(400).json({ data: null, error: 'Keine Felder zum Aktualisieren' })

  params.push(req.params.itemId)
  await db.run(`UPDATE creator_checklist SET ${sets.join(', ')} WHERE id = ?`, params)
  res.json({ data: await db.get('SELECT * FROM creator_checklist WHERE id = ?', [req.params.itemId]), error: null })
})

// POST /api/creator/videos/:videoId/checklist - eigenen Punkt ergänzen
router.post('/creator/videos/:videoId/checklist', async (req, res) => {
  const video = await loadVideoForUser(req, res)
  if (!video) return
  const label = String(req.body.label ?? '').trim()
  if (!label) return res.status(400).json({ data: null, error: 'Text erforderlich' })

  const maxRow = await db.get(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM creator_checklist WHERE video_id = ?',
    [video.id]
  ) as { m: number }
  const result = await db.run(
    'INSERT INTO creator_checklist (video_id, project_id, label, sort_order) VALUES (?, ?, ?, ?)',
    [video.id, video.project_id, label, maxRow.m + 1]
  )
  res.status(201).json({ data: await db.get('SELECT * FROM creator_checklist WHERE id = ?', [result.id]), error: null })
})

// DELETE /api/creator/checklist/:itemId
router.delete('/creator/checklist/:itemId', async (req, res) => {
  if (!await loadOwnedRow(req, res, 'creator_checklist', 'itemId')) return
  await db.run('DELETE FROM creator_checklist WHERE id = ?', [req.params.itemId])
  res.json({ data: { ok: true }, error: null })
})

// ─── Kanal-Auswertung ─────────────────────────────────────────────────────────

// GET /api/projects/:projectId/creator/overview
router.get('/projects/:projectId/creator/overview', async (req, res) => {
  const videos = await db.all(
    'SELECT * FROM creator_videos WHERE project_id = ? ORDER BY COALESCE(published_at, publish_at) ASC',
    [req.params.projectId]
  ) as any[]

  const published = videos.filter(v => v.published_at)
  const cadence = analyseCadence(published.map(v => v.published_at))
  const planned = videos.filter(v => v.publish_at && !v.published_at)

  const totals = published.reduce((acc, v) => ({
    views: acc.views + (v.views || 0),
    likes: acc.likes + (v.likes || 0),
    subs: acc.subs + (v.subs_gained || 0),
  }), { views: 0, likes: 0, subs: 0 })

  res.json({
    data: {
      video_count: videos.length,
      published_count: published.length,
      planned_count: planned.length,
      cadence,
      totals,
      sponsor_fee_cents: videos.reduce((n, v) => n + (v.sponsor_fee_cents || 0), 0),
      calendar: videos
        .filter(v => v.publish_at || v.published_at)
        .map(v => ({
          id: v.id,
          title: v.title,
          status: v.status,
          platform: v.platform,
          date: v.published_at || v.publish_at,
          published: Boolean(v.published_at),
        })),
    },
    error: null,
  })
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

  // Produktionsteile mitgeben: das PDF ist das Blatt, das beim Dreh und beim
  // Upload danebenliegt
  const [assets, clips, checklist] = await Promise.all([
    db.all('SELECT * FROM creator_assets WHERE video_id = ? ORDER BY id ASC', [video.id]) as Promise<any[]>,
    db.all('SELECT * FROM creator_clips WHERE video_id = ? ORDER BY sort_order ASC, id ASC', [video.id]) as Promise<any[]>,
    db.all('SELECT * FROM creator_checklist WHERE video_id = ? ORDER BY sort_order ASC, id ASC', [video.id]) as Promise<any[]>,
  ])

  const html = renderCreatorScriptHtml(video, sections, {
    wpm: video.wpm || DEFAULT_WPM,
    projectTitle: project?.title,
    assets,
    clips,
    checklist,
  })

  try {
    const pdf = await generatePdf(html)
    const slug = dateiname(video.title, 'video')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="skript-${slug}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

// ─── Bereiche auf Projektebene ──────────────────────────────────────────────
//
// Die Einzelvideo-Ansicht zeigt alles zu EINEM Video. Ein Kanal wird aber
// quer über alle Videos geführt: Was kommt als Nächstes raus, welche Serie
// traegt, wo fehlt eine Kennzeichnung, welches Material hat keine Lizenz.
// Die Daten dafür lagen bereits in creator_videos - nur ohne Ansicht.

async function projektVideos(projectId: string) {
  return await db.all(
    'SELECT * FROM creator_videos WHERE project_id = ? ORDER BY sort_order ASC, id ASC',
    [projectId]
  ) as any[]
}

router.get('/projects/:projectId/creator/redaktionsplan', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  res.json({ data: areas.redaktionsplan(videos), error: null })
})

router.get('/projects/:projectId/creator/serien', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  res.json({ data: { serien: areas.serien(videos) }, error: null })
})

router.get('/projects/:projectId/creator/sponsoren', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  res.json({ data: areas.sponsoren(videos), error: null })
})

router.get('/projects/:projectId/creator/seo', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  res.json({ data: areas.seo(videos), error: null })
})

router.get('/projects/:projectId/creator/titel', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  res.json({ data: areas.titelUndThumbnails(videos), error: null })
})

router.get('/projects/:projectId/creator/rechte', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  const assets = await db.all(
    'SELECT * FROM creator_assets WHERE project_id = ? ORDER BY id ASC',
    [req.params.projectId]
  ) as any[]
  res.json({ data: areas.rechte(videos, assets), error: null })
})

router.get('/projects/:projectId/creator/clips', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  const clips = await db.all(
    'SELECT * FROM creator_clips WHERE project_id = ? ORDER BY video_id ASC, sort_order ASC',
    [req.params.projectId]
  ) as any[]
  res.json({ data: areas.clips(videos, clips), error: null })
})

router.get('/projects/:projectId/creator/checklisten', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  const punkte = await db.all(
    'SELECT * FROM creator_checklist WHERE project_id = ? ORDER BY video_id ASC, sort_order ASC',
    [req.params.projectId]
  ) as any[]
  res.json({ data: areas.checklisten(videos, punkte), error: null })
})

router.get('/projects/:projectId/creator/performance', async (req, res) => {
  const videos = await projektVideos(req.params.projectId)
  res.json({ data: areas.performance(videos), error: null })
})

export default router
