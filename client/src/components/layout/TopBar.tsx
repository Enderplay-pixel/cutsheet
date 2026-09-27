import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Moon, Sun, Menu } from 'lucide-react'
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
  const { darkMode, toggleDarkMode, lastSaved, setMobileNav } = useProjectStore()
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
      'flex items-center h-[56px] px-3 md:px-6 border-b border-border bg-background gap-2 md:gap-3 shrink-0',
    )}>
      {/* Navigation aufklappen — ersetzt am Telefon die feste Spalte */}
      <button
        onClick={() => setMobileNav(true)}
        className="md:hidden w-9 h-9 -ml-2 flex items-center justify-center rounded-md hover:bg-foreground/[0.05] text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Navigation öffnen"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb: project › page */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {project && pageTitle && (
            <>
              <button
                onClick={() => navigate(`/projects/${projectId}`)}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150 truncate max-w-[180px] shrink-0"
              >
                {project.title}
              </button>
              <span className="text-muted-foreground/40 shrink-0 text-[13px]" aria-hidden>/</span>
            </>
          )}
          <span className="text-[13.5px] font-medium text-foreground truncate">
            {pageTitle || project?.title || ''}
          </span>
        </div>
        {lastSaved && (
          <p className="font-mono text-[10px] text-muted-foreground/70 leading-none mt-1">
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
            'hidden md:flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-md border text-xs font-medium tabular-nums',
            'transition-[background-color,border-color,color] duration-150 active:scale-[0.98]',
            daysUntilShoot === 0
              ? 'bg-signal text-signal-foreground border-signal'
              : 'bg-card text-foreground border-border hover:border-foreground/25'
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', daysUntilShoot === 0 ? 'bg-signal-foreground animate-pulse' : 'bg-signal')} aria-hidden />
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
        className="hidden sm:flex items-center gap-2 h-8 pl-2.5 pr-1.5 w-56 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-[border-color,color] duration-150 text-xs active:scale-[0.98]"
      >
        <Search className="w-3 h-3 shrink-0" />
        <span className="flex-1 text-left">{tt(topBarT.searchBtn)}</span>
        <kbd>⌘K</kbd>
      </button>

      <button
        onClick={onSearchOpen}
        className="sm:hidden w-8 h-8 flex items-center justify-center rounded-md hover:bg-foreground/[0.05] text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Dark mode */}
      <button
        onClick={toggleDarkMode}
        title={darkMode ? tt(topBarT.lightMode) : tt(topBarT.darkMode)}
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-foreground/[0.05] text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>
    </header>
  )
}
