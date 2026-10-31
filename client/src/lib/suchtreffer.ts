import { Film, Users, Briefcase, MapPin, Clapperboard, FileText, Drama } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { screenplayT, type Lang } from '@/lib/i18n'
import { globalSearchT } from '@/lib/texte/komponenten/Shared'

/**
 * Beschriftung der Treffer von `GET /projects/:id/search` - gemeinsam für die
 * Schnellsuche (Strg+K) und die Suchseite. Der Server liefert Daten, keine
 * Sätze; hier entstehen Titel und Unterzeile in der gewählten Sprache.
 */

export const TREFFER_SYMBOL: Record<string, any> = {
  scene: Film,
  screenplay: FileText,
  character: Drama,
  cast: Users,
  crew: Briefcase,
  location: MapPin,
  shoot_day: Clapperboard,
}

const BLOCKARTEN: Record<string, Record<Lang, string>> = {
  scene_heading: screenplayT.typeSceneHeading,
  action: screenplayT.typeAction,
  character: screenplayT.typeCharacter,
  dialogue: screenplayT.typeDialogue,
  parenthetical: screenplayT.typeParenthetical,
  transition: screenplayT.typeTransition,
  note: screenplayT.typeNote,
  super: screenplayT.typeSuper,
  intercut: screenplayT.typeIntercut,
  annotation: screenplayT.typeAnnotation,
}

/** Titel und Unterzeile eines Treffers in der gewählten Sprache. */
export function beschriften(r: any, tt: (m: Record<Lang, string>) => string): { titel: string; unter: string } {
  const T = globalSearchT
  switch (r.type) {
    case 'character':
      return {
        titel: r.title,
        unter: r.darsteller?.length ? tt(T.gespieltVon).replace('{namen}', r.darsteller.join(', ')) : tt(T.nichtBesetzt),
      }
    case 'cast':
      return { titel: r.title, unter: r.figur ? tt(T.spielt).replace('{figur}', r.figur) : tt(T.darsteller) }
    case 'shoot_day':
      return {
        titel: tt(T.drehtag).replace('{n}', String(r.day_number)).replace('{datum}', formatDate(r.date)),
        unter: tt(r.szenen.length === 1 ? T.drehtagSzene : T.drehtagSzenen)
          .replace('{figuren}', r.figuren.join(', ')).replace('{szenen}', r.szenen.join(', ')),
      }
    case 'scene':
      return {
        titel: tt(T.szene).replace('{n}', r.scene_number).replace('{titel}', r.title),
        unter: r.figur ? tt(T.mitFigur).replace('{figur}', r.figur) : tt(T.szeneArt),
      }
    case 'screenplay':
      return {
        titel: tt(T.szeneText).replace('{n}', r.scene_number).replace('{text}', r.snippet),
        unter: BLOCKARTEN[r.block_type] ? tt(BLOCKARTEN[r.block_type]) : r.block_type,
      }
    default:
      return { titel: r.title, unter: r.subtitle ?? '' }
  }
}
