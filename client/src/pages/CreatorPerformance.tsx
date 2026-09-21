import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
import {
  BereichKopf, Kennzahlen, BereichLaden, NichtsDa, VideoLink, BereichTabelle,
} from '@/components/creator/BereichLayout'

function tag(datum: string): string {
  if (!datum) return '—'
  const [j, m, t] = datum.split('-')
  return `${t}.${m}.${j}`
}

function prozent(n: number | null): string {
  return n === null ? '—' : `${n} %`
}

export function Component() {
  const { projectId } = useParams()
  const pid = Number(projectId)
  const { data, isLoading } = useQuery({
    queryKey: ['creator-performance', pid],
    queryFn: () => api.creator.performance(pid),
  })

  if (isLoading) return <BereichLaden />

  const liste = data?.liste ?? []

  return (
    <div className="page-container animate-fade-up">
      <BereichKopf
        symbol={TrendingUp}
        titel="Video-Performance"
        untertitel="Aufrufe, Klickrate und Haltequote der veröffentlichten Videos"
      />

      <Kennzahlen werte={[
        { label: 'Veröffentlicht', wert: data?.veroeffentlicht ?? 0 },
        { label: 'Aufrufe gesamt', wert: (data?.aufrufe_gesamt ?? 0).toLocaleString('de-DE') },
        { label: 'Klickrate im Schnitt', wert: prozent(data?.ctr_schnitt ?? null),
          hinweis: 'üblich sind 2 bis 10 %' },
        { label: 'Haltequote im Schnitt', wert: prozent(data?.haltequote_schnitt ?? null),
          hinweis: 'ab 50 % gilt als gut' },
      ]} />

      {liste.length === 0 ? (
        <NichtsDa
          symbol={TrendingUp}
          titel="Noch nichts veröffentlicht"
          text="Sobald ein Video ein Veröffentlichungsdatum und Zahlen hat, wird es hier ausgewertet - Klickrate, Haltequote und Abos je Video."
        />
      ) : (
        <BereichTabelle
          minBreite={800}
          kopf={<tr><th>Video</th><th>Serie</th><th>Datum</th><th className="text-right">Aufrufe</th><th className="text-right">Klickrate</th><th className="text-right">Haltequote</th><th className="text-right">Abos</th></tr>}
        >
          {liste.map((e: any) => (
            <tr key={e.id}>
              <td><VideoLink projectId={pid} videoId={e.id}>{e.video}</VideoLink></td>
              <td className="text-muted-foreground text-[12px]">{e.serie || '—'}</td>
              <td className="tabular-nums whitespace-nowrap">{tag(e.datum)}</td>
              <td className="text-right tabular-nums">{e.aufrufe.toLocaleString('de-DE')}</td>
              <td className={cn('text-right tabular-nums',
                e.ctr !== null && e.ctr < 2 && 'text-danger',
                e.ctr !== null && e.ctr > 10 && 'text-success')}>
                {prozent(e.ctr)}
              </td>
              <td className={cn('text-right tabular-nums',
                e.haltequote !== null && e.haltequote < 30 && 'text-danger',
                e.haltequote !== null && e.haltequote >= 50 && 'text-success')}>
                {prozent(e.haltequote)}
              </td>
              <td className="text-right tabular-nums">{e.abos || '—'}</td>
            </tr>
          ))}
        </BereichTabelle>
      )}

      {liste.some((e: any) => e.hinweise.length > 0) && (
        <div className="mt-8">
          <p className="section-label mb-3">Einordnung</p>
          <div className="space-y-3">
            {liste.filter((e: any) => e.hinweise.length).slice(0, 8).map((e: any) => (
              <div key={e.id} className="stat-card">
                <p className="font-semibold text-[13px] mb-1.5">{e.video}</p>
                <ul className="space-y-1">
                  {e.hinweise.map((h: string, i: number) => (
                    <li key={i} className="text-[12px] text-muted-foreground leading-snug">{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
