import crypto from 'crypto'

/**
 * OAuth-Anbindung an YouTube (Data API v3 und Analytics API v2).
 *
 * Alle Netzwerkaufrufe nehmen eine `fetchImpl` entgegen, damit sie ohne echte
 * Google-Zugangsdaten testbar sind.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

/**
 * Nur lesende Scopes. `yt-analytics.readonly` gilt bei Google als sensibel:
 * ohne App-Verifizierung laufen Refresh-Tokens im Testmodus nach sieben Tagen
 * ab, die Anbindung muss dann neu verbunden werden.
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/** Liest die Konfiguration aus der Umgebung; null wenn nicht eingerichtet. */
export function getOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const base = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '')
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || `${base}/api/creator/youtube/callback`,
  }
}

// ─── Anmeldung ────────────────────────────────────────────────────────────────

/**
 * Baut die Zustimmungs-URL.
 *
 * `access_type=offline` und `prompt=consent` sind beide noetig: ohne sie liefert
 * Google beim zweiten Mal kein Refresh-Token mehr, und die Anbindung waere nach
 * einer Stunde tot.
 */
export function buildAuthUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/** Signierter State, damit der Rücklauf nicht von außen ausgelöst werden kann. */
export function createState(projectId: number, secret: string): string {
  const payload = `${projectId}.${Date.now()}`
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${mac}`
}

export function verifyState(state: string, secret: string, maxAgeMs = 15 * 60 * 1000): number | null {
  const parts = String(state || '').split('.')
  if (parts.length !== 2) return null

  let payload: string
  try { payload = Buffer.from(parts[0], 'base64url').toString('utf8') } catch { return null }

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(parts[1])
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  const [idPart, tsPart] = payload.split('.')
  const projectId = Number(idPart)
  const issued = Number(tsPart)
  if (!Number.isFinite(projectId) || !Number.isFinite(issued)) return null
  if (Date.now() - issued > maxAgeMs) return null

  return projectId
}

// ─── Token ────────────────────────────────────────────────────────────────────

export interface TokenSet {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
  scope: string
}

type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

async function postForm(
  url: string,
  body: Record<string, string>,
  fetchImpl: FetchLike
): Promise<any> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* Google antwortet im Fehlerfall auch mal mit HTML */ }

  if (!res.ok) {
    const detail = json?.error_description || json?.error || text.slice(0, 200)
    throw new Error(`Google lehnte die Anfrage ab (HTTP ${res.status}): ${detail}`)
  }
  return json
}

export async function exchangeCode(
  config: OAuthConfig,
  code: string,
  fetchImpl: FetchLike = fetch as any
): Promise<TokenSet> {
  const json = await postForm(TOKEN_ENDPOINT, {
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  }, fetchImpl)

  if (!json?.access_token) throw new Error('Google lieferte kein Zugriffstoken zurück.')
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    scope: json.scope || '',
  }
}

export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string,
  fetchImpl: FetchLike = fetch as any
): Promise<TokenSet> {
  const json = await postForm(TOKEN_ENDPOINT, {
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  }, fetchImpl)

  if (!json?.access_token) throw new Error('Google lieferte kein Zugriffstoken zurück.')
  return {
    // Beim Refresh schickt Google kein neues Refresh-Token - das alte gilt weiter
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    scope: json.scope || '',
  }
}

export async function revokeToken(token: string, fetchImpl: FetchLike = fetch as any): Promise<void> {
  try {
    await postForm(REVOKE_ENDPOINT, { token }, fetchImpl)
  } catch {
    // Ein bereits abgelaufenes Token laesst sich nicht widerrufen - das ist kein
    // Grund, das Trennen scheitern zu lassen
  }
}

// ─── Verschluesselung der Refresh-Tokens ──────────────────────────────────────

/**
 * Ein Refresh-Token ist Dauerzugang zu den Kanaldaten. Es liegt deshalb nur
 * verschluesselt in der Datenbank (AES-256-GCM). Der Schluessel kommt aus
 * TOKEN_ENCRYPTION_KEY, ersatzweise aus dem JWT_SECRET.
 */
function encryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!secret) throw new Error('Weder TOKEN_ENCRYPTION_KEY noch JWT_SECRET gesetzt - Tokens können nicht sicher gespeichert werden.')
  return crypto.scryptSync(secret, 'cutsheet-youtube-token', 32)
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

export function decryptToken(payload: string): string {
  const parts = String(payload || '').split('.')
  if (parts.length !== 3) throw new Error('Gespeichertes Token ist beschädigt.')

  const [iv, tag, data] = parts.map(p => Buffer.from(p, 'base64url'))
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// ─── API-Aufrufe ──────────────────────────────────────────────────────────────

async function getJson(url: string, accessToken: string, fetchImpl: FetchLike): Promise<any> {
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* siehe oben */ }

  if (!res.ok) {
    const detail = json?.error?.message || text.slice(0, 200)
    throw new Error(`YouTube antwortete mit HTTP ${res.status}: ${detail}`)
  }
  return json
}

export interface ChannelInfo {
  channelId: string
  title: string
  subscribers: number | null
  totalViews: number | null
}

export async function fetchChannel(accessToken: string, fetchImpl: FetchLike = fetch as any): Promise<ChannelInfo> {
  const json = await getJson(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    accessToken, fetchImpl
  )
  const item = json?.items?.[0]
  if (!item) throw new Error('Zu diesem Google-Konto gehört kein YouTube-Kanal.')

  return {
    channelId: item.id,
    title: item.snippet?.title ?? '',
    subscribers: numOrNull(item.statistics?.subscriberCount),
    totalViews: numOrNull(item.statistics?.viewCount),
  }
}

function numOrNull(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export interface VideoMetrics {
  videoId: string
  views: number
  estimatedMinutesWatched: number
  averageViewDuration: number
  likes: number
  comments: number
  subscribersGained: number
  impressions: number | null
  ctr: number | null
}

/**
 * Kennzahlen je Video ueber einen Zeitraum. Impressionen und Klickrate liegen
 * in einer eigenen Metrikgruppe, die nicht jeder Kanal freigeschaltet hat -
 * deshalb werden sie getrennt geholt und duerfen fehlen.
 */
export async function fetchVideoMetrics(
  accessToken: string,
  opts: { startDate: string; endDate: string; maxResults?: number },
  fetchImpl: FetchLike = fetch as any
): Promise<VideoMetrics[]> {
  const base = 'https://youtubeanalytics.googleapis.com/v2/reports'
  const common = `ids=channel==MINE&startDate=${opts.startDate}&endDate=${opts.endDate}&dimensions=video&sort=-views&maxResults=${opts.maxResults ?? 200}`

  const core = await getJson(
    `${base}?${common}&metrics=views,estimatedMinutesWatched,averageViewDuration,likes,comments,subscribersGained`,
    accessToken, fetchImpl
  )

  const byId = new Map<string, VideoMetrics>()
  for (const row of core?.rows ?? []) {
    byId.set(row[0], {
      videoId: row[0],
      views: Number(row[1]) || 0,
      estimatedMinutesWatched: Number(row[2]) || 0,
      averageViewDuration: Number(row[3]) || 0,
      likes: Number(row[4]) || 0,
      comments: Number(row[5]) || 0,
      subscribersGained: Number(row[6]) || 0,
      impressions: null,
      ctr: null,
    })
  }

  try {
    const reach = await getJson(
      `${base}?${common}&metrics=impressions,impressionClickThroughRate`,
      accessToken, fetchImpl
    )
    for (const row of reach?.rows ?? []) {
      const entry = byId.get(row[0])
      if (entry) {
        entry.impressions = Number(row[1]) || 0
        entry.ctr = Number(row[2]) || 0
      }
    }
  } catch {
    // Reichweiten-Metriken sind nicht fuer jeden Kanal verfuegbar
  }

  return [...byId.values()]
}

/** Retention-Kurve eines Videos als Rohzeilen [Position 0–1, Anteil]. */
export async function fetchRetentionCurve(
  accessToken: string,
  videoId: string,
  opts: { startDate: string; endDate: string },
  fetchImpl: FetchLike = fetch as any
): Promise<Array<[number, number]>> {
  const url = 'https://youtubeanalytics.googleapis.com/v2/reports'
    + `?ids=channel==MINE&startDate=${opts.startDate}&endDate=${opts.endDate}`
    + `&dimensions=elapsedVideoTimeRatio&metrics=audienceWatchRatio&sort=elapsedVideoTimeRatio`
    + `&filters=video==${encodeURIComponent(videoId)}`

  const json = await getJson(url, accessToken, fetchImpl)
  return (json?.rows ?? []).map((r: any[]) => [Number(r[0]), Number(r[1])] as [number, number])
}

export interface ChannelVideo {
  videoId: string
  title: string
  publishedAt: string | null
}

/**
 * Alle Videos des eigenen Kanals mit Titel.
 *
 * Der Weg fuehrt ueber die Uploads-Playlist: Die Analytics API liefert nur
 * Video-IDs und Zahlen, aber keine Titel - die braucht es aber, um die Videos
 * den CutSheet-Eintraegen zuzuordnen.
 */
export async function fetchChannelVideos(
  accessToken: string,
  maxVideos = 200,
  fetchImpl: FetchLike = fetch as any
): Promise<ChannelVideo[]> {
  const channelJson = await getJson(
    'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true',
    accessToken, fetchImpl
  )
  const uploads = channelJson?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return []

  const videos: ChannelVideo[] = []
  let pageToken = ''

  while (videos.length < maxVideos) {
    const url = 'https://www.googleapis.com/youtube/v3/playlistItems'
      + `?part=snippet&maxResults=50&playlistId=${encodeURIComponent(uploads)}`
      + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')

    const json = await getJson(url, accessToken, fetchImpl)
    for (const item of json?.items ?? []) {
      const videoId = item?.snippet?.resourceId?.videoId
      if (!videoId) continue
      videos.push({
        videoId,
        title: item?.snippet?.title ?? '',
        publishedAt: item?.snippet?.publishedAt ?? null,
      })
    }

    pageToken = json?.nextPageToken ?? ''
    if (!pageToken) break
  }

  return videos.slice(0, maxVideos)
}

/**
 * Wandelt eine ISO-8601-Dauer wie "PT12M34S" in Sekunden.
 *
 * YouTube liefert Videolaengen ausschliesslich in diesem Format. Die echte
 * Laenge ist wichtig, weil sich sonst nur die aus dem Sprechtext geschaetzte
 * Dauer verwenden laesst - und die weicht ab, sobald geschnitten wurde.
 */
export function parseIsoDuration(value: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(String(value ?? '').trim())
  if (!m) return 0
  const [, d, h, min, sec] = m
  const total = (Number(d) || 0) * 86400 + (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(sec) || 0)
  return Number.isFinite(total) ? Math.round(total) : 0
}

export interface VideoDetails {
  videoId: string
  title: string
  publishedAt: string | null
  durationSeconds: number
}

/**
 * Titel, Veroeffentlichungsdatum und Laenge zu bestimmten Videos.
 * Die API nimmt bis zu 50 IDs je Aufruf entgegen.
 */
export async function fetchVideoDetails(
  accessToken: string,
  videoIds: string[],
  fetchImpl: FetchLike = fetch as any
): Promise<VideoDetails[]> {
  const out: VideoDetails[] = []

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    if (batch.length === 0) continue

    const json = await getJson(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(batch.join(','))}`,
      accessToken, fetchImpl
    )
    for (const item of json?.items ?? []) {
      if (!item?.id) continue
      out.push({
        videoId: item.id,
        title: item.snippet?.title ?? '',
        publishedAt: item.snippet?.publishedAt ?? null,
        durationSeconds: parseIsoDuration(item.contentDetails?.duration ?? ''),
      })
    }
  }

  return out
}

/** Video-ID aus einem YouTube-Link ziehen. */
export function extractVideoId(url: string): string | null {
  const s = String(url || '').trim()
  if (!s) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s

  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = p.exec(s)
    if (m) return m[1]
  }
  return null
}
