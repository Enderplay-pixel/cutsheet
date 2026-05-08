import { NavLink, useParams, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/useProjectStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import {
  Film, LayoutDashboard, FileText, Users, Briefcase, MapPin, Calendar,
  Camera, ClipboardList, FileCheck, DollarSign, Package, Mail, AlertTriangle,
  Clapperboard, PanelLeftClose, PanelLeftOpen, ChevronRight,
  StickyNote, Car, History, Search, FileEdit, LogOut, UserCircle, ShieldCheck, BookUser, Settings
} from 'lucide-react'
import { useT } from '@/lib/useT'
import { navT } from '@/lib/i18n'

export function Sidebar() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar } = useProjectStore()
  const { user } = useAuth()
  const tt = useT()

  const ADMIN_ITEMS = [
    { label: tt(navT.userMgmt), icon: ShieldCheck, path: '/admin' },
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

  const navGroups = [
    {
      label: tt(navT.overview),
      items: [
        { label: tt(navT.dashboard), icon: LayoutDashboard, path: '' },
        { label: tt(navT.masterData), icon: Film, path: 'stammdaten' },
      ]
    },
    {
      label: tt(navT.preparation),
      items: [
        { label: tt(navT.scenes), icon: FileText, path: 'drehbuch' },
        { label: tt(navT.scriptEditor), icon: FileEdit, path: 'screenplay-editor' },
        { label: tt(navT.casting), icon: Users, path: 'besetzung' },
        { label: tt(navT.crew), icon: Briefcase, path: 'stabliste' },
        { label: tt(navT.contacts), icon: BookUser, path: 'kontakte' },
        { label: tt(navT.locations), icon: MapPin, path: 'motive' },
        { label: tt(navT.equipment), icon: Package, path: 'equipment' },
        { label: tt(navT.vehicles), icon: Car, path: 'fahrzeuge' },
        { label: tt(navT.extras), icon: Users, path: 'komparsen' },
      ]
    },
    {
      label: tt(navT.production),
      items: [
        { label: tt(navT.shootingPlan), icon: Clapperboard, path: 'drehplan' },
        { label: tt(navT.stripboard), icon: LayoutDashboard, path: 'staebchenplan' },
        { label: tt(navT.shotlist), icon: Camera, path: 'shotlist' },
        { label: tt(navT.callSheet), icon: ClipboardList, path: 'tagesdispo' },
        { label: tt(navT.dailyReport), icon: FileCheck, path: 'tagesbericht' },
      ]
    },
    {
      label: tt(navT.management),
      items: [
        { label: tt(navT.budget), icon: DollarSign, path: 'budget' },
        { label: tt(navT.calendar), icon: Calendar, path: 'kalender' },
        { label: tt(navT.email), icon: Mail, path: 'email' },
        { label: tt(navT.conflicts), icon: AlertTriangle, path: 'konfliktradar', badge: conflictCount > 0 ? conflictCount : undefined },
        { label: tt(navT.pinboard), icon: StickyNote, path: 'pinboard' },
        { label: tt(navT.auditLog), icon: History, path: 'audit' },
        { label: tt(navT.search), icon: Search, path: 'suche' },
      ]
    },
  ]

  const pid = projectId

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-card border-r border-border/60 transition-all duration-300 ease-in-out shrink-0 relative',
      sidebarCollapsed ? 'w-14' : 'w-[224px]'
    )}>
      {/* Logo / Brand */}
      <div
        className="flex items-center h-[52px] px-3.5 border-b border-border/60 gap-3 shrink-0 cursor-pointer"
        onClick={() => navigate('/')}
      >
        <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0 shadow-sm">
          <Clapperboard className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-[13px] tracking-tight leading-none block">CutSheet</span>
            {project && (
              <span className="text-[11px] text-muted-foreground truncate block mt-0.5">{project.title}</span>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Hauptnavigation" role="navigation">
        {pid ? (
          navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              {!sidebarCollapsed && (
                <div className="px-2 pb-1 pt-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {group.label}
                  </span>
                </div>
              )}
              {sidebarCollapsed && group.label !== tt(navT.overview) && (
                <div className="my-2 mx-2 h-px bg-border/60" />
              )}
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path === '' ? `/projects/${pid}` : `/projects/${pid}/${item.path}`}
                  end={item.path === ''}
                  title={item.label}
                  aria-label={item.label}
                  className={({ isActive }) => cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150 group relative',
                    isActive
                      ? 'bg-primary/12 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full"
                          aria-current="page"
                        />
                      )}
                      <item.icon className={cn(
                        'shrink-0 transition-colors',
                        sidebarCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5',
                        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {(item as any).badge != null && (
                            <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center tabular-nums">
                              {(item as any).badge}
                            </span>
                          )}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))
        ) : (
          <div className="px-3 py-6 text-center">
            {!sidebarCollapsed && (
              <div>
                <Clapperboard className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{tt(navT.noProject)}</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-2 text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
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
              <div className="px-2 pb-1 pt-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{tt(navT.admin)}</span>
              </div>
            )}
            {sidebarCollapsed && <div className="my-2 mx-2 h-px bg-border/60" />}
            {ADMIN_ITEMS.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) => cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150 group relative',
                  isActive
                    ? 'bg-primary/12 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full" aria-current="page" />
                    )}
                    <item.icon className={cn(
                      'shrink-0 transition-colors',
                      sidebarCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )} />
                    {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* User menu + Collapse toggle */}
      <div className="border-t border-border/60 shrink-0">
        <UserMenu collapsed={sidebarCollapsed} />
        <div className="p-2">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title={sidebarCollapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
            aria-label={sidebarCollapsed ? 'Sidebar erweitern' : 'Sidebar einklappen'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen className="w-4 h-4" />
              : <PanelLeftClose className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
    </aside>
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
    <div className="px-2 py-2 flex items-center gap-2">
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
        <UserCircle className="w-4 h-4 text-primary" />
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{user.name || user.email}</p>
          <p className="text-[10px] text-muted-foreground truncate">{roleLabel[user.role] ?? user.role}</p>
        </div>
      )}
      <button
        onClick={() => navigate('/settings')}
        className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        title={tt(navT.settings)}
        aria-label={tt(navT.settings)}
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => { logout(); navigate('/login') }}
        className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title={tt(navT.logout)}
        aria-label={tt(navT.logout)}
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
