import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Wächter für Beschriftungen in der Oberfläche.
 *
 * Ein Eingabefeld ohne Beschriftung ist für eine Vorleseanwendung ein Feld
 * ohne Namen, und ein Klick auf den Text daneben setzt den Schreibzeiger
 * nicht hinein. Am 11.10.2026 gemessen: 237 Felder, 20 mit Kennung.
 *
 * Behoben wurde das zweigleisig: Die Beschriftung sucht sich ihr Feld selbst
 * (`components/ui/label.tsx`), und Felder in Tabellen - wo keine Beschriftung
 * daneben passt - haben einen eigenen Namen bekommen.
 *
 * Dieser Test hält den Stand fest. Er verlangt keine Perfektion, sondern
 * verhindert, dass die Zahl wieder wächst: Wer ein Feld ohne Namen ergänzt,
 * bekommt den Test rot und die Datei genannt.
 *
 * Der Test liegt beim Server, weil dort die Testumgebung steht. Er liest nur
 * Dateien - eine eigene Umgebung für den Client wäre für diesen Zweck zu viel.
 */

const SEITEN = path.join(__dirname, '../../../client/src/pages')

/** Felder, die eine Beschriftung brauchen. */
const FELD = /<(Input|Textarea|TimeInput)\b/g

/**
 * Hat das Feld einen Namen?
 *
 * Gesucht wird im Umkreis: im Feld selbst (`aria-label`, `label=`, `id`) oder
 * in den vier Zeilen davor (`<Label`). Vier Zeilen, weil das übliche Muster
 * `<div><Label>…</Label><Input …/></div>` je nach Formatierung zwei bis vier
 * Zeilen braucht.
 */
function hatNamen(zeilen: string[], index: number): boolean {
  // Ein fester Umkreis statt einer Abbruchbedingung: Beim ersten ">" am
  // Zeilenende aufzuhoeren war zu frueh - das aria-label steht oft erst in
  // einer der folgenden Zeilen. Der Test meldete dadurch zwoelf Felder ohne
  // Namen in einer Datei, in der die Browser-Messung keines fand.
  const block = zeilen.slice(index, Math.min(index + 12, zeilen.length)).join('\n')
  if (/aria-label|aria-labelledby|\blabel=\{|\blabel="|\bid=/.test(block)) return true

  const davor = zeilen.slice(Math.max(0, index - 4), index).join('\n')
  // Beide Schreibweisen zaehlen: der Baustein <Label> und natives <label>.
  // Beide werden zur Laufzeit mit ihrem Feld verknuepft - durch
  // `ui/label.tsx` und durch `lib/beschriftungen.ts`. Im JSX steht davon
  // nichts, darum muss der Waechter beide kennen.
  return /<[Ll]abel\b/.test(davor)
}

function zaehleOhneNamen(): { gesamt: number; ohne: number; dateien: Record<string, number> } {
  const dateien: Record<string, number> = {}
  let gesamt = 0
  let ohne = 0

  for (const name of fs.readdirSync(SEITEN).filter((d) => d.endsWith('.tsx'))) {
    const inhalt = fs.readFileSync(path.join(SEITEN, name), 'utf-8')
    const zeilen = inhalt.split('\n')
    let inDatei = 0

    zeilen.forEach((zeile, i) => {
      FELD.lastIndex = 0
      if (!FELD.test(zeile)) return
      gesamt++
      if (!hatNamen(zeilen, i)) {
        ohne++
        inDatei++
      }
    })

    if (inDatei > 0) dateien[name] = inDatei
  }
  return { gesamt, ohne, dateien }
}

describe('Beschriftungen in der Oberfläche', () => {
  const stand = zaehleOhneNamen()

  it('kennt genug Felder, um aussagekräftig zu sein', () => {
    expect(stand.gesamt).toBeGreaterThan(150)
  })

  /**
   * Was diese Zahl misst - und was nicht.
   *
   * Sie zählt Felder, bei denen **im Quelltext** keine Beschriftung zu sehen
   * ist. Zur Laufzeit haben die meisten davon trotzdem einen Namen: Entweder
   * verknüpft `ui/label.tsx` die Beschriftung daneben, oder
   * `lib/beschriftungen.ts` macht aus dem Platzhalter einen Namen. Im
   * Browser gemessen (22 Seiten, 12.10.2026): **270 Felder, 0 ohne Namen**.
   *
   * Die Zahl hier ist also kein Mangel, sondern ein Pegelstand: Sie darf
   * nicht steigen. Wer sie senkt, trägt die neue ein - der Test nennt sie.
   */
  it('hat nicht mehr Felder ohne Beschriftung im Quelltext als zuletzt', () => {
    const GRENZE = 58
    const liste = Object.entries(stand.dateien)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([datei, anzahl]) => `${datei}: ${anzahl}`)
      .join(', ')
    expect(
      stand.ohne,
      `Felder ohne Namen: ${stand.ohne} von ${stand.gesamt}. Am meisten in ${liste}`
    ).toBeLessThanOrEqual(GRENZE)
  })

  it('lässt die Seiten in Ruhe, die schon sauber sind', () => {
    // Diese Seiten wurden durchgegangen - sie sollen es bleiben.
    for (const seite of ['Tagesdispo.tsx', 'Stammdaten.tsx', 'Shotlist.tsx', 'Aufgaben.tsx']) {
      expect(stand.dateien[seite] ?? 0, `${seite} hat wieder Felder ohne Namen`).toBe(0)
    }
  })
})

describe('Dialoge', () => {
  const ORDNER = [
    path.join(__dirname, '../../../client/src/pages'),
    path.join(__dirname, '../../../client/src/components'),
    path.join(__dirname, '../../../client/src/components/shared'),
  ]

  /**
   * Jeder Dialog braucht einen Titel - auch einen unsichtbaren.
   *
   * Radix meldet das als Fehler in der Konsole, und es ist einer: Eine
   * Vorleseanwendung kündigt einen Dialog mit seinem Titel an. Ohne Titel
   * sagt sie nur "Dialog".
   */
  it('haben alle einen Titel', () => {
    const ohneTitel: string[] = []
    for (const ordner of ORDNER) {
      if (!fs.existsSync(ordner)) continue
      for (const name of fs.readdirSync(ordner).filter((d) => d.endsWith('.tsx'))) {
        const pfad = path.join(ordner, name)
        if (!fs.statSync(pfad).isFile()) continue
        const inhalt = fs.readFileSync(pfad, 'utf-8')
        // `ui/dialog.tsx` definiert die Bausteine selbst
        if (name === 'dialog.tsx' || name === 'command.tsx') continue
        if (inhalt.includes('<DialogContent') && !inhalt.includes('DialogTitle')) {
          ohneTitel.push(name)
        }
      }
    }
    expect(ohneTitel, `Dialoge ohne Titel: ${ohneTitel.join(', ')}`).toEqual([])
  })
})
