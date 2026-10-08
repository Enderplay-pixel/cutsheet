/**
 * Die Firma über den Projekten.
 *
 * Grundsatz des Zugriffs: Die Zugehörigkeit zu einer Firma öffnet die
 * **Stammdaten** der Firma - Adressbuch, Gagensätze, Vorlagen. Sie öffnet
 * ausdrücklich **keine** fremden Projekte. Wer ein Projekt sehen will, muss
 * darin Mitglied sein; das prüft weiterhin `middleware/projectAuth`.
 *
 * Wird ein Projekt unter einer Firma angelegt, werden die Firmenleitungen
 * sichtbar als Projektmitglieder eingetragen - lieber ein Eintrag, den man
 * sieht und entfernen kann, als ein stiller Durchgriff.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { istAdresse } from '../lib/mailversand'
import { STANDARDVORLAGEN } from '../lib/mailvorlagen'

const router = Router()

/** Rollen innerhalb einer Firma, von viel zu wenig. */
export const FIRMEN_RANG: Record<string, number> = {
  inhaber: 3,
  produktion: 2,
  mitarbeiter: 1,
}

async function rolleInFirma(userId: number, companyId: number): Promise<string | null> {
  const firma = (await db.get('SELECT owner_id FROM companies WHERE id = ?', [companyId])) as any
  if (!firma) return null
  if (firma.owner_id === userId) return 'inhaber'
  const mitglied = (await db.get(
    'SELECT role FROM company_members WHERE company_id = ? AND user_id = ?',
    [companyId, userId]
  )) as any
  return mitglied?.role ?? null
}

/** Middleware: Zugehörigkeit zur Firma, optional ab einer Mindestrolle. */
function erfordereFirma(mindestens = 'mitarbeiter') {
  return async (req: Request, res: Response, next: Function) => {
    const user = (req as any).user
    if (!user) return res.status(401).json({ data: null, error: 'Nicht authentifiziert' })
    const companyId = Number(req.params.companyId ?? req.params.id)
    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({ data: null, error: 'Keine gültige Firma' })
    }
    // Globale Admins kommen überall hin - wie im restlichen Server auch.
    if (user.role === 'admin') {
      ;(req as any).firmenrolle = 'inhaber'
      return next()
    }
    const rolle = await rolleInFirma(user.id, companyId)
    if (!rolle) return res.status(403).json({ data: null, error: 'Kein Zugriff auf diese Firma' })
    if ((FIRMEN_RANG[rolle] ?? 0) < (FIRMEN_RANG[mindestens] ?? 1)) {
      return res.status(403).json({
        data: null,
        error: 'Dafür fehlt dir die Berechtigung in dieser Firma',
      })
    }
    ;(req as any).firmenrolle = rolle
    return next()
  }
}

// ─── Firmen ───────────────────────────────────────────────────────────────────

// GET /api/companies - die Firmen, zu denen ich gehöre
router.get('/companies', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const zeilen = await db.all(
    `SELECT c.*,
            CASE WHEN c.owner_id = ? THEN 'inhaber' ELSE m.role END AS meine_rolle,
            (SELECT COUNT(*) FROM projects p WHERE p.company_id = c.id AND p.archived = 0) AS projekte,
            (SELECT COUNT(*) FROM company_contacts k WHERE k.company_id = c.id AND k.archived = false) AS kontakte
       FROM companies c
       LEFT JOIN company_members m ON m.company_id = c.id AND m.user_id = ?
      WHERE c.owner_id = ? OR m.user_id IS NOT NULL
      ORDER BY c.name ASC`,
    [user.id, user.id, user.id]
  )
  return res.json({ data: zeilen, error: null })
})

// POST /api/companies
router.post('/companies', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user
  const { name } = req.body || {}
  if (!name || !String(name).trim()) {
    return res.status(400).json({ data: null, error: 'Die Firma braucht einen Namen' })
  }
  const zeile = await db.run('INSERT INTO companies (name, owner_id) VALUES (?, ?)', [String(name).trim(), user.id])
  await db.run(
    "INSERT INTO company_members (company_id, user_id, role) VALUES (?, ?, 'inhaber') ON CONFLICT DO NOTHING",
    [zeile.id, user.id]
  )
  return res.json({ data: { id: zeile.id }, error: null })
})

// GET /api/companies/:companyId
router.get('/companies/:companyId', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const firma = (await db.get('SELECT * FROM companies WHERE id = ?', [Number(req.params.companyId)])) as any
  return res.json({ data: { ...firma, meine_rolle: (req as any).firmenrolle }, error: null })
})

// PUT /api/companies/:companyId
router.put('/companies/:companyId', requireAuth, erfordereFirma('produktion'), async (req: Request, res: Response) => {
  const felder = [
    'name', 'legal_name', 'address', 'zip', 'city', 'country',
    'tax_number', 'vat_id', 'phone', 'email', 'website', 'logo_url', 'default_currency',
  ]
  const koerper = req.body || {}
  if (koerper.email && !istAdresse(String(koerper.email))) {
    return res.status(400).json({ data: null, error: 'Die E-Mail-Adresse der Firma ist nicht gültig' })
  }
  const satz = felder.filter((f) => koerper[f] !== undefined)
  if (satz.length === 0) return res.json({ data: { gespeichert: false }, error: null })
  await db.run(
    `UPDATE companies SET ${satz.map((f) => `${f} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`,
    [...satz.map((f) => String(koerper[f] ?? '')), Number(req.params.companyId)]
  )
  return res.json({ data: { gespeichert: true }, error: null })
})

// ─── Mitglieder der Firma ─────────────────────────────────────────────────────

// GET /api/companies/:companyId/members
router.get('/companies/:companyId/members', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const zeilen = await db.all(
    `SELECT m.id, m.role, u.id AS user_id, u.name, u.email
       FROM company_members m JOIN users u ON u.id = m.user_id
      WHERE m.company_id = ?
      ORDER BY u.name ASC`,
    [Number(req.params.companyId)]
  )
  return res.json({ data: zeilen, error: null })
})

// POST /api/companies/:companyId/members - vorhandenes Konto aufnehmen
router.post('/companies/:companyId/members', requireAuth, erfordereFirma('inhaber'), async (req: Request, res: Response) => {
  const { email, role } = req.body || {}
  if (!istAdresse(String(email || ''))) {
    return res.status(400).json({ data: null, error: 'Keine gültige E-Mail-Adresse' })
  }
  const konto = (await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [String(email).trim().toLowerCase()])) as any
  if (!konto) {
    return res.status(404).json({
      data: null,
      error: 'Zu dieser Adresse gibt es noch kein Konto. Lade die Person zuerst in ein Projekt ein.',
    })
  }
  const rolle = FIRMEN_RANG[String(role)] ? String(role) : 'mitarbeiter'
  await db.run(
    `INSERT INTO company_members (company_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [Number(req.params.companyId), konto.id, rolle]
  )
  return res.json({ data: { aufgenommen: true }, error: null })
})

// DELETE /api/companies/:companyId/members/:memberId
router.delete('/companies/:companyId/members/:memberId', requireAuth, erfordereFirma('inhaber'), async (req: Request, res: Response) => {
  const firma = (await db.get('SELECT owner_id FROM companies WHERE id = ?', [Number(req.params.companyId)])) as any
  const mitglied = (await db.get('SELECT user_id FROM company_members WHERE id = ? AND company_id = ?', [
    Number(req.params.memberId), Number(req.params.companyId),
  ])) as any
  if (!mitglied) return res.status(404).json({ data: null, error: 'Mitglied nicht gefunden' })
  if (mitglied.user_id === firma?.owner_id) {
    return res.status(400).json({ data: null, error: 'Die Inhaberin oder der Inhaber bleibt in der Firma' })
  }
  await db.run('DELETE FROM company_members WHERE id = ?', [Number(req.params.memberId)])
  return res.json({ data: { entfernt: true }, error: null })
})

// ─── Adressbuch ───────────────────────────────────────────────────────────────

// GET /api/companies/:companyId/contacts
router.get('/companies/:companyId/contacts', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const suche = String(req.query.q || '').trim().toLowerCase()
  const bedingungen = ['company_id = ?', 'archived = false']
  const werte: any[] = [Number(req.params.companyId)]
  if (suche) {
    bedingungen.push('(LOWER(name) LIKE ? OR LOWER(role) LIKE ? OR LOWER(department) LIKE ? OR LOWER(tags) LIKE ?)')
    werte.push(`%${suche}%`, `%${suche}%`, `%${suche}%`, `%${suche}%`)
  }
  const zeilen = await db.all(
    `SELECT * FROM company_contacts WHERE ${bedingungen.join(' AND ')} ORDER BY name ASC LIMIT 500`,
    werte
  )
  return res.json({ data: zeilen, error: null })
})

// POST /api/companies/:companyId/contacts
router.post('/companies/:companyId/contacts', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const k = req.body || {}
  if (!k.name || !String(k.name).trim()) {
    return res.status(400).json({ data: null, error: 'Die Person braucht einen Namen' })
  }
  if (k.email && !istAdresse(String(k.email))) {
    return res.status(400).json({ data: null, error: 'Die E-Mail-Adresse ist nicht gültig' })
  }
  const zeile = await db.run(
    `INSERT INTO company_contacts (company_id, name, role, department, email, phone, city, day_rate_cents, notes, tags, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(req.params.companyId), String(k.name).trim(), String(k.role || ''), String(k.department || ''),
      String(k.email || ''), String(k.phone || ''), String(k.city || ''),
      Number(k.day_rate_cents || 0), String(k.notes || ''), String(k.tags || ''), String(k.kind || 'crew'),
    ]
  )
  return res.json({ data: { id: zeile.id }, error: null })
})

// PUT /api/companies/:companyId/contacts/:contactId
router.put('/companies/:companyId/contacts/:contactId', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const k = req.body || {}
  if (k.email && !istAdresse(String(k.email))) {
    return res.status(400).json({ data: null, error: 'Die E-Mail-Adresse ist nicht gültig' })
  }
  const zeile = await db.run(
    `UPDATE company_contacts
        SET name = ?, role = ?, department = ?, email = ?, phone = ?, city = ?,
            day_rate_cents = ?, notes = ?, tags = ?, kind = ?, updated_at = NOW()
      WHERE id = ? AND company_id = ?`,
    [
      String(k.name || ''), String(k.role || ''), String(k.department || ''), String(k.email || ''),
      String(k.phone || ''), String(k.city || ''), Number(k.day_rate_cents || 0),
      String(k.notes || ''), String(k.tags || ''), String(k.kind || 'crew'),
      Number(req.params.contactId), Number(req.params.companyId),
    ]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

// DELETE /api/companies/:companyId/contacts/:contactId - wird archiviert, nicht gelöscht
router.delete('/companies/:companyId/contacts/:contactId', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const zeile = await db.run(
    'UPDATE company_contacts SET archived = true, updated_at = NOW() WHERE id = ? AND company_id = ?',
    [Number(req.params.contactId), Number(req.params.companyId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })
  return res.json({ data: { archiviert: true }, error: null })
})

// ─── Gagensätze ───────────────────────────────────────────────────────────────

// GET /api/companies/:companyId/rates
router.get('/companies/:companyId/rates', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const zeilen = await db.all(
    'SELECT * FROM company_rates WHERE company_id = ? ORDER BY department ASC, role ASC',
    [Number(req.params.companyId)]
  )
  return res.json({ data: zeilen, error: null })
})

// POST /api/companies/:companyId/rates
router.post('/companies/:companyId/rates', requireAuth, erfordereFirma('produktion'), async (req: Request, res: Response) => {
  const { role, department, day_rate_cents, note } = req.body || {}
  if (!role || !String(role).trim()) {
    return res.status(400).json({ data: null, error: 'Der Satz braucht eine Funktion' })
  }
  const zeile = await db.run(
    'INSERT INTO company_rates (company_id, role, department, day_rate_cents, note) VALUES (?, ?, ?, ?, ?)',
    [Number(req.params.companyId), String(role).trim(), String(department || ''), Number(day_rate_cents || 0), String(note || '')]
  )
  return res.json({ data: { id: zeile.id }, error: null })
})

// DELETE /api/companies/:companyId/rates/:rateId
router.delete('/companies/:companyId/rates/:rateId', requireAuth, erfordereFirma('produktion'), async (req: Request, res: Response) => {
  const zeile = await db.run('DELETE FROM company_rates WHERE id = ? AND company_id = ?', [
    Number(req.params.rateId), Number(req.params.companyId),
  ])
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Satz nicht gefunden' })
  return res.json({ data: { geloescht: true }, error: null })
})

// ─── Mailvorlagen der Firma ───────────────────────────────────────────────────

// GET /api/companies/:companyId/templates
router.get('/companies/:companyId/templates', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const zeilen = await db.all(
    'SELECT * FROM email_templates WHERE company_id = ? AND project_id IS NULL ORDER BY name ASC',
    [Number(req.params.companyId)]
  )
  return res.json({ data: zeilen, error: null })
})

// POST /api/companies/:companyId/templates
router.post('/companies/:companyId/templates', requireAuth, erfordereFirma('produktion'), async (req: Request, res: Response) => {
  const { name, subject, body, template_key } = req.body || {}
  if (!name || !String(name).trim()) {
    return res.status(400).json({ data: null, error: 'Die Vorlage braucht einen Namen' })
  }
  const zeile = await db.run(
    'INSERT INTO email_templates (company_id, project_id, template_key, name, subject, body) VALUES (?, NULL, ?, ?, ?, ?)',
    [Number(req.params.companyId), String(template_key || ''), String(name), String(subject || ''), String(body || '')]
  )
  return res.json({ data: { id: zeile.id }, error: null })
})

// PUT /api/companies/:companyId/templates/:templateId
router.put('/companies/:companyId/templates/:templateId', requireAuth, erfordereFirma('produktion'), async (req: Request, res: Response) => {
  const { name, subject, body } = req.body || {}
  const zeile = await db.run(
    `UPDATE email_templates SET name = ?, subject = ?, body = ?, updated_at = NOW()
      WHERE id = ? AND company_id = ? AND project_id IS NULL`,
    [String(name || ''), String(subject || ''), String(body || ''), Number(req.params.templateId), Number(req.params.companyId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Vorlage nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

// DELETE /api/companies/:companyId/templates/:templateId
router.delete('/companies/:companyId/templates/:templateId', requireAuth, erfordereFirma('produktion'), async (req: Request, res: Response) => {
  const zeile = await db.run(
    'DELETE FROM email_templates WHERE id = ? AND company_id = ? AND project_id IS NULL',
    [Number(req.params.templateId), Number(req.params.companyId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Vorlage nicht gefunden' })
  return res.json({ data: { geloescht: true }, error: null })
})

/**
 * Legt die mitgelieferten Standardvorlagen als Firmenvorlagen an - der
 * Startpunkt zum Anpassen, statt vor einem leeren Feld zu sitzen.
 */
router.post('/companies/:companyId/templates/standard', requireAuth, erfordereFirma('produktion'), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const vorhanden = (await db.get(
    'SELECT COUNT(*) AS c FROM email_templates WHERE company_id = ? AND project_id IS NULL',
    [companyId]
  )) as any
  if (Number(vorhanden?.c ?? 0) > 0) {
    return res.status(400).json({ data: null, error: 'Diese Firma hat bereits Vorlagen' })
  }
  for (const vorlage of STANDARDVORLAGEN) {
    await db.run(
      'INSERT INTO email_templates (company_id, project_id, template_key, name, subject, body) VALUES (?, NULL, ?, ?, ?, ?)',
      [companyId, vorlage.schluessel, vorlage.name, vorlage.betreff, vorlage.text]
    )
  }
  return res.json({ data: { angelegt: STANDARDVORLAGEN.length }, error: null })
})

// ─── Verfügbarkeit über Projekte hinweg ───────────────────────────────────────

/**
 * Wo ist diese Person wann gebucht? Zählt alle Drehtage aller Projekte der
 * Firma, in denen ein Stab- oder Besetzungseintrag auf denselben
 * Adressbucheintrag zeigt.
 *
 * Bewusst knapp: Projekttitel, Datum, Drehtagnummer. Keine Gagen, keine
 * Notizen - die Verfügbarkeit soll eine Terminauskunft sein, keine
 * Hintertür in fremde Projekte.
 */
router.get('/companies/:companyId/contacts/:contactId/availability', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const contactId = Number(req.params.contactId)
  const kontakt = (await db.get('SELECT id FROM company_contacts WHERE id = ? AND company_id = ?', [contactId, companyId])) as any
  if (!kontakt) return res.status(404).json({ data: null, error: 'Eintrag nicht gefunden' })

  const tage = await db.all(
    `SELECT p.id AS project_id, p.title, d.day_number, d.date
       FROM shoot_days d
       JOIN projects p ON p.id = d.project_id
      WHERE p.company_id = ?
        AND EXISTS (
          SELECT 1 FROM call_sheets s
            JOIN call_sheet_entries e ON e.call_sheet_id = s.id
            JOIN crew c ON c.id = e.person_id
           WHERE s.shoot_day_id = d.id AND e.person_type = ? AND c.contact_id = ?
        )
      ORDER BY d.date ASC
      LIMIT 200`,
    [companyId, 'crew', contactId]
  )
  const besetzungstage = await db.all(
    `SELECT p.id AS project_id, p.title, d.day_number, d.date
       FROM shoot_days d
       JOIN projects p ON p.id = d.project_id
      WHERE p.company_id = ?
        AND EXISTS (
          SELECT 1 FROM call_sheets s
            JOIN call_sheet_entries e ON e.call_sheet_id = s.id
            JOIN "cast" k ON k.id = e.person_id
           WHERE s.shoot_day_id = d.id AND e.person_type = ? AND k.contact_id = ?
        )
      ORDER BY d.date ASC
      LIMIT 200`,
    [companyId, 'cast', contactId]
  )
  const alle = [...(tage as any[]), ...(besetzungstage as any[])].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
  )
  return res.json({ data: alle, error: null })
})

// ─── Übernahme ins Projekt ────────────────────────────────────────────────────

/**
 * Trägt Adressbucheinträge als Stab oder Besetzung in ein Projekt ein.
 * Geprüft wird beides: Zugehörigkeit zur Firma (über die Middleware) und
 * Mitgliedschaft im Zielprojekt - ein Firmenkonto allein öffnet kein Projekt.
 */
router.post('/companies/:companyId/contacts/import', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const user = (req as any).user
  const companyId = Number(req.params.companyId)
  const { project_id, contact_ids } = req.body || {}
  const projektId = Number(project_id)
  if (!Number.isInteger(projektId) || !Array.isArray(contact_ids) || contact_ids.length === 0) {
    return res.status(400).json({ data: null, error: 'Projekt und mindestens ein Eintrag sind nötig' })
  }

  const projekt = (await db.get('SELECT id, company_id, owner_id FROM projects WHERE id = ?', [projektId])) as any
  if (!projekt) return res.status(404).json({ data: null, error: 'Projekt nicht gefunden' })
  if (projekt.company_id !== companyId) {
    return res.status(400).json({ data: null, error: 'Dieses Projekt gehört nicht zu dieser Firma' })
  }
  if (user.role !== 'admin' && projekt.owner_id !== user.id) {
    const mitglied = (await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projektId, user.id]
    )) as any
    if (!mitglied || mitglied.role === 'read_only') {
      return res.status(403).json({ data: null, error: 'Kein Schreibzugriff auf dieses Projekt' })
    }
  }

  const kontakte = (await db.all(
    `SELECT * FROM company_contacts WHERE company_id = ? AND id IN (${contact_ids.map(() => '?').join(',')})`,
    [companyId, ...contact_ids.map((id: any) => Number(id))]
  )) as any[]

  let stab = 0
  let besetzung = 0
  for (const kontakt of kontakte) {
    if (kontakt.kind === 'cast') {
      const schon = (await db.get('SELECT id FROM "cast" WHERE project_id = ? AND contact_id = ?', [projektId, kontakt.id])) as any
      if (schon) continue
      await db.run(
        'INSERT INTO "cast" (project_id, actor_name, email, phone, contact_id) VALUES (?, ?, ?, ?, ?)',
        [projektId, kontakt.name, kontakt.email, kontakt.phone, kontakt.id]
      )
      besetzung++
    } else {
      const schon = (await db.get('SELECT id FROM crew WHERE project_id = ? AND contact_id = ?', [projektId, kontakt.id])) as any
      if (schon) continue
      await db.run(
        'INSERT INTO crew (project_id, name, role, department, email, phone, fee_per_day, contact_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [projektId, kontakt.name, kontakt.role, kontakt.department, kontakt.email, kontakt.phone, kontakt.day_rate_cents, kontakt.id]
      )
      stab++
    }
  }
  return res.json({ data: { stab, besetzung, uebersprungen: kontakte.length - stab - besetzung }, error: null })
})

/** Umgekehrter Weg: Personen aus einem Projekt ins Adressbuch übernehmen. */
router.post('/companies/:companyId/contacts/from-project', requireAuth, erfordereFirma(), async (req: Request, res: Response) => {
  const user = (req as any).user
  const companyId = Number(req.params.companyId)
  const projektId = Number(req.body?.project_id)
  if (!Number.isInteger(projektId)) {
    return res.status(400).json({ data: null, error: 'Es fehlt das Projekt' })
  }
  const projekt = (await db.get('SELECT id, company_id, owner_id FROM projects WHERE id = ?', [projektId])) as any
  if (!projekt || projekt.company_id !== companyId) {
    return res.status(404).json({ data: null, error: 'Projekt gehört nicht zu dieser Firma' })
  }
  if (user.role !== 'admin' && projekt.owner_id !== user.id) {
    const mitglied = (await db.get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projektId, user.id]
    )) as any
    if (!mitglied) return res.status(403).json({ data: null, error: 'Kein Zugriff auf dieses Projekt' })
  }

  const stab = (await db.all(
    'SELECT * FROM crew WHERE project_id = ? AND contact_id IS NULL',
    [projektId]
  )) as any[]
  let uebernommen = 0
  for (const person of stab) {
    if (!person.name) continue
    // Gleiche Adresse heisst gleiche Person - ohne Adresse entscheidet der Name.
    const vorhanden = (await db.get(
      `SELECT id FROM company_contacts
        WHERE company_id = ? AND archived = false
          AND ((? <> '' AND LOWER(email) = LOWER(?)) OR (? = '' AND LOWER(name) = LOWER(?)))`,
      [companyId, person.email || '', person.email || '', person.email || '', person.name]
    )) as any
    const kontaktId = vorhanden
      ? vorhanden.id
      : (
          await db.run(
            `INSERT INTO company_contacts (company_id, name, role, department, email, phone, day_rate_cents, kind)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'crew')`,
            [companyId, person.name, person.role || '', person.department || '', person.email || '', person.phone || '', person.fee_per_day || 0]
          )
        ).id
    await db.run('UPDATE crew SET contact_id = ? WHERE id = ?', [kontaktId, person.id])
    if (!vorhanden) uebernommen++
  }
  return res.json({ data: { uebernommen, verknuepft: stab.length }, error: null })
})

export default router
