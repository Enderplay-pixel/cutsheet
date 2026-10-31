import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { schreibeCsv } from '../lib/tabelle'

const router = Router()

interface Contact {
  name: string
  role: string
  group: string
  email: string
  phone: string
}

async function collectContacts(projectId: string | number): Promise<Contact[]> {
  const crew = await db.all(
    'SELECT name, role, email, phone FROM crew WHERE project_id = ? ORDER BY sort_order, name',
    [projectId]
  ) as any[]
  const cast = await db.all(
    `SELECT c.actor_name as name, ch.name as role, c.email, c.phone FROM "cast" c
     LEFT JOIN characters ch ON c.character_id = ch.id WHERE c.project_id = ? ORDER BY c.actor_name`,
    [projectId]
  ) as any[]
  const locations = await db.all(
    'SELECT contact_name as name, name as role, contact_phone as phone, contact_email as email FROM locations WHERE project_id = ? AND contact_name != \'\'',
    [projectId]
  ) as any[]
  // Komparsen gehören dazu (Fund 179): vorher fehlten sie, und Motiv-Kontakte
  // kamen ohne ihre E-Mail, obwohl die Spalte gepflegt wird
  const extras = await db.all(
    'SELECT name, tariff_group, email, phone FROM extras WHERE project_id = ? ORDER BY name',
    [projectId]
  ) as any[]

  return [
    ...crew.map(c => ({ name: c.name || '', role: c.role || '', group: 'Stab', email: c.email || '', phone: c.phone || '' })),
    ...cast.map(c => ({ name: c.name || '', role: c.role ? `Rolle: ${c.role}` : 'Cast', group: 'Besetzung', email: c.email || '', phone: c.phone || '' })),
    ...extras.map(e => ({ name: e.name || '', role: e.tariff_group ? `Komparse (${e.tariff_group})` : 'Komparse', group: 'Komparserie', email: e.email || '', phone: e.phone || '' })),
    ...locations.map(l => ({ name: l.name || '', role: `Motiv-Kontakt: ${l.role || ''}`, group: 'Motive', email: l.email || '', phone: l.phone || '' })),
  ].filter(c => c.name)
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

// GET /api/projects/:projectId/kontakte/export.vcf - vCard 3.0 (PreProducer-Parität)
router.get('/projects/:projectId/kontakte/export.vcf', requireAuth, requireMember, async (req: Request, res: Response) => {
  const project = await db.get('SELECT title FROM projects WHERE id = ?', [req.params.projectId]) as any
  const contacts = await collectContacts(req.params.projectId)

  const cards = contacts.map(c => {
    const parts = c.name.split(' ')
    const last = parts.length > 1 ? parts[parts.length - 1] : ''
    const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : c.name
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${esc(last)};${esc(first)};;;`,
      `FN:${esc(c.name)}`,
      c.role ? `TITLE:${esc(c.role)}` : '',
      `ORG:${esc(project?.title || 'CutSheet')};${esc(c.group)}`,
      c.phone ? `TEL;TYPE=CELL:${c.phone}` : '',
      c.email ? `EMAIL;TYPE=INTERNET:${c.email}` : '',
      'END:VCARD',
    ].filter(Boolean).join('\r\n')
  }).join('\r\n')

  res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="cutsheet-kontakte.vcf"')
  return res.send(cards + '\r\n')
})

// GET /api/projects/:projectId/kontakte/export.csv
router.get('/projects/:projectId/kontakte/export.csv', requireAuth, requireMember, async (req: Request, res: Response) => {
  const contacts = await collectContacts(req.params.projectId)
  // schreibeCsv setzt vor =, +, @ … ein Hochkomma: Vorher stand ein Name wie
  // =HYPERLINK(…) unverändert in der Datei, Excel hätte ihn ausgeführt
  const csv = schreibeCsv(['Name', 'Funktion', 'Gruppe', 'E-Mail', 'Telefon'],
    contacts.map(c => [c.name, c.role, c.group, c.email, c.phone]))

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="cutsheet-kontakte.csv"')
  return res.send(csv)
})

export default router
