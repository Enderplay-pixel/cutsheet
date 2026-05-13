import { Router, Request, Response } from 'express'
import { db } from '../db'
import puppeteer from 'puppeteer'

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

  const shootDates = release ? JSON.parse(release.shoot_dates || '[]') : []
  const fee = release ? (release.fee_cents / 100).toFixed(2) : '0.00'

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Helvetica Neue', sans-serif; margin: 40px; color: #111; }
  h1 { font-size: 24px; text-align: center; margin-bottom: 4px; }
  .sub { text-align: center; color: #666; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  td:first-child { font-weight: 600; width: 200px; color: #555; }
  .signature-area { margin-top: 48px; border-top: 2px solid #000; padding-top: 8px; }
  .sig-line { display: inline-block; width: 45%; border-bottom: 1px solid #555; margin: 0 2%; }
  .footer { margin-top: 32px; font-size: 11px; color: #999; }
</style></head>
<body>
  <h1>MOTIVNUTZUNGSVERTRAG</h1>
  <div class="sub">Drehgenehmigung / Location Release</div>
  <table>
    <tr><td>Motiv</td><td>${location.name}</td></tr>
    <tr><td>Adresse</td><td>${location.address}, ${location.zip} ${location.city}</td></tr>
    <tr><td>Eigentümer/in</td><td>${release?.owner_name || '_______________'}</td></tr>
    <tr><td>Adresse Eigentümer</td><td>${release?.owner_address || '_______________'}</td></tr>
    <tr><td>Drehdaten</td><td>${shootDates.length > 0 ? shootDates.join(', ') : '_______________'}</td></tr>
    <tr><td>Vergütung</td><td>${fee} EUR</td></tr>
    <tr><td>Besondere Bedingungen</td><td>${release?.special_conditions || '–'}</td></tr>
    <tr><td>Status</td><td>${release?.status || 'Entwurf'}</td></tr>
  </table>
  <p>Der/die Eigentümer/in erklärt sich hiermit einverstanden, dass die oben genannte Filmproduktion die angegebenen Drehorte an den genannten Terminen für Filmaufnahmen nutzen darf.</p>
  ${release?.signature_data ? `<div class="signature-area"><img src="${release.signature_data}" style="height:80px;" /></div>` : ''}
  <div class="signature-area">
    <div class="sig-line"></div>&nbsp;&nbsp;<div class="sig-line"></div>
    <br><small style="margin: 0 2%">Ort, Datum &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Unterschrift Eigentümer/in</small>
  </div>
  <div class="footer">Generiert mit CutSheet &bull; ${new Date().toLocaleDateString('de-DE')}</div>
</body></html>`

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html)
  const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } })
  await browser.close()

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="motivvertrag-${location.name.replace(/\s+/g, '-')}.pdf"`)
  res.send(Buffer.from(pdf))
})

export default router
