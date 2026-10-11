/**
 * Listen hinein und hinaus: CSV für Stab, Besetzung, Komparserie, Szenen.
 *
 * Eine Agentur pflegt ihre Crew in Excel. Bisher hiess das: alles abtippen.
 *
 * Zwei Regeln bestimmen den Ablauf:
 *
 * 1. **Nichts geht ungesehen in die Datenbank.** Jeder Import hat eine
 *    Vorschau, die zeigt, was angelegt, was aktualisiert und was übersprungen
 *    würde - mit Zeilennummer und Grund.
 * 2. **Gleiche E-Mail heisst gleiche Person.** Ohne E-Mail entscheidet der
 *    Name. Wer schon da ist, wird ergänzt, nicht verdoppelt.
 */
import { Router, Request, Response } from 'express'
import { db } from '../db'
import { requireAuth } from '../middleware/auth'
import { getUserProjectRole, ROLE_RANK } from '../middleware/projectAuth'
import { leseTabelle, feldWert, leseBetragCents, schreibeCsv, cents } from '../lib/tabelle'

const router = Router()

/** Was eine Zeile beim Import bedeutet. */
type Befund = {
  zeile: number
  name: string
  was: 'neu' | 'ergaenzt' | 'uebersprungen'
  grund?: string
  werte?: Record<string, any>
}

type Art = 'crew' | 'cast' | 'extras'

/**
 * Welche Spaltennamen für welches Feld gelten.
 *
 * Grosszügig, weil die Dateien aus allen möglichen Quellen kommen: aus einer
 * alten Liste, aus einem Agenturexport, aus einem Formular.
 */
const SPALTEN: Record<Art, Record<string, string[]>> = {
  crew: {
    name:       ['name', 'nachname', 'vollständiger name', 'vollstaendiger name', 'person'],
    role:       ['funktion', 'rolle', 'position', 'tätigkeit', 'taetigkeit', 'role'],
    department: ['abteilung', 'gewerk', 'department', 'bereich'],
    email:      ['e-mail', 'email', 'mail', 'e-mail-adresse'],
    phone:      ['telefon', 'handy', 'mobil', 'phone', 'telefonnummer'],
  },
  cast: {
    actor_name: ['name', 'darsteller', 'schauspieler', 'schauspielerin', 'actor'],
    email:      ['e-mail', 'email', 'mail'],
    phone:      ['telefon', 'handy', 'mobil', 'phone'],
    agency:     ['agentur', 'agency'],
  },
  extras: {
    name:         ['name', 'komparse', 'komparsin', 'person'],
    email:        ['e-mail', 'email', 'mail'],
    phone:        ['telefon', 'handy', 'mobil', 'phone'],
    tariff_group: ['tarifgruppe', 'tarif', 'gruppe'],
  },
}

/** Das Feld, unter dem der Name steht. */
const NAMENSFELD: Record<Art, string> = { crew: 'name', cast: 'actor_name', extras: 'name' }

/** Tabellenname in der Datenbank - `cast` ist in Postgres reserviert. */
const TABELLE: Record<Art, string> = { crew: 'crew', cast: '"cast"', extras: 'extras' }

async function darfSchreiben(req: Request, projectId: number): Promise<boolean> {
  const user = (req as any).user
  if (!user) return false
  if (user.role === 'admin') return true
  const rolle = await getUserProjectRole(user.id, projectId)
  return (ROLE_RANK[rolle || ''] ?? 0) >= ROLE_RANK.dept_head
}

/**
 * Liest die Tabelle und sagt für jede Zeile, was geschehen würde.
 * Ohne `anwenden` wird nichts geschrieben.
 */
/** Was zum Lesen und Schreiben gebraucht wird - die Datenbank oder eine Transaktion. */
type Zugriff = { get: typeof db.get; run: typeof db.run }

async function verarbeite(
  projectId: number,
  art: Art,
  text: string,
  anwenden: boolean,
  zugriff: Zugriff = db
): Promise<{ befunde: Befund[]; neu: number; ergaenzt: number; uebersprungen: number }> {
  const zeilen = leseTabelle(text)
  const befunde: Befund[] = []

  // Die Gage heisst je nach Tabelle anders
  const gagenfeld = art === 'crew' ? 'fee_per_day' : art === 'cast' ? 'fee_per_day' : null

  for (let i = 0; i < zeilen.length; i++) {
    const zeile = zeilen[i]
    const nummer = i + 2 // Kopfzeile ist Zeile 1
    const werte: Record<string, any> = {}

    for (const [feld, namen] of Object.entries(SPALTEN[art])) {
      const wert = feldWert(zeile, namen)
      if (wert) werte[feld] = wert
    }
    if (gagenfeld) {
      const gage = leseBetragCents(feldWert(zeile, ['tagessatz', 'gage', 'honorar', 'tagesgage']))
      if (gage !== null) werte[gagenfeld] = gage
    }

    const name = String(werte[NAMENSFELD[art]] ?? '').trim()
    if (!name) {
      befunde.push({ zeile: nummer, name: '', was: 'uebersprungen', grund: 'Keine Spalte mit einem Namen gefunden' })
      continue
    }

    const email = String(werte.email ?? '').trim().toLowerCase()
    const vorhanden = email
      ? ((await zugriff.get(
          `SELECT id FROM ${TABELLE[art]} WHERE project_id = ? AND LOWER(email) = ?`,
          [projectId, email]
        )) as any)
      : ((await zugriff.get(
          `SELECT id FROM ${TABELLE[art]} WHERE project_id = ? AND LOWER(${NAMENSFELD[art]}) = ?`,
          [projectId, name.toLowerCase()]
        )) as any)

    if (vorhanden) {
      // Ergänzen, nicht überschreiben: Was in der Datei leer ist, bleibt in
      // der Datenbank stehen. Eine unvollständige Liste soll nichts löschen.
      // Nur was in der Datei steht. `werte` enthaelt keine leeren Felder -
      // eine unvollstaendige Liste loescht dadurch nichts.
      const felder = Object.keys(werte).filter((f) => f !== NAMENSFELD[art])
      if (anwenden && felder.length > 0) {
        await zugriff.run(
          `UPDATE ${TABELLE[art]} SET ${felder.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
          [...felder.map((f) => werte[f]), vorhanden.id]
        )
      }
      befunde.push({ zeile: nummer, name, was: 'ergaenzt', werte })
      continue
    }

    if (anwenden) {
      const felder = Object.keys(werte)
      await zugriff.run(
        `INSERT INTO ${TABELLE[art]} (project_id, ${felder.join(', ')})
         VALUES (?, ${felder.map(() => '?').join(', ')})`,
        [projectId, ...felder.map((f) => werte[f])]
      )
    }
    befunde.push({ zeile: nummer, name, was: 'neu', werte })
  }

  return {
    befunde,
    neu: befunde.filter((b) => b.was === 'neu').length,
    ergaenzt: befunde.filter((b) => b.was === 'ergaenzt').length,
    uebersprungen: befunde.filter((b) => b.was === 'uebersprungen').length,
  }
}

// POST /api/projects/:projectId/import/:art - Vorschau oder Übernahme
router.post('/projects/:projectId/import/:art', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const art = String(req.params.art) as Art
  if (!['crew', 'cast', 'extras'].includes(art)) {
    return res.status(400).json({ data: null, error: 'Unbekannte Liste' })
  }
  if (!(await darfSchreiben(req, projectId))) {
    return res.status(403).json({ data: null, error: 'Dafür fehlt dir die Berechtigung in diesem Projekt' })
  }

  const text = String(req.body?.csv ?? '')
  if (!text.trim()) {
    return res.status(400).json({ data: null, error: 'Die Datei ist leer' })
  }
  if (text.length > 2_000_000) {
    return res.status(400).json({ data: null, error: 'Die Datei ist zu gross - bitte in Teilen einlesen' })
  }

  const anwenden = req.body?.anwenden === true
  try {
    // In einer Transaktion: Scheitert eine Zeile, bleibt keine halbe Liste
    // stehen. Wer die Datei korrigiert, faengt sauber an.
    const ergebnis = anwenden
      ? await db.transaction((tx) => verarbeite(projectId, art, text, true, tx))
      : await verarbeite(projectId, art, text, false)

    return res.json({
      data: { ...ergebnis, angewendet: anwenden },
      error: null,
    })
  } catch (fehler: any) {
    console.error('[import]', fehler?.message || fehler)
    return res.status(400).json({
      data: null,
      error: `Die Liste wurde nicht uebernommen: ${String(fehler?.message || fehler).slice(0, 200)}`,
    })
  }
})

/** Vorlagendatei: die Spalten, die gelesen werden, mit einer Beispielzeile. */
router.get('/import/:art/vorlage.csv', (req: Request, res: Response) => {
  const art = String(req.params.art) as Art
  const vorlagen: Record<string, { kopf: string[]; beispiel: string[] }> = {
    crew: {
      kopf: ['Name', 'Funktion', 'Abteilung', 'E-Mail', 'Telefon', 'Tagessatz'],
      beispiel: ['Sarah Müller', 'Regisseurin', 'Regie', 'sarah@beispiel.de', '0170 1234567', '450,00'],
    },
    cast: {
      kopf: ['Name', 'E-Mail', 'Telefon', 'Agentur', 'Tagessatz'],
      beispiel: ['Felix Wagner', 'felix@beispiel.de', '0171 2345678', 'Agentur Nord', '600,00'],
    },
    extras: {
      kopf: ['Name', 'E-Mail', 'Telefon', 'Tarifgruppe'],
      beispiel: ['Thomas Meier', 'thomas@beispiel.de', '0160 1112233', 'Standard'],
    },
  }
  const vorlage = vorlagen[art]
  if (!vorlage) return res.status(404).json({ data: null, error: 'Unbekannte Liste' })

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="vorlage-${art}.csv"`)
  return res.send(schreibeCsv(vorlage.kopf, [vorlage.beispiel]))
})

// ─── Ausgabe ──────────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/export/:art.csv
router.get('/projects/:projectId/export/:art.csv', requireAuth, async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId)
  const art = String(req.params.art)

  let kopf: string[] = []
  let zeilen: Array<Array<string | number | null>> = []
  let name = art

  if (art === 'crew') {
    kopf = ['Name', 'Funktion', 'Abteilung', 'E-Mail', 'Telefon', 'Tagessatz']
    const daten = (await db.all(
      'SELECT name, role, department, email, phone, fee_per_day FROM crew WHERE project_id = ? ORDER BY department, name',
      [projectId]
    )) as any[]
    zeilen = daten.map((z) => [z.name, z.role, z.department, z.email, z.phone, cents(z.fee_per_day)])
    name = 'stab'
  } else if (art === 'cast') {
    kopf = ['Name', 'Rolle', 'E-Mail', 'Telefon', 'Tagessatz']
    const daten = (await db.all(
      `SELECT c.actor_name, ch.name AS rolle, c.email, c.phone, c.fee_per_day
         FROM "cast" c LEFT JOIN characters ch ON ch.id = c.character_id
        WHERE c.project_id = ? ORDER BY c.actor_name`,
      [projectId]
    )) as any[]
    zeilen = daten.map((z) => [z.actor_name, z.rolle, z.email, z.phone, cents(z.fee_per_day)])
    name = 'besetzung'
  } else if (art === 'scenes') {
    kopf = ['Nummer', 'Titel', 'INT/EXT', 'Tageszeit', 'Motiv', 'Achtel', 'Minuten']
    const daten = (await db.all(
      `SELECT s.scene_number, s.title, s.int_ext, s.day_night, l.name AS motiv, s.eighths, s.estimated_minutes
         FROM scenes s LEFT JOIN locations l ON l.id = s.location_id
        WHERE s.project_id = ? ORDER BY s.sort_order, s.id`,
      [projectId]
    )) as any[]
    zeilen = daten.map((z) => [
      z.scene_number, z.title, z.int_ext, z.day_night, z.motiv, z.eighths, z.estimated_minutes,
    ])
    name = 'szenen'
  } else if (art === 'shoot-days') {
    kopf = ['Drehtag', 'Datum', 'Status', 'Szenen', 'Notiz']
    const daten = (await db.all(
      `SELECT d.day_number, d.date, d.status, d.notes,
              (SELECT COUNT(*) FROM shoot_day_scenes s WHERE s.shoot_day_id = d.id) AS szenen
         FROM shoot_days d WHERE d.project_id = ? ORDER BY d.day_number`,
      [projectId]
    )) as any[]
    zeilen = daten.map((z) => [z.day_number, z.date, z.status, z.szenen, z.notes])
    name = 'drehplan'
  } else {
    return res.status(404).json({ data: null, error: 'Diese Liste lässt sich nicht ausgeben' })
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`)
  return res.send(schreibeCsv(kopf, zeilen))
})

export default router
