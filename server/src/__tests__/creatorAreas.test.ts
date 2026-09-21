import { describe, it, expect } from 'vitest'
import {
  zeilen, schlagworte, zahl,
  redaktionsplan, serien, sponsoren, seo, titelUndThumbnails,
  rechte, clips, checklisten, performance,
} from '../lib/creatorAreas'

function video(over: Record<string, any> = {}): Record<string, any> {
  return {
    id: 1, project_id: 11, title: 'Wie ich schneide', status: 'Schnitt',
    platform: 'YouTube', series: '', publish_at: null, published_at: null,
    title_variants: '', thumbnail_ideas: '', description: '', tags: '',
    keyword: '', views: 0, impressions: 0, avg_view_seconds: 0, likes: 0,
    subs_gained: 0, duration_seconds: 0,
    sponsor_brand: '', sponsor_fee_cents: 0, sponsor_deliverables: '',
    sponsor_deadline: null, sponsor_disclosed: false,
    ...over,
  }
}

const HEUTE = new Date('2026-09-21T12:00:00Z')

describe('Hilfsfunktionen', () => {
  it('zerlegt mehrzeilige Felder und wirft Leerzeilen weg', () => {
    expect(zeilen('A\n\n  B  \r\nC')).toEqual(['A', 'B', 'C'])
    expect(zeilen(null)).toEqual([])
  })

  it('entdoppelt Schlagworte und macht sie klein', () => {
    expect(schlagworte('Schnitt, schnitt , Workflow')).toEqual(['schnitt', 'workflow'])
    expect(schlagworte('')).toEqual([])
  })

  it('unterscheidet "nicht erfasst" von echter Null', () => {
    expect(zahl(null)).toBeNull()
    expect(zahl('')).toBeNull()
    expect(zahl(undefined)).toBeNull()
    expect(zahl(0)).toBe(0)
    expect(zahl('42')).toBe(42)
    expect(zahl('keine Zahl')).toBeNull()
  })
})

describe('Redaktionsplan', () => {
  const videos = [
    video({ id: 1, publish_at: '2026-09-01', title: 'Überfällig' }),
    video({ id: 2, publish_at: '2026-10-05', title: 'Kommt noch' }),
    video({ id: 3, published_at: '2026-09-10', title: 'Ist raus' }),
    video({ id: 4, title: 'Ohne Datum' }),
  ]
  const plan = redaktionsplan(videos, HEUTE)

  it('zählt nur wirklich überfällige Videos', () => {
    expect(plan.ueberfaellig).toBe(1)
    expect(plan.eintraege.find(e => e.id === 1)?.ueberfaellig).toBe(true)
  })

  it('zählt ein veröffentlichtes Video nicht als überfällig', () => {
    expect(plan.eintraege.find(e => e.id === 3)?.ueberfaellig).toBe(false)
  })

  it('nimmt Videos ohne Datum nicht in den Plan, zählt sie aber', () => {
    expect(plan.eintraege).toHaveLength(3)
    expect(plan.ohne_datum).toBe(1)
  })

  it('bündelt nach Monat und sortiert nach Datum', () => {
    expect(plan.monate.map(m => m.monat)).toEqual(['2026-09', '2026-10'])
    expect(plan.monate[0].videos.map(v => v.id)).toEqual([1, 3])
  })
})

describe('Serien', () => {
  const s = serien([
    video({ id: 1, series: 'Tutorial', published_at: '2026-01-01', views: 1000 }),
    video({ id: 2, series: 'Tutorial', published_at: '2026-02-01', views: 3000, title: 'Beste' }),
    video({ id: 3, series: 'Tutorial', publish_at: '2026-12-01' }),
    video({ id: 4, series: '' }),
  ])

  it('rechnet den Schnitt nur über veröffentlichte Videos', () => {
    const t = s.find(x => x.name === 'Tutorial')!
    expect(t.videos).toBe(3)
    expect(t.veroeffentlicht).toBe(2)
    expect(t.aufrufe_schnitt).toBe(2000)   // nicht 1333 aus drei Videos
  })

  it('nennt das stärkste Video der Serie', () => {
    expect(s.find(x => x.name === 'Tutorial')!.beste).toBe('Beste')
  })

  it('sammelt Videos ohne Serie eigens', () => {
    expect(s.find(x => x.name === 'Ohne Serie')!.videos).toBe(1)
  })

  it('liefert keinen Schnitt statt 0, wenn nichts veröffentlicht ist', () => {
    expect(serien([video({ series: 'Neu' })])[0].aufrufe_schnitt).toBeNull()
  })
})

describe('Sponsoren', () => {
  const s = sponsoren([
    video({ id: 1, sponsor_brand: 'Marke A', sponsor_fee_cents: 50000, sponsor_disclosed: true,
            sponsor_deadline: '2026-09-01', published_at: '2026-08-30' }),
    video({ id: 2, sponsor_brand: 'Marke B', sponsor_fee_cents: 20000, sponsor_disclosed: false,
            sponsor_deadline: '2026-09-01' }),
    video({ id: 3 }),
  ], HEUTE)

  it('nimmt nur Videos mit Marke auf', () => {
    expect(s.liste).toHaveLength(2)
  })

  it('erkennt fehlende Kennzeichnung', () => {
    expect(s.ohne_kennzeichnung).toBe(1)
  })

  it('zählt eine Frist nur als überschritten, wenn nicht veröffentlicht wurde', () => {
    expect(s.fristen_ueberschritten).toBe(1)
    expect(s.liste.find(x => x.id === 1)!.frist_ueberschritten).toBe(false)
  })

  it('trennt Gesamthonorar von noch offenem Honorar', () => {
    expect(s.honorar_gesamt_cent).toBe(70000)
    expect(s.offen_cent).toBe(20000)
  })
})

describe('SEO', () => {
  it('benennt jeden Mangel einzeln', () => {
    const r = seo([video({ title: 'Kurz', keyword: '', tags: 'a', description: '' })])
    expect(r.liste[0].maengel).toEqual([
      'kein Zielbegriff', 'nur 1 Schlagworte', 'keine Beschreibung',
    ])
  })

  it('meldet zu lange Titel', () => {
    const r = seo([video({ title: 'x'.repeat(70) })])
    expect(r.liste[0].maengel.some(m => m.includes('abgeschnitten'))).toBe(true)
  })

  it('zählt ein sauberes Video als vollständig', () => {
    const r = seo([video({
      title: 'Ein guter Titel', keyword: 'schnitt',
      tags: 'a, b, c', description: 'x'.repeat(120),
    })])
    expect(r.liste[0].maengel).toEqual([])
    expect(r.vollstaendig).toBe(1)
  })
})

describe('Titel und Thumbnails', () => {
  it('erkennt, wo sich nichts vergleichen lässt', () => {
    const r = titelUndThumbnails([
      video({ id: 1, title_variants: 'A\nB', thumbnail_ideas: 'X\nY' }),
      video({ id: 2, title_variants: 'Nur einer', thumbnail_ideas: '' }),
    ])
    expect(r.liste.find(e => e.id === 1)!.kein_vergleich).toBe(false)
    expect(r.liste.find(e => e.id === 2)!.kein_vergleich).toBe(true)
    expect(r.ohne_vergleich).toBe(1)
    expect(r.varianten_gesamt).toBe(3)
  })
})

describe('Rechte', () => {
  const r = rechte(
    [video({ id: 1 }), video({ id: 2, title: 'Ohne Material' })],
    [
      { id: 1, video_id: 1, name: 'Musik', license: '', claim_risk: 'hoch' },
      { id: 2, video_id: 1, name: 'B-Roll', license: 'Pexels', claim_risk: 'keins' },
    ]
  )

  it('lässt Videos ohne Material weg', () => {
    expect(r.liste).toHaveLength(1)
    expect(r.liste[0].id).toBe(1)
  })

  it('zählt Material ohne Lizenz', () => {
    expect(r.ohne_lizenz).toBe(1)
    expect(r.material_gesamt).toBe(2)
  })

  it('schlägt das höchste Einzelrisiko auf das Video durch', () => {
    expect(r.liste[0].risiko).toBe('hoch')
    expect(r.videos_mit_risiko).toBe(1)
  })
})

describe('Clips', () => {
  it('reicht die Beanstandungen aus der Einzelprüfung durch', () => {
    const r = clips(
      [video({ id: 1, duration_seconds: 600 })],
      [
        { id: 1, video_id: 1, title: 'Gut', start_seconds: 10, end_seconds: 40, platform: 'Shorts' },
        { id: 2, video_id: 1, title: 'Kaputt', start_seconds: 90, end_seconds: 30, platform: 'Shorts' },
      ]
    )
    expect(r.gesamt).toBe(2)
    expect(r.mit_problemen).toBe(1)
    expect(r.liste.find(c => c.id === 1)!.dauer).toBe(30)
  })
})

describe('Checklisten', () => {
  const r = checklisten(
    [video({ id: 1 }), video({ id: 2, title: 'Nichts angelegt' })],
    [
      { id: 1, video_id: 1, label: 'Thumbnail', done: true },
      { id: 2, video_id: 1, label: 'Kapitel', done: false },
    ]
  )

  it('rechnet den Fortschritt je Video', () => {
    expect(r.liste.find(e => e.id === 1)!.fortschritt).toBe(50)
    expect(r.liste.find(e => e.id === 1)!.offen).toEqual(['Kapitel'])
  })

  it('meldet keinen Fortschritt statt 100 Prozent, wenn es keine Punkte gibt', () => {
    expect(r.liste.find(e => e.id === 2)!.fortschritt).toBeNull()
    expect(r.bereit).toBe(0)
    expect(r.ohne_checkliste).toBe(1)
  })
})

describe('Performance', () => {
  const r = performance([
    video({ id: 1, published_at: '2026-01-01', views: 5000, impressions: 100000, avg_view_seconds: 120, duration_seconds: 400, subs_gained: 50 }),
    video({ id: 2, published_at: '2026-02-01', views: 9000, impressions: 100000, avg_view_seconds: 300, duration_seconds: 400 }),
    video({ id: 3, title: 'Noch nicht raus' }),
  ])

  it('betrachtet nur veröffentlichte Videos', () => {
    expect(r.veroeffentlicht).toBe(2)
    expect(r.liste).toHaveLength(2)
  })

  it('sortiert nach Aufrufen', () => {
    expect(r.liste.map(e => e.id)).toEqual([2, 1])
  })

  it('rechnet Klickrate und Haltequote', () => {
    const eins = r.liste.find(e => e.id === 1)!
    expect(eins.ctr).toBe(5)          // 5000 von 100000
    expect(eins.haltequote).toBe(30)  // 120 von 400
  })

  it('mittelt nur über Videos, die einen Wert haben', () => {
    expect(r.ctr_schnitt).toBe(7)     // (5 + 9) / 2
    expect(r.aufrufe_gesamt).toBe(14000)
  })
})
