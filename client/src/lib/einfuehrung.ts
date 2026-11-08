/**
 * Einführungen: beim ersten Öffnen einer Seite ein paar Schritte, die mit
 * einem Pfeil auf das Wichtigste zeigen - und sagen, wohin eine Eingabe hier
 * weiterwirkt (Florian, 03.11.2026).
 *
 * Welche Einführungen ein Konto gesehen hat, steht auf dem Server unter
 * "einfuehrungen" (Liste der Seiten). Gesehen heißt: einmal angefangen. Wer
 * mittendrin wegklickt, bekommt sie nicht bei jedem Besuch wieder; über das
 * Fragezeichen in der Kopfleiste lässt sie sich jederzeit neu starten.
 */
import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { api } from '@/lib/api'
import type { Lang } from '@/lib/i18n'
import { isCreatorProject } from '@/lib/projectKind'
import { bereichFuer, type ArbeitsplatzArt } from '@/lib/bereiche'
import { useEinstellung } from '@/lib/einstellungen'
import { INHALTE } from '@/lib/texte/einfuehrungen'

type Text = Record<Lang, string>

export type Schritt = {
  /**
   * Worauf der Pfeil zeigt: die Kennung eines Elements mit
   * `data-einfuehrung="…"`, oder "titel" für die Überschrift der Seite;
   * "a|b" heißt a, sonst b.
   * Fehlt das Element gerade (leere Liste, schmaler Bildschirm), fällt der
   * Schritt weg. Ohne Ziel steht der Schritt mittig.
   */
  ziel?: string
  titel: Text
  text: Text
  /** Bereiche, in die eine Eingabe hier weiterwirkt - als Pfade wie in lib/bereiche.ts. */
  wirktAuf?: string[]
  /**
   * Reiter, der für diesen Schritt offen sein muss: Kennung eines Reiters mit
   * `data-einfuehrung="reiter-…"`. Die Einführung schaltet ihn um und stellt
   * am Ende den alten Reiter wieder ein - so lassen sich auch Inhalte zeigen,
   * die beim Öffnen der Seite noch nicht sichtbar sind.
   */
  reiter?: string
}

export type Einfuehrung = { schluessel: string; schritte: Schritt[]; art: ArbeitsplatzArt }

/**
 * Die Einführung zu einer Seite. Eine eigene Fassung für die Projektart
 * ("creator:besetzung") geht vor: Dieselbe Seite heißt dort "Gäste & Cast".
 */
export function einfuehrungFuer(art: ArbeitsplatzArt, seite: string): Einfuehrung | null {
  const eigen = `${art}:${seite}`
  if (INHALTE[eigen]?.length) return { schluessel: eigen, schritte: INHALTE[eigen], art }
  if (INHALTE[seite]?.length) return { schluessel: seite, schritte: INHALTE[seite], art }
  return null
}

/** Die Einführung der Seite, auf der man gerade ist - oder keine. */
export function useEinfuehrungHier(): Einfuehrung | null {
  const { projectId } = useParams()
  const { pathname } = useLocation()
  const { data: project } = useQuery({
    queryKey: ['project', Number(projectId)],
    queryFn: () => api.projects.get(Number(projectId)),
    enabled: !!projectId,
  })
  return useMemo(() => {
    if (!projectId || !project) return null
    const art: ArbeitsplatzArt = isCreatorProject(project) ? 'creator' : 'film'
    const seite = seiteAusPfad(pathname, projectId, art)
    return seite === null ? null : einfuehrungFuer(art, seite)
  }, [projectId, project, pathname])
}

/** Kennung der Seite, wie die Seitenleiste sie markiert; ein einzelnes Video hat seine eigene. */
export function seiteAusPfad(pathname: string, projectId: string | undefined, art: ArbeitsplatzArt): string | null {
  if (!projectId) return null
  const rest = pathname.split(`/projects/${projectId}`)[1]
  if (rest === undefined) return null
  const abschnitte = rest.split('/').filter(Boolean)
  if (abschnitte[0] === 'creator' && abschnitte[1] && /^\d+$/.test(abschnitte[1])) return 'creator/video'
  const zwei = abschnitte.slice(0, 2).join('/')
  if (abschnitte.length >= 2 && bereichFuer(art, zwei)) return zwei
  return abschnitte[0] ?? ''
}

export const EINFUEHRUNGEN_SCHLUESSEL = 'einfuehrungen'

export function useGeseheneEinfuehrungen() {
  return useEinstellung<string[]>(EINFUEHRUNGEN_SCHLUESSEL)
}

/** Die Einführung, die gerade läuft - auch von Hand gestartet (Kopfleiste). */
type Zustand = {
  offen: string | null
  starten: (seite: string) => void
  schliessen: () => void
}

export const useEinfuehrungStore = create<Zustand>(set => ({
  offen: null,
  starten: seite => set({ offen: seite }),
  schliessen: () => set({ offen: null }),
}))

/** Der Knopf eines Reiters, sofern es ihn auf der Seite gibt. */
export function reiterKnopf(reiter: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-einfuehrung="reiter-${CSS.escape(reiter)}"]`)
}

/**
 * Einen Reiter öffnen. Die Reiter (Radix) schalten bei mousedown um, nicht
 * bei click - und ein Fokus würde der Karte den Fokus nehmen.
 */
export function reiterOeffnen(knopf: HTMLElement) {
  if (knopf.getAttribute('aria-selected') === 'true') return
  knopf.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
}

/**
 * Das Element zu einem Ziel, sofern es gerade sichtbar ist. "liste|tag"
 * nimmt die Liste, sonst die Tagwahl: Manches erscheint erst, wenn ein Tag
 * gewählt ist - die Erklärung soll trotzdem nicht wegfallen.
 */
export function zielElement(ziel: string): HTMLElement | null {
  if (ziel.includes('|')) {
    for (const teil of ziel.split('|')) {
      const el = zielElement(teil)
      if (el) return el
    }
    return null
  }
  const kandidaten = ziel === 'titel'
    ? Array.from(document.querySelectorAll<HTMLElement>('main h1'))
    : Array.from(document.querySelectorAll<HTMLElement>(`[data-einfuehrung="${CSS.escape(ziel)}"]`))
  return kandidaten.find(el => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }) ?? null
}
