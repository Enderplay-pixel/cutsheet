/**
 * Datenschutz-Werkzeuge: Auskunft, Löschung, Verzeichnis.
 *
 * Wer mit Personendaten arbeitet, muss auf Anfrage Auskunft geben und löschen
 * können. Ohne Werkzeug heisst das: jemand durchsucht von Hand zwölf
 * Tabellen. Mit Werkzeug sind es zwei Klicks - und beides wird protokolliert.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { getUserProjectRole, ROLE_RANK } from '../middleware/projectAuth'
import { auskunft, anonymisiere, type Personenart } from '../lib/datenschutz'
import { heuteISO } from '../lib/datum'

const router = Router()

const ARTEN: Personenart[] = ['crew', 'cast', 'extra']

/** Auskunft und Löschung sind Sache der Produktion, nicht jedes Mitglieds. */
async function darfVerwalten(req: Request, projectId: number): Promise<boolean> {
  const user = (req as any).user
  if (!user) return false
  if (user.role === 'admin') return true
  const rolle = await getUserProjectRole(user.id, projectId)
  return (ROLE_RANK[rolle || ''] ?? 0) >= ROLE_RANK.producer
}

// GET /api/projects/:projectId/datenschutz/auskunft?art=crew&person=5
router.get('/projects/:projectId/datenschutz/auskunft', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  if (!(await darfVerwalten(req, projectId))) {
    return res.status(403).json({ data: null, error: 'Auskunft erteilt die Produktion' })
  }
  const art = String(req.query.art || 'crew') as Personenart
  if (!ARTEN.includes(art)) {
    return res.status(400).json({ data: null, error: 'Unbekannte Personenart' })
  }
  const ergebnis = await auskunft(projectId, art, Number(req.query.person))
  if (!ergebnis) return res.status(404).json({ data: null, error: 'Person nicht gefunden' })

  const projekt = (await db.get('SELECT title FROM projects WHERE id = ?', [projectId])) as any
  return res.json({
    data: {
      erstellt_am: heuteISO(),
      projekt: projekt?.title || '',
      rechtsgrundlage: 'Auskunft nach Artikel 15 DSGVO',
      ...ergebnis,
    },
    error: null,
  })
})

// POST /api/projects/:projectId/datenschutz/anonymisieren
router.post('/projects/:projectId/datenschutz/anonymisieren', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  if (!(await darfVerwalten(req, projectId))) {
    return res.status(403).json({ data: null, error: 'Löschen darf die Produktion' })
  }
  const art = String(req.body?.art || '') as Personenart
  if (!ARTEN.includes(art)) {
    return res.status(400).json({ data: null, error: 'Unbekannte Personenart' })
  }
  const ergebnis = await anonymisiere(projectId, art, Number(req.body?.person_id), String(req.body?.grund || ''))
  if (!ergebnis) return res.status(404).json({ data: null, error: 'Person nicht gefunden' })
  return res.json({
    data: {
      ...ergebnis,
      hinweis:
        'Der Personenbezug ist entfernt. Dispositionen und Arbeitszeiten bleiben als ' +
        'Produktionsunterlage bestehen - ohne Namen, Kontakt und Freitexte.',
    },
    error: null,
  })
})

/**
 * Wer hat in diesem Projekt Zugriff auf Personendaten?
 *
 * Für die Auskunft an Betroffene und für das eigene Verzeichnis: Eine
 * Produktion muss wissen, wer die Daten sehen kann.
 */
router.get('/projects/:projectId/datenschutz/zugriff', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  if (!(await darfVerwalten(req, projectId))) {
    return res.status(403).json({ data: null, error: 'Diese Übersicht sieht die Produktion' })
  }
  const zeilen = await db.all(
    `SELECT u.name, u.email, m.role
       FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_id = ?
      UNION
     SELECT u.name, u.email, 'admin' AS role
       FROM projects p JOIN users u ON u.id = p.owner_id
      WHERE p.id = ?
      ORDER BY role ASC`,
    [projectId, projectId]
  )
  const gaeste = (await db.get(
    "SELECT COUNT(*) AS c FROM guest_tokens WHERE project_id = ?",
    [projectId]
  )) as any
  return res.json({
    data: { mitglieder: zeilen, gastzugaenge: Number(gaeste?.c ?? 0) },
    error: null,
  })
})

/**
 * Verzeichnis der Verarbeitungstätigkeiten nach Artikel 30 DSGVO.
 *
 * Die Angaben stehen fest, weil die Verarbeitung feststeht: Es ist die
 * Software, die sie durchführt. Was je Firma wechselt - Name, Anschrift,
 * Ansprechperson - wird eingesetzt.
 */
router.get('/companies/:companyId/datenschutz/verzeichnis', requireAuth, async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const user = (req as any).user
  const firma = (await db.get('SELECT * FROM companies WHERE id = ?', [companyId])) as any
  if (!firma) return res.status(404).json({ data: null, error: 'Firma nicht gefunden' })
  if (user.role !== 'admin') {
    const mitglied = (await db.get(
      'SELECT role FROM company_members WHERE company_id = ? AND user_id = ?',
      [companyId, user.id]
    )) as any
    if (firma.owner_id !== user.id && !mitglied) {
      return res.status(403).json({ data: null, error: 'Kein Zugriff auf diese Firma' })
    }
  }

  const projekte = (await db.get(
    'SELECT COUNT(*) AS c FROM projects WHERE company_id = ?',
    [companyId]
  )) as any

  return res.json({
    data: {
      stand: heuteISO(),
      verantwortlicher: {
        name: firma.legal_name || firma.name,
        anschrift: [firma.address, [firma.zip, firma.city].filter(Boolean).join(' '), firma.country]
          .filter(Boolean)
          .join(', '),
        kontakt: firma.email || '',
        telefon: firma.phone || '',
      },
      taetigkeiten: [
        {
          zweck: 'Produktionsplanung',
          kategorien: ['Stab', 'Besetzung', 'Komparserie'],
          daten: ['Name', 'Funktion', 'Abteilung', 'E-Mail', 'Telefon', 'Tagessatz'],
          grundlage: 'Artikel 6 Absatz 1 Buchstabe b DSGVO (Vertrag) bzw. Buchstabe f (berechtigtes Interesse)',
          empfaenger: 'Projektmitglieder mit Zugriff auf das jeweilige Projekt',
          frist: 'bis zum Abschluss der Produktion, danach Anonymisierung auf Anforderung',
        },
        {
          zweck: 'Disposition und Arbeitszeiterfassung',
          kategorien: ['Stab', 'Besetzung'],
          daten: ['Call-Zeiten', 'Anwesenheit', 'Pausen', 'Zuschläge'],
          grundlage: 'Artikel 6 Absatz 1 Buchstabe b DSGVO, Paragraf 16 Absatz 2 ArbZG',
          empfaenger: 'Produktion, Aufnahmeleitung',
          frist: 'zwei Jahre nach Paragraf 16 Absatz 2 ArbZG',
        },
        {
          zweck: 'Verpflegung am Set',
          kategorien: ['Stab', 'Besetzung'],
          daten: ['Ernährungsangaben, ggf. Unverträglichkeiten'],
          grundlage: 'Artikel 6 Absatz 1 Buchstabe a DSGVO (Einwilligung)',
          empfaenger: 'Aufnahmeleitung, Catering',
          frist: 'bis zum Ende des Drehs',
        },
        {
          zweck: 'Abrechnung',
          kategorien: ['Auftraggeber', 'Stab', 'Besetzung'],
          daten: ['Anschrift', 'Umsatzsteuer-ID', 'Rechnungsbeträge'],
          grundlage: 'Artikel 6 Absatz 1 Buchstabe c DSGVO, Paragraf 147 AO',
          empfaenger: 'Steuerberatung, Finanzbehörden',
          frist: 'zehn Jahre nach Paragraf 147 Absatz 3 AO',
        },
        {
          zweck: 'Versand von Dispositionen',
          kategorien: ['Stab', 'Besetzung'],
          daten: ['E-Mail-Adresse', 'Versandzeitpunkt', 'Empfangsbestätigung'],
          grundlage: 'Artikel 6 Absatz 1 Buchstabe b DSGVO',
          empfaenger: 'der jeweilige Mailanbieter der Produktion',
          frist: 'Anhänge 60 Tage, Protokoll 365 Tage',
        },
      ],
      umfang: { projekte: Number(projekte?.c ?? 0) },
      technische_massnahmen: [
        'Zugriff nur mit Konto und Passwort, Passwörter als Hash gespeichert',
        'Zweiter Faktor je Konto zuschaltbar',
        'Rollen je Projekt: wer nicht Mitglied ist, sieht nichts',
        'Übertragung ausschliesslich über HTTPS',
        'Änderungen werden im Protokoll festgehalten',
        'Öffentliche Links tragen Zufallstoken mit 160 Bit',
      ],
    },
    error: null,
  })
})

export default router
