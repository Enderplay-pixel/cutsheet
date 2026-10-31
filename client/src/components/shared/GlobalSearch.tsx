import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Film, Users, Clapperboard } from 'lucide-react'
import { api } from '@/lib/api'
import { useT } from '@/lib/useT'
import { beschriften, TREFFER_SYMBOL } from '@/lib/suchtreffer'
import { globalSearchT } from '@/lib/texte/komponenten/Shared'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { projectId } = useParams()
  const navigate = useNavigate()
  const tt = useT()

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!query.trim() || !projectId) { setResults([]); return }
    // Eine ältere, langsamere Antwort darf die neuere nicht überschreiben
    let veraltet = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.search(Number(projectId), query)
        if (!veraltet) setResults(data || [])
      } catch {
        if (!veraltet) setResults([])
      } finally {
        if (!veraltet) setLoading(false)
      }
    }, 250)
    return () => { veraltet = true; clearTimeout(timer) }
  }, [query, projectId])

  const handleSelect = (result: any) => {
    navigate(result.url)
    onClose()
  }

  return (
    // Ohne shouldFilter={false} filterte cmdk die Servertreffer ein zweites Mal
    // nach dem sichtbaren Text - gemessen am 27.10.2026: "Pflanze", vier
    // Treffer vom Server, null in der Liste.
    <CommandDialog open={open} onOpenChange={v => !v && onClose()} shouldFilter={false} titel={tt(globalSearchT.titel)}>
      <CommandInput placeholder={tt(globalSearchT.platzhalter)} value={query} onValueChange={setQuery} />
      <CommandList>
        {loading && <div className="py-6 text-center text-sm text-muted-foreground">{tt(globalSearchT.laeuft)}</div>}
        {!loading && query && results.length === 0 && <CommandEmpty>{tt(globalSearchT.keineFuer).replace('{q}', query)}</CommandEmpty>}
        {results.length > 0 && (
          <CommandGroup heading={tt(globalSearchT.ergebnisse)}>
            {results.map((r, i) => {
              const Icon = TREFFER_SYMBOL[r.type] || Film
              const { titel, unter } = beschriften(r, tt)
              return (
                <CommandItem key={i} onSelect={() => handleSelect(r)} className="flex gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{titel}</p>
                    <p className="text-xs text-muted-foreground truncate">{unter}</p>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
        {!query && (
          <CommandGroup heading={tt(globalSearchT.schnellzugriff)}>
            {projectId && [
              { label: tt(globalSearchT.drehplan), url: `/projects/${projectId}/drehplan`, icon: Clapperboard },
              { label: tt(globalSearchT.besetzung), url: `/projects/${projectId}/besetzung`, icon: Users },
              { label: tt(globalSearchT.budget), url: `/projects/${projectId}/budget`, icon: Film },
            ].map((item, i) => (
              <CommandItem key={i} onSelect={() => { navigate(item.url); onClose() }}>
                <item.icon className="w-4 h-4 mr-2" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
