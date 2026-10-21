import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Youtube, RefreshCw, Unplug, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT, useGebietsschema } from '@/lib/useT'
import { youTubeT } from '@/lib/texte/komponenten/YouTubeConnection'

/**
 * Verbindung zum YouTube-Konto: verbinden, abgleichen, trennen.
 *
 * Der Rücklauf von Google landet als Query-Parameter auf dieser Seite, weil ein
 * Browser-Redirect keinen Authorization-Header tragen kann.
 */
export function YouTubeConnection({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const gs = useGebietsschema()
  const [params, setParams] = useSearchParams()
  const [syncResult, setSyncResult] = useState<any>(null)

  const { data: status, isLoading } = useQuery({
    queryKey: ['yt-status', projectId],
    queryFn: () => api.creator.ytStatus(projectId),
  })

  // Rückmeldung aus dem OAuth-Rücklauf auswerten und aus der URL entfernen
  useEffect(() => {
    const result = params.get('youtube')
    if (!result) return

    if (result === 'verbunden') toast({ title: tt(youTubeT.verbunden) })
    else if (result === 'abgebrochen') toast({ title: tt(youTubeT.abgebrochen), variant: 'destructive' })
    else if (result === 'fehler') {
      toast({ title: tt(youTubeT.fehlgeschlagen), description: params.get('grund') || undefined, variant: 'destructive' })
    }

    queryClient.invalidateQueries({ queryKey: ['yt-status', projectId] })
    const next = new URLSearchParams(params)
    next.delete('youtube')
    next.delete('grund')
    setParams(next, { replace: true })
  }, [params, projectId, queryClient, setParams, toast])

  const connect = useMutation({
    mutationFn: () => api.creator.ytConnect(projectId),
    onSuccess: (data: any) => { window.location.href = data.url },
    onError: (err: any) => toast({ title: tt(youTubeT.nichtMoeglich), description: err?.message, variant: 'destructive' }),
  })

  const sync = useMutation({
    mutationFn: () => api.creator.ytSync(projectId),
    onSuccess: (data: any) => {
      setSyncResult(data)
      queryClient.invalidateQueries({ queryKey: ['yt-status', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-overview', projectId] })
      queryClient.invalidateQueries({ queryKey: ['creator-videos', projectId] })
      toast({
        title: tt(youTubeT.abgleichFertig),
        description: [
          data.imported?.length ? tt(youTubeT.neuUebernommen).replace('{n}', String(data.imported.length)) : '',
          tt(youTubeT.zugeordnet).replace('{m}', String(data.matched)).replace('{v}', String(data.videos_on_youtube)),
        ].filter(Boolean).join(', '),
      })
    },
    onError: (err: any) => toast({ title: tt(youTubeT.abgleichFehler), description: err?.message, variant: 'destructive' }),
  })

  const disconnect = useMutation({
    mutationFn: () => api.creator.ytDisconnect(projectId),
    onSuccess: () => {
      setSyncResult(null)
      queryClient.invalidateQueries({ queryKey: ['yt-status', projectId] })
      toast({ title: tt(youTubeT.getrennt) })
    },
    onError: (err: any) => toast({ title: tt(youTubeT.trennenFehler), description: err?.message, variant: 'destructive' }),
  })

  if (isLoading) return null

  // Ohne Zugangsdaten auf dem Server ist nichts einzurichten - dann hilft nur
  // die Anleitung, kein toter Knopf
  if (!status?.configured) {
    return (
      <div className="mb-6 p-4 rounded-lg border border-border/50 bg-muted/20">
        <div className="flex items-center gap-2 font-medium"><Youtube className="w-4 h-4 text-red-500" />{tt(youTubeT.anbindung)}</div>
        <p className="mt-2 text-sm text-muted-foreground">
          {tt(youTubeT.nichtEingerichtet)} <code className="text-xs" /* texte-ok: Variablenname */>YOUTUBE_CLIENT_ID</code> {tt(youTubeT.und)}{' '}
          <code className="text-xs" /* texte-ok: Variablenname */>YOUTUBE_CLIENT_SECRET</code> {tt(youTubeT.ausOauth)}
        </p>
      </div>
    )
  }

  if (!status.connected) {
    return (
      <div className="mb-6 p-4 rounded-lg border border-border/50 bg-card">
        <div className="flex items-center gap-2 font-medium"><Youtube className="w-4 h-4 text-red-500" />{tt(youTubeT.anbindung)}</div>
        <p className="mt-2 mb-3 text-sm text-muted-foreground max-w-2xl">
          {tt(youTubeT.verbindeText)}
        </p>
        <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
          <Youtube className="w-4 h-4 mr-1.5" />{tt(youTubeT.mitYoutube)}
        </Button>
      </div>
    )
  }

  const hasError = Boolean(status.last_error)

  return (
    <div className={cn('mb-6 p-4 rounded-lg border bg-card', hasError ? 'border-amber-500/40' : 'border-border/50')}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 font-medium">
          <Youtube className="w-4 h-4 text-red-500" />
          {status.channel?.title || tt(youTubeT.verbundenerKanal)}
        </div>
        {status.channel?.subscribers != null && (
          <span className="text-xs text-muted-foreground">
            {tt(youTubeT.abonnenten).replace('{n}', Number(status.channel.subscribers).toLocaleString(gs))}
          </span>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', sync.isPending && 'animate-spin')} />
          {sync.isPending ? tt(youTubeT.wirdAbgeglichen) : tt(youTubeT.zahlenAbgleichen)}
        </Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground"
          onClick={() => { if (confirm(tt(youTubeT.trennenFrage))) disconnect.mutate() }}>
          <Unplug className="w-3.5 h-3.5 mr-1.5" />{tt(youTubeT.trennen)}
        </Button>
      </div>

      {status.last_sync_at && (
        <div className="mt-2 text-xs text-muted-foreground">
          {tt(youTubeT.zuletzt).replace('{d}', new Date(status.last_sync_at).toLocaleString(gs))}
        </div>
      )}

      {hasError && (
        <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{status.last_error}</span>
        </div>
      )}

      {syncResult && (
        <div className="mt-3 pt-3 border-t border-border/40 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {tt(youTubeT.ergebnis).replace('{m}', String(syncResult.matched)).replace('{v}', String(syncResult.videos_on_youtube)).replace('{r}', String(syncResult.retention_curves))}
          </div>
          {syncResult.imported?.length > 0 && (
            <div className="text-emerald-400">
              {tt(youTubeT.neuVonYoutube).replace('{l}', syncResult.imported.map((t: string) => tt(youTubeT.zitat).replace('{t}', t)).join(', '))}
            </div>
          )}
          {syncResult.auto_linked?.length > 0 && (
            <div className="text-muted-foreground">
              {tt(youTubeT.autoZugeordnet).replace('{l}', syncResult.auto_linked.map((a: any) => tt(youTubeT.zitatPfeil).replace('{t}', a.title).replace('{z}', a.to)).join(', '))}
            </div>
          )}
          {syncResult.suggestions?.length > 0 && (
            <div className="text-amber-400">
              {tt(youTubeT.nichtEindeutig)}{' '}
              {syncResult.suggestions.map((s: any) => tt(youTubeT.naechsterTreffer).replace('{t}', s.title).replace('{s}', s.suggested_title)).join(', ')}
            </div>
          )}
          {syncResult.unmatched?.length > 0 && (
            <div className="text-muted-foreground">
              {tt(youTubeT.ohneZuordnung).replace('{l}', syncResult.unmatched.join(', '))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
