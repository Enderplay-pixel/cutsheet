import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/store/useProjectStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Activity, ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from 'lucide-react'
import { FeedbackWidget } from '@/components/shared/FeedbackWidget'
import { AppIcon } from '@/components/shared/BrandMark'
import { VERSION } from '@/lib/version'
import { TestversionBadge } from '@/components/shared/TestversionBadge'
import { useT } from '@/lib/useT'
import { navT } from '@/lib/i18n'
import { isCreatorProject } from '@/lib/projectKind'
import { sidebarT } from '@/lib/texte/komponenten/Layout'
import { useArbeitsplatz } from '@/lib/einstellungen'
import { DASHBOARD, bereichFuer, bereichLink, sichtbareKategorien } from '@/lib/bereiche'
import { siehtGagen } from '@/lib/useSchreibrecht'

type NavItemDef = {
  label: string
  icon: any
  path: string
  badge?: number
}

type NavGroupDef = {
  id: string
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
    queryKey: ['project', Number(projectId)],
    queryFn: () => api.projects.get(Number(projectId)),
    enabled: !!projectId,
  })

  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', Number(projectId)],
    queryFn: () => api.conflicts(Number(projectId)),
    enabled: !!projectId,
    refetchInterval: 60_000,
  })
  const conflictCount = (conflicts || []).filter((c: any) => c.severity === 'error' || c.severity === 'warning').length

  const isCreator = isCreatorProject(project)

  // Kategorien und Bereiche in der Reihenfolge des Kontos (lib/bereiche.ts) -
  // dieselbe wie auf der Hauptseite. Leere Kategorien zeigt die Leiste nicht.
  const art = isCreator ? 'creator' : 'film'
  const { kategorien: alleKategorien, bereit } = useArbeitsplatz(art)
  const kategorien = sichtbareKategorien(alleKategorien, siehtGagen((project as any)?.my_role))
  const navGroups: NavGroupDef[] = kategorien
    .filter(k => k.bereiche.length > 0)
    .map(k => ({
      id: k.id,
      label: tt(k.text),
      items: k.bereiche.map(x => ({
        label: tt(x.text),
        icon: x.icon,
        path: x.pfad,
        badge: x.pfad === 'konfliktradar' && conflictCount > 0 ? conflictCount : undefined,
      })),
    }))

  // Welcher Eintrag gehört zur aktuellen Seite? Zwei Abschnitte vor einem:
  // Vorher zählte nur der erste, und jede Seite unter creator/ (Kanal, Serien,
  // Sponsoren …) galt als "Videos" - gemessen am 27.10.2026: auf "Kanal"
  // waren "Kanal" und "Videos" markiert, die Gruppe von "Kanal" blieb zu.
  // creator/<Kennung> (ein einzelnes Video) gehört weiter zu "Videos".
  const aktiverPfad = useMemo(() => {
    if (!projectId) return null
    const rest = location.pathname.split(`/projects/${projectId}`)[1] || ''
    const abschnitte = rest.split('/').filter(Boolean)
    const zwei = abschnitte.slice(0, 2).join('/')
    if (abschnitte.length >= 2 && bereichFuer(art, zwei)) return zwei
    return abschnitte[0] ?? ''
  }, [location.pathname, projectId, art])

  // Nach Kennung, nicht nach Beschriftung: die wechselt mit der Sprache
  const aktiveGruppe = aktiverPfad === null ? null
    : kategorien.find(k => k.bereiche.some(x => x.pfad === aktiverPfad))?.id ?? null

  // Open/closed state per group - persisted, default: open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups)

  const setGroupOpen = (id: string, open: boolean) => {
    setOpenGroups(prev => {
      const next = { ...prev, [id]: open }
      try { localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }

  // The group of the active page never stays collapsed - you should
  // always see where you are.
  useEffect(() => {
    if (aktiveGruppe && openGroups[aktiveGruppe] === false) {
      setGroupOpen(aktiveGruppe, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiveGruppe])

  // Nach der Auswahl schließen, sonst verdeckt die Schublade genau die Seite,
  // die man gerade angetippt hat
  useEffect(() => { setMobileNav(false) }, [location.pathname, setMobileNav])

  const pid = projectId

  return (
    <>
      {/* Hintergrund, solange die Schublade offen ist - nur am Telefon */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setMobileNav(false)}
          aria-hidden
        />
      )}

    <aside className={cn(
      // h-dvh statt h-screen: 100vh rechnet auf iOS die Browserleiste mit,
      // dadurch wird das untere Ende der Schublade abgeschnitten.
      'flex flex-col h-dvh bg-canvas border-r border-border/70 sidebar-transition relative',
      // Ab md wie bisher eine feste Spalte im Fluss
      'md:shrink-0 md:translate-x-0 md:static md:z-auto',
      // Darunter eine Schublade über dem Inhalt: 220 px fester Abzug wären
      // auf einem 375-px-Display mehr als die Hälfte des Bildschirms
      'fixed inset-y-0 left-0 z-50 w-[248px]',
      mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
      sidebarCollapsed ? 'md:w-[60px]' : 'md:w-[240px]'
    )}>
      {/* Logo / Brand */}
      <button
        type="button"
        className={cn(
          'flex items-center h-[60px] gap-2.5 shrink-0 select-none text-left',
          'transition-opacity duration-150 hover:opacity-80',
          sidebarCollapsed ? 'md:justify-center md:px-0 px-4' : 'px-4'
        )}
        onClick={() => navigate('/')}
        aria-label={tt(sidebarT.zurUebersicht)}
      >
        <AppIcon className="w-8 h-8" />
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-[14px] font-semibold tracking-[-0.02em] leading-none flex items-center gap-1.5">
              CutSheet
              <span className="text-[10px] font-normal text-muted-foreground tracking-normal">{VERSION}</span>
              <TestversionBadge />
            </span>
            {project && (
              <span className="text-[12px] text-muted-foreground truncate block mt-1 leading-none">{project.title}</span>
            )}
          </div>
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label={tt(sidebarT.hauptnavigation)} role="navigation">
        {pid ? (
          <>
            {/* Das Dashboard steht fest oben: Dort wird angeordnet */}
            <NavItem
              item={{ label: tt(DASHBOARD.text), icon: DASHBOARD.icon, path: '' }}
              to={bereichLink(pid, '')}
              aktiv={aktiverPfad === ''}
              collapsed={sidebarCollapsed}
            />
            {/* Bis die Anordnung geladen ist, nichts zeigen statt kurz den Standard */}
            {bereit && navGroups.map(group => (
              <NavGroup
                key={group.id}
                group={group}
                pid={pid}
                aktiverPfad={aktiverPfad}
                collapsed={sidebarCollapsed}
                open={openGroups[group.id] !== false}
                isActiveGroup={group.id === aktiveGruppe}
                onToggle={() => setGroupOpen(group.id, openGroups[group.id] === false)}
              />
            ))}
          </>
        ) : (
          <div className="px-3 py-6 text-center">
            {!sidebarCollapsed && (
              <div>
                <p className="text-[13px] text-muted-foreground">{tt(navT.noProject)}</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-1.5 text-[13px] text-primary hover:underline underline-offset-4 flex items-center gap-0.5 mx-auto"
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
                <span className="text-[11px] font-semibold text-muted-foreground/80">{tt(navT.admin)}</span>
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
            title={sidebarCollapsed ? tt(sidebarT.erweitern) : tt(sidebarT.einklappen)}
            aria-label={sidebarCollapsed ? tt(sidebarT.erweitern) : tt(sidebarT.einklappen)}
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

function NavGroup({ group, pid, aktiverPfad, collapsed, open, isActiveGroup, onToggle }: {
  group: NavGroupDef
  pid: string
  aktiverPfad: string | null
  collapsed: boolean
  open: boolean
  isActiveGroup: boolean
  onToggle: () => void
}) {
  // Collapsed rail: no group headers, just a thin separator
  if (collapsed) {
    return (
      <div className="mb-1">
        <div className="my-2 mx-2 h-px bg-border" />
        {group.items.map(item => (
          <NavItem
            key={item.path}
            item={item}
            to={bereichLink(pid, item.path)}
            aktiv={item.path === aktiverPfad}
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
          'w-full flex items-center gap-1 px-2.5 pb-1 pt-4 group/header rounded-md',
          'transition-colors duration-150'
        )}
      >
        <span className={cn(
          'text-[11px] font-semibold transition-colors duration-150 text-left',
          isActiveGroup ? 'text-foreground/70' : 'text-muted-foreground/80 group-hover/header:text-foreground/70'
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
              to={bereichLink(pid, item.path)}
              aktiv={item.path === aktiverPfad}
              collapsed={false}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function NavItem({ item, to, aktiv, collapsed }: {
  item: NavItemDef
  to: string
  /** Projektseiten: aus dem genauen Pfad bestimmt. Ohne Angabe entscheidet der Router. */
  aktiv?: boolean
  collapsed: boolean
}) {
  // Die Zahl am Eintrag (Konflikte) gehört auch in den vorgelesenen Namen
  const name = item.badge != null ? `${item.label} (${item.badge})` : item.label
  const klasse = (an: boolean) => cn(
    'flex items-center gap-2.5 px-2.5 h-[30px] rounded-lg text-[13px] group relative',
    'transition-[background-color,color,box-shadow,transform] duration-150',
    'active:scale-[0.98]',
    collapsed && 'md:justify-center md:px-0',
    an
      ? 'bg-foreground/[0.08] text-foreground font-medium'
      : 'text-foreground/80 hover:text-foreground hover:bg-foreground/[0.04]'
  )
  const inhalt = (
    <>
      <item.icon className={cn(
        'shrink-0 transition-[color,transform] duration-150',
        collapsed ? 'w-[15px] h-[15px]' : 'w-[14px] h-[14px]',
        'text-primary'
      )} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge != null && (
            <span className="ml-1 min-w-[18px] h-[18px] px-1.5 rounded-full bg-foreground/[0.08] text-muted-foreground text-[11px] font-medium flex items-center justify-center tabular-nums">
              {item.badge}
            </span>
          )}
        </>
      )}
    </>
  )
  if (aktiv !== undefined) {
    return (
      <Link to={to} title={item.label} aria-label={name} aria-current={aktiv ? 'page' : undefined} className={klasse(aktiv)}>
        {inhalt}
      </Link>
    )
  }
  return (
    <NavLink to={to} end title={item.label} aria-label={name} className={({ isActive }) => klasse(isActive)}>
      {inhalt}
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
      <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-b from-zinc-400 to-zinc-500 text-white flex items-center justify-center text-[11px] font-semibold" aria-hidden>
        {initials(user.name || user.email)}
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium truncate leading-tight">{user.name || user.email}</p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{roleLabel[user.role] ?? user.role}</p>
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
