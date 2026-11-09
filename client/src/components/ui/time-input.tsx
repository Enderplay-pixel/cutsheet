import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { useT } from '@/lib/useT'
import type { Lang } from '@/lib/i18n'
import { formatTime, parseTime, cn } from '@/lib/utils'

const T: Record<'keineZeit' | 'gueltig', Record<Lang, string>> = {
  keineZeit: { de: '„{x}“ ist keine Uhrzeit', en: '“{x}” is not a time', fr: '« {x} » n’est pas une heure' },
  gueltig: {
    de: 'Gültig sind 00:00 bis 23:59. Die vorige Zeit bleibt stehen.',
    en: 'Valid times are 00:00 to 23:59. The previous time stays.',
    fr: 'Les heures valides vont de 00:00 à 23:59. L’heure précédente est conservée.',
  },
}

interface TimeInputProps {
  value: number
  onChange: (v: number) => void
  className?: string
  placeholder?: string
  /** Bei Lesezugriff gesperrt - sonst tippt jemand eine Zeit, die nie ankommt. */
  disabled?: boolean
  /**
   * Wofür die Zeit gilt - "Crew Call", "Drehbeginn", "Call von Sarah Müller".
   *
   * Zeitfelder stehen in Tabellen und Rastern, wo keine Beschriftung daneben
   * passt. Ohne diesen Namen sagt eine Vorleseanwendung nur "Eingabefeld,
   * 08:00" und lässt offen, welche Zeit gemeint ist.
   */
  label?: string
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
export function TimeInput({ value, onChange, className, placeholder = '08:00', disabled, label }: TimeInputProps) {
  const [str, setStr] = useState(formatTime(value || 0))
  const { toast } = useToast()
  const tt = useT()
  useEffect(() => setStr(formatTime(value || 0)), [value])

  // Aktuellen Stand für die Übernahme beim Ausblenden festhalten - der
  // Aufräum-Effekt sähe sonst nur den Stand vom ersten Rendern.
  const latest = useRef({ str, value, onChange })
  latest.current = { str, value, onChange }

  /**
   * Getippten Text übernehmen; bei Unsinn zurück auf den letzten gültigen Wert
   * - und sagen, dass die Eingabe verworfen wurde. Vorher sprang "25:99" still
   * zurück (Testbericht SALZWIND, 09.11.2026).
   */
  function commit() {
    const parsed = parseTime(latest.current.str)
    if (Number.isNaN(parsed)) {
      const getippt = latest.current.str.trim()
      setStr(formatTime(latest.current.value || 0))
      if (getippt) toast({ variant: 'destructive', title: tt(T.keineZeit).replace('{x}', getippt), description: tt(T.gueltig) })
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
      aria-label={label}
    />
  )
}
