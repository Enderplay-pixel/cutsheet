import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Scissors } from 'lucide-react'
import { useT } from '@/lib/useT'
import { creatorClipsT as T } from '@/lib/texte/CreatorClips'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, Marke, BereichTabelle,
} from '@/components/creator/BereichLayout'

function zeit(sekunden: number): string {
  const m = Math.floor(sekunden / 60)
  const s = Math.floor(sekunden % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const tt = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['creator-clips', pid],
    queryFn: () => api.creator.clipsUebersicht(pid),
  })

  if (isLoading) return <BereichLaden />

  const liste = data?.liste ?? []

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={Scissors}
        titel={tt(T.titel)}
        untertitel={tt(T.untertitel)}
      />

      <Kennzahlen werte={[
        { label: tt(T.auskopplungen), wert: data?.gesamt ?? 0 },
        { label: tt(T.mitBeanstandung), wert: data?.mit_problemen ?? 0, warnung: true },
        {
          label: tt(T.laengeGesamt),
          wert: liste.length ? zeit(liste.reduce((n: number, c: any) => n + c.dauer, 0)) : null,
        },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={Scissors}
          titel={tt(T.leerTitel)}
          text={tt(T.leerText)}
        />
      ) : (
        <BereichTabelle
          minBreite={720}
          kopf={<tr><th>{tt(T.spalteClip)}</th><th>{tt(T.spalteAusVideo)}</th><th>{tt(T.spaltePlattform)}</th><th className="text-right">{tt(T.spalteStart)}</th><th className="text-right">{tt(T.spalteDauer)}</th><th>{tt(T.spalteStatus)}</th><th>{tt(T.spalteBeanst)}</th></tr>}
        >
          {liste.map((c: any) => (
            <tr key={c.id} className={c.probleme.length ? 'bg-warning/5' : undefined}>
              <td className="font-medium">{c.titel}</td>
              <td><VideoLink projectId={pid} videoId={c.video_id}>{c.aus_video}</VideoLink></td>
              <td className="text-muted-foreground">{c.plattform || '-'}</td>
              <td className="text-right tabular-nums">{zeit(c.start)}</td>
              <td className="text-right tabular-nums">{zeit(c.dauer)}</td>
              <td>{c.status ? <Marke text={c.status} /> : '-'}</td>
              <td className="text-[12px] leading-snug text-muted-foreground">
                {c.probleme.length ? c.probleme.join(' · ') : '-'}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
