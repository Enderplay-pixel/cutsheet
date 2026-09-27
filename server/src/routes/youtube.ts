import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireMember, getUserProjectRole, requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import {
  getOAuthConfig, buildAuthUrl, createState, verifyState,
  exchangeCode, refreshAccessToken, revokeToken,
  encryptToken, decryptToken,
  fetchChannel, fetchVideoMetrics, fetchRetentionCurve, fetchChannelVideos, fetchVideoDetails,
  extractVideoId,
} from '../lib/youtubeOAuth'
import { parseRetentionRows, analyseScriptRetention, findChannelPatterns } from '../lib/youtubeInsights'
import { assignAll } from '../lib/videoMatching'
import { UPLOAD_CHECKLIST } from '../lib/creatorInsights'
import { buildTimeline, DEFAULT_WPM } from '../lib/creatorScript'
import { getStateSecret as stateSecret } from '../config/secrets'

const router = Router()

router.use('/projects/:projectId', requireMember)



/** Frühestes Datum, für das YouTube Analytics Daten hat. */
const ANALYTICS_START = '2005-04-23'
const today = () => new Date().toISOString().slice(0, 10)

// ─── Status ───────────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/creator/youtube/status
router.get('/projects/:projectId/creator/youtube/status', async (req, res) => {
  const config = getOAuthConfig()
  const account = await db.get(
    'SELECT channel_id, channel_title, subscribers, total_views, last_sync_at, last_error, expires_at FROM creator_youtube_accounts WHERE project_id = ?',
    [req.params.projectId]
  ) as any

  res.json({
    data: {
      // Ohne Zugangsdaten in der Umgebung ist die Anbindung nicht einrichtbar -
      // die Oberfläche zeigt dann eine Anleitung statt eines toten Knopfes
      configured: Boolean(config),
      connected: Boolean(account?.channel_id),
      channel: account ? {
        id: account.channel_id,
        title: account.channel_title,
        subscribers: account.subscribers,
        total_views: account.total_views,
      } : null,
      last_sync_at: account?.last_sync_at ?? null,
      last_error: account?.last_error || '',
    },
    error: null,
  })
})

// ─── Verbinden ────────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/creator/youtube/connect
router.get('/projects/:projectId/creator/youtube/connect', async (req, res) => {
  const config = getOAuthConfig()
  if (!config) {
    return res.status(503).json({
      data: null,
      error: 'YouTube-Anbindung ist nicht eingerichtet: YOUTUBE_CLIENT_ID und YOUTUBE_CLIENT_SECRET fehlen.',
    })
  }
  const state = createState(Number(req.params.projectId), stateSecret())
  res.json({ data: { url: buildAuthUrl(config, state), redirect_uri: config.redirectUri }, error: null })
})

/**
 * Rücklauf von Google. Läuft als Browser-Weiterleitung, kann also keinen
 * Authorization-Header tragen - die Zuordnung kommt aus dem signierten State.
 */
router.get('/creator/youtube/callback', async (req: Request, res: Response) => {
  const appBase = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '')
  // Ohne gültigen State kennen wir das Projekt nicht - dann zurück zur
  // Projektliste statt auf eine Route mit leerer ID
  const back = (projectId: number | string | null, params: Record<string, string>) => {
    // Die Projektliste liegt auf der Wurzel, nicht auf /projects
    const path = projectId ? `/projects/${projectId}/creator/kanal` : '/'
    return `${appBase}${path}?${new URLSearchParams(params).toString()}`
  }

  const config = getOAuthConfig()
  if (!config) return res.redirect(back(null, { youtube: 'fehler', grund: 'nicht eingerichtet' }))

  if (req.query.error) {
    const projectId = verifyState(String(req.query.state || ''), stateSecret())
    return res.redirect(back(projectId, { youtube: 'abgebrochen' }))
  }

  const projectId = verifyState(String(req.query.state || ''), stateSecret())
  if (projectId === null) {
    return res.redirect(back(null, { youtube: 'fehler', grund: 'Anfrage abgelaufen oder ungültig' }))
  }

  try {
    const tokens = await exchangeCode(config, String(req.query.code || ''))
    if (!tokens.refreshToken) {
      throw new Error('Google hat kein dauerhaftes Token geliefert. Bitte den Zugriff in den Google-Kontoeinstellungen entfernen und erneut verbinden.')
    }
    const channel = await fetchChannel(tokens.accessToken)

    await db.run(`
      INSERT INTO creator_youtube_accounts
        (project_id, channel_id, channel_title, subscribers, total_views, access_token, refresh_token, expires_at, scope, last_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '')
      ON CONFLICT (project_id) DO UPDATE SET
        channel_id = EXCLUDED.channel_id,
        channel_title = EXCLUDED.channel_title,
        subscribers = EXCLUDED.subscribers,
        total_views = EXCLUDED.total_views,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        last_error = '',
        updated_at = NOW()
    `, [
      projectId, channel.channelId, channel.title, channel.subscribers, channel.totalViews,
      encryptToken(tokens.accessToken), encryptToken(tokens.refreshToken), tokens.expiresAt, tokens.scope,
    ])

    return res.redirect(back(projectId, { youtube: 'verbunden' }))
  } catch (err: any) {
    console.error('[youtube/callback]', err?.message)
    return res.redirect(back(projectId, { youtube: 'fehler', grund: String(err?.message || 'unbekannt').slice(0, 200) }))
  }
})

// DELETE /api/projects/:projectId/creator/youtube
router.delete('/projects/:projectId/creator/youtube', async (req, res) => {
  const account = await db.get(
    'SELECT refresh_token FROM creator_youtube_accounts WHERE project_id = ?',
    [req.params.projectId]
  ) as any

  if (account?.refresh_token) {
    try { await revokeToken(decryptToken(account.refresh_token)) } catch { /* bereits ungültig */ }
  }
  await db.run('DELETE FROM creator_youtube_accounts WHERE project_id = ?', [req.params.projectId])
  res.json({ data: { ok: true }, error: null })
})

// ─── Abgleich ─────────────────────────────────────────────────────────────────

/**
 * Gültiges Zugriffstoken besorgen und bei Bedarf erneuern.
 *
 * Läuft der Refresh ins Leere - im Google-Testmodus nach sieben Tagen der
 * Normalfall - wird der Grund am Konto vermerkt, damit die Oberfläche zum
 * Neuverbinden auffordern kann statt stumm zu scheitern.
 */
async function validAccessToken(projectId: number | string): Promise<string> {
  const config = getOAuthConfig()
  if (!config) throw new Error('YouTube-Anbindung ist nicht eingerichtet.')

  const account = await db.get('SELECT * FROM creator_youtube_accounts WHERE project_id = ?', [projectId]) as any
  if (!account?.refresh_token) throw new Error('Kein YouTube-Kanal verbunden.')

  // Eine Minute Sicherheitsabstand, damit das Token während des Abgleichs hält
  if (account.access_token && Number(account.expires_at) > Date.now() + 60_000) {
    return decryptToken(account.access_token)
  }

  try {
    const refreshed = await refreshAccessToken(config, decryptToken(account.refresh_token))
    await db.run(
      'UPDATE creator_youtube_accounts SET access_token = ?, expires_at = ?, last_error = \'\', updated_at = NOW() WHERE project_id = ?',
      [encryptToken(refreshed.accessToken), refreshed.expiresAt, projectId]
    )
    return refreshed.accessToken
  } catch (err: any) {
    const message = 'Zugriff abgelaufen - bitte neu verbinden. ' + String(err?.message || '')
    await db.run('UPDATE creator_youtube_accounts SET last_error = ?, updated_at = NOW() WHERE project_id = ?',
      [message.slice(0, 500), projectId])
    throw new Error(message)
  }
}

// POST /api/projects/:projectId/creator/youtube/sync
router.post('/projects/:projectId/creator/youtube/sync', async (req, res) => {
  const { projectId } = req.params

  try {
    const accessToken = await validAccessToken(projectId)

    const channel = await fetchChannel(accessToken)
    await db.run(
      'UPDATE creator_youtube_accounts SET channel_title = ?, subscribers = ?, total_views = ?, updated_at = NOW() WHERE project_id = ?',
      [channel.title, channel.subscribers, channel.totalViews, projectId]
    )

    const metrics = await fetchVideoMetrics(accessToken, { startDate: ANALYTICS_START, endDate: today() })
    const byYoutubeId = new Map(metrics.map(m => [m.videoId, m]))

    const videos = await db.all('SELECT * FROM creator_videos WHERE project_id = ?', [projectId]) as any[]

    // Videos ohne hinterlegten Link ueber den Titel zuordnen. Nur eindeutige
    // Treffer werden gesetzt - eine falsche Zuordnung haengt stillschweigend
    // fremde Zahlen an ein Video und waere schlimmer als gar keine.
    const needsMatch = videos.filter(v => !v.youtube_video_id && !extractVideoId(v.video_url))
    const autoLinked: Array<{ title: string; to: string }> = []
    const suggestions: Array<{ id: number; title: string; suggested_id: string; suggested_title: string; score: number }> = []

    if (needsMatch.length > 0) {
      const channelVideos = await fetchChannelVideos(accessToken)
      const assignments = assignAll(
        needsMatch.map(v => ({ id: v.id, title: v.title || '' })),
        channelVideos
      )
      for (const a of assignments) {
        if (a.match.auto && a.match.videoId) {
          await db.run('UPDATE creator_videos SET youtube_video_id = ? WHERE id = ?', [a.match.videoId, a.id])
          const target = videos.find(v => v.id === a.id)
          if (target) target.youtube_video_id = a.match.videoId
          autoLinked.push({ title: a.title, to: a.match.title ?? a.match.videoId })
        } else if (a.match.videoId) {
          suggestions.push({
            id: a.id,
            title: a.title,
            suggested_id: a.match.videoId,
            suggested_title: a.match.title ?? '',
            score: a.match.score,
          })
        }
      }
    }

    // Videos, die auf dem Kanal stehen aber hier fehlen, anlegen. Ohne das
    // bleibt ein bestehender Kanal fuer CutSheet unsichtbar - der Abgleich
    // haette nur zugeordnet, was man vorher selbst getippt hat.
    const linkedIds = new Set(
      videos.map(v => v.youtube_video_id || extractVideoId(v.video_url)).filter(Boolean) as string[]
    )
    const ignoredRows = await db.all(
      'SELECT youtube_video_id FROM creator_youtube_ignored WHERE project_id = ?', [projectId]
    ) as Array<{ youtube_video_id: string }>
    const ignored = new Set(ignoredRows.map(r => r.youtube_video_id))

    const allChannelVideos = await fetchChannelVideos(accessToken)
    const toImport = allChannelVideos.filter(v => !linkedIds.has(v.videoId) && !ignored.has(v.videoId))
    const imported: string[] = []

    if (toImport.length > 0) {
      const details = new Map(
        (await fetchVideoDetails(accessToken, toImport.map(v => v.videoId))).map(d => [d.videoId, d])
      )
      const maxRow = await db.get(
        'SELECT COALESCE(MAX(sort_order), -1) as m FROM creator_videos WHERE project_id = ?', [projectId]
      ) as { m: number }
      let order = maxRow.m + 1

      for (const cv of toImport) {
        const d = details.get(cv.videoId)
        const result = await db.run(`
          INSERT INTO creator_videos
            (project_id, title, status, youtube_video_id, published_at, duration_seconds, imported_from_youtube, sort_order)
          VALUES (?, ?, 'Veröffentlicht', ?, ?, ?, true, ?)
        `, [
          projectId, d?.title || cv.title, cv.videoId,
          (d?.publishedAt || cv.publishedAt || '').slice(0, 10) || null,
          d?.durationSeconds ?? 0, order++,
        ])

        // Nur die Upload-Checkliste, kein Skript-Geruest: Das Video ist
        // veroeffentlicht, eine leere Hook/Intro-Vorlage wuerde die Zeitachse
        // verfaelschen.
        let checkOrder = 0
        for (const label of UPLOAD_CHECKLIST) {
          await db.run(
            'INSERT INTO creator_checklist (video_id, project_id, label, done, sort_order) VALUES (?, ?, ?, true, ?)',
            [result.id, projectId, label, checkOrder++]
          )
        }
        imported.push(d?.title || cv.title)
      }

      // Frisch importierte Videos in denselben Durchlauf aufnehmen
      const refreshed = await db.all('SELECT * FROM creator_videos WHERE project_id = ?', [projectId]) as any[]
      videos.length = 0
      videos.push(...refreshed)
    }

    let matched = 0
    let curves = 0
    const unmatched: string[] = []

    for (const video of videos) {
      // Video-ID aus dem hinterlegten Link ableiten, falls noch nicht geschehen
      const ytId = video.youtube_video_id || extractVideoId(video.video_url)
      if (!ytId) { unmatched.push(video.title || `#${video.id}`); continue }

      const m = byYoutubeId.get(ytId)
      if (!m) { unmatched.push(video.title || `#${video.id}`); continue }

      matched++
      await db.run(`
        UPDATE creator_videos SET
          youtube_video_id = ?, views = ?, impressions = ?, avg_view_seconds = ?,
          likes = ?, comments = ?, subs_gained = ?, synced_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `, [
        ytId, m.views, m.impressions ?? 0, Math.round(m.averageViewDuration),
        m.likes, m.comments, m.subscribersGained, video.id,
      ])

      try {
        const rows = await fetchRetentionCurve(accessToken, ytId, { startDate: ANALYTICS_START, endDate: today() })
        if (rows.length > 0) {
          await db.run('UPDATE creator_videos SET retention_curve = ? WHERE id = ?', [JSON.stringify(rows), video.id])
          curves++
        }
      } catch (err: any) {
        // Retention gibt es erst ab einer Mindestzahl an Aufrufen - kein Grund,
        // den ganzen Abgleich abzubrechen
        console.warn('[youtube/sync] keine Retention für', ytId, err?.message)
      }
    }

    // Echte Laufzeiten nachziehen - sie sind die Bezugsgroesse fuer die Retention
    const linkedForDuration = videos.map(v => v.youtube_video_id).filter(Boolean) as string[]
    if (linkedForDuration.length > 0) {
      try {
        for (const d of await fetchVideoDetails(accessToken, linkedForDuration)) {
          if (d.durationSeconds > 0) {
            await db.run('UPDATE creator_videos SET duration_seconds = ? WHERE project_id = ? AND youtube_video_id = ?',
              [d.durationSeconds, projectId, d.videoId])
          }
        }
      } catch (err: any) {
        console.warn('[youtube/sync] Laufzeiten nicht abrufbar:', err?.message)
      }
    }

    await db.run('UPDATE creator_youtube_accounts SET last_sync_at = NOW(), last_error = \'\' WHERE project_id = ?', [projectId])

    res.json({
      data: {
        channel: { title: channel.title, subscribers: channel.subscribers },
        videos_on_youtube: metrics.length,
        matched,
        retention_curves: curves,
        unmatched,
        auto_linked: autoLinked,
        suggestions,
        imported,
      },
      error: null,
    })
  } catch (err: any) {
    res.status(400).json({ data: null, error: err?.message || 'Abgleich fehlgeschlagen' })
  }
})

// GET /api/projects/:projectId/creator/youtube/videos - fuer die Auswahlliste
router.get('/projects/:projectId/creator/youtube/videos', async (req, res) => {
  try {
    const accessToken = await validAccessToken(req.params.projectId)
    const videos = await fetchChannelVideos(accessToken)
    res.json({ data: videos, error: null })
  } catch (err: any) {
    res.status(400).json({ data: null, error: err?.message || 'Videos konnten nicht geladen werden' })
  }
})

// ─── Auswertung ───────────────────────────────────────────────────────────────

/** Retention eines Videos gegen sein Skript. */
router.get('/creator/videos/:videoId/retention', requireMemberVia(projectIdFromTable('creator_videos', 'videoId')), async (req: Request, res: Response) => {
  const user = (req as any).user
  if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })

  const video = await db.get('SELECT * FROM creator_videos WHERE id = ?', [req.params.videoId]) as any
  if (!video) return res.status(404).json({ data: null, error: 'Video nicht gefunden' })
  if (user.role !== 'admin' && (await getUserProjectRole(user.id, video.project_id)) === null) {
    return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const sections = await db.all(
    'SELECT * FROM creator_script_sections WHERE video_id = ? ORDER BY sort_order ASC, id ASC',
    [video.id]
  ) as any[]

  const timeline = buildTimeline(sections, video.wpm || DEFAULT_WPM)

  let rows: any = []
  try { rows = JSON.parse(video.retention_curve || '[]') } catch { rows = [] }
  const curve = parseRetentionRows(rows)

  // Echte Laufzeit von YouTube bevorzugen; die Schaetzung aus dem Sprechtext
  // weicht ab, sobald geschnitten wurde. Ohne Anbindung bleibt die Schaetzung.
  const videoSeconds = Number(video.duration_seconds) > 0
    ? Number(video.duration_seconds)
    : timeline.totalSeconds || 0

  res.json({
    data: {
      has_curve: curve.length > 0,
      video_seconds: videoSeconds,
      duration_from_youtube: Number(video.duration_seconds) > 0,
      synced_at: video.synced_at,
      curve,
      analysis: analyseScriptRetention(
        timeline.sections.map(s => ({
          id: s.id,
          kind: s.kind,
          heading: s.heading,
          startSeconds: s.startSeconds,
          estimatedSeconds: s.estimatedSeconds,
        })),
        curve,
        videoSeconds
      ),
    },
    error: null,
  })
})

/** Muster über den ganzen Kanal - der Vergleich, den Studio nicht anbietet. */
router.get('/projects/:projectId/creator/patterns', async (req, res) => {
  const videos = await db.all('SELECT * FROM creator_videos WHERE project_id = ?', [req.params.projectId]) as any[]

  const summaries = await Promise.all(videos.map(async v => {
    const sections = await db.all(
      'SELECT kind, heading, spoken, visuals, target_seconds FROM creator_script_sections WHERE video_id = ? ORDER BY sort_order ASC',
      [v.id]
    ) as any[]
    const t = buildTimeline(sections, v.wpm || DEFAULT_WPM)
    return {
      id: v.id,
      title: v.title,
      seconds: t.totalSeconds,
      views: v.views,
      impressions: v.impressions,
      avg_view_seconds: v.avg_view_seconds,
      published_at: v.published_at,
    }
  }))

  res.json({ data: findChannelPatterns(summaries), error: null })
})

export default router
