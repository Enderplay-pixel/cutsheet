import { prefersReducedMotion } from './motion'

/*
 * Belohnendes Feedback für die ganze App.
 *
 * Jede Handlung bekommt eine sofortige, körperliche Antwort: Knöpfe geben
 * unter dem Finger nach und schlagen eine Welle, Häkchen platzen in kleine
 * Funken, gespeicherte Änderungen quittiert eine kurze Pille, Karten folgen
 * dem Zeiger mit einem warmen Lichtkegel. Alles läuft in einer eigenen,
 * festen Ebene über der Seite — React-Knoten werden nie angefasst.
 *
 * Bewusst NICHT dabei: künstliche Dringlichkeit, Serien-Zwang, Punkte,
 * Benachrichtigungs-Köder. Das Gefühl soll aus der Arbeit selbst kommen.
 */

const FUNKEN_FARBEN = ['--primary', '--warning', '--success', '--info', '--danger']
const WELLEN_ZIEL = 'button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], a[href]'
const LICHT_ZIEL = '.stat-card, .lift, .card-lift, [data-licht]'

let ebene: HTMLDivElement | null = null
function ebeneHolen(): HTMLDivElement {
  if (ebene && document.body.contains(ebene)) return ebene
  ebene = document.createElement('div')
  ebene.className = 'belohnung-ebene'
  ebene.setAttribute('aria-hidden', 'true')
  document.body.appendChild(ebene)
  return ebene
}

const farbe = (token: string, alpha = 1) => `hsl(var(${token}) / ${alpha})`
const grob = () => window.matchMedia?.('(pointer: coarse)').matches

/** Leichter Tipp-Impuls am Telefon. Still, wo es nicht geht. */
export function tippen(ms = 8) {
  if (prefersReducedMotion() || !grob()) return
  try { navigator.vibrate?.(ms) } catch { /* nicht unterstützt */ }
}

/** Welle vom Berührpunkt aus, beschnitten auf die Form des Elements. */
function welle(el: Element, x: number, y: number) {
  const r = el.getBoundingClientRect()
  if (r.width < 8 || r.height < 8 || r.width > 900) return
  const stil = getComputedStyle(el)
  const rahmen = document.createElement('div')
  rahmen.className = 'belohnung-welle-rahmen'
  Object.assign(rahmen.style, {
    left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    borderRadius: stil.borderRadius,
  })
  const kreis = document.createElement('span')
  const d = Math.hypot(Math.max(x - r.left, r.right - x), Math.max(y - r.top, r.bottom - y)) * 2
  const hell = el.matches('.bg-primary, .bg-destructive, [data-variant="default"]')
  Object.assign(kreis.style, {
    width: `${d}px`, height: `${d}px`, left: `${x - r.left - d / 2}px`, top: `${y - r.top - d / 2}px`,
    background: hell ? 'rgb(255 255 255 / 0.28)' : farbe('--primary', 0.16),
  })
  rahmen.appendChild(kreis)
  ebeneHolen().appendChild(rahmen)
  kreis.animate(
    [{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1)', opacity: 0 }],
    { duration: 620, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  ).onfinish = () => rahmen.remove()
}

/**
 * Funkenregen an einem Punkt oder Element — für abgehakte Aufgaben,
 * erledigte Shots, fertige Drehtage. `stark` für die großen Momente.
 */
export function feiern(ziel: Element | { x: number; y: number }, stark = false) {
  if (prefersReducedMotion()) return
  const p = 'getBoundingClientRect' in ziel
    ? (() => { const r = ziel.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()
    : ziel
  const anzahl = stark ? 42 : 14
  const weite = stark ? 190 : 46
  const e = ebeneHolen()
  for (let i = 0; i < anzahl; i++) {
    const f = document.createElement('i')
    f.className = 'belohnung-funke'
    const gross = stark ? 5 + Math.random() * 5 : 3 + Math.random() * 3
    const eckig = stark && Math.random() > 0.5
    Object.assign(f.style, {
      left: `${p.x}px`, top: `${p.y}px`, width: `${gross}px`, height: `${eckig ? gross * 1.8 : gross}px`,
      background: farbe(FUNKEN_FARBEN[i % FUNKEN_FARBEN.length]),
      borderRadius: eckig ? '1.5px' : '999px',
    })
    e.appendChild(f)
    const winkel = (i / anzahl) * Math.PI * 2 + Math.random() * 0.6
    const w = weite * (0.55 + Math.random() * 0.6)
    const dx = Math.cos(winkel) * w
    const dy = Math.sin(winkel) * w - (stark ? 60 : 10)
    const fall = stark ? 140 + Math.random() * 120 : 18
    const dreh = (Math.random() - 0.5) * 720
    f.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${dreh / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + fall}px)) scale(0.6) rotate(${dreh}deg)`, opacity: 0 },
      ],
      { duration: stark ? 1400 + Math.random() * 500 : 620 + Math.random() * 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    ).onfinish = () => f.remove()
  }
  if (!stark && 'getBoundingClientRect' in ziel) {
    // Ein Ring, der sich um das Häkchen ausbreitet
    const r = ziel.getBoundingClientRect()
    const ring = document.createElement('i')
    ring.className = 'belohnung-ring'
    Object.assign(ring.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` })
    e.appendChild(ring)
    ring.animate(
      [{ transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0.9 }, { transform: 'translate(-50%, -50%) scale(2.6)', opacity: 0 }],
      { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    ).onfinish = () => ring.remove()
  }
  tippen(stark ? 18 : 10)
}

let pille: HTMLDivElement | null = null
let pilleTimer = 0
/** Kurze Quittung „Gespeichert“ unten in der Mitte, nach jedem Schreibvorgang. */
export function gespeichert(text = 'Gespeichert') {
  if (typeof document === 'undefined') return
  window.clearTimeout(pilleTimer)
  if (!pille || !document.body.contains(pille)) {
    pille = document.createElement('div')
    pille.className = 'belohnung-pille'
    pille.setAttribute('role', 'status')
    ebeneHolen().appendChild(pille)
  }
  pille.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="belohnung-haken" d="M5 12.5l4.5 4.5L19 7.5"/></svg><span></span>`
  pille.querySelector('span')!.textContent = text
  pille.classList.remove('an')
  void pille.offsetWidth // Animation neu starten
  pille.classList.add('an')
  pilleTimer = window.setTimeout(() => pille?.classList.remove('an'), 1300)
}

let installiert = false
/** Einmal beim Start aufrufen. */
export function belohnungInstallieren() {
  if (installiert || typeof window === 'undefined') return
  installiert = true

  document.addEventListener('pointerdown', (ev) => {
    if (prefersReducedMotion() || ev.button !== 0) return
    const el = (ev.target as Element | null)?.closest?.(WELLEN_ZIEL)
    if (!el || el.closest('[data-keine-welle], input, textarea, select')) return
    if ((el as HTMLButtonElement).disabled) return
    welle(el, ev.clientX, ev.clientY)
    tippen()
  }, { passive: true })

  // Häkchen: nach dem Klick nachsehen, ob es jetzt gesetzt ist
  document.addEventListener('click', (ev) => {
    const t = ev.target as Element | null
    const box = t?.closest?.('[role="checkbox"], input[type="checkbox"], [data-feiern]')
    if (!box) return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const an = box.matches('input')
        ? (box as HTMLInputElement).checked
        : box.getAttribute('data-state') === 'checked' || box.getAttribute('aria-checked') === 'true' || box.hasAttribute('data-feiern')
      if (an) feiern(box, box.getAttribute('data-feiern') === 'gross')
    }))
  })

  // Lichtkegel, der dem Zeiger über Karten folgt
  let raf = 0
  let letztes: HTMLElement | null = null
  document.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || prefersReducedMotion()) return
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const el = (ev.target as Element | null)?.closest?.(LICHT_ZIEL) as HTMLElement | null
      if (letztes && letztes !== el) letztes.classList.remove('licht-an')
      letztes = el
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${ev.clientX - r.left}px`)
      el.style.setProperty('--my', `${ev.clientY - r.top}px`)
      el.classList.add('licht-an')
    })
  }, { passive: true })
}
