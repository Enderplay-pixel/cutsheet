/**
 * Die Zeilen des Stäbchenplan-Boards und wohin eine Auswahl darin kommt
 * (Plan Kino-Ausbau, AP A2).
 *
 * Das Board ist eine einzige Liste: je Drehtag seine Szenen und Banner, darunter
 * die Tagesgrenze, ganz unten der Kopf der Ablage und die ungeplanten Szenen.
 * Ob eine Szene vor einer Tagesgrenze oder dahinter landet, entscheidet, in
 * welchem Tag sie steht. Diese Datei rechnet nur - ohne React und ohne
 * Abhängigkeiten, damit `server/src/__tests__/boardZeilen.test.ts` sie prüfen
 * kann.
 */

export type Eintrag = { art: 'szene' | 'banner'; id: number }

export type Zeile =
  | { art: 'szene'; key: string; id: number; tagId: number | null }
  | { art: 'banner'; key: string; id: number; tagId: number }
  | { art: 'grenze'; key: string; tagId: number }
  | { art: 'ablage'; key: string }

/** Wohin eine Auswahl kommt: in welchen Tag (null: Ablage) und vor welchen Eintrag (null: ans Ende). */
export type Ziel = { zielTag: number | null; vor: Eintrag | null }

export interface BoardTag {
  id: number
  scenes: Array<{ scene_id: number; sort_order: number }>
  banner: Array<{ id: number; sort_order: number }>
}

/**
 * Szenen und Banner eines Tags in der Reihenfolge, die auch der Server
 * schreibt (`eintraegeDesTags` in `server/src/routes/drehplan.ts`): nach
 * `sort_order`, bei Gleichstand die Szene zuerst. Die Reihenfolge innerhalb
 * der Szenen und der Banner kommt schon sortiert vom Server und bleibt.
 */
export function eintraegeDesTags(tag: BoardTag): Eintrag[] {
  const alle = [
    ...(tag.scenes ?? []).map((s) => ({ art: 'szene' as const, id: s.scene_id, ordnung: s.sort_order, rang: 0 })),
    ...(tag.banner ?? []).map((b) => ({ art: 'banner' as const, id: b.id, ordnung: b.sort_order, rang: 1 })),
  ]
  // Array.prototype.sort ist stabil: Gleiches bleibt in der Reihenfolge des Servers
  alle.sort((a, b) => (a.ordnung - b.ordnung) || (a.rang - b.rang))
  return alle.map(({ art, id }) => ({ art, id }))
}

export const schluesselVon = (e: Eintrag) => `${e.art === 'szene' ? 's' : 'b'}-${e.id}`

/** Alle Zeilen des Boards: Tage in der übergebenen Reihenfolge, dann die Ablage. */
export function zeilenAus(tage: BoardTag[], ablage: number[]): Zeile[] {
  const zeilen: Zeile[] = []
  for (const tag of tage) {
    for (const e of eintraegeDesTags(tag)) {
      zeilen.push(e.art === 'szene'
        ? { art: 'szene', key: schluesselVon(e), id: e.id, tagId: tag.id }
        : { art: 'banner', key: schluesselVon(e), id: e.id, tagId: tag.id })
    }
    zeilen.push({ art: 'grenze', key: `g-${tag.id}`, tagId: tag.id })
  }
  zeilen.push({ art: 'ablage', key: 'ablage' })
  for (const id of ablage) zeilen.push({ art: 'szene', key: `s-${id}`, id, tagId: null })
  return zeilen
}

/**
 * Das Ziel, wenn eine Auswahl vor die Zeile `index` gesetzt wird. `zeilen`
 * ist die Liste ohne die Auswahl. Vor einer Szene oder einem Banner: in
 * deren Tag davor. Vor einer Tagesgrenze: ans Ende dieses Tags. Hinter der
 * letzten Grenze beginnt die Ablage - sie hat keine Reihenfolge auf dem
 * Server.
 */
export function zielAusStelle(zeilen: Zeile[], index: number): Ziel {
  const z = zeilen[index]
  if (!z) return { zielTag: null, vor: null }
  if (z.art === 'szene' && z.tagId !== null) return { zielTag: z.tagId, vor: { art: 'szene', id: z.id } }
  if (z.art === 'banner') return { zielTag: z.tagId, vor: { art: 'banner', id: z.id } }
  if (z.art === 'grenze') return { zielTag: z.tagId, vor: null }
  return { zielTag: null, vor: null }
}

export function gleichesZiel(a: Ziel, b: Ziel): boolean {
  return a.zielTag === b.zielTag && (a.vor?.art ?? null) === (b.vor?.art ?? null) && (a.vor?.id ?? null) === (b.vor?.id ?? null)
}

/**
 * Abgelegt auf der Zeile `ueber`: in der oberen Hälfte davor, in der unteren
 * dahinter. Abgelegt auf die eigene Auswahl: nichts (null).
 */
export function zielBeimAblegen(zeilen: Zeile[], auswahl: Set<string>, ueber: string, unten: boolean): Ziel | null {
  if (auswahl.has(ueber)) return null
  const rest = zeilen.filter((z) => !auswahl.has(z.key))
  const i = rest.findIndex((z) => z.key === ueber)
  if (i < 0) return null
  return zielAusStelle(rest, i + (unten ? 1 : 0))
}

/** Wo die Auswahl jetzt steht, als Ziel ausgedrückt. */
export function jetzigesZiel(zeilen: Zeile[], auswahl: Set<string>): { rest: Zeile[]; stelle: number; ziel: Ziel } | null {
  const erste = zeilen.findIndex((z) => auswahl.has(z.key))
  if (erste < 0) return null
  const rest = zeilen.filter((z) => !auswahl.has(z.key))
  const stelle = zeilen.slice(0, erste).filter((z) => !auswahl.has(z.key)).length
  return { rest, stelle, ziel: zielAusStelle(rest, stelle) }
}

/**
 * Alt und Pfeil (Soll 11): die Auswahl eine Stelle weiter, auch über eine
 * Tagesgrenze. Stellen, die nichts ändern (innerhalb der Ablage), werden
 * übersprungen. Ganz oben oder ganz unten: null.
 */
export function zielEinenSchritt(zeilen: Zeile[], auswahl: Set<string>, richtung: -1 | 1): Ziel | null {
  const jetzt = jetzigesZiel(zeilen, auswahl)
  if (!jetzt) return null
  for (let i = jetzt.stelle + richtung; i >= 0 && i <= jetzt.rest.length; i += richtung) {
    const ziel = zielAusStelle(jetzt.rest, i)
    if (!gleichesZiel(ziel, jetzt.ziel)) return ziel
  }
  return null
}

/**
 * Der Plan, wie er nach dem Verschieben aussieht - für die Anzeige, bevor
 * der Server antwortet. Dieselbe Regel wie `…/drehplan/verschieben`: die
 * Szenen in ihrer Reihenfolge vor `vor`, sonst ans Ende, `sort_order` im
 * Zieltag neu von 0 an. `neueSzene` baut den Eintrag für eine Szene aus der
 * Ablage.
 */
export function verschobeneTage<T extends BoardTag>(tage: T[], szenen: number[], ziel: Ziel, neueSzene: (id: number) => any): T[] {
  const gewaehlt = new Set(szenen)
  const vorhanden = new Map<number, any>()
  for (const tag of tage) for (const s of tag.scenes ?? []) if (gewaehlt.has(s.scene_id)) vorhanden.set(s.scene_id, s)

  return tage.map((tag) => {
    const scenes = (tag.scenes ?? []).filter((s) => !gewaehlt.has(s.scene_id))
    if (tag.id !== ziel.zielTag) return { ...tag, scenes }
    const reihe = eintraegeDesTags({ ...tag, scenes })
    let stelle = ziel.vor ? reihe.findIndex((e) => e.art === ziel.vor!.art && e.id === ziel.vor!.id) : reihe.length
    if (stelle < 0) stelle = reihe.length
    const neu: Eintrag[] = [...reihe.slice(0, stelle), ...szenen.map((id) => ({ art: 'szene' as const, id })), ...reihe.slice(stelle)]
    const neueScenes: any[] = []
    const neueBanner: any[] = []
    neu.forEach((e, i) => {
      if (e.art === 'szene') {
        const alt = vorhanden.get(e.id) ?? scenes.find((s) => s.scene_id === e.id) ?? neueSzene(e.id)
        neueScenes.push({ ...alt, sort_order: i })
      } else {
        neueBanner.push({ ...(tag.banner ?? []).find((b) => b.id === e.id), sort_order: i })
      }
    })
    return { ...tag, scenes: neueScenes, banner: neueBanner }
  })
}
