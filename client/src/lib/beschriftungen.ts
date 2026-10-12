/**
 * Verknüpft Beschriftungen mit ihren Feldern - auch dort, wo natives
 * `<label>` ohne `for` steht.
 *
 * In dieser Anwendung gibt es zwei Muster. Der Baustein
 * `components/ui/label.tsx` verknüpft sich selbst. Daneben stehen rund
 * fünfzig native `<label className="…">Text</label>`-Zeilen, meist in
 * Dialogen, die genauso ein Feld beschriften - aber ohne `for`.
 *
 * Für eine Vorleseanwendung ist ein Feld ohne `for` ein Feld **ohne Namen**:
 * Sie sagt "Eingabefeld" und lässt offen, was hineingehört. Ein Klick auf die
 * Beschriftung setzt den Schreibzeiger auch nicht ins Feld.
 *
 * Statt rund fünfzig Dateien anzufassen - ein Diff, den niemand prüfen kann,
 * mit Tippfehlerrisiko an jeder Stelle - steht die Verknüpfung hier einmal.
 * Sie läuft beim Start und bei jeder Änderung am Dokument, weil Dialoge erst
 * später aufgehen.
 *
 * Geändert werden ausschliesslich `for` und `id`. Wer `for` selbst setzt,
 * behält die Oberhand.
 */

let zaehler = 0

/** Felder, die eine Beschriftung tragen können. */
const FELDER = 'input, textarea, select'

/**
 * Verknüpft eine Beschriftung mit dem Feld, das zu ihr gehört.
 *
 * Gesucht wird in dieser Reihenfolge:
 *  1. ein Feld **innerhalb** der Beschriftung - dann braucht es kein `for`
 *  2. das nächste Geschwisterelement
 *  3. das erste Feld im gemeinsamen Elternelement
 *
 * Der dritte Schritt ist der übliche Fall: `<div><label/><Input/></div>`.
 */
function verknuepfe(beschriftung: HTMLLabelElement): void {
  if (beschriftung.getAttribute('for')) return
  if (beschriftung.querySelector(FELDER)) return // Feld steckt drin, das genügt

  let feld: HTMLElement | null = null

  const naechstes = beschriftung.nextElementSibling
  if (naechstes) {
    feld = naechstes.matches(FELDER)
      ? (naechstes as HTMLElement)
      : naechstes.querySelector<HTMLElement>(FELDER)
  }
  if (!feld) feld = beschriftung.parentElement?.querySelector<HTMLElement>(FELDER) ?? null
  if (!feld) return

  // Ein Feld, das schon anderswo beschriftet ist, bleibt unberührt.
  if (feld.getAttribute('aria-label') || feld.getAttribute('aria-labelledby')) return
  if (feld.id && document.querySelector(`label[for="${CSS.escape(feld.id)}"]`)) return

  if (!feld.id) feld.id = `beschriftet-${++zaehler}`
  beschriftung.setAttribute('for', feld.id)
}

/**
 * Notlösung für Felder, die gar keine Beschriftung haben.
 *
 * In Tabellen und kompakten Formularen steht oft nur ein Platzhalter:
 * „Komponist", „Fahrzeugname", „Phasenname". Fachlich ist ein Platzhalter
 * kein Ersatz für eine Beschriftung - er verschwindet, sobald jemand tippt.
 * Als `aria-label` bleibt der Text aber erhalten, und ein Name aus dem
 * Platzhalter ist unendlich besser als gar kein Name.
 *
 * Deshalb ist das die zweite Wahl: Erst wird nach einer echten Beschriftung
 * gesucht, und nur was danach übrig bleibt, bekommt seinen Platzhalter.
 */
function ausPlatzhalter(feld: HTMLInputElement | HTMLTextAreaElement): void {
  if (feld.getAttribute('aria-label') || feld.getAttribute('aria-labelledby')) return
  if (feld.id && document.querySelector(`label[for="${CSS.escape(feld.id)}"]`)) return
  if (feld.closest('label')) return

  const text = (feld.placeholder || '').trim()
  // Platzhalter, die nichts sagen, helfen auch als Name nicht: "—", "0",
  // "MM:SS" oder ein Beispielwert wie "B-AB 1234".
  if (text.length < 3) return
  feld.setAttribute('aria-label', text)
}

function durchlauf(wurzel: ParentNode = document): void {
  wurzel.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach(verknuepfe)
  wurzel
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[placeholder], textarea[placeholder]')
    .forEach(ausPlatzhalter)
}

/**
 * Startet die Verknüpfung. Wird einmal beim Hochfahren der Anwendung
 * aufgerufen.
 *
 * Der Beobachter läuft gedrosselt: Bei einer Änderung wird ein Durchlauf für
 * den nächsten Leerlauf vorgemerkt, nicht sofort ausgeführt. Sonst liefe er
 * bei jedem Tastendruck in einem Formular mit.
 */
export function starteBeschriftungen(): void {
  if (typeof document === 'undefined') return

  durchlauf()

  let vorgemerkt = false
  const merkeVor = () => {
    if (vorgemerkt) return
    vorgemerkt = true
    const spaeter = () => {
      vorgemerkt = false
      durchlauf()
    }
    if ('requestIdleCallback' in window) {
      ;(window as any).requestIdleCallback(spaeter, { timeout: 500 })
    } else {
      setTimeout(spaeter, 200)
    }
  }

  new MutationObserver((aenderungen) => {
    // Nur wenn wirklich Elemente dazugekommen sind - ein geänderter Textwert
    // bringt keine neue Beschriftung mit.
    for (const aenderung of aenderungen) {
      if (aenderung.addedNodes.length > 0) {
        merkeVor()
        return
      }
    }
  }).observe(document.body, { childList: true, subtree: true })
}
