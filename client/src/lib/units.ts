/**
 * Units in der Oberfläche (Plan Kino-Ausbau, AP C2). Ein Drehtag bringt seine
 * Unit vom Server mit: `unit_id`, `unit_name`, `unit_short`, `unit_color`,
 * `unit_is_main`. Tage der Haupteinheit heißen wie bisher, Tage einer anderen
 * Unit tragen ihr Kürzel davor ("2U Tag 3").
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Unit = {
  id: number
  name: string
  short: string
  color: string
  is_main: boolean
  sort_order: number
  tage_anzahl?: number
  stab_anzahl?: number
}

type TagMitUnit = { day_number: number; unit_id?: number | null; unit_is_main?: boolean | null; unit_short?: string | null; unit_name?: string | null }

/** Das Kürzel einer anderen Unit, sonst leer. */
export function unitKuerzel(tag: TagMitUnit): string {
  if (tag.unit_is_main !== false) return ''
  return tag.unit_short || tag.unit_name || ''
}

/** Die Nummer eines Tages mit Kürzel: "4" oder "2U 1" - für "Tag {n}" in Sätzen. */
export function tagNummer(tag: TagMitUnit): string {
  const k = unitKuerzel(tag)
  return k ? `${k} ${tag.day_number}` : String(tag.day_number)
}

/** Ein übersetzter Text wie "Tag 4" mit dem Kürzel davor: "2U Tag 1". */
export function mitUnit(text: string, tag: TagMitUnit): string {
  const k = unitKuerzel(tag)
  return k ? `${k} ${text}` : text
}

/** Die Units eines Projekts, die Haupteinheit zuerst. */
export function useUnits(projectId: number) {
  return useQuery<Unit[]>({
    queryKey: ['units', projectId],
    queryFn: () => api.units.list(projectId),
    enabled: projectId > 0,
  })
}

/**
 * Tage nach Unit und Nummer: jede Unit als eigene Folge, in der Reihenfolge
 * der Units. Mit `filter` nur die Tage einer Unit.
 */
export function tageNachUnit<T extends TagMitUnit>(tage: T[], units: Unit[] | undefined, filter: number | 'alle' = 'alle'): T[] {
  const haupt = units?.find((u) => u.is_main)?.id
  const unitVon = (t: T) => t.unit_id ?? haupt ?? 0
  const rang = new Map((units ?? []).map((u, i) => [u.id, i]))
  return tage
    .filter((t) => filter === 'alle' || unitVon(t) === filter)
    .slice()
    .sort((a, b) => ((rang.get(unitVon(a)) ?? 0) - (rang.get(unitVon(b)) ?? 0)) || (a.day_number - b.day_number))
}
