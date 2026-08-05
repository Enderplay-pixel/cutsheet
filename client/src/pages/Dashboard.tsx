import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDateLong, cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Film, Users, Briefcase, Clapperboard, AlertTriangle, Calendar,
  DollarSign, MapPin, ArrowRight, Clock, CheckCircle, AlertCircle,
  TrendingUp, ChevronRight
} from 'lucide-react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useT } from '@/lib/useT'
import { dashT } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { track } from '@/lib/analytics'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

function DonutRing({ value, color, size = 96 }: { value: number; color: string; size?: number }) {
  const strokeWidth = 7
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor"
        strokeWidth={strokeWidth} className="text-muted/50" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.23, 1, 0.32, 1)' }}
      />
    </svg>
  )
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: number | string; sub?: string; icon: any; accent?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border p-5 card-lift group',
      accent
        ? 'bg-primary/8 border-primary/25'
        : 'bg-card border-border/60 hover:border-border'
    )}>
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center mb-4 transition-colors duration-200',
        accent ? 'bg-primary/15' : 'bg-muted/50 group-hover:bg-muted'
      )}>
        <Icon className={cn('w-[17px] h-[17px]', accent ? 'text-primary' : 'text-muted-foreground/70')} />
      </div>
      <div className={cn(
        'text-[2.25rem] font-bold tabular-nums tracking-tight leading-none',
        accent && 'text-primary'
      )}>
        {value}
      </div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mt-2">
        {label}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground/55 mt-1 font-medium">{sub}</div>}
    </div>
  )
}

export function Component() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const tt = useT()
  const { user } = useAuth()
  const firstName = (user?.name || '').split(' ')[0]

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(Number(projectId))
  })

  // Aktivierungs-Funnel: Öffnen des Demo-Projekts ist ein Schlüssel-Event
  useEffect(() => {
    if (project?.is_demo) track('demo_project_opened')
  }, [project?.is_demo])
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
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-72 lg:col-span-2 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )

  const scheduleProgress = stats
    ? Math.round((stats.scheduled_scenes / Math.max(stats.total_scenes, 1)) * 100) : 0
  const shootProgress = stats
    ? Math.round((stats.completed_shoot_days / Math.max(stats.total_shoot_days, 1)) * 100) : 0
  const shotScenesProgress = stats
    ? Math.round((stats.shot_scenes / Math.max(stats.total_scenes, 1)) * 100) : 0

  const errors   = (conflicts || []).filter((c: any) => c.severity === 'error')
  const warnings = (conflicts || []).filter((c: any) => c.severity === 'warning')
  const infos    = (conflicts || []).filter((c: any) => c.severity === 'info')

  const daysUntilShoot = stats?.next_shoot_day?.date
    ? differenceInCalendarDays(parseISO(stats.next_shoot_day.date), new Date())
    : null

  const budgetGap = (stats?.budget_total_cents || 0) - (stats?.financing_total_cents || 0)
  const financingOk = budgetGap <= 0
  const financingPct = stats?.budget_total_cents > 0
    ? Math.min(100, Math.round(((stats?.financing_total_cents || 0) / stats.budget_total_cents) * 100))
    : 0

  const rings = [
    {
      label: tt(dashT.scheduleDone),
      pct: scheduleProgress,
      color: 'hsl(var(--primary))',
      sub: `${stats?.scheduled_scenes ?? 0} / ${stats?.total_scenes ?? 0}`,
    },
    {
      label: tt(dashT.shootDaysDone),
      pct: shootProgress,
      color: 'hsl(var(--info))',
      sub: `${stats?.completed_shoot_days ?? 0} / ${stats?.total_shoot_days ?? 0}`,
    },
    {
      label: tt(dashT.scenesShot),
      pct: shotScenesProgress,
      color: 'hsl(var(--success))',
      sub: `${stats?.shot_scenes ?? 0} / ${stats?.total_scenes ?? 0}`,
    },
  ]

  return (
    <div className="p-7 max-w-6xl mx-auto animate-fade-up" role="main" aria-label="Dashboard">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="mb-8 pb-7 border-b border-border/40">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            {firstName && (
              <p className="text-[13px] text-muted-foreground/60 mb-1">
                {greeting()}, <span className="text-muted-foreground font-medium">{firstName}</span>
              </p>
            )}
            <h1 className="text-[1.85rem] font-bold tracking-tight leading-tight">
              {project?.title || 'Dashboard'}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {[project?.format, project?.genre, project?.length_minutes ? `${project.length_minutes} Min.` : '']
                .filter(Boolean).map((chip, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted/60 text-muted-foreground border border-border/50">
                    {chip}
                  </span>
                ))}
              {project?.status && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  {project.status}
                </span>
              )}
            </div>
            {project?.synopsis && (
              <p className="text-sm text-muted-foreground/60 mt-3 max-w-xl line-clamp-2 leading-relaxed">
                {project.synopsis}
              </p>
            )}
          </div>

          {daysUntilShoot !== null && daysUntilShoot >= 0 && (
            <div className="shrink-0 flex flex-col items-center px-6 py-5 rounded-2xl border border-primary/20 bg-primary/5">
              <div className="text-5xl font-black tabular-nums text-primary leading-none tracking-tight">
                {daysUntilShoot}
              </div>
              <div className="text-[10px] text-muted-foreground font-bold mt-2 uppercase tracking-[0.09em] text-center whitespace-nowrap">
                {tt(dashT.daysUntil)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger">
        <StatCard
          label={tt(dashT.scenes)}
          value={stats?.total_scenes ?? 0}
          sub={`${stats?.scheduled_scenes ?? 0} ${tt(dashT.inPlan)}`}
          icon={Film}
        />
        <StatCard
          label={tt(dashT.shootDays)}
          value={stats?.total_shoot_days ?? 0}
          sub={`${stats?.completed_shoot_days ?? 0} ${tt(dashT.shot)}`}
          icon={Clapperboard}
          accent={daysUntilShoot !== null && daysUntilShoot <= 14}
        />
        <StatCard
          label={tt(dashT.cast)}
          value={stats?.total_cast ?? 0}
          sub={tt(dashT.mainCast)}
          icon={Users}
        />
        <StatCard
          label={tt(dashT.team)}
          value={stats?.total_crew ?? 0}
          sub={tt(dashT.crewMembers)}
          icon={Briefcase}
        />
      </div>

      {/* ── Main grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Progress card */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-4 h-4 text-muted-foreground/50" />
            <h2 className="text-sm font-semibold tracking-tight">{tt(dashT.progress)}</h2>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {rings.map(ring => (
              <div key={ring.label}
                className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/15 border border-border/30">
                <div className="relative">
                  <DonutRing value={ring.pct} color={ring.color} size={96} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[15px] font-bold tabular-nums">{ring.pct}%</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-foreground leading-snug">{ring.label}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 tabular-nums">{ring.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {stats?.budget_total_cents > 0 && (
            <div className="pt-5 border-t border-border/40 grid grid-cols-2 gap-5">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.09em] mb-1.5">
                  {tt(dashT.budget)}
                </div>
                <div className="text-xl font-bold tabular-nums tracking-tight">
                  {formatCurrency(stats.budget_total_cents)}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.09em]">
                    {tt(dashT.financing)}
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold tabular-nums',
                    financingOk ? 'text-success' : 'text-danger'
                  )}>
                    {financingPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mb-2">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-700',
                      financingOk ? 'bg-success' : 'bg-danger'
                    )}
                    style={{ width: `${financingPct}%` }}
                  />
                </div>
                <div className={cn(
                  'text-[13px] font-bold tabular-nums tracking-tight',
                  financingOk ? 'text-success' : 'text-danger'
                )}>
                  {formatCurrency(stats?.financing_total_cents || 0)}
                </div>
                {!financingOk && (
                  <div className="text-[11px] text-danger/70 mt-0.5">
                    {tt(dashT.gap).replace('{n}', formatCurrency(budgetGap))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Next shoot day */}
          {stats?.next_shoot_day && (
            <div className="bg-card border border-primary/20 rounded-xl p-5 relative overflow-hidden">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary)/0.08) 0%, transparent 60%)' }}
              />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-4">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.09em]">
                    {tt(dashT.nextShootDay)}
                  </span>
                </div>
                <div className="text-4xl font-black tabular-nums text-foreground leading-none mb-1">
                  {tt(dashT.day)} {stats.next_shoot_day.day_number}
                </div>
                <div className="text-sm text-muted-foreground font-medium mt-1.5">
                  {formatDateLong(stats.next_shoot_day.date)}
                </div>
                {daysUntilShoot !== null && (
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {daysUntilShoot === 0
                      ? tt(dashT.today)
                      : daysUntilShoot === 1
                        ? tt(dashT.tomorrow)
                        : tt(dashT.inDays).replace('{n}', String(daysUntilShoot))}
                  </div>
                )}
                <button
                  onClick={() => navigate(`/projects/${projectId}/tagesdispo/${stats.next_shoot_day.id}`)}
                  aria-label={tt(dashT.openCallSheet)}
                  className="mt-4 w-full flex items-center justify-between gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/25 hover:border-primary/50 hover:bg-primary/5 rounded-lg px-3 py-2.5 transition-[background-color,border-color,color] duration-150 font-semibold active:scale-[0.97]"
                >
                  {tt(dashT.openCallSheet)}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Conflict radar */}
          <div className={cn(
            'bg-card border rounded-xl p-5',
            errors.length > 0
              ? 'border-danger/20'
              : warnings.length > 0
                ? 'border-warning/20'
                : 'border-success/20'
          )}>
            <div className="flex items-center gap-2 mb-3.5">
              {errors.length > 0
                ? <AlertCircle className="w-3.5 h-3.5 text-danger" />
                : warnings.length > 0
                  ? <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  : <CheckCircle className="w-3.5 h-3.5 text-success" />
              }
              <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                {tt(dashT.conflictRadar)}
              </span>
            </div>

            {!conflicts?.length ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                <p className="text-sm text-success font-semibold">{tt(dashT.noConflicts)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {errors.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                      <span className="text-xs text-muted-foreground font-medium">{tt(dashT.errors)}</span>
                    </div>
                    <span className="text-sm font-bold text-danger tabular-nums">{errors.length}</span>
                  </div>
                )}
                {warnings.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                      <span className="text-xs text-muted-foreground font-medium">{tt(dashT.warnings)}</span>
                    </div>
                    <span className="text-sm font-bold text-warning tabular-nums">{warnings.length}</span>
                  </div>
                )}
                {infos.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-info shrink-0" />
                      <span className="text-xs text-muted-foreground font-medium">{tt(dashT.hints)}</span>
                    </div>
                    <span className="text-sm font-bold text-info tabular-nums">{infos.length}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => navigate(`/projects/${projectId}/konfliktradar`)}
              aria-label="Konfliktradar Details anzeigen"
              className="mt-4 w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border rounded-lg px-3 py-2.5 transition-[background-color,border-color,color] duration-150 font-medium active:scale-[0.97]"
            >
              Details anzeigen
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick links ──────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/40 mb-3">
          Schnellzugriff
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 stagger">
          {[
            { label: 'Drehplan',   icon: Clapperboard, path: 'drehplan',   color: 'text-primary',    bg: 'bg-primary/8' },
            { label: 'Szenen',     icon: Film,         path: 'drehbuch',   color: 'text-blue-400',   bg: 'bg-blue-500/8' },
            { label: 'Besetzung',  icon: Users,        path: 'besetzung',  color: 'text-purple-400', bg: 'bg-purple-500/8' },
            { label: 'Motive',     icon: MapPin,       path: 'motive',     color: 'text-green-400',  bg: 'bg-green-500/8' },
            { label: 'Budget',     icon: DollarSign,   path: 'budget',     color: 'text-amber-400',  bg: 'bg-amber-500/8' },
            { label: 'Tagesdispo', icon: Calendar,     path: 'tagesdispo', color: 'text-cyan-400',   bg: 'bg-cyan-500/8' },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => navigate(`/projects/${projectId}/${item.path}`)}
              aria-label={`Zu ${item.label} navigieren`}
              className="group flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border/50 hover:border-border bg-card hover:bg-muted/20 transition-[background-color,border-color,transform] duration-150 active:scale-[0.96]"
            >
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110',
                item.bg
              )}>
                <item.icon className={cn('w-4 h-4', item.color)} />
              </div>
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors duration-150 font-semibold">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
