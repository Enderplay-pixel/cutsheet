import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Moon, Sun, Menu, ChevronRight } from 'lucide-react'
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
      'flex items-center h-[56px] px-3 md:px-6 border-b border-border/60 bg-background/75 backdrop-blur-xl backdrop-saturate-150 gap-2 md:gap-3 shrink-0 relative z-20',
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
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" aria-hidden />
            </>
          )}
          <span className="text-[13.5px] font-semibold text-foreground truncate">
            {pageTitle || project?.title || ''}
          </span>
        </div>
        {lastSaved && (
          <p className="text-[11px] text-muted-foreground/80 leading-none mt-1">
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
            'hidden md:flex items-center gap-2 h-8 pl-3 pr-3.5 rounded-full text-xs font-medium tabular-nums',
            'transition-[background-color,color] duration-150 active:scale-[0.97]',
            daysUntilShoot === 0
              ? 'bg-primary text-primary-foreground'
              : 'bg-signal-soft text-signal hover:brightness-95'
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', daysUntilShoot === 0 ? 'bg-primary-foreground animate-pulse' : 'bg-signal')} aria-hidden />
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
        className="hidden sm:flex items-center gap-2 h-8 pl-2.5 pr-1.5 w-60 rounded-[10px] bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.09] transition-colors duration-150 text-[13px] active:scale-[0.98]"
      >
        <Search className="w-3 h-3 shrink-0" />
        <span className="flex-1 text-left">{tt(topBarT.searchBtn)}</span>
        <kbd>⌘K</kbd>
      </button>

      <button
        onClick={onSearchOpen}
        className="sm:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Dark mode */}
      <button
        onClick={toggleDarkMode}
        title={darkMode ? tt(topBarT.lightMode) : tt(topBarT.darkMode)}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>
    </header>
  )
}
