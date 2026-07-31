import { describe, it, expect, beforeAll } from 'vitest'
import {
  buildAuthUrl, createState, verifyState,
  exchangeCode, refreshAccessToken,
  encryptToken, decryptToken,
  fetchChannel, fetchVideoMetrics, fetchRetentionCurve,
  extractVideoId, SCOPES, parseIsoDuration, fetchVideoDetails,
  type OAuthConfig,
} from '../lib/youtubeOAuth'

const config: OAuthConfig = {
  clientId: 'client-123.apps.googleusercontent.com',
  clientSecret: 'geheim',
  redirectUri: 'https://cutsheet.example/api/creator/youtube/callback',
}

/** Antwort-Attrappe im Format, das die Module erwarten. */
const reply = (status: number, body: any) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
})

/** Merkt sich den letzten Aufruf, damit URL und Body prüfbar sind. */
function spy(status: number, body: any) {
  const calls: Array<{ url: string; init: any }> = []
  const impl = async (url: string, init?: any) => {
    calls.push({ url, init })
    return (await reply(status, body)())
  }
  return { impl: impl as any, calls }
}

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = 'test-schluessel-fuer-die-tests'
})

describe('buildAuthUrl', () => {
  const url = buildAuthUrl(config, 'STATE123')

  it('zeigt auf den Google-Zustimmungsdialog', () => {
    expect(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true)
  })

  it('fordert beide Lese-Scopes an', () => {
    const scope = new URL(url).searchParams.get('scope')
    for (const s of SCOPES) expect(scope).toContain(s)
  })

  it('fordert offline-Zugriff und erzwingt die Zustimmung', () => {
    // Ohne beides liefert Google beim zweiten Mal kein Refresh-Token
    const p = new URL(url).searchParams
    expect(p.get('access_type')).toBe('offline')
    expect(p.get('prompt')).toBe('consent')
  })

  it('reicht Redirect-URI und State durch', () => {
    const p = new URL(url).searchParams
    expect(p.get('redirect_uri')).toBe(config.redirectUri)
    expect(p.get('state')).toBe('STATE123')
  })
})

describe('State-Signatur', () => {
  it('akzeptiert den eigenen State und liefert die Projekt-ID', () => {
    expect(verifyState(createState(42, 'geheim'), 'geheim')).toBe(42)
  })

  it('lehnt einen fremd signierten State ab', () => {
    expect(verifyState(createState(42, 'geheim'), 'anderes-geheimnis')).toBeNull()
  })

  it('lehnt einen manipulierten State ab', () => {
    const s = createState(42, 'geheim')
    const [payload, mac] = s.split('.')
    const gefaelscht = Buffer.from('999.' + Date.now()).toString('base64url')
    expect(verifyState(`${gefaelscht}.${mac}`, 'geheim')).toBeNull()
  })

  it('lehnt einen abgelaufenen State ab', () => {
    expect(verifyState(createState(42, 'geheim'), 'geheim', -1)).toBeNull()
  })

  it('lehnt Unsinn ab', () => {
    for (const s of ['', 'kaputt', 'a.b.c', null as any]) {
      expect(verifyState(s, 'geheim')).toBeNull()
    }
  })
})

describe('exchangeCode', () => {
  it('liefert Zugriffs- und Refresh-Token', async () => {
    const s = spy(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'a b' })
    const t = await exchangeCode(config, 'CODE', s.impl)
    expect(t.accessToken).toBe('AT')
    expect(t.refreshToken).toBe('RT')
    expect(t.expiresAt).toBeGreaterThan(Date.now())
  })

  it('schickt den Code und die Zugangsdaten mit', async () => {
    const s = spy(200, { access_token: 'AT', expires_in: 3600 })
    await exchangeCode(config, 'CODE', s.impl)
    const body = s.calls[0].init.body as string
    expect(body).toContain('code=CODE')
    expect(body).toContain('grant_type=authorization_code')
    expect(body).toContain(encodeURIComponent(config.clientSecret))
  })

  it('meldet Googles Fehlerbeschreibung weiter', async () => {
    const s = spy(400, { error: 'invalid_grant', error_description: 'Code bereits verwendet' })
    await expect(exchangeCode(config, 'CODE', s.impl)).rejects.toThrow('Code bereits verwendet')
  })

  it('kommt mit einer Nicht-JSON-Antwort klar', async () => {
    const s = spy(500, '<html>Fehler</html>')
    await expect(exchangeCode(config, 'CODE', s.impl)).rejects.toThrow('HTTP 500')
  })

  it('meldet eine Antwort ohne Token als Fehler', async () => {
    const s = spy(200, { token_type: 'Bearer' })
    await expect(exchangeCode(config, 'CODE', s.impl)).rejects.toThrow('kein Zugriffstoken')
  })
})

describe('refreshAccessToken', () => {
  it('holt ein neues Zugriffstoken', async () => {
    const s = spy(200, { access_token: 'NEU', expires_in: 3600 })
    const t = await refreshAccessToken(config, 'RT', s.impl)
    expect(t.accessToken).toBe('NEU')
  })

  it('liefert null, wenn Google kein neues Refresh-Token schickt', async () => {
    const s = spy(200, { access_token: 'NEU', expires_in: 3600 })
    expect((await refreshAccessToken(config, 'RT', s.impl)).refreshToken).toBeNull()
  })

  it('meldet ein zurueckgezogenes Token weiter', async () => {
    const s = spy(400, { error: 'invalid_grant', error_description: 'Token widerrufen oder abgelaufen' })
    await expect(refreshAccessToken(config, 'RT', s.impl)).rejects.toThrow('widerrufen')
  })
})

describe('Token-Verschluesselung', () => {
  it('verschluesselt und entschluesselt verlustfrei', () => {
    const token = '1//0abcDEF-refresh-token_xyz'
    expect(decryptToken(encryptToken(token))).toBe(token)
  })

  it('legt das Token nicht im Klartext ab', () => {
    const token = 'geheimes-refresh-token'
    expect(encryptToken(token)).not.toContain(token)
  })

  it('erzeugt bei gleichem Eingabewert unterschiedliche Chiffren', () => {
    expect(encryptToken('gleich')).not.toBe(encryptToken('gleich'))
  })

  it('erkennt Manipulation am Chiffrat', () => {
    const enc = encryptToken('token')
    const [iv, tag, data] = enc.split('.')
    const kaputt = `${iv}.${tag}.${Buffer.from('manipuliert').toString('base64url')}`
    expect(() => decryptToken(kaputt)).toThrow()
  })

  it('weist beschaedigte Werte ab', () => {
    expect(() => decryptToken('nur-ein-teil')).toThrow('beschädigt')
  })
})

describe('fetchChannel', () => {
  it('liest Kanal-ID, Titel und Zahlen', async () => {
    const s = spy(200, { items: [{ id: 'UC123', snippet: { title: 'Mein Kanal' }, statistics: { subscriberCount: '4200', viewCount: '99000' } }] })
    const c = await fetchChannel('AT', s.impl)
    expect(c).toMatchObject({ channelId: 'UC123', title: 'Mein Kanal', subscribers: 4200, totalViews: 99000 })
  })

  it('schickt das Zugriffstoken im Header', async () => {
    const s = spy(200, { items: [{ id: 'UC1', snippet: {}, statistics: {} }] })
    await fetchChannel('MEIN-TOKEN', s.impl)
    expect(s.calls[0].init.headers.Authorization).toBe('Bearer MEIN-TOKEN')
  })

  it('meldet ein Konto ohne Kanal verstaendlich', async () => {
    const s = spy(200, { items: [] })
    await expect(fetchChannel('AT', s.impl)).rejects.toThrow('kein YouTube-Kanal')
  })

  it('reicht einen API-Fehler weiter', async () => {
    const s = spy(403, { error: { message: 'Zugriff verweigert' } })
    await expect(fetchChannel('AT', s.impl)).rejects.toThrow('Zugriff verweigert')
  })
})

describe('fetchVideoMetrics', () => {
  const core = { rows: [['vid1', 1000, 500, 120, 50, 10, 5]] }

  it('liest die Kennzahlen je Video', async () => {
    const s = spy(200, core)
    const m = await fetchVideoMetrics('AT', { startDate: '2026-01-01', endDate: '2026-12-31' }, s.impl)
    expect(m[0]).toMatchObject({ videoId: 'vid1', views: 1000, averageViewDuration: 120, likes: 50, subscribersGained: 5 })
  })

  it('ergaenzt Impressionen aus der zweiten Abfrage', async () => {
    let call = 0
    const impl = (async (url: string) => {
      call++
      const body = call === 1 ? core : { rows: [['vid1', 20000, 5.5]] }
      return { ok: true, status: 200, text: async () => JSON.stringify(body) }
    }) as any
    const m = await fetchVideoMetrics('AT', { startDate: '2026-01-01', endDate: '2026-12-31' }, impl)
    expect(m[0].impressions).toBe(20000)
    expect(m[0].ctr).toBe(5.5)
  })

  it('laeuft weiter, wenn Reichweiten-Metriken fehlen', async () => {
    let call = 0
    const impl = (async () => {
      call++
      if (call === 1) return { ok: true, status: 200, text: async () => JSON.stringify(core) }
      return { ok: false, status: 403, text: async () => JSON.stringify({ error: { message: 'nicht verfügbar' } }) }
    }) as any
    const m = await fetchVideoMetrics('AT', { startDate: '2026-01-01', endDate: '2026-12-31' }, impl)
    expect(m).toHaveLength(1)
    expect(m[0].impressions).toBeNull()
  })

  it('liefert bei leerem Bericht eine leere Liste', async () => {
    const s = spy(200, {})
    expect(await fetchVideoMetrics('AT', { startDate: 'a', endDate: 'b' }, s.impl)).toEqual([])
  })
})

describe('fetchRetentionCurve', () => {
  it('liest die Kurve als Zahlenpaare', async () => {
    const s = spy(200, { rows: [[0, 1], [0.5, 0.62]] })
    expect(await fetchRetentionCurve('AT', 'vid1', { startDate: 'a', endDate: 'b' }, s.impl))
      .toEqual([[0, 1], [0.5, 0.62]])
  })

  it('filtert auf das angefragte Video', async () => {
    // Die Analytics API erwartet ihre Filtersyntax mit literalem ==
    const s = spy(200, { rows: [] })
    await fetchRetentionCurve('AT', 'vid1', { startDate: 'a', endDate: 'b' }, s.impl)
    expect(s.calls[0].url).toContain('filters=video==vid1')
  })

  it('maskiert Sonderzeichen in der Video-ID', async () => {
    const s = spy(200, { rows: [] })
    await fetchRetentionCurve('AT', 'a&b=c', { startDate: 'a', endDate: 'b' }, s.impl)
    expect(s.calls[0].url).toContain('filters=video==a%26b%3Dc')
  })

  it('fragt die richtige Dimension ab', async () => {
    const s = spy(200, { rows: [] })
    await fetchRetentionCurve('AT', 'v', { startDate: 'a', endDate: 'b' }, s.impl)
    expect(s.calls[0].url).toContain('dimensions=elapsedVideoTimeRatio')
    expect(s.calls[0].url).toContain('metrics=audienceWatchRatio')
  })
})

describe('parseIsoDuration', () => {
  it('liest Minuten und Sekunden', () => {
    expect(parseIsoDuration('PT12M34S')).toBe(754)
  })

  it('liest Stunden mit', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723)
  })

  it('kommt mit fehlenden Bestandteilen klar', () => {
    expect(parseIsoDuration('PT45S')).toBe(45)
    expect(parseIsoDuration('PT8M')).toBe(480)
    expect(parseIsoDuration('PT2H')).toBe(7200)
  })

  it('liest Tage — Livestreams koennen so lang sein', () => {
    expect(parseIsoDuration('P1DT2H')).toBe(93600)
  })

  it('rundet Bruchteile von Sekunden', () => {
    expect(parseIsoDuration('PT1M30.5S')).toBe(91)
  })

  it('liefert 0 bei unbrauchbarer Eingabe', () => {
    for (const v of ['', 'quatsch', '12:34', null as any, undefined as any]) {
      expect(parseIsoDuration(v)).toBe(0)
    }
  })
})

describe('fetchVideoDetails', () => {
  const antwort = {
    items: [
      { id: 'v1', snippet: { title: 'Erstes Video', publishedAt: '2026-07-01T10:00:00Z' }, contentDetails: { duration: 'PT8M20S' } },
      { id: 'v2', snippet: { title: 'Zweites Video', publishedAt: '2026-07-08T10:00:00Z' }, contentDetails: { duration: 'PT1H5M' } },
    ],
  }

  it('liest Titel, Datum und Laenge', async () => {
    const s = spy(200, antwort)
    const d = await fetchVideoDetails('AT', ['v1', 'v2'], s.impl)
    expect(d[0]).toMatchObject({ videoId: 'v1', title: 'Erstes Video', durationSeconds: 500 })
    expect(d[1].durationSeconds).toBe(3900)
  })

  it('fragt die IDs kommagetrennt ab', async () => {
    const s = spy(200, antwort)
    await fetchVideoDetails('AT', ['v1', 'v2'], s.impl)
    expect(s.calls[0].url).toContain('id=v1%2Cv2')
  })

  it('teilt mehr als 50 IDs auf mehrere Aufrufe auf', async () => {
    const s = spy(200, { items: [] })
    await fetchVideoDetails('AT', Array.from({ length: 120 }, (_, i) => 'v' + i), s.impl)
    expect(s.calls).toHaveLength(3)
  })

  it('liefert bei leerer Liste nichts und ruft nicht ab', async () => {
    const s = spy(200, { items: [] })
    expect(await fetchVideoDetails('AT', [], s.impl)).toEqual([])
    expect(s.calls).toHaveLength(0)
  })

  it('ueberspringt Eintraege ohne ID', async () => {
    const s = spy(200, { items: [{ snippet: { title: 'kaputt' } }] })
    expect(await fetchVideoDetails('AT', ['x'], s.impl)).toEqual([])
  })
})

describe('extractVideoId', () => {
  it('erkennt die verschiedenen Linkformen', () => {
    const id = 'dQw4w9WgXcQ'
    for (const url of [
      id,
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/watch?list=PL1&v=${id}&t=30`,
    ]) {
      expect(extractVideoId(url)).toBe(id)
    }
  })

  it('liefert null bei fehlender oder unpassender Eingabe', () => {
    for (const s of ['', 'https://example.com', 'zu-kurz', null as any]) {
      expect(extractVideoId(s)).toBeNull()
    }
  })
})
