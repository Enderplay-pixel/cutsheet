import { prefersReducedMotion } from './motion'

/*
 * Rückmeldung für die ganze App — nach dem Vorbild von Apples Werkzeugen.
 *
 * Jede Handlung bekommt eine sofortige, ruhige Antwort: Knöpfe geben unter
 * dem Finger nach (CSS), gespeicherte Änderungen quittiert ein kurzes HUD,
 * am Telefon gibt es einen leisen Haptik-Tick. Nur der eine große Moment —
 * der letzte Shot eines Drehtags — bekommt einen kurzen Funkenregen in
 * Tungsten. Alles läuft in einer eigenen Ebene, React-Knoten bleiben
 * unberührt.
 *
 * Bewusst NICHT dabei: Material-Wellen, Lichtkegel unter dem Zeiger,
 * Dauerglanz, Punkte, Serien-Zwang, Benachrichtigungs-Köder.
 */

const FUNKEN_FARBEN = ['--primary', '--primary', '--warning', '--foreground']

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

/**
 * Antwort auf erledigte Arbeit. Normal nur ein Haptik-Tick — das Häkchen
 * selbst ist die Rückmeldung. `stark` nur für echte Meilensteine
 * (letzter Shot des Drehtags): ein kurzer Funkenregen in Tungsten.
 */
export function feiern(ziel: Element | { x: number; y: number }, stark = false) {
  // Kleine Momente: das Häkchen selbst ist die Antwort (CSS), dazu Haptik
  if (!stark) { tippen(10); return }
  if (prefersReducedMotion()) return
  const p = 'getBoundingClientRect' in ziel
    ? (() => { const r = ziel.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()
    : ziel
  const anzahl = 28
  const weite = 170
  const e = ebeneHolen()
  for (let i = 0; i < anzahl; i++) {
    const f = document.createElement('i')
    f.className = 'belohnung-funke'
    const gross = 4 + Math.random() * 4
    const eckig = Math.random() > 0.5
    Object.assign(f.style, {
      left: `${p.x}px`, top: `${p.y}px`, width: `${gross}px`, height: `${eckig ? gross * 1.8 : gross}px`,
      background: farbe(FUNKEN_FARBEN[i % FUNKEN_FARBEN.length]),
      borderRadius: eckig ? '1.5px' : '999px',
    })
    e.appendChild(f)
    const winkel = (i / anzahl) * Math.PI * 2 + Math.random() * 0.6
    const w = weite * (0.55 + Math.random() * 0.6)
    const dx = Math.cos(winkel) * w
    const dy = Math.sin(winkel) * w - 50
    const fall = 120 + Math.random() * 100
    const dreh = (Math.random() - 0.5) * 720
    f.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${dreh / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + fall}px)) scale(0.6) rotate(${dreh}deg)`, opacity: 0 },
      ],
      { duration: 1200 + Math.random() * 400, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    ).onfinish = () => f.remove()
  }
  tippen(18)
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
}
