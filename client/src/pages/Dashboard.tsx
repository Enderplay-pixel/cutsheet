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
import { useT } from '@/lib/useT'
import { dashT } from '@/lib/i18n'

function DonutRing({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={5} className="text-muted/60" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  )
}

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
  const tt = useT()

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
  const shotScenesProgress = stats ? Math.round((stats.shot_scenes / Math.max(stats.total_scenes, 1)) * 100) : 0

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
              <div className="text-xs text-muted-foreground">{tt(dashT.daysUntil)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label={tt(dashT.scenes)} value={stats?.total_scenes || 0}
          sub={`${stats?.scheduled_scenes || 0} ${tt(dashT.inPlan)}`} icon={Film} />
        <StatCard label={tt(dashT.shootDays)} value={stats?.total_shoot_days || 0}
          sub={`${stats?.completed_shoot_days || 0} ${tt(dashT.shot)}`} icon={Clapperboard}
          accent={daysUntilShoot !== null && daysUntilShoot <= 14} />
        <StatCard label={tt(dashT.cast)} value={stats?.total_cast || 0}
          sub={tt(dashT.mainCast)} icon={Users} />
        <StatCard label={tt(dashT.team)} value={stats?.total_crew || 0}
          sub={tt(dashT.crewMembers)} icon={Briefcase} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Progress card */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">{tt(dashT.progress)}</h2>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: tt(dashT.scheduleDone), pct: scheduleProgress, color: 'hsl(var(--primary))',
                  sub: tt(dashT.scenesScheduled).replace('{n}', stats?.scheduled_scenes).replace('{total}', stats?.total_scenes) },
                { label: tt(dashT.shootDaysDone), pct: shootProgress, color: '#3b82f6',
                  sub: tt(dashT.daysCompleted).replace('{n}', stats?.completed_shoot_days).replace('{total}', stats?.total_shoot_days) },
                { label: tt(dashT.scenesShot), pct: shotScenesProgress, color: '#22c55e',
                  sub: tt(dashT.scenesShootOf).replace('{n}', String(stats?.shot_scenes || 0)).replace('{total}', String(stats?.total_scenes)) },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/20">
                  <div className="relative">
                    <DonutRing value={item.pct} color={item.color} size={80} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold tabular-nums">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {stats?.budget_total_cents > 0 && (
              <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{tt(dashT.budget)}</div>
                  <div className="text-base font-semibold tabular-nums">
                    {formatCurrency(stats.budget_total_cents)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{tt(dashT.financing)}</div>
                  <div className={cn(
                    'text-base font-semibold tabular-nums',
                    financingOk ? 'text-green-400' : 'text-red-400'
                  )}>
                    {formatCurrency(stats.financing_total_cents || 0)}
                  </div>
                  {!financingOk && (
                    <div className="text-xs text-red-400/80 mt-0.5">
                      {tt(dashT.gap).replace('{n}', formatCurrency(budgetGap))}
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
                <span className="text-xs font-medium text-primary uppercase tracking-wide">{tt(dashT.nextShootDay)}</span>
              </div>
              <div className="text-lg font-semibold">{tt(dashT.day)} {stats.next_shoot_day.day_number}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                {formatDateLong(stats.next_shoot_day.date)}
              </div>
              {daysUntilShoot !== null && (
                <div className="text-xs text-muted-foreground mt-1">
                  {daysUntilShoot === 0 ? tt(dashT.today) : daysUntilShoot === 1 ? tt(dashT.tomorrow) : tt(dashT.inDays).replace('{n}', String(daysUntilShoot))}
                </div>
              )}
              <button
                onClick={() => navigate(`/projects/${projectId}/tagesdispo/${stats.next_shoot_day.id}`)}
                aria-label={tt(dashT.openCallSheet)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded-md py-1.5 transition-colors"
              >
                {tt(dashT.openCallSheet)} <ArrowRight className="w-3 h-3" />
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
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tt(dashT.conflictRadar)}</span>
            </div>

            {conflicts?.length === 0 ? (
              <p className="text-sm text-green-400 font-medium">{tt(dashT.noConflicts)}</p>
            ) : (
              <div className="space-y-1">
                {errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-red-400">{errors.length}</span>
                    <span className="text-xs text-muted-foreground">{tt(dashT.errors)}</span>
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-amber-400">{warnings.length}</span>
                    <span className="text-xs text-muted-foreground">{tt(dashT.warnings)}</span>
                  </div>
                )}
                {infos.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-400">{infos.length}</span>
                    <span className="text-xs text-muted-foreground">{tt(dashT.hints)}</span>
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
