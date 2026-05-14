import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, FolderOpen, Activity, Film, Server, TrendingUp, ShieldCheck } from 'lucide-react'

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

const FEATURE_USAGE = [
  { name: 'Drehplan', usage: 94 },
  { name: 'Shotlist', usage: 87 },
  { name: 'Tagesdispo', usage: 82 },
  { name: 'Budget', usage: 71 },
  { name: 'Besetzung', usage: 68 },
  { name: 'Equipment', usage: 55 },
  { name: 'Drehbuch-Editor', usage: 43 },
  { name: 'Kameraberichte', usage: 31 },
]

function StatCard({ label, value, icon: Icon, sub, accent }: { label: string; value: string | number; icon: any; sub?: string; accent?: boolean }) {
  return (
    <Card className={accent ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent ? 'bg-primary/15' : 'bg-muted/60'}`}>
            <Icon className={`w-5 h-5 ${accent ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className={`text-3xl font-bold tabular-nums ${accent ? 'text-primary' : ''}`}>{value}</div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">{label}</div>
            {sub && <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
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
    if (p.shoot_end && new Date(p.shoot_end) >= thirtyDaysAgo && new Date(p.shoot_start) <= now) return true
    return false
  }).length

  const recentUsers = [...(users || [])].sort((a: any, b: any) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  ).slice(0, 10)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Admin-Statistiken</h1>
          <p className="text-sm text-muted-foreground">Plattformübersicht und Nutzungsanalyse</p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">Admin</Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {projectsLoading ? (
          <>
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard label="Projekte gesamt" value={totalProjects} icon={FolderOpen} />
            <StatCard label="Nutzer gesamt" value={totalUsers} icon={Users} accent />
            <StatCard label="Aktive Produktionen" value={activeProductions} icon={Film} sub="in den letzten 30 Tagen" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Meistgenutzte Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {FEATURE_USAGE.map(f => (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{f.usage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${f.usage}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">* Statische Beispieldaten. Backend-Tracking wird in Kürze implementiert.</p>
          </CardContent>
        </Card>

        {/* Project status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Projekte nach Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <>
                {(() => {
                  const statusCounts: Record<string, number> = {}
                  ;(projects || []).forEach((p: any) => {
                    const s = p.status || 'Unbekannt'
                    statusCounts[s] = (statusCounts[s] || 0) + 1
                  })
                  const STATUS_COLORS: Record<string, string> = {
                    'Entwicklung': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                    'Vorproduktion': 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
                    'Produktion': 'bg-green-500/10 text-green-700 border-green-500/20',
                    'Postproduktion': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
                    'Abgeschlossen': 'bg-muted text-muted-foreground border-border',
                  }
                  return (
                    <div className="space-y-2">
                      {Object.entries(statusCounts).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[status] || 'bg-muted text-muted-foreground border-border'}`}>{status}</Badge>
                          <span className="text-sm font-semibold">{count}</span>
                        </div>
                      ))}
                      {Object.keys(statusCounts).length === 0 && (
                        <p className="text-sm text-muted-foreground">Keine Projekte</p>
                      )}
                    </div>
                  )
                })()}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent registrations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Neueste Registrierungen
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {usersLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">E-Mail</th>
                    <th className="text-left p-3 font-medium">Rolle</th>
                    <th className="text-left p-3 font-medium">Registriert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">Keine Nutzer gefunden</td>
                    </tr>
                  )}
                  {recentUsers.map((user: any) => (
                    <tr key={user.id} className="hover:bg-muted/20">
                      <td className="p-3 font-medium">{user.name || user.username || '–'}</td>
                      <td className="p-3 text-muted-foreground">{user.email || '–'}</td>
                      <td className="p-3">
                        {user.role === 'admin'
                          ? <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">Admin</Badge>
                          : <Badge variant="outline" className="text-xs">Nutzer</Badge>
                        }
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('de-DE') : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Server info placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            Server-Informationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Umgebung', value: 'Production' },
              { label: 'Node.js', value: '20.x' },
              { label: 'Datenbank', value: 'SQLite' },
              { label: 'API-Version', value: 'v1' },
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{item.label}</div>
                <div className="font-mono text-sm">{item.value}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">* Detaillierte Server-Metriken werden über den <code className="font-mono">/api/admin/stats</code>-Endpoint bereitgestellt (in Kürze verfügbar).</p>
        </CardContent>
      </Card>
    </div>
  )
}
