import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Moon, Sun, Menu, ChevronRight, Rows3, HelpCircle } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/useT'
import { topBarT } from '@/lib/i18n'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { toggleThemeWithReveal } from '@/lib/motion'
import { topBarTexteT, topBarDrehtagT, topBarExtraTitelT } from '@/lib/texte/komponenten/Layout'
import { useSeitenAnordnung } from '@/lib/seitenAnordnung'
import { arbeitsplatzT } from '@/lib/texte/Arbeitsplatz'
import { useEinfuehrungHier, useEinfuehrungStore } from '@/lib/einfuehrung'
import { einfuehrungT } from '@/lib/texte/Einfuehrung'

// Strg+K und ⌘K öffnen beide die Suche; angezeigt wird, was auf der Tastatur steht
const IST_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

interface TopBarProps {
  onSearchOpen: () => void
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  const { darkMode, toggleDarkMode, setMobileNav } = useProjectStore()
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const tt = useT()
  // Seiten mit anordenbaren Abschnitten melden sich an (SeitenBloecke)
  const { seite: anordenbar, anordnen, setAnordnen } = useSeitenAnordnung()
  const einfuehrung = useEinfuehrungHier()
  const starteEinfuehrung = useEinfuehrungStore(s => s.starten)

  const pageTitle = resolvePageTitle(location.pathname, tt)

  const { data: project } = useQuery({
    queryKey: ['project', Number(projectId)],
    queryFn: () => api.projects.get(Number(projectId)),
    enabled: !!projectId,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', Number(projectId)],
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
      {/* Navigation aufklappen - ersetzt am Telefon die feste Spalte */}
      <button
        onClick={() => setMobileNav(true)}
        className="md:hidden w-9 h-9 -ml-2 flex items-center justify-center rounded-md hover:bg-foreground/[0.05] text-muted-foreground hover:text-foreground shrink-0"
        aria-label={tt(topBarTexteT.navigationOeffnen)}
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
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150 truncate max-w-[180px] min-w-[2.5rem]"
              >
                {project.title}
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" aria-hidden />
            </>
          )}
          <span className="text-[13.5px] font-semibold text-foreground truncate shrink-0 max-w-[65%]">
            {pageTitle || project?.title || ''}
          </span>
        </div>
      </div>

      {/* Next shoot day - the one number everyone on a production thinks in */}
      {daysUntilShoot !== null && daysUntilShoot >= 0 && (
        <button
          // Direkt in die Dispo dieses Tages - ohne Kennung zeigte die Seite Tag 1
          onClick={() => navigate(`/projects/${projectId}/tagesdispo/${stats.next_shoot_day.id}`)}
          title={tt(topBarDrehtagT.oeffnen).replace('{n}', String(stats.next_shoot_day.day_number))}
          className={cn(
            'hidden md:flex items-center gap-2 h-8 pl-3 pr-3.5 rounded-full text-xs font-medium tabular-nums',
            'transition-[background-color,color] duration-150 active:scale-[0.97]',
            daysUntilShoot === 0
              ? 'bg-primary text-primary-foreground'
              : 'bg-signal-soft text-signal hover:brightness-95'
          )}
        >
          <span className={cn('pulse-dot w-1.5 h-1.5 rounded-full shrink-0', daysUntilShoot === 0 ? 'bg-primary-foreground' : 'bg-signal')} aria-hidden />
          {daysUntilShoot === 0
            ? tt(topBarDrehtagT.heute).replace('{n}', String(stats.next_shoot_day.day_number))
            : daysUntilShoot === 1
              ? tt(topBarDrehtagT.morgen).replace('{n}', String(stats.next_shoot_day.day_number))
              : tt(topBarDrehtagT.inTagen).replace('{n}', String(stats.next_shoot_day.day_number)).replace('{d}', String(daysUntilShoot))}
        </button>
      )}

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        className="hidden sm:flex items-center gap-2 h-8 pl-2.5 pr-1.5 w-60 rounded-[10px] bg-foreground/[0.06] text-muted-foreground hover:bg-foreground/[0.09] transition-colors duration-150 text-[13px] active:scale-[0.98]"
      >
        <Search className="w-3 h-3 shrink-0" />
        <span className="flex-1 text-left">{tt(topBarT.searchBtn)}</span>
        <kbd>{IST_MAC ? '⌘K' : tt(topBarTexteT.strgK)}</kbd>
      </button>

      <button
        onClick={onSearchOpen}
        aria-label={tt(topBarT.searchBtn)}
        title={tt(topBarT.searchBtn)}
        className="sm:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        <Search className="w-4 h-4" />
      </button>

      {einfuehrung && (
        <button
          onClick={() => starteEinfuehrung(einfuehrung.schluessel)}
          aria-label={tt(einfuehrungT.starten)}
          title={tt(einfuehrungT.starten)}
          data-einfuehrung="hilfe"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}

      {anordenbar && (
        <button
          onClick={() => setAnordnen(!anordnen)}
          aria-pressed={anordnen}
          aria-label={tt(arbeitsplatzT.seiteSchalter)}
          data-einfuehrung="anordnen"
          title={tt(arbeitsplatzT.seiteSchalter)}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-full transition-[background-color,color] duration-150 active:scale-[0.97]',
            anordnen ? 'bg-primary/15 text-primary' : 'hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground'
          )}
        >
          <Rows3 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dark mode */}
      <button
        onClick={e => toggleThemeWithReveal(toggleDarkMode, { x: e.clientX, y: e.clientY })}
        title={darkMode ? tt(topBarT.lightMode) : tt(topBarT.darkMode)}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 active:scale-[0.97]"
      >
        {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>
    </header>
  )
}

// Seiten ohne Eintrag in topBarT.pageTitles - sonst stünde in der Kopfzeile
// nur der Projektname
const EXTRA_TITLES = topBarExtraTitelT

/**
 * Seitentitel aus dem Pfad: der hinterste Abschnitt, der keine ID ist.
 * /projects/1/tagesdispo/5 → Tagesdispo, /projects/2/creator/3 → Videos.
 */
function resolvePageTitle(pathname: string, tt: (m: any) => string): string {
  const segments = pathname.split('/').filter(Boolean)
  const inProject = segments[0] === 'projects'
  const rest = inProject ? segments.slice(2) : segments
  for (let i = rest.length - 1; i >= 0; i--) {
    const seg = rest[i]
    if (!isNaN(Number(seg))) continue
    const known = topBarT.pageTitles[seg as keyof typeof topBarT.pageTitles]
    if (known) return tt(known)
    if (EXTRA_TITLES[seg]) return tt(EXTRA_TITLES[seg])
  }
  // Projekt-Startseite
  return inProject && rest.length === 0 ? tt(topBarT.pageTitles['' as keyof typeof topBarT.pageTitles]) : ''
}
