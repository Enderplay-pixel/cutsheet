import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDateLong, cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Film, Users, Clapperboard, AlertTriangle, Calendar,
  DollarSign, MapPin, ArrowRight, ArrowUpRight, CheckCircle, AlertCircle,
  ChevronRight
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

function Figure({ label, value, sub, onClick }: {
  label: string; value: number | string; sub?: string; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-card px-5 py-5 sm:px-6 transition-colors duration-200 hover:bg-muted/60 focus-visible:bg-muted"
    >
      <div className="eyebrow">{label}</div>
      <div className="font-display text-[52px] leading-none mt-3 tabular-nums">{value}</div>
      {sub && (
        <div className="text-[12px] text-muted-foreground mt-2 flex items-center gap-1">
          {sub}
          <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-0.5 transition-[opacity,transform] duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
        </div>
      )}
    </button>
  )
}

function ProgressRow({ label, done, total, pct, tone }: {
  label: string; done: number; total: number; pct: number; tone: 'ink' | 'info' | 'success'
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2">
      <span className="text-[13px] font-medium">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
        {done}<span className="opacity-50"> / {total}</span>
        <span className="ml-3 text-foreground">{pct}%</span>
      </span>
      <div className="col-span-2 h-[6px] rounded-full bg-foreground/[0.07] overflow-hidden">
        <div
          className={cn('h-full rounded-full origin-left transition-transform duration-700 ease-out',
            tone === 'ink' ? 'bg-foreground' : tone === 'info' ? 'bg-info' : 'bg-success')}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
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
    <div className="page-container space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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

  const meta = [project?.format, project?.genre, project?.length_minutes ? `${project.length_minutes} Min.` : '']
    .filter(Boolean)
  const go = (path: string) => navigate(`/projects/${projectId}/${path}`)

  const jumps = [
    { label: 'Drehplan',   icon: Clapperboard, path: 'drehplan',   key: 'D' },
    { label: 'Tagesdispo', icon: Calendar,     path: 'tagesdispo', key: 'T' },
    { label: 'Szenen',     icon: Film,         path: 'drehbuch',   key: 'S' },
    { label: 'Besetzung',  icon: Users,        path: 'besetzung',  key: 'B' },
    { label: 'Motive',     icon: MapPin,       path: 'motive',     key: 'M' },
    { label: 'Budget',     icon: DollarSign,   path: 'budget',     key: 'G' },
  ]

  return (
    <div className="page-container" aria-label="Dashboard">

      {/* ── Kopf: Titel wie auf einem Deckblatt ──────────── */}
      <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8 lg:gap-12 pb-9 border-b border-border animate-fade-up">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {firstName && (
              <span className="text-[13px] text-muted-foreground mr-2">
                {greeting()}, <span className="text-foreground">{firstName}</span>
              </span>
            )}
            {project?.status && <span className="chip-primary">{project.status}</span>}
          </div>
          <h1 className="font-display text-[52px] sm:text-[68px] mt-4 break-words">
            {project?.title || 'Dashboard'}
          </h1>
          {meta.length > 0 && (
            <p className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground mt-4">
              {meta.join('  ·  ')}
            </p>
          )}
          {project?.synopsis && (
            <p className="text-[15px] text-muted-foreground mt-4 max-w-[58ch] leading-relaxed line-clamp-3">
              {project.synopsis}
            </p>
          )}
        </div>

        {/* Nächster Drehtag — die Zahl, in der eine Produktion denkt */}
        {stats?.next_shoot_day ? (
          <aside className="self-end rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{tt(dashT.nextShootDay)}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-signal" aria-hidden />
            </div>
            <div className="flex items-end justify-between gap-4 mt-4">
              <div>
                <div className="font-display text-[44px] leading-none">
                  {tt(dashT.day)} {stats.next_shoot_day.day_number}
                </div>
                <div className="text-[13px] text-muted-foreground mt-2">
                  {formatDateLong(stats.next_shoot_day.date)}
                </div>
              </div>
              {daysUntilShoot !== null && daysUntilShoot >= 0 && (
                <div className="text-right shrink-0">
                  <div className="font-mono text-[26px] leading-none tabular-nums text-signal">
                    {daysUntilShoot === 0 ? '0' : `T–${daysUntilShoot}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    {daysUntilShoot === 0
                      ? tt(dashT.today)
                      : daysUntilShoot === 1
                        ? tt(dashT.tomorrow)
                        : tt(dashT.inDays).replace('{n}', String(daysUntilShoot))}
                  </div>
                </div>
              )}
            </div>
            <Button
              className="w-full mt-5 justify-between"
              onClick={() => navigate(`/projects/${projectId}/tagesdispo/${stats.next_shoot_day.id}`)}
            >
              {tt(dashT.openCallSheet)}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </aside>
        ) : (
          <aside className="self-end rounded-xl border border-dashed border-border p-5">
            <span className="eyebrow">{tt(dashT.nextShootDay)}</span>
            <p className="font-display italic text-2xl text-muted-foreground mt-3">Noch kein Drehtag geplant</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => go('drehplan')}>
              Drehplan anlegen <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </aside>
        )}
      </header>

      {/* ── Kennzahlen als durchlaufende Zeile ───────────── */}
      <section
        aria-label="Kennzahlen"
        className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl border border-border bg-border overflow-hidden"
      >
        <Figure label={tt(dashT.scenes)} value={stats?.total_scenes ?? 0}
          sub={`${stats?.scheduled_scenes ?? 0} ${tt(dashT.inPlan)}`} onClick={() => go('drehbuch')} />
        <Figure label={tt(dashT.shootDays)} value={stats?.total_shoot_days ?? 0}
          sub={`${stats?.completed_shoot_days ?? 0} ${tt(dashT.shot)}`} onClick={() => go('drehplan')} />
        <Figure label={tt(dashT.cast)} value={stats?.total_cast ?? 0}
          sub={tt(dashT.mainCast)} onClick={() => go('besetzung')} />
        <Figure label={tt(dashT.team)} value={stats?.total_crew ?? 0}
          sub={tt(dashT.crewMembers)} onClick={() => go('stabliste')} />
      </section>

      {/* ── Stand & Lage ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 mt-5">

        <section className="rounded-xl border border-border bg-card p-6 sm:p-7">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[15px] font-semibold">{tt(dashT.progress)}</h2>
            <span className="eyebrow">Stand heute</span>
          </div>

          <div className="space-y-6 mt-7">
            <ProgressRow label={tt(dashT.scheduleDone)} tone="ink"
              done={stats?.scheduled_scenes ?? 0} total={stats?.total_scenes ?? 0} pct={scheduleProgress} />
            <ProgressRow label={tt(dashT.shootDaysDone)} tone="info"
              done={stats?.completed_shoot_days ?? 0} total={stats?.total_shoot_days ?? 0} pct={shootProgress} />
            <ProgressRow label={tt(dashT.scenesShot)} tone="success"
              done={stats?.shot_scenes ?? 0} total={stats?.total_scenes ?? 0} pct={shotScenesProgress} />
          </div>

          {stats?.budget_total_cents > 0 && (
            <div className="mt-8 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="eyebrow">{tt(dashT.budget)}</div>
                <div className="font-display text-[34px] leading-none mt-3 tabular-nums">
                  {formatCurrency(stats.budget_total_cents)}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <div className="eyebrow">{tt(dashT.financing)}</div>
                  <span className={cn('font-mono text-[11px] tabular-nums', financingOk ? 'text-success' : 'text-danger')}>
                    {financingPct}%
                  </span>
                </div>
                <div className="font-display text-[34px] leading-none mt-3 tabular-nums">
                  {formatCurrency(stats?.financing_total_cents || 0)}
                </div>
                <div className="h-[6px] bg-foreground/[0.07] rounded-full overflow-hidden mt-3">
                  <div
                    className={cn('h-full rounded-full origin-left transition-transform duration-700 ease-out', financingOk ? 'bg-success' : 'bg-danger')}
                    style={{ transform: `scaleX(${financingPct / 100})` }}
                  />
                </div>
                {!financingOk && (
                  <div className="text-[12px] text-danger mt-2 tabular-nums">
                    {tt(dashT.gap).replace('{n}', formatCurrency(budgetGap))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5">
          {/* Konfliktradar */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 px-5 pt-5">
              {errors.length > 0
                ? <AlertCircle className="w-3.5 h-3.5 text-danger" />
                : warnings.length > 0
                  ? <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  : <CheckCircle className="w-3.5 h-3.5 text-success" />}
              <h2 className="text-[15px] font-semibold">{tt(dashT.conflictRadar)}</h2>
            </div>

            {!conflicts?.length ? (
              <p className="px-5 pt-3 text-[13px] text-success">{tt(dashT.noConflicts)}</p>
            ) : (
              <dl className="px-5 pt-3 divide-y divide-border">
                {[
                  { n: errors.length, label: tt(dashT.errors), cls: 'bg-danger', text: 'text-danger' },
                  { n: warnings.length, label: tt(dashT.warnings), cls: 'bg-warning', text: 'text-warning' },
                  { n: infos.length, label: tt(dashT.hints), cls: 'bg-info', text: 'text-info' },
                ].filter(r => r.n > 0).map(r => (
                  <div key={r.label} className="flex items-center justify-between py-2.5">
                    <dt className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                      <span className={cn('w-1.5 h-1.5 rounded-full', r.cls)} />{r.label}
                    </dt>
                    <dd className={cn('font-mono text-[13px] tabular-nums', r.text)}>{r.n}</dd>
                  </div>
                ))}
              </dl>
            )}

            <button
              onClick={() => go('konfliktradar')}
              aria-label="Konfliktradar Details anzeigen"
              className="mt-3 w-full flex items-center justify-between border-t border-border px-5 py-3 text-[13px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.025] transition-colors duration-150 rounded-b-xl"
            >
              Details anzeigen
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </section>

          {/* Schnellzugriff mit den vorhandenen Tastenkürzeln */}
          <section className="rounded-xl border border-border bg-card py-2">
            <h2 className="eyebrow px-5 pt-3 pb-2">Schnellzugriff</h2>
            <ul>
              {jumps.map(item => (
                <li key={item.path}>
                  <button
                    onClick={() => go(item.path)}
                    aria-label={`Zu ${item.label} navigieren`}
                    className="group w-full flex items-center gap-3 px-5 h-10 text-[13px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.025] transition-colors duration-150"
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <kbd className="opacity-70 group-hover:opacity-100 transition-opacity">{item.key}</kbd>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
