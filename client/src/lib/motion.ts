import { useEffect, useRef, useState } from 'react'

/** Nutzer hat im System „Bewegung reduzieren“ eingeschaltet. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Zahl, die beim ersten Erscheinen von 0 hochzählt und bei Änderungen
 * weich zum neuen Wert gleitet. Bei reduzierter Bewegung sofort der Endwert.
 */
export function useCountUp(rawTarget: number | string | null | undefined, duration = 900): number {
  // Zählwerte aus Postgres kommen als Text ("8") — hier einheitlich als Zahl
  const target = Number(rawTarget) || 0
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  const fromRef = useRef(value)
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(target); fromRef.current = target; return }
    const from = fromRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out-expo: schneller Start, weiches Ankommen
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      const next = from + (target - from) * eased
      setValue(next)
      fromRef.current = next
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

/**
 * false beim ersten Rendern, danach true — damit Balken und Ringe von 0 aus
 * in ihre Endposition gleiten statt fertig zu erscheinen.
 */
export function useEntered(delay = 60): boolean {
  const [entered, setEntered] = useState(() => prefersReducedMotion())
  useEffect(() => {
    if (entered) return
    const id = window.setTimeout(() => setEntered(true), delay)
    return () => window.clearTimeout(id)
  }, [entered, delay])
  return entered
}

/**
 * Hell/Dunkel mit kreisförmiger Enthüllung vom Klickpunkt aus
 * (View Transitions API). Ohne Unterstützung einfach umschalten.
 */
export function toggleThemeWithReveal(toggle: () => void, origin?: { x: number; y: number }) {
  const doc = document as any
  if (!doc.startViewTransition || prefersReducedMotion()) { toggle(); return }
  const x = origin?.x ?? window.innerWidth - 40
  const y = origin?.y ?? 28
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const transition = doc.startViewTransition(() => toggle())
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => { /* Übergang abgebrochen — Umschalten ist trotzdem erfolgt */ })
}
