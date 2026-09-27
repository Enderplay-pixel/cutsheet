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
  StickyNote, Car, History, Search, FileEdit, LogOut, UserCircle, ShieldCheck, BookUser, Settings,
  Layers, CalendarClock, Music, Shield, CheckSquare, Clock, UtensilsCrossed, Image, TableProperties,
  MessageSquare, Activity, Video, CalendarOff, Wallet, LayoutGrid,
  Type, Scissors, ListChecks, TrendingUp, Megaphone
} from 'lucide-react'
import { FeedbackWidget } from '@/components/shared/FeedbackWidget'
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
    { label: tt(navT.adminStats), icon: Activity, path: '/admin/stats' },
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
      label: tt(navT.overview),
      items: [
        { label: tt(navT.dashboard), icon: LayoutDashboard, path: '' },
        { label: tt(navT.masterData), icon: Film, path: 'stammdaten' },
        { label: tt(navT.tasks), icon: CheckSquare, path: 'aufgaben' },
      ]
    },
    {
      label: tt(navT.channelPlanning),
      items: [
        { label: tt(navT.channel), icon: Activity, path: 'creator/kanal' },
        { label: tt(navT.ideas), icon: StickyNote, path: 'creator/ideen' },
        { label: tt(navT.editorialPlan), icon: CalendarClock, path: 'creator/redaktionsplan' },
        { label: tt(navT.seriesFormats), icon: Layers, path: 'creator/serien' },
        { label: tt(navT.calendar), icon: Calendar, path: 'kalender' },
      ]
    },
    {
      label: tt(navT.videos),
      items: [
        { label: tt(navT.videos), icon: Video, path: 'creator' },
        { label: tt(navT.titlesThumbs), icon: Type, path: 'creator/titel' },
        { label: tt(navT.moodboard), icon: Image, path: 'moodboard' },
        { label: tt(navT.comments), icon: MessageSquare, path: 'kommentare' },
      ]
    },
    {
      label: tt(navT.production),
      items: [
        { label: tt(navT.shotlist), icon: Camera, path: 'shotlist' },
        { label: tt(navT.filmingLocations), icon: MapPin, path: 'motive' },
        { label: tt(navT.guestsCast), icon: Users, path: 'besetzung' },
        { label: tt(navT.team), icon: Briefcase, path: 'stabliste' },
        { label: tt(navT.equipment), icon: Package, path: 'equipment' },
        { label: tt(navT.equipmentCal), icon: CalendarClock, path: 'equipment-kalender' },
        { label: tt(navT.setView), icon: Clapperboard, path: '/set' },
      ]
    },
    {
      label: tt(navT.editRights),
      items: [
        { label: tt(navT.postProd), icon: Layers, path: 'postplan' },
        { label: tt(navT.clips), icon: Scissors, path: 'creator/clips' },
        { label: tt(navT.timeAnalysis), icon: TableProperties, path: 'zeitanalyse' },
        { label: tt(navT.rightsLicenses), icon: ShieldCheck, path: 'creator/rechte' },
        { label: tt(navT.musicCues), icon: Music, path: 'musikliste' },
      ]
    },
    {
      label: tt(navT.publishing),
      items: [
        { label: tt(navT.uploadChecklists), icon: ListChecks, path: 'creator/checklisten' },
        { label: tt(navT.seoMetadata), icon: Search, path: 'creator/seo' },
        { label: tt(navT.videoPerformance), icon: TrendingUp, path: 'creator/performance' },
      ]
    },
    {
      label: tt(navT.money),
      items: [
        { label: tt(navT.sponsors), icon: Megaphone, path: 'creator/sponsoren' },
        { label: tt(navT.budget), icon: DollarSign, path: 'budget' },
        { label: tt(navT.costStatus), icon: Wallet, path: 'kostenstand' },
      ]
    },
    {
      label: tt(navT.toolsComms),
      items: [
        { label: tt(navT.email), icon: Mail, path: 'email' },
        { label: tt(navT.contacts), icon: BookUser, path: 'kontakte' },
        { label: tt(navT.pinboard), icon: StickyNote, path: 'pinboard' },
        { label: tt(navT.activityFeed), icon: Activity, path: 'aktivitaet' },
        { label: tt(navT.search), icon: Search, path: 'suche' },
        { label: tt(navT.auditLog), icon: History, path: 'audit' },
      ]
    },
  ]

  const filmGroups: NavGroupDef[] = [
    {
      // First thing you do: create the project and break down the script
      label: tt(navT.overview),
      items: [
        { label: tt(navT.dashboard), icon: LayoutDashboard, path: '' },
        { label: tt(navT.masterData), icon: Film, path: 'stammdaten' },
        { label: tt(navT.tasks), icon: CheckSquare, path: 'aufgaben' },
      ]
    },
    {
      // Concept & creative development phase
      label: tt(navT.development),
      items: [
        { label: tt(navT.scenes), icon: FileText, path: 'drehbuch' },
        { label: tt(navT.scriptEditor), icon: FileEdit, path: 'screenplay-editor' },
        { label: tt(navT.moodboard), icon: Image, path: 'moodboard' },
        { label: tt(navT.sceneComments), icon: MessageSquare, path: 'kommentare' },
      ]
    },
    {
      // Build your team
      label: tt(navT.castingTeam),
      items: [
        { label: tt(navT.casting), icon: Users, path: 'besetzung' },
        { label: tt(navT.blackoutDays), icon: CalendarOff, path: 'sperrtage' },
        { label: tt(navT.extras), icon: Users, path: 'komparsen' },
        { label: tt(navT.crew), icon: Briefcase, path: 'stabliste' },
        { label: tt(navT.contacts), icon: BookUser, path: 'kontakte' },
      ]
    },
    {
      // Pre-production planning: schedule, locations, resources, budget
      label: tt(navT.planningPrep),
      items: [
        { label: tt(navT.locations), icon: MapPin, path: 'motive' },
        { label: tt(navT.shootingPlan), icon: Clapperboard, path: 'drehplan' },
        { label: tt(navT.stripboard), icon: LayoutDashboard, path: 'staebchenplan' },
        { label: tt(navT.calendar), icon: Calendar, path: 'kalender' },
        { label: tt(navT.conflicts), icon: AlertTriangle, path: 'konfliktradar', badge: conflictCount > 0 ? conflictCount : undefined },
        { label: tt(navT.equipment), icon: Package, path: 'equipment' },
        { label: tt(navT.equipmentCal), icon: CalendarClock, path: 'equipment-kalender' },
        { label: tt(navT.vehicles), icon: Car, path: 'fahrzeuge' },
        { label: tt(navT.catering), icon: UtensilsCrossed, path: 'catering' },
        { label: tt(navT.budget), icon: DollarSign, path: 'budget' },
        { label: tt(navT.costStatus), icon: Wallet, path: 'kostenstand' },
        { label: tt(navT.insurances), icon: Shield, path: 'versicherungen' },
      ]
    },
    {
      // Day-to-day on set
      label: tt(navT.shootDays),
      items: [
        { label: tt(navT.callSheet), icon: ClipboardList, path: 'tagesdispo' },
        { label: tt(navT.checkinBoard), icon: CheckSquare, path: 'checkin' },
        { label: tt(navT.shotlist), icon: Camera, path: 'shotlist' },
        { label: tt(navT.setPlan), icon: LayoutGrid, path: 'setplan' },
        { label: tt(navT.vfxTracking), icon: Layers, path: 'vfx' },
        { label: tt(navT.continuity), icon: Image, path: 'continuity' },
        { label: tt(navT.cameraReports), icon: Video, path: 'kameraberichte' },
        { label: tt(navT.dailyReport), icon: FileCheck, path: 'tagesbericht' },
        { label: tt(navT.timeAnalysis), icon: TableProperties, path: 'zeitanalyse' },
        { label: tt(navT.timesheets), icon: Clock, path: 'timesheets' },
        // Eigene Ansicht fuers Telefon am Set, ausserhalb des Projektlayouts.
        // Absoluter Pfad, deshalb der Sonderfall beim Linkbau weiter unten.
        { label: tt(navT.setView), icon: Clapperboard, path: '/set' },
      ]
    },
    {
      // After wrap
      label: tt(navT.postProduction),
      items: [
        { label: tt(navT.doodReport), icon: TableProperties, path: 'dood' },
        { label: tt(navT.postPlan), icon: CalendarClock, path: 'postplan' },
        { label: tt(navT.musicCues), icon: Music, path: 'musikliste' },
      ]
    },
    {
      // Communication & tools used throughout
      label: tt(navT.toolsComms),
      items: [
        { label: tt(navT.email), icon: Mail, path: 'email' },
        { label: tt(navT.pinboard), icon: StickyNote, path: 'pinboard' },
        { label: tt(navT.activityFeed), icon: Activity, path: 'aktivitaet' },
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

  // Open/closed state per group - persisted, default: open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups)

  const setGroupOpen = (label: string, open: boolean) => {
    setOpenGroups(prev => {
      const next = { ...prev, [label]: open }
      try { localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }

  // The group of the active page never stays collapsed - you should
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
      {/* Hintergrund, solange die Schublade offen ist - nur am Telefon */}
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
      'flex flex-col h-dvh bg-card border-r border-border sidebar-transition relative',
      // Ab md wie bisher eine feste Spalte im Fluss
      'md:shrink-0 md:translate-x-0 md:static md:z-auto',
      // Darunter eine Schublade ueber dem Inhalt: 220 px fester Abzug waeren
      // auf einem 375-px-Display mehr als die Haelfte des Bildschirms
      'fixed inset-y-0 left-0 z-50 w-[240px]',
      mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
      sidebarCollapsed ? 'md:w-[52px]' : 'md:w-[220px]'
    )}>
      {/* Logo / Brand */}
      <div
        className="flex items-center h-[56px] px-3.5 border-b border-border gap-3 shrink-0 cursor-pointer select-none"
        onClick={() => navigate('/')}
      >
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-[0_0_12px_hsl(var(--primary)/0.3)]">
          <Clapperboard className="w-4 h-4 text-primary-foreground" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm tracking-tight leading-none block">CutSheet</span>
            {project && (
              <span className="text-[11px] text-muted-foreground truncate block mt-0.5 font-normal">{project.title}</span>
            )}
          </div>
        )}
      </div>

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
                <Clapperboard className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{tt(navT.noProject)}</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 mx-auto"
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
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">{tt(navT.admin)}</span>
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
            className="w-full flex items-center justify-center h-8 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-[background-color,color,transform] duration-150 active:scale-[0.92]"
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
          'w-full flex items-center gap-1 px-2 pb-1 pt-2.5 group/header rounded-md',
          'transition-colors duration-150'
        )}
      >
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors duration-150',
          isActiveGroup ? 'text-muted-foreground/80' : 'text-muted-foreground/50 group-hover/header:text-muted-foreground/80'
        )}>
          {group.label}
        </span>
        <ChevronRight className={cn(
          'w-2.5 h-2.5 text-muted-foreground/40 transition-transform duration-200',
          open && 'rotate-90'
        )} style={{ transitionTimingFunction: 'var(--ease-out)' }} />
        {/* Collapsed group with active page inside still hints at it */}
        {!open && isActiveGroup && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
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
        'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] group relative',
        'transition-[background-color,color,transform] duration-150',
        'active:scale-[0.97]',
        isActive
          ? 'bg-primary/10 text-primary font-medium shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-full shadow-[0_0_8px_hsl(var(--primary)/0.65)]"
              aria-current="page"
            />
          )}
          <item.icon className={cn(
            'shrink-0 transition-[color,transform] duration-150',
            collapsed ? 'w-[15px] h-[15px]' : 'w-[14px] h-[14px]',
            isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground group-hover:scale-110'
          )} />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge != null && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-warning/20 text-warning text-[10px] font-bold flex items-center justify-center tabular-nums">
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
    <div className="px-2 py-2.5 flex items-center gap-2">
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/12 border border-primary/20 flex items-center justify-center">
        <UserCircle className="w-4 h-4 text-primary" />
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-tight">{user.name || user.email}</p>
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{roleLabel[user.role] ?? user.role}</p>
        </div>
      )}
      <button
        onClick={() => navigate('/settings')}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-[background-color,color,transform] duration-150 active:scale-[0.88]"
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
