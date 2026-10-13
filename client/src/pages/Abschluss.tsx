import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Check, AlertTriangle, Info, Archive, RotateCcw, ChevronRight } from 'lucide-react'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const qc = useQueryClient()
  const { toast } = useToast()
  const [frage, setFrage] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['abschluss', pid],
    queryFn: () => api.abschluss.pruefung(pid),
  })

  const abschliessen = useMutation({
    mutationFn: (trotzdem: boolean) => api.abschluss.abschliessen(pid, trotzdem),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abschluss', pid] })
      qc.invalidateQueries({ queryKey: ['project', pid] })
      setFrage(false)
      toast({ title: 'Projekt abgeschlossen' })
    },
    onError: (f: any) => toast({ title: 'Nicht abgeschlossen', description: f.message, variant: 'destructive' }),
  })

  const zuruecknehmen = useMutation({
    mutationFn: () => api.abschluss.zuruecknehmen(pid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abschluss', pid] })
      qc.invalidateQueries({ queryKey: ['project', pid] })
      toast({ title: 'Projekt wieder offen' })
    },
    onError: (f: any) => toast({ title: 'Nicht zurückgenommen', description: f.message, variant: 'destructive' }),
  })

  if (isLoading) {
    return (
      <div className="px-5 py-10 text-center text-sm text-muted-foreground">Lade…</div>
    )
  }

  const punkte: any[] = data?.punkte ?? []
  const offen = punkte.filter((p) => p.anzahl > 0)
  const erledigt = punkte.filter((p) => p.anzahl === 0)
  const abgeschlossen = data?.projekt?.status === 'Abgeschlossen'

  return (
    <div className="px-5 py-6 sm:p-6 max-w-4xl mx-auto space-y-4">
      <PageHeader
        title="Abschluss"
        subtitle={data?.projekt?.titel || ''}
      />

      {abgeschlossen ? (
        <Card className="border-emerald-500/40">
          <CardContent className="py-6 text-center space-y-2">
            <Archive className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
            <p className="font-medium">Dieses Projekt ist abgeschlossen</p>
            <p className="text-sm text-muted-foreground">
              Es liegt im Archiv. Die Daten bleiben erhalten - abgeschlossen heißt nicht gelöscht.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => zuruecknehmen.mutate()}
              disabled={zuruecknehmen.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Wieder öffnen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-muted">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Ein Dreh ist irgendwann vorbei, ein Projekt damit nicht. Was danach kommt, vergisst
              man zuverlässig - diese Liste zählt es zusammen. Sie erledigt nichts von selbst.
            </span>
          </div>

          {/* Offene Punkte */}
          {offen.length === 0 ? (
            <Card className="border-emerald-500/40">
              <CardContent className="py-6 text-center space-y-1">
                <Check className="w-7 h-7 mx-auto text-emerald-600 dark:text-emerald-400" />
                <p className="font-medium">Nichts Offenes gefunden</p>
                <p className="text-xs text-muted-foreground">
                  Das heißt: Es spricht nichts Erkennbares dagegen - nicht, dass alles erledigt
                  ist. Das weiß nur, wer am Projekt gearbeitet hat.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Offen
                  {(data?.blockierend ?? 0) > 0 && (
                    <span className="text-sm font-normal text-destructive ml-2">
                      {data.blockierend} davon steht dem Abschluss entgegen
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {offen.map((p) => (
                  <Link
                    key={p.schluessel}
                    to={p.pfad}
                    className="flex items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors"
                  >
                    <span className={`shrink-0 mt-0.5 w-8 text-right tabular-nums font-medium ${
                      p.blockiert ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {p.anzahl}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{p.titel}</div>
                      <div className="text-xs text-muted-foreground">{p.text}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {erledigt.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Erledigt</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-1 sm:grid-cols-2 text-sm text-muted-foreground">
                  {erledigt.map((p) => (
                    <div key={p.schluessel} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      {p.titel}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button onClick={() => setFrage(true)} disabled={abschliessen.isPending}>
            <Archive className="w-4 h-4 mr-1.5" />
            Projekt abschließen
          </Button>
        </>
      )}

      {/* Aufbewahrung */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Was aufzuheben ist</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{data?.aufbewahrung?.hinweis}</span>
          </div>
          <div className="space-y-2">
            {(data?.aufbewahrung?.posten ?? []).map((p: any) => (
              <div key={p.was} className="flex flex-wrap items-baseline gap-2 text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                <span className="flex-1 min-w-[180px]">{p.was}</span>
                <span className={`font-medium ${p.unsicher ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                  {p.frist}
                </span>
                <span className="text-xs text-muted-foreground w-full">{p.grundlage}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Gelöscht wird hier nichts - auch nicht nach Ablauf. Wer löschen will, nutzt die
            Werkzeuge unter Datenschutz und entscheidet einzeln.
          </p>
        </CardContent>
      </Card>

      {frage && (
        <Dialog open onOpenChange={(o) => { if (!o) setFrage(false) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Projekt abschließen</DialogTitle>
              <DialogDescription>
                {(data?.blockierend ?? 0) > 0
                  ? `${data.blockierend} ${data.blockierend === 1 ? 'Punkt steht' : 'Punkte stehen'} dem Abschluss entgegen. Abschließen geht trotzdem - die Punkte bleiben offen und tauchen weiter in der Sammelansicht auf.`
                  : 'Das Projekt wandert ins Archiv. Die Daten bleiben erhalten, und der Abschluss lässt sich zurücknehmen.'}
              </DialogDescription>
            </DialogHeader>
            {(data?.blockierend ?? 0) > 0 && (
              <div className="space-y-1 text-sm">
                {offen.filter((p: any) => p.blockiert).map((p: any) => (
                  <div key={p.schluessel} className="flex gap-2">
                    <span className="text-destructive font-medium tabular-nums w-6 text-right">{p.anzahl}</span>
                    <span>{p.titel}</span>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFrage(false)}>Abbrechen</Button>
              <Button
                onClick={() => abschliessen.mutate((data?.blockierend ?? 0) > 0)}
                disabled={abschliessen.isPending}
              >
                {(data?.blockierend ?? 0) > 0 ? 'Trotzdem abschließen' : 'Abschließen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
