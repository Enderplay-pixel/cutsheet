import * as React from 'react'

/**
 * Text, der nur für Vorleseanwendungen da ist.
 *
 * Nicht `display: none` und nicht `visibility: hidden` - beides nimmt den
 * Text auch aus der Vorlesereihenfolge. Stattdessen ein Bereich von einem
 * Pixel, aus dem Sichtfeld geschoben und ohne Umbruch.
 *
 * Reicht Eigenschaften und Ref weiter: Als `<DialogTitle asChild>` setzt Radix
 * hier die `id`, auf die der Dialog mit `aria-labelledby` zeigt. Vorher fiel
 * sie weg - der Dialog blieb namenlos, trotz Titel.
 */
export const NurVorlesen = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  function NurVorlesen({ style, ...rest }, ref) {
    return (
      <span
        ref={ref}
        {...rest}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
          ...style,
        }}
      />
    )
  }
)
