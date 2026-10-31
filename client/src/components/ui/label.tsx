import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const labelVariants = cva('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70')

/** Fortlaufende Nummer für erzeugte Kennungen. */
let zaehler = 0

/**
 * Verknüpft die Beschriftung mit dem Feld daneben - auch ohne `htmlFor`.
 *
 * In dieser Anwendung steht fast überall dasselbe Muster:
 *
 *   <div>
 *     <Label>Name</Label>
 *     <Input value={…} />
 *   </div>
 *
 * Ohne `htmlFor` ist das für eine Vorleseanwendung ein Feld **ohne Namen**,
 * und ein Klick auf die Beschriftung setzt den Schreibzeiger nicht ins Feld.
 * Gemessen am 11.10.2026: 237 Eingabefelder, davon 20 mit Kennung - 217
 * Felder ohne Namen.
 *
 * Statt 217 Stellen von Hand nachzuziehen (und bei der nächsten neuen Zeile
 * wieder daran denken zu müssen), sucht die Beschriftung sich ihr Feld
 * selbst: zuerst im nächsten Element, sonst das erste noch unbeschriftete
 * Feld im selben Elternelement. Wer `htmlFor` ausdrücklich setzt, behält die
 * Oberhand - dann rührt sich hier nichts.
 *
 * Vorher galt nur "erstes Feld im Elternelement": Stehen zwei Paare im selben
 * Container (zweispaltige Zeile), zeigten beide Beschriftungen auf das erste
 * Feld - gemessen am 31.10.2026, "Nachname" las "Vorname" vor.
 *
 * Geändert werden ausschließlich Zugänglichkeitsattribute, nie Werte oder
 * Verhalten.
 */
const FELD = 'input, textarea, select, [role="combobox"], [role="textbox"]'

function verknuepfe(beschriftung: HTMLLabelElement | null) {
  if (!beschriftung || beschriftung.getAttribute('for')) return

  const nachbar = beschriftung.nextElementSibling
  let feld: HTMLElement | null = nachbar
    ? (nachbar.matches(FELD) ? nachbar as HTMLElement : nachbar.querySelector<HTMLElement>(FELD))
    : null
  if (!feld) {
    const felder = beschriftung.parentElement?.querySelectorAll<HTMLElement>(FELD) ?? []
    feld = [...felder].find(f => !f.id || !document.querySelector(`label[for="${CSS.escape(f.id)}"]`)) ?? null
  }
  if (!feld) return

  if (!feld.id) feld.id = `feld-${++zaehler}`
  beschriftung.setAttribute('for', feld.id)
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => {
  const eigener = React.useRef<HTMLLabelElement | null>(null)

  // Nach jedem Anzeigen prüfen: Felder können später dazukommen, etwa wenn
  // ein Abschnitt aufklappt.
  React.useEffect(() => {
    verknuepfe(eigener.current)
  })

  return (
    <LabelPrimitive.Root
      ref={(element) => {
        eigener.current = element as HTMLLabelElement | null
        if (typeof ref === 'function') ref(element)
        else if (ref) (ref as React.MutableRefObject<unknown>).current = element
      }}
      className={cn(labelVariants(), className)}
      {...props}
    />
  )
})
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
