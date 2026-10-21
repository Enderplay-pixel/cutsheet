import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ListChecks } from 'lucide-react'
import { useT } from '@/lib/useT'
import { creatorChecklistenT as T } from '@/lib/texte/CreatorChecklisten'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
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
        titel={tt(T.titel)}
        untertitel={tt(T.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(T.videos), wert: liste.length },
        { label: tt(T.bereit), wert: data?.bereit ?? 0 },
        { label: tt(T.ohneCheckliste), wert: data?.ohne_checkliste ?? 0, warnung: true },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={ListChecks}
          titel={tt(T.leerTitel)}
          text={tt(T.leerText)}
        />
      ) : (
        <BereichTabelle
          minBreite={700}
          kopf={<tr><th>{tt(T.video)}</th><th>{tt(T.status)}</th><th className="w-40">{tt(T.fortschritt)}</th><th className="text-right">{tt(T.erledigt)}</th><th>{tt(T.nochOffen)}</th></tr>}
        >
          {liste.map((e: any) => (
            <tr key={e.id} className={e.punkte === 0 ? 'text-muted-foreground' : undefined}>
              <td><VideoLink projectId={pid} videoId={e.id}>{e.video}</VideoLink></td>
              <td>{e.status ? <Marke text={e.status} /> : '-'}</td>
              <td>
                {/* Ohne Punkte gibt es keinen Balken. Ein voller Balken wuerde
                    "fertig" behaupten, wo nur nichts angelegt wurde. */}
                {e.fortschritt === null ? (
                  <span className="text-[12px]">{tt(T.keineCheckliste)}</span>
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
                {e.punkte ? `${e.erledigt} / ${e.punkte}` : '-'}
              </td>
              <td className="text-[12px] leading-snug text-muted-foreground">
                {e.offen.length ? e.offen.join(' · ') : (e.punkte ? <Marke text={tt(T.allesErledigt)} ton="gut" /> : '-')}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
