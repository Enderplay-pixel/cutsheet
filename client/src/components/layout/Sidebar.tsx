import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/useProjectStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import {
  Film, LayoutDashboard, FileText, Users, Briefcase, MapPin, Calendar,
  Camera, ClipboardList, FileCheck, DollarSign, Package, Mail, AlertTriangle,
  Clapperboard, PanelLeftClose, PanelLeftOpen, ChevronRight,
  StickyNote, Car, History, Search, FileEdit, LogOut, ShieldCheck, BookUser, Settings,
  Layers, CalendarClock, Music, Shield, CheckSquare, Clock, UtensilsCrossed, Image, TableProperties,
  MessageSquare, Activity, Video, CalendarOff, Wallet, LayoutGrid,
  Type, Scissors, ListChecks, TrendingUp, Megaphone
} from 'lucide-react'
import { FeedbackWidget } from '@/components/shared/FeedbackWidget'
import { BrandMark } from '@/components/shared/BrandMark'
import { useT } from '@/lib/useT'
import { navT } from '@/lib/i18n'
import { isCreatorProject } from '@/lib/projectKind'

type NavItemDef = {
  label: string
  icon: any
  path: string
  badge?: number
}

type NavGroupDef = {
  label: string
  items: NavItemDef[]
}

const OPEN_GROUPS_KEY = 'cutsheet-nav-open-groups'

function loadOpenGroups(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function Sidebar() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav } = useProjectStore()
  const { user } = useAuth()
  const tt = useT()

  const ADMIN_ITEMS = [
    { label: tt(navT.userMgmt), icon: ShieldCheck, path: '/admin' },
    { label: 'Admin-Statistiken', icon: Activity, path: '/admin/stats' },
  ]

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(Number(projectId)),
    enabled: !!projectId,
  })

  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', projectId],
    queryFn: () => api.conflicts(Number(projectId)),
    enabled: !!projectId,
    refetchInterval: 60_000,
  })
  const conflictCount = (conflicts || []).filter((c: any) => c.severity === 'error' || c.severity === 'warning').length

  const isCreator = isCreatorProject(project)

  // Creator hat eigene Bereiche, nicht umbenannte Filmseiten. Die Daten dafuer
  // lagen laengst in creator_videos - Serie, Zielbegriff, Titelvarianten,
  // Sponsorenfelder, Haltequote - nur sichtbar war das alles ausschliesslich
  // innerhalb eines einzelnen Videos. Ein Kanal wird aber quer ueber alle
  // Videos gefuehrt.
  const creatorGroups: NavGroupDef[] = [
    {
      label: 'Übersicht',
      items: [
        { label: tt(navT.dashboard), icon: LayoutDashboard, path: '' },
        { label: tt(navT.masterData), icon: Film, path: 'stammdaten' },
        { label: 'Aufgaben', icon: CheckSquare, path: 'aufgaben' },
      ]
    },
    {
      label: 'Kanal & Planung',
      items: [
        { label: 'Kanal', icon: Activity, path: 'creator/kanal' },
        { label: 'Ideen', icon: StickyNote, path: 'creator/ideen' },
        { label: 'Redaktionsplan', icon: CalendarClock, path: 'creator/redaktionsplan' },
        { label: 'Serien & Formate', icon: Layers, path: 'creator/serien' },
        { label: tt(navT.calendar), icon: Calendar, path: 'kalender' },
      ]
    },
    {
      label: 'Videos',
      items: [
        { label: 'Videos', icon: Video, path: 'creator' },
        { label: 'Titel & Thumbnails', icon: Type, path: 'creator/titel' },
        { label: 'Moodboard', icon: Image, path: 'moodboard' },
        { label: 'Kommentare', icon: MessageSquare, path: 'kommentare' },
      ]
    },
    {
      label: 'Produktion',
      items: [
        { label: tt(navT.shotlist), icon: Camera, path: 'shotlist' },
        { label: 'Drehorte', icon: MapPin, path: 'motive' },
        { label: 'Gäste & Mitwirkende', icon: Users, path: 'besetzung' },
        { label: 'Team', icon: Briefcase, path: 'stabliste' },
        { label: tt(navT.equipment), icon: Package, path: 'equipment' },
        { label: 'Equipment-Kalender', icon: CalendarClock, path: 'equipment-kalender' },
        { label: 'Set-Ansicht', icon: Clapperboard, path: '/set' },
      ]
    },
    {
      label: 'Schnitt & Rechte',
      items: [
        { label: 'Postproduktion', icon: Layers, path: 'postplan' },
        { label: 'Auskopplungen', icon: Scissors, path: 'creator/clips' },
        { label: 'Zeitanalyse', icon: TableProperties, path: 'zeitanalyse' },
        { label: 'Rechte & Lizenzen', icon: ShieldCheck, path: 'creator/rechte' },
        { label: 'Musikliste', icon: Music, path: 'musikliste' },
      ]
    },
    {
      label: 'Veröffentlichung',
      items: [
        { label: 'Upload-Checklisten', icon: ListChecks, path: 'creator/checklisten' },
        { label: 'SEO & Metadaten', icon: Search, path: 'creator/seo' },
        { label: 'Video-Performance', icon: TrendingUp, path: 'creator/performance' },
      ]
    },
    {
      label: 'Geld',
      items: [
        { label: 'Sponsoren', icon: Megaphone, path: 'creator/sponsoren' },
        { label: tt(navT.budget), icon: DollarSign, path: 'budget' },
        { label: 'Kostenstand', icon: Wallet, path: 'kostenstand' },
      ]
    },
    {
      label: 'Tools & Kommunikation',
      items: [
        { label: tt(navT.email), icon: Mail, path: 'email' },
        { label: tt(navT.contacts), icon: BookUser, path: 'kontakte' },
        { label: tt(navT.pinboard), icon: StickyNote, path: 'pinboard' },
        { label: 'Aktivitäts-Feed', icon: Activity, path: 'aktivitaet' },
        { label: tt(navT.search), icon: Search, path: 'suche' },
        { label: tt(navT.auditLog), icon: History, path: 'audit' },
      ]
    },
  ]

  const filmGroups: NavGroupDef[] = [
    {
      // First thing you do: create the project and break down the script
      label: 'Übersicht',
      items: [
        { label: tt(navT.dashboard), icon: LayoutDashboard, path: '' },
        { label: tt(navT.masterData), icon: Film, path: 'stammdaten' },
        { label: 'Aufgaben', icon: CheckSquare, path: 'aufgaben' },
      ]
    },
    {
      // Concept & creative development phase
      label: 'Entwicklung',
      items: [
        { label: tt(navT.scenes), icon: FileText, path: 'drehbuch' },
        { label: tt(navT.scriptEditor), icon: FileEdit, path: 'screenplay-editor' },
        { label: 'Moodboard', icon: Image, path: 'moodboard' },
        { label: 'Szenen-Kommentare', icon: MessageSquare, path: 'kommentare' },
      ]
    },
    {
      // Build your team
      label: 'Casting & Team',
      items: [
        { label: tt(navT.casting), icon: Users, path: 'besetzung' },
        { label: 'Sperrtage Cast', icon: CalendarOff, path: 'sperrtage' },
        { label: tt(navT.extras), icon: Users, path: 'komparsen' },
        { label: tt(navT.crew), icon: Briefcase, path: 'stabliste' },
        { label: tt(navT.contacts), icon: BookUser, path: 'kontakte' },
      ]
    },
    {
      // Pre-production planning: schedule, locations, resources, budget
      label: 'Planung & Vorbereitung',
      items: [
        { label: tt(navT.locations), icon: MapPin, path: 'motive' },
        { label: tt(navT.shootingPlan), icon: Clapperboard, path: 'drehplan' },
        { label: tt(navT.stripboard), icon: LayoutDashboard, path: 'staebchenplan' },
        { label: tt(navT.calendar), icon: Calendar, path: 'kalender' },
        { label: tt(navT.conflicts), icon: AlertTriangle, path: 'konfliktradar', badge: conflictCount > 0 ? conflictCount : undefined },
        { label: tt(navT.equipment), icon: Package, path: 'equipment' },
        { label: 'Equipment-Kalender', icon: CalendarClock, path: 'equipment-kalender' },
        { label: tt(navT.vehicles), icon: Car, path: 'fahrzeuge' },
        { label: 'Catering', icon: UtensilsCrossed, path: 'catering' },
        { label: tt(navT.budget), icon: DollarSign, path: 'budget' },
        { label: 'Kostenstand', icon: Wallet, path: 'kostenstand' },
        { label: 'Versicherungen', icon: Shield, path: 'versicherungen' },
      ]
    },
    {
      // Day-to-day on set
      label: 'Dreharbeiten',
      items: [
        { label: tt(navT.callSheet), icon: ClipboardList, path: 'tagesdispo' },
        { label: 'Check-in Board', icon: CheckSquare, path: 'checkin' },
        { label: tt(navT.shotlist), icon: Camera, path: 'shotlist' },
        { label: 'Set-Plan', icon: LayoutGrid, path: 'setplan' },
        { label: 'VFX-Tracking', icon: Layers, path: 'vfx' },
        { label: 'Continuity', icon: Image, path: 'continuity' },
        { label: 'Kameraberichte', icon: Video, path: 'kameraberichte' },
        { label: tt(navT.dailyReport), icon: FileCheck, path: 'tagesbericht' },
        { label: 'Zeitanalyse', icon: TableProperties, path: 'zeitanalyse' },
        { label: 'Timesheets', icon: Clock, path: 'timesheets' },
        // Eigene Ansicht fuers Telefon am Set, ausserhalb des Projektlayouts.
        // Absoluter Pfad, deshalb der Sonderfall beim Linkbau weiter unten.
        { label: 'Set-Ansicht', icon: Clapperboard, path: '/set' },
      ]
    },
    {
      // After wrap
      label: 'Post-Produktion',
      items: [
        { label: 'DOOD-Report', icon: TableProperties, path: 'dood' },
        { label: 'Postplan', icon: CalendarClock, path: 'postplan' },
        { label: 'Musikliste', icon: Music, path: 'musikliste' },
      ]
    },
    {
      // Communication & tools used throughout
      label: 'Tools & Kommunikation',
      items: [
        { label: tt(navT.email), icon: Mail, path: 'email' },
        { label: tt(navT.pinboard), icon: StickyNote, path: 'pinboard' },
        { label: 'Aktivitäts-Feed', icon: Activity, path: 'aktivitaet' },
        { label: tt(navT.search), icon: Search, path: 'suche' },
        { label: tt(navT.auditLog), icon: History, path: 'audit' },
      ]
    },
  ]

  const navGroups = isCreator ? creatorGroups : filmGroups

  // Which group contains the currently active route?
  const activeSegment = useMemo(() => {
    if (!projectId) return null
    const rest = location.pathname.split(`/projects/${projectId}`)[1] || ''
    return rest.split('/').filter(Boolean)[0] ?? ''
  }, [location.pathname, projectId])

  const activeGroupLabel = useMemo(() => {
    if (activeSegment === null) return null
    const group = navGroups.find(g => g.items.some(i => i.path === activeSegment))
    return group?.label ?? null
    // navGroups is rebuilt each render but its structure is static
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegment, conflictCount])

  // Open/closed state per group — persisted, default: open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups)

  const setGroupOpen = (label: string, open: boolean) => {
    setOpenGroups(prev => {
      const next = { ...prev, [label]: open }
      try { localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }

  // The group of the active page never stays collapsed — you should
  // always see where you are.
  useEffect(() => {
    if (activeGroupLabel && openGroups[activeGroupLabel] === false) {
      setGroupOpen(activeGroupLabel, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupLabel])

  // Nach der Auswahl schliessen, sonst verdeckt die Schublade genau die Seite,
  // die man gerade angetippt hat
  useEffect(() => { setMobileNav(false) }, [location.pathname, setMobileNav])

  const pid = projectId

  return (
    <>
      {/* Hintergrund, solange die Schublade offen ist — nur am Telefon */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileNav(false)}
          aria-hidden
        />
      )}

    <aside className={cn(
      // h-dvh statt h-screen: 100vh rechnet auf iOS die Browserleiste mit,
      // dadurch wird das untere Ende der Schublade abgeschnitten.
      'flex flex-col h-dvh bg-canvas border-r border-border sidebar-transition relative',
      // Ab md wie bisher eine feste Spalte im Fluss
      'md:shrink-0 md:translate-x-0 md:static md:z-auto',
      // Darunter eine Schublade ueber dem Inhalt: 220 px fester Abzug waeren
      // auf einem 375-px-Display mehr als die Haelfte des Bildschirms
      'fixed inset-y-0 left-0 z-50 w-[248px]',
      mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
      sidebarCollapsed ? 'md:w-[56px]' : 'md:w-[232px]'
    )}>
      {/* Logo / Brand */}
      <button
        type="button"
        className={cn(
          'flex items-center h-[56px] border-b border-border gap-2.5 shrink-0 select-none text-left',
          'transition-colors duration-150 hover:bg-foreground/[0.03]',
          sidebarCollapsed ? 'md:justify-center md:px-0 px-4' : 'px-4'
        )}
        onClick={() => navigate('/')}
        aria-label="Zur Projektübersicht"
      >
        <BrandMark className="w-[22px] h-[22px] shrink-0 text-foreground" />
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <span className="font-display text-[21px] leading-none block">CutSheet</span>
            {project && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground truncate block mt-1">{project.title}</span>
            )}
          </div>
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Hauptnavigation" role="navigation">
        {pid ? (
          navGroups.map((group) => (
            <NavGroup
              key={group.label}
              group={group}
              pid={pid}
              collapsed={sidebarCollapsed}
              open={openGroups[group.label] !== false}
              isActiveGroup={group.label === activeGroupLabel}
              onToggle={() => setGroupOpen(group.label, openGroups[group.label] === false)}
            />
          ))
        ) : (
          <div className="px-3 py-6 text-center">
            {!sidebarCollapsed && (
              <div>
                <p className="font-display text-lg italic text-muted-foreground">{tt(navT.noProject)}</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-2 text-xs text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground transition-colors flex items-center gap-1 mx-auto"
                >
                  {tt(navT.chooseProject)} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Admin section */}
        {user?.role === 'admin' && (
          <div className="mb-1 mt-1">
            {!sidebarCollapsed && (
              <div className="px-2 pb-1 pt-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">{tt(navT.admin)}</span>
              </div>
            )}
            {sidebarCollapsed && <div className="my-2 mx-2 h-px bg-border" />}
            {ADMIN_ITEMS.map(item => (
              <NavItem key={item.path} item={item} to={item.path} collapsed={sidebarCollapsed} />
            ))}
          </div>
        )}
      </nav>

      {/* User menu + Collapse toggle */}
      <div className="border-t border-border shrink-0">
        <FeedbackWidget collapsed={sidebarCollapsed} />
        <UserMenu collapsed={sidebarCollapsed} />
        <div className="px-2 pb-2 hidden md:block">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center h-8 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.05] transition-[background-color,color,transform] duration-150 active:scale-[0.92]"
            title={sidebarCollapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
            aria-label={sidebarCollapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen className="w-3.5 h-3.5" />
              : <PanelLeftClose className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>
    </aside>
    </>
  )
}

function NavGroup({ group, pid, collapsed, open, isActiveGroup, onToggle }: {
  group: NavGroupDef
  pid: string
  collapsed: boolean
  open: boolean
  isActiveGroup: boolean
  onToggle: () => void
}) {
  // Collapsed rail: no group headers, just a thin separator
  if (collapsed) {
    return (
      <div className="mb-1">
        {group.label !== 'Übersicht' && <div className="my-2 mx-2 h-px bg-border" />}
        {group.items.map(item => (
          <NavItem
            key={item.path}
            item={item}
            to={item.path === '' ? `/projects/${pid}`
              : item.path.startsWith('/') ? item.path
              : `/projects/${pid}/${item.path}`}
            end={item.path === ''}
            collapsed
          />
        ))}
      </div>
    )
  }

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center gap-1.5 px-2.5 pb-1.5 pt-4 group/header rounded-md',
          'transition-colors duration-150'
        )}
      >
        <span className={cn(
          'font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 text-left',
          isActiveGroup ? 'text-foreground/80' : 'text-muted-foreground/70 group-hover/header:text-foreground/80'
        )}>
          {group.label}
        </span>
        <ChevronRight className={cn(
          'w-2.5 h-2.5 text-muted-foreground/40 transition-transform duration-200',
          open && 'rotate-90'
        )} style={{ transitionTimingFunction: 'var(--ease-out)' }} />
        {/* Collapsed group with active page inside still hints at it */}
        {!open && isActiveGroup && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
        )}
      </button>
      {/* Grid-rows trick: smooth height collapse with pure CSS transitions */}
      <div
        className="grid"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 220ms var(--ease-out)',
        }}
      >
        <div className="overflow-hidden min-h-0">
          {group.items.map(item => (
            <NavItem
              key={item.path}
              item={item}
              to={item.path === '' ? `/projects/${pid}`
              : item.path.startsWith('/') ? item.path
              : `/projects/${pid}/${item.path}`}
              end={item.path === ''}
              collapsed={false}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function NavItem({ item, to, end, collapsed }: {
  item: NavItemDef
  to: string
  end?: boolean
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) => cn(
        'flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] group relative',
        'transition-[background-color,color,box-shadow,transform] duration-150',
        'active:scale-[0.98]',
        collapsed && 'md:justify-center md:px-0',
        isActive
          ? 'bg-card text-foreground font-medium shadow-[0_0_0_1px_hsl(var(--border)),0_1px_2px_hsl(var(--shadow)/0.06)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]'
      )}
    >
      {({ isActive }) => (
        <>
          <item.icon className={cn(
            'shrink-0 transition-[color,transform] duration-150',
            collapsed ? 'w-[15px] h-[15px]' : 'w-[14px] h-[14px]',
            isActive ? 'text-foreground' : 'text-muted-foreground/80 group-hover:text-foreground'
          )} />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge != null && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-sm bg-warning/12 text-warning font-mono text-[10px] flex items-center justify-center tabular-nums">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const tt = useT()
  if (!user) return null
  const roleLabel: Record<string, string> = {
    admin: tt(navT.roles.admin),
    producer: tt(navT.roles.producer),
    director: tt(navT.roles.director),
    dept_head: tt(navT.roles.dept_head),
    read_only: tt(navT.roles.read_only),
  }
  return (
    <div className="px-3 py-2.5 flex items-center gap-2.5">
      <div className="shrink-0 w-7 h-7 rounded-[9px] bg-foreground text-background flex items-center justify-center font-mono text-[10.5px] font-medium tracking-tight" aria-hidden>
        {initials(user.name || user.email)}
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate leading-tight">{user.name || user.email}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground truncate mt-0.5">{roleLabel[user.role] ?? user.role}</p>
        </div>
      )}
      <button
        onClick={() => navigate('/settings')}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.05] transition-[background-color,color,transform] duration-150 active:scale-[0.88]"
        title={tt(navT.settings)}
        aria-label={tt(navT.settings)}
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => { logout(); navigate('/login') }}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-[background-color,color,transform] duration-150 active:scale-[0.88]"
        title={tt(navT.logout)}
        aria-label={tt(navT.logout)}
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·'
}
