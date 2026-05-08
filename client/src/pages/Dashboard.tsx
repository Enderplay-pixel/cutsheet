import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDateLong, cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Film, Users, Briefcase, Clapperboard, AlertTriangle, Calendar,
  DollarSign, MapPin, ArrowRight, Clock, CheckCircle, AlertCircle,
  TrendingUp
} from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: number | string; sub?: string; icon: any; accent?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 transition-colors',
      accent
        ? 'bg-primary/8 border-primary/20'
        : 'bg-card border-border/60 hover:border-border'
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <Icon className={cn('w-4 h-4', accent ? 'text-primary' : 'text-muted-foreground/60')} />
      </div>
      <div className={cn('text-3xl font-bold tabular-nums tracking-tight', accent && 'text-primary')}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>}
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(Number(projectId))
  })
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', projectId],
    queryFn: () => api.projects.stats(Number(projectId))
  })
  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', projectId],
    queryFn: () => api.conflicts(Number(projectId))
  })

  if (isLoading) return (
    <div className="p-7 max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
    </div>
  )

  const scheduleProgress = stats ? Math.round((stats.scheduled_scenes / Math.max(stats.total_scenes, 1)) * 100) : 0
  const shootProgress = stats ? Math.round((stats.completed_shoot_days / Math.max(stats.total_shoot_days, 1)) * 100) : 0

  // Fix: use severity not type
  const errors   = (conflicts || []).filter((c: any) => c.severity === 'error')
  const warnings = (conflicts || []).filter((c: any) => c.severity === 'warning')
  const infos    = (conflicts || []).filter((c: any) => c.severity === 'info')

  const daysUntilShoot = stats?.next_shoot_day?.date
    ? differenceInDays(parseISO(stats.next_shoot_day.date), new Date())
    : null

  const budgetGap = (stats?.budget_total_cents || 0) - (stats?.financing_total_cents || 0)
  const financingOk = budgetGap <= 0

  return (
    <div className="p-7 max-w-6xl mx-auto animate-fade-up" role="main" aria-label="Dashboard">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project?.title || 'Dashboard'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {[project?.format, project?.genre, project?.length_minutes ? `${project.length_minutes} Min.` : '']
                .filter(Boolean).join(' · ')}
            </p>
            {project?.synopsis && (
              <p className="text-sm text-muted-foreground/70 mt-2 max-w-xl line-clamp-2">{project.synopsis}</p>
            )}
          </div>
          {daysUntilShoot !== null && daysUntilShoot >= 0 && (
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums text-primary">{daysUntilShoot}</div>
              <div className="text-xs text-muted-foreground">Tage bis Drehtag 1</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Szenen" value={stats?.total_scenes || 0}
          sub={`${stats?.scheduled_scenes || 0} im Drehplan`} icon={Film} />
        <StatCard label="Drehtage" value={stats?.total_shoot_days || 0}
          sub={`${stats?.completed_shoot_days || 0} abgedreht`} icon={Clapperboard}
          accent={daysUntilShoot !== null && daysUntilShoot <= 14} />
        <StatCard label="Darsteller" value={stats?.total_cast || 0}
          sub="Hauptbesetzung" icon={Users} />
        <StatCard label="Team" value={stats?.total_crew || 0}
          sub="Stabmitglieder" icon={Briefcase} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Progress card */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Produktionsfortschritt</h2>
          </div>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Drehplan vollständig</span>
                <span className="text-sm font-semibold tabular-nums">{scheduleProgress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${scheduleProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {stats?.scheduled_scenes} von {stats?.total_scenes} Szenen eingeplant
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Drehtage abgeschlossen</span>
                <span className="text-sm font-semibold tabular-nums">{shootProgress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-700"
                  style={{ width: `${shootProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {stats?.completed_shoot_days} von {stats?.total_shoot_days} Drehtagen
              </p>
            </div>

            {stats?.budget_total_cents > 0 && (
              <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Budget</div>
                  <div className="text-base font-semibold tabular-nums">
                    {formatCurrency(stats.budget_total_cents)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Finanzierung</div>
                  <div className={cn(
                    'text-base font-semibold tabular-nums',
                    financingOk ? 'text-green-400' : 'text-red-400'
                  )}>
                    {formatCurrency(stats.financing_total_cents || 0)}
                  </div>
                  {!financingOk && (
                    <div className="text-xs text-red-400/80 mt-0.5">
                      −{formatCurrency(budgetGap)} Lücke
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Next shoot day */}
          {stats?.next_shoot_day && (
            <div className="bg-card border border-primary/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-wide">Nächster Drehtag</span>
              </div>
              <div className="text-lg font-semibold">Tag {stats.next_shoot_day.day_number}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {formatDateLong(stats.next_shoot_day.date)}
              </div>
              {daysUntilShoot !== null && (
                <div className="text-xs text-muted-foreground mt-1">
                  {daysUntilShoot === 0 ? 'Heute!' : daysUntilShoot === 1 ? 'Morgen' : `In ${daysUntilShoot} Tagen`}
                </div>
              )}
              <button
                onClick={() => navigate(`/projects/${projectId}/tagesdispo/${stats.next_shoot_day.id}`)}
                aria-label="Tagesdispo öffnen"
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded-md py-1.5 transition-colors"
              >
                Tagesdispo öffnen <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Conflict summary */}
          <div className={cn(
            'bg-card border rounded-xl p-5',
            errors.length > 0 ? 'border-red-500/20' : warnings.length > 0 ? 'border-amber-500/20' : 'border-green-500/20'
          )}>
            <div className="flex items-center gap-2 mb-3">
              {errors.length > 0
                ? <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                : warnings.length > 0
                  ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  : <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              }
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Konfliktradar</span>
            </div>

            {conflicts?.length === 0 ? (
              <p className="text-sm text-green-400 font-medium">Keine Konflikte</p>
            ) : (
              <div className="space-y-1">
                {errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-red-400">{errors.length}</span>
                    <span className="text-xs text-muted-foreground">Fehler</span>
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-400">{warnings.length}</span>
                    <span className="text-xs text-muted-foreground">Warnungen</span>
                  </div>
                )}
                {infos.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-400">{infos.length}</span>
                    <span className="text-xs text-muted-foreground">Hinweise</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => navigate(`/projects/${projectId}/konfliktradar`)}
              aria-label="Konfliktradar Details anzeigen"
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground border border-border/60 hover:border-border rounded-md py-1.5 transition-colors"
            >
              Details anzeigen
            </button>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
          Schnellzugriff
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: 'Drehplan', icon: Clapperboard, path: 'drehplan' },
            { label: 'Szenen', icon: Film, path: 'drehbuch' },
            { label: 'Besetzung', icon: Users, path: 'besetzung' },
            { label: 'Motive', icon: MapPin, path: 'motive' },
            { label: 'Budget', icon: DollarSign, path: 'budget' },
            { label: 'Tagesdispo', icon: Calendar, path: 'tagesdispo' },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => navigate(`/projects/${projectId}/${item.path}`)}
              aria-label={`Zu ${item.label} navigieren`}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <item.icon className="w-5 h-5 text-muted-foreground/70 group-hover:text-primary transition-colors" />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
