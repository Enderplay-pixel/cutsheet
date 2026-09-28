import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDateLong, cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Film, Users, Clapperboard, AlertTriangle, Calendar,
  DollarSign, MapPin, ArrowRight, CheckCircle, AlertCircle,
  ChevronRight, Video, Lightbulb, Activity, Megaphone
} from 'lucide-react'
import { isCreatorProject } from '@/lib/projectKind'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useT } from '@/lib/useT'
import { dashT } from '@/lib/i18n'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { useCountUp, useEntered } from '@/lib/motion'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

function Figure({ label, value, sub, onClick, format }: {
  label: string; value: number | string; sub?: string; onClick?: () => void
  /** Anzeige des hochgezählten Werts, etwa als Währung */
  format?: (n: number) => string
}) {
  const shown = useCountUp(value)
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-card px-5 py-5 sm:px-6 transition-colors duration-200 hover:bg-foreground/[0.025] focus-visible:bg-foreground/[0.04]"
    >
      <div className="eyebrow">{label}</div>
      <div className="font-display text-[40px] leading-none mt-2.5 tabular-nums">{format ? format(Math.round(shown)) : Math.round(shown).toLocaleString('de-DE')}</div>
      {sub && (
        <div className="text-[12px] text-muted-foreground mt-2 flex items-center gap-1">
          {sub}
          <ChevronRight className="w-3 h-3 opacity-0 -translate-x-0.5 transition-[opacity,transform] duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
        </div>
      )}
    </button>
  )
}

function ProgressRow({ label, done, total, pct, tone, delay = 0 }: {
  label: string; done: number; total: number; pct: number; tone: 'ink' | 'info' | 'success'; delay?: number
}) {
  const entered = useEntered(120 + delay)
  const shownPct = useCountUp(pct, 1000)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2">
      <span className="text-[13px] font-medium">{label}</span>
      <span className="text-[13px] tabular-nums text-muted-foreground">
        {done} von {total}
        <span className="ml-3 font-semibold text-foreground">{Math.round(shownPct)}%</span>
      </span>
      <div className="col-span-2 h-2 rounded-full bg-foreground/[0.07] overflow-hidden">
        <div
          className={cn('h-full rounded-full origin-left transition-transform duration-1000 ease-smooth',
            tone === 'success' && pct >= 100 ? 'bg-success' : 'bg-foreground/80')}
          style={{ transform: `scaleX(${entered ? pct / 100 : 0})` }}
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

  // Creator-Projekte zeigen Kanal-Kennzahlen statt Szenen und Drehtagen -
  // vorher standen dort vier Nullen aus der Filmwelt.
  const creatorProjekt = isCreatorProject(project)
  const { data: kanal } = useQuery({
    queryKey: ['creator-overview', projectId],
    queryFn: () => api.creator.overview(Number(projectId)),
    enabled: !!projectId && creatorProjekt,
  })

  // Hooks vor dem frühen Return: Balken gleiten ein, Beträge zählen hoch
  const entered = useEntered(360)
  const budgetShown = useCountUp(stats?.budget_total_cents || 0, 1100)
  const financingShown = useCountUp(stats?.financing_total_cents || 0, 1100)

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

  const isCreator = creatorProjekt
  const heuteIso = new Date().toISOString().slice(0, 10)
  const naechstesVideo = (kanal?.calendar ?? []).find((e: any) => !e.published && e.date && e.date >= heuteIso)
  const tageBisVideo = naechstesVideo ? differenceInCalendarDays(parseISO(naechstesVideo.date), new Date()) : null
  const veroeffentlichtPct = kanal?.video_count ? Math.round((kanal.published_count / kanal.video_count) * 100) : 0
  const geplantPct = kanal?.video_count ? Math.round((kanal.planned_count / kanal.video_count) * 100) : 0
  const filmJumps = [
    { label: 'Drehplan',   icon: Clapperboard, path: 'drehplan',   key: 'D' },
    { label: 'Tagesdispo', icon: Calendar,     path: 'tagesdispo', key: 'T' },
    { label: 'Szenen',     icon: Film,         path: 'drehbuch',   key: 'S' },
    { label: 'Besetzung',  icon: Users,        path: 'besetzung',  key: 'B' },
    { label: 'Motive',     icon: MapPin,       path: 'motive',     key: 'M' },
    { label: 'Budget',     icon: DollarSign,   path: 'budget',     key: 'G' },
  ]
  // Creator-Projekte haben eigene Bereiche; Drehplan und Szenen gibt es dort nicht
  const creatorJumps = [
    { label: 'Videos',          icon: Video,        path: 'creator',                key: '' },
    { label: 'Ideen',           icon: Lightbulb,    path: 'creator/ideen',          key: '' },
    { label: 'Redaktionsplan',  icon: Calendar,     path: 'creator/redaktionsplan', key: '' },
    { label: 'Kanal',           icon: Activity,     path: 'creator/kanal',          key: '' },
    { label: 'Sponsoren',       icon: Megaphone,    path: 'creator/sponsoren',      key: '' },
    { label: 'Budget',          icon: DollarSign,   path: 'budget',                 key: 'G' },
  ]
  const jumps = isCreator ? creatorJumps : filmJumps

  return (
    <div className="page-container" aria-label="Dashboard">

      {/* ── Kopf: Titel wie auf einem Deckblatt ──────────── */}
      <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-12 pt-2 animate-fade-up">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {firstName && (
              <span className="text-[13px] text-muted-foreground mr-2">
                {greeting()}, <span className="text-foreground">{firstName}</span>
              </span>
            )}
            {project?.status && <span className="chip-primary">{project.status}</span>}
          </div>
          <h1 className="font-display text-[40px] sm:text-[56px] mt-3 break-words">
            {project?.title || 'Dashboard'}
          </h1>
          {meta.length > 0 && (
            <p className="text-[17px] text-muted-foreground mt-2">
              {meta.join(' · ')}
            </p>
          )}
          {project?.synopsis && (
            <p className="text-[15px] text-foreground/80 mt-4 max-w-[58ch] leading-relaxed line-clamp-3">
              {project.synopsis}
            </p>
          )}
        </div>

        {/* Nächster Drehtag — die Zahl, in der eine Produktion denkt */}
        {stats?.next_shoot_day ? (
          <aside className="self-end rounded-2xl border border-border/60 bg-card p-5 shadow-md lift">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{tt(dashT.nextShootDay)}</span>
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-signal" aria-hidden />
            </div>
            <div className="flex items-end justify-between gap-4 mt-4">
              <div>
                <div className="font-display text-[34px] leading-none">
                  {tt(dashT.day)} {stats.next_shoot_day.day_number}
                </div>
                <div className="text-[13px] text-muted-foreground mt-2">
                  {formatDateLong(stats.next_shoot_day.date)}
                </div>
              </div>
              {daysUntilShoot !== null && daysUntilShoot >= 0 && (
                <div className="text-right shrink-0">
                  <div className="font-display text-[34px] leading-none tabular-nums text-signal">
                    {daysUntilShoot}
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
        ) : isCreator && naechstesVideo ? (
          <aside className="self-end rounded-2xl border border-border/60 bg-card p-5 shadow-md lift">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Nächste Veröffentlichung</span>
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-signal" aria-hidden />
            </div>
            <div className="flex items-end justify-between gap-4 mt-4">
              <div className="min-w-0">
                <div className="text-[19px] font-semibold leading-snug line-clamp-2">{naechstesVideo.title}</div>
                <div className="text-[13px] text-muted-foreground mt-2">
                  {formatDateLong(naechstesVideo.date)} · {naechstesVideo.status}
                </div>
              </div>
              {tageBisVideo !== null && (
                <div className="text-right shrink-0">
                  <div className="font-display text-[34px] leading-none tabular-nums text-signal">{tageBisVideo}</div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    {tageBisVideo === 0 ? tt(dashT.today) : tageBisVideo === 1 ? tt(dashT.tomorrow) : tt(dashT.inDays).replace('{n}', String(tageBisVideo))}
                  </div>
                </div>
              )}
            </div>
            <Button className="w-full mt-5 justify-between" onClick={() => go(`creator/${naechstesVideo.id}`)}>
              Video öffnen <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </aside>
        ) : (
          <aside className="self-end rounded-2xl border border-dashed border-border p-5">
            <span className="eyebrow">{tt(dashT.nextShootDay)}</span>
            <p className="text-[17px] font-semibold text-muted-foreground mt-2">Noch kein Drehtag geplant</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => go(isCreator ? 'kalender' : 'drehplan')}>
              {isCreator ? 'Drehtermin planen' : 'Drehplan anlegen'} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </aside>
        )}
      </header>

      {/* ── Kennzahlen als durchlaufende Zeile ───────────── */}
      <section
        aria-label="Kennzahlen"
        className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl border border-border/60 bg-border/70 overflow-hidden shadow-sm"
      >
        {isCreator ? (<>
        <Figure label="Videos" value={kanal?.video_count ?? 0}
          sub={`${kanal?.published_count ?? 0} veröffentlicht`} onClick={() => go('creator')} />
        <Figure label="Aufrufe" value={kanal?.totals?.views ?? 0}
          sub="über alle Videos" onClick={() => go('creator/performance')} />
        <Figure label="Abos gewonnen" value={kanal?.totals?.subs ?? 0}
          sub={`${(kanal?.totals?.likes ?? 0).toLocaleString('de-DE')} Likes`} onClick={() => go('creator/kanal')} />
        <Figure label="Sponsoring" value={Math.round((kanal?.sponsor_fee_cents ?? 0) / 100)}
          format={n => `${n.toLocaleString('de-DE')} €`}
          sub="Honorare gesamt" onClick={() => go('creator/sponsoren')} />
        </>) : (<>
        <Figure label={tt(dashT.scenes)} value={stats?.total_scenes ?? 0}
          sub={`${stats?.scheduled_scenes ?? 0} ${tt(dashT.inPlan)}`} onClick={() => go('drehbuch')} />
        <Figure label={tt(dashT.shootDays)} value={stats?.total_shoot_days ?? 0}
          sub={`${stats?.completed_shoot_days ?? 0} ${tt(dashT.shot)}`} onClick={() => go('drehplan')} />
        <Figure label={tt(dashT.cast)} value={stats?.total_cast ?? 0}
          sub={tt(dashT.mainCast)} onClick={() => go('besetzung')} />
        <Figure label={tt(dashT.team)} value={stats?.total_crew ?? 0}
          sub={tt(dashT.crewMembers)} onClick={() => go('stabliste')} />
        </>)}
      </section>

      {/* ── Stand & Lage ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 mt-5">

        <section className="rounded-2xl border border-border/60 bg-card p-6 sm:p-7 shadow-sm">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{tt(dashT.progress)}</h2>
            <span className="eyebrow">Stand heute</span>
          </div>

          {isCreator ? (
          <div className="space-y-6 mt-7">
            <ProgressRow label="Videos veröffentlicht" tone="success"
              done={kanal?.published_count ?? 0} total={kanal?.video_count ?? 0} pct={veroeffentlichtPct} />
            <ProgressRow label="Mit Termin im Redaktionsplan" tone="info" delay={120}
              done={kanal?.planned_count ?? 0} total={kanal?.video_count ?? 0} pct={geplantPct} />
          </div>
          ) : (
          <div className="space-y-6 mt-7">
            <ProgressRow label={tt(dashT.scheduleDone)} tone="ink"
              done={stats?.scheduled_scenes ?? 0} total={stats?.total_scenes ?? 0} pct={scheduleProgress} />
            <ProgressRow label={tt(dashT.shootDaysDone)} tone="info" delay={120}
              done={stats?.completed_shoot_days ?? 0} total={stats?.total_shoot_days ?? 0} pct={shootProgress} />
            <ProgressRow label={tt(dashT.scenesShot)} tone="success" delay={240}
              done={stats?.shot_scenes ?? 0} total={stats?.total_scenes ?? 0} pct={shotScenesProgress} />
          </div>
          )}

          {stats?.budget_total_cents > 0 && (
            <div className="mt-8 pt-6 border-t border-border/70 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="eyebrow">{tt(dashT.budget)}</div>
                <div className="font-display text-[28px] leading-none mt-2 tabular-nums">
                  {formatCurrency(Math.round(budgetShown))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <div className="eyebrow">{tt(dashT.financing)}</div>
                  <span className={cn('text-[12px] font-semibold tabular-nums', financingOk ? 'text-success' : 'text-warning')}>
                    {financingPct}%
                  </span>
                </div>
                <div className="font-display text-[28px] leading-none mt-2 tabular-nums">
                  {formatCurrency(Math.round(financingShown))}
                </div>
                <div className="h-2 bg-foreground/[0.07] rounded-full overflow-hidden mt-3">
                  <div
                    className={cn('h-full rounded-full origin-left transition-transform duration-1000 ease-smooth', financingOk ? 'bg-success' : 'bg-foreground/80')}
                    style={{ transform: `scaleX(${entered ? financingPct / 100 : 0})` }}
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
          <section className="rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center gap-2 px-5 pt-5">
              {errors.length > 0
                ? <AlertCircle className="w-3.5 h-3.5 text-danger" />
                : warnings.length > 0
                  ? <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  : <CheckCircle className="w-3.5 h-3.5 text-success" />}
              <h2 className="text-[17px] font-semibold tracking-[-0.02em]">{tt(dashT.conflictRadar)}</h2>
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
                    <dd className={cn('text-[15px] font-semibold tabular-nums', r.text)}>{r.n}</dd>
                  </div>
                ))}
              </dl>
            )}

            <button
              onClick={() => go('konfliktradar')}
              aria-label="Konfliktradar Details anzeigen"
              className="mt-3 w-full flex items-center justify-between border-t border-border/70 px-5 py-3 text-[14px] text-primary hover:bg-foreground/[0.025] transition-colors duration-150 rounded-b-2xl"
            >
              Details anzeigen
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </section>

          {/* Schnellzugriff mit den vorhandenen Tastenkürzeln */}
          <section>
            <h2 className="eyebrow px-4 pb-2">Schnellzugriff</h2>
            <ul className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden divide-y divide-border/70">
              {jumps.map(item => (
                <li key={item.path}>
                  <button
                    onClick={() => go(item.path)}
                    aria-label={`Zu ${item.label} navigieren`}
                    className="group w-full flex items-center gap-3 pl-3.5 pr-4 h-11 text-[14px] text-foreground hover:bg-foreground/[0.03] transition-colors duration-150"
                  >
                    <span className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 bg-foreground/[0.06] text-foreground/75">
                      <item.icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.key && <kbd className="opacity-0 group-hover:opacity-100 transition-opacity">{item.key}</kbd>}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
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
