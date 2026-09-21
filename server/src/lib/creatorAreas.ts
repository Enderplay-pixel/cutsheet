/**
 * Auswertungen über ALLE Videos eines Creator-Projekts.
 *
 * `creatorInsights` betrachtet jeweils ein Video. Die Funktionen hier fassen
 * ein ganzes Projekt zusammen - das ist die Ebene, auf der ein Kanal geführt
 * wird: Was kommt als Nächstes raus, welche Serie trägt, wo fehlt ein
 * Sponsorenhinweis, welches Material hat keine Lizenz.
 */

import { assessRights, analysePerformance, checkClip } from './creatorInsights'

/** Mehrzeiliges Textfeld zu einer Liste. Leere Zeilen fallen weg. */
export function zeilen(text: unknown): string[] {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
}

/** Kommagetrenntes Feld zu einer Liste, ohne Dubletten. */
export function schlagworte(text: unknown): string[] {
  const roh = String(text ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return [...new Set(roh)]
}

/**
 * Warum eigene Zahl-Hilfe: Number(null) ist 0, Number('') auch. Eine Spalte,
 * die nie gefüllt wurde, darf nicht als echte Null in eine Quote eingehen.
 */
export function zahl(wert: unknown): number | null {
  if (wert === null || wert === undefined || wert === '') return null
  const n = Number(wert)
  return Number.isFinite(n) ? n : null
}

export type Video = Record<string, any>

// ─── Redaktionsplan ─────────────────────────────────────────────────────────

export type PlanEintrag = {
  id: number
  titel: string
  status: string
  plattform: string
  serie: string
  datum: string | null
  veroeffentlicht: boolean
  ueberfaellig: boolean
}

/**
 * Alles mit Datum, nach Monat gebündelt. Überfällig ist ein Video, dessen
 * geplantes Datum vorbei ist, ohne dass es veröffentlicht wurde.
 */
export function redaktionsplan(videos: Video[], heute = new Date()) {
  const stichtag = heute.toISOString().slice(0, 10)
  const eintraege: PlanEintrag[] = videos
    .filter(v => v.publish_at || v.published_at)
    .map(v => {
      const datum = (v.published_at || v.publish_at || '').slice(0, 10) || null
      const veroeffentlicht = Boolean(v.published_at)
      return {
        id: v.id,
        titel: v.title || '(ohne Titel)',
        status: v.status || '',
        plattform: v.platform || '',
        serie: v.series || '',
        datum,
        veroeffentlicht,
        ueberfaellig: !veroeffentlicht && !!datum && datum < stichtag,
      }
    })
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)))

  const monate = new Map<string, PlanEintrag[]>()
  for (const e of eintraege) {
    const key = (e.datum || '').slice(0, 7) || 'ohne Datum'
    if (!monate.has(key)) monate.set(key, [])
    monate.get(key)!.push(e)
  }

  return {
    eintraege,
    ohne_datum: videos.filter(v => !v.publish_at && !v.published_at).length,
    ueberfaellig: eintraege.filter(e => e.ueberfaellig).length,
    monate: [...monate].map(([monat, liste]) => ({ monat, videos: liste })),
  }
}

// ─── Serien & Formate ───────────────────────────────────────────────────────

/**
 * Nach `series` gruppiert. Die Durchschnittsaufrufe zählen nur
 * veröffentlichte Videos - sonst zieht jede geplante Folge den Schnitt auf 0.
 */
export function serien(videos: Video[]) {
  const gruppen = new Map<string, Video[]>()
  for (const v of videos) {
    const key = (v.series || '').trim() || 'Ohne Serie'
    if (!gruppen.has(key)) gruppen.set(key, [])
    gruppen.get(key)!.push(v)
  }

  return [...gruppen].map(([name, liste]) => {
    const raus = liste.filter(v => v.published_at)
    const aufrufe = raus.map(v => zahl(v.views) ?? 0)
    const summe = aufrufe.reduce((a, b) => a + b, 0)
    return {
      name,
      videos: liste.length,
      veroeffentlicht: raus.length,
      geplant: liste.filter(v => v.publish_at && !v.published_at).length,
      aufrufe_gesamt: summe,
      aufrufe_schnitt: raus.length ? Math.round(summe / raus.length) : null,
      beste: raus.slice().sort((a, b) => (zahl(b.views) ?? 0) - (zahl(a.views) ?? 0))[0]?.title ?? null,
    }
  }).sort((a, b) => b.videos - a.videos)
}

// ─── Sponsoren & Integrationen ──────────────────────────────────────────────

/**
 * Nur Videos mit Marke. `sponsor_disclosed` ist der Punkt, an dem es
 * rechtlich wird: eine bezahlte Integration ohne Kennzeichnung ist
 * Schleichwerbung, deshalb steht sie als Warnung drin und nicht als Notiz.
 */
export function sponsoren(videos: Video[], heute = new Date()) {
  const stichtag = heute.toISOString().slice(0, 10)
  const liste = videos
    .filter(v => String(v.sponsor_brand || '').trim())
    .map(v => {
      const frist = (v.sponsor_deadline || '').slice(0, 10) || null
      const honorar = zahl(v.sponsor_fee_cents)
      return {
        id: v.id,
        video: v.title || '(ohne Titel)',
        marke: String(v.sponsor_brand).trim(),
        honorar_cent: honorar,
        leistungen: zeilen(v.sponsor_deliverables),
        frist,
        frist_ueberschritten: !!frist && frist < stichtag && !v.published_at,
        gekennzeichnet: Boolean(v.sponsor_disclosed),
        veroeffentlicht: Boolean(v.published_at),
      }
    })
    .sort((a, b) => String(a.frist ?? '9999').localeCompare(String(b.frist ?? '9999')))

  return {
    liste,
    honorar_gesamt_cent: liste.reduce((n, s) => n + (s.honorar_cent ?? 0), 0),
    offen_cent: liste.filter(s => !s.veroeffentlicht).reduce((n, s) => n + (s.honorar_cent ?? 0), 0),
    ohne_kennzeichnung: liste.filter(s => !s.gekennzeichnet).length,
    fristen_ueberschritten: liste.filter(s => s.frist_ueberschritten).length,
  }
}

// ─── SEO & Metadaten ────────────────────────────────────────────────────────

/** Ab hier schneidet die YouTube-Suche den Titel in der Regel ab. */
export const TITEL_MAX = 60
/** Kürzere Beschreibungen tragen für die Suche praktisch nichts bei. */
export const BESCHREIBUNG_MIN = 100
export const TAGS_MIN = 3

export function seo(videos: Video[]) {
  const liste = videos.map(v => {
    const titel = String(v.title || '')
    const tags = schlagworte(v.tags)
    const beschreibung = String(v.description || '').trim()
    const maengel: string[] = []

    if (!String(v.keyword || '').trim()) maengel.push('kein Zielbegriff')
    if (tags.length < TAGS_MIN) maengel.push(`nur ${tags.length} Schlagworte`)
    if (beschreibung.length < BESCHREIBUNG_MIN) {
      maengel.push(beschreibung ? `Beschreibung nur ${beschreibung.length} Zeichen` : 'keine Beschreibung')
    }
    if (titel.length > TITEL_MAX) maengel.push(`Titel ${titel.length} Zeichen, wird abgeschnitten`)

    return {
      id: v.id,
      titel: titel || '(ohne Titel)',
      titel_laenge: titel.length,
      zielbegriff: String(v.keyword || '').trim(),
      tags,
      beschreibung_laenge: beschreibung.length,
      maengel,
      veroeffentlicht: Boolean(v.published_at),
    }
  })

  return {
    liste,
    vollstaendig: liste.filter(e => e.maengel.length === 0).length,
    mit_maengeln: liste.filter(e => e.maengel.length > 0).length,
  }
}

// ─── Titel & Thumbnails ─────────────────────────────────────────────────────

/** Unter zwei Varianten lässt sich nichts vergleichen. */
export const VARIANTEN_MIN = 2

export function titelUndThumbnails(videos: Video[]) {
  const liste = videos.map(v => {
    const titel = zeilen(v.title_variants)
    const thumbs = zeilen(v.thumbnail_ideas)
    return {
      id: v.id,
      video: v.title || '(ohne Titel)',
      titelvarianten: titel,
      thumbnail_ideen: thumbs,
      kein_vergleich: titel.length < VARIANTEN_MIN || thumbs.length < VARIANTEN_MIN,
      veroeffentlicht: Boolean(v.published_at),
    }
  })

  return {
    liste,
    ohne_vergleich: liste.filter(e => e.kein_vergleich).length,
    varianten_gesamt: liste.reduce((n, e) => n + e.titelvarianten.length, 0),
  }
}

// ─── Rechte & Lizenzen ──────────────────────────────────────────────────────

/**
 * Material über alle Videos, gruppiert nach Video. Nutzt `assessRights` aus
 * creatorInsights, damit die Bewertung dieselbe bleibt wie in der
 * Einzelvideo-Ansicht.
 */
export function rechte(videos: Video[], assets: Record<string, any>[]) {
  const nachVideo = new Map<number, Record<string, any>[]>()
  for (const a of assets) {
    const id = Number(a.video_id)
    if (!nachVideo.has(id)) nachVideo.set(id, [])
    nachVideo.get(id)!.push(a)
  }

  const liste = videos
    .map(v => {
      const eigene = nachVideo.get(Number(v.id)) ?? []
      const befund = assessRights(eigene as any)
      return {
        id: v.id,
        video: v.title || '(ohne Titel)',
        material: eigene.length,
        risiko: befund.risk,
        ohne_lizenz: befund.unlicensed,
        probleme: befund.problems,
        veroeffentlicht: Boolean(v.published_at),
      }
    })
    .filter(e => e.material > 0)
    .sort((a, b) => b.ohne_lizenz - a.ohne_lizenz)

  return {
    liste,
    material_gesamt: assets.length,
    ohne_lizenz: liste.reduce((n, e) => n + e.ohne_lizenz, 0),
    videos_mit_risiko: liste.filter(e => e.risiko === 'hoch').length,
  }
}

// ─── Schnittliste / Clips ───────────────────────────────────────────────────

export function clips(videos: Video[], alle: Record<string, any>[]) {
  const laenge = new Map<number, number>()
  for (const v of videos) laenge.set(Number(v.id), zahl(v.duration_seconds) ?? 0)

  const liste = alle.map(c => {
    const videoLaenge = laenge.get(Number(c.video_id)) || undefined
    const befund = checkClip(c as any, videoLaenge)
    const quelle = videos.find(v => Number(v.id) === Number(c.video_id))
    return {
      id: c.id,
      titel: c.title || '(ohne Titel)',
      aus_video: quelle?.title || '(unbekannt)',
      video_id: c.video_id,
      plattform: c.platform || '',
      status: c.status || '',
      start: zahl(c.start_seconds) ?? 0,
      ende: zahl(c.end_seconds) ?? 0,
      dauer: Math.max(0, (zahl(c.end_seconds) ?? 0) - (zahl(c.start_seconds) ?? 0)),
      probleme: befund.problems,
    }
  })

  return {
    liste,
    gesamt: liste.length,
    mit_problemen: liste.filter(c => c.probleme.length > 0).length,
  }
}

// ─── Upload-Checklisten ─────────────────────────────────────────────────────

export function checklisten(videos: Video[], punkte: Record<string, any>[]) {
  const nachVideo = new Map<number, Record<string, any>[]>()
  for (const p of punkte) {
    const id = Number(p.video_id)
    if (!nachVideo.has(id)) nachVideo.set(id, [])
    nachVideo.get(id)!.push(p)
  }

  const liste = videos.map(v => {
    const eigene = nachVideo.get(Number(v.id)) ?? []
    const erledigt = eigene.filter(p => p.done).length
    return {
      id: v.id,
      video: v.title || '(ohne Titel)',
      status: v.status || '',
      punkte: eigene.length,
      erledigt,
      offen: eigene.filter(p => !p.done).map(p => p.label),
      // Ohne Punkte gibt es keinen Fortschritt - 0 von 0 ist nicht 100 Prozent
      fortschritt: eigene.length ? Math.round((erledigt / eigene.length) * 100) : null,
      veroeffentlicht: Boolean(v.published_at),
    }
  })

  return {
    liste,
    bereit: liste.filter(e => e.fortschritt === 100).length,
    ohne_checkliste: liste.filter(e => e.punkte === 0).length,
  }
}

// ─── Performance ────────────────────────────────────────────────────────────

export function performance(videos: Video[]) {
  const raus = videos.filter(v => v.published_at)
  const liste = raus.map(v => {
    const befund = analysePerformance(v as any, zahl(v.duration_seconds) ?? undefined)
    return {
      id: v.id,
      video: v.title || '(ohne Titel)',
      serie: v.series || '',
      datum: (v.published_at || '').slice(0, 10),
      aufrufe: zahl(v.views) ?? 0,
      impressionen: zahl(v.impressions),
      ctr: befund.ctr,
      haltequote: befund.retention,
      abos: zahl(v.subs_gained) ?? 0,
      hinweise: befund.notes,
    }
  }).sort((a, b) => b.aufrufe - a.aufrufe)

  const mitCtr = liste.map(e => e.ctr).filter((n): n is number => n !== null)
  const mitHalte = liste.map(e => e.haltequote).filter((n): n is number => n !== null)
  const mittel = (xs: number[]) => xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null

  return {
    liste,
    veroeffentlicht: raus.length,
    aufrufe_gesamt: liste.reduce((n, e) => n + e.aufrufe, 0),
    ctr_schnitt: mittel(mitCtr),
    haltequote_schnitt: mittel(mitHalte),
  }
}
