import { Router, Request, Response } from 'express'
import { db } from '../db'
import { generatePdf } from './pdf'
import { renderDocument, section, definitions, paragraph, fmtMoney, fmtDate } from '../lib/documentLayout'

/** Dateinamen von Zeichen befreien, die den Download-Header zerlegen. */
function slugify(value: string): string {
  const out = String(value ?? '').normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/\s+/g, '-').toLowerCase()
  return out || 'dokument'
}

const router = Router()

// GET /api/locations/:id/release
router.get('/locations/:id/release', async (req: Request, res: Response) => {
  const release = await db.get('SELECT * FROM location_releases WHERE location_id = ?', [req.params.id])
  res.json({ data: release || null, error: null })
})

// POST /api/locations/:id/release
router.post('/locations/:id/release', async (req: Request, res: Response) => {
  const { owner_name = '', owner_address = '', shoot_dates = '[]', fee_cents = 0, special_conditions = '', status = 'Entwurf' } = req.body
  const existing = await db.get('SELECT id FROM location_releases WHERE location_id = ?', [req.params.id])
  if (existing) {
    await db.run(
      'UPDATE location_releases SET owner_name=?, owner_address=?, shoot_dates=?, fee_cents=?, special_conditions=?, status=? WHERE id=?',
      [owner_name, owner_address, typeof shoot_dates === 'string' ? shoot_dates : JSON.stringify(shoot_dates), fee_cents, special_conditions, status, existing.id]
    )
    res.json({ data: await db.get('SELECT * FROM location_releases WHERE id=?', [existing.id]), error: null })
  } else {
    const result = await db.run(
      'INSERT INTO location_releases (location_id, owner_name, owner_address, shoot_dates, fee_cents, special_conditions, status) VALUES (?,?,?,?,?,?,?)',
      [req.params.id, owner_name, owner_address, typeof shoot_dates === 'string' ? shoot_dates : JSON.stringify(shoot_dates), fee_cents, special_conditions, status]
    )
    res.json({ data: await db.get('SELECT * FROM location_releases WHERE id=?', [result.id]), error: null })
  }
})

// PATCH /api/locations/:id/release/sign
router.patch('/locations/:id/release/sign', async (req: Request, res: Response) => {
  const { signature_data, signed_by } = req.body
  const release = await db.get('SELECT id FROM location_releases WHERE location_id = ?', [req.params.id])
  if (!release) return res.status(404).json({ data: null, error: 'Kein Motivvertrag gefunden' })
  await db.run(
    "UPDATE location_releases SET signature_data=?, signed_by=?, signed_at=NOW(), status='Unterschrieben' WHERE id=?",
    [signature_data, signed_by, release.id]
  )
  res.json({ data: await db.get('SELECT * FROM location_releases WHERE id=?', [release.id]), error: null })
})

// GET /api/locations/:id/release/pdf
router.get('/locations/:id/release/pdf', async (req: Request, res: Response) => {
  const location = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]) as any
  if (!location) return res.status(404).json({ data: null, error: 'Motiv nicht gefunden' })
  const release = await db.get('SELECT * FROM location_releases WHERE location_id = ?', [req.params.id]) as any

  const project = await db.get('SELECT title FROM projects WHERE id = ?', [location.project_id]) as any

  const shootDates = release ? JSON.parse(release.shoot_dates || '[]') : []

  // Adressteile einzeln zusammensetzen — fehlende Angaben duerfen im Vertrag
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
        // Im Vertrag gehoert an eine offene Stelle eine Linie zum Ausfuellen,
        // kein Strich und erst recht keine 0
        { label: 'Vergütung', value: release?.fee_cents != null ? fmtMoney(release.fee_cents) : LINIE },
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
