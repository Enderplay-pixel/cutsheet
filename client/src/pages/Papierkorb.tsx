import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Undo2, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useT, useGebietsschema } from '@/lib/useT'
import { papierkorbT as p } from '@/lib/texte/Papierkorb'

const zeitpunkt = (wert: string, gebietsschema: string) =>
  wert // texte-ok
    ? new Date(wert).toLocaleString(gebietsschema, {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : ''

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const qc = useQueryClient()
  const { toast } = useToast()
  const tt = useT()
  const gebietsschema = useGebietsschema()

  const { data } = useQuery({
    queryKey: ['papierkorb', pid],
    queryFn: () => api.papierkorb.inhalt(pid),
  })

  const zurueckholen = useMutation({
    mutationFn: (id: number) => api.papierkorb.wiederherstellen(pid, id),
    onSuccess: (ergebnis: any) => {
      // Alles neu laden: Der Eintrag kann in jeder Liste auftauchen.
      qc.invalidateQueries()
      toast({
        title: tt(p.zurueckgeholt).replace('{tabelle}', ergebnis.tabelle),
        description: [
          ergebnis.titel ? tt(p.wiederDa).replace('{titel}', ergebnis.titel) : '',
          ergebnis.ohne === 1 ? tt(p.teilweiseEins)
            : ergebnis.ohne > 1 ? tt(p.teilweise).replace('{n}', String(ergebnis.ohne)) : '',
        ].filter(Boolean).join(' ') || undefined,
      })
    },
    onError: (fehler: any) =>
      toast({ title: tt(p.nichtZurueck), description: fehler.message, variant: 'destructive' }),
  })

  const eintraege = data?.eintraege || []

  return (
    <div className="px-5 py-6 sm:p-6 max-w-3xl mx-auto space-y-4">
      <PageHeader
        title={tt(p.titel)}
        subtitle={tt(p.untertitel).replace('{n}', String(data?.aufbewahrung_tage ?? 30))}
      />

      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {tt(p.geloescht)}
            {eintraege.length > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">{eintraege.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {eintraege.map((eintrag: any) => (
            <div key={eintrag.id} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">
                  <span className="text-muted-foreground">{eintrag.bezeichnung}</span>
                  {eintrag.label ? ` · ${eintrag.label}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {zeitpunkt(eintrag.deleted_at, gebietsschema)}
                  {eintrag.geloescht_von ? ` · ${eintrag.geloescht_von}` : ''}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs shrink-0"
                disabled={zurueckholen.isPending}
                onClick={() => zurueckholen.mutate(eintrag.id)}
              >
                <Undo2 className="w-3.5 h-3.5 mr-1" />{tt(p.zurueckholen)}
              </Button>
            </div>
          ))}

          {eintraege.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {tt(p.leer)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
