import * as React from 'react'

/**
 * Text, der nur für Vorleseanwendungen da ist.
 *
 * Nicht `display: none` und nicht `visibility: hidden` - beides nimmt den
 * Text auch aus der Vorlesereihenfolge. Stattdessen ein Bereich von einem
 * Pixel, aus dem Sichtfeld geschoben und ohne Umbruch.
 */
export function NurVorlesen({ children }: { children: React.ReactNode }) {
  return (
    <span
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
      }}
    >
      {children}
    </span>
  )
}
