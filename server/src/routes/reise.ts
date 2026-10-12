/**
 * Unterkunft und Reisekosten.
 *
 * Zwei Dinge, die zusammengehören: Wo die Leute schlafen, und was ihnen
 * dafür zusteht. Das Hotel bucht die Produktion, die Verpflegungspauschale
 * schuldet sie zusätzlich - und die rechnet niemand im Kopf richtig.
 *
 * Die Rechnung selbst steht in `lib/spesen.ts`, mit den Sätzen aus
 * Paragraf 9 Absatz 4a EStG. Hier steht nur, woher die Angaben kommen.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { schreibeCsv, cents } from '../lib/tabelle'
import {
  rechneReise, tagesarten, fahrtkosten, tagessatz,
  PAUSCHALE_8H_CENTS, PAUSCHALE_24H_CENTS, PAUSCHALE_ANREISE_CENTS,
  KUERZUNG_PROZENT, KM_PAUSCHALE_CENTS,
  type Tagesart,
} from '../lib/spesen'

const router = Router()

// ─── Unterkünfte ─────────────────────────────────────────────────────────────

router.get('/projects/:projectId/unterkuenfte', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const [haeuser, zimmer] = await Promise.all([
    db.all('SELECT * FROM accommodations WHERE project_id = ? ORDER BY check_in ASC NULLS LAST, name ASC', [projectId]) as Promise<any[]>,
    // Eine Abfrage für alle Zimmer, nicht eine je Unterkunft.
    db.all(
      `SELECT r.* FROM accommodation_rooms r
         JOIN accommodations a ON r.accommodation_id = a.id
        WHERE a.project_id = ? ORDER BY r.sort_order ASC, r.id ASC`,
      [projectId]
    ) as Promise<any[]>,
  ])

  const jeHaus = new Map<number, any[]>()
  for (const z of zimmer) {
    const liste = jeHaus.get(z.accommodation_id)
    if (liste) liste.push(z)
    else jeHaus.set(z.accommodation_id, [z])
  }

  return res.json({
    data: haeuser.map((h) => {
      const eigene = jeHaus.get(h.id) ?? []
      return {
        ...h,
        zimmer: eigene,
        naechte_gesamt: eigene.reduce((s, z) => s + Number(z.nights || 0), 0),
        kosten_cents: eigene.reduce(
          (s, z) => s + Number(z.nights || 0) * Number(h.price_per_night_cents || 0), 0
        ),
      }
    }),
    error: null,
  })
})

router.post('/projects/:projectId/unterkuenfte', requireAuth, requireMember, async (req: Request, res: Response) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ data: null, error: 'Die Unterkunft braucht einen Namen' })
  const zeile = await db.run(
    `INSERT INTO accommodations
       (project_id, name, address, zip, city, phone, check_in, check_out,
        price_per_night_cents, booking_ref, breakfast_included, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(req.params.projectId), name,
      String(req.body?.address || ''), String(req.body?.zip || ''), String(req.body?.city || ''),
      String(req.body?.phone || ''),
      req.body?.check_in ? String(req.body.check_in).slice(0, 10) : null,
      req.body?.check_out ? String(req.body.check_out).slice(0, 10) : null,
      Math.max(0, Math.round(Number(req.body?.price_per_night_cents ?? 0))),
      String(req.body?.booking_ref || ''),
      req.body?.breakfast_included === true,
      String(req.body?.notes || ''),
    ]
  )
  return res.json({ data: await db.get('SELECT * FROM accommodations WHERE id = ?', [zeile.id]), error: null })
})

router.put('/projects/:projectId/unterkuenfte/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const felder: string[] = []
  const werte: any[] = []
  const text = (spalte: string, wert: any) => { felder.push(`${spalte} = ?`); werte.push(String(wert ?? '')) }

  if ('name' in req.body) {
    if (!String(req.body.name).trim()) {
      return res.status(400).json({ data: null, error: 'Die Unterkunft braucht einen Namen' })
    }
    text('name', String(req.body.name).trim())
  }
  for (const feld of ['address', 'zip', 'city', 'phone', 'booking_ref', 'notes']) {
    if (feld in req.body) text(feld, req.body[feld])
  }
  for (const feld of ['check_in', 'check_out']) {
    if (feld in req.body) {
      felder.push(`${feld} = ?`)
      werte.push(req.body[feld] ? String(req.body[feld]).slice(0, 10) : null)
    }
  }
  if ('price_per_night_cents' in req.body) {
    felder.push('price_per_night_cents = ?')
    werte.push(Math.max(0, Math.round(Number(req.body.price_per_night_cents) || 0)))
  }
  if ('breakfast_included' in req.body) {
    felder.push('breakfast_included = ?')
    werte.push(req.body.breakfast_included === true)
  }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  const zeile = await db.run(
    `UPDATE accommodations SET ${felder.join(', ')} WHERE id = ? AND project_id = ?`,
    [...werte, Number(req.params.id), Number(req.params.projectId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Unterkunft nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

router.delete('/projects/:projectId/unterkuenfte/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const zeile = await db.run(
    'DELETE FROM accommodations WHERE id = ? AND project_id = ?',
    [Number(req.params.id), Number(req.params.projectId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Unterkunft nicht gefunden' })
  return res.json({ data: { geloescht: true }, error: null })
})

/** Die Zimmerbelegung setzen - als Ganzes. */
router.put('/projects/:projectId/unterkuenfte/:id/zimmer', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const haus = await db.get('SELECT id FROM accommodations WHERE id = ? AND project_id = ?', [id, projectId])
  if (!haus) return res.status(404).json({ data: null, error: 'Unterkunft nicht gefunden' })

  const zimmer = Array.isArray(req.body?.zimmer) ? req.body.zimmer : []
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM accommodation_rooms WHERE accommodation_id = ?', [id])
    for (let i = 0; i < zimmer.length; i++) {
      const z = zimmer[i]
      await tx.run(
        `INSERT INTO accommodation_rooms
           (accommodation_id, room_label, person_type, person_id, person_name, nights, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id, String(z?.room_label || ''), String(z?.person_type || 'crew'),
          z?.person_id ? Number(z.person_id) : null,
          String(z?.person_name || ''),
          Math.max(0, Math.round(Number(z?.nights ?? 0))), i,
        ]
      )
    }
  })
  return res.json({ data: { gespeichert: true }, error: null })
})

// ─── Reisen ──────────────────────────────────────────────────────────────────

async function ladeReise(projectId: number, id: number) {
  const kopf = (await db.get(
    `SELECT t.*, a.name AS unterkunft, a.breakfast_included
       FROM trips t LEFT JOIN accommodations a ON t.accommodation_id = a.id
      WHERE t.id = ? AND t.project_id = ?`,
    [id, projectId]
  )) as any
  if (!kopf) return null
  const tage = (await db.all(
    'SELECT * FROM trip_days WHERE trip_id = ? ORDER BY day_date ASC', [id]
  )) as any[]

  const abrechnung = rechneReise(
    tage.map((t) => ({
      datum: String(t.day_date).slice(0, 10),
      art: String(t.kind) as Tagesart,
      dauerMinuten: Number(t.minutes_away || 0),
      mahlzeiten: {
        fruehstueck: t.breakfast === true,
        mittag: t.lunch === true,
        abend: t.dinner === true,
      },
    })),
    {
      kilometer: Number(kopf.kilometers || 0),
      fahrzeugart: kopf.vehicle_kind === 'sonstige' ? 'sonstige' : 'pkw',
      uebernachtungCents: Number(kopf.lodging_cents || 0),
    }
  )

  return { ...kopf, tage, abrechnung }
}

router.get('/projects/:projectId/reisen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const reisen = (await db.all(
    `SELECT t.*, a.name AS unterkunft,
            (SELECT COUNT(*) FROM trip_days d WHERE d.trip_id = t.id) AS tage
       FROM trips t LEFT JOIN accommodations a ON t.accommodation_id = a.id
      WHERE t.project_id = ? ORDER BY t.from_date ASC, t.person_name ASC`,
    [projectId]
  )) as any[]
  if (reisen.length === 0) {
    return res.json({ data: { reisen: [], summe_cents: 0, saetze: saetzeInfo() }, error: null })
  }

  // Alle Tage auf einmal - nicht eine Abfrage je Reise.
  const alleTage = (await db.all(
    `SELECT d.* FROM trip_days d JOIN trips t ON d.trip_id = t.id
      WHERE t.project_id = ? ORDER BY d.day_date ASC`,
    [projectId]
  )) as any[]
  const jeReise = new Map<number, any[]>()
  for (const t of alleTage) {
    const liste = jeReise.get(t.trip_id)
    if (liste) liste.push(t)
    else jeReise.set(t.trip_id, [t])
  }

  const mitSumme = reisen.map((r) => {
    const tage = jeReise.get(r.id) ?? []
    const a = rechneReise(
      tage.map((t) => ({
        datum: String(t.day_date).slice(0, 10),
        art: String(t.kind) as Tagesart,
        dauerMinuten: Number(t.minutes_away || 0),
        mahlzeiten: { fruehstueck: t.breakfast === true, mittag: t.lunch === true, abend: t.dinner === true },
      })),
      {
        kilometer: Number(r.kilometers || 0),
        fahrzeugart: r.vehicle_kind === 'sonstige' ? 'sonstige' : 'pkw',
        uebernachtungCents: Number(r.lodging_cents || 0),
      }
    )
    return {
      ...r,
      verpflegung_cents: a.verpflegungCents,
      fahrt_cents: a.fahrtCents,
      uebernachtung_cents: a.uebernachtungCents,
      gesamt_cents: a.gesamtCents,
    }
  })

  return res.json({
    data: {
      reisen: mitSumme,
      summe_cents: mitSumme.reduce((s, r) => s + r.gesamt_cents, 0),
      saetze: saetzeInfo(),
    },
    error: null,
  })
})

/** Die geltenden Sätze - damit die Oberfläche sie nicht noch einmal führt. */
function saetzeInfo() {
  return {
    pauschale_8h_cents: PAUSCHALE_8H_CENTS,
    pauschale_24h_cents: PAUSCHALE_24H_CENTS,
    pauschale_anreise_cents: PAUSCHALE_ANREISE_CENTS,
    kuerzung_prozent: KUERZUNG_PROZENT,
    km_cents: KM_PAUSCHALE_CENTS,
    grundlage: '§ 9 Abs. 4a EStG, Inland. Für Auslandsreisen gelten Ländersätze, '
      + 'die hier nicht hinterlegt sind.',
  }
}

router.get('/projects/:projectId/reisen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const reise = await ladeReise(Number(req.params.projectId), Number(req.params.id))
  if (!reise) return res.status(404).json({ data: null, error: 'Reise nicht gefunden' })
  return res.json({ data: { ...reise, saetze: saetzeInfo() }, error: null })
})

/**
 * Eine Reise anlegen - die Tage entstehen gleich mit.
 *
 * Aus der Spanne ergeben sich die Tagesarten: ein Tag ist einzeln, zwei sind
 * An- und Abreise, mehr bekommen volle Tage dazwischen. Ist bei der Unterkunft
 * Frühstück inklusive, wird es gleich eingetragen - das ist der häufigste Fall
 * und die häufigste vergessene Kürzung.
 */
router.post('/projects/:projectId/reisen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const von = String(req.body?.from_date || '').slice(0, 10)
  const bis = String(req.body?.to_date || von).slice(0, 10)
  const tage = tagesarten(von, bis)
  if (tage.length === 0) {
    return res.status(400).json({ data: null, error: 'Zeitraum fehlt oder endet vor dem Beginn' })
  }

  const haus = req.body?.accommodation_id
    ? ((await db.get(
        'SELECT breakfast_included FROM accommodations WHERE id = ? AND project_id = ?',
        [Number(req.body.accommodation_id), projectId]
      )) as any)
    : null

  const id = await db.transaction(async (tx) => {
    const zeile = await tx.run(
      `INSERT INTO trips
         (project_id, person_type, person_id, person_name, purpose, from_date, to_date,
          kilometers, vehicle_kind, lodging_cents, accommodation_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        String(req.body?.person_type || 'crew'),
        req.body?.person_id ? Number(req.body.person_id) : null,
        String(req.body?.person_name || ''),
        String(req.body?.purpose || ''),
        von, bis,
        Math.max(0, Math.round(Number(req.body?.kilometers ?? 0))),
        req.body?.vehicle_kind === 'sonstige' ? 'sonstige' : 'pkw',
        Math.max(0, Math.round(Number(req.body?.lodging_cents ?? 0))),
        req.body?.accommodation_id ? Number(req.body.accommodation_id) : null,
        String(req.body?.notes || ''),
        (req as any).user?.id ?? null,
      ]
    )
    for (const t of tage) {
      await tx.run(
        `INSERT INTO trip_days (trip_id, day_date, kind, minutes_away, breakfast)
         VALUES (?, ?, ?, ?, ?)`,
        [
          zeile.id, t.datum, t.art,
          // Ein einzelner Tag ohne Übernachtung braucht die Stundenzahl -
          // ohne sie gibt es keine Pauschale. Zwölf Stunden sind der
          // Drehtagsnormalfall und werden vorgeschlagen, nicht behauptet.
          t.art === 'einzeln' ? 12 * 60 : 0,
          haus?.breakfast_included === true,
        ]
      )
    }
    return zeile.id as number
  })

  return res.json({ data: await ladeReise(projectId, id), error: null })
})

router.put('/projects/:projectId/reisen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const felder: string[] = []
  const werte: any[] = []

  for (const feld of ['person_name', 'purpose', 'notes', 'status']) {
    if (feld in req.body) { felder.push(`${feld} = ?`); werte.push(String(req.body[feld] ?? '')) }
  }
  if ('person_type' in req.body) { felder.push('person_type = ?'); werte.push(String(req.body.person_type || 'crew')) }
  if ('person_id' in req.body) {
    felder.push('person_id = ?')
    werte.push(req.body.person_id ? Number(req.body.person_id) : null)
  }
  if ('kilometers' in req.body) {
    felder.push('kilometers = ?')
    werte.push(Math.max(0, Math.round(Number(req.body.kilometers) || 0)))
  }
  if ('vehicle_kind' in req.body) {
    felder.push('vehicle_kind = ?')
    werte.push(req.body.vehicle_kind === 'sonstige' ? 'sonstige' : 'pkw')
  }
  if ('lodging_cents' in req.body) {
    felder.push('lodging_cents = ?')
    werte.push(Math.max(0, Math.round(Number(req.body.lodging_cents) || 0)))
  }
  if ('accommodation_id' in req.body) {
    felder.push('accommodation_id = ?')
    werte.push(req.body.accommodation_id ? Number(req.body.accommodation_id) : null)
  }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  const zeile = await db.run(
    `UPDATE trips SET ${felder.join(', ')}, updated_at = NOW() WHERE id = ? AND project_id = ?`,
    [...werte, id, projectId]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Reise nicht gefunden' })
  return res.json({ data: await ladeReise(projectId, id), error: null })
})

/** Einen einzelnen Reisetag ändern - Mahlzeiten und Abwesenheit. */
router.put('/projects/:projectId/reisen/:id/tage/:tagId', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const id = Number(req.params.id)
  const tag = (await db.get(
    `SELECT d.id FROM trip_days d JOIN trips t ON d.trip_id = t.id
      WHERE d.id = ? AND d.trip_id = ? AND t.project_id = ?`,
    [Number(req.params.tagId), id, projectId]
  )) as any
  if (!tag) return res.status(404).json({ data: null, error: 'Reisetag nicht gefunden' })

  const felder: string[] = []
  const werte: any[] = []
  for (const [feld, spalte] of [['breakfast', 'breakfast'], ['lunch', 'lunch'], ['dinner', 'dinner']]) {
    if (feld in req.body) { felder.push(`${spalte} = ?`); werte.push(req.body[feld] === true) }
  }
  if ('minutes_away' in req.body) {
    felder.push('minutes_away = ?')
    werte.push(Math.max(0, Math.round(Number(req.body.minutes_away) || 0)))
  }
  if ('kind' in req.body) {
    const art = String(req.body.kind)
    if (!['einzeln', 'anreise', 'zwischentag', 'abreise'].includes(art)) {
      return res.status(400).json({ data: null, error: 'Unbekannte Tagesart' })
    }
    felder.push('kind = ?'); werte.push(art)
  }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  await db.run(`UPDATE trip_days SET ${felder.join(', ')} WHERE id = ?`, [...werte, tag.id])
  return res.json({ data: await ladeReise(projectId, id), error: null })
})

router.delete('/projects/:projectId/reisen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const zeile = await db.run(
    'DELETE FROM trips WHERE id = ? AND project_id = ?',
    [Number(req.params.id), Number(req.params.projectId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Reise nicht gefunden' })
  return res.json({ data: { geloescht: true }, error: null })
})

/**
 * Die Reisekosten als CSV - für die Lohnbuchhaltung.
 *
 * Eine Zeile je Reise mit den Teilbeträgen getrennt. Die Verpflegungspauschale
 * ist steuerfrei, die anderen Posten nicht unbedingt - deshalb stehen sie
 * nicht in einer Summe.
 */
router.get('/projects/:projectId/reisen/export.csv', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const reisen = (await db.all(
    'SELECT * FROM trips WHERE project_id = ? ORDER BY from_date ASC', [projectId]
  )) as any[]
  const alleTage = (await db.all(
    `SELECT d.* FROM trip_days d JOIN trips t ON d.trip_id = t.id
      WHERE t.project_id = ?`,
    [projectId]
  )) as any[]
  const jeReise = new Map<number, any[]>()
  for (const t of alleTage) {
    const liste = jeReise.get(t.trip_id)
    if (liste) liste.push(t)
    else jeReise.set(t.trip_id, [t])
  }

  const csv = schreibeCsv(
    ['Person', 'Anlass', 'Von', 'Bis', 'Tage', 'Verpflegung', 'Kilometer', 'Fahrtkosten', 'Übernachtung', 'Gesamt'],
    reisen.map((r) => {
      const tage = jeReise.get(r.id) ?? []
      const verpflegung = tage.reduce(
        (s, t) => s + tagessatz(
          String(t.kind) as Tagesart,
          Number(t.minutes_away || 0),
          { fruehstueck: t.breakfast === true, mittag: t.lunch === true, abend: t.dinner === true }
        ), 0
      )
      const fahrt = fahrtkosten(Number(r.kilometers || 0), r.vehicle_kind === 'sonstige' ? 'sonstige' : 'pkw')
      const lodging = Number(r.lodging_cents || 0)
      return [
        r.person_name || '', r.purpose || '',
        String(r.from_date).slice(0, 10), String(r.to_date).slice(0, 10),
        tage.length, cents(verpflegung), Number(r.kilometers || 0),
        cents(fahrt), cents(lodging), cents(verpflegung + fahrt + lodging),
      ]
    })
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="reisekosten-${projectId}.csv"`)
  return res.send(csv)
})

export default router
