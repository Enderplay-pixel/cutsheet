import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatTime, parseTime, cn } from '@/lib/utils'

interface TimeInputProps {
  value: number
  onChange: (v: number) => void
  className?: string
  placeholder?: string
  /** Bei Lesezugriff gesperrt - sonst tippt jemand eine Zeit, die nie ankommt. */
  disabled?: boolean
}

/**
 * Zeiteingabe als HH:MM.
 *
 * Der Wert wird beim Verlassen des Feldes übernommen - während des Tippens
 * wäre "1" oder "16:" noch keine sinnvolle Zeit. Zusätzlich zählt aber die
 * Eingabetaste, und beim Ausblenden der Komponente wird eine offene Änderung
 * nachgereicht: Wer eine Zeit eintippt und danach direkt druckt oder die Seite
 * wechselt, verlöre sie sonst stillschweigend.
 */
export function TimeInput({ value, onChange, className, placeholder = '08:00', disabled }: TimeInputProps) {
  const [str, setStr] = useState(formatTime(value || 0))
  useEffect(() => setStr(formatTime(value || 0)), [value])

  // Aktuellen Stand für die Übernahme beim Ausblenden festhalten - der
  // Aufräum-Effekt sähe sonst nur den Stand vom ersten Rendern.
  const latest = useRef({ str, value, onChange })
  latest.current = { str, value, onChange }

  /** Getippten Text übernehmen; bei Unsinn zurück auf den letzten gültigen Wert. */
  function commit() {
    const parsed = parseTime(latest.current.str)
    if (Number.isNaN(parsed)) {
      setStr(formatTime(latest.current.value || 0))
    } else if (parsed !== latest.current.value) {
      latest.current.onChange(parsed)
    }
  }

  useEffect(() => () => {
    // Offene Eingabe beim Ausblenden nachreichen
    const parsed = parseTime(latest.current.str)
    if (!Number.isNaN(parsed) && parsed !== latest.current.value) {
      latest.current.onChange(parsed)
    }
  }, [])

  return (
    <Input
      value={str}
      onChange={e => setStr(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === 'Escape') setStr(formatTime(latest.current.value || 0))
      }}
      className={cn('font-mono text-center', className)}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}
