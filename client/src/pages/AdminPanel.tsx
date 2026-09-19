import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FolderOpen, Settings2, Trash2, KeyRound,
  Shield, ChevronDown, ChevronRight, Plus, Crown, LogOut,
  TrendingUp, Clapperboard, Film, CalendarDays, UserCheck,
  AlertTriangle, RotateCcw, Eye, EyeOff, X, Check,
} from 'lucide-react'

// ─── API helper ───────────────────────────────────────────────────────────────

async function adminFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem('token')
  const r = await fetch(`/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })
  const json = await r.json()
  if (json.error) throw new Error(json.error)
  return json.data
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: number
  email: string
  name: string
  role: string
  created_at: string
  project_count: number
  last_project_title: string | null
  last_active: string | null
}

interface AdminProject {
  id: number
  title: string
  status: string
  archived: number
  created_at: string
  updated_at: string
  owner_id: number
  owner_name: string
  owner_email: string
  scene_count: number
  day_count: number
  member_count: number
  block_count: number
}

interface Stats {
  totalUsers: number
  totalProjects: number
  totalScenes: number
  totalDays: number
  totalCrew: number
  totalBlocks: number
  newUsers7d: number
  newProjects7d: number
  topUsers: AdminUser[]
  recentProjects: AdminProject[]
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'admin',     label: 'Admin',       bg: 'bg-red-500/15',    text: 'text-red-400'    },
  { value: 'user',      label: 'Nutzer',       bg: 'bg-zinc-500/15',   text: 'text-zinc-400'   },
  { value: 'producer',  label: 'Produzent',    bg: 'bg-amber-500/15',  text: 'text-amber-400'  },
  { value: 'director',  label: 'Regie',        bg: 'bg-blue-500/15',   text: 'text-blue-400'   },
  { value: 'dept_head', label: 'Abt.-Leitung', bg: 'bg-purple-500/15', text: 'text-purple-400' },
  { value: 'read_only', label: 'Lesezugriff',  bg: 'bg-zinc-500/10',   text: 'text-zinc-500'   },
]
const roleConf = (r: string) => ROLES.find(x => x.value === r) ?? ROLES[1]

function RoleBadge({ role }: { role: string }) {
  const c = roleConf(role)
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', c.bg, c.text)}>
      {c.label}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color?: string
}) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', 'bg-primary/10')}>
        <Icon className={cn('w-5 h-5', color)} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[11px] text-primary mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {count !== undefined && (
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users}         label="Nutzer gesamt"    value={stats.totalUsers}    sub={`+${stats.newUsers7d} diese Woche`} />
        <StatCard icon={FolderOpen}    label="Projekte gesamt"  value={stats.totalProjects} sub={`+${stats.newProjects7d} diese Woche`} />
        <StatCard icon={Film}          label="Szenen gesamt"    value={stats.totalScenes} />
        <StatCard icon={CalendarDays}  label="Drehtage gesamt"  value={stats.totalDays} />
        <StatCard icon={UserCheck}     label="Crew-Einträge"    value={stats.totalCrew} />
        <StatCard icon={Clapperboard}  label="Script-Blöcke"   value={stats.totalBlocks} />
      </div>

      {/* Top users */}
      <div>
        <SectionHead title="Aktivste Nutzer" count={stats.topUsers.length} />
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          {stats.topUsers.map((u, i) => (
            <div key={u.id} className={cn('flex items-center gap-3 px-4 py-3', i < stats.topUsers.length - 1 && 'border-b border-border/40')}>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{(u.name || u.email)[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.name || '–'}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <RoleBadge role={u.role} />
              <span className="text-xs text-muted-foreground shrink-0">{u.project_count} Projekte</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <SectionHead title="Zuletzt erstellt" count={stats.recentProjects.length} />
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          {stats.recentProjects.map((p, i) => (
            <div key={p.id} className={cn('flex items-center gap-3 px-4 py-3', i < stats.recentProjects.length - 1 && 'border-b border-border/40')}>
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Clapperboard className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.owner_name || p.owner_email || 'Unbekannt'} · {p.scene_count} Szenen · {p.member_count} Mitglieder</p>
              </div>
              {p.archived ? (
                <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Archiviert</span>
              ) : (
                <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{p.status}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab({ me }: { me: { id: number } }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null)
  const [newUserOpen, setNewUserOpen] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'user' })

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => adminFetch('/users'),
  })

  const { data: userProjects } = useQuery({
    queryKey: ['admin-user-projects', expanded],
    queryFn: () => adminFetch(`/users/${expanded}/projects`),
    enabled: expanded !== null,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
      toast({ title: 'Nutzer gelöscht' })
      setDeleteConfirm(null)
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.message }),
  })

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      adminFetch(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: 'Rolle geändert' })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.message }),
  })

  const resetMut = useMutation({
    mutationFn: ({ id, pw }: { id: number; pw: string }) =>
      adminFetch(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: pw }) }),
    onSuccess: () => {
      toast({ title: 'Passwort zurückgesetzt' })
      setResetTarget(null)
      setResetPw('')
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.message }),
  })

  const createMut = useMutation({
    mutationFn: () => adminFetch('/users', { method: 'POST', body: JSON.stringify(newUser) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
      toast({ title: `${newUser.email} erstellt` })
      setNewUserOpen(false)
      setNewUser({ email: '', name: '', password: '', role: 'user' })
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.message }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHead title="Alle Nutzer" count={users.length} />
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setNewUserOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Neuer Nutzer
        </Button>
      </div>

      {/* New user form */}
      {newUserOpen && (
        <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Neuen Nutzer anlegen</p>
            <button onClick={() => setNewUserOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <Input value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} placeholder="Vorname Nachname" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">E-Mail *</label>
              <Input value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="mail@example.com" className="h-8 text-sm" type="email" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Passwort *</label>
              <Input value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Min. 6 Zeichen" className="h-8 text-sm" type="password" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rolle</label>
              <select
                value={newUser.role}
                onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                className="h-8 w-full text-sm bg-background border border-border rounded-md px-2"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setNewUserOpen(false)}>Abbrechen</Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => createMut.mutate()} disabled={!newUser.email || !newUser.password || createMut.isPending}>
              <Check className="w-3.5 h-3.5 mr-1" /> Erstellen
            </Button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
          </div>
        ) : (
          users.map((u, i) => (
            <div key={u.id} className={cn(i < users.length - 1 && 'border-b border-border/40')}>
              {/* User row */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                {/* Avatar */}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                  u.id === me.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {u.id === me.id ? <Crown className="w-4 h-4" /> : (u.name || u.email)[0].toUpperCase()}
                </div>

                {/* Name / email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{u.name || <span className="text-muted-foreground italic">Kein Name</span>}</p>
                    {u.id === me.id && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Du</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>

                {/* Role selector */}
                <select
                  value={u.role}
                  onChange={e => roleMut.mutate({ id: u.id, role: e.target.value })}
                  disabled={u.id === me.id}
                  className="h-7 text-xs bg-background border border-border rounded-md px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>

                {/* Stats */}
                <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                  {u.project_count} Proj.
                </span>

                {/* Join date */}
                <span className="text-xs text-muted-foreground w-24 text-right shrink-0 hidden lg:block">
                  {new Date(u.created_at).toLocaleDateString('de-DE')}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                    title="Projekte anzeigen"
                  >
                    {expanded === u.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { setResetTarget(u); setResetPw('') }}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Passwort zurücksetzen"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  {u.id !== me.id && (
                    <button
                      onClick={() => setDeleteConfirm(u)}
                      className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      title="Nutzer löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded: user's projects */}
              {expanded === u.id && (
                <div className="border-t border-border/40 bg-muted/20 px-4 py-3">
                  {!userProjects ? (
                    <p className="text-xs text-muted-foreground animate-pulse">Lade Projekte…</p>
                  ) : (userProjects as any[]).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Keine Projekte</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(userProjects as any[]).map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 text-xs">
                          <Clapperboard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground truncate flex-1">{p.title}</span>
                          <RoleBadge role={p.member_role} />
                          <span className="text-muted-foreground shrink-0">{p.scene_count} Szenen</span>
                          {p.archived ? (
                            <span className="text-muted-foreground shrink-0 italic">archiviert</span>
                          ) : (
                            <span className="text-primary shrink-0">{p.status}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Password reset dialog */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-xl p-5 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Passwort zurücksetzen</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Neues Passwort für <strong>{resetTarget.email}</strong>
            </p>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={resetPw}
                onChange={e => setResetPw(e.target.value)}
                placeholder="Neues Passwort (min. 6)"
                className="h-9 text-sm pr-9"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setResetTarget(null)}>Abbrechen</Button>
              <Button size="sm" className="h-8 text-xs" disabled={resetPw.length < 6 || resetMut.isPending}
                onClick={() => resetMut.mutate({ id: resetTarget.id, pw: resetPw })}>
                {resetMut.isPending ? 'Speichere…' : 'Zurücksetzen'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-xl p-5 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="text-sm font-semibold">Nutzer löschen</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>{deleteConfirm.name || deleteConfirm.email}</strong> wird unwiderruflich gelöscht. Alle Daten dieses Nutzers bleiben erhalten.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDeleteConfirm(null)}>Abbrechen</Button>
              <Button variant="destructive" size="sm" className="h-8 text-xs" disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteConfirm.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />{deleteMut.isPending ? 'Löschen…' : 'Ja, löschen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Projects tab ─────────────────────────────────────────────────────────────

function ProjectsTab() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [deleteConfirm, setDeleteConfirm] = useState<AdminProject | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all')

  const { data: projects = [], isLoading } = useQuery<AdminProject[]>({
    queryKey: ['admin-projects'],
    queryFn: () => adminFetch('/projects'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-projects'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
      toast({ title: 'Projekt gelöscht' })
      setDeleteConfirm(null)
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.message }),
  })

  const filtered = projects.filter(p =>
    filter === 'all' ? true : filter === 'archived' ? p.archived : !p.archived
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHead title="Alle Projekte" count={filtered.length} />
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {(['all','active','archived'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : 'Archiviert'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {['Projekt', 'Inhaber', 'Mitglieder', 'Szenen', 'Drehtage', 'Erstellt', ''].map(h => (
                  <th key={h} className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="border-b border-border/40">
                    {[1,2,3,4,5,6,7].map(j => (
                      <td key={j} className="py-3 px-4"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Keine Projekte</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <Clapperboard className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{p.title}</p>
                          {p.archived ? (
                            <span className="text-[10px] text-muted-foreground">Archiviert</span>
                          ) : (
                            <span className="text-[10px] text-primary">{p.status}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{p.owner_name || '—'}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{p.owner_email}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-center">{p.member_count}</td>
                    <td className="py-3 px-4 text-sm text-center">{p.scene_count}</td>
                    <td className="py-3 px-4 text-sm text-center">{p.day_count}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setDeleteConfirm(p)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Projekt löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-xl p-5 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="text-sm font-semibold">Projekt löschen</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>„{deleteConfirm.title}"</strong> mit {deleteConfirm.scene_count} Szenen und {deleteConfirm.member_count} Mitgliedern wird unwiderruflich gelöscht.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDeleteConfirm(null)}>Abbrechen</Button>
              <Button variant="destructive" size="sm" className="h-8 text-xs" disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteConfirm.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />{deleteMut.isPending ? 'Löschen…' : 'Ja, löschen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── System tab ───────────────────────────────────────────────────────────────

function SystemTab({ stats }: { stats: Stats | undefined }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { logout } = useAuth()

  return (
    <div className="space-y-6 max-w-xl">
      {/* DB summary */}
      {stats && (
        <div className="bg-card border border-border/60 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Datenbankübersicht
          </p>
          {[
            ['Nutzer', stats.totalUsers],
            ['Projekte', stats.totalProjects],
            ['Szenen', stats.totalScenes],
            ['Drehtage', stats.totalDays],
            ['Stab-Einträge', stats.totalCrew],
            ['Script-Blöcke', stats.totalBlocks],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium tabular-nums">{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Test admin info */}
      <div className="bg-card border border-primary/20 rounded-xl p-5 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> Test-Admin Account
        </p>
        <p className="text-xs text-muted-foreground">
          Dieser Account wird bei jedem Server-Start automatisch angelegt und seine Rolle auf <code className="bg-muted px-1 rounded">admin</code> zurückgesetzt.
        </p>
        <div className="mt-2 space-y-1 font-mono text-xs">
          <div className="flex gap-2"><span className="text-muted-foreground w-20">E-Mail</span><span className="text-foreground">admin@cutsheet.dev</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-20">Passwort</span><span className="text-foreground">admin1234</span></div>
        </div>
      </div>

      {/* Dangerous zone */}
      <div className="bg-card border border-destructive/20 rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" /> Gefahrenzone
        </p>
        <p className="text-xs text-muted-foreground">
          Diese Aktionen können nicht rückgängig gemacht werden.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => { logout(); navigate('/login') }}
        >
          <LogOut className="w-3.5 h-3.5" /> Admin-Session beenden
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Übersicht',  icon: LayoutDashboard },
  { id: 'users',     label: 'Nutzer',     icon: Users           },
  { id: 'projects',  label: 'Projekte',   icon: FolderOpen      },
  { id: 'system',    label: 'System',     icon: Settings2       },
] as const

type TabId = typeof TABS[number]['id']

export function Component() {
  const { user: me } = useAuth()
  const [tab, setTab] = useState<TabId>('overview')

  if (me && me.role !== 'admin') return <Navigate to="/" replace />

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: () => adminFetch('/stats'),
    refetchInterval: 30_000,
  })

  return (
    <div className="min-h-full bg-background">
      {/* Top bar */}
      <div className="border-b border-border/60 bg-card px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground leading-none">Admin Panel</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {me?.name || me?.email} · {stats ? `${stats.totalUsers} Nutzer, ${stats.totalProjects} Projekte` : 'Lädt…'}
            </p>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 ml-6 bg-muted rounded-lg p-0.5">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  tab === t.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 max-w-6xl mx-auto">
        {tab === 'overview' && stats && <OverviewTab stats={stats} />}
        {tab === 'overview' && !stats && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
          </div>
        )}
        {tab === 'users'    && me && <UsersTab me={me} />}
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'system'   && <SystemTab stats={stats} />}
      </div>
    </div>
  )
}
