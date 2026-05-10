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
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.23, 1, 0.32, 1)' }}
      />
    </svg>
  )
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: number | string; sub?: string; icon: any; accent?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 transition-[border-color] duration-150',
      accent
        ? 'bg-primary/8 border-primary/25'
        : 'bg-card border-border/70 hover:border-border'
    )}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.07em]">{label}</span>
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center',
          accent ? 'bg-primary/15' : 'bg-muted/60'
        )}>
          <Icon className={cn('w-3.5 h-3.5', accent ? 'text-primary' : 'text-muted-foreground/70')} />
        </div>
      </div>
      <div className={cn('text-[2rem] font-bold tabular-nums tracking-tight leading-none', accent && 'text-primary')}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-2 font-medium">{sub}</div>}
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
      <Skeleton className="h-8 w-52" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
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
            <h1 className="text-2xl font-bold tracking-tight">{project?.title || 'Dashboard'}</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              {[project?.format, project?.genre, project?.length_minutes ? `${project.length_minutes} Min.` : '']
                .filter(Boolean).join(' · ')}
            </p>
            {project?.synopsis && (
              <p className="text-sm text-muted-foreground/60 mt-2 max-w-xl line-clamp-2">{project.synopsis}</p>
            )}
          </div>
          {daysUntilShoot !== null && daysUntilShoot >= 0 && (
            <div className="text-right shrink-0 ml-6">
              <div className="text-4xl font-bold tabular-nums text-primary leading-none">{daysUntilShoot}</div>
              <div className="text-xs text-muted-foreground mt-1 font-medium">{tt(dashT.daysUntil)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats row — staggered */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger">
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
        <div className="lg:col-span-2 bg-card border border-border/70 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-muted-foreground/60" />
            <h2 className="text-sm font-semibold tracking-tight">{tt(dashT.progress)}</h2>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: tt(dashT.scheduleDone), pct: scheduleProgress, color: 'hsl(var(--primary))',
                  sub: tt(dashT.scenesScheduled).replace('{n}', stats?.scheduled_scenes).replace('{total}', stats?.total_scenes) },
                { label: tt(dashT.shootDaysDone), pct: shootProgress, color: '#3b82f6',
                  sub: tt(dashT.daysCompleted).replace('{n}', stats?.completed_shoot_days).replace('{total}', stats?.total_shoot_days) },
                { label: tt(dashT.scenesShot), pct: shotScenesProgress, color: '#22c55e',
                  sub: tt(dashT.scenesShootOf).replace('{n}', String(stats?.shot_scenes || 0)).replace('{total}', String(stats?.total_scenes)) },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/20 border border-border/40">
                  <div className="relative">
                    <DonutRing value={item.pct} color={item.color} size={80} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold tabular-nums">{item.pct}%</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {stats?.budget_total_cents > 0 && (
              <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1.5 font-medium uppercase tracking-[0.06em]">{tt(dashT.budget)}</div>
                  <div className="text-lg font-bold tabular-nums tracking-tight">
                    {formatCurrency(stats.budget_total_cents)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1.5 font-medium uppercase tracking-[0.06em]">{tt(dashT.financing)}</div>
                  <div className={cn(
                    'text-lg font-bold tabular-nums tracking-tight',
                    financingOk ? 'text-green-400' : 'text-red-400'
                  )}>
                    {formatCurrency(stats.financing_total_cents || 0)}
                  </div>
                  {!financingOk && (
                    <div className="text-[11px] text-red-400/80 mt-0.5 font-medium">
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
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.08em]">{tt(dashT.nextShootDay)}</span>
              </div>
              <div className="text-xl font-bold tracking-tight">{tt(dashT.day)} {stats.next_shoot_day.day_number}</div>
              <div className="text-sm text-muted-foreground mt-0.5 font-medium">
                {formatDateLong(stats.next_shoot_day.date)}
              </div>
              {daysUntilShoot !== null && (
                <div className="text-xs text-muted-foreground/70 mt-1">
                  {daysUntilShoot === 0 ? tt(dashT.today) : daysUntilShoot === 1 ? tt(dashT.tomorrow) : tt(dashT.inDays).replace('{n}', String(daysUntilShoot))}
                </div>
              )}
              <button
                onClick={() => navigate(`/projects/${projectId}/tagesdispo/${stats.next_shoot_day.id}`)}
                aria-label={tt(dashT.openCallSheet)}
                className="mt-4 w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/25 hover:border-primary/50 hover:bg-primary/5 rounded-lg py-2 transition-[background-color,border-color,color] duration-150 font-medium active:scale-[0.97]"
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
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{tt(dashT.conflictRadar)}</span>
            </div>

            {conflicts?.length === 0 ? (
              <p className="text-sm text-green-400 font-semibold">{tt(dashT.noConflicts)}</p>
            ) : (
              <div className="space-y-1.5">
                {errors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-red-400 tabular-nums">{errors.length}</span>
                    <span className="text-xs text-muted-foreground font-medium">{tt(dashT.errors)}</span>
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-400 tabular-nums">{warnings.length}</span>
                    <span className="text-xs text-muted-foreground font-medium">{tt(dashT.warnings)}</span>
                  </div>
                )}
                {infos.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-400 tabular-nums">{infos.length}</span>
                    <span className="text-xs text-muted-foreground font-medium">{tt(dashT.hints)}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => navigate(`/projects/${projectId}/konfliktradar`)}
              aria-label="Konfliktradar Details anzeigen"
              className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground border border-border/60 hover:border-border rounded-lg py-2 transition-[background-color,border-color,color] duration-150 font-medium active:scale-[0.97]"
            >
              Details anzeigen
            </button>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/50 mb-3">
          Schnellzugriff
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 stagger">
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
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-[background-color,border-color,transform] duration-150 group active:scale-[0.96]"
            >
              <item.icon className="w-[18px] h-[18px] text-muted-foreground/60 group-hover:text-primary transition-colors duration-150" />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-150 font-medium">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
