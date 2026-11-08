import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDateLong, cn, heuteISO } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Film, Users, Clapperboard, AlertTriangle, Calendar,
  DollarSign, MapPin, ArrowRight, CheckCircle, AlertCircle,
  ChevronRight, Video, Lightbulb, Activity, Megaphone, Check, Move
} from 'lucide-react'
import { ArbeitsplatzEditor, ArbeitsplatzRaster } from '@/components/arbeitsplatz/Arbeitsplatz'
import { useArbeitsplatz } from '@/lib/einstellungen'
import { istStandard, standardAnordnung } from '@/lib/bereiche'
import { arbeitsplatzT, bloeckeT } from '@/lib/texte/Arbeitsplatz'
import { SeitenBloecke } from '@/components/arbeitsplatz/SeitenBloecke'
import { isCreatorProject } from '@/lib/projectKind'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useT } from '@/lib/useT'
import { dashT, projectsT } from '@/lib/i18n'
import { onboardingFormatT } from '@/lib/texte/komponenten/OnboardingWizard'
import { aktuellesGebietsschema } from '@/lib/useT'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'
import { useCountUp, useEntered } from '@/lib/motion'

function greeting(): (typeof dashT)['gruss5'] {
  const h = new Date().getHours()
  if (h < 5) return dashT.gruss5
  if (h < 11) return dashT.gruss11
  if (h < 18) return dashT.gruss18
  return dashT.grussAbend
}

/** Zahl im Gebietsschema der gewählten Sprache - vorher fest "de-DE" */
const zahl = (n: number) => n.toLocaleString(aktuellesGebietsschema())

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
      <div className="font-display text-[40px] leading-none mt-2.5 tabular-nums">{format ? format(Math.round(shown)) : zahl(Math.round(shown))}</div>
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
  const tt = useT()
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2">
      <span className="text-[13px] font-medium">{label}</span>
      <span className="text-[13px] tabular-nums text-muted-foreground">
        {tt(dashT.vonGesamt).replace('{a}', String(done)).replace('{b}', String(total))}
        <span className="ml-3 font-semibold text-foreground">{Math.round(shownPct)}%</span>
      </span>
      <div className="col-span-2 h-2 rounded-full bg-foreground/[0.07] overflow-hidden">
        <div
          className={cn('h-full rounded-full origin-left transition-transform duration-1000 ease-smooth',
            tone === 'ink' ? 'bg-primary' : tone === 'info' ? 'bg-orange-500' : 'bg-success')}
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
    queryKey: ['project', Number(projectId)],
    queryFn: () => api.projects.get(Number(projectId))
  })

  // Aktivierungs-Funnel: Öffnen des Demo-Projekts ist ein Schlüssel-Event
  useEffect(() => {
    if (project?.is_demo) track('demo_project_opened')
  }, [project?.is_demo])
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', Number(projectId)],
    queryFn: () => api.projects.stats(Number(projectId))
  })
  const { data: conflicts } = useQuery({
    queryKey: ['conflicts', Number(projectId)],
    queryFn: () => api.conflicts(Number(projectId))
  })

  // Creator-Projekte zeigen Kanal-Kennzahlen statt Szenen und Drehtagen -
  // vorher standen dort vier Nullen aus der Filmwelt.
  const creatorProjekt = isCreatorProject(project)
  const { data: kanal } = useQuery({
    queryKey: ['creator-overview', Number(projectId)],
    queryFn: () => api.creator.overview(Number(projectId)),
    enabled: !!projectId && creatorProjekt,
  })

  // Der Arbeitsplatz des Kontos. Hat es für diese Projektart noch keinen,
  // bietet die Seite einmal die Einrichtung an (Florian, 03.11.2026). Der
  // Zustand bleibt, bis "Fertig" gedrückt ist - das erste Ablegen speichert
  // schon und darf die Einrichtung nicht wegklappen.
  const art = creatorProjekt ? 'creator' : 'film'
  const platz = useArbeitsplatz(art)
  const [einrichtung, setEinrichtung] = useState(false)
  const [anordnen, setAnordnen] = useState(false)
  useEffect(() => {
    if (project && platz.neu) setEinrichtung(true)
  }, [project, platz.neu])

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

  const meta = [
    project?.format ? (onboardingFormatT[project.format] ? tt(onboardingFormatT[project.format]) : project.format) : '',
    project?.genre,
    project?.length_minutes ? tt(dashT.minuten).replace('{n}', String(project.length_minutes)) : '',
  ]
    .filter(Boolean)
  const go = (path: string) => navigate(`/projects/${projectId}/${path}`)

  const isCreator = creatorProjekt
  const heuteIso = heuteISO()
  const naechstesVideo = (kanal?.calendar ?? []).find((e: any) => !e.published && e.date && e.date >= heuteIso)
  const tageBisVideo = naechstesVideo ? differenceInCalendarDays(parseISO(naechstesVideo.date), new Date()) : null
  const veroeffentlichtPct = kanal?.video_count ? Math.round((kanal.published_count / kanal.video_count) * 100) : 0
  const geplantPct = kanal?.video_count ? Math.round((kanal.planned_count / kanal.video_count) * 100) : 0
  const filmJumps = [
    { label: tt(dashT.sprungDrehplan),  icon: Clapperboard, path: 'drehplan',   key: 'D', tint: 'bg-blue-500' },
    { label: tt(dashT.sprungDispo),     icon: Calendar,     path: 'tagesdispo', key: 'T', tint: 'bg-red-500' },
    { label: tt(dashT.sprungSzenen),    icon: Film,         path: 'drehbuch',   key: 'S', tint: 'bg-orange-500' },
    { label: tt(dashT.sprungBesetzung), icon: Users,        path: 'besetzung',  key: 'B', tint: 'bg-violet-500' },
    { label: tt(dashT.sprungMotive),    icon: MapPin,       path: 'motive',     key: 'M', tint: 'bg-green-500' },
    { label: tt(dashT.sprungBudget),    icon: DollarSign,   path: 'budget',     key: 'G', tint: 'bg-teal-500' },
  ]
  // Creator-Projekte haben eigene Bereiche; Drehplan und Szenen gibt es dort nicht
  const creatorJumps = [
    { label: tt(dashT.videos),          icon: Video,        path: 'creator',                key: '', tint: 'bg-red-500' },
    { label: tt(dashT.sprungIdeen),     icon: Lightbulb,    path: 'creator/ideen',          key: '', tint: 'bg-yellow-500' },
    { label: tt(dashT.sprungRedaktion), icon: Calendar,     path: 'creator/redaktionsplan', key: '', tint: 'bg-blue-500' },
    { label: tt(dashT.sprungKanal),     icon: Activity,     path: 'creator/kanal',          key: '', tint: 'bg-violet-500' },
    { label: tt(dashT.sprungSponsoren), icon: Megaphone,    path: 'creator/sponsoren',      key: '', tint: 'bg-green-500' },
    { label: tt(dashT.sprungBudget),    icon: DollarSign,   path: 'budget',                 key: 'G', tint: 'bg-teal-500' },
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
                {tt(greeting())}, <span className="text-foreground">{firstName}</span>
              </span>
            )}
            {project?.status && <span className="chip-primary">{projectsT.status[project.status] ? tt(projectsT.status[project.status]) : project.status}</span>}
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

        {/* Nächster Drehtag - die Zahl, in der eine Produktion denkt */}
        {stats?.next_shoot_day ? (
          <aside data-einfuehrung="naechstes" className="self-end rounded-2xl border border-border/60 bg-card p-5 shadow-md lift">
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
          <aside data-einfuehrung="naechstes" className="self-end rounded-2xl border border-border/60 bg-card p-5 shadow-md lift">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{tt(dashT.naechsteVeroeff)}</span>
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
              {tt(dashT.videoOeffnen)} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </aside>
        ) : (
          <aside data-einfuehrung="naechstes" className="self-end rounded-2xl border border-dashed border-border p-5">
            <span className="eyebrow">{tt(dashT.nextShootDay)}</span>
            <p className="text-[17px] font-semibold text-muted-foreground mt-2">{tt(dashT.keinDrehtag)}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => go(isCreator ? 'kalender' : 'drehplan')}>
              {tt(isCreator ? dashT.drehterminPlanen : dashT.drehplanAnlegen)} <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </aside>
        )}
      </header>

      {/* ── Einrichtung des Arbeitsplatzes beim ersten Besuch ── */}
      {einrichtung && (
        <section
          aria-labelledby="einrichtung-titel"
          // Solange eingerichtet wird, wartet die Einführung der Seite
          data-einfuehrung-sperre
          className="mt-10 rounded-3xl border border-primary/25 bg-primary/[0.035] p-5 sm:p-7 animate-fade-up"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="max-w-[64ch]">
              <span className="eyebrow">{tt(arbeitsplatzT.einrichtung)}</span>
              <h2 id="einrichtung-titel" className="font-display text-[28px] sm:text-[34px] mt-2">
                {tt(arbeitsplatzT.einrichtungTitel)}
              </h2>
              <p className="text-[15px] text-foreground/85 mt-2.5 leading-relaxed">{tt(arbeitsplatzT.einrichtungText)}</p>
              <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{tt(arbeitsplatzT.einrichtungWirkung)}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {!istStandard(art, platz.anordnung) && (
                <Button variant="ghost" onClick={() => platz.setzen(standardAnordnung(art))}>
                  {tt(arbeitsplatzT.standard)}
                </Button>
              )}
              <Button onClick={() => { platz.setzen(platz.anordnung); setEinrichtung(false) }}>
                <Check className="w-3.5 h-3.5" />
                {tt(istStandard(art, platz.anordnung) ? arbeitsplatzT.standardBehalten : arbeitsplatzT.fertig)}
              </Button>
            </div>
          </div>
          <ArbeitsplatzEditor art={art} anordnung={platz.anordnung} onChange={platz.setzen} className="mt-6" />
        </section>
      )}

      {/* ── Anordenbare Abschnitte (Kopfleiste: Seite anordnen) ── */}
      <SeitenBloecke
        seite="dashboard"
        className="mt-10 flex flex-col gap-6"
        bloecke={[
          {
            // Kennzahlen als durchlaufende Zeile
            id: 'kennzahlen', titel: bloeckeT.kennzahlen, inhalt: (
            <section
              aria-label={tt(dashT.kennzahlen)}
              className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl border border-border/60 bg-border/70 overflow-hidden shadow-sm"
            >
              {isCreator ? (<>
              <Figure label={tt(dashT.videos)} value={kanal?.video_count ?? 0}
                sub={tt(dashT.veroeffentlicht).replace('{n}', String(kanal?.published_count ?? 0))} onClick={() => go('creator')} />
              <Figure label={tt(dashT.aufrufe)} value={kanal?.totals?.views ?? 0}
                sub={tt(dashT.ueberAlle)} onClick={() => go('creator/performance')} />
              <Figure label={tt(dashT.abosGewonnen)} value={kanal?.totals?.subs ?? 0}
                sub={tt(dashT.likes).replace('{n}', zahl(kanal?.totals?.likes ?? 0))} onClick={() => go('creator/kanal')} />
              <Figure label={tt(dashT.sponsoring)} value={Math.round((kanal?.sponsor_fee_cents ?? 0) / 100)}
                format={n => formatCurrency(n * 100)}
                sub={tt(dashT.honorare)} onClick={() => go('creator/sponsoren')} />
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
            ),
          },
          {
            // Stand & Lage
            id: 'lage', titel: bloeckeT.lage, inhalt: (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5">

              <section className="rounded-2xl border border-border/60 bg-card p-6 sm:p-7 shadow-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{tt(dashT.progress)}</h2>
                  <span className="eyebrow">{tt(dashT.standHeute)}</span>
                </div>

                {isCreator ? (
                <div className="space-y-6 mt-7">
                  <ProgressRow label={tt(dashT.videosVeroeff)} tone="success"
                    done={kanal?.published_count ?? 0} total={kanal?.video_count ?? 0} pct={veroeffentlichtPct} />
                  <ProgressRow label={tt(dashT.mitTermin)} tone="info" delay={120}
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
                        <span className={cn('text-[12px] font-semibold tabular-nums', financingOk ? 'text-success' : 'text-danger')}>
                          {financingPct}%
                        </span>
                      </div>
                      <div className="font-display text-[28px] leading-none mt-2 tabular-nums">
                        {formatCurrency(Math.round(financingShown))}
                      </div>
                      <div className="h-2 bg-foreground/[0.07] rounded-full overflow-hidden mt-3">
                        <div
                          className={cn('h-full rounded-full origin-left transition-transform duration-1000 ease-smooth', financingOk ? 'bg-success' : 'bg-danger')}
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
                <section data-einfuehrung="konflikte" className="rounded-2xl border border-border/60 bg-card shadow-sm">
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
                    aria-label={tt(dashT.detailsAria)}
                    className="mt-3 w-full flex items-center justify-between border-t border-border/70 px-5 py-3 text-[14px] text-primary hover:bg-foreground/[0.025] transition-colors duration-150 rounded-b-2xl"
                  >
                    {tt(dashT.details)}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </section>

                {/* Schnellzugriff mit den vorhandenen Tastenkürzeln */}
                <section>
                  <h2 className="eyebrow px-4 pb-2">{tt(dashT.quickNav)}</h2>
                  <ul className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden divide-y divide-border/70">
                    {jumps.map(item => (
                      <li key={item.path}>
                        <button
                          onClick={() => go(item.path)}
                          aria-label={tt(dashT.zuNavigieren).replace('{name}', item.label)}
                          className="group w-full flex items-center gap-3 pl-3.5 pr-4 h-11 text-[14px] text-foreground hover:bg-foreground/[0.03] transition-colors duration-150"
                        >
                          <span className={cn('w-7 h-7 rounded-[7px] flex items-center justify-center text-white shrink-0', item.tint)}>
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
            ),
          },
          {
            // Dein Arbeitsplatz: alle Bereiche in der Reihenfolge des Kontos
            id: 'arbeitsplatz', titel: bloeckeT.arbeitsplatz, inhalt: !einrichtung && platz.bereit && (
            <section aria-labelledby="arbeitsplatz-titel">
              {/* Kopf als Ziel der Einführung - die ganze Fläche ist höher als der Bildschirm */}
              <div data-einfuehrung="arbeitsplatz" className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-4">
                <div className="min-w-0">
                  <h2 id="arbeitsplatz-titel" className="text-[19px] font-semibold tracking-[-0.02em]">{tt(arbeitsplatzT.titel)}</h2>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    {tt(anordnen ? arbeitsplatzT.einrichtungText : arbeitsplatzT.untertitel)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {anordnen && !istStandard(art, platz.anordnung) && (
                    <Button variant="ghost" size="sm" onClick={() => platz.setzen(standardAnordnung(art))}>
                      {tt(arbeitsplatzT.standard)}
                    </Button>
                  )}
                  <Button
                    variant={anordnen ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={anordnen}
                    onClick={() => setAnordnen(a => !a)}
                  >
                    {anordnen ? <Check className="w-3.5 h-3.5" /> : <Move className="w-3.5 h-3.5" />}
                    {tt(anordnen ? arbeitsplatzT.fertig : arbeitsplatzT.anordnen)}
                  </Button>
                </div>
              </div>
              {anordnen ? (
                <ArbeitsplatzEditor art={art} anordnung={platz.anordnung} onChange={platz.setzen} />
              ) : (
                <ArbeitsplatzRaster
                  kategorien={platz.kategorien}
                  projektId={projectId!}
                  badges={{ konfliktradar: errors.length + warnings.length || undefined }}
                />
              )}
            </section>
      
            ),
          },
        ]}
      />
    </div>
  )
}
