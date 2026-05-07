import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Film, Users, Briefcase, MapPin, Clapperboard } from 'lucide-react'
import { api } from '@/lib/api'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

const typeIcons: Record<string, any> = {
  scene: Film,
  cast: Users,
  crew: Briefcase,
  location: MapPin,
  shoot_day: Clapperboard,
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { projectId } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!query.trim() || !projectId) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.search(Number(projectId), query)
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, projectId])

  const handleSelect = (result: any) => {
    navigate(result.url)
    onClose()
  }

  return (
    <CommandDialog open={open} onOpenChange={v => !v && onClose()}>
      <CommandInput placeholder="Szenen, Darsteller, Locations suchen..." value={query} onValueChange={setQuery} />
      <CommandList>
        {loading && <div className="py-6 text-center text-sm text-muted-foreground">Suche läuft...</div>}
        {!loading && query && results.length === 0 && <CommandEmpty>Keine Ergebnisse für „{query}"</CommandEmpty>}
        {results.length > 0 && (
          <CommandGroup heading="Ergebnisse">
            {results.map((r, i) => {
              const Icon = typeIcons[r.type] || Film
              return (
                <CommandItem key={i} onSelect={() => handleSelect(r)} className="flex gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
        {!query && (
          <CommandGroup heading="Schnellzugriff">
            {projectId && [
              { label: 'Drehplan öffnen', url: `/projects/${projectId}/drehplan`, icon: Clapperboard },
              { label: 'Besetzung', url: `/projects/${projectId}/besetzung`, icon: Users },
              { label: 'Budget', url: `/projects/${projectId}/budget`, icon: Film },
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
