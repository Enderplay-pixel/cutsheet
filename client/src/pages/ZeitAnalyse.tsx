import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0 Min.'
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  if (h === 0) return `${sign}${m} Min.`
  if (m === 0) return `${sign}${h} Std.`
  return `${sign}${h} Std. ${m} Min.`
}

interface SceneRow {
  scene_id: number
  scene_number: string
  title: string
  estimated_minutes: number
  actual_minutes: number
  difference_minutes: number
  /** true: nicht gemessen, sondern aus der Tagesdrehzeit abgeleitet */
  geschaetzt?: boolean
}

export function Component() {
  const { projectId } = useParams()

  const { data: rows, isLoading } = useQuery({
    queryKey: ['time-analysis', projectId],
    queryFn: () => api.timeAnalysis(Number(projectId)),
  })

  if (isLoading) {
    return (
      <div className="px-5 py-6 sm:p-7 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="space-y-2 mt-6">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14" />)}
        </div>
      </div>
    )
  }

  const data: SceneRow[] = rows || []

  const totalEstimated = data.reduce((s, r) => s + (r.estimated_minutes || 0), 0)
  const totalActual = data.reduce((s, r) => s + (r.actual_minutes || 0), 0)
  const totalDiff = totalActual - totalEstimated

  // Max value for bar chart scaling
  const maxVal = Math.max(...data.map(r => Math.max(r.estimated_minutes || 0, r.actual_minutes || 0)), 1)

  const shotScenes = data.filter(r => r.actual_minutes > 0)
  const geschaetzteZeilen = data.filter(r => r.geschaetzt).length
  const overBudgetCount = shotScenes.filter(r => r.difference_minutes > 0).length
  const underBudgetCount = shotScenes.filter(r => r.difference_minutes < 0).length

  return (
    <div className="px-5 py-6 sm:p-7 max-w-5xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display text-[28px] sm:text-[34px]">Zeitanalyse</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Vergleich von geplantem und tatsächlichem Drehaufwand pro Szene
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Gesamt Geplant</div>
          <div className="text-xl font-bold tabular-nums">{formatMinutes(totalEstimated)}</div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Gesamt Ist</div>
          <div className="text-xl font-bold tabular-nums">{formatMinutes(totalActual)}</div>
        </div>
        <div className={cn(
          'border rounded-xl p-4',
          'bg-card border-border/60'
        )}>
          <div className="text-xs text-muted-foreground mb-1">Differenz</div>
          <div className={cn(
            'text-xl font-bold tabular-nums',
            totalDiff > 0 ? 'text-red-400' : totalDiff < 0 ? 'text-green-400' : ''
          )}>
            {totalDiff >= 0 ? '+' : ''}{formatMinutes(totalDiff)}
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Szenen Abgedreht</div>
          <div className="text-xl font-bold tabular-nums">{shotScenes.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {overBudgetCount > 0 && <span className="text-red-400">{overBudgetCount} überzogen</span>}
            {overBudgetCount > 0 && underBudgetCount > 0 && ' · '}
            {underBudgetCount > 0 && <span className="text-green-400">{underBudgetCount} im Zeitplan</span>}
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Clock className="w-10 h-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Noch keine Szenen vorhanden.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Füge Szenen hinzu und trage Tagesberichte ein, um die Zeitanalyse zu sehen.
          </p>
        </div>
      ) : (
        <>
          {/* Visual bar chart */}
          <div className="bg-card border border-border/60 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-medium mb-4">Zeitverteilung pro Szene</h2>
            <div className="space-y-3">
              {data.map(row => (
                <div key={row.scene_id} className="group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground w-12 shrink-0 tabular-nums">
                      Sz. {row.scene_number}
                    </span>
                    <span className="text-xs text-muted-foreground/70 truncate max-w-[200px]">{row.title}</span>
                    {row.actual_minutes > 0 && (
                      <span className={cn(
                        'ml-auto text-xs tabular-nums font-medium shrink-0',
                        row.difference_minutes > 0 ? 'text-red-400' :
                        row.difference_minutes < 0 ? 'text-green-400' :
                        'text-muted-foreground'
                      )}>
                        {row.difference_minutes > 0 ? '+' : ''}{row.difference_minutes} Min.
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {/* Estimated bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/50 w-10 shrink-0">Plan</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/20 rounded-full transition-all duration-500"
                          style={{ width: `${(row.estimated_minutes / maxVal) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground w-24 text-right tabular-nums whitespace-nowrap">
                        {formatMinutes(row.estimated_minutes)}
                      </span>
                    </div>
                    {/* Actual bar */}
                    {row.actual_minutes > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/50 w-10 shrink-0">Ist</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              row.difference_minutes > 5
                                ? 'bg-danger'
                                : row.difference_minutes < -5
                                  ? 'bg-success'
                                  : 'bg-foreground/70'
                            )}
                            style={{ width: `${Math.min((row.actual_minutes / maxVal) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground w-24 text-right tabular-nums whitespace-nowrap">
                          {formatMinutes(row.actual_minutes)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 bg-foreground/20 rounded-full" />
                <span className="text-[11px] text-muted-foreground">Geplant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 bg-foreground/70 rounded-full" />
                <span className="text-[11px] text-muted-foreground">Ist (im Plan)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 bg-danger rounded-full" />
                <span className="text-[11px] text-muted-foreground">Ist (überzogen)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 bg-green-500/70 rounded-full" />
                <span className="text-[11px] text-muted-foreground">Ist (gespart)</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="data-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>Szene</th>
                    <th>Titel</th>
                    <th className="text-right">Geplant</th>
                    <th className="text-right">Ist</th>
                    <th className="text-right">Differenz</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(row => {
                    const diff = row.difference_minutes
                    const hasActual = row.actual_minutes > 0
                    return (
                      <tr key={row.scene_id} className="no-page-break">
                        <td className="font-mono text-xs">{row.scene_number}</td>
                        <td className="max-w-[220px] truncate">{row.title || '—'}</td>
                        <td className="text-right tabular-nums text-sm">
                          {formatMinutes(row.estimated_minutes)}
                        </td>
                        <td className="text-right tabular-nums text-sm">
                          {hasActual ? (
                            <span className={row.geschaetzt ? 'text-muted-foreground' : undefined}>
                              {formatMinutes(row.actual_minutes)}
                              {/* Eine abgeleitete Zahl darf nicht aussehen wie eine gemessene */}
                              {row.geschaetzt && <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">gesch.</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums text-sm">
                          {hasActual ? (
                            <span className={cn(
                              'inline-flex items-center gap-1',
                              diff > 0 ? 'text-red-400' :
                              diff < 0 ? 'text-green-400' :
                              'text-muted-foreground'
                            )}>
                              {diff > 0
                                ? <TrendingUp className="w-3 h-3" />
                                : diff < 0
                                  ? <TrendingDown className="w-3 h-3" />
                                  : <Minus className="w-3 h-3" />
                              }
                              {diff >= 0 ? '+' : ''}{formatMinutes(diff)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td colSpan={2} className="py-3 px-3 pl-4 text-xs uppercase tracking-wide text-muted-foreground">
                      Gesamt
                    </td>
                    <td className="text-right tabular-nums py-3 px-3">
                      {formatMinutes(totalEstimated)}
                    </td>
                    <td className="text-right tabular-nums py-3 px-3">
                      {totalActual > 0 ? formatMinutes(totalActual) : '—'}
                    </td>
                    <td className={cn(
                      'text-right tabular-nums py-3 px-3 pr-4',
                      totalDiff > 0 ? 'text-red-400' :
                      totalDiff < 0 ? 'text-green-400' :
                      ''
                    )}>
                      {totalActual > 0 ? `${totalDiff >= 0 ? '+' : ''}${formatMinutes(totalDiff)}` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {geschaetzteZeilen > 0 && (
              <p className="text-[11px] text-muted-foreground/70 mt-4 leading-relaxed">
                <b>gesch.</b> heißt: für diese {geschaetzteZeilen === 1 ? 'Szene' : `${geschaetzteZeilen} Szenen`} wurde
                keine Zeit gemessen. Der Wert ist die Drehzeit des Tages, verteilt nach geplanter
                Dauer. Gemessene Minuten trägst du im Tagesbericht bei der jeweiligen Szene ein.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
