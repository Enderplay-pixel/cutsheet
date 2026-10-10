import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Undo2, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const zeitpunkt = (wert: string) =>
  wert
    ? new Date(wert).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : ''

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const qc = useQueryClient()
  const { toast } = useToast()

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
        title: `${ergebnis.tabelle} zurückgeholt`,
        description: ergebnis.titel ? `„${ergebnis.titel}" steht wieder an seinem Platz.` : undefined,
      })
    },
    onError: (fehler: any) =>
      toast({ title: 'Nicht zurückgeholt', description: fehler.message, variant: 'destructive' }),
  })

  const eintraege = data?.eintraege || []

  return (
    <div className="px-5 py-6 sm:p-6 max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="Papierkorb"
        subtitle={`Gelöschtes bleibt ${data?.aufbewahrung_tage ?? 30} Tage liegen`}
      />

      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Gelöscht
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
                  {zeitpunkt(eintrag.deleted_at)}
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
                <Undo2 className="w-3.5 h-3.5 mr-1" />Zurückholen
              </Button>
            </div>
          ))}

          {eintraege.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nichts gelöscht. Was hier landet, lässt sich zurückholen - mit derselben
              Kennung, sodass Drehplan, Dispo und Zeiten wieder daran hängen.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
