import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CheckCircle, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const SEV_CONFIG = {
  error:   { label: 'Fehler',   icon: AlertCircle,  color: 'text-red-400',    bg: 'bg-red-500/5 border-red-500/20',    dot: 'bg-red-400' },
  warning: { label: 'Warnung',  icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/5 border-amber-500/20', dot: 'bg-amber-400' },
  info:    { label: 'Hinweis',  icon: AlertCircle,  color: 'text-blue-400',   bg: 'bg-blue-500/5 border-blue-500/20',  dot: 'bg-blue-400' },
} as const

type Severity = keyof typeof SEV_CONFIG

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const navigate = useNavigate()

  const { data: conflicts, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['conflicts', pid],
    queryFn: () => api.conflicts(pid),
    refetchInterval: 30_000, // auto-refresh every 30s
  })

  const errors   = (conflicts || []).filter((c: any) => c.severity === 'error')
  const warnings = (conflicts || []).filter((c: any) => c.severity === 'warning')
  const infos    = (conflicts || []).filter((c: any) => c.severity === 'info')

  const groups: { sev: Severity; items: any[] }[] = (
    [
      { sev: 'error' as Severity,   items: errors },
      { sev: 'warning' as Severity, items: warnings },
      { sev: 'info' as Severity,    items: infos },
    ] as { sev: Severity; items: any[] }[]
  ).filter(g => g.items.length > 0)

  return (
    <div className="p-7 max-w-3xl mx-auto animate-fade-up">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px]">Konfliktradar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automatische Projektprüfung · alle 30 Sek.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isFetching && 'animate-spin')} />
          Neu prüfen
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { sev: 'error' as Severity,   count: errors.length },
          { sev: 'warning' as Severity, count: warnings.length },
          { sev: 'info' as Severity,    count: infos.length },
        ].map(({ sev, count }) => {
          const cfg = SEV_CONFIG[sev]
          return (
            <div key={sev} className={cn(
              'rounded-xl border p-4 flex items-center gap-3',
              count > 0 ? cfg.bg : 'bg-card border-border/60'
            )}>
              <cfg.icon className={cn('w-5 h-5', count > 0 ? cfg.color : 'text-muted-foreground/40')} />
              <div>
                <div className={cn('text-2xl font-bold tabular-nums', count > 0 ? cfg.color : 'text-muted-foreground')}>
                  {count}
                </div>
                <div className="text-xs text-muted-foreground">{cfg.label}{count !== 1 ? (sev === 'info' ? 'e' : 'en') : ''}</div>
              </div>
            </div>
          )
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : conflicts?.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Alles in Ordnung</h2>
          <p className="text-sm text-muted-foreground mt-1">Keine Konflikte im Projekt gefunden.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ sev, items }) => {
            const cfg = SEV_CONFIG[sev]
            return (
              <div key={sev}>
                <div className="flex items-center gap-2 mb-3">
                  <cfg.icon className={cn('w-4 h-4', cfg.color)} />
                  <h2 className={cn('text-sm font-semibold', cfg.color)}>
                    {cfg.label}{items.length !== 1 ? (sev === 'info' ? 'e' : 'en') : ''} ({items.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {items.map((conflict: any, i: number) => (
                    <div key={i} className={cn(
                      'flex items-start gap-3 p-4 rounded-xl border',
                      cfg.bg
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', cfg.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{conflict.message}</p>
                        {conflict.detail && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{conflict.detail}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wide">
                            {conflict.category}
                          </span>
                        </div>
                      </div>
                      {conflict.link && (
                        <Button variant="ghost" size="sm"
                          className={cn('shrink-0 h-7 text-xs gap-1', cfg.color)}
                          onClick={() => navigate(`/projects/${pid}/${conflict.link}`)}>
                          Öffnen <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
