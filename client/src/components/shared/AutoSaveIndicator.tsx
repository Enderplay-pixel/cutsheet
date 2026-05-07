import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AutoSaveIndicatorProps {
  saving?: boolean
  lastSaved?: Date | null
}

export function AutoSaveIndicator({ saving, lastSaved }: AutoSaveIndicatorProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (lastSaved) {
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [lastSaved])

  if (saving) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Speichern...
      </span>
    )
  }

  return (
    <span className={cn('flex items-center gap-1 text-xs text-green-500 transition-opacity duration-500', visible ? 'opacity-100' : 'opacity-0')}>
      <Check className="w-3 h-3" />
      Gespeichert
    </span>
  )
}
