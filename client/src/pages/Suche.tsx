import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Search, Film, FileText, Users, Briefcase, MapPin } from 'lucide-react'

type ResultItem = {
  type: 'scene' | 'screenplay' | 'cast' | 'crew' | 'location'
  id: number
  title: string
  subtitle: string
  url: string
  snippet?: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  scene:      { label: 'Szenen',    icon: Film,     color: 'text-amber-400' },
  screenplay: { label: 'Drehbuch',  icon: FileText,  color: 'text-blue-400' },
  cast:       { label: 'Darsteller', icon: Users,    color: 'text-green-400' },
  crew:       { label: 'Crew',      icon: Briefcase, color: 'text-purple-400' },
  location:   { label: 'Motive',    icon: MapPin,    color: 'text-rose-400' },
}

const GROUP_ORDER = ['scene', 'screenplay', 'cast', 'crew', 'location']

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

function ResultRow({ item, onClick }: { item: ResultItem; onClick: () => void }) {
  const cfg = TYPE_CONFIG[item.type]
  const Icon = cfg?.icon || Search
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left rounded-md"
    >
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cfg?.color || 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.title}</div>
        {item.snippet ? (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.snippet}</div>
        ) : (
          <div className="text-xs text-muted-foreground">{item.subtitle}</div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider shrink-0 mt-0.5">
        {cfg?.label}
      </div>
    </button>
  )
}

function ResultGroup({
  type,
  items,
  onNavigate,
}: {
  type: string
  items: ResultItem[]
  onNavigate: (url: string) => void
}) {
  const cfg = TYPE_CONFIG[type]
  const Icon = cfg?.icon || Search
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-4 py-2 mb-1">
        <Icon className={cn('w-3.5 h-3.5', cfg?.color || 'text-muted-foreground')} />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {cfg?.label || type}
        </span>
        <span className="text-[10px] text-muted-foreground/50 ml-1">({items.length})</span>
      </div>
      <div className="space-y-0.5">
        {items.map(item => (
          <ResultRow
            key={`${item.type}-${item.id}`}
            item={item}
            onClick={() => onNavigate(item.url)}
          />
        ))}
      </div>
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()

  const [inputValue, setInputValue] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedSet = useCallback(
    debounce((val: string) => setDebouncedQ(val), 300),
    []
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    debouncedSet(e.target.value)
  }

  const { data, isFetching } = useQuery({
    queryKey: ['search', pid, debouncedQ],
    queryFn: () => api.search(pid, debouncedQ),
    enabled: debouncedQ.trim().length > 0,
    staleTime: 10000,
  })

  const results: ResultItem[] = data || []

  // Group by type, in fixed order
  const grouped = GROUP_ORDER.reduce<Record<string, ResultItem[]>>((acc, type) => {
    const items = results.filter(r => r.type === type)
    if (items.length > 0) acc[type] = items
    return acc
  }, {})

  const hasResults = results.length > 0
  const isSearching = debouncedQ.trim().length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-7 pt-7 pb-4 border-b border-border/40 shrink-0">
        <h1 className="font-display text-[28px] sm:text-[34px] mb-4">Suche</h1>
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleChange}
            placeholder="Szenen, Darsteller, Crew, Motive…"
            className="pl-9 h-10 text-sm"
            aria-label="Volltext-Suche"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Loading skeleton */}
        {isFetching && (
          <div className="max-w-xl space-y-2 mt-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-4 h-4 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isFetching && !isSearching && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Suchbegriff eingeben…</p>
          </div>
        )}

        {/* No results */}
        {!isFetching && isSearching && !hasResults && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Keine Ergebnisse für &lsquo;{debouncedQ}&rsquo;</p>
          </div>
        )}

        {/* Results grouped */}
        {!isFetching && hasResults && (
          <div className="max-w-xl mt-2">
            {GROUP_ORDER.filter(t => grouped[t]).map(type => (
              <ResultGroup
                key={type}
                type={type}
                items={grouped[type]}
                onNavigate={url => navigate(url)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
