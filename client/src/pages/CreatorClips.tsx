import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Scissors } from 'lucide-react'
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
        titel="Auskopplungen"
        untertitel="Shorts, Reels und Clips aus den Langvideos – über den ganzen Kanal"
      />

      <Kennzahlen werte={[
        { label: 'Auskopplungen', wert: data?.gesamt ?? 0 },
        { label: 'Mit Beanstandung', wert: data?.mit_problemen ?? 0, warnung: true },
        {
          label: 'Länge gesamt',
          wert: liste.length ? zeit(liste.reduce((n: number, c: any) => n + c.dauer, 0)) : null,
        },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={Scissors}
          titel="Noch keine Auskopplungen"
          text="Clips werden beim jeweiligen Langvideo markiert. Hier stehen sie zusammen – mit Prüfung auf Länge und sinnvolle Grenzen."
        />
      ) : (
        <BereichTabelle
          minBreite={720}
          kopf={<tr><th>Clip</th><th>aus Video</th><th>Plattform</th><th className="text-right">Start</th><th className="text-right">Dauer</th><th>Status</th><th>Beanstandung</th></tr>}
        >
          {liste.map((c: any) => (
            <tr key={c.id} className={c.probleme.length ? 'bg-warning/5' : undefined}>
              <td className="font-medium">{c.titel}</td>
              <td><VideoLink projectId={pid} videoId={c.video_id}>{c.aus_video}</VideoLink></td>
              <td className="text-muted-foreground">{c.plattform || '—'}</td>
              <td className="text-right tabular-nums">{zeit(c.start)}</td>
              <td className="text-right tabular-nums">{zeit(c.dauer)}</td>
              <td>{c.status ? <Marke text={c.status} /> : '—'}</td>
              <td className="text-[12px] leading-snug text-muted-foreground">
                {c.probleme.length ? c.probleme.join(' · ') : '—'}
              </td>
            </tr>
          ))}
        </BereichTabelle>
      )}
    </div>
  )
}
