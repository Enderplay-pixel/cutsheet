import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Film, Users, Briefcase, MapPin, Clapperboard, FileText, Drama } from 'lucide-react'
import { api } from '@/lib/api'
import { useT } from '@/lib/useT'
import { formatDate } from '@/lib/utils'
import { screenplayT, type Lang } from '@/lib/i18n'
import { globalSearchT } from '@/lib/texte/komponenten/Shared'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

const typeIcons: Record<string, any> = {
  scene: Film,
  screenplay: FileText,
  character: Drama,
  cast: Users,
  crew: Briefcase,
  location: MapPin,
  shoot_day: Clapperboard,
}

const BLOCKARTEN: Record<string, Record<Lang, string>> = {
  scene_heading: screenplayT.typeSceneHeading,
  action: screenplayT.typeAction,
  character: screenplayT.typeCharacter,
  dialogue: screenplayT.typeDialogue,
  parenthetical: screenplayT.typeParenthetical,
  transition: screenplayT.typeTransition,
  note: screenplayT.typeNote,
  super: screenplayT.typeSuper,
  intercut: screenplayT.typeIntercut,
  annotation: screenplayT.typeAnnotation,
}

/** Titel und Unterzeile eines Treffers in der gewählten Sprache. */
function beschriften(r: any, tt: (m: Record<Lang, string>) => string): { titel: string; unter: string } {
  const T = globalSearchT
  switch (r.type) {
    case 'character':
      return {
        titel: r.title,
        unter: r.darsteller?.length ? tt(T.gespieltVon).replace('{namen}', r.darsteller.join(', ')) : tt(T.nichtBesetzt),
      }
    case 'cast':
      return { titel: r.title, unter: r.figur ? tt(T.spielt).replace('{figur}', r.figur) : tt(T.darsteller) }
    case 'shoot_day':
      return {
        titel: tt(T.drehtag).replace('{n}', String(r.day_number)).replace('{datum}', formatDate(r.date)),
        unter: tt(r.szenen.length === 1 ? T.drehtagSzene : T.drehtagSzenen)
          .replace('{figuren}', r.figuren.join(', ')).replace('{szenen}', r.szenen.join(', ')),
      }
    case 'scene':
      return {
        titel: tt(T.szene).replace('{n}', r.scene_number).replace('{titel}', r.title),
        unter: r.figur ? tt(T.mitFigur).replace('{figur}', r.figur) : tt(T.szeneArt),
      }
    case 'screenplay':
      return {
        titel: tt(T.szeneText).replace('{n}', r.scene_number).replace('{text}', r.snippet),
        unter: BLOCKARTEN[r.block_type] ? tt(BLOCKARTEN[r.block_type]) : r.block_type,
      }
    default:
      return { titel: r.title, unter: r.subtitle ?? '' }
  }
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
              const Icon = typeIcons[r.type] || Film
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
