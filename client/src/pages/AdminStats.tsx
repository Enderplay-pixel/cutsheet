import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  FolderOpen,
  Activity,
  Film,
  Server,
  TrendingUp,
  ShieldCheck,
  MessageSquare,
  Check,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API_BASE = '/api'
async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...headers, ...options?.headers }, ...options })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Fehler')
  return json.data
}

const STATUS_COLORS: Record<string, string> = {
  'Entwicklung':    'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Vorproduktion':  'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  'Produktion':     'bg-green-500/10 text-green-700 border-green-500/20',
  'Postproduktion': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Abgeschlossen':  'bg-muted text-muted-foreground border-border',
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string
  value: string | number
  icon: any
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 card-lift group">
      <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
      <div className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none">
        {value}
      </div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mt-2">
        {label}
      </div>
      {sub && (
        <div className="text-[11px] text-muted-foreground/50 mt-1">{sub}</div>
      )}
    </div>
  )
}

export function Component() {
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => req<any[]>('/projects'),
  })

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => req<any[]>('/auth/users'),
  })

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const totalProjects = (projects || []).length
  const totalUsers = (users || []).length
  const activeProductions = (projects || []).filter((p: any) => {
    if (p.status === 'Produktion') return true
    if (p.shoot_start && new Date(p.shoot_start) >= thirtyDaysAgo) return true
    if (
      p.shoot_end &&
      new Date(p.shoot_end) >= thirtyDaysAgo &&
      new Date(p.shoot_start) <= now
    )
      return true
    return false
  }).length

  const recentUsers = [...(users || [])]
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    .slice(0, 10)

  // Project status breakdown
  const statusCounts: Record<string, number> = {}
  ;(projects || []).forEach((p: any) => {
    const s = p.status || 'Unbekannt'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  })

  return (
    <div className="px-5 py-6 sm:p-7 max-w-6xl mx-auto animate-fade-up">
      {/* Page hero */}
      <div className="mb-8 pb-7 border-b border-border/40 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">
            Admin-Statistiken
          </h1>
          <p className="text-sm text-muted-foreground/60 mt-1.5">
            Plattformübersicht und Nutzungsanalyse
          </p>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 text-xs bg-orange-500/10 text-orange-600 border-orange-500/20 mt-1"
        >
          <ShieldCheck className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      </div>

      {/* Zuerst: ist etwas zu tun? */}
      <div className="mb-8">
        <h2 className="text-sm font-medium mb-3">Betrieb</h2>
        <Betriebsuebersicht />
      </div>

      {/* 4-column stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {projectsLoading || usersLoading ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </>
        ) : (
          <>
            <StatCard label="Projekte gesamt"    value={totalProjects}      icon={FolderOpen} />
            <StatCard label="Nutzer gesamt"       value={totalUsers}         icon={Users} />
            <StatCard
              label="Aktive Produktionen"
              value={activeProductions}
              icon={Film}
              sub="letzte 30 Tage"
            />
            <StatCard
              label="Registrierungen"
              value={recentUsers.length}
              icon={TrendingUp}
              sub="neueste Einträge"
            />
          </>
        )}
      </div>

      {/* Feature usage + Project status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Welche Bereiche werden wirklich benutzt - gezaehlt, nicht geschaetzt */}
        <GenutzteBereiche />

        {/* Project status breakdown */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-5">
            Projekte nach Status
          </p>
          {projectsLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-9 rounded-xl" />
              ))}
            </div>
          ) : Object.keys(statusCounts).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground/60">Keine Projekte</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${STATUS_COLORS[status] || 'bg-muted text-muted-foreground border-border'}`}
                  >
                    {status}
                  </Badge>
                  <span className="text-sm font-bold tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent registrations */}
      <div className="rounded-xl border border-border/60 bg-card mb-6 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
            Neueste Registrierungen
          </p>
        </div>
        {usersLoading ? (
          <div className="px-5 pb-5 space-y-2.5">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        ) : recentUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm text-muted-foreground/60">Keine Nutzer gefunden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
                    Name
                  </th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
                    E-Mail
                  </th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
                    Rolle
                  </th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
                    Registriert
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {recentUsers.map((user: any) => (
                  <tr
                    key={user.id}
                    className="hover:bg-muted/20 transition-colors active:scale-[0.97]"
                  >
                    <td className="px-5 py-3 font-medium">
                      {user.name || user.username || '–'}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground/70">
                      {user.email || '–'}
                    </td>
                    <td className="px-5 py-3">
                      {user.role === 'admin' ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20"
                        >
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Nutzer
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[11px] text-muted-foreground/60 tabular-nums">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString('de-DE')
                        : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User feedback */}
      <FeedbackPanel />

      {/* Server information */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-5">
          Server-Informationen
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { label: 'Umgebung',    value: 'Production' },
            { label: 'Node.js',     value: '20.x' },
            { label: 'Datenbank',   value: 'PostgreSQL' },
            { label: 'API-Version', value: 'v1' },
          ].map(item => (
            <div key={item.label}>
              <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-1.5">
                {item.label}
              </div>
              <div className="font-mono text-sm font-medium">{item.value}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/40 mt-5">
          * Detaillierte Server-Metriken werden über{' '}
          <code className="font-mono">/api/admin/stats</code> bereitgestellt (demnächst verfügbar).
        </p>
      </div>
    </div>
  )
}

// ─── Nutzer-Feedback (In-App-Widget) ─────────────────────────────────────────

const FEEDBACK_CATEGORY_LABELS: Record<string, { label: string; cls: string }> = {
  fehler:    { label: 'Fehler',    cls: 'bg-danger/10 text-danger border-danger/20' },
  idee:      { label: 'Idee',      cls: 'bg-info/10 text-info border-info/20' },
  allgemein: { label: 'Allgemein', cls: 'bg-muted text-muted-foreground border-border' },
}

function FeedbackPanel() {
  const queryClient = useQueryClient()
  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: () => req<any[]>('/feedback'),
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolved }: { id: number; resolved: boolean }) =>
      req<any>(`/feedback/${id}`, { method: 'PUT', body: JSON.stringify({ resolved }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }),
  })

  const openCount = feedback.filter((f: any) => !f.resolved).length

  return (
    <div className="rounded-xl border border-border/60 bg-card mb-6 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40">
          Nutzer-Feedback
        </p>
        {openCount > 0 && (
          <span className="text-[11px] font-bold text-warning tabular-nums">{openCount} offen</span>
        )}
      </div>
      {isLoading ? (
        <div className="px-5 pb-5 space-y-2.5">
          {[1, 2].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : feedback.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
          <p className="text-sm text-muted-foreground/60">Noch kein Feedback eingegangen</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
          {feedback.map((f: any) => {
            const cat = FEEDBACK_CATEGORY_LABELS[f.category] ?? FEEDBACK_CATEGORY_LABELS.allgemein
            return (
              <div key={f.id} className={cn('flex items-start gap-3 px-5 py-3', f.resolved && 'opacity-45')}>
                <Badge variant="outline" className={cn('text-[10px] shrink-0 mt-0.5', cat.cls)}>{cat.label}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{f.message}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {f.user_email || 'anonym'} · {f.page_path} · {f.created_at ? new Date(f.created_at).toLocaleString('de-DE') : ''}
                  </p>
                </div>
                <button
                  onClick={() => resolveMutation.mutate({ id: f.id, resolved: !f.resolved })}
                  title={f.resolved ? 'Wieder öffnen' : 'Als erledigt markieren'}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-[color,background-color] duration-150 active:scale-[0.88]"
                >
                  {f.resolved ? <Undo2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


/**
 * Betriebsübersicht: keine Zahlenwand, sondern Warnungen.
 *
 * Wer nachsieht, will wissen, ob etwas zu tun ist - nicht, wie viele Szenen
 * es gibt. Keine Warnung heisst: nichts zu tun.
 */
export function Betriebsuebersicht() {
  const { data } = useQuery({
    queryKey: ['betrieb'],
    queryFn: () => req<any>('/admin/betrieb'),
    refetchInterval: 60_000,
  })

  if (!data) return null

  const FARBE: Record<string, string> = {
    hoch: 'border-destructive/40 bg-destructive/5',
    mittel: 'border-amber-500/40 bg-amber-500/5',
    niedrig: 'border-border/60',
  }

  const dauer = (sekunden: number) => {
    if (sekunden < 60) return `${sekunden} s`
    if (sekunden < 3600) return `${Math.round(sekunden / 60)} min`
    if (sekunden < 86400) return `${Math.round(sekunden / 3600)} h`
    return `${Math.round(sekunden / 86400)} Tage`
  }

  return (
    <div className="space-y-3">
      {data.alles_in_ordnung ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm font-medium">Nichts zu tun</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mailversand, Sicherung, Papierkorb und Datenbank sind unauffällig.
          </p>
        </div>
      ) : (
        data.warnungen.map((w: any, i: number) => (
          <div key={i} className={`rounded-xl border px-4 py-3 ${FARBE[w.stufe] || FARBE.niedrig}`}>
            <p className="text-sm font-medium">{w.text}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{w.rat}</p>
          </div>
        ))
      )}

      <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Datenbank</p>
            <p className="tabular-nums">{data.datenbank_ms < 0 ? 'keine Antwort' : `${data.datenbank_ms} ms`}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Läuft seit</p>
            <p className="tabular-nums">{dauer(data.laufzeit_sekunden)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Arbeitsspeicher</p>
            <p className="tabular-nums">{data.speicher_mb} MB</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Mailserver</p>
            <p>{data.mailserver ? 'eingerichtet' : 'fehlt'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}


/**
 * Welche Bereiche in wie vielen Projekten Daten haben.
 *
 * Gezählt, nicht geschätzt: Hier standen vorher acht erfundene Prozentzahlen
 * mit dem Hinweis „Beispieldaten". Eine Zahl, die niemand nachrechnen kann,
 * ist in einer Betriebsübersicht schlimmer als keine.
 */
export function GenutzteBereiche() {
  const { data } = useQuery({
    queryKey: ['admin-nutzung'],
    queryFn: () => req<any>('/admin/nutzung'),
  })

  const bereiche = data?.bereiche || []
  const gesamt = data?.projekte_gesamt ?? 0

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-5">
        Genutzte Bereiche
      </p>
      <div className="space-y-4">
        {bereiche.map((b: any) => (
          <div key={b.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium">{b.name}</span>
              <span className="text-[11px] font-semibold text-muted-foreground/60 tabular-nums">
                {b.projekte} von {gesamt}
              </span>
            </div>
            <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/50 rounded-full transition-all duration-500"
                style={{ width: `${b.anteil}%` }}
              />
            </div>
          </div>
        ))}
        {bereiche.length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Daten.</p>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground/40 mt-5">
        In wie vielen Projekten der Bereich überhaupt Einträge hat.
      </p>
    </div>
  )
}
