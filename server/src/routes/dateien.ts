/**
 * Die Dateiablage.
 *
 * Das Papier, das eine Produktion bekommt und aufheben muss: Drehgenehmigungen,
 * Versicherungsnachweise, unterschriebene Verträge als Scan,
 * Eingangsrechnungen. Dazu die Bilder, die bisher auf der Platte lagen.
 *
 * Alles liegt in der Datenbank - die Begründung steht in `lib/dateien.ts`.
 */
import { Router, Request, Response } from 'express'
import multer from 'multer'
import { db } from '../db'
import { requireAuth, AuthUser } from '../middleware/auth'
import { requireMember } from '../middleware/projectAuth'
import { logAudit } from './audit'
import {
  ARTEN, MAX_BYTES, istArt, mitFrist, sichererName, typPasst, fristStand, groesse,
} from '../lib/dateien'

const router = Router()

/**
 * Hochgeladen wird in den Arbeitsspeicher, nicht auf die Platte.
 *
 * `memoryStorage` statt `diskStorage`: Die Datei geht direkt in die Datenbank.
 * Bei 20 MB Obergrenze ist das vertretbar; eine Datei auf der Platte wäre
 * nach dem nächsten Deploy weg.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const erlaubt = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf'
    cb(null, erlaubt)
  },
})

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Die Felder einer Datei ohne den Inhalt - den will keine Liste. */
const OHNE_INHALT = `id, project_id, company_id, kind, filename, mime, bytes,
  entity_type, entity_id, title, notes, valid_until, uploaded_by, created_at`

// ─── Liste ───────────────────────────────────────────────────────────────────

router.get('/projects/:projectId/dateien', requireAuth, requireMember, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const heute = heuteISO()

  const bedingungen = ['project_id = ?']
  const werte: any[] = [projectId]
  if (req.query.art && istArt(String(req.query.art))) {
    bedingungen.push('kind = ?')
    werte.push(String(req.query.art))
  }
  if (req.query.bezug) {
    bedingungen.push('entity_type = ?')
    werte.push(String(req.query.bezug))
    if (req.query.bezug_id) { bedingungen.push('entity_id = ?'); werte.push(Number(req.query.bezug_id)) }
  }

  const zeilen = (await db.all(
    `SELECT ${OHNE_INHALT} FROM project_files
      WHERE ${bedingungen.join(' AND ')}
      ORDER BY created_at DESC`,
    werte
  )) as any[]

  return res.json({
    data: {
      dateien: zeilen.map((z) => ({
        ...z,
        groesse: groesse(Number(z.bytes || 0)),
        frist: fristStand(z.valid_until, heute),
      })),
      arten: ARTEN,
      max_bytes: MAX_BYTES,
      // Zusammen belegte Größe: Eine Datenbank ist kein Objektspeicher, und
      // wer das vergisst, merkt es erst, wenn der Plan voll ist.
      belegt_bytes: zeilen.reduce((s, z) => s + Number(z.bytes || 0), 0),
    },
    error: null,
  })
})

// ─── Hochladen ───────────────────────────────────────────────────────────────

router.post('/projects/:projectId/dateien', requireAuth, requireMember, upload.single('datei'), async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  if (!req.file) {
    return res.status(400).json({
      data: null,
      error: `Keine Datei empfangen. Erlaubt sind Bilder und PDF bis ${groesse(MAX_BYTES)}.`,
    })
  }

  const art = String(req.body?.kind || 'sonstiges')
  if (!istArt(art)) return res.status(400).json({ data: null, error: 'Unbekannte Art' })
  if (!typPasst(art, req.file.mimetype)) {
    return res.status(400).json({ data: null, error: 'Dieser Dateityp passt nicht zu dieser Art' })
  }

  const zeile = await db.run(
    `INSERT INTO project_files
       (project_id, kind, filename, mime, bytes, content, entity_type, entity_id,
        title, notes, valid_until, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId, art,
      sichererName(req.file.originalname),
      req.file.mimetype,
      req.file.size,
      req.file.buffer,
      String(req.body?.entity_type || ''),
      req.body?.entity_id ? Number(req.body.entity_id) : null,
      String(req.body?.title || '').slice(0, 200),
      String(req.body?.notes || '').slice(0, 1000),
      // Ein Ablaufdatum nur, wo es eins gibt - eine Eingangsrechnung läuft
      // nicht ab.
      mitFrist(art) && req.body?.valid_until ? String(req.body.valid_until).slice(0, 10) : null,
      (req as any).user?.id ?? null,
    ]
  )

  logAudit(projectId, (req as any).user as AuthUser, 'datei hochgeladen', 'project_files', zeile.id,
    null, { name: sichererName(req.file.originalname), art, groesse: groesse(req.file.size) })

  const neu = await db.get(`SELECT ${OHNE_INHALT} FROM project_files WHERE id = ?`, [zeile.id])
  return res.json({ data: neu, error: null })
})

/** Angaben an einer Datei ändern - der Inhalt bleibt, wie er ist. */
router.put('/projects/:projectId/dateien/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const felder: string[] = []
  const werte: any[] = []
  if ('title' in req.body) { felder.push('title = ?'); werte.push(String(req.body.title || '').slice(0, 200)) }
  if ('notes' in req.body) { felder.push('notes = ?'); werte.push(String(req.body.notes || '').slice(0, 1000)) }
  if ('kind' in req.body) {
    const art = String(req.body.kind)
    if (!istArt(art)) return res.status(400).json({ data: null, error: 'Unbekannte Art' })
    felder.push('kind = ?'); werte.push(art)
  }
  if ('valid_until' in req.body) {
    felder.push('valid_until = ?')
    werte.push(req.body.valid_until ? String(req.body.valid_until).slice(0, 10) : null)
  }
  if (felder.length === 0) return res.status(400).json({ data: null, error: 'Keine Angabe zum Ändern' })

  const zeile = await db.run(
    `UPDATE project_files SET ${felder.join(', ')} WHERE id = ? AND project_id = ?`,
    [...werte, Number(req.params.id), Number(req.params.projectId)]
  )
  if (zeile.changes === 0) return res.status(404).json({ data: null, error: 'Datei nicht gefunden' })
  return res.json({ data: { gespeichert: true }, error: null })
})

router.delete('/projects/:projectId/dateien/:id', requireAuth, requireMember, async (req: Request, res: Response) => {
  const datei = (await db.get(
    'SELECT filename, kind FROM project_files WHERE id = ? AND project_id = ?',
    [Number(req.params.id), Number(req.params.projectId)]
  )) as any
  if (!datei) return res.status(404).json({ data: null, error: 'Datei nicht gefunden' })

  await db.run('DELETE FROM project_files WHERE id = ?', [Number(req.params.id)])
  logAudit(Number(req.params.projectId), (req as any).user as AuthUser, 'datei gelöscht',
    'project_files', Number(req.params.id), { name: datei.filename, art: datei.kind }, null)
  return res.json({ data: { geloescht: true }, error: null })
})

// ─── Ausliefern ──────────────────────────────────────────────────────────────

/**
 * Die Datei selbst.
 *
 * Der Zugriff hängt an der Projektmitgliedschaft, nicht an einem geratenen
 * Pfad - ein Versicherungsnachweis oder ein unterschriebener Vertrag soll
 * nicht öffentlich im Netz liegen, nur weil die Kennung durchprobiert wurde.
 */
router.get('/projects/:projectId/dateien/:id/inhalt', requireAuth, requireMember, async (req: Request, res: Response) => {
  const datei = (await db.get(
    'SELECT filename, mime, content FROM project_files WHERE id = ? AND project_id = ?',
    [Number(req.params.id), Number(req.params.projectId)]
  )) as any
  if (!datei) return res.status(404).json({ data: null, error: 'Datei nicht gefunden' })

  res.setHeader('Content-Type', datei.mime || 'application/octet-stream')
  // Im Browser ansehen statt herunterladen - wer speichern will, kann das
  // immer noch. Umgekehrt wäre jedes Ansehen ein Download im Ordner.
  const anhang = req.query.download === '1' ? 'attachment' : 'inline'
  res.setHeader(
    'Content-Disposition',
    `${anhang}; filename*=UTF-8''${encodeURIComponent(datei.filename || 'datei')}`
  )
  // Privat zwischenspeichern: Die Datei ändert sich nicht, aber sie gehört
  // nicht in einen gemeinsamen Zwischenspeicher.
  res.setHeader('Cache-Control', 'private, max-age=3600')
  return res.send(datei.content)
})

// ─── Fristen ─────────────────────────────────────────────────────────────────

/**
 * Nachweise, die ablaufen - über alle Projekte einer Firma.
 *
 * Wird von der Sammelansicht gelesen. Eine Drehgenehmigung, die am Drehtag
 * abgelaufen ist, hält den Dreh an.
 */
router.get('/companies/:companyId/dateien/fristen', requireAuth, async (req: Request, res: Response) => {
  const companyId = Number(req.params.companyId)
  const heute = heuteISO()
  const zeilen = (await db.all(
    `SELECT f.id, f.kind, f.filename, f.title, f.valid_until, f.project_id, p.title AS projekt
       FROM project_files f JOIN projects p ON f.project_id = p.id
      WHERE p.company_id = ? AND f.valid_until IS NOT NULL
      ORDER BY f.valid_until ASC`,
    [companyId]
  )) as any[]

  const mitStand = zeilen
    .map((z) => ({ ...z, frist: fristStand(z.valid_until, heute) }))
    .filter((z) => z.frist === 'abgelaufen' || z.frist === 'laeuft_ab')

  return res.json({
    data: {
      dateien: mitStand,
      abgelaufen: mitStand.filter((z) => z.frist === 'abgelaufen').length,
      laeuft_ab: mitStand.filter((z) => z.frist === 'laeuft_ab').length,
    },
    error: null,
  })
})

export default router
