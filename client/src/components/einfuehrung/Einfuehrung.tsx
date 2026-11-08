/**
 * Die Einführung einer Seite: ein abgedunkelter Bildschirm, ein Lichtkegel
 * auf dem Element, um das es gerade geht, und eine Karte mit Pfeil darauf.
 *
 * Sie startet von selbst beim ersten Besuch einer Seite, aber erst, wenn die
 * Seite fertig geladen ist und kein Fenster offen ist (Willkommen, Dialoge,
 * die Einrichtung des Arbeitsplatzes). Schritte, deren Element gerade fehlt,
 * fallen weg - eine leere Liste hat keine Zeile, auf die man zeigen könnte.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { prefersReducedMotion } from '@/lib/motion'
import { bereichFuer, type Bereich } from '@/lib/bereiche'
import {
  reiterKnopf, reiterOeffnen, useEinfuehrungHier, useEinfuehrungStore, useGeseheneEinfuehrungen,
  zielElement, type Schritt,
} from '@/lib/einfuehrung'
import { einfuehrungT } from '@/lib/texte/Einfuehrung'

const RAND = 16
const ABSTAND = 14
const LUFT = 6
const SPERRE = '[role="dialog"], [role="alertdialog"], [data-einfuehrung-sperre]'
const LAEDT = 'main .skeleton-shimmer, main .animate-spin'

const fuellen = (text: string, werte: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => String(werte[k] ?? ''))

/** Startet die Einführung beim ersten Besuch und zeigt sie an. Einmal im Layout eingehängt. */
export function Einfuehrung() {
  const hier = useEinfuehrungHier()
  const { wert: gesehen, geladen, setzen } = useGeseheneEinfuehrungen()
  const { offen, starten, schliessen } = useEinfuehrungStore()

  // Beim Seitenwechsel endet eine laufende Einführung
  const schluessel = hier?.schluessel ?? null
  useEffect(() => { schliessen() }, [schluessel, schliessen])

  useEffect(() => {
    if (!geladen || !hier || offen) return
    if ((gesehen ?? []).includes(hier.schluessel)) return
    const beginn = Date.now()
    const takt = window.setInterval(() => {
      const vergangen = Date.now() - beginn
      if (vergangen > 15_000) { window.clearInterval(takt); return }
      // Erst nach dem Einblenden der Seite, und nie über ein offenes Fenster
      if (vergangen < 700 || document.visibilityState !== 'visible') return
      if (document.querySelector(SPERRE) || document.querySelector(LAEDT)) return
      // Mindestens ein Schritt muss etwas zeigen können - am Telefon fehlt manche Spalte
      if (!hier.schritte.some(x => !x.ziel || zielElement(x.ziel))) return
      window.clearInterval(takt)
      setzen([...(gesehen ?? []).filter(s => s !== hier.schluessel), hier.schluessel])
      starten(hier.schluessel)
    }, 250)
    return () => window.clearInterval(takt)
  }, [geladen, hier, offen, gesehen, setzen, starten])

  if (!hier || offen !== hier.schluessel) return null
  return createPortal(<Fenster schritte={hier.schritte} art={hier.art} onEnde={schliessen} />, document.body)
}

type Rechteck = { top: number; left: number; width: number; height: number }

function Fenster({ schritte: alle, art, onEnde }: {
  schritte: Schritt[]
  art: 'film' | 'creator'
  onEnde: () => void
}) {
  const tt = useT()
  // Was beim Start sichtbar ist, bleibt die Liste: Sie springt nicht, während
  // man liest. Ein Schritt in einem anderen Reiter zählt, wenn es den Reiter gibt.
  const schritte = useMemo(
    () => alle.filter(s => !s.ziel || zielElement(s.ziel) || (s.reiter && reiterKnopf(s.reiter))),
    [alle],
  )
  const [index, setIndex] = useState(0)
  const schritt = schritte[index]
  const [ziel, setZiel] = useState<Rechteck | null>(null)
  const [karte, setKarte] = useState({ width: 0, height: 0 })
  // Wo der Lichtkegel gerade steht: Er gleitet zum Element, statt zu springen
  const stand = useRef<Rechteck | null>(null)
  const karteRef = useRef<HTMLDivElement>(null)
  const weiterRef = useRef<HTMLButtonElement>(null)
  const ruhig = prefersReducedMotion()

  // Fokus in die Karte, beim Ende zurück dorthin, wo er war - und die
  // Reiter wieder so, wie man sie vorgefunden hat
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null
    const offeneReiter = Array.from(document.querySelectorAll<HTMLElement>('[data-einfuehrung^="reiter-"][aria-selected="true"]'))
    return () => {
      offeneReiter.forEach(knopf => { if (knopf.isConnected) reiterOeffnen(knopf) })
      if (vorher?.isConnected) vorher.focus({ preventScroll: true })
    }
  }, [])
  // Erst wenn die Karte sichtbar ist: Unsichtbares lässt sich nicht fokussieren
  const bereit = karte.height > 0
  useEffect(() => { if (bereit) weiterRef.current?.focus({ preventScroll: true }) }, [index, bereit])

  // Zum Element blättern, dann jeden Takt nachmessen: Blättern, Fenstergröße
  // und nachladende Inhalte verschieben es.
  useEffect(() => {
    const knopf = schritt?.reiter ? reiterKnopf(schritt.reiter) : null
    if (knopf) reiterOeffnen(knopf)
    const hinblaettern = () => {
      const el = schritt?.ziel ? zielElement(schritt.ziel) : null
      if (!el) return
      const r = el.getBoundingClientRect()
      const sichtbar = r.top >= 72 && r.bottom <= window.innerHeight - 24
      if (!sichtbar) el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: ruhig ? 'auto' : 'smooth' })
    }
    // Nach dem Umschalten braucht der Reiter einen Takt, bis sein Inhalt steht
    const verzoegert = knopf ? window.setTimeout(hinblaettern, 120) : undefined
    if (!knopf) hinblaettern()
    let rahmen = 0
    let letztes = ''
    const messen = () => {
      const e = schritt?.ziel ? zielElement(schritt.ziel) : null
      const r = e?.getBoundingClientRect()
      const soll: Rechteck | null = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null
      const alt = stand.current
      // Ein Viertel des Wegs je Takt: weich, und nach gut zehn Takten am Ziel
      const neu = !soll || !alt || ruhig ? soll : {
        top: alt.top + (soll.top - alt.top) * 0.25,
        left: alt.left + (soll.left - alt.left) * 0.25,
        width: alt.width + (soll.width - alt.width) * 0.25,
        height: alt.height + (soll.height - alt.height) * 0.25,
      }
      stand.current = neu
      const kurz = JSON.stringify(neu && Object.values(neu).map(v => Math.round(v * 2) / 2))
      if (kurz !== letztes) { letztes = kurz; setZiel(neu) }
      rahmen = requestAnimationFrame(messen)
    }
    messen()
    return () => { cancelAnimationFrame(rahmen); window.clearTimeout(verzoegert) }
  }, [schritt, ruhig])

  useLayoutEffect(() => {
    const el = karteRef.current
    if (!el) return
    const beobachter = new ResizeObserver(() => setKarte({ width: el.offsetWidth, height: el.offsetHeight }))
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [])

  const weiter = useCallback(() => {
    if (index < schritte.length - 1) setIndex(i => i + 1)
    else onEnde()
  }, [index, schritte.length, onEnde])
  const zurueck = useCallback(() => setIndex(i => Math.max(0, i - 1)), [])

  // Tastatur: Escape beendet, Pfeile blättern, Tab bleibt in der Karte
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onEnde(); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); weiter(); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); zurueck(); return }
      if (e.key === 'Tab' && karteRef.current) {
        const knoepfe = Array.from(karteRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
        if (knoepfe.length === 0) return
        const i = knoepfe.indexOf(document.activeElement as HTMLElement)
        const naechster = e.shiftKey ? (i <= 0 ? knoepfe.length - 1 : i - 1) : (i === knoepfe.length - 1 ? 0 : i + 1)
        e.preventDefault()
        knoepfe[naechster].focus()
      }
    }
    window.addEventListener('keydown', taste, true)
    return () => window.removeEventListener('keydown', taste, true)
  }, [onEnde, weiter, zurueck])

  if (!schritt) return null

  const lage = platzieren(ziel, karte)
  const verknuepft = (schritt.wirktAuf ?? []).map(p => bereichFuer(art, p)).filter((x): x is Bereich => !!x)
  const letzter = index === schritte.length - 1

  return (
    <div className="fixed inset-0 z-[90]">
      {/* Fängt Klicks ab: Während der Einführung arbeitet man nicht auf der Seite */}
      <div className="absolute inset-0" onClick={e => e.stopPropagation()} />
      {/* Abgedunkelt mit einem Loch über dem Element. Vorher ein Schatten mit
          200vmax Ausdehnung - den zeichnete Chrome nicht in jedem Schritt. */}
      <svg aria-hidden className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="einfuehrung-loch">
            <rect width="100%" height="100%" fill="white" />
            {ziel && (
              <rect x={ziel.left - LUFT} y={ziel.top - LUFT} width={ziel.width + LUFT * 2} height={ziel.height + LUFT * 2} rx={12} fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(8,8,10,0.62)" mask="url(#einfuehrung-loch)" />
      </svg>
      {ziel && (
        <div
          aria-hidden
          className="absolute rounded-xl pointer-events-none ring-2 ring-primary/70"
          style={{ top: ziel.top - LUFT, left: ziel.left - LUFT, width: ziel.width + LUFT * 2, height: ziel.height + LUFT * 2 }}
        />
      )}

      <div
        ref={karteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="einfuehrung-titel"
        aria-describedby="einfuehrung-text"
        data-einfuehrung-karte
        className={cn(
          'absolute rounded-2xl border border-border/70 bg-card text-foreground shadow-2xl p-5',
          !ruhig && 'animate-fade-up',
        )}
        style={{ top: lage.top, left: lage.left, width: lage.breite, visibility: karte.height ? 'visible' : 'hidden' }}
      >
        {lage.pfeil && (
          <span
            aria-hidden
            className={cn(
              'absolute w-3.5 h-3.5 rotate-45 bg-card border-border/70',
              lage.pfeil.seite === 'oben' && '-top-[8px] border-l border-t',
              lage.pfeil.seite === 'unten' && '-bottom-[8px] border-r border-b',
              lage.pfeil.seite === 'links' && '-left-[8px] border-l border-b',
              lage.pfeil.seite === 'rechts' && '-right-[8px] border-r border-t',
            )}
            style={lage.pfeil.seite === 'oben' || lage.pfeil.seite === 'unten'
              ? { left: lage.pfeil.position - 7 }
              : { top: lage.pfeil.position - 7 }}
          />
        )}

        <div className="flex items-start justify-between gap-3">
          <span className="eyebrow">{fuellen(tt(einfuehrungT.schritt), { a: index + 1, b: schritte.length })}</span>
          <button
            type="button"
            onClick={onEnde}
            aria-label={tt(einfuehrungT.ueberspringen)}
            className="-mt-1.5 -mr-1.5 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <h2 id="einfuehrung-titel" className="text-[17px] font-semibold tracking-[-0.02em] mt-1.5 leading-snug">{tt(schritt.titel)}</h2>
        <p id="einfuehrung-text" className="text-[14px] text-foreground/80 mt-2 leading-relaxed">{tt(schritt.text)}</p>

        {verknuepft.length > 0 && (
          <div className="mt-3.5">
            <div className="text-[11px] font-medium text-muted-foreground">{tt(einfuehrungT.zusammenhang)}</div>
            <ul className="flex flex-wrap gap-1.5 mt-1.5">
              {verknuepft.map(x => (
                <li key={x.pfad} className="flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full bg-primary/[0.08] text-[12px] text-foreground/90">
                  <x.icon className="w-3.5 h-3.5 text-primary" aria-hidden />
                  {tt(x.text)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-5">
          <div className="flex gap-1" aria-hidden>
            {schritte.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all duration-200', i === index ? 'w-4 bg-primary' : 'w-1.5 bg-foreground/15')} />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={zurueck}>{tt(einfuehrungT.zurueck)}</Button>
            )}
            <Button ref={weiterRef} size="sm" onClick={weiter}>
              {tt(letzter ? einfuehrungT.fertig : einfuehrungT.weiter)}
              {!letzter && <ArrowRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Für Vorlesegeräte: der neue Schritt, wenn weitergeblättert wurde */}
      <div className="sr-only" aria-live="polite">
        {index > 0 ? `${fuellen(tt(einfuehrungT.schritt), { a: index + 1, b: schritte.length })}: ${tt(schritt.titel)}` : ''}
      </div>
    </div>
  )
}

type Lage = {
  top: number
  left: number
  breite: number
  pfeil?: { seite: 'oben' | 'unten' | 'links' | 'rechts'; position: number }
}

/**
 * Wohin die Karte kommt: unter das Element, sonst darüber, sonst daneben.
 * Passt sie nirgends (das Element füllt den Bildschirm), liegt sie am Rand
 * gegenüber und ohne Pfeil - ein Pfeil mitten ins Element zeigt auf nichts.
 */
function platzieren(ziel: Rechteck | null, karte: { width: number; height: number }): Lage {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const breite = Math.min(384, vw - RAND * 2)
  const hoehe = karte.height || 220
  const klemmen = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x))

  if (!ziel) return { top: Math.max(RAND, (vh - hoehe) / 2), left: (vw - breite) / 2, breite }

  // Nur der sichtbare Teil des Elements zählt
  const oben = Math.max(ziel.top, 0) - LUFT
  const unten = Math.min(ziel.top + ziel.height, vh) + LUFT
  const mitteX = ziel.left + ziel.width / 2
  const links = klemmen(mitteX - breite / 2, RAND, vw - RAND - breite)
  const pfeilX = klemmen(mitteX - links, 22, breite - 22)

  if (vh - unten >= hoehe + ABSTAND + RAND) {
    return { top: unten + ABSTAND, left: links, breite, pfeil: { seite: 'oben', position: pfeilX } }
  }
  if (oben >= hoehe + ABSTAND + RAND) {
    return { top: oben - ABSTAND - hoehe, left: links, breite, pfeil: { seite: 'unten', position: pfeilX } }
  }
  const mitteY = (oben + unten) / 2
  const topSeitlich = klemmen(mitteY - hoehe / 2, RAND, vh - RAND - hoehe)
  const pfeilY = klemmen(mitteY - topSeitlich, 22, hoehe - 22)
  if (vw - (ziel.left + ziel.width + LUFT) >= breite + ABSTAND + RAND) {
    return { top: topSeitlich, left: ziel.left + ziel.width + LUFT + ABSTAND, breite, pfeil: { seite: 'links', position: pfeilY } }
  }
  if (ziel.left - LUFT >= breite + ABSTAND + RAND) {
    return { top: topSeitlich, left: ziel.left - LUFT - ABSTAND - breite, breite, pfeil: { seite: 'rechts', position: pfeilY } }
  }
  return { top: mitteY < vh / 2 ? vh - RAND - hoehe : RAND, left: links, breite }
}
