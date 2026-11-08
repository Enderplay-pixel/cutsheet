import type { Schritt } from '@/lib/einfuehrung'
import { uebersicht } from './uebersicht'
import { entwicklung } from './entwicklung'
import { casting } from './casting'
import { planung } from './planung'
import { dreh } from './dreh'
import { werkzeuge } from './werkzeuge'

/**
 * Alle Einführungen, je Seite (Pfad wie in lib/bereiche.ts, "" ist die
 * Hauptseite). "creator:<pfad>" ist die Fassung für Creator-Projekte.
 *
 * Jede Aussage hier ist am Code nachgeprüft, besonders die Zusammenhänge
 * (`wirktAuf`): Eine Einführung, die etwas Falsches verspricht, ist schlimmer
 * als keine.
 */
export const INHALTE: Record<string, Schritt[]> = {
  ...uebersicht,
  ...entwicklung,
  ...casting,
  ...planung,
  ...dreh,
  ...werkzeuge,
}
