/**
 * Projektart: Film oder Content/Creator.
 *
 * Steht bewusst an einer Stelle, weil sonst Sidebar, Projektliste und
 * Stammdaten jeweils eine eigene Liste pflegen müssten und irgendwann
 * auseinanderlaufen.
 */

export const FILM_FORMATS = [
  'Kurzfilm', 'Spielfilm', 'Dokumentation', 'Serie', 'Werbefilm', 'Imagefilm',
] as const

export const CREATOR_FORMATS = [
  'YouTube-Video', 'YouTube Shorts', 'Reel / TikTok', 'Podcast', 'Stream / Live',
] as const

export const ALL_FORMATS = [...FILM_FORMATS, ...CREATOR_FORMATS]

export function isCreatorFormat(format: string | null | undefined): boolean {
  return (CREATOR_FORMATS as readonly string[]).includes(String(format ?? '').trim())
}

/**
 * Ist das ein Creator-Projekt?
 *
 * Neben project_kind wird auch das Format geprüft: Projekte, die vor der
 * Einführung der Projektart angelegt wurden, stehen in der Datenbank auf
 * 'film', obwohl ihr Format eindeutig ein Content-Format ist. Der Server holt
 * das per Migration nach — bis die durch ist, soll die Oberfläche trotzdem
 * das Richtige zeigen.
 */
export function isCreatorProject(project: any): boolean {
  if (!project) return false
  if (project.project_kind === 'creator') return true
  return isCreatorFormat(project.format)
}
