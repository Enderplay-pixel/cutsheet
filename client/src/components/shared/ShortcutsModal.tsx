import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

const SHORTCUTS = [
  { category: 'Navigation', items: [
    { keys: ['D'], label: 'Drehplan öffnen' },
    { keys: ['S'], label: 'Szenen öffnen' },
    { keys: ['B'], label: 'Besetzung öffnen' },
    { keys: ['T'], label: 'Tagesdispo öffnen' },
  ]},
  { category: 'Global', items: [
    { keys: ['Ctrl', 'K'], label: 'Suche öffnen' },
    { keys: ['?'], label: 'Shortcuts anzeigen' },
    { keys: ['Esc'], label: 'Dialog schließen' },
  ]},
]

function Key({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-[11px] font-mono font-semibold rounded border border-border bg-muted text-muted-foreground shadow-sm">
      {k}
    </kbd>
  )
}

export function ShortcutsModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key === '?') setOpen(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="w-4 h-4" /> Tastaturkürzel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-1">
          {SHORTCUTS.map(group => (
            <div key={group.category}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2.5">
                {group.category}
              </p>
              <div className="space-y-2">
                {group.items.map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <span key={k} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground/40 text-xs">+</span>}
                          <Key k={k} />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/50 pt-1">
          Shortcuts funktionieren nicht in Eingabefeldern.
        </p>
      </DialogContent>
    </Dialog>
  )
}
