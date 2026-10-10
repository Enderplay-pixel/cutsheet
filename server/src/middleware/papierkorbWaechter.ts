/**
 * Legt gelöschte Einträge in den Papierkorb, ohne dass eine Route etwas davon
 * weiss.
 *
 * Der Weg über eine Middleware ist Absicht: Es gibt über zwanzig
 * Löschrouten, verteilt über ebenso viele Dateien. Jede einzeln umzubauen
 * hiesse, bei der nächsten neuen Route daran denken zu müssen - und genau das
 * geht schief. Hier steht an einer Stelle, welche Pfade gesichert werden.
 *
 * Gesichert wird **vor** dem Löschen, nicht danach: Hinterher ist die Zeile
 * weg, und was die Datenbank per CASCADE mitgenommen hat, lässt sich ohnehin
 * nicht mehr lesen.
 */
import { Request, Response, NextFunction } from 'express'
import { inDenPapierkorb, BEOBACHTET } from '../lib/papierkorb'

/**
 * Welches Pfadsegment zu welcher Tabelle gehört.
 *
 * Nur Einträge, die im Alltag versehentlich verschwinden. Buchhaltung wird
 * storniert statt gelöscht, Mails sind Belege, und Verknüpfungen (eine Rolle
 * aus einer Szene nehmen) sind kein Verlust, sondern eine Änderung.
 */
const PFAD_ZU_TABELLE: Record<string, string> = {
  scenes: 'scenes',
  crew: 'crew',
  cast: 'cast',
  characters: 'characters',
  locations: 'locations',
  'shoot-days': 'shoot_days',
  shots: 'shots',
  equipment: 'equipment_items',
  tasks: 'project_tasks',
  vehicles: 'vehicles',
  extras: 'extras',
  'budget-lines': 'budget_lines',
}

/** `/api/scenes/42` → `{ tabelle: 'scenes', id: 42 }`, sonst null. */
export function erkenneZiel(pfad: string): { tabelle: string; id: number } | null {
  const teile = pfad.replace(/^\/+/, '').split('/')
  // Genau zwei Teile: Entität und Kennung. `/scenes/4/characters/7` ist eine
  // Verknüpfung und gehört nicht in den Papierkorb.
  if (teile.length !== 2) return null
  const tabelle = PFAD_ZU_TABELLE[teile[0]]
  if (!tabelle || !BEOBACHTET[tabelle]) return null
  const id = Number(teile[1])
  if (!Number.isInteger(id) || id <= 0) return null
  return { tabelle, id }
}

export async function papierkorbWaechter(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'DELETE') return next()
  const ziel = erkenneZiel(req.path)
  if (!ziel) return next()

  try {
    await inDenPapierkorb(ziel.tabelle, ziel.id, {
      userId: (req as any).user?.id ?? null,
    })
  } catch (fehler: any) {
    // Der Papierkorb darf kein Löschen verhindern. Wer löschen will, soll
    // löschen können - auch wenn die Sicherung scheitert.
    console.warn('[Papierkorb] konnte nicht sichern:', fehler?.message || fehler)
  }
  return next()
}
