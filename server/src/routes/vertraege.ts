/**
 * Verträge, Einverständnisse und der Jugendarbeitsschutz.
 *
 * Der Ablauf ist derselbe wie bei einer Tagesdisposition: Entwurf aus einer
 * Vorlage, Blatt ansehen, verschicken, Bestätigung einsammeln. Der Unterschied
 * ist, was danach passiert - eine Dispo darf fehlen, ein Vertrag nicht.
 *
 * Bestätigt wird über einen Link, nicht über eine eingescannte Unterschrift.
 * Das ist bewusst: Eine Zustimmung in Textform ist nachweisbar, wenn
 * festgehalten wird, wer wann welchem Text zugestimmt hat - und der Text wird
 * dafür beim Versand eingefroren.
 */
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { logAudit } from './audit'
import { generatePdf } from './pdf'
import { reiheEin } from '../lib/mailversand'
import { pdfFontFaces, PDF_SANS } from '../lib/pdfFonts'
import {
  ARTEN, STANDARDVORLAGEN, VERTRAGS_PLATZHALTER,
  platzhalterIn, fehlendeWerte, fuelleVorlage, euroText, datumText,
} from '../lib/vertraege'
import {
  pruefeEinsatz, grenzeFuer, alterAm, ANTRAGSUNTERLAGEN, KIND_BIS_ALTER,
} from '../lib/jugendschutz'

const router = Router()

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Minuten seit Mitternacht als Uhrzeit.
 *
 * Die Dispositionen speichern Zeiten als Ganzzahl - 480 heisst 8 Uhr. Der
 * Jugendarbeitsschutz rechnet mit Uhrzeiten, weil die Grenzen im Gesetz als
 * Uhrzeiten stehen und in jeder Meldung so auftauchen sollen.
 */
function alsUhrzeit(minuten: number): string {
  const m = Math.max(0, Math.round(Number(minuten) || 0))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function appBasisUrl(): string {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
}

// ─── Vorlagen ────────────────────────────────────────────────────────────────

/**
 * Die Vorlagen eines Projekts: eigene, die der Firma, und die mitgelieferten.
 *
 * Die mitgelieferten stehen nicht in der Datenbank. Sie haben keine Kennung
 * und lassen sich nicht ändern - wer sie anpassen will, legt eine eigene an.
 * So bleibt der Ausgangspunkt erhalten, auch wenn jemand eine Vorlage
 * verunstaltet hat.
 */
router.get('/projects/:projectId/vertragsvorlagen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const projekt = (await db.get('SELECT company_id FROM projects WHERE id = ?', [projectId])) as any
  const eigene = (await db.all(
    `SELECT * FROM contract_templates
      WHERE project_id = ? OR (company_id IS NOT NULL AND company_id = ?)
      ORDER BY kind ASC, name ASC`,
    [projectId, projekt?.company_id ?? -1]
  )) as any[]

  return res.json({
    data: {
      eigene,
      mitgeliefert: STANDARDVORLAGEN.map((v) => ({ ...v, platzhalter: platzhalterIn(v.body) })),
      arten: ARTEN,
      platzhalter: VERTRAGS_PLATZHALTER,
    },
    error: null,
  })
})

router.post('/projects/:projectId/vertragsvorlagen', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ data: null, error: 'Die Vorlage braucht einen Namen' })
  const art = String(req.body?.kind || 'darsteller')
  if (!ARTEN.some((a) => a.art === art)) {
    return res.status(400).json({ data: null, error: 'Unbekannte Vertragsart' })
  }
  // `fuer_firma` legt die Vorlage auf Firmenebene ab - dann steht sie allen
  // Projekten der Firma zur Verfuegung. Das ist der Normalfall: Wer einmal
  // einen Vertrag hat pruefen lassen, will ihn nicht je Projekt neu anlegen.
  const projekt = (await db.get('SELECT company_id FROM projects WHERE id = ?', [projectId])) as any
  const fuerFirma = req.body?.fuer_firma === true && projekt?.company_id

  const zeile = await db.run(
    `INSERT INTO contract_templates (company_id, project_id, kind, name, body, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      fuerFirma ? projekt.company_id : null,
      fuerFirma ? null : projectId,
      art, name, String(req.body?.body || ''),
      (req as any).user?.id ?? null,
    ]
  )
  return res.json({ data: await db.get('SELECT * FROM contract_templates WHERE id = ?', [zeile.id]), error: null })
})

router.put('/projects/:projectId/vertragsvorlagen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const felder: string[] = []
  const werte: any[] = []
  if ('name' in req.body) { felder.push('name = ?'); werte.push(String(req.body.name || '')) }
  if ('body' in req.body) { felder.push('body = ?'); werte.push(String(req.body.body || '')) }
  if ('kind' in req.body) { felder.push('kind = ?'); werte.push(String(req.body.kind || 'darsteller')) }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  const zeile = await db.run(
    `UPDATE contract_templates SET ${felder.join(', ')}, updated_at = NOW() WHERE id = ?`,
    [...werte, Number(req.params.id)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Vorlage nicht gefunden' })
  return res.json({ data: await db.get('SELECT * FROM contract_templates WHERE id = ?', [Number(req.params.id)]), error: null })
})

router.delete('/projects/:projectId/vertragsvorlagen/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const zeile = await db.run('DELETE FROM contract_templates WHERE id = ?', [Number(req.params.id)])
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Vorlage nicht gefunden' })
  return res.json({ data: { geloescht: true }, error: null })
})

// ─── Werte einer Person ──────────────────────────────────────────────────────

/** Was über eine Person im Projekt bekannt ist - für die Platzhalter. */
async function werteFuer(projectId: number, art: string, personId: number) {
  const projekt = (await db.get(
    `SELECT p.*, c.name AS firma_name FROM projects p
       LEFT JOIN companies c ON p.company_id = c.id WHERE p.id = ?`,
    [projectId]
  )) as any

  let person: any = null
  if (art === 'cast') {
    person = (await db.get(
      `SELECT c.*, c.actor_name AS name, ch.name AS rolle
         FROM "cast" c LEFT JOIN characters ch ON c.character_id = ch.id
        WHERE c.id = ? AND c.project_id = ?`,
      [personId, projectId]
    )) as any
  } else if (art === 'crew') {
    person = (await db.get(
      "SELECT *, role AS rolle FROM crew WHERE id = ? AND project_id = ?", [personId, projectId]
    )) as any
  } else if (art === 'extra') {
    person = (await db.get(
      "SELECT *, tariff_group AS rolle FROM extras WHERE id = ? AND project_id = ?", [personId, projectId]
    )) as any
  }
  if (!person) return null

  // Drehtage und Zeitraum aus den Dispositionen dieser Person, nicht aus dem
  // Projekt: Wer an drei von zwanzig Tagen dabei ist, soll drei im Vertrag
  // stehen haben.
  const tage = (await db.all(
    `SELECT DISTINCT sd.date FROM call_sheet_entries cse
       JOIN call_sheets cs ON cse.call_sheet_id = cs.id
       JOIN shoot_days sd ON cs.shoot_day_id = sd.id
      WHERE cse.person_type = ? AND cse.person_id = ? AND sd.project_id = ?
      ORDER BY sd.date ASC`,
    [art, personId, projectId]
  )) as any[]

  const motive = (await db.all(
    'SELECT name FROM locations WHERE project_id = ? ORDER BY name ASC LIMIT 8', [projectId]
  )) as any[]

  const gageCents = Number(person.fee_per_day ?? 0)
  const anzahl = tage.length
  const zeitraum = anzahl === 0
    ? ''
    : anzahl === 1
      ? datumText(tage[0].date)
      : `${datumText(tage[0].date)} bis ${datumText(tage[anzahl - 1].date)}`

  return {
    person,
    werte: {
      name: String(person.name || ''),
      rolle: String(person.rolle || ''),
      projekt: String(projekt?.title || ''),
      produktion: String(projekt?.firma_name || projekt?.production_company || ''),
      drehzeitraum: zeitraum,
      drehtage: anzahl > 0 ? String(anzahl) : '',
      gage: gageCents > 0 ? euroText(gageCents) : '',
      gage_gesamt: gageCents > 0 && anzahl > 0 ? euroText(gageCents * anzahl) : '',
      drehorte: motive.map((m) => m.name).filter(Boolean).join(', '),
      geburtsdatum: person.birthdate ? datumText(person.birthdate) : '',
      erziehungsberechtigt: String(person.guardian_name || ''),
      datum: datumText(heuteISO()),
    } as Record<string, string>,
  }
}

/** Vorschau: der gefüllte Text und was darin noch fehlt. */
router.post('/projects/:projectId/vertraege/vorschau', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const daten = await werteFuer(projectId, String(req.body?.person_type || 'cast'), Number(req.body?.person_id))
  if (!daten) return res.status(404).json({ data: null, error: 'Person nicht gefunden' })

  const body = String(req.body?.body || '')
  return res.json({
    data: {
      text: fuelleVorlage(body, daten.werte),
      werte: daten.werte,
      fehlt: fehlendeWerte(body, daten.werte),
    },
    error: null,
  })
})

// ─── Verträge ────────────────────────────────────────────────────────────────

/**
 * Die Übersicht: wer hat was, und wem fehlt noch etwas.
 *
 * Nach Person sortiert, nicht nach Vertrag - die Frage am Set lautet "wer
 * fehlt noch", nicht "welche Verträge gibt es".
 */
router.get('/projects/:projectId/vertraege', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const [vertraege, besetzung, stab, komparsen] = await Promise.all([
    db.all('SELECT * FROM contracts WHERE project_id = ? ORDER BY created_at DESC', [projectId]) as Promise<any[]>,
    db.all('SELECT id, actor_name AS name, birthdate FROM "cast" WHERE project_id = ? ORDER BY actor_name', [projectId]) as Promise<any[]>,
    db.all('SELECT id, name, birthdate FROM crew WHERE project_id = ? ORDER BY name', [projectId]) as Promise<any[]>,
    db.all('SELECT id, name, birthdate FROM extras WHERE project_id = ? ORDER BY name', [projectId]) as Promise<any[]>,
  ])

  const jePerson = new Map<string, any[]>()
  for (const v of vertraege) {
    const schluessel = `${v.person_type}:${v.person_id}`
    const liste = jePerson.get(schluessel)
    if (liste) liste.push(v)
    else jePerson.set(schluessel, [v])
  }

  const heute = heuteISO()
  const zeilen = [
    ...besetzung.map((p) => ({ art: 'cast', ...p })),
    ...stab.map((p) => ({ art: 'crew', ...p })),
    ...komparsen.map((p) => ({ art: 'extra', ...p })),
  ].map((p) => {
    const eigene = jePerson.get(`${p.art}:${p.id}`) ?? []
    const alter = p.birthdate ? alterAm(String(p.birthdate).slice(0, 10), heute) : null
    return {
      person_type: p.art,
      person_id: p.id,
      name: p.name,
      birthdate: p.birthdate,
      alter,
      minderjaehrig: alter !== null && alter < 18,
      kind: alter !== null && alter < KIND_BIS_ALTER,
      vertraege: eigene.map((v) => ({
        id: v.id, kind: v.kind, title: v.title, status: v.status,
        sent_at: v.sent_at, confirmed_at: v.confirmed_at, confirmed_name: v.confirmed_name,
      })),
      bestaetigt: eigene.filter((v) => v.status === 'bestaetigt').length,
      offen: eigene.filter((v) => v.status === 'versendet').length,
    }
  })

  return res.json({
    data: {
      personen: zeilen,
      summe: {
        personen: zeilen.length,
        ohne_vertrag: zeilen.filter((z) => z.vertraege.length === 0).length,
        offen: zeilen.reduce((s, z) => s + z.offen, 0),
        bestaetigt: zeilen.reduce((s, z) => s + z.bestaetigt, 0),
        minderjaehrig: zeilen.filter((z) => z.minderjaehrig).length,
      },
    },
    error: null,
  })
})

router.post('/projects/:projectId/vertraege', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const art = String(req.body?.person_type || 'cast')
  const personId = Number(req.body?.person_id)
  const daten = await werteFuer(projectId, art, personId)
  if (!daten) return res.status(404).json({ data: null, error: 'Person nicht gefunden' })

  const vorlage = String(req.body?.body || '')
  if (!vorlage.trim()) return res.status(400).json({ data: null, error: 'Ohne Text kein Vertrag' })

  const zeile = await db.run(
    `INSERT INTO contracts
       (project_id, template_id, person_type, person_id, kind, title, body, status, fee_cents, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'entwurf', ?, ?)`,
    [
      projectId,
      req.body?.template_id ? Number(req.body.template_id) : null,
      art, personId,
      String(req.body?.kind || 'darsteller'),
      String(req.body?.title || '').slice(0, 200) || `Vertrag ${daten.werte.name}`,
      fuelleVorlage(vorlage, daten.werte),
      Number(daten.person.fee_per_day ?? 0),
      (req as any).user?.id ?? null,
    ]
  )
  return res.json({ data: await db.get('SELECT * FROM contracts WHERE id = ?', [zeile.id]), error: null })
})

router.get('/projects/:projectId/vertraege/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const vertrag = await db.get('SELECT * FROM contracts WHERE id = ? AND project_id = ?', [
    Number(req.params.id), Number(req.params.projectId),
  ])
  if (!vertrag) return res.status(404).json({ data: null, error: 'Vertrag nicht gefunden' })
  return res.json({ data: vertrag, error: null })
})

router.put('/projects/:projectId/vertraege/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const vertrag = (await db.get('SELECT status FROM contracts WHERE id = ? AND project_id = ?', [
    Number(req.params.id), Number(req.params.projectId),
  ])) as any
  if (!vertrag) return res.status(404).json({ data: null, error: 'Vertrag nicht gefunden' })
  // Ein verschickter Vertrag wird nicht mehr geaendert. Sonst stuende in der
  // Datenbank ein anderer Text als der, dem zugestimmt wurde.
  if (vertrag.status !== 'entwurf') {
    return res.status(400).json({
      data: null,
      error: 'Ein verschickter Vertrag wird nicht geändert. Für eine neue Fassung einen neuen anlegen.',
    })
  }
  const felder: string[] = []
  const werte: any[] = []
  if ('title' in req.body) { felder.push('title = ?'); werte.push(String(req.body.title || '')) }
  if ('body' in req.body) { felder.push('body = ?'); werte.push(String(req.body.body || '')) }
  if ('notes' in req.body) { felder.push('notes = ?'); werte.push(String(req.body.notes || '')) }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  await db.run(
    `UPDATE contracts SET ${felder.join(', ')}, updated_at = NOW() WHERE id = ?`,
    [...werte, Number(req.params.id)]
  )
  return res.json({ data: await db.get('SELECT * FROM contracts WHERE id = ?', [Number(req.params.id)]), error: null })
})

router.delete('/projects/:projectId/vertraege/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const zeile = await db.run(
    "DELETE FROM contracts WHERE id = ? AND project_id = ? AND status = 'entwurf'",
    [Number(req.params.id), Number(req.params.projectId)]
  )
  if (zeile.changes === 0) {
    return res.status(400).json({ data: null, error: 'Nur Entwürfe lassen sich löschen' })
  }
  return res.json({ data: { geloescht: true }, error: null })
})

/** Das Blatt - das, was unterschrieben wird. */
function renderVertrag(titel: string, text: string, projekt: string): string {
  const esc = (w: any) => String(w ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Der Text kommt in einer sehr einfachen Auszeichnung: # Ueberschrift,
  // ## Zwischenueberschrift, **fett**, Leerzeile trennt Absaetze. Mehr braucht
  // ein Vertrag nicht, und mehr liesse sich nicht sicher darstellen.
  const html = esc(text)
    .split(/\n{2,}/)
    .map((absatz) => {
      const z = absatz.trim()
      // Eine Ueberschrift ist die erste Zeile, nicht der ganze Block: In den
      // Vorlagen folgt der Absatz direkt darunter, ohne Leerzeile.
      if (z.startsWith('## ') || z.startsWith('# ')) {
        const umbruch = z.indexOf('\n')
        const kopf = (umbruch === -1 ? z : z.slice(0, umbruch)).trim()
        const rest = umbruch === -1 ? '' : z.slice(umbruch + 1).trim()
        const stufe = kopf.startsWith('## ') ? 2 : 1
        const titel = kopf.slice(stufe === 2 ? 3 : 2)
        return `<h${stufe}>${titel}</h${stufe}>` + (rest ? `<p>${rest.replace(/\n/g, '<br>')}</p>` : '')
      }
      if (/^\d+\.\s/.test(z) || z.startsWith('- ')) {
        const punkte = z.split('\n').map((p) => `<li>${p.replace(/^(\d+\.|-)\s*/, '')}</li>`).join('')
        return z.startsWith('- ') ? `<ul>${punkte}</ul>` : `<ol>${punkte}</ol>`
      }
      return `<p>${z.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${esc(titel)}</title>
<style>
${pdfFontFaces()}
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: ${PDF_SANS}; font-size: 10.5pt; color: #111; line-height: 1.55; }
  .blatt { width: 210mm; min-height: 297mm; padding: 20mm 22mm 24mm 25mm; position: relative; }
  h1 { font-size: 16pt; margin: 0 0 6mm; letter-spacing: -0.01em; }
  h2 { font-size: 11.5pt; margin: 6mm 0 2mm; }
  p { margin: 0 0 3mm; }
  ol, ul { margin: 0 0 3mm; padding-left: 6mm; }
  li { margin-bottom: 1.5mm; }
  .unterschrift { margin-top: 14mm; display: flex; gap: 14mm; }
  .unterschrift div { flex: 1; border-top: 0.4pt solid #333; padding-top: 1.5mm;
    font-size: 8.5pt; color: #555; }
  .fuss { position: absolute; bottom: 12mm; left: 25mm; right: 22mm; font-size: 7.5pt;
    color: #777; border-top: 0.3pt solid #ddd; padding-top: 2mm; }
</style></head>
<body><div class="blatt">
${html}
<div class="unterschrift">
  <div>Ort, Datum und Unterschrift Produktion</div>
  <div>Ort, Datum und Unterschrift</div>
</div>
<div class="fuss">${esc(titel)} · ${esc(projekt)}</div>
</div></body></html>`
}

router.get('/projects/:projectId/vertraege/:id/pdf', requireAuth, requireMember, async (req: Request, res: Response) => {
  const vertrag = (await db.get('SELECT * FROM contracts WHERE id = ? AND project_id = ?', [
    Number(req.params.id), Number(req.params.projectId),
  ])) as any
  if (!vertrag) return res.status(404).json({ data: null, error: 'Vertrag nicht gefunden' })
  const projekt = (await db.get('SELECT title FROM projects WHERE id = ?', [Number(req.params.projectId)])) as any
  const pdf = await generatePdf(renderVertrag(vertrag.title, vertrag.body, projekt?.title || ''))
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="vertrag-${vertrag.id}.pdf"`)
  return res.send(pdf)
})

/**
 * Den Vertrag verschicken.
 *
 * Ab hier ist der Text eingefroren. Die Mail geht über dieselbe Warteschlange
 * wie jede andere, mit dem Blatt im Anhang und einem Link zum Bestätigen.
 */
router.post('/projects/:projectId/vertraege/:id/senden', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const vertrag = (await db.get('SELECT * FROM contracts WHERE id = ? AND project_id = ?', [
    Number(req.params.id), projectId,
  ])) as any
  if (!vertrag) return res.status(404).json({ data: null, error: 'Vertrag nicht gefunden' })
  if (vertrag.status === 'bestaetigt') {
    return res.status(400).json({ data: null, error: 'Dieser Vertrag ist bereits bestätigt' })
  }

  const daten = await werteFuer(projectId, vertrag.person_type, vertrag.person_id)
  if (!daten) return res.status(404).json({ data: null, error: 'Person nicht gefunden' })

  // Bei einem Kind geht der Vertrag an die erziehungsberechtigte Person, nicht
  // an das Kind. Das ist keine Feinheit: Ein Siebenjähriger kann nicht
  // zustimmen.
  const alter = daten.person.birthdate
    ? alterAm(String(daten.person.birthdate).slice(0, 10), heuteISO())
    : null
  const anKind = alter !== null && alter < 18
  const empfaengerAdresse = anKind
    ? String(daten.person.guardian_email || '').trim()
    : String(daten.person.email || '').trim()
  const empfaengerName = anKind
    ? String(daten.person.guardian_name || '') || 'Erziehungsberechtigte'
    : String(daten.person.name || '')

  if (!empfaengerAdresse) {
    return res.status(400).json({
      data: null,
      error: anKind
        ? 'Für dieses Kind ist keine Mailadresse der Erziehungsberechtigten hinterlegt'
        : 'Für diese Person ist keine Mailadresse hinterlegt',
    })
  }

  const token = vertrag.token || crypto.randomBytes(24).toString('hex')
  const link = `${appBasisUrl()}/vertrag/${token}`
  const projekt = (await db.get('SELECT title FROM projects WHERE id = ?', [projectId])) as any
  const pdf = await generatePdf(renderVertrag(vertrag.title, vertrag.body, projekt?.title || ''))

  const eingereiht = await reiheEin({
    projectId,
    betreff: `${vertrag.title} - ${projekt?.title || 'Produktion'}`,
    html: `<p>Guten Tag ${empfaengerName},</p>
<p>anbei ${anKind ? `der Vertrag für ${daten.werte.name}` : 'Ihr Vertrag'} zur Produktion
"${projekt?.title || ''}". Das Blatt liegt dieser Mail bei.</p>
<p>Über den folgenden Link können Sie den Text lesen und Ihre Zustimmung erklären:<br>
<a href="${link}">${link}</a></p>
<p>Bei Fragen antworten Sie einfach auf diese Mail.</p>`,
    empfaenger: [{ email: empfaengerAdresse, name: empfaengerName }],
    anlass: 'vertrag',
    bezugId: vertrag.id,
    erstelltVon: (req as any).user?.id ?? null,
    anhang: { dateiname: `${vertrag.title.replace(/[^\wäöüÄÖÜß -]/g, '')}.pdf`, inhalt: pdf },
  })

  await db.run(
    "UPDATE contracts SET status = 'versendet', token = ?, sent_at = NOW(), updated_at = NOW() WHERE id = ?",
    [token, vertrag.id]
  )
  logAudit(projectId, (req as any).user as AuthUser, 'vertrag versendet', 'contracts', vertrag.id,
    null, { titel: vertrag.title, an: empfaengerAdresse })

  return res.json({
    data: { status: 'versendet', an: empfaengerAdresse, mail_id: eingereiht[0]?.id ?? null, link },
    error: null,
  })
})

// ─── Der öffentliche Teil ────────────────────────────────────────────────────

/**
 * Den Vertrag über den Link ansehen - ohne Anmeldung.
 *
 * Gibt nur heraus, was die Person ohnehin kennt: ihren eigenen Vertrag. Kein
 * Hinweis darauf, wer sonst noch mitwirkt.
 */
router.get('/vertrag/:token', async (req: Request, res: Response) => {
  const vertrag = (await db.get('SELECT * FROM contracts WHERE token = ?', [String(req.params.token)])) as any
  if (!vertrag) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })
  const projekt = (await db.get('SELECT title FROM projects WHERE id = ?', [vertrag.project_id])) as any
  return res.json({
    data: {
      titel: vertrag.title,
      text: vertrag.body,
      projekt: projekt?.title || '',
      status: vertrag.status,
      bestaetigt_am: vertrag.confirmed_at,
      bestaetigt_von: vertrag.confirmed_name,
      abgelehnt_am: vertrag.declined_at,
    },
    error: null,
  })
})

/** Das Blatt über den Link - ebenfalls ohne Anmeldung. */
router.get('/vertrag/:token/pdf', async (req: Request, res: Response) => {
  const vertrag = (await db.get('SELECT * FROM contracts WHERE token = ?', [String(req.params.token)])) as any
  if (!vertrag) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })
  const projekt = (await db.get('SELECT title FROM projects WHERE id = ?', [vertrag.project_id])) as any
  const pdf = await generatePdf(renderVertrag(vertrag.title, vertrag.body, projekt?.title || ''))
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="vertrag.pdf"`)
  return res.send(pdf)
})

/**
 * Zustimmen.
 *
 * Festgehalten wird, wer wann zugestimmt hat. Der Text liegt daneben und wird
 * nicht mehr angefasst - zusammen ergibt das den Nachweis.
 */
router.post('/vertrag/:token/bestaetigen', async (req: Request, res: Response) => {
  const vertrag = (await db.get('SELECT * FROM contracts WHERE token = ?', [String(req.params.token)])) as any
  if (!vertrag) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })
  if (vertrag.status === 'bestaetigt') {
    return res.json({ data: { status: 'bestaetigt', am: vertrag.confirmed_at }, error: null })
  }
  const name = String(req.body?.name || '').trim()
  if (!name) {
    return res.status(400).json({ data: null, error: 'Bitte den Namen eintragen, der zustimmt' })
  }
  await db.run(
    "UPDATE contracts SET status = 'bestaetigt', confirmed_at = NOW(), confirmed_name = ?, updated_at = NOW() WHERE id = ?",
    [name.slice(0, 200), vertrag.id]
  )
  logAudit(vertrag.project_id, undefined, 'vertrag bestätigt', 'contracts', vertrag.id,
    null, { titel: vertrag.title, von: name.slice(0, 200) })
  return res.json({ data: { status: 'bestaetigt' }, error: null })
})

router.post('/vertrag/:token/ablehnen', async (req: Request, res: Response) => {
  const vertrag = (await db.get('SELECT * FROM contracts WHERE token = ?', [String(req.params.token)])) as any
  if (!vertrag) return res.status(404).json({ data: null, error: 'Dieser Link gilt nicht mehr' })
  if (vertrag.status === 'bestaetigt') {
    return res.status(400).json({ data: null, error: 'Dieser Vertrag wurde bereits bestätigt' })
  }
  await db.run(
    "UPDATE contracts SET status = 'abgelehnt', declined_at = NOW(), decline_reason = ?, updated_at = NOW() WHERE id = ?",
    [String(req.body?.reason || '').slice(0, 500), vertrag.id]
  )
  logAudit(vertrag.project_id, undefined, 'vertrag abgelehnt', 'contracts', vertrag.id, null,
    { titel: vertrag.title, grund: String(req.body?.reason || '').slice(0, 200) })
  return res.json({ data: { status: 'abgelehnt' }, error: null })
})

// ─── Jugendarbeitsschutz ─────────────────────────────────────────────────────

/**
 * Die Prüfung über alle Drehtage: Wer ist minderjährig, und passt der Einsatz?
 *
 * Geprüft wird gegen die Zeiten der Tagesdisposition. Steht dort nichts, sagt
 * die Prüfung das - sie erfindet keine Zeiten.
 */
router.get('/projects/:projectId/jugendschutz', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const heute = heuteISO()

  const personen = (await db.all(
    `SELECT 'cast' AS art, id, actor_name AS name, birthdate, guardian_name, permit_granted,
            permit_reference, permit_valid_until
       FROM "cast" WHERE project_id = ? AND birthdate IS NOT NULL
     UNION ALL
     SELECT 'extra' AS art, id, name, birthdate, guardian_name, permit_granted,
            '' AS permit_reference, NULL AS permit_valid_until
       FROM extras WHERE project_id = ? AND birthdate IS NOT NULL
     UNION ALL
     SELECT 'crew' AS art, id, name, birthdate, '' AS guardian_name, false AS permit_granted,
            '' AS permit_reference, NULL AS permit_valid_until
       FROM crew WHERE project_id = ? AND birthdate IS NOT NULL`,
    [projectId, projectId, projectId]
  )) as any[]

  const minderjaehrige = personen.filter(
    (p) => alterAm(String(p.birthdate).slice(0, 10), heute) < 18
  )

  // Das Standard-Drehende des Projekts. Es gilt, solange in der Disposition
  // kein eigenes Ende steht - fuer ein Kind sollte dort eines stehen.
  const einstellungen = (await db.get(
    'SELECT default_wrap_time FROM project_settings WHERE project_id = ?', [projectId]
  )) as any
  const standardEnde = Number(einstellungen?.default_wrap_time ?? 1200)

  // Die Dispositionen aller Minderjährigen - eine Abfrage, nicht eine je Person.
  const einsaetze = minderjaehrige.length === 0 ? [] : (await db.all(
    `SELECT cse.person_type, cse.person_id, sd.date, cse.call_time, cse.wrap_time,
            cs.general_call
       FROM call_sheet_entries cse
       JOIN call_sheets cs ON cse.call_sheet_id = cs.id
       JOIN shoot_days sd ON cs.shoot_day_id = sd.id
      WHERE sd.project_id = ?
      ORDER BY sd.date ASC`,
    [projectId]
  )) as any[]

  const ergebnisse = minderjaehrige.map((p) => {
    const eigene = einsaetze.filter(
      (e) => e.person_type === p.art && Number(e.person_id) === Number(p.id)
    )
    const tage = eigene.map((e) => {
      const datum = String(e.date).slice(0, 10)
      const beginn = Number(e.call_time ?? e.general_call ?? 480)
      // Steht kein eigenes Ende in der Disposition, wird gegen den Drehschluss
      // des Projekts gerechnet. Das meldet dann fast sicher einen Verstoss -
      // und zwar zu Recht: Niemand hat aufgeschrieben, wann das Kind geht.
      const eigenesEnde = e.wrap_time !== null && e.wrap_time !== undefined
      const ende = eigenesEnde ? Number(e.wrap_time) : standardEnde
      const pruefung = pruefeEinsatz({
        name: p.name,
        geburtstag: String(p.birthdate).slice(0, 10),
        datum,
        von: alsUhrzeit(beginn),
        bis: alsUhrzeit(ende),
        bewilligung: p.permit_granted === true,
        einverstaendnis: !!String(p.guardian_name || '').trim(),
      })
      if (!eigenesEnde && pruefung.istKind) {
        pruefung.befunde.push({
          art: 'hinweis',
          text: 'In der Disposition steht kein eigenes Drehende für diese Person. '
            + `Gerechnet wurde mit dem Drehschluss des Projekts (${alsUhrzeit(standardEnde)} Uhr).`,
        })
      }
      return { datum, eigenes_ende: eigenesEnde, ...pruefung }
    })
    const alter = alterAm(String(p.birthdate).slice(0, 10), heute)
    return {
      person_type: p.art,
      person_id: p.id,
      name: p.name,
      alter,
      grenze: grenzeFuer(alter),
      permit_granted: p.permit_granted === true,
      permit_reference: p.permit_reference || '',
      permit_valid_until: p.permit_valid_until,
      guardian_name: p.guardian_name || '',
      tage,
      verstoesse: tage.reduce((s, t) => s + t.befunde.filter((b: any) => b.art === 'verstoss').length, 0),
    }
  })

  return res.json({
    data: {
      personen: ergebnisse,
      ohne_geburtsdatum: (await db.get(
        `SELECT (SELECT COUNT(*) FROM "cast" WHERE project_id = ? AND birthdate IS NULL)
              + (SELECT COUNT(*) FROM extras WHERE project_id = ? AND birthdate IS NULL) AS anzahl`,
        [projectId, projectId]
      ) as any)?.anzahl ?? 0,
      verstoesse: ergebnisse.reduce((s, e) => s + e.verstoesse, 0),
      unterlagen: ANTRAGSUNTERLAGEN,
    },
    error: null,
  })
})

/** Die Bewilligung eintragen. */
router.put('/projects/:projectId/jugendschutz/:art/:personId', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const art = String(req.params.art)
  const tabelle = art === 'cast' ? '"cast"' : art === 'extra' ? 'extras' : null
  if (!tabelle) return res.status(400).json({ data: null, error: 'Unbekannte Personenart' })

  const felder: string[] = []
  const werte: any[] = []
  if ('birthdate' in req.body) {
    felder.push('birthdate = ?')
    werte.push(req.body.birthdate ? String(req.body.birthdate).slice(0, 10) : null)
  }
  if ('guardian_name' in req.body) { felder.push('guardian_name = ?'); werte.push(String(req.body.guardian_name || '')) }
  if ('guardian_email' in req.body) { felder.push('guardian_email = ?'); werte.push(String(req.body.guardian_email || '')) }
  if ('permit_granted' in req.body) { felder.push('permit_granted = ?'); werte.push(req.body.permit_granted === true) }
  if (art === 'cast') {
    if ('guardian_phone' in req.body) { felder.push('guardian_phone = ?'); werte.push(String(req.body.guardian_phone || '')) }
    if ('permit_reference' in req.body) { felder.push('permit_reference = ?'); werte.push(String(req.body.permit_reference || '')) }
    if ('permit_valid_until' in req.body) {
      felder.push('permit_valid_until = ?')
      werte.push(req.body.permit_valid_until ? String(req.body.permit_valid_until).slice(0, 10) : null)
    }
  }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  const zeile = await db.run(
    `UPDATE ${tabelle} SET ${felder.join(', ')} WHERE id = ? AND project_id = ?`,
    [...werte, Number(req.params.personId), projectId]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Person nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

export default router
