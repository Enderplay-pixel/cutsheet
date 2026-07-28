import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Moon, Sun, Clapperboard, ChevronRight } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { topBarT } from '@/lib/i18n'
import { differenceInCalendarDays, parseISO } from 'date-fns'

interface TopBarProps {
  onSearchOpen: () => void
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  const { darkMode, toggleDarkMode, lastSaved } = useProjectStore()
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const tt = useT()

  const segments = location.pathname.split('/')
  const lastSegment = segments[segments.length - 1]
  const pageKey = isNaN(Number(lastSegment)) ? lastSegment : ''
  const pageTitleMap = topBarT.pageTitles[pageKey as keyof typeof topBarT.pageTitles]
  const pageTitle = pageTitleMap ? tt(pageTitleMap) : ''

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(Number(projectId)),
    enabled: !!projectId,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', projectId],
    queryFn: () => api.projects.stats(Number(projectId)),
    enabled: !!projectId,
  })

  const daysUntilShoot = stats?.next_shoot_day?.date
    ? differenceInCalendarDays(parseISO(stats.next_shoot_day.date), new Date())
    : null

  return (
    <header className={cn(
      'flex items-center h-[56px] px-5 border-b border-border bg-card/70 backdrop-blur-md gap-4 shrink-0',
    )}>
      {/* Breadcrumb: project › page */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {project && pageTitle && (
            <>
              <button
                onClick={() => navigate(`/projects/${projectId}`)}
                className="text-[13px] text-muted-foreground/70 hover:text-foreground transition-colors duration-150 truncate max-w-[180px] shrink-0"
              >
                {project.title}
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
            </>
          )}
          <h1 className="text-[15px] font-semibold text-foreground truncate tracking-tight">
            {pageTitle || project?.title || ''}
          </h1>
        </div>
        {lastSaved && (
          <p className="text-[11px] text-muted-foreground/50 leading-none mt-0.5">
            {tt(topBarT.saved)} {new Date(lastSaved).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Next shoot day — the one number everyone on a production thinks in */}
      {daysUntilShoot !== null && daysUntilShoot >= 0 && (
        <button
          onClick={() => navigate(`/projects/${projectId}/tagesdispo`)}
          title={`Drehtag ${stats.next_shoot_day.day_number} öffnen`}
          className={cn(
            'hidden md:flex items-center gap-2 h-8 px-3 rounded-full border text-xs font-semibold tabular-nums',
            'transition-[background-color,border-color,color] duration-150 active:scale-[0.97]',
            daysUntilShoot === 0
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-primary/8 text-primary border-primary/25 hover:bg-primary/15 hover:border-primary/40'
          )}
        >
          <Clapperboard className="w-3 h-3 shrink-0" />
          {daysUntilShoot === 0
            ? `Drehtag ${stats.next_shoot_day.day_number} — HEUTE`
            : daysUntilShoot === 1
              ? `Drehtag ${stats.next_shoot_day.day_number} — morgen`
              : `Drehtag ${stats.next_shoot_day.day_number} in ${daysUntilShoot} Tagen`}
        </button>
      )}

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border/80 transition-[background-color,border-color,color] duration-150 text-xs active:scale-[0.97]"
      >
        <Search className="w-3 h-3 shrink-0" />
        <span>{tt(topBarT.searchBtn)}</span>
        <kbd className="text-[10px] bg-background/70 px-1.5 py-0.5 rounded font-mono ml-1 text-muted-foreground/60 border border-border/60">⌘K</kbd>
      </button>

      <button
        onClick={onSearchOpen}
        className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Dark mode */}
      <button
        onClick={toggleDarkMode}
        title={darkMode ? tt(topBarT.lightMode) : tt(topBarT.darkMode)}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>
    </header>
  )
}
