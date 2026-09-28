import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import { LayoutGrid, Calendar, Sun, Moon, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'

// --- Types ---

interface DayScene {
  scene_id: number
  scene_number: string
  title: string
  int_ext: string
  day_night: string
  eighths: number
  estimated_minutes: number
  location_name: string
  sort_order: number
}

interface ShootDay {
  id: number
  day_number: number
  date: string
  status: string
  notes: string
  total_eighths: number
  estimated_minutes: number
  scenes: DayScene[]
}

interface Scene {
  id: number
  scene_number: string
  title: string
  int_ext: string
  day_night: string
  eighths: number
  estimated_minutes: number
  location_id: number
}

// --- Color helpers ---

type StripVariant = 'INT_TAG' | 'EXT_TAG' | 'INT_NACHT' | 'EXT_NACHT' | 'UNSCHEDULED'

function getStripVariant(int_ext: string, day_night: string): StripVariant {
  const ie = (int_ext ?? '').toUpperCase()
  const dn = (day_night ?? '').toUpperCase()
  if (ie.startsWith('INT') && (dn === 'TAG' || dn === 'T' || dn === 'DAY')) return 'INT_TAG'
  if (ie.startsWith('EXT') && (dn === 'TAG' || dn === 'T' || dn === 'DAY')) return 'EXT_TAG'
  if (ie.startsWith('INT')) return 'INT_NACHT'
  if (ie.startsWith('EXT')) return 'EXT_NACHT'
  return 'INT_TAG'
}

const STRIP_STYLES: Record<StripVariant, { bg: string; border: string; badge: string }> = {
  INT_TAG: {
    bg: 'bg-yellow-200 dark:bg-yellow-800/60',
    border: 'border-l-4 border-yellow-500',
    badge: 'bg-yellow-400/70 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100',
  },
  EXT_TAG: {
    bg: 'bg-sky-200 dark:bg-sky-800/60',
    border: 'border-l-4 border-sky-500',
    badge: 'bg-sky-400/70 dark:bg-sky-700 text-sky-900 dark:text-sky-100',
  },
  INT_NACHT: {
    bg: 'bg-orange-200 dark:bg-orange-800/60',
    border: 'border-l-4 border-orange-600',
    badge: 'bg-orange-400/70 dark:bg-orange-700 text-orange-900 dark:text-orange-100',
  },
  EXT_NACHT: {
    bg: 'bg-indigo-200 dark:bg-indigo-800/60',
    border: 'border-l-4 border-indigo-600',
    badge: 'bg-indigo-400/70 dark:bg-indigo-700 text-indigo-900 dark:text-indigo-100',
  },
  UNSCHEDULED: {
    bg: 'bg-muted',
    border: 'border-l-4 border-muted-foreground/30',
    badge: 'bg-muted-foreground/20 text-muted-foreground',
  },
}

// --- Fraction helper ---

function eighthsToFraction(eighths: number): string {
  if (!eighths || eighths === 0) return '0/8'
  const whole = Math.floor(eighths / 8)
  const remainder = eighths % 8
  if (whole > 0 && remainder > 0) return `${whole} ${remainder}/8`
  if (whole > 0) return `${whole}`
  return `${remainder}/8`
}

// --- Legend ---

const LEGEND_ITEMS: { variant: StripVariant; label: string; icon: React.ReactNode }[] = [
  { variant: 'INT_TAG', label: 'INT / Tag', icon: <Film className="w-3 h-3" /> },
  { variant: 'EXT_TAG', label: 'EXT / Tag', icon: <Sun className="w-3 h-3" /> },
  { variant: 'INT_NACHT', label: 'INT / Nacht', icon: <Moon className="w-3 h-3" /> },
  { variant: 'EXT_NACHT', label: 'EXT / Nacht', icon: <Moon className="w-3 h-3" /> },
]

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {LEGEND_ITEMS.map(({ variant, label, icon }) => (
        <div key={variant} className="flex items-center gap-1.5">
          <div
            className={cn(
              'w-5 h-5 rounded-sm border-l-4 flex items-center justify-center',
              STRIP_STYLES[variant].bg,
              STRIP_STYLES[variant].border,
            )}
          >
            <span className={cn('text-[9px]', STRIP_STYLES[variant].badge)}>{icon}</span>
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}

// --- Scene Strip ---

interface SceneStripProps {
  scene_number: string
  title: string
  int_ext: string
  day_night: string
  eighths: number
  location_name?: string
  variant?: StripVariant
}

function SceneStrip({
  scene_number,
  title,
  int_ext,
  day_night,
  eighths,
  location_name,
  variant,
}: SceneStripProps) {
  const v: StripVariant = variant ?? getStripVariant(int_ext, day_night)
  const styles = STRIP_STYLES[v]
  const intExtLabel = (int_ext ?? '').toUpperCase().startsWith('INT') ? 'INT' : 'EXT'

  return (
    <div
      className={cn(
        'flex items-stretch rounded-sm overflow-hidden shadow-sm',
        'hover:brightness-95 dark:hover:brightness-110 transition-all duration-100 cursor-default',
        styles.bg,
        styles.border,
      )}
      style={{ minHeight: 56, height: 56 }}
    >
      {/* Scene number */}
      <div className="flex items-center justify-center px-2 shrink-0">
        <span className="font-mono font-bold text-sm leading-none">{scene_number}</span>
      </div>

      {/* Middle content */}
      <div className="flex flex-col justify-center flex-1 min-w-0 py-1 pr-1">
        <span className="text-xs font-semibold leading-tight truncate" title={title}>
          {title}
        </span>
        {location_name && (
          <span className="text-[10px] text-muted-foreground leading-tight truncate mt-0.5">
            {location_name}
          </span>
        )}
      </div>

      {/* Right meta */}
      <div className="flex flex-col items-end justify-center gap-1 px-2 shrink-0">
        <span className="text-[10px] font-mono font-semibold leading-none">
          {eighthsToFraction(eighths)}
        </span>
        <span
          className={cn(
            'text-[9px] font-bold uppercase px-1 py-0.5 rounded-sm leading-none',
            styles.badge,
          )}
        >
          {intExtLabel}
        </span>
      </div>
    </div>
  )
}

// --- Skeleton Strip ---

function SkeletonStrip() {
  return (
    <div
      className="rounded-sm bg-muted animate-pulse border-l-4 border-muted-foreground/20"
      style={{ height: 56 }}
    />
  )
}

// --- Day Column ---

interface DayColumnProps {
  dayNumber?: number
  date?: string
  totalEighths?: number
  strips: React.ReactNode[]
  isUnscheduled?: boolean
  isEmpty?: boolean
  emptyLabel?: string
}

function DayColumn({
  dayNumber,
  date,
  totalEighths,
  strips,
  isUnscheduled = false,
  isEmpty = false,
  emptyLabel,
}: DayColumnProps) {
  return (
    <div
      className="flex flex-col shrink-0 rounded-lg overflow-hidden border border-border shadow-sm"
      style={{ minWidth: 180, width: 180 }}
    >
      {/* Column header */}
      <div
        className={cn(
          'px-3 py-2.5 text-white',
          isUnscheduled
            ? 'bg-muted-foreground/70 dark:bg-muted-foreground/40'
            : 'bg-slate-800 dark:bg-slate-700',
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold text-sm leading-tight">
            {isUnscheduled ? 'Ohne Tag' : `Tag ${dayNumber}`}
          </span>
          {!isUnscheduled && totalEighths !== undefined && (
            <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded-full leading-none">
              {eighthsToFraction(totalEighths)}
            </span>
          )}
        </div>
        {date && (
          <div className="flex items-center gap-1 mt-1 opacity-75">
            <Calendar className="w-2.5 h-2.5" />
            <span className="text-[10px] leading-none">{formatDate(date)}</span>
          </div>
        )}
        {isUnscheduled && (
          <div className="mt-1 opacity-75">
            <span className="text-[10px] leading-none">Nicht verplant</span>
          </div>
        )}
      </div>

      {/* Strips */}
      <div className="flex flex-col gap-1 p-2 bg-background flex-1 min-h-[120px]">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center flex-1 py-6 text-center">
            <LayoutGrid className="w-5 h-5 text-muted-foreground/40 mb-2" />
            <span className="text-[11px] text-muted-foreground/60 leading-tight">
              {emptyLabel ?? 'Keine Szenen'}
            </span>
          </div>
        ) : (
          strips
        )}
      </div>
    </div>
  )
}

// --- Stat Badge ---

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2 bg-muted/60 rounded-lg">
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[11px] text-muted-foreground leading-none">{label}</span>
    </div>
  )
}

// --- Main Component ---

export function Component() {
  const { projectId } = useParams<{ projectId: string }>()
  const pid = Number(projectId)

  const { data: days, isLoading: daysLoading } = useQuery<ShootDay[]>({
    queryKey: ['drehplan', pid],
    queryFn: () => api.drehplan.listDays(pid),
    enabled: !!pid,
  })

  const { data: allScenes, isLoading: scenesLoading } = useQuery<Scene[]>({
    queryKey: ['scenes', pid],
    queryFn: () => api.scenes.list(pid),
    enabled: !!pid,
  })

  const isLoading = daysLoading || scenesLoading

  // Derive scheduled scene IDs
  const scheduledSceneIds = useMemo(() => {
    if (!days) return new Set<number>()
    const ids = new Set<number>()
    for (const day of days) {
      for (const s of day.scenes ?? []) {
        ids.add(s.scene_id)
      }
    }
    return ids
  }, [days])

  // Unscheduled scenes
  const unscheduledScenes = useMemo(() => {
    if (!allScenes) return []
    return allScenes.filter((s) => !scheduledSceneIds.has(s.id))
  }, [allScenes, scheduledSceneIds])

  // Stats
  const totalScenes = allScenes?.length ?? 0
  const scheduledCount = scheduledSceneIds.size
  const totalEighthsAll = useMemo(() => {
    if (!allScenes) return 0
    return allScenes.reduce((sum, s) => sum + (s.eighths ?? 0), 0)
  }, [allScenes])
  const totalDays = days?.length ?? 0

  const isEmpty = !isLoading && totalScenes === 0 && totalDays === 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-[28px] sm:text-[34px]">Stäbchenplan</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Visueller Drehplan - Szenenstreifen nach Drehtag
            </p>
          </div>
          <Legend />
        </div>

        {/* Stats bar */}
        {!isLoading && !isEmpty && (
          <div className="flex flex-wrap gap-2 mt-4">
            <StatBadge label="Total Szenen" value={totalScenes} />
            <StatBadge label="Verplante Szenen" value={scheduledCount} />
            <StatBadge label="Seiten gesamt" value={eighthsToFraction(totalEighthsAll)} />
            <StatBadge label="Drehtage" value={totalDays} />
          </div>
        )}
      </div>

      {/* Board area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isEmpty ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <Film className="w-12 h-12 opacity-20" />
            <p className="text-lg font-medium">Noch kein Drehplan vorhanden</p>
            <p className="text-sm opacity-60">
              Erstelle Drehtage im Drehplan, um den Stäbchenplan zu befüllen.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto px-6 py-5">
            <div className="flex gap-3 items-start" style={{ minWidth: 'max-content' }}>
              {/* Loading skeleton */}
              {isLoading && (
                <>
                  {/* Skeleton unscheduled */}
                  <DayColumn
                    isUnscheduled
                    strips={Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonStrip key={i} />
                    ))}
                  />
                  {/* Skeleton days */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <DayColumn
                      key={i}
                      dayNumber={i + 1}
                      strips={Array.from({ length: Math.ceil(Math.random() * 5) + 1 }).map(
                        (_, j) => <SkeletonStrip key={j} />,
                      )}
                    />
                  ))}
                </>
              )}

              {!isLoading && (
                <>
                  {/* Ohne Tag column (always first) */}
                  <DayColumn
                    isUnscheduled
                    isEmpty={unscheduledScenes.length === 0}
                    emptyLabel="Alle Szenen verplant"
                    strips={unscheduledScenes.map((scene) => (
                      <SceneStrip
                        key={scene.id}
                        scene_number={scene.scene_number}
                        title={scene.title}
                        int_ext={scene.int_ext}
                        day_night={scene.day_night}
                        eighths={scene.eighths}
                        variant="UNSCHEDULED"
                      />
                    ))}
                  />

                  {/* Shoot day columns */}
                  {(days ?? [])
                    .slice()
                    .sort((a, b) => a.day_number - b.day_number)
                    .map((day) => {
                      const sorted = [...(day.scenes ?? [])].sort(
                        (a, b) => a.sort_order - b.sort_order,
                      )
                      return (
                        <DayColumn
                          key={day.id}
                          dayNumber={day.day_number}
                          date={day.date}
                          totalEighths={day.total_eighths}
                          isEmpty={sorted.length === 0}
                          strips={sorted.map((scene) => (
                            <SceneStrip
                              key={scene.scene_id}
                              scene_number={scene.scene_number}
                              title={scene.title}
                              int_ext={scene.int_ext}
                              day_night={scene.day_night}
                              eighths={scene.eighths}
                              location_name={scene.location_name}
                            />
                          ))}
                        />
                      )
                    })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
