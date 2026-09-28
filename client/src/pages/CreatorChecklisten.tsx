import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ListChecks } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { data, isLoading } = useQuery({
    queryKey: ['creator-checklisten', pid],
    queryFn: () => api.creator.checklisten(pid),
  })

  if (isLoading) return <BereichLaden />

  const liste = data?.liste ?? []

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={ListChecks}
        titel="Upload-Checklisten"
        untertitel="Was vor dem Hochladen noch offen ist – für jedes Video"
      />

      <Kennzahlen werte={[
        { label: 'Videos', wert: liste.length },
        { label: 'Bereit zum Upload', wert: data?.bereit ?? 0 },
        { label: 'Ohne Checkliste', wert: data?.ohne_checkliste ?? 0, warnung: true },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={ListChecks}
          titel="Noch keine Videos"
          text="Jedes Video bekommt eine eigene Upload-Checkliste. Diese Seite zeigt über den ganzen Kanal, was noch fehlt."
        />
      ) : (
        <BereichTabelle
          minBreite={700}
          kopf={<tr><th>Video</th><th>Status</th><th className="w-40">Fortschritt</th><th className="text-right">Erledigt</th><th>Noch offen</th></tr>}
        >
          {liste.map((e: any) => (
            <tr key={e.id} className={e.punkte === 0 ? 'text-muted-foreground' : undefined}>
              <td><VideoLink projectId={pid} videoId={e.id}>{e.video}</VideoLink></td>
              <td>{e.status ? <Marke text={e.status} /> : '—'}</td>
              <td>
                {/* Ohne Punkte gibt es keinen Balken. Ein voller Balken wuerde
                    "fertig" behaupten, wo nur nichts angelegt wurde. */}
                {e.fortschritt === null ? (
                  <span className="text-[12px]">keine Checkliste</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-[width] duration-700',
                          e.fortschritt === 100 ? 'bg-success' : 'bg-primary')}
                        style={{ width: `${e.fortschritt}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-right">
                      {e.fortschritt}%
                    </span>
                  </div>
                )}
              </td>
              <td className="text-right tabular-nums whitespace-nowrap">
                {e.punkte ? `${e.erledigt} / ${e.punkte}` : '—'}
              </td>
              <td className="text-[12px] leading-snug text-muted-foreground">
                {e.offen.length ? e.offen.join(' · ') : (e.punkte ? <Marke text="alles erledigt" ton="gut" /> : '—')}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
