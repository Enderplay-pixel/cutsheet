import { dateiname } from '../lib/dateiname'
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { generatePdf } from './pdf'
import { requireMemberVia, projectIdFromTable } from '../middleware/projectAuth'
import { renderDocument, section, definitions, paragraph, fmtMoney, fmtDate } from '../lib/documentLayout'
import { istIsoDatum } from '../lib/datum'

/** Dateinamen von Zeichen befreien, die den Download-Header zerlegen. */
const slugify = (value: string) => dateiname(value)

const router = Router()

// Der Vertrag nennt Name, Anschrift und Vergütung des Eigentümers
router.use('/locations/:id', requireMemberVia(projectIdFromTable('locations', 'id')))

// GET /api/locations/:id/release
router.get('/locations/:id/release', async (req: Request, res: Response) => {
  const release = await db.get('SELECT * FROM location_releases WHERE location_id = ?', [req.params.id])
  res.json({ data: release || null, error: null })
})

// POST /api/locations/:id/release
// Ändert nur, was mitkommt. Gemessen am 25.10.2026: Die Oberfläche schickt
// nur den Namen des Eigentümers - Adresse, Drehdaten, Vergütung und
// Bedingungen standen danach leer im Vertrag.
router.post('/locations/:id/release', async (req: Request, res: Response) => {
  const existing = await db.get('SELECT * FROM location_releases WHERE location_id = ?', [req.params.id])
  if (existing?.status === 'Unterschrieben') {
    return res.status(409).json({ data: null, error: 'Der Motivvertrag ist unterschrieben und lässt sich nicht mehr ändern' })
  }
  const b = req.body ?? {}
  const v = {
    owner_name: b.owner_name ?? existing?.owner_name ?? '',
    owner_address: b.owner_address ?? existing?.owner_address ?? '',
    shoot_dates: b.shoot_dates === undefined
      ? existing?.shoot_dates ?? '[]'
      : typeof b.shoot_dates === 'string' ? b.shoot_dates : JSON.stringify(b.shoot_dates),
    fee_cents: b.fee_cents ?? existing?.fee_cents ?? 0,
    special_conditions: b.special_conditions ?? existing?.special_conditions ?? '',
    status: b.status ?? existing?.status ?? 'Entwurf',
  }
  // Unterschrieben wird nur über /sign - mit Unterschrift
  if (!['Entwurf', 'Versendet'].includes(v.status)) {
    return res.status(400).json({ data: null, error: 'status ist Entwurf oder Versendet' })
  }
  if (!Number.isInteger(Number(v.fee_cents)) || Number(v.fee_cents) < 0) {
    return res.status(400).json({ data: null, error: 'fee_cents ist ein Betrag in Cent ab 0' })
  }
  if (existing) {
    await db.run(
      'UPDATE location_releases SET owner_name=?, owner_address=?, shoot_dates=?, fee_cents=?, special_conditions=?, status=? WHERE id=?',
      [v.owner_name, v.owner_address, v.shoot_dates, v.fee_cents, v.special_conditions, v.status, existing.id]
    )
    res.json({ data: await db.get('SELECT * FROM location_releases WHERE id=?', [existing.id]), error: null })
  } else {
    const result = await db.run(
      'INSERT INTO location_releases (location_id, owner_name, owner_address, shoot_dates, fee_cents, special_conditions, status) VALUES (?,?,?,?,?,?,?)',
      [req.params.id, v.owner_name, v.owner_address, v.shoot_dates, v.fee_cents, v.special_conditions, v.status]
    )
    res.json({ data: await db.get('SELECT * FROM location_releases WHERE id=?', [result.id]), error: null })
  }
})

// PATCH /api/locations/:id/release/sign
router.patch('/locations/:id/release/sign', async (req: Request, res: Response) => {
  const { signature_data, signed_by } = req.body
  // Nur ein Bild - das PDF bettet die Unterschrift als Bild ein
  if (typeof signature_data !== 'string' || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(signature_data)) {
    return res.status(400).json({ data: null, error: 'Die Unterschrift fehlt oder ist kein Bild' })
  }
  const release = await db.get('SELECT id, status FROM location_releases WHERE location_id = ?', [req.params.id])
  if (!release) return res.status(404).json({ data: null, error: 'Kein Motivvertrag gefunden' })
  if (release.status === 'Unterschrieben') {
    return res.status(409).json({ data: null, error: 'Der Motivvertrag ist bereits unterschrieben' })
  }
  // signed_by ist NOT NULL. Gemessen am 25.10.2026: Die Oberfläche schickt
  // keinen Namen mit, jedes Unterschreiben endete mit "Ein Pflichtfeld fehlt."
  await db.run(
    "UPDATE location_releases SET signature_data=?, signed_by=?, signed_at=NOW(), status='Unterschrieben' WHERE id=?",
    [signature_data, String(signed_by ?? ''), release.id]
  )
  res.json({ data: await db.get('SELECT * FROM location_releases WHERE id=?', [release.id]), error: null })
})

// GET /api/locations/:id/release/pdf
router.get('/locations/:id/release/pdf', async (req: Request, res: Response) => {
  const location = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  if (!location) return res.status(404).json({ data: null, error: 'Motiv nicht gefunden' })
  const release = await db.get('SELECT * FROM location_releases WHERE location_id = ?', [req.params.id]) as any

  const project = await db.get('SELECT title FROM projects WHERE id = ?', [location.project_id]) as any

  // Eine Liste als JSON - oder Klartext, wie ihn die Demodaten schreiben
  // ("2026-11-02 - 2026-11-20"). Vorher brach das PDF daran mit 500 ab.
  let shootDates: string[] = []
  if (release?.shoot_dates) {
    try {
      const liste = JSON.parse(release.shoot_dates)
      shootDates = Array.isArray(liste) ? liste.map(String) : [String(liste)]
    } catch {
      shootDates = [String(release.shoot_dates)]
    }
  }
  shootDates = shootDates.filter(Boolean).map((d) => (istIsoDatum(d) ? fmtDate(d) : d))

  // Adressteile einzeln zusammensetzen - fehlende Angaben dürfen im Vertrag
  // nicht als "null" stehen
  const addr = [location.address, [location.zip, location.city].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ')

  const LINIE = '_________________________'

  const html = renderDocument({
    kind: 'Motivnutzungsvertrag',
    title: location.name,
    project: project?.title,
    subtitle: 'Drehgenehmigung / Location Release',
    accent: '#3f3f46',
    meta: [
      { label: 'Status', value: release?.status || 'Entwurf' },
      { label: 'Stand', value: fmtDate(new Date().toISOString()) },
    ],
    footnote: 'Rechtsverbindlich erst mit beiderseitiger Unterschrift',
    body:
      section('Vertragsgegenstand', definitions([
        { label: 'Motiv', value: location.name },
        { label: 'Adresse', value: addr || LINIE },
        { label: 'Produktion', value: project?.title },
        { label: 'Eigentümer/in', value: release?.owner_name || LINIE },
        { label: 'Adresse Eigentümer/in', value: release?.owner_address || LINIE, wide: true },
        { label: 'Drehdaten', value: shootDates.length > 0 ? shootDates.join(', ') : LINIE, wide: true },
        // Im Vertrag gehört an eine offene Stelle eine Linie zum Ausfüllen,
        // kein Strich und erst recht keine 0. Die Spalte ist NOT NULL DEFAULT 0
        // und die Oberfläche fragt keine Vergütung ab - vorher stand in jedem
        // Vertrag "0,00 €".
        { label: 'Vergütung', value: release?.fee_cents ? fmtMoney(release.fee_cents) : LINIE },
      ])) +
      section('Vereinbarung',
        paragraph(
          'Der/die Eigentümer/in erklärt sich hiermit einverstanden, dass die oben genannte ' +
          'Filmproduktion das angegebene Motiv an den genannten Terminen für Filmaufnahmen nutzen darf. ' +
          'Die Produktion verpflichtet sich, das Motiv im ursprünglichen Zustand zu hinterlassen und ' +
          'entstandene Schäden zu ersetzen.'
        ) +
        (release?.special_conditions
          ? definitions([{ label: 'Besondere Bedingungen', value: release.special_conditions, wide: true }])
          : '')
      ) +
      section('Unterschriften',
        (release?.signature_data
          ? `<img src="${String(release.signature_data).replace(/"/g, '&quot;')}" alt="Unterschrift" style="height:60pt;margin-bottom:6pt">`
          : '') +
        `<div class="sigs">
          <div class="sig"><div class="line"></div><div class="cap">Ort, Datum</div></div>
          <div class="sig"><div class="line"></div><div class="cap">Unterschrift Eigentümer/in</div></div>
          <div class="sig"><div class="line"></div><div class="cap">Unterschrift Produktion</div></div>
        </div>`
      ),
  })

  try {
    const pdf = await generatePdf(html, {
      footer: false,
      margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="motivvertrag-${slugify(location.name)}.pdf"`)
    res.send(pdf)
  } catch (e: any) {
    res.status(500).json({ data: null, error: `PDF-Fehler: ${e.message}` })
  }
})

export default router
